import { Scene, ShadowGenerator, Vector3 } from '@babylonjs/core';
import { Direction } from '../game/Direction';
import { ENEMY_CONFIG } from '../game/constants';
import { EnemyTank, EnemyDamageResult } from '../entities/EnemyTank';
import { PlayerTank } from '../entities/PlayerTank';
import { TileMap } from '../world/TileMap';
import { CollisionSystem, BoxBounds } from './CollisionSystem';
import { EnemyAISystem } from './EnemyAISystem';
import { ProjectileSystem } from './ProjectileSystem';
import { EnemyArchetypeId, ENEMY_ARCHETYPES } from '../config/enemyArchetypes';
import { STAGE_01_DEFINITION } from '../stages/stage01';

export interface StageEnemyConfig {
  enemySequence: readonly EnemyArchetypeId[];
  maxActiveEnemies?: number;
  spawnInterval?: number;
}

interface EnemySlot {
  tank: EnemyTank;
  ai: EnemyAISystem;
}

/**
 * EnemyManager orchestrates multi-enemy deployment, fixed-capacity pooling,
 * data-driven archetype sequencing, dynamic vehicle-to-vehicle collision,
 * multi-hit armor damage resolution, duplicate kill protection, and stage completion.
 */
export class EnemyManager {
  private scene: Scene;
  private tileMap: TileMap;
  private collisionSystem: CollisionSystem;
  private getPlayerTank: () => PlayerTank | null;

  // Fixed pool of reusable enemy slots
  private slots: EnemySlot[] = [];

  // Deterministic enemy sequence
  private sequence: EnemyArchetypeId[];

  // Stage enemy accounting
  private totalEnemies: number;
  private maxActiveEnemies: number;
  private spawnInterval: number;
  private spawnedCount: number = 0;
  private destroyedCount: number = 0;

  // Archetype destruction accounting for StageResult
  private archetypeKills: Record<EnemyArchetypeId, number> = {
    [EnemyArchetypeId.STANDARD]: 0,
    [EnemyArchetypeId.FAST]: 0,
    [EnemyArchetypeId.ARMOR]: 0,
  };

  // Spawning controls
  private spawnTimer: number = 0;
  private spawnIndex: number = 0; // Cycles through tileMap.getEnemySpawns()

  // Callbacks
  private onEnemyDestroyedCallback?: (tank: EnemyTank, destroyedCount: number, remaining: number) => void;
  private onEnemyDamagedCallback?: (tank: EnemyTank, currentHp: number, maxHp: number) => void;
  private onStageCompleteCallback?: () => void;
  private stageCompleteNotified: boolean = false;

  constructor(
    scene: Scene,
    tileMap: TileMap,
    collisionSystem: CollisionSystem,
    getPlayerTank: () => PlayerTank | null,
    stageConfigOrShadow?: StageEnemyConfig | ShadowGenerator,
    shadowGeneratorOrSequence?: ShadowGenerator | EnemyArchetypeId[]
  ) {
    this.scene = scene;
    this.tileMap = tileMap;
    this.collisionSystem = collisionSystem;
    this.getPlayerTank = getPlayerTank;

    // Resolve flexible constructor arguments
    let shadowGenerator: ShadowGenerator | undefined;
    let resolvedConfig: StageEnemyConfig = STAGE_01_DEFINITION;

    if (stageConfigOrShadow && 'addShadowCaster' in stageConfigOrShadow) {
      shadowGenerator = stageConfigOrShadow as ShadowGenerator;
      if (Array.isArray(shadowGeneratorOrSequence)) {
        resolvedConfig = { enemySequence: shadowGeneratorOrSequence };
      }
    } else if (stageConfigOrShadow && 'enemySequence' in stageConfigOrShadow) {
      resolvedConfig = stageConfigOrShadow as StageEnemyConfig;
      if (shadowGeneratorOrSequence && 'addShadowCaster' in shadowGeneratorOrSequence) {
        shadowGenerator = shadowGeneratorOrSequence as ShadowGenerator;
      }
    }

    this.sequence = [...resolvedConfig.enemySequence];
    this.totalEnemies = resolvedConfig.enemySequence.length;
    this.maxActiveEnemies = resolvedConfig.maxActiveEnemies ?? 4;
    this.spawnInterval = resolvedConfig.spawnInterval ?? 1.25;

    // Pre-allocate fixed maxActiveEnemies slots (min 4 for pooling safety)
    const poolSize = Math.max(4, this.maxActiveEnemies);
    const spawns = this.tileMap.getEnemySpawns();
    const fallbackSpawn = spawns.length > 0 ? spawns[0] : new Vector3(0, 0, 12);

    for (let i = 0; i < poolSize; i++) {
      const enemyTank = new EnemyTank(
        this.scene,
        fallbackSpawn,
        Direction.SOUTH,
        ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]
      );
      enemyTank.setActive(false); // Inactive in pool initially

      const slotSeed = ENEMY_CONFIG.AI_SEED + i;
      const aiSystem = new EnemyAISystem(
        enemyTank,
        this.tileMap,
        this.collisionSystem,
        this.getPlayerTank,
        slotSeed
      );

      this.slots.push({ tank: enemyTank, ai: aiSystem });

      // Register shadow casting
      if (shadowGenerator) {
        enemyTank.getMeshes().forEach((mesh) => {
          shadowGenerator.addShadowCaster(mesh);
        });
      }
    }
  }

  /**
   * Sets callback invoked when an enemy unit is completely destroyed (HP -> 0).
   */
  public setOnEnemyDestroyed(
    cb: (tank: EnemyTank, destroyedCount: number, remaining: number) => void
  ): void {
    this.onEnemyDestroyedCallback = cb;
  }

  /**
   * Sets callback invoked when a multi-hit enemy takes damage but survives (e.g. ARMOR 3 -> 2 HP).
   */
  public setOnEnemyDamaged(
    cb: (tank: EnemyTank, currentHp: number, maxHp: number) => void
  ): void {
    this.onEnemyDamagedCallback = cb;
  }

  /**
   * Sets callback invoked once when all stage enemies are destroyed and no active enemies remain.
   */
  public setOnStageComplete(cb: () => void): void {
    this.onStageCompleteCallback = cb;
  }

  public getTotalEnemies(): number {
    return this.totalEnemies;
  }

  public getSpawnedCount(): number {
    return this.spawnedCount;
  }

  public getDestroyedCount(): number {
    return this.destroyedCount;
  }

  public getRemainingCount(): number {
    return Math.max(0, this.totalEnemies - this.destroyedCount);
  }

  public getActiveCount(): number {
    let active = 0;
    for (let i = 0; i < this.slots.length; i++) {
      if (this.slots[i].tank.isActive() && !this.slots[i].tank.isDestroyed()) {
        active++;
      }
    }
    return active;
  }

  public getActiveEnemies(): EnemyTank[] {
    const list: EnemyTank[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.tank.isActive() && !slot.tank.isDestroyed()) {
        list.push(slot.tank);
      }
    }
    return list;
  }

  public getActiveEnemyAABBs(): BoxBounds[] {
    const aabbs: BoxBounds[] = [];
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot.tank.isActive() && !slot.tank.isDestroyed()) {
        aabbs.push(slot.tank.getAABB());
      }
    }
    return aabbs;
  }

  public getSequence(): EnemyArchetypeId[] {
    return this.sequence;
  }

  public setSequence(seq: EnemyArchetypeId[]): void {
    this.sequence = [...seq];
  }

  /**
   * Deploys active enemies up to maxActiveEnemies for benchmarking or stress scenarios.
   */
  public forceSpawnMax(): void {
    for (let i = 0; i < this.maxActiveEnemies; i++) {
      this.trySpawnEnemy();
    }
  }

  /**
   * Attempts to spawn the next pending enemy at one of the 3 TileMap spawn points.
   * Pulls the next archetype from the deterministic stage sequence and configures the pooled slot.
   */
  public trySpawnEnemy(): boolean {
    if (this.spawnedCount >= this.totalEnemies) return false;
    if (this.getActiveCount() >= this.maxActiveEnemies) return false;

    // Find available inactive slot in pool
    const freeSlot = this.slots.find((s) => !s.tank.isActive());
    if (!freeSlot) return false;

    const spawns = this.tileMap.getEnemySpawns();
    if (spawns.length === 0) return false;

    // Compile dynamic obstacle AABBs (Player + any currently active enemies)
    const obstacleAABBs: BoxBounds[] = [];
    const player = this.getPlayerTank();
    if (player && !player.isDestroyed()) {
      obstacleAABBs.push(player.getAABB());
    }
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s.tank.isActive() && !s.tank.isDestroyed()) {
        obstacleAABBs.push(s.tank.getAABB());
      }
    }

    // Attempt round-robin spawn points
    for (let attempt = 0; attempt < spawns.length; attempt++) {
      const candidateIndex = (this.spawnIndex + attempt) % spawns.length;
      const spawnPoint = spawns[candidateIndex];

      // Safety check: candidate position must be valid and free of dynamic vehicles
      if (this.collisionSystem.isPositionValid(spawnPoint.x, spawnPoint.z, obstacleAABBs)) {
        // Retrieve archetype from sequence and configure pooled slot
        const archetypeId = this.sequence[this.spawnedCount % this.sequence.length];
        const archetype = ENEMY_ARCHETYPES[archetypeId];

        freeSlot.tank.configure(archetype);
        freeSlot.ai.configure(archetype.aiProfile);

        // Deploy pooled enemy slot
        freeSlot.tank.spawn(spawnPoint, Direction.SOUTH);
        freeSlot.ai.reset();

        this.spawnedCount++;
        this.spawnIndex = (candidateIndex + 1) % spawns.length;
        this.spawnTimer = 0;
        return true;
      }
    }

    // All spawn points obstructed; delay spawn to next tick
    return false;
  }

  /**
   * Handles player projectile impact on a specific enemy tank.
   * Supports multi-hit damage for ARMOR, idempotent destruction, and single score attribution.
   */
  public handleEnemyHit(hitEnemy: EnemyTank): EnemyDamageResult {
    if (hitEnemy.isDestroyed()) {
      return {
        damaged: false,
        destroyed: false,
        previousHp: 0,
        currentHp: 0,
      };
    }

    const damageResult = hitEnemy.takeDamage(1);

    if (damageResult.destroyed) {
      this.destroyedCount++;
      const archetypeId = hitEnemy.getArchetype().id;
      if (this.archetypeKills[archetypeId] !== undefined) {
        this.archetypeKills[archetypeId]++;
      }
      const remaining = this.getRemainingCount();
      this.onEnemyDestroyedCallback?.(hitEnemy, this.destroyedCount, remaining);
      this.checkStageCompletion();
    } else if (damageResult.damaged) {
      this.onEnemyDamagedCallback?.(hitEnemy, damageResult.currentHp, hitEnemy.getMaxHealth());
    }

    return damageResult;
  }

  /**
   * Returns current archetype destruction totals for StageResult analytics.
   */
  public getArchetypeKills(): Record<EnemyArchetypeId, number> {
    return { ...this.archetypeKills };
  }

  /**
   * Evaluates whether Stage completion conditions are fully satisfied.
   */
  private checkStageCompletion(): void {
    if (
      !this.stageCompleteNotified &&
      this.destroyedCount >= this.totalEnemies &&
      this.getActiveCount() === 0
    ) {
      this.stageCompleteNotified = true;
      this.onStageCompleteCallback?.();
    }
  }

  /**
   * Main per-frame simulation update.
   */
  public update(
    deltaTime: number,
    projectileSystem: ProjectileSystem,
    playerObstacles?: BoxBounds[],
    isStasisActive: boolean = false
  ): void {
    // 1. Progressive Enemy Spawning (Paused during temporal Stasis)
    if (!isStasisActive) {
      if (
        this.spawnedCount < this.totalEnemies &&
        this.getActiveCount() < this.maxActiveEnemies
      ) {
        this.spawnTimer += deltaTime;
        if (this.spawnTimer >= this.spawnInterval) {
          this.trySpawnEnemy();
        }
      }
    }

    // 2. Update all active enemy slots
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (!slot.tank.isActive()) continue;

      // Update visuals, track animations, explosion VFX
      slot.tank.update(deltaTime);

      // If active and living, update autonomous AI (Frozen during temporal Stasis)
      if (!slot.tank.isDestroyed()) {
        if (isStasisActive) {
          // Stasis: Freeze movement, decisions, and firing; freeze track animations
          slot.tank.applyMovement(
            slot.tank.getPosition().x,
            slot.tank.getPosition().z,
            slot.tank.getDirection(),
            false,
            0
          );
          continue;
        }

        // Compile dynamic obstacle list for slot `i`:
        // Player AABB + other active/spawning enemies
        const obstaclesForSlot: BoxBounds[] = [];
        if (playerObstacles) {
          obstaclesForSlot.push(...playerObstacles);
        }
        for (let j = 0; j < this.slots.length; j++) {
          if (i !== j) {
            const other = this.slots[j].tank;
            if (other.isActive() && !other.isDestroyed()) {
              obstaclesForSlot.push(other.getAABB());
            }
          }
        }

        slot.ai.update(deltaTime, projectileSystem, obstaclesForSlot);
      }
    }

    // 3. Stage complete check in case last enemy finished explosion VFX
    this.checkStageCompletion();
  }

  /**
   * Reconfigures the enemy manager for a new stage while reusing the pre-allocated pool slots.
   * Updates sequence, total enemy quota, spawn interval, and resets all slots, tallies, and timers.
   */
  public configureStage(stageConfig: StageEnemyConfig): void {
    this.sequence = [...stageConfig.enemySequence];
    this.totalEnemies = stageConfig.enemySequence.length;
    this.maxActiveEnemies = stageConfig.maxActiveEnemies ?? 4;
    this.spawnInterval = stageConfig.spawnInterval ?? 1.25;
    this.reset();
  }

  /**
   * Resets entire stage enemy manager state upon stage restart or replay.
   * Restores sequence cursor to 0, resets pool slots, resets damage visuals and archetype tallies.
   */
  public reset(): void {
    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.spawnTimer = 0;
    this.spawnIndex = 0;
    this.stageCompleteNotified = false;

    this.archetypeKills = {
      [EnemyArchetypeId.STANDARD]: 0,
      [EnemyArchetypeId.FAST]: 0,
      [EnemyArchetypeId.ARMOR]: 0,
    };

    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      slot.tank.setActive(false);
      slot.tank.configure(ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]);
      slot.ai.reset();
    }
  }

  /**
   * Cleanly disposes all pooled enemy tank meshes and materials.
   */
  public dispose(): void {
    for (let i = 0; i < this.slots.length; i++) {
      this.slots[i].tank.dispose();
    }
    this.slots = [];
  }
}
