import {
  Scene,
  TransformNode,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  LinesMesh,
  InstancedMesh
} from '@babylonjs/core';
import { Tank } from './Tank';
import { Direction } from '../game/Direction';
import { PLAYER_CONFIG, STAGE_CONFIG, DEBUG, TileType, CONVEYOR_PUSH_SPEED } from '../game/constants';
import { InputSystem } from '../systems/InputSystem';
import { CollisionSystem, BoxBounds } from '../systems/CollisionSystem';
import { TankAssetLibrary } from '../visual/TankAssetLibrary';

export class PlayerTank extends Tank {
  // Input and Collision references
  private inputSystem: InputSystem;
  private collisionSystem: CollisionSystem;

  // Transform hierarchy
  private turretPivot: TransformNode;
  private muzzlePoint: TransformNode;

  // Visual meshes and materials
  private meshes: (Mesh | InstancedMesh)[] = [];
  private materials: StandardMaterial[] = [];
  private chassisMesh?: InstancedMesh;
  private turretMesh?: InstancedMesh;
  private cannonMesh?: InstancedMesh;
  private debugFootprint?: LinesMesh;

  // Visual Recoil & Motion state
  private recoilTimer: number = 0;
  private readonly recoilDuration: number = 0.10; // ~100ms
  private readonly recoilTravel: number = 0.06;   // 0.06 world units kick
  private isReducedMotionState: boolean = false;
  private trackAccumulator: number = 0;

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

    // Turret pivot: supports independent rotation
    this.turretPivot = new TransformNode('playerTurretPivot', this.scene);
    this.turretPivot.parent = this.rootNode;
    this.turretPivot.position.set(0, 0.35, 0);

    // Muzzle point at the tip of the cannon
    this.muzzlePoint = new TransformNode('playerMuzzlePoint', this.scene);
    this.muzzlePoint.parent = this.turretPivot;
    this.muzzlePoint.position.set(0, 0.08, 0.95);

    // Proportionate vehicle height matching 5-layer arena wall depth
    this.rootNode.scaling.y = 1.5;

    this.buildVisuals();
    this.initExplosionVFX();

    if (DEBUG) {
      this.buildDebugFootprint();
    }
  }

  /**
   * Instantiates premium player vehicle components from TankAssetLibrary.
   */
  private buildVisuals(): void {
    const assetLib = TankAssetLibrary.getInstance(this.scene);

    // 1. Hardware Instanced Chassis
    this.chassisMesh = assetLib.getPlayerChassisMaster().createInstance('playerChassis');
    this.chassisMesh.parent = this.rootNode;
    this.chassisMesh.position.set(0, 0, 0);
    this.chassisMesh.isPickable = false;
    this.meshes.push(this.chassisMesh);

    // 2. Hardware Instanced Turret (parented to independent turretPivot)
    this.turretMesh = assetLib.getPlayerTurretMaster().createInstance('playerTurret');
    this.turretMesh.parent = this.turretPivot;
    this.turretMesh.position.set(0, 0, 0);
    this.turretMesh.isPickable = false;
    this.meshes.push(this.turretMesh);

    // 3. Hardware Instanced Cannon Barrel (parented to turretPivot, recoils on fire)
    this.cannonMesh = assetLib.getPlayerCannonMaster().createInstance('playerCannon');
    this.cannonMesh.parent = this.turretPivot;
    this.cannonMesh.position.set(0, 0, 0);
    this.cannonMesh.isPickable = false;
    this.meshes.push(this.cannonMesh);

    // 4. Pre-allocated Tactical AEGIS Shield Ring
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
  public getMeshes(): (Mesh | InstancedMesh)[] {
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
   * Triggers player tank destruction: freezes motion, fires pooled VFX,
   * and hides tank physical meshes.
   */
  public destroy(): void {
    if (this.isDestroyedState) return;
    this.isDestroyedState = true;
    this.isMovingState = false;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.recoilTimer = 0;
    if (this.cannonMesh) {
      this.cannonMesh.position.z = 0;
    }

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
    this.recoilTimer = 0;
    if (this.cannonMesh) {
      this.cannonMesh.position.z = 0;
    }

    // Re-enable physical meshes
    this.meshes.forEach((mesh) => {
      mesh.setEnabled(true);
    });

    if (this.explosionRoot) {
      this.explosionRoot.setEnabled(false);
    }

    if (this.chassisMesh) {
      this.chassisMesh.position.y = 0;
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
    // Update visual cannon recoil kick-back
    if (this.recoilTimer > 0) {
      this.recoilTimer = Math.max(0, this.recoilTimer - deltaTime);
      const progress = 1.0 - (this.recoilTimer / this.recoilDuration);
      const kick = this.isReducedMotionState ? 0 : this.recoilTravel * Math.sin(progress * Math.PI);
      if (this.cannonMesh) {
        this.cannonMesh.position.z = -kick;
      }
    }

    // Handle post-respawn invulnerability countdown and visual pulsing
    if (this.invulnerabilityTimer > 0) {
      this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - deltaTime);
      const pulse = 0.35 + Math.abs(Math.sin(this.invulnerabilityTimer * 16)) * 0.65;
      this.meshes.forEach((m) => {
        m.visibility = pulse;
      });
      if (this.invulnerabilityTimer <= 0) {
        this.meshes.forEach((m) => {
          m.visibility = 1.0;
        });
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

      // Animate chassis visually while moving
      if (this.isMovingState) {
        this.trackAccumulator += dt * 15;
        const slightVibration = Math.sin(this.trackAccumulator) * 0.003;
        if (this.chassisMesh) {
          this.chassisMesh.position.y = slightVibration;
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
