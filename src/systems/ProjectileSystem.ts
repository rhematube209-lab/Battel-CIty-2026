import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  TransformNode
} from '@babylonjs/core';
import { Bullet } from '../entities/Bullet';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyTank } from '../entities/EnemyTank';
import { Direction, directionToVector } from '../game/Direction';
import {
  PROJECTILE_CONFIG,
  STAGE_CONFIG,
  ProjectileTeam,
  ProjectileHit,
  TileType,
  TILE_SIZE,
  ARENA_WIDTH,
  ARENA_DEPTH,
  COLORS,
  DEBUG
} from '../game/constants';
import { TileMap } from '../world/TileMap';
import { detectQualityProfile } from '../game/QualityProfile';

interface PooledImpact {
  root: TransformNode;
  meshes: Mesh[];
  active: boolean;
  timer: number;
  duration: number;
}

interface DebrisParticle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
}

interface PooledDebris {
  root: TransformNode;
  particles: DebrisParticle[];
  active: boolean;
  timer: number;
  duration: number;
}

/**
 * ProjectileSystem coordinates player and future enemy projectile firing,
 * pooling, sub-step tunneling prevention, partial-brick quadrant collision, and lightweight VFX.
 */
export class ProjectileSystem {
  private scene: Scene;
  private tileMap: TileMap;

  // Projectile pool
  private pool: Bullet[] = [];
  private sharedPlayerBulletMaterial: StandardMaterial;
  private sharedEnemyBulletMaterial: StandardMaterial;

  // Firing cooldown trackers
  private playerCooldownRemaining: number = 0;
  private enemyCooldownRemaining: number = 0;

  // Half boundaries of the arena
  private readonly arenaHalfWidth: number = ARENA_WIDTH / 2; // 13.0
  private readonly arenaHalfDepth: number = ARENA_DEPTH / 2; // 13.0

  // Muzzle flash visual
  private muzzleFlashMesh: Mesh;
  private muzzleFlashMaterial: StandardMaterial;
  private muzzleFlashTimer: number = 0;

  // Impact feedback pool & materials
  private impactPool: PooledImpact[] = [];
  private brickImpactMat: StandardMaterial;
  private steelImpactMat: StandardMaterial;
  private baseImpactMat: StandardMaterial;
  private defaultImpactMat: StandardMaterial;

  // Brick destruction debris pool (Phase 5)
  private debrisPool: PooledDebris[] = [];
  private brickDebrisMat: StandardMaterial;

  // Last hit metadata for Phase 5 and debug analysis
  private lastHit: ProjectileHit | null = null;

  // Combat callbacks (Phase 6, 7, 8 & 10)
  private onBaseHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onPlayerHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onEnemyHitCallback?: (contactPoint: Vector3, dir: Direction, enemy?: EnemyTank) => void;
  private onBrickHitCallback?: (contactPoint: Vector3, dir: Direction, quadrantDestroyed: boolean) => void;
  private onSteelHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onPlayerFireCallback?: () => void;
  private onEnemyFireCallback?: () => void;
  private onAegisShieldHitCallback?: (contactPoint: Vector3, dir: Direction) => void;

  // Combat modifiers provider for Overdrive and Aegis
  private combatModifiersProvider?: {
    getPlayerFireCooldown?: () => number;
    getPlayerBulletLimit?: () => number;
    isAegisShieldActive?: () => boolean;
  };

  // Target provider for dynamic vehicle ray intersection
  private targetProvider?: {
    getPlayer: () => PlayerTank | null;
    getEnemies?: () => EnemyTank[];
    getEnemy?: () => EnemyTank | null;
  };

  constructor(scene: Scene, tileMap: TileMap) {
    this.scene = scene;
    this.tileMap = tileMap;

    // 1. Shared Projectile Materials
    this.sharedPlayerBulletMaterial = new StandardMaterial('bulletPlayerMat', this.scene);
    this.sharedPlayerBulletMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.sharedPlayerBulletMaterial.emissiveColor = new Color3(0.0, 0.9, 1.0); // #00e5ff
    this.sharedPlayerBulletMaterial.specularColor = new Color3(1.0, 1.0, 1.0);
    this.sharedPlayerBulletMaterial.specularPower = 64;

    this.sharedEnemyBulletMaterial = new StandardMaterial('bulletEnemyMat', this.scene);
    this.sharedEnemyBulletMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.sharedEnemyBulletMaterial.emissiveColor = Color3.FromHexString(COLORS.BULLET_ENEMY_GLOW);
    this.sharedEnemyBulletMaterial.specularColor = new Color3(1.0, 0.8, 0.5);
    this.sharedEnemyBulletMaterial.specularPower = 64;

    // 2. Pre-allocate Bullet Pool (Fixed capacity: 8)
    for (let i = 0; i < PROJECTILE_CONFIG.POOL_SIZE; i++) {
      const bullet = new Bullet(`pooledBullet_${i}`, this.scene, this.sharedPlayerBulletMaterial);
      this.pool.push(bullet);
    }

    // 3. Muzzle Flash Effect (Single pre-allocated emissive diamond flare)
    this.muzzleFlashMaterial = new StandardMaterial('muzzleFlashMat', this.scene);
    this.muzzleFlashMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.muzzleFlashMaterial.emissiveColor = new Color3(0.5, 0.95, 1.0);
    this.muzzleFlashMaterial.disableLighting = true;

    this.muzzleFlashMesh = MeshBuilder.CreatePolyhedron(
      'muzzleFlashMesh',
      { type: 1, size: 0.18 },
      this.scene
    );
    this.muzzleFlashMesh.material = this.muzzleFlashMaterial;
    this.muzzleFlashMesh.setEnabled(false);
    this.muzzleFlashMesh.isPickable = false;

    // 4. Impact Materials
    this.brickImpactMat = new StandardMaterial('brickImpactMat', this.scene);
    this.brickImpactMat.diffuseColor = new Color3(0.9, 0.45, 0.2);
    this.brickImpactMat.emissiveColor = new Color3(0.9, 0.4, 0.15);
    this.brickImpactMat.disableLighting = true;

    this.steelImpactMat = new StandardMaterial('steelImpactMat', this.scene);
    this.steelImpactMat.diffuseColor = new Color3(0.7, 0.9, 1.0);
    this.steelImpactMat.emissiveColor = new Color3(0.65, 0.85, 1.0);
    this.steelImpactMat.disableLighting = true;

    this.baseImpactMat = new StandardMaterial('baseImpactMat', this.scene);
    this.baseImpactMat.diffuseColor = new Color3(0.0, 0.9, 1.0);
    this.baseImpactMat.emissiveColor = new Color3(0.0, 0.9, 1.0);
    this.baseImpactMat.disableLighting = true;

    this.defaultImpactMat = new StandardMaterial('defaultImpactMat', this.scene);
    this.defaultImpactMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
    this.defaultImpactMat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    this.defaultImpactMat.disableLighting = true;

    // 5. Pre-allocate Impact FX Pool (6 reusable 4-spark bursts)
    this.initImpactPool(6);

    // 6. Brick Debris Material & Pool (Phase 5)
    this.brickDebrisMat = new StandardMaterial('brickDebrisMat', this.scene);
    this.brickDebrisMat.diffuseColor = Color3.FromHexString(COLORS.BRICK_WARM);
    this.brickDebrisMat.specularColor = new Color3(0.2, 0.15, 0.12);
    this.brickDebrisMat.specularPower = 32;

    this.initDebrisPool(4);
  }

  /**
   * Builds pre-allocated impact effect clusters.
   */
  private initImpactPool(count: number): void {
    for (let i = 0; i < count; i++) {
      const root = new TransformNode(`impactRoot_${i}`, this.scene);
      const meshes: Mesh[] = [];

      const offsets = [
        new Vector3(-0.08, 0.04, -0.08),
        new Vector3(0.08, 0.04, -0.08),
        new Vector3(-0.08, 0.04, 0.08),
        new Vector3(0.08, 0.04, 0.08)
      ];

      for (let j = 0; j < offsets.length; j++) {
        const spark = MeshBuilder.CreateBox(
          `spark_${i}_${j}`,
          { size: 0.09 },
          this.scene
        );
        spark.parent = root;
        spark.position.copyFrom(offsets[j]);
        spark.isPickable = false;
        meshes.push(spark);
      }

      root.setEnabled(false);
      this.impactPool.push({
        root,
        meshes,
        active: false,
        timer: 0,
        duration: 0.12
      });
    }
  }

  /**
   * Builds pre-allocated brick destruction debris clusters.
   * 6 small fragments per cluster with directional flight dynamics.
   */
  private initDebrisPool(count: number): void {
    for (let i = 0; i < count; i++) {
      const root = new TransformNode(`debrisRoot_${i}`, this.scene);
      const particles: DebrisParticle[] = [];

      for (let j = 0; j < 6; j++) {
        const size = 0.09 + (j % 3) * 0.02; // 0.09 - 0.13 unit fragments
        const mesh = MeshBuilder.CreateBox(
          `debrisMesh_${i}_${j}`,
          { width: size, height: size * 0.8, depth: size },
          this.scene
        );
        mesh.material = this.brickDebrisMat;
        mesh.parent = root;
        mesh.isPickable = false;

        particles.push({
          mesh,
          vx: 0,
          vy: 0,
          vz: 0,
          rotSpeed: 0
        });
      }

      root.setEnabled(false);
      this.debrisPool.push({
        root,
        particles,
        active: false,
        timer: 0,
        duration: 0.35
      });
    }
  }

  /**
   * Spawns a directional brick debris burst responding to impact direction.
   */
  public triggerDebris(position: Vector3, dir: Direction): void {
    const debris = this.debrisPool.find((item) => !item.active);
    if (!debris) return;

    debris.root.position.copyFrom(position);
    debris.root.setEnabled(true);
    debris.active = true;
    debris.timer = 0;
    debris.duration = 0.35;

    const vec = directionToVector(dir);
    const baseSpeed = 2.4;
    const maxParticles = detectQualityProfile().brickFragmentCount;

    for (let i = 0; i < debris.particles.length; i++) {
      const p = debris.particles[i];
      if (i >= maxParticles) {
        p.mesh.setEnabled(false);
        continue;
      }
      p.mesh.setEnabled(true);
      p.mesh.position.set(0, 0, 0);
      p.mesh.scaling.setAll(1.0);
      p.mesh.rotation.set(0, 0, 0);

      const lateral = (i - 2.5) * 0.55; // Spread on perpendicular axis

      if (dir === Direction.NORTH || dir === Direction.SOUTH) {
        p.vx = lateral;
        p.vz = vec.z * (baseSpeed + (i % 3) * 0.5);
      } else {
        p.vx = vec.x * (baseSpeed + (i % 3) * 0.5);
        p.vz = lateral;
      }

      p.vy = 1.8 + (i % 3) * 0.5; // Upward initial arc
      p.rotSpeed = (i % 2 === 0 ? 1 : -1) * (5 + i);
    }
  }

  /**
   * Resets all active debris emitters (useful during map reset).
   */
  public resetDebris(): void {
    for (let i = 0; i < this.debrisPool.length; i++) {
      this.debrisPool[i].active = false;
      this.debrisPool[i].root.setEnabled(false);
    }
  }

  /**
   * Resets all projectile system state: deactivates all bullets, clears cooldowns,
   * hides muzzle flash, clears impacts and debris, resets lastHit.
   */
  public reset(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].deactivate();
    }
    this.playerCooldownRemaining = 0;
    this.enemyCooldownRemaining = 0;
    this.muzzleFlashTimer = 0;
    if (this.muzzleFlashMesh) {
      this.muzzleFlashMesh.setEnabled(false);
    }
    for (let i = 0; i < this.impactPool.length; i++) {
      this.impactPool[i].active = false;
      this.impactPool[i].root.setEnabled(false);
    }
    this.resetDebris();
    this.lastHit = null;
  }

  /**
   * Rebinds the active TileMap reference upon stage transition.
   */
  public setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
  }

  /**
   * Spawns a lightweight impact burst at the given contact position.
   */
  private triggerImpact(position: Vector3, type: TileType | 'BOUNDARY'): void {
    const impact = this.impactPool.find((item) => !item.active);
    if (!impact) return;

    let mat = this.defaultImpactMat;
    if (type === TileType.BRICK) mat = this.brickImpactMat;
    else if (type === TileType.STEEL) mat = this.steelImpactMat;
    else if (type === TileType.BASE) mat = this.baseImpactMat;

    for (let i = 0; i < impact.meshes.length; i++) {
      impact.meshes[i].material = mat;
      impact.meshes[i].scaling.setAll(1.0);
    }

    impact.root.position.copyFrom(position);
    impact.root.setEnabled(true);
    impact.active = true;
    impact.timer = 0;
    impact.duration = 0.12;
  }

  /**
   * Returns the count of currently active player bullets in flight.
   */
  public getActivePlayerBulletCount(): number {
    return this.pool.filter(
      (b) => b.isActive() && b.getTeam() === ProjectileTeam.PLAYER
    ).length;
  }

  /**
   * Returns the count of currently active enemy bullets in flight.
   */
  public getActiveEnemyBulletCount(): number {
    return this.pool.filter(
      (b) => b.isActive() && b.getTeam() === ProjectileTeam.ENEMY
    ).length;
  }

  /**
   * Returns total active bullet count (player + enemies).
   */
  public getActiveBulletCount(): number {
    return this.pool.filter((b) => b.isActive()).length;
  }

  /**
   * Spawns synthetic test projectiles for worst-case load benchmarking.
   */
  public spawnBenchmarkProjectiles(playerCount: number = 3, enemyCount: number = 6): void {
    let pSpawned = 0;
    let eSpawned = 0;
    for (const bullet of this.pool) {
      if (bullet.isActive()) continue;
      if (pSpawned < playerCount) {
        bullet.setMaterial(this.sharedPlayerBulletMaterial);
        bullet.activate(
          new Vector3(-4 + pSpawned * 3, 0.4, -4),
          Direction.NORTH,
          ProjectileTeam.PLAYER,
          7.5,
          10
        );
        pSpawned++;
      } else if (eSpawned < enemyCount) {
        bullet.setMaterial(this.sharedEnemyBulletMaterial);
        bullet.activate(
          new Vector3(-5 + eSpawned * 2, 0.4, 4),
          Direction.SOUTH,
          ProjectileTeam.ENEMY,
          5.0,
          10
        );
        eSpawned++;
      }
    }
  }

  /**
   * Returns the most recent projectile hit record for Phase 5 inspection.
   */
  public getLastHit(): ProjectileHit | null {
    return this.lastHit;
  }

  /**
   * Registers target provider for dynamic vehicle collision queries.
   */
  public setTargetProvider(provider: {
    getPlayer: () => PlayerTank | null;
    getEnemies?: () => EnemyTank[];
    getEnemy?: () => EnemyTank | null;
  }): void {
    this.targetProvider = provider;
  }

  /**
   * Sets callback invoked when any projectile hits the command base (Phase 6).
   */
  public setBaseHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onBaseHitCallback = cb;
  }

  public setPlayerHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onPlayerHitCallback = cb;
  }

  public setEnemyHitCallback(cb: (contactPoint: Vector3, dir: Direction, enemy?: EnemyTank) => void): void {
    this.onEnemyHitCallback = cb;
  }

  public setBrickHitCallback(cb: (contactPoint: Vector3, dir: Direction, quadrantDestroyed: boolean) => void): void {
    this.onBrickHitCallback = cb;
  }

  public setSteelHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onSteelHitCallback = cb;
  }

  public setOnPlayerFire(cb: () => void): void {
    this.onPlayerFireCallback = cb;
  }

  public setOnEnemyFire(cb: () => void): void {
    this.onEnemyFireCallback = cb;
  }

  public setOnAegisShieldHit(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onAegisShieldHitCallback = cb;
  }

  public setCombatModifiersProvider(provider: {
    getPlayerFireCooldown?: () => number;
    getPlayerBulletLimit?: () => number;
    isAegisShieldActive?: () => boolean;
  }): void {
    this.combatModifiersProvider = provider;
  }

  /**
   * Attempts to fire a player bullet from the tank's cannon muzzle.
   * Enforces fire cooldown (0.28s) and maximum concurrent bullets (2).
   */
  public tryFirePlayer(playerTank: PlayerTank): boolean {
    if (this.playerCooldownRemaining > 0) {
      return false;
    }

    const maxBullets =
      this.combatModifiersProvider?.getPlayerBulletLimit?.() ??
      PROJECTILE_CONFIG.MAX_ACTIVE_PLAYER_BULLETS;

    if (this.getActivePlayerBulletCount() >= maxBullets) {
      return false;
    }

    const bullet = this.pool.find((b) => !b.isActive());
    if (!bullet) {
      return false;
    }

    const muzzlePos = playerTank.getMuzzlePoint();
    const dir = playerTank.getDirection();

    bullet.setMaterial(this.sharedPlayerBulletMaterial);
    bullet.activate(
      muzzlePos,
      dir,
      ProjectileTeam.PLAYER,
      PROJECTILE_CONFIG.SPEED,
      PROJECTILE_CONFIG.MAX_LIFETIME
    );

    this.triggerMuzzleFlash(muzzlePos, dir, true);
    const cooldown =
      this.combatModifiersProvider?.getPlayerFireCooldown?.() ??
      PROJECTILE_CONFIG.PLAYER_FIRE_COOLDOWN;
    this.playerCooldownRemaining = cooldown;
    this.onPlayerFireCallback?.();

    return true;
  }

  /**
   * Attempts to fire an enemy bullet from the enemy tank's cannon muzzle.
   * Enforces fire cooldown (0.85s) and team-wide enemy bullet ceiling (6).
   */
  public tryFireEnemy(enemyTank: EnemyTank): boolean {
    if (this.enemyCooldownRemaining > 0) {
      return false;
    }

    if (this.getActiveEnemyBulletCount() >= STAGE_CONFIG.MAX_ACTIVE_ENEMY_BULLETS_TOTAL) {
      return false;
    }

    const bullet = this.pool.find((b) => !b.isActive());
    if (!bullet) {
      return false;
    }

    const muzzlePos = enemyTank.getMuzzlePoint();
    const dir = enemyTank.getDirection();

    const archetype = enemyTank.getArchetype();

    bullet.setMaterial(this.sharedEnemyBulletMaterial);
    bullet.activate(
      muzzlePos,
      dir,
      ProjectileTeam.ENEMY,
      archetype.bulletSpeed,
      PROJECTILE_CONFIG.MAX_LIFETIME
    );

    this.triggerMuzzleFlash(muzzlePos, dir, false);
    this.enemyCooldownRemaining = archetype.fireCooldown;
    this.onEnemyFireCallback?.();

    return true;
  }

  /**
   * Triggers compact directional muzzle flash flare at cannon tip.
   */
  private triggerMuzzleFlash(position: Vector3, dir: Direction = Direction.NORTH, isPlayer: boolean = true): void {
    this.muzzleFlashMesh.position.copyFrom(position);
    this.muzzleFlashMesh.setEnabled(true);
    this.muzzleFlashTimer = 0.05;

    // Directional orientation and tint
    if (isPlayer) {
      this.muzzleFlashMaterial.emissiveColor.set(0.4, 0.95, 1.0);
    } else {
      this.muzzleFlashMaterial.emissiveColor.set(1.0, 0.55, 0.1);
    }

    if (dir === Direction.NORTH || dir === Direction.SOUTH) {
      this.muzzleFlashMesh.scaling.set(0.85, 0.85, 1.35);
    } else {
      this.muzzleFlashMesh.scaling.set(1.35, 0.85, 0.85);
    }
  }

  /**
   * Main per-frame projectile simulation loop.
   * Handles high-speed substep movement and quadrant-accurate partial brick collision.
   */
  public update(deltaTime: number): void {
    // 1. Advance firing cooldowns
    if (this.playerCooldownRemaining > 0) {
      this.playerCooldownRemaining -= deltaTime;
      if (this.playerCooldownRemaining < 0) {
        this.playerCooldownRemaining = 0;
      }
    }
    if (this.enemyCooldownRemaining > 0) {
      this.enemyCooldownRemaining -= deltaTime;
      if (this.enemyCooldownRemaining < 0) {
        this.enemyCooldownRemaining = 0;
      }
    }

    // 2. Update muzzle flash timer
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer -= deltaTime;
      if (this.muzzleFlashTimer <= 0) {
        this.muzzleFlashMesh.setEnabled(false);
      } else {
        const s = Math.max(0.2, this.muzzleFlashTimer / 0.05);
        this.muzzleFlashMesh.scaling.setAll(s);
      }
    }

    // 3. Update active impact feedback effects
    for (let i = 0; i < this.impactPool.length; i++) {
      const impact = this.impactPool[i];
      if (impact.active) {
        impact.timer += deltaTime;
        if (impact.timer >= impact.duration) {
          impact.active = false;
          impact.root.setEnabled(false);
        } else {
          const scale = 1.0 - impact.timer / impact.duration;
          for (let j = 0; j < impact.meshes.length; j++) {
            impact.meshes[j].scaling.setAll(Math.max(0.1, scale));
          }
        }
      }
    }

    // 4. Update active brick debris effects (Phase 5)
    for (let i = 0; i < this.debrisPool.length; i++) {
      const debris = this.debrisPool[i];
      if (debris.active) {
        debris.timer += deltaTime;
        if (debris.timer >= debris.duration) {
          debris.active = false;
          debris.root.setEnabled(false);
        } else {
          const progress = debris.timer / debris.duration;
          const scale = Math.max(0.1, 1.0 - progress);

          for (let j = 0; j < debris.particles.length; j++) {
            const p = debris.particles[j];
            p.vy -= 9.8 * deltaTime; // Gravity pull
            p.mesh.position.x += p.vx * deltaTime;
            p.mesh.position.y += p.vy * deltaTime;
            p.mesh.position.z += p.vz * deltaTime;
            p.mesh.rotation.y += p.rotSpeed * deltaTime;
            p.mesh.scaling.setAll(scale);
          }
        }
      }
    }

    // 5. Simulate active bullets with sub-stepping & partial brick detection
    for (let bIndex = 0; bIndex < this.pool.length; bIndex++) {
      const bullet = this.pool[bIndex];
      if (!bullet.isActive()) continue;

      if (!bullet.updateLifetime(deltaTime)) {
        continue;
      }

      const totalDistance = bullet.getSpeed() * deltaTime;
      const dir = bullet.getDirection();
      const vec = directionToVector(dir);

      const maxSubstep = PROJECTILE_CONFIG.MAX_SUBSTEP;
      const steps = Math.max(1, Math.ceil(totalDistance / maxSubstep));
      const stepDist = totalDistance / steps;

      const half = PROJECTILE_CONFIG.COLLISION_HALF_EXTENT; // 0.10

      for (let s = 0; s < steps; s++) {
        const currPos = bullet.getPosition();
        const nextX = currPos.x + vec.x * stepDist;
        const nextZ = currPos.z + vec.z * stepDist;

        // --- A. Arena Boundary Collision Check ---
        const minX = nextX - half;
        const maxX = nextX + half;
        const minZ = nextZ - half;
        const maxZ = nextZ + half;

        let hitBoundary = false;
        let boundaryHitPos: Vector3 | null = null;

        if (minX < -this.arenaHalfWidth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(-this.arenaHalfWidth, currPos.y, currPos.z);
        } else if (maxX > this.arenaHalfWidth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(this.arenaHalfWidth, currPos.y, currPos.z);
        } else if (minZ < -this.arenaHalfDepth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(currPos.x, currPos.y, -this.arenaHalfDepth);
        } else if (maxZ > this.arenaHalfDepth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(currPos.x, currPos.y, this.arenaHalfDepth);
        }

        if (hitBoundary && boundaryHitPos) {
          this.lastHit = {
            type: 'BOUNDARY',
            row: -1,
            column: -1,
            worldPoint: { x: boundaryHitPos.x, y: boundaryHitPos.y, z: boundaryHitPos.z },
            incomingDirection: dir
          };
          this.onSteelHitCallback?.(boundaryHitPos, dir);
          this.triggerImpact(boundaryHitPos, 'BOUNDARY');
          bullet.deactivate();
          break;
        }

        // --- B. Substep Collision Check: World Obstacles & Dynamic Tanks ---
        const minCol = Math.max(0, Math.floor((minX + this.arenaHalfWidth) / TILE_SIZE));
        const maxCol = Math.min(12, Math.floor((maxX + this.arenaHalfWidth) / TILE_SIZE));
        const minRow = Math.max(0, Math.floor((this.arenaHalfDepth - maxZ) / TILE_SIZE));
        const maxRow = Math.min(12, Math.floor((this.arenaHalfDepth - minZ) / TILE_SIZE));

        let hitObstacleDetected = false;
        const EPSILON = 0.001;

        // 1. Find Closest World Obstacle Collision (if any)
        interface CandidateHit {
          distanceAlongDir: number;
          type: 'OBSTACLE' | 'TANK';
          contactPoint: Vector3;
          tileType?: TileType;
          row?: number;
          col?: number;
          targetTank?: 'PLAYER' | 'ENEMY';
          hitEnemy?: EnemyTank;
        }

        let closestHit: CandidateHit | null = null;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const tileType = this.tileMap.getTileType(r, c);

            // Pass-through tiles for bullets: EMPTY, SPAWNS, BUSH, WATER
            if (
              tileType === TileType.EMPTY ||
              tileType === TileType.PLAYER_SPAWN ||
              tileType === TileType.ENEMY_SPAWN ||
              tileType === TileType.BUSH ||
              tileType === TileType.WATER ||
              tileType === null
            ) {
              continue;
            }

            // Query active solid boxes (for BRICK, returns only intact 1x1 quadrant boxes)
            const solidBoxes = this.tileMap.getSolidBoxesForCell(r, c, false);

            for (let b = 0; b < solidBoxes.length; b++) {
              const box = solidBoxes[b];
              const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
              const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;

              if (overlapX && overlapZ) {
                let contactX = currPos.x;
                let contactZ = currPos.z;
                let entryDist = 0;

                if (dir === Direction.NORTH) {
                  contactZ = box.minZ;
                  entryDist = box.minZ - currPos.z;
                } else if (dir === Direction.SOUTH) {
                  contactZ = box.maxZ;
                  entryDist = currPos.z - box.maxZ;
                } else if (dir === Direction.EAST) {
                  contactX = box.minX;
                  entryDist = box.minX - currPos.x;
                } else if (dir === Direction.WEST) {
                  contactX = box.maxX;
                  entryDist = currPos.x - box.maxX;
                }

                if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                  closestHit = {
                    distanceAlongDir: entryDist,
                    type: 'OBSTACLE',
                    contactPoint: new Vector3(contactX, currPos.y, contactZ),
                    tileType,
                    row: r,
                    col: c
                  };
                }
              }
            }
          }
        }

        // 2. Check Dynamic Vehicle Targets (Player vs Enemy, Enemy vs Player)
        const bulletTeam = bullet.getTeam();

        if (bulletTeam === ProjectileTeam.PLAYER) {
          // Player bullet can strike any active Enemy Tank (if active, not spawning, not destroyed)
          let enemies: EnemyTank[] = [];
          if (this.targetProvider) {
            if (this.targetProvider.getEnemies) {
              enemies = this.targetProvider.getEnemies();
            } else if (this.targetProvider.getEnemy) {
              const single = this.targetProvider.getEnemy();
              if (single) {
                enemies = [single];
              }
            }
          }

          for (let e = 0; e < enemies.length; e++) {
            const enemy = enemies[e];
            if (enemy && enemy.isActive() && !enemy.isDestroyed() && !enemy.isSpawning()) {
              const enemyBox = enemy.getAABB();
              const overlapX = maxX > enemyBox.minX + EPSILON && minX < enemyBox.maxX - EPSILON;
              const overlapZ = maxZ > enemyBox.minZ + EPSILON && minZ < enemyBox.maxZ - EPSILON;

              if (overlapX && overlapZ) {
                let contactX = currPos.x;
                let contactZ = currPos.z;
                let entryDist = 0;

                if (dir === Direction.NORTH) {
                  contactZ = enemyBox.minZ;
                  entryDist = enemyBox.minZ - currPos.z;
                } else if (dir === Direction.SOUTH) {
                  contactZ = enemyBox.maxZ;
                  entryDist = currPos.z - enemyBox.maxZ;
                } else if (dir === Direction.EAST) {
                  contactX = enemyBox.minX;
                  entryDist = enemyBox.minX - currPos.x;
                } else if (dir === Direction.WEST) {
                  contactX = enemyBox.maxX;
                  entryDist = currPos.x - enemyBox.maxX;
                }

                if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                  closestHit = {
                    distanceAlongDir: entryDist,
                    type: 'TANK',
                    contactPoint: new Vector3(contactX, currPos.y, contactZ),
                    targetTank: 'ENEMY',
                    hitEnemy: enemy
                  };
                }
              }
            }
          }
        } else if (bulletTeam === ProjectileTeam.ENEMY) {
          // Enemy bullet can strike Player Tank (if active, not destroyed, and not invulnerable or protected by AEGIS)
          const player = this.targetProvider?.getPlayer();
          const isAegis = this.combatModifiersProvider?.isAegisShieldActive?.() ?? false;
          if (player && !player.isDestroyed() && (!player.isInvulnerable() || isAegis)) {
            const playerBox = player.getAABB();
            const overlapX = maxX > playerBox.minX + EPSILON && minX < playerBox.maxX - EPSILON;
            const overlapZ = maxZ > playerBox.minZ + EPSILON && minZ < playerBox.maxZ - EPSILON;

            if (overlapX && overlapZ) {
              let contactX = currPos.x;
              let contactZ = currPos.z;
              let entryDist = 0;

              if (dir === Direction.NORTH) {
                contactZ = playerBox.minZ;
                entryDist = playerBox.minZ - currPos.z;
              } else if (dir === Direction.SOUTH) {
                contactZ = playerBox.maxZ;
                entryDist = currPos.z - playerBox.maxZ;
              } else if (dir === Direction.EAST) {
                contactX = playerBox.minX;
                entryDist = playerBox.minX - currPos.x;
              } else if (dir === Direction.WEST) {
                contactX = playerBox.maxX;
                entryDist = currPos.x - playerBox.maxX;
              }

              if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                closestHit = {
                  distanceAlongDir: entryDist,
                  type: 'TANK',
                  contactPoint: new Vector3(contactX, currPos.y, contactZ),
                  targetTank: 'PLAYER'
                };
              }
            }
          }
        }

        // 3. Resolve Closest Hit (First Obstacle/Target Along Ray)
        if (closestHit) {
          hitObstacleDetected = true;

          if (closestHit.type === 'TANK') {
            if (closestHit.targetTank === 'ENEMY') {
              this.onEnemyHitCallback?.(closestHit.contactPoint, dir, closestHit.hitEnemy);
            } else if (closestHit.targetTank === 'PLAYER') {
              const isAegis = this.combatModifiersProvider?.isAegisShieldActive?.() ?? false;
              if (isAegis) {
                // Tactical AEGIS absorbs enemy projectile!
                this.onAegisShieldHitCallback?.(closestHit.contactPoint, dir);
              } else {
                this.onPlayerHitCallback?.(closestHit.contactPoint, dir);
              }
            }
            this.triggerImpact(closestHit.contactPoint, TileType.STEEL);
            bullet.deactivate();
            break;
          } else if (closestHit.type === 'OBSTACLE' && closestHit.tileType !== undefined) {
            const tileType = closestHit.tileType;
            const r = closestHit.row!;
            const c = closestHit.col!;
            const contactPoint = closestHit.contactPoint;

            this.lastHit = {
              type: tileType,
              row: r,
              column: c,
              worldPoint: { x: contactPoint.x, y: contactPoint.y, z: contactPoint.z },
              incomingDirection: dir
            };

            // Phase 5 Brick Destruction: Damage the struck quadrant and eject debris (identical for both teams)
            if (tileType === TileType.BRICK) {
              const dmgResult = this.tileMap.damageBrick(
                r,
                c,
                { x: contactPoint.x, z: contactPoint.z },
                dir
              );

              if (DEBUG) {
                console.log(
                  `[BRICK DAMAGE] Cell [${r}, ${c}] Quadrant: ${dmgResult.quadrant} FullyDestroyed: ${dmgResult.tileFullyDestroyed}`
                );
              }

              this.onBrickHitCallback?.(contactPoint, dir, dmgResult.quadrant !== null);
              // Spawn directional brick debris burst
              this.triggerDebris(contactPoint, dir);
            } else if (tileType === TileType.STEEL) {
              this.onSteelHitCallback?.(contactPoint, dir);
            } else if (tileType === TileType.BASE) {
              // Base Vulnerability (both player and enemy bullets destroy base)
              this.onBaseHitCallback?.(contactPoint, dir);
            }

            // Trigger lightweight impact burst
            this.triggerImpact(contactPoint, tileType);

            // Deactivate bullet immediately
            bullet.deactivate();
            break;
          }
        }

        if (hitObstacleDetected) {
          break; // Stop further substeps for this bullet
        }

        // Advance position if no collision occurred in this substep
        bullet.setPosition(nextX, currPos.y, nextZ);
      }

      bullet.update(deltaTime);
    }
  }

  /**
   * Disposes all pooled projectiles, impact meshes, debris meshes, and materials.
   */
  public dispose(): void {
    // Bullets
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].dispose();
    }
    this.pool = [];
    this.sharedPlayerBulletMaterial.dispose();
    this.sharedEnemyBulletMaterial.dispose();

    // Muzzle flash
    this.muzzleFlashMesh.dispose();
    this.muzzleFlashMaterial.dispose();

    // Impacts
    for (let i = 0; i < this.impactPool.length; i++) {
      const imp = this.impactPool[i];
      for (let j = 0; j < imp.meshes.length; j++) {
        imp.meshes[j].dispose();
      }
      imp.root.dispose();
    }
    this.impactPool = [];

    // Debris
    for (let i = 0; i < this.debrisPool.length; i++) {
      const d = this.debrisPool[i];
      for (let j = 0; j < d.particles.length; j++) {
        d.particles[j].mesh.dispose();
      }
      d.root.dispose();
    }
    this.debrisPool = [];
    this.brickDebrisMat.dispose();

    this.brickImpactMat.dispose();
    this.steelImpactMat.dispose();
    this.baseImpactMat.dispose();
    this.defaultImpactMat.dispose();
  }
}
