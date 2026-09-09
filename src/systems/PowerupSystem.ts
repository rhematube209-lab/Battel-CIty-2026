import { Scene, Vector3 } from '@babylonjs/core';
import {
  PowerupType,
  POWERUP_CONFIGS,
  POWERUP_DROP_MILESTONES,
  POWERUP_POOL_SIZE,
} from '../config/powerups';
import { PowerupMilestone } from '../stages/StageDefinition';
import { Powerup } from '../entities/Powerup';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyManager } from './EnemyManager';
import { TileMap } from '../world/TileMap';
import { TileType, PROJECTILE_CONFIG } from '../game/constants';
import { BoxBounds } from './CollisionSystem';

export interface ActivePowerupStatus {
  type: PowerupType;
  name: string;
  shortCode: string;
  remainingTime: number;
}

/**
 * Battlefield Powerup Management System.
 * Responsibilities:
 * 1. Fixed pre-allocated pool of 3 Powerup entities (max 1 active drop in arena).
 * 2. Deterministic drop milestone triggering (configured via StageDefinition).
 * 3. Position safety validation against steel, base, water, and brick corridors.
 * 4. Logical AABB player collection detection (physical drive-over).
 * 5. Timed effect countdowns, refresh on re-collect, independent coexistence.
 * 6. Combat modifiers queries for ProjectileSystem and EnemyManager.
 */
export class PowerupSystem {
  private scene: Scene;
  private tileMap: TileMap;
  private pool: Powerup[] = [];
  private activeDrop: Powerup | null = null;
  private triggeredMilestones: Set<number> = new Set();
  private milestones: Map<number, PowerupType> = new Map();

  // Active timed effect countdown timers (in seconds)
  private overdriveTimer: number = 0;
  private aegisTimer: number = 0;
  private stasisTimer: number = 0;

  // Callbacks for audio / feedback integration
  private onPowerupCollectCallback?: (type: PowerupType) => void;
  private onPowerupExpireCallback?: () => void;

  constructor(scene: Scene, tileMap: TileMap, milestones?: readonly PowerupMilestone[]) {
    this.scene = scene;
    this.tileMap = tileMap;

    if (milestones) {
      this.setMilestones(milestones);
    } else {
      // Fallback for standalone / legacy instantiations
      for (const [k, v] of Object.entries(POWERUP_DROP_MILESTONES)) {
        this.milestones.set(Number(k), v);
      }
    }

    // Pre-allocate fixed pool of Powerup entities
    for (let i = 0; i < POWERUP_POOL_SIZE; i++) {
      this.pool.push(new Powerup(`pooledPowerup_${i}`, this.scene));
    }
  }

  /**
   * Reconfigures milestone drop thresholds from StageDefinition.
   */
  public setMilestones(milestones: readonly PowerupMilestone[]): void {
    this.milestones.clear();
    for (const m of milestones) {
      this.milestones.set(m.destroyedEnemyCount, m.type);
    }
  }

  public getMilestones(): PowerupMilestone[] {
    const list: PowerupMilestone[] = [];
    for (const [count, type] of this.milestones.entries()) {
      list.push({ destroyedEnemyCount: count, type });
    }
    return list;
  }

  public getPool(): readonly Powerup[] {
    return this.pool;
  }

  public getPoolSize(): number {
    return this.pool.length;
  }

  public setOnPowerupCollect(cb: (type: PowerupType) => void): void {
    this.onPowerupCollectCallback = cb;
  }

  public setOnPowerupExpire(cb: () => void): void {
    this.onPowerupExpireCallback = cb;
  }

  /**
   * Evaluates destroyed enemy milestone counter to drop deterministic battlefield powerups.
   */
  public handleEnemyDestroyed(destroyedCount: number, enemyDeathPos: Vector3): boolean {
    const milestoneType = this.milestones.get(destroyedCount);
    if (!milestoneType) return false;

    // Milestone drops trigger strictly once
    if (this.triggeredMilestones.has(destroyedCount)) return false;
    this.triggeredMilestones.add(destroyedCount);

    // Max 1 active battlefield drop at a time (Phase 12 pool safety)
    if (this.activeDrop !== null && this.activeDrop.isActive()) {
      return false;
    }

    const freeSlot = this.pool.find((p) => !p.isActive());
    if (!freeSlot) return false;

    // Find safe, unobstructed world drop position near death coordinates
    const validPos = this.findValidDropPosition(enemyDeathPos);
    if (!validPos) return false;

    freeSlot.spawn(validPos, milestoneType);
    this.activeDrop = freeSlot;
    return true;
  }

  /**
   * Validates and adjusts drop coordinates to ensure powerup does not spawn inside
   * STEEL, BASE, WATER, or outside arena boundaries.
   * If overlapping surviving BRICK quadrants, searches nearest open/bush cell.
   */
  private findValidDropPosition(rawPos: Vector3): Vector3 | null {
    // 1. Clamp within arena playable boundaries
    const clampedX = Math.max(-12.0, Math.min(12.0, rawPos.x));
    const clampedZ = Math.max(-12.0, Math.min(12.0, rawPos.z));
    const testPos = new Vector3(clampedX, 0, clampedZ);

    const grid = this.tileMap.worldToGrid(testPos.x, testPos.z);
    if (!grid) return null;

    if (this.isCellValidForDrop(grid.row, grid.column)) {
      return this.tileMap.gridToWorld(grid.row, grid.column);
    }

    // Search adjacent cells (spiral search up to radius 2)
    const offsets = [
      { r: 0, c: 1 }, { r: 0, c: -1 }, { r: 1, c: 0 }, { r: -1, c: 0 },
      { r: 1, c: 1 }, { r: 1, c: -1 }, { r: -1, c: 1 }, { r: -1, c: -1 },
      { r: 0, c: 2 }, { r: 0, c: -2 }, { r: 2, c: 0 }, { r: -2, c: 0 },
    ];

    for (const offset of offsets) {
      const nr = grid.row + offset.r;
      const nc = grid.column + offset.c;
      if (this.tileMap.isInsideGrid(nr, nc) && this.isCellValidForDrop(nr, nc)) {
        return this.tileMap.gridToWorld(nr, nc);
      }
    }

    // Fallback: Return clamped center position if inside grid
    return testPos;
  }

  /**
   * Tests whether a grid cell is safe for a powerup collectible.
   * Blocked: STEEL, BASE, WATER, or BRICK with intact quadrants.
   * Allowed: EMPTY, BUSH, SPAWNS, or fully destroyed BRICK.
   */
  private isCellValidForDrop(row: number, col: number): boolean {
    const tileType = this.tileMap.getTileType(row, col);
    if (
      tileType === TileType.STEEL ||
      tileType === TileType.BASE ||
      tileType === TileType.WATER ||
      tileType === null
    ) {
      return false;
    }

    if (tileType === TileType.BRICK) {
      const solidBoxes = this.tileMap.getSolidBoxesForCell(row, col);
      if (solidBoxes.length > 0) {
        return false;
      }
    }

    return true;
  }

  /**
   * Main per-frame simulation update.
   * 1. Updates active collectible animation and 10s lifetime countdown.
   * 2. Tests logical AABB overlap with PlayerTank.
   * 3. Counts down active timed effects.
   * 4. Updates visual state attachments on PlayerTank and active EnemyTanks.
   */
  public update(
    deltaTime: number,
    playerTank: PlayerTank,
    enemyManager?: EnemyManager
  ): void {
    // 1. Update active battlefield collectible drop
    if (this.activeDrop !== null && this.activeDrop.isActive()) {
      const stillAlive = this.activeDrop.update(deltaTime);

      if (!stillAlive) {
        // Collectible expired after 10.0 seconds
        this.activeDrop = null;
        this.onPowerupExpireCallback?.();
      } else {
        // Check player collection (player must be living / active)
        if (!playerTank.isDestroyed()) {
          const playerBox = playerTank.getAABB();
          const dropBox = this.activeDrop.getAABB();

          if (this.checkAABBOverlap(playerBox, dropBox)) {
            const collectedType = this.activeDrop.getType();
            this.activeDrop.deactivate();
            this.activeDrop = null;

            this.activateEffect(collectedType);
            this.onPowerupCollectCallback?.(collectedType);
          }
        }
      }
    }

    // 2. Update active powerup timers
    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - deltaTime);
    }

    if (this.aegisTimer > 0) {
      this.aegisTimer = Math.max(0, this.aegisTimer - deltaTime);
    }

    if (this.stasisTimer > 0) {
      this.stasisTimer = Math.max(0, this.stasisTimer - deltaTime);
    }

    // 3. Sync visual state on PlayerTank (AEGIS shield shell)
    playerTank.setAegisShieldActive(this.isAegisShieldActive());

    // 4. Sync visual state on active EnemyTanks (STASIS frozen temporal ring)
    if (enemyManager) {
      const stasisActive = this.isStasisActive();
      const enemies = enemyManager.getActiveEnemies();
      for (let i = 0; i < enemies.length; i++) {
        enemies[i].setStasisActive(stasisActive);
      }
    }
  }

  /**
   * Activates or refreshes a powerup effect.
   * Collecting the same powerup refreshes the duration to full (does NOT stack magnitude).
   */
  public activateEffect(type: PowerupType): void {
    const config = POWERUP_CONFIGS[type];
    if (type === PowerupType.OVERDRIVE_CORE) {
      this.overdriveTimer = config.duration;
    } else if (type === PowerupType.AEGIS_FIELD) {
      this.aegisTimer = config.duration;
    } else if (type === PowerupType.STASIS_PULSE) {
      this.stasisTimer = config.duration;
    }
  }

  private checkAABBOverlap(a: BoxBounds, b: BoxBounds): boolean {
    const EPSILON = 0.001;
    return (
      a.maxX > b.minX + EPSILON &&
      a.minX < b.maxX - EPSILON &&
      a.maxZ > b.minZ + EPSILON &&
      a.minZ < b.maxZ - EPSILON
    );
  }

  // --- Combat Modifier Query Methods ---

  public getPlayerFireCooldown(): number {
    if (this.overdriveTimer > 0) {
      return POWERUP_CONFIGS[PowerupType.OVERDRIVE_CORE].fireCooldown ?? 0.18;
    }
    return PROJECTILE_CONFIG.PLAYER_FIRE_COOLDOWN;
  }

  public getPlayerBulletLimit(): number {
    if (this.overdriveTimer > 0) {
      return POWERUP_CONFIGS[PowerupType.OVERDRIVE_CORE].maxActiveBullets ?? 3;
    }
    return PROJECTILE_CONFIG.MAX_ACTIVE_PLAYER_BULLETS;
  }

  public isAegisShieldActive(): boolean {
    return this.aegisTimer > 0;
  }

  public isStasisActive(): boolean {
    return this.stasisTimer > 0;
  }

  public isOverdriveActive(): boolean {
    return this.overdriveTimer > 0;
  }

  public getActiveDrop(): Powerup | null {
    return this.activeDrop;
  }

  /**
   * Returns list of currently active timed effects with remaining duration for HUD display.
   */
  public getActiveEffects(): ActivePowerupStatus[] {
    const list: ActivePowerupStatus[] = [];

    if (this.overdriveTimer > 0) {
      const cfg = POWERUP_CONFIGS[PowerupType.OVERDRIVE_CORE];
      list.push({
        type: PowerupType.OVERDRIVE_CORE,
        name: cfg.name,
        shortCode: cfg.shortCode,
        remainingTime: this.overdriveTimer,
      });
    }

    if (this.aegisTimer > 0) {
      const cfg = POWERUP_CONFIGS[PowerupType.AEGIS_FIELD];
      list.push({
        type: PowerupType.AEGIS_FIELD,
        name: cfg.name,
        shortCode: cfg.shortCode,
        remainingTime: this.aegisTimer,
      });
    }

    if (this.stasisTimer > 0) {
      const cfg = POWERUP_CONFIGS[PowerupType.STASIS_PULSE];
      list.push({
        type: PowerupType.STASIS_PULSE,
        name: cfg.name,
        shortCode: cfg.shortCode,
        remainingTime: this.stasisTimer,
      });
    }

    return list;
  }

  /**
   * Clears active powerup effects upon player life loss (Requirement 36).
   */
  public clearActiveEffects(): void {
    this.overdriveTimer = 0;
    this.aegisTimer = 0;
    this.stasisTimer = 0;
  }

  /**
   * Full stage restart / replay reset.
   * Deactivates active drop, resets pool slots, clears milestones, resets timers.
   */
  public reset(): void {
    if (this.activeDrop) {
      this.activeDrop.deactivate();
      this.activeDrop = null;
    }
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].reset();
    }
    this.triggeredMilestones.clear();
    this.clearActiveEffects();
  }

  public dispose(): void {
    this.reset();
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].dispose();
    }
    this.pool = [];
  }
}
