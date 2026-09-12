import {
  Scene,
  TransformNode,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  InstancedMesh
} from '@babylonjs/core';
import { Tank } from './Tank';
import { Direction } from '../game/Direction';
import { ENEMY_CONFIG } from '../game/constants';
import { BoxBounds } from '../systems/CollisionSystem';
import {
  EnemyArchetypeConfig,
  EnemyArchetypeId,
  ENEMY_ARCHETYPES
} from '../config/enemyArchetypes';
import { TankAssetLibrary } from '../visual/TankAssetLibrary';

export interface EnemyDamageResult {
  damaged: boolean;
  destroyed: boolean;
  previousHp: number;
  currentHp: number;
}

/**
 * Autonomous Enemy Tank entity.
 * Data-driven: dynamically configurable across STANDARD, FAST, and ARMOR archetypes.
 * Features distinct silhouettes, pre-allocated reinforced armor plates,
 * multi-hit health modeling, and reversible visual damage states (zero mesh rebuilds).
 * Powered by hardware instancing from TankAssetLibrary.
 */
export class EnemyTank extends Tank {
  // Current Archetype Configuration
  private archetype: EnemyArchetypeConfig = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD];
  private currentHp: number = 1;
  private maxHp: number = 1;

  // Transform hierarchy
  private turretPivot: TransformNode;
  private muzzlePoint: TransformNode;

  // Visual meshes and materials
  private meshes: (Mesh | InstancedMesh)[] = [];
  private materials: StandardMaterial[] = [];

  // Pre-allocated archetype instances
  private stdChassis?: InstancedMesh;
  private stdTurret?: InstancedMesh;
  private stdCannon?: InstancedMesh;

  private fastChassis?: InstancedMesh;
  private fastTurret?: InstancedMesh;
  private fastCannon?: InstancedMesh;

  private armorChassis?: InstancedMesh;
  private armorTurret?: InstancedMesh;
  private armorCannon?: InstancedMesh;

  // Currently active archetype instances
  private activeChassis?: InstancedMesh;
  private activeTurret?: InstancedMesh;
  private activeCannon?: InstancedMesh;

  // Armor multi-hit damage overlay
  private armorDamageMesh?: Mesh;
  private armorDamageMat?: StandardMaterial;

  // Visual Recoil & Motion state
  private recoilTimer: number = 0;
  private readonly recoilDuration: number = 0.10; // ~100ms
  private readonly recoilTravel: number = 0.06;   // 0.06 world units kick
  private isReducedMotionState: boolean = false;
  private trackAccumulator: number = 0;

  // Phase 12 Temporal Stasis State
  private stasisRingMesh?: Mesh;
  private stasisRingMat?: StandardMaterial;
  private isStasisActiveState: boolean = false;

  // Spawning & Destruction state
  private isSpawningState: boolean = true;
  private isDestroyedState: boolean = false;
  private spawnPulseTimer: number = 0;
  private activeSlot: boolean = false;

  // Pre-allocated destruction VFX
  private explosionRoot?: TransformNode;
  private explosionShockwave?: Mesh;
  private explosionSparks: Mesh[] = [];
  private explosionActive: boolean = false;
  private explosionTimer: number = 0;

  constructor(
    scene: Scene,
    initialPosition: Vector3,
    initialDirection = Direction.SOUTH,
    initialArchetype: EnemyArchetypeConfig = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]
  ) {
    super('EnemyTank', scene, initialPosition, initialDirection);

    // Turret pivot
    this.turretPivot = new TransformNode('enemyTurretPivot', this.scene);
    this.turretPivot.parent = this.rootNode;
    this.turretPivot.position.set(0, 0.35, 0);

    // Muzzle point at cannon tip
    this.muzzlePoint = new TransformNode('enemyMuzzlePoint', this.scene);
    this.muzzlePoint.parent = this.turretPivot;
    this.muzzlePoint.position.set(0, 0.08, 0.95);

    // Proportionate vehicle height matching 5-layer arena wall depth
    this.rootNode.scaling.y = 1.5;

    this.buildVisuals();
    this.initExplosionVFX();
    this.configure(initialArchetype);
  }

  /**
   * Constructs pre-allocated hardware instances for STANDARD, FAST, and ARMOR archetypes.
   * All instances are created once in constructor; zero runtime geometry rebuilding or allocations.
   */
  private buildVisuals(): void {
    const assetLib = TankAssetLibrary.getInstance(this.scene);
    const uid = Math.floor(Math.random() * 1000000);

    // 1. STANDARD Archetype Instances
    this.stdChassis = assetLib.getStandardChassisMaster().createInstance(`enemy_std_c_${uid}`);
    this.stdChassis.parent = this.rootNode;
    this.stdChassis.isPickable = false;
    this.stdChassis.setEnabled(false);
    this.meshes.push(this.stdChassis);

    this.stdTurret = assetLib.getStandardTurretMaster().createInstance(`enemy_std_t_${uid}`);
    this.stdTurret.parent = this.turretPivot;
    this.stdTurret.isPickable = false;
    this.stdTurret.setEnabled(false);
    this.meshes.push(this.stdTurret);

    this.stdCannon = assetLib.getStandardCannonMaster().createInstance(`enemy_std_b_${uid}`);
    this.stdCannon.parent = this.turretPivot;
    this.stdCannon.isPickable = false;
    this.stdCannon.setEnabled(false);
    this.meshes.push(this.stdCannon);

    // 2. FAST Archetype Instances
    this.fastChassis = assetLib.getFastChassisMaster().createInstance(`enemy_fast_c_${uid}`);
    this.fastChassis.parent = this.rootNode;
    this.fastChassis.isPickable = false;
    this.fastChassis.setEnabled(false);
    this.meshes.push(this.fastChassis);

    this.fastTurret = assetLib.getFastTurretMaster().createInstance(`enemy_fast_t_${uid}`);
    this.fastTurret.parent = this.turretPivot;
    this.fastTurret.isPickable = false;
    this.fastTurret.setEnabled(false);
    this.meshes.push(this.fastTurret);

    this.fastCannon = assetLib.getFastCannonMaster().createInstance(`enemy_fast_b_${uid}`);
    this.fastCannon.parent = this.turretPivot;
    this.fastCannon.isPickable = false;
    this.fastCannon.setEnabled(false);
    this.meshes.push(this.fastCannon);

    // 3. ARMOR Archetype Instances
    this.armorChassis = assetLib.getArmorChassisMaster().createInstance(`enemy_armor_c_${uid}`);
    this.armorChassis.parent = this.rootNode;
    this.armorChassis.isPickable = false;
    this.armorChassis.setEnabled(false);
    this.meshes.push(this.armorChassis);

    this.armorTurret = assetLib.getArmorTurretMaster().createInstance(`enemy_armor_t_${uid}`);
    this.armorTurret.parent = this.turretPivot;
    this.armorTurret.isPickable = false;
    this.armorTurret.setEnabled(false);
    this.meshes.push(this.armorTurret);

    this.armorCannon = assetLib.getArmorCannonMaster().createInstance(`enemy_armor_b_${uid}`);
    this.armorCannon.parent = this.turretPivot;
    this.armorCannon.isPickable = false;
    this.armorCannon.setEnabled(false);
    this.meshes.push(this.armorCannon);

    // 4. Pre-allocated Armor Damage Overlay (for 2 HP and 1 HP scorched states)
    this.armorDamageMat = new StandardMaterial(`enemyArmorDamageMat_${uid}`, this.scene);
    this.armorDamageMat.diffuseColor = new Color3(0.12, 0.08, 0.06);
    this.armorDamageMat.emissiveColor = new Color3(0.35, 0.12, 0.02);
    this.armorDamageMat.alpha = 0.65;
    this.materials.push(this.armorDamageMat);

    this.armorDamageMesh = MeshBuilder.CreateBox(
      `enemyArmorDamage_${uid}`,
      { width: 0.94, height: 0.19, depth: 0.34 },
      this.scene
    );
    this.armorDamageMesh.position.set(0, 0.26, 0.52);
    this.armorDamageMesh.parent = this.rootNode;
    this.armorDamageMesh.material = this.armorDamageMat;
    this.armorDamageMesh.isPickable = false;
    this.armorDamageMesh.setEnabled(false);
    this.meshes.push(this.armorDamageMesh);

    // 5. Pre-allocated STASIS pulse energy ring (Phase 12)
    this.stasisRingMat = new StandardMaterial(`enemyStasisMat_${uid}`, this.scene);
    this.stasisRingMat.diffuseColor = new Color3(0.75, 0.4, 1.0);
    this.stasisRingMat.emissiveColor = new Color3(0.65, 0.2, 0.95);
    this.stasisRingMat.alpha = 0.55;
    this.stasisRingMat.disableLighting = true;
    this.materials.push(this.stasisRingMat);

    this.stasisRingMesh = MeshBuilder.CreateTorus(
      `enemyStasisRing_${uid}`,
      { diameter: 1.55, thickness: 0.08, tessellation: 20 },
      this.scene
    );
    this.stasisRingMesh.parent = this.rootNode;
    this.stasisRingMesh.position.y = 0.08;
    this.stasisRingMesh.material = this.stasisRingMat;
    this.stasisRingMesh.isPickable = false;
    this.stasisRingMesh.setEnabled(false);
  }

  /**
   * Pre-allocates reusable explosion shockwave and spark fragments.
   */
  private initExplosionVFX(): void {
    this.explosionRoot = new TransformNode('enemyExplosionRoot', this.scene);
    this.explosionRoot.parent = this.rootNode;
    this.explosionRoot.position.set(0, 0.3, 0);

    const shockwaveMat = new StandardMaterial('enemyShockwaveMat', this.scene);
    shockwaveMat.diffuseColor = new Color3(1.0, 0.3, 0.05);
    shockwaveMat.emissiveColor = new Color3(1.0, 0.3, 0.05);
    shockwaveMat.disableLighting = true;
    this.materials.push(shockwaveMat);

    this.explosionShockwave = MeshBuilder.CreateTorus(
      'enemyShockwave',
      { diameter: 0.4, thickness: 0.08, tessellation: 24 },
      this.scene
    );
    this.explosionShockwave.parent = this.explosionRoot;
    this.explosionShockwave.material = shockwaveMat;
    this.explosionShockwave.isPickable = false;

    const sparkMat = new StandardMaterial('enemySparkMat', this.scene);
    sparkMat.diffuseColor = new Color3(1.0, 0.5, 0.1);
    sparkMat.emissiveColor = new Color3(1.0, 0.45, 0.08);
    sparkMat.disableLighting = true;
    this.materials.push(sparkMat);

    for (let i = 0; i < 8; i++) {
      const spark = MeshBuilder.CreateBox(
        `enemyExplosionSpark_${i}`,
        { size: 0.1 },
        this.scene
      );
      spark.parent = this.explosionRoot;
      spark.material = sparkMat;
      spark.isPickable = false;
      this.explosionSparks.push(spark);
    }

    this.explosionRoot.setEnabled(false);
  }

  /**
   * Reconfigures this pooled tank instance for a specific archetype.
   * Completely resets health, speed, and toggles pre-allocated archetype instances.
   */
  public configure(archetypeOrId: EnemyArchetypeConfig | EnemyArchetypeId | string): void {
    const config: EnemyArchetypeConfig =
      typeof archetypeOrId === 'string'
        ? ENEMY_ARCHETYPES[archetypeOrId as EnemyArchetypeId] || ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]
        : archetypeOrId;

    this.archetype = config;
    this.maxHp = config.maxHp;
    this.currentHp = config.maxHp;
    this.speed = config.speed;

    // Disable all archetype instances
    if (this.stdChassis) this.stdChassis.setEnabled(false);
    if (this.stdTurret) this.stdTurret.setEnabled(false);
    if (this.stdCannon) this.stdCannon.setEnabled(false);

    if (this.fastChassis) this.fastChassis.setEnabled(false);
    if (this.fastTurret) this.fastTurret.setEnabled(false);
    if (this.fastCannon) this.fastCannon.setEnabled(false);

    if (this.armorChassis) this.armorChassis.setEnabled(false);
    if (this.armorTurret) this.armorTurret.setEnabled(false);
    if (this.armorCannon) this.armorCannon.setEnabled(false);

    // Select and enable active archetype instances
    switch (config.id) {
      case EnemyArchetypeId.FAST:
        this.activeChassis = this.fastChassis;
        this.activeTurret = this.fastTurret;
        this.activeCannon = this.fastCannon;
        break;
      case EnemyArchetypeId.ARMOR:
        this.activeChassis = this.armorChassis;
        this.activeTurret = this.armorTurret;
        this.activeCannon = this.armorCannon;
        break;
      case EnemyArchetypeId.STANDARD:
      default:
        this.activeChassis = this.stdChassis;
        this.activeTurret = this.stdTurret;
        this.activeCannon = this.stdCannon;
        break;
    }

    if (this.activeChassis) this.activeChassis.setEnabled(true);
    if (this.activeTurret) this.activeTurret.setEnabled(true);
    if (this.activeCannon) this.activeCannon.setEnabled(true);

    this.updateDamageVisuals();
  }

  /**
   * Applies damage to the enemy tank.
   * Decrements HP, updates damage state visuals, or triggers destruction.
   * Strictly idempotent once destroyed.
   */
  public takeDamage(amount: number = 1): EnemyDamageResult {
    if (this.isDestroyedState || this.currentHp <= 0) {
      return {
        damaged: false,
        destroyed: false,
        previousHp: this.currentHp,
        currentHp: this.currentHp,
      };
    }

    const previousHp = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - amount);

    if (this.currentHp <= 0) {
      this.destroy();
      return {
        damaged: true,
        destroyed: true,
        previousHp,
        currentHp: 0,
      };
    }

    // Survived hit (ARMOR archetype)
    this.updateDamageVisuals();
    return {
      damaged: true,
      destroyed: false,
      previousHp,
      currentHp: this.currentHp,
    };
  }

  /**
   * Updates visual damage state without rebuilding meshes.
   * ARMOR transitions: 3 HP (pristine) -> 2 HP (charred plates) -> 1 HP (heavy scorched & hot warning emissive).
   */
  public updateDamageVisuals(): void {
    if (this.archetype.id === EnemyArchetypeId.ARMOR) {
      if (this.currentHp === 3) {
        // Pristine
        if (this.armorDamageMesh) this.armorDamageMesh.setEnabled(false);
      } else if (this.currentHp === 2) {
        // Damage State 1: Charred plates, subtle orange seam glow
        if (this.armorDamageMesh && this.armorDamageMat) {
          this.armorDamageMesh.setEnabled(true);
          this.armorDamageMat.diffuseColor.set(0.18, 0.12, 0.10);
          this.armorDamageMat.emissiveColor.set(0.35, 0.12, 0.02);
          this.armorDamageMat.alpha = 0.55;
        }
      } else if (this.currentHp === 1) {
        // Damage State 2: Heavily scorched, strong pulsing warning emissive
        if (this.armorDamageMesh && this.armorDamageMat) {
          this.armorDamageMesh.setEnabled(true);
          this.armorDamageMat.diffuseColor.set(0.10, 0.07, 0.06);
          this.armorDamageMat.emissiveColor.set(0.85, 0.20, 0.04);
          this.armorDamageMat.alpha = 0.85;
        }
      }
    } else {
      if (this.armorDamageMesh) this.armorDamageMesh.setEnabled(false);
    }
  }

  public getHealth(): number {
    return this.currentHp;
  }

  public getMaxHealth(): number {
    return this.maxHp;
  }

  public getScoreValue(): number {
    return this.archetype.scoreValue;
  }

  public getArchetypeId(): EnemyArchetypeId {
    return this.archetype.id;
  }

  public getArchetype(): EnemyArchetypeConfig {
    return this.archetype;
  }

  public isDestroyed(): boolean {
    return this.isDestroyedState;
  }

  public isSpawning(): boolean {
    return this.isSpawningState;
  }

  public setSpawning(spawning: boolean): void {
    this.isSpawningState = spawning;
  }

  /**
   * Toggles temporal STASIS freeze visual state on enemy chassis.
   */
  public setStasisActive(active: boolean): void {
    this.isStasisActiveState = active;
    if (this.stasisRingMesh) {
      this.stasisRingMesh.setEnabled(active && this.activeSlot && !this.isDestroyedState);
    }
  }

  public isStasisActive(): boolean {
    return this.isStasisActiveState;
  }

  /**
   * Triggers visual cosmetic cannon recoil kick-back upon firing.
   */
  public triggerRecoil(): void {
    this.recoilTimer = this.recoilDuration;
  }

  /**
   * Sets reduced motion configuration.
   */
  public setReducedMotion(reduced: boolean): void {
    this.isReducedMotionState = reduced;
  }

  /**
   * Destroys the enemy tank: freezes movement, triggers pooled explosion VFX.
   */
  public destroy(): void {
    if (this.isDestroyedState) return;
    this.isDestroyedState = true;
    this.isMovingState = false;
    this.currentHp = 0;
    this.setStasisActive(false);

    // Hide physical hull meshes during destruction
    if (this.activeChassis) this.activeChassis.setEnabled(false);
    if (this.activeTurret) this.activeTurret.setEnabled(false);
    if (this.activeCannon) this.activeCannon.setEnabled(false);
    if (this.armorDamageMesh) this.armorDamageMesh.setEnabled(false);

    // Fire pooled explosion VFX
    this.explosionActive = true;
    this.explosionTimer = 0;
    if (this.explosionRoot) {
      this.explosionRoot.setEnabled(true);
      if (this.explosionShockwave) {
        this.explosionShockwave.scaling.setAll(0.3);
      }
      for (let i = 0; i < this.explosionSparks.length; i++) {
        this.explosionSparks[i].position.set(0, 0, 0);
        this.explosionSparks[i].scaling.setAll(1.0);
      }
    }
  }

  public isActive(): boolean {
    return this.activeSlot;
  }

  public setActive(active: boolean): void {
    this.activeSlot = active;
    this.rootNode.setEnabled(active);
  }

  /**
   * Spawns/deploys this pooled enemy tank into the arena with an optional archetype override.
   */
  public spawn(
    spawnPosition: Vector3,
    facingDirection: Direction = Direction.SOUTH,
    archetype?: EnemyArchetypeConfig
  ): void {
    if (archetype) {
      this.configure(archetype);
    }
    this.setActive(true);
    this.reset(spawnPosition, facingDirection);
  }

  public getAABB(): BoxBounds {
    const pos = this.rootNode.position;
    const h = ENEMY_CONFIG.COLLISION_HALF_EXTENT;
    return {
      minX: pos.x - h,
      maxX: pos.x + h,
      minZ: pos.z - h,
      maxZ: pos.z + h
    };
  }

  public getMuzzlePoint(): Vector3 {
    this.muzzlePoint.computeWorldMatrix(true);
    return this.muzzlePoint.getAbsolutePosition();
  }

  public getMeshes(): (Mesh | InstancedMesh)[] {
    return this.meshes;
  }

  /**
   * Resets the enemy tank to spawn position, facing direction, full HP, and initial SPAWNING state.
   */
  public reset(spawnPosition: Vector3, facingDirection: Direction = Direction.SOUTH): void {
    this.rootNode.position.copyFrom(spawnPosition);
    this.setDirection(facingDirection);
    this.turretPivot.rotation.set(0, 0, 0);
    this.isMovingState = false;
    this.trackAccumulator = 0;
    this.isDestroyedState = false;
    this.isSpawningState = true;
    this.spawnPulseTimer = 0;
    this.explosionActive = false;
    this.currentHp = this.maxHp;

    // Restore active meshes visibility
    if (this.activeChassis) {
      this.activeChassis.setEnabled(true);
      this.activeChassis.visibility = 1.0;
      this.activeChassis.position.y = 0;
    }
    if (this.activeTurret) {
      this.activeTurret.setEnabled(true);
      this.activeTurret.visibility = 1.0;
    }
    if (this.activeCannon) {
      this.activeCannon.setEnabled(true);
      this.activeCannon.visibility = 1.0;
      this.activeCannon.position.set(0, 0, 0);
    }

    if (this.explosionRoot) {
      this.explosionRoot.setEnabled(false);
    }

    // Restore pristine materials / damage visuals
    this.updateDamageVisuals();

    this.rootNode.computeWorldMatrix(true);
    this.muzzlePoint.computeWorldMatrix(true);
  }

  public applyMovement(newX: number, newZ: number, dir: Direction, isMoving: boolean, dt: number): void {
    this.isMovingState = isMoving;
    if (this.direction !== dir) {
      this.setDirection(dir);
    }
    this.rootNode.position.x = newX;
    this.rootNode.position.z = newZ;

    if (isMoving) {
      this.trackAccumulator += dt * 12;
      const vibration = Math.sin(this.trackAccumulator) * 0.004;
      if (this.activeChassis) {
        this.activeChassis.position.y = vibration;
      }
    } else if (this.activeChassis) {
      this.activeChassis.position.y = 0;
    }
  }

  public update(deltaTime: number): void {
    // Visual cannon recoil kick-back
    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - deltaTime);
      const progress = 1.0 - (this.recoilTimer / this.recoilDuration);
      const kick = this.isReducedMotionState ? 0 : this.recoilTravel * Math.sin(progress * Math.PI);
      if (this.activeCannon) {
        this.activeCannon.position.z = -kick;
      }
    }

    if (this.isDestroyedState) {
      if (this.explosionActive) {
        this.explosionTimer += deltaTime;
        const dur = 0.55;
        if (this.explosionTimer >= dur) {
          this.explosionActive = false;
          this.explosionRoot?.setEnabled(false);
          this.setActive(false); // Mark slot reusable
        } else {
          const progress = this.explosionTimer / dur;
          if (this.explosionShockwave) {
            const scale = 0.3 + progress * 2.8;
            this.explosionShockwave.scaling.set(scale, scale, scale);
          }
          for (let i = 0; i < this.explosionSparks.length; i++) {
            const angle = (i / this.explosionSparks.length) * Math.PI * 2;
            const dist = progress * 1.8;
            const sp = this.explosionSparks[i];
            sp.position.set(
              Math.cos(angle) * dist,
              0.1 + Math.sin(progress * Math.PI) * 0.4,
              Math.sin(angle) * dist
            );
            sp.scaling.setAll(Math.max(0.1, 1.0 - progress));
          }
        }
      }
      return;
    }

    // Spawn pulse animation while in spawning state
    if (this.isSpawningState) {
      this.spawnPulseTimer += deltaTime;
      const pulse = 0.4 + Math.abs(Math.sin(this.spawnPulseTimer * 10)) * 0.6;
      if (this.activeChassis) this.activeChassis.visibility = pulse;
      if (this.activeTurret) this.activeTurret.visibility = pulse;
      if (this.activeCannon) this.activeCannon.visibility = pulse;
    } else {
      if (this.activeChassis && this.activeChassis.visibility !== 1.0) this.activeChassis.visibility = 1.0;
      if (this.activeTurret && this.activeTurret.visibility !== 1.0) this.activeTurret.visibility = 1.0;
      if (this.activeCannon && this.activeCannon.visibility !== 1.0) this.activeCannon.visibility = 1.0;
    }

    if (this.isStasisActiveState && this.stasisRingMesh) {
      this.stasisRingMesh.rotation.y += deltaTime * 1.5;
    }
  }

  public override dispose(): void {
    this.meshes.forEach((m) => m.dispose());
    this.materials.forEach((mat) => mat.dispose());
    this.meshes = [];
    this.materials = [];
    super.dispose();
  }
}
