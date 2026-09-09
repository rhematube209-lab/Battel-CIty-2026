import {
  Scene,
  TransformNode,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  LinesMesh
} from '@babylonjs/core';
import { Tank } from './Tank';
import { Direction } from '../game/Direction';
import { PLAYER_CONFIG, STAGE_CONFIG, COLORS, DEBUG, TileType, CONVEYOR_PUSH_SPEED } from '../game/constants';
import { InputSystem } from '../systems/InputSystem';
import { CollisionSystem, BoxBounds } from '../systems/CollisionSystem';

export class PlayerTank extends Tank {
  // Input and Collision references
  private inputSystem: InputSystem;
  private collisionSystem: CollisionSystem;

  // Transform hierarchy
  private turretPivot: TransformNode;
  private muzzlePoint: TransformNode;

  // Visual meshes and materials
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private visorMat?: StandardMaterial;
  private accentMat?: StandardMaterial;
  private debugFootprint?: LinesMesh;

  // Track animation state
  private trackAccumulator: number = 0;
  private leftTrackMesh?: Mesh;
  private rightTrackMesh?: Mesh;

  // Phase 7 Life State & Destruction VFX
  private isDestroyedState: boolean = false;
  private explosionRoot?: TransformNode;
  private explosionShockwave?: Mesh;
  private explosionSparks: Mesh[] = [];
  private explosionActive: boolean = false;
  private explosionTimer: number = 0;

  // Phase 8 Invulnerability State
  private invulnerabilityTimer: number = 0;

  // Phase 12 Tactical Aegis Shield State
  private aegisShieldMesh?: Mesh;
  private aegisShieldMat?: StandardMaterial;
  private aegisShieldActive: boolean = false;
  private aegisFlareTimer: number = 0;

  // Phase 15 Cryo Floor Sliding State
  private isCryoSliding: boolean = false;
  private cryoSlideDirection: Direction | null = null;

  constructor(
    scene: Scene,
    initialPosition: Vector3,
    inputSystem: InputSystem,
    collisionSystem: CollisionSystem
  ) {
    super('PlayerTank', scene, initialPosition, Direction.NORTH);
    this.inputSystem = inputSystem;
    this.collisionSystem = collisionSystem;
    this.speed = PLAYER_CONFIG.SPEED;

    // Build turret pivot (supports future independent rotation in Phase 4+)
    this.turretPivot = new TransformNode('playerTurretPivot', this.scene);
    this.turretPivot.parent = this.rootNode;
    this.turretPivot.position.set(0, 0.35, 0);

    // Build muzzle point at the tip of the cannon
    this.muzzlePoint = new TransformNode('playerMuzzlePoint', this.scene);
    this.muzzlePoint.parent = this.turretPivot;
    this.muzzlePoint.position.set(0, 0.05, 0.95);

    this.buildVisuals();
    this.initExplosionVFX();

    if (DEBUG) {
      this.buildDebugFootprint();
    }
  }

  /**
   * Assembles the futuristic, compact player tank visual hierarchy.
   */
  private buildVisuals(): void {
    // 1. Materials
    const chassisMat = new StandardMaterial('playerChassisMat', this.scene);
    chassisMat.diffuseColor = Color3.FromHexString(COLORS.PLAYER_CHASSIS);
    chassisMat.specularColor = new Color3(0.25, 0.35, 0.45);
    chassisMat.specularPower = 32;
    this.materials.push(chassisMat);

    const armorMat = new StandardMaterial('playerArmorMat', this.scene);
    armorMat.diffuseColor = Color3.FromHexString(COLORS.PLAYER_ARMOR);
    armorMat.specularColor = new Color3(0.4, 0.45, 0.55);
    armorMat.specularPower = 48;
    this.materials.push(armorMat);

    const trackMat = new StandardMaterial('playerTrackMat', this.scene);
    trackMat.diffuseColor = Color3.FromHexString(COLORS.PLAYER_TRACKS);
    trackMat.specularColor = new Color3(0.1, 0.1, 0.1);
    this.materials.push(trackMat);

    this.accentMat = new StandardMaterial('playerAccentMat', this.scene);
    this.accentMat.diffuseColor = Color3.FromHexString(COLORS.PLAYER_ACCENT);
    this.accentMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_ACCENT).scale(0.7);
    this.materials.push(this.accentMat);

    this.visorMat = new StandardMaterial('playerVisorMat', this.scene);
    this.visorMat.diffuseColor = Color3.FromHexString(COLORS.PLAYER_COCKPIT);
    this.visorMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_COCKPIT).scale(0.85);
    this.materials.push(this.visorMat);

    // 2. Main Chassis Hull
    const chassis = MeshBuilder.CreateBox(
      'playerChassis',
      { width: 0.85, height: 0.28, depth: 1.2 },
      this.scene
    );
    chassis.position.set(0, 0.22, 0);
    chassis.parent = this.rootNode;
    chassis.material = chassisMat;
    this.meshes.push(chassis);

    // Top Hull Slanted Armor Plate
    const topPlate = MeshBuilder.CreateBox(
      'playerTopPlate',
      { width: 0.75, height: 0.1, depth: 0.95 },
      this.scene
    );
    topPlate.position.set(0, 0.38, -0.05);
    topPlate.parent = this.rootNode;
    topPlate.material = armorMat;
    this.meshes.push(topPlate);

    // 3. Treads / Tracks (Left & Right)
    const trackWidth = 0.22;
    const trackHeight = 0.28;
    const trackDepth = 1.34;
    const trackOffsetX = 0.52;

    this.leftTrackMesh = MeshBuilder.CreateBox(
      'playerLeftTrack',
      { width: trackWidth, height: trackHeight, depth: trackDepth },
      this.scene
    );
    this.leftTrackMesh.position.set(-trackOffsetX, 0.17, 0);
    this.leftTrackMesh.parent = this.rootNode;
    this.leftTrackMesh.material = trackMat;
    this.meshes.push(this.leftTrackMesh);

    this.rightTrackMesh = MeshBuilder.CreateBox(
      'playerRightTrack',
      { width: trackWidth, height: trackHeight, depth: trackDepth },
      this.scene
    );
    this.rightTrackMesh.position.set(trackOffsetX, 0.17, 0);
    this.rightTrackMesh.parent = this.rootNode;
    this.rightTrackMesh.material = trackMat;
    this.meshes.push(this.rightTrackMesh);

    // Track guards (fenders)
    const leftFender = MeshBuilder.CreateBox(
      'playerLeftFender',
      { width: trackWidth * 1.05, height: 0.05, depth: trackDepth * 1.02 },
      this.scene
    );
    leftFender.position.set(-trackOffsetX, 0.32, 0);
    leftFender.parent = this.rootNode;
    leftFender.material = armorMat;
    this.meshes.push(leftFender);

    const rightFender = MeshBuilder.CreateBox(
      'playerRightFender',
      { width: trackWidth * 1.05, height: 0.05, depth: trackDepth * 1.02 },
      this.scene
    );
    rightFender.position.set(trackOffsetX, 0.32, 0);
    rightFender.parent = this.rootNode;
    rightFender.material = armorMat;
    this.meshes.push(rightFender);

    // 4. Turret & Cannon
    const turret = MeshBuilder.CreateCylinder(
      'playerTurret',
      { diameter: 0.68, height: 0.22, tessellation: 8 },
      this.scene
    );
    turret.position.set(0, 0.1, 0);
    turret.parent = this.turretPivot;
    turret.material = armorMat;
    this.meshes.push(turret);

    // Cannon Barrel
    const cannon = MeshBuilder.CreateBox(
      'playerCannon',
      { width: 0.12, height: 0.1, depth: 0.65 },
      this.scene
    );
    cannon.position.set(0, 0.08, 0.55);
    cannon.parent = this.turretPivot;
    cannon.material = armorMat;
    this.meshes.push(cannon);

    // Cannon Muzzle Brake
    const muzzleBrake = MeshBuilder.CreateBox(
      'playerMuzzleBrake',
      { width: 0.16, height: 0.14, depth: 0.12 },
      this.scene
    );
    muzzleBrake.position.set(0, 0.08, 0.88);
    muzzleBrake.parent = this.turretPivot;
    muzzleBrake.material = chassisMat;
    this.meshes.push(muzzleBrake);

    // 5. Visual Accent Nodes (Cyan identification lights)
    const visor = MeshBuilder.CreateBox(
      'playerVisor',
      { width: 0.32, height: 0.08, depth: 0.06 },
      this.scene
    );
    visor.position.set(0, 0.14, 0.33);
    visor.parent = this.turretPivot;
    visor.material = this.visorMat;
    this.meshes.push(visor);

    // Rear engine exhaust / energy vents
    const rearGlow = MeshBuilder.CreateBox(
      'playerRearGlow',
      { width: 0.45, height: 0.06, depth: 0.04 },
      this.scene
    );
    rearGlow.position.set(0, 0.26, -0.6);
    rearGlow.parent = this.rootNode;
    rearGlow.material = this.accentMat;
    this.meshes.push(rearGlow);

    // 6. Pre-allocated Tactical AEGIS Shield Ring
    this.aegisShieldMat = new StandardMaterial('playerAegisMat', this.scene);
    this.aegisShieldMat.diffuseColor = new Color3(0.2, 0.75, 1.0);
    this.aegisShieldMat.emissiveColor = new Color3(0.0, 0.85, 1.0);
    this.aegisShieldMat.alpha = 0.38;
    this.aegisShieldMat.disableLighting = true;
    this.materials.push(this.aegisShieldMat);

    this.aegisShieldMesh = MeshBuilder.CreateTorus(
      'playerAegisShield',
      { diameter: 1.6, thickness: 0.12, tessellation: 24 },
      this.scene
    );
    this.aegisShieldMesh.parent = this.rootNode;
    this.aegisShieldMesh.position.y = 0.35;
    this.aegisShieldMesh.material = this.aegisShieldMat;
    this.aegisShieldMesh.setEnabled(false);
  }

  /**
   * Renders a thin debug bounding frame when DEBUG = true.
   */
  private buildDebugFootprint(): void {
    const half = PLAYER_CONFIG.COLLISION_HALF_EXTENT;
    const lines = [
      [new Vector3(-half, 0.05, -half), new Vector3(half, 0.05, -half)],
      [new Vector3(half, 0.05, -half), new Vector3(half, 0.05, half)],
      [new Vector3(half, 0.05, half), new Vector3(-half, 0.05, half)],
      [new Vector3(-half, 0.05, half), new Vector3(-half, 0.05, -half)]
    ];

    this.debugFootprint = MeshBuilder.CreateLineSystem(
      'playerDebugFootprint',
      { lines },
      this.scene
    );
    this.debugFootprint.parent = this.rootNode;
    this.debugFootprint.color = new Color3(0.0, 1.0, 0.5);
  }

  /**
   * Returns the world position of the muzzle point for projectile spawning.
   */
  public getMuzzlePoint(): Vector3 {
    this.muzzlePoint.computeWorldMatrix(true);
    return this.muzzlePoint.getAbsolutePosition();
  }

  /**
   * Exposes mesh list for shadow caster registration.
   */
  public getMeshes(): Mesh[] {
    return this.meshes;
  }

  /**
   * Pre-allocates lightweight explosion VFX for destruction feedback (Phase 7).
   */
  private initExplosionVFX(): void {
    this.explosionRoot = new TransformNode('playerExplosionRoot', this.scene);
    this.explosionRoot.parent = this.rootNode;
    this.explosionRoot.position.set(0, 0.3, 0);

    const shockwaveMat = new StandardMaterial('playerShockwaveMat', this.scene);
    shockwaveMat.diffuseColor = new Color3(1.0, 0.4, 0.1);
    shockwaveMat.emissiveColor = new Color3(1.0, 0.35, 0.05);
    shockwaveMat.disableLighting = true;
    this.materials.push(shockwaveMat);

    this.explosionShockwave = MeshBuilder.CreateTorus(
      'playerShockwave',
      { diameter: 0.4, thickness: 0.08, tessellation: 24 },
      this.scene
    );
    this.explosionShockwave.parent = this.explosionRoot;
    this.explosionShockwave.material = shockwaveMat;
    this.explosionShockwave.isPickable = false;

    const sparkMat = new StandardMaterial('playerSparkMat', this.scene);
    sparkMat.diffuseColor = new Color3(1.0, 0.7, 0.2);
    sparkMat.emissiveColor = new Color3(1.0, 0.6, 0.1);
    sparkMat.disableLighting = true;
    this.materials.push(sparkMat);

    for (let i = 0; i < 8; i++) {
      const spark = MeshBuilder.CreateBox(
        `playerExplosionSpark_${i}`,
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
   * Returns true if player tank has been destroyed.
   */
  public isDestroyed(): boolean {
    return this.isDestroyedState;
  }

  /**
   * Returns true if player tank is currently invulnerable.
   */
  public isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  /**
   * Sets invulnerability timer in seconds.
   */
  public setInvulnerable(duration: number): void {
    this.invulnerabilityTimer = Math.max(0, duration);
  }

  /**
   * Triggers player tank destruction: extinguishes visor, freezes motion, fires pooled VFX,
   * and hides tank physical meshes.
   */
  public destroy(): void {
    if (this.isDestroyedState) return;
    this.isDestroyedState = true;
    this.isMovingState = false;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;

    // Extinguish cyan visor and accents
    if (this.visorMat) this.visorMat.emissiveColor.set(0.04, 0.04, 0.04);
    if (this.accentMat) this.accentMat.emissiveColor.set(0.04, 0.04, 0.04);

    // Hide physical hull meshes during destruction
    this.meshes.forEach((mesh) => {
      mesh.setEnabled(false);
    });

    if (this.aegisShieldMesh) {
      this.aegisShieldMesh.setEnabled(false);
    }

    // Trigger pooled explosion VFX
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

  /**
   * Returns gameplay AABB for tank-to-tank and projectile collision.
   */
  public getAABB(): BoxBounds {
    const pos = this.rootNode.position;
    const h = PLAYER_CONFIG.COLLISION_HALF_EXTENT;
    return {
      minX: pos.x - h,
      maxX: pos.x + h,
      minZ: pos.z - h,
      maxZ: pos.z + h
    };
  }

  /**
   * Resets player tank position, cardinal direction, turret alignment, and track animations.
   * Restores physical mesh visibility.
   */
  public resetToSpawn(spawnPosition: Vector3, facingDirection: Direction = Direction.NORTH): void {
    this.rootNode.position.copyFrom(spawnPosition);
    this.setDirection(facingDirection);
    this.turretPivot.rotation.set(0, 0, 0);
    this.isMovingState = false;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.trackAccumulator = 0;
    this.isDestroyedState = false;
    this.explosionActive = false;
    this.invulnerabilityTimer = 0;

    // Re-enable physical meshes
    this.meshes.forEach((mesh) => {
      mesh.setEnabled(true);
    });

    if (this.explosionRoot) {
      this.explosionRoot.setEnabled(false);
    }

    // Restore visor and accent emissives
    if (this.visorMat) {
      this.visorMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_COCKPIT).scale(0.85);
    }
    if (this.accentMat) {
      this.accentMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_ACCENT).scale(0.7);
    }

    if (this.leftTrackMesh && this.rightTrackMesh) {
      this.leftTrackMesh.position.y = 0.17;
      this.rightTrackMesh.position.y = 0.17;
    }
    this.rootNode.computeWorldMatrix(true);
    this.muzzlePoint.computeWorldMatrix(true);
  }

  /**
   * Respawns the player after losing a life with 1.5s invulnerability.
   */
  public respawn(spawnPosition: Vector3, facingDirection: Direction = Direction.NORTH): void {
    this.resetToSpawn(spawnPosition, facingDirection);
    this.setInvulnerable(STAGE_CONFIG.PLAYER_RESPAWN_INVULNERABILITY);
  }

  /**
   * Toggles tactical AEGIS energy shield around player tank hull.
   */
  public setAegisShieldActive(active: boolean): void {
    this.aegisShieldActive = active;
    if (this.aegisShieldMesh) {
      this.aegisShieldMesh.setEnabled(active && !this.isDestroyedState);
    }
  }

  public isAegisShieldActive(): boolean {
    return this.aegisShieldActive;
  }

  /**
   * Phase 15: Returns whether the player is currently in an active Cryo slide.
   */
  public isSliding(): boolean {
    return this.isCryoSliding;
  }

  /**
   * Phase 15: Returns current committed Cryo slide direction, or null if not sliding.
   */
  public getSlideDirection(): Direction | null {
    return this.cryoSlideDirection;
  }

  /**
   * Triggers a brief bright flash on the shield ring upon absorbing an enemy projectile.
   */
  public triggerAegisFlare(): void {
    this.aegisFlareTimer = 0.22;
  }

  /**
   * Main per-frame update loop.
   */
  public update(deltaTime: number, extraAABBs?: BoxBounds[], allowMovement: boolean = true): void {
    // Handle post-respawn invulnerability countdown and visual pulsing
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - deltaTime);
      const pulse = 0.35 + Math.abs(Math.sin(this.invulnerabilityTimer * 16)) * 0.65;
      if (this.visorMat) {
        this.visorMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_COCKPIT).scale(pulse);
      }
      if (this.accentMat) {
        this.accentMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_ACCENT).scale(pulse);
      }
      if (this.invulnerabilityTimer <= 0) {
        if (this.visorMat) {
          this.visorMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_COCKPIT).scale(0.85);
        }
        if (this.accentMat) {
          this.accentMat.emissiveColor = Color3.FromHexString(COLORS.PLAYER_ACCENT).scale(0.7);
        }
      }
    }

    // Update AEGIS shield animation and absorption flare
    if (this.aegisShieldActive && this.aegisShieldMesh && !this.isDestroyedState) {
      this.aegisShieldMesh.rotation.y += deltaTime * 2.4;
      if (this.aegisFlareTimer > 0) {
        this.aegisFlareTimer = Math.max(0, this.aegisFlareTimer - deltaTime);
        if (this.aegisShieldMat) {
          this.aegisShieldMat.emissiveColor.set(1.0, 1.0, 1.0);
          this.aegisShieldMat.alpha = 0.85;
        }
      } else if (this.aegisShieldMat) {
        const pulse = Math.sin(Date.now() * 0.006) * 0.12 + 0.40;
        this.aegisShieldMat.emissiveColor.set(0.0, 0.85, 1.0);
        this.aegisShieldMat.alpha = pulse;
      }
    }

    // If destroyed, animate explosion VFX and freeze movement
    if (this.isDestroyedState) {
      if (this.explosionActive) {
        this.explosionTimer += deltaTime;
        const dur = 0.55;
        if (this.explosionTimer >= dur) {
          this.explosionActive = false;
          this.explosionRoot?.setEnabled(false);
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

    if (!allowMovement) {
      this.isMovingState = false;
      return;
    }

    // 1. Clamp extreme delta time to prevent tunneling
    const dt = Math.min(deltaTime, PLAYER_CONFIG.MAX_DELTA_TIME);

    // 2. Fetch current center-cell surface & conveyor metadata
    const currentPos = this.rootNode.position;
    const surfaceInfo = this.collisionSystem.getTileMap().getSurfaceInfoAtWorldPosition(currentPos);
    const currentSurface = surfaceInfo.tileType;

    // If center left Cryo, clear active slide
    if (this.isCryoSliding && currentSurface !== TileType.CRYO) {
      this.isCryoSliding = false;
      this.cryoSlideDirection = null;
    }

    // 3. Resolve active commanded direction
    let activeDir: Direction | null = null;

    if (this.isCryoSliding) {
      // While sliding: direction is locked. Input direction changes are ignored.
      activeDir = this.cryoSlideDirection;
    } else {
      const inputDir = this.inputSystem.getMovementDirection();
      if (inputDir !== null) {
        if (currentSurface === TileType.CRYO) {
          this.isCryoSliding = true;
          this.cryoSlideDirection = inputDir;
        }
        activeDir = inputDir;
      }
    }

    // 4. Check Conveyor influence
    const onConveyor = (currentSurface === TileType.CONVEYOR && surfaceInfo.conveyorDirection !== null);
    const convDir = surfaceInfo.conveyorDirection;
    const convDist = CONVEYOR_PUSH_SPEED * dt;

    if (activeDir !== null || onConveyor) {
      this.isMovingState = (activeDir !== null);

      if (activeDir !== null) {
        // Commanded movement present: face active direction
        if (this.direction !== activeDir) {
          this.setDirection(activeDir);
        }
      }

      if (activeDir !== null && !onConveyor) {
        // Standard or Cryo movement (no conveyor)
        const dist = this.speed * dt;
        const result = this.collisionSystem.resolveMovement(
          currentPos.x,
          currentPos.z,
          activeDir,
          dist,
          dt,
          extraAABBs
        );

        if (this.isCryoSliding) {
          if (!result.moved) {
            this.isCryoSliding = false;
            this.cryoSlideDirection = null;
            this.isMovingState = false;
          } else {
            currentPos.x = result.x;
            currentPos.z = result.z;
            const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(currentPos);
            if (newSurface !== TileType.CRYO) {
              this.isCryoSliding = false;
              this.cryoSlideDirection = null;
            }
          }
        } else {
          currentPos.x = result.x;
          currentPos.z = result.z;
          if (result.moved) {
            const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(currentPos);
            if (newSurface === TileType.CRYO) {
              this.isCryoSliding = true;
              this.cryoSlideDirection = activeDir;
            }
          }
        }
      } else if (activeDir === null && onConveyor) {
        // Idle on Conveyor (Req 13): transported in convDir, facing unchanged!
        const result = this.collisionSystem.resolveMovement(
          currentPos.x,
          currentPos.z,
          convDir!,
          convDist,
          dt,
          extraAABBs
        );
        currentPos.x = result.x;
        currentPos.z = result.z;

        // Check if pushed onto Cryo while idle (Req 28)
        if (result.moved) {
          const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(currentPos);
          if (newSurface === TileType.CRYO) {
            this.isCryoSliding = true;
            this.cryoSlideDirection = convDir!;
          }
        }
      } else if (activeDir !== null && onConveyor) {
        // Commanded movement on Conveyor
        const cmdDist = this.speed * dt;
        const isCollinear =
          (activeDir === convDir) ||
          (activeDir === Direction.NORTH && convDir === Direction.SOUTH) ||
          (activeDir === Direction.SOUTH && convDir === Direction.NORTH) ||
          (activeDir === Direction.EAST && convDir === Direction.WEST) ||
          (activeDir === Direction.WEST && convDir === Direction.EAST);

        if (isCollinear) {
          // Collinear: net displacement along axis
          const netDist = (activeDir === convDir) ? (cmdDist + convDist) : (cmdDist - convDist);
          const resolveDir = netDist >= 0 ? activeDir : convDir!;
          const resolveDist = Math.abs(netDist);

          const result = this.collisionSystem.resolveMovement(
            currentPos.x,
            currentPos.z,
            resolveDir,
            resolveDist,
            dt,
            extraAABBs
          );
          currentPos.x = result.x;
          currentPos.z = result.z;

          if (result.moved) {
            const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(currentPos);
            if (newSurface === TileType.CRYO) {
              this.isCryoSliding = true;
              this.cryoSlideDirection = activeDir;
            }
          }
        } else {
          // Perpendicular: resolve commanded movement along activeDir, then conveyor along convDir
          const res1 = this.collisionSystem.resolveMovement(
            currentPos.x,
            currentPos.z,
            activeDir,
            cmdDist,
            dt,
            extraAABBs
          );
          currentPos.x = res1.x;
          currentPos.z = res1.z;

          const res2 = this.collisionSystem.resolveMovement(
            currentPos.x,
            currentPos.z,
            convDir!,
            convDist,
            dt,
            extraAABBs
          );
          currentPos.x = res2.x;
          currentPos.z = res2.z;

          if (res1.moved || res2.moved) {
            const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(currentPos);
            if (newSurface === TileType.CRYO) {
              this.isCryoSliding = true;
              this.cryoSlideDirection = activeDir;
            }
          }
        }
      }

      // Animate treads visually while moving
      if (this.isMovingState) {
        this.trackAccumulator += dt * 15;
        const slightVibration = Math.sin(this.trackAccumulator) * 0.005;
        if (this.leftTrackMesh && this.rightTrackMesh) {
          this.leftTrackMesh.position.y = 0.17 + slightVibration;
          this.rightTrackMesh.position.y = 0.17 - slightVibration;
        }
      }
    } else {
      this.isMovingState = false;
    }
  }

  /**
   * Disposes all meshes, materials, and transform nodes.
   */
  public override dispose(): void {
    if (this.debugFootprint) {
      this.debugFootprint.dispose();
    }
    this.meshes.forEach((mesh) => mesh.dispose());
    this.materials.forEach((mat) => mat.dispose());
    this.meshes = [];
    this.materials = [];
    super.dispose();
  }
}
