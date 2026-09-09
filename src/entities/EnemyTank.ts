import {
  Scene,
  TransformNode,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh
} from '@babylonjs/core';
import { Tank } from './Tank';
import { Direction } from '../game/Direction';
import { ENEMY_CONFIG, COLORS } from '../game/constants';
import { BoxBounds } from '../systems/CollisionSystem';
import {
  EnemyArchetypeConfig,
  EnemyArchetypeId,
  ENEMY_ARCHETYPES
} from '../config/enemyArchetypes';

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
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private chassisMesh?: Mesh;
  private topPlateMesh?: Mesh;
  private turretMesh?: Mesh;
  private cannonMesh?: Mesh;
  private visorMesh?: Mesh;
  private leftAccentMesh?: Mesh;
  private rightAccentMesh?: Mesh;

  // Pre-allocated reinforced armor plates (for ARMOR archetype & damage states)
  private leftArmorPlate?: Mesh;
  private rightArmorPlate?: Mesh;
  private frontArmorPlate?: Mesh;

  // Phase 12 Temporal Stasis State
  private stasisRingMesh?: Mesh;
  private stasisRingMat?: StandardMaterial;
  private isStasisActiveState: boolean = false;

  private chassisMat?: StandardMaterial;
  private armorMat?: StandardMaterial;
  private trackMat?: StandardMaterial;
  private visorMat?: StandardMaterial;
  private accentMat?: StandardMaterial;
  private plateMat?: StandardMaterial;

  // Track animation state
  private trackAccumulator: number = 0;
  private leftTrackMesh?: Mesh;
  private rightTrackMesh?: Mesh;

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
    this.muzzlePoint.position.set(0, 0.05, 0.95);

    this.buildVisuals();
    this.initExplosionVFX();
    this.configure(initialArchetype);
  }

  /**
   * Constructs the enemy hull, pre-allocating base meshes and reinforced armor plates.
   * All meshes are created once in constructor; zero runtime geometry rebuilding.
   */
  private buildVisuals(): void {
    this.chassisMat = new StandardMaterial('enemyChassisMat', this.scene);
    this.chassisMat.diffuseColor = Color3.FromHexString(COLORS.ENEMY_CHASSIS);
    this.chassisMat.specularColor = new Color3(0.2, 0.15, 0.1);
    this.chassisMat.specularPower = 24;
    this.materials.push(this.chassisMat);

    this.armorMat = new StandardMaterial('enemyArmorMat', this.scene);
    this.armorMat.diffuseColor = Color3.FromHexString(COLORS.ENEMY_ARMOR);
    this.armorMat.specularColor = new Color3(0.3, 0.25, 0.2);
    this.armorMat.specularPower = 36;
    this.materials.push(this.armorMat);

    this.trackMat = new StandardMaterial('enemyTrackMat', this.scene);
    this.trackMat.diffuseColor = Color3.FromHexString(COLORS.ENEMY_TRACKS);
    this.trackMat.specularColor = new Color3(0.08, 0.08, 0.08);
    this.materials.push(this.trackMat);

    this.accentMat = new StandardMaterial('enemyAccentMat', this.scene);
    this.accentMat.diffuseColor = Color3.FromHexString(COLORS.ENEMY_ACCENT);
    this.accentMat.emissiveColor = Color3.FromHexString(COLORS.ENEMY_ACCENT).scale(0.7);
    this.materials.push(this.accentMat);

    this.visorMat = new StandardMaterial('enemyVisorMat', this.scene);
    this.visorMat.diffuseColor = Color3.FromHexString(COLORS.ENEMY_VISOR);
    this.visorMat.emissiveColor = Color3.FromHexString(COLORS.ENEMY_VISOR).scale(0.85);
    this.materials.push(this.visorMat);

    this.plateMat = new StandardMaterial('enemyPlateMat', this.scene);
    this.plateMat.diffuseColor = new Color3(0.36, 0.27, 0.24);
    this.plateMat.specularColor = new Color3(0.35, 0.3, 0.25);
    this.materials.push(this.plateMat);

    // Main Chassis
    this.chassisMesh = MeshBuilder.CreateBox(
      'enemyChassis',
      { width: 0.85, height: 0.28, depth: 1.2 },
      this.scene
    );
    this.chassisMesh.position.set(0, 0.22, 0);
    this.chassisMesh.parent = this.rootNode;
    this.chassisMesh.material = this.chassisMat;
    this.meshes.push(this.chassisMesh);

    // Angular Top Plate
    this.topPlateMesh = MeshBuilder.CreateBox(
      'enemyTopPlate',
      { width: 0.75, height: 0.1, depth: 0.95 },
      this.scene
    );
    this.topPlateMesh.position.set(0, 0.38, -0.05);
    this.topPlateMesh.parent = this.rootNode;
    this.topPlateMesh.material = this.armorMat;
    this.meshes.push(this.topPlateMesh);

    // Tracks (Left & Right)
    const trackWidth = 0.22;
    const trackHeight = 0.28;
    const trackDepth = 1.34;
    const trackOffsetX = 0.52;

    this.leftTrackMesh = MeshBuilder.CreateBox(
      'enemyLeftTrack',
      { width: trackWidth, height: trackHeight, depth: trackDepth },
      this.scene
    );
    this.leftTrackMesh.position.set(-trackOffsetX, 0.17, 0);
    this.leftTrackMesh.parent = this.rootNode;
    this.leftTrackMesh.material = this.trackMat;
    this.meshes.push(this.leftTrackMesh);

    this.rightTrackMesh = MeshBuilder.CreateBox(
      'enemyRightTrack',
      { width: trackWidth, height: trackHeight, depth: trackDepth },
      this.scene
    );
    this.rightTrackMesh.position.set(trackOffsetX, 0.17, 0);
    this.rightTrackMesh.parent = this.rootNode;
    this.rightTrackMesh.material = this.trackMat;
    this.meshes.push(this.rightTrackMesh);

    // Turret Dome
    this.turretMesh = MeshBuilder.CreateCylinder(
      'enemyTurret',
      { diameter: 0.58, height: 0.22, tessellation: 16 },
      this.scene
    );
    this.turretMesh.position.set(0, 0.11, 0);
    this.turretMesh.parent = this.turretPivot;
    this.turretMesh.material = this.armorMat;
    this.meshes.push(this.turretMesh);

    // Cannon Barrel
    this.cannonMesh = MeshBuilder.CreateCylinder(
      'enemyCannon',
      { diameter: 0.11, height: 0.85, tessellation: 12 },
      this.scene
    );
    this.cannonMesh.rotation.x = Math.PI / 2;
    this.cannonMesh.position.set(0, 0.05, 0.52);
    this.cannonMesh.parent = this.turretPivot;
    this.cannonMesh.material = this.chassisMat;
    this.meshes.push(this.cannonMesh);

    // Glowing Visor Strip
    this.visorMesh = MeshBuilder.CreateBox(
      'enemyVisor',
      { width: 0.38, height: 0.07, depth: 0.1 },
      this.scene
    );
    this.visorMesh.position.set(0, 0.13, 0.27);
    this.visorMesh.parent = this.turretPivot;
    this.visorMesh.material = this.visorMat;
    this.meshes.push(this.visorMesh);

    // Side Accent Trim
    this.leftAccentMesh = MeshBuilder.CreateBox(
      'enemyLeftAccent',
      { width: 0.04, height: 0.06, depth: 0.8 },
      this.scene
    );
    this.leftAccentMesh.position.set(-0.4, 0.35, 0);
    this.leftAccentMesh.parent = this.rootNode;
    this.leftAccentMesh.material = this.accentMat;
    this.meshes.push(this.leftAccentMesh);

    this.rightAccentMesh = MeshBuilder.CreateBox(
      'enemyRightAccent',
      { width: 0.04, height: 0.06, depth: 0.8 },
      this.scene
    );
    this.rightAccentMesh.position.set(0.4, 0.35, 0);
    this.rightAccentMesh.parent = this.rootNode;
    this.rightAccentMesh.material = this.accentMat;
    this.meshes.push(this.rightAccentMesh);

    // Pre-allocated Heavy Armor Plates (for ARMOR archetype and damage states)
    this.leftArmorPlate = MeshBuilder.CreateBox(
      'enemyLeftPlate',
      { width: 0.08, height: 0.26, depth: 1.1 },
      this.scene
    );
    this.leftArmorPlate.position.set(-0.65, 0.25, 0);
    this.leftArmorPlate.parent = this.rootNode;
    this.leftArmorPlate.material = this.plateMat;
    this.meshes.push(this.leftArmorPlate);

    this.rightArmorPlate = MeshBuilder.CreateBox(
      'enemyRightPlate',
      { width: 0.08, height: 0.26, depth: 1.1 },
      this.scene
    );
    this.rightArmorPlate.position.set(0.65, 0.25, 0);
    this.rightArmorPlate.parent = this.rootNode;
    this.rightArmorPlate.material = this.plateMat;
    this.meshes.push(this.rightArmorPlate);

    this.frontArmorPlate = MeshBuilder.CreateBox(
      'enemyFrontPlate',
      { width: 0.72, height: 0.22, depth: 0.1 },
      this.scene
    );
    this.frontArmorPlate.position.set(0, 0.26, 0.62);
    this.frontArmorPlate.parent = this.rootNode;
    this.frontArmorPlate.material = this.plateMat;
    this.meshes.push(this.frontArmorPlate);

    // Initially disabled (only enabled for ARMOR)
    this.leftArmorPlate.setEnabled(false);
    this.rightArmorPlate.setEnabled(false);
    this.frontArmorPlate.setEnabled(false);

    // Pre-allocated STASIS pulse energy ring (Phase 12)
    this.stasisRingMat = new StandardMaterial('enemyStasisMat', this.scene);
    this.stasisRingMat.diffuseColor = new Color3(0.75, 0.4, 1.0);
    this.stasisRingMat.emissiveColor = new Color3(0.65, 0.2, 0.95);
    this.stasisRingMat.alpha = 0.55;
    this.stasisRingMat.disableLighting = true;
    this.materials.push(this.stasisRingMat);

    this.stasisRingMesh = MeshBuilder.CreateTorus(
      'enemyStasisRing',
      { diameter: 1.55, thickness: 0.08, tessellation: 20 },
      this.scene
    );
    this.stasisRingMesh.parent = this.rootNode;
    this.stasisRingMesh.position.y = 0.08;
    this.stasisRingMesh.material = this.stasisRingMat;
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
   * Completely resets health, speed, silhouette scales, materials, and damage states.
   */
  public configure(archetype: EnemyArchetypeConfig): void {
    this.archetype = archetype;
    this.maxHp = archetype.maxHp;
    this.currentHp = archetype.maxHp;
    this.speed = archetype.speed;

    const vp = archetype.visualProfile;

    // Apply color palette
    if (this.chassisMat) {
      this.chassisMat.diffuseColor = Color3.FromHexString(vp.chassisColor);
    }
    if (this.armorMat) {
      this.armorMat.diffuseColor = Color3.FromHexString(vp.armorColor);
    }
    if (this.accentMat) {
      this.accentMat.diffuseColor = Color3.FromHexString(vp.accentColor);
      this.accentMat.emissiveColor = Color3.FromHexString(vp.accentColor).scale(0.7);
    }
    if (this.visorMat) {
      this.visorMat.diffuseColor = Color3.FromHexString(vp.visorColor);
      this.visorMat.emissiveColor = Color3.FromHexString(vp.visorColor).scale(0.85);
    }
    if (this.plateMat && vp.plateColor) {
      this.plateMat.diffuseColor = Color3.FromHexString(vp.plateColor);
      this.plateMat.emissiveColor = new Color3(0, 0, 0);
    }

    // Apply silhouette scaling on pre-created nodes
    if (this.chassisMesh) {
      this.chassisMesh.scaling.set(vp.hullWidthScale, vp.hullHeightScale, 1.0);
    }
    if (this.topPlateMesh) {
      this.topPlateMesh.scaling.set(vp.hullWidthScale, vp.hullHeightScale, 1.0);
    }
    if (this.turretMesh) {
      this.turretMesh.scaling.set(vp.turretScale, vp.hullHeightScale, vp.turretScale);
    }

    // Toggle reinforced armor plates
    const hasPlates = vp.hasReinforcedPlates;
    if (this.leftArmorPlate) this.leftArmorPlate.setEnabled(hasPlates);
    if (this.rightArmorPlate) this.rightArmorPlate.setEnabled(hasPlates);
    if (this.frontArmorPlate) this.frontArmorPlate.setEnabled(hasPlates);

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
   * ARMOR transitions: 3 HP (pristine) -> 2 HP (charred sides) -> 1 HP (heavy charred & hot warning emissive).
   */
  public updateDamageVisuals(): void {
    if (!this.plateMat) return;

    if (this.archetype.id === EnemyArchetypeId.ARMOR) {
      if (this.currentHp === 3) {
        // Pristine
        this.plateMat.diffuseColor = Color3.FromHexString(this.archetype.visualProfile.plateColor || '#5c463d');
        this.plateMat.emissiveColor = new Color3(0, 0, 0);
        if (this.accentMat) {
          this.accentMat.emissiveColor = Color3.FromHexString(this.archetype.visualProfile.accentColor).scale(0.7);
        }
      } else if (this.currentHp === 2) {
        // Damage State 1: Charred plates, subtle orange seam glow
        this.plateMat.diffuseColor = new Color3(0.20, 0.14, 0.12);
        this.plateMat.emissiveColor = new Color3(0.25, 0.08, 0.02);
        if (this.accentMat) {
          this.accentMat.emissiveColor = new Color3(0.9, 0.25, 0.0);
        }
      } else if (this.currentHp === 1) {
        // Damage State 2: Heavily scorched, strong pulsing warning emissive
        this.plateMat.diffuseColor = new Color3(0.12, 0.09, 0.08);
        this.plateMat.emissiveColor = new Color3(0.65, 0.15, 0.03);
        if (this.accentMat) {
          this.accentMat.emissiveColor = new Color3(1.0, 0.10, 0.0);
        }
      }
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
   * Destroys the enemy tank: freezes movement, extinguishes visor, triggers pooled explosion VFX.
   */
  public destroy(): void {
    if (this.isDestroyedState) return;
    this.isDestroyedState = true;
    this.isMovingState = false;
    this.currentHp = 0;
    this.setStasisActive(false);

    // Extinguish visor and accents
    if (this.visorMat) this.visorMat.emissiveColor.set(0.04, 0.04, 0.04);
    if (this.accentMat) this.accentMat.emissiveColor.set(0.04, 0.04, 0.04);

    // Hide physical hull meshes during destruction
    this.meshes.forEach((mesh) => {
      mesh.setEnabled(false);
    });

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
    return this.muzzlePoint.getAbsolutePosition();
  }

  public getMeshes(): Mesh[] {
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

    // Restore hull mesh visibility
    this.meshes.forEach((mesh) => {
      mesh.setEnabled(true);
    });

    // Plates only stay enabled if archetype has them
    const hasPlates = this.archetype.visualProfile.hasReinforcedPlates;
    if (this.leftArmorPlate) this.leftArmorPlate.setEnabled(hasPlates);
    if (this.rightArmorPlate) this.rightArmorPlate.setEnabled(hasPlates);
    if (this.frontArmorPlate) this.frontArmorPlate.setEnabled(hasPlates);

    if (this.explosionRoot) {
      this.explosionRoot.setEnabled(false);
    }

    // Restore pristine materials
    this.updateDamageVisuals();

    if (this.visorMat) {
      this.visorMat.emissiveColor = Color3.FromHexString(this.archetype.visualProfile.visorColor).scale(0.85);
    }

    if (this.leftTrackMesh && this.rightTrackMesh) {
      this.leftTrackMesh.position.y = 0.17;
      this.rightTrackMesh.position.y = 0.17;
    }
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
      const vibration = Math.sin(this.trackAccumulator) * 0.005;
      if (this.leftTrackMesh && this.rightTrackMesh) {
        this.leftTrackMesh.position.y = 0.17 + vibration;
        this.rightTrackMesh.position.y = 0.17 - vibration;
      }
    }
  }

  public update(deltaTime: number): void {
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
      const pulse = 0.5 + Math.sin(this.spawnPulseTimer * 12) * 0.4;
      if (this.visorMat) {
        this.visorMat.emissiveColor = Color3.FromHexString(this.archetype.visualProfile.visorColor).scale(pulse);
      }
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
