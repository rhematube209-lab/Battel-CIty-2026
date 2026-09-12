import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Mesh,
  TransformNode,
  Texture
} from '@babylonjs/core';
import { TILE_SIZE, VISUAL_HEIGHTS } from '../game/constants';
import { StagePresentationConfig } from '../stages/StageDefinition';
import { MaterialLibrary } from '../visual/MaterialLibrary';

export enum BaseState {
  ACTIVE = 0,
  DESTROYED = 1,
}

interface ExplosionParticle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
}

/**
 * Base entity representing the player's protected life guardian (Angel Sanctuary Base).
 * Overhauled to feature the sacred Angel Guardian monument with radiant divine glow,
 * protective sanctuary pedestal altar, and shattered stone relic state on destruction.
 */
export class Base {
  private scene: Scene;
  private rootNode: TransformNode;
  private state: BaseState = BaseState.ACTIVE;
  private worldPosition: Vector3;

  // Presentation metadata & ambient pulse
  private currentPresentation?: StagePresentationConfig;
  private pulseTimer: number = 0;

  // Visual meshes
  private basePlatform: Mesh;
  private conduitTray: Mesh;
  private stanchions: Mesh[] = [];
  private reactorMesh: Mesh;
  private coreMesh: Mesh;
  private containmentRings: Mesh[] = [];
  private angelMesh: Mesh;
  private breachMeshes: Mesh[] = [];

  // Materials
  private housingMat: PBRMaterial;
  private trimMat: PBRMaterial;
  private coreMat: PBRMaterial & { diffuseColor: Color3 };
  private breachMat: PBRMaterial;
  private angelMat: StandardMaterial;
  private angelTexture: Texture | null = null;

  // Pooled explosion VFX
  private explosionActive: boolean = false;
  private explosionTimer: number = 0;
  private explosionDuration: number = 0.55;
  private flashMesh: Mesh;
  private explosionParticles: ExplosionParticle[] = [];
  private flashMat: StandardMaterial;
  private sparkMat: StandardMaterial;

  constructor(name: string, scene: Scene, worldPosition: Vector3) {
    this.scene = scene;
    this.worldPosition = worldPosition.clone();
    this.rootNode = new TransformNode(name, this.scene);
    this.rootNode.position.copyFrom(this.worldPosition);

    const matLib = MaterialLibrary.getInstance(this.scene);
    const envMats = matLib.getMaterials();

    // 1. Materials (shared PBR with a cloned core for dedicated stage pulse modulation)
    this.housingMat = envMats.commandHousing;
    this.trimMat = envMats.commandTrim;
    this.breachMat = this.housingMat;

    // Clone core material so its sinusoidal emissive pulse doesn't mutate shared assets
    this.coreMat = envMats.commandCore.clone('base_pbr_core_inst') as any;
    this.coreMat.diffuseColor = this.coreMat.albedoColor;

    // 2. Build Upgraded Base Geometry (Footprint bounded within 2.0 x 2.0 tile cell)
    // 2.1 Heavy mechanical octagonal foundation platform with chamfered footing
    this.basePlatform = MeshBuilder.CreateCylinder(
      'basePlatform',
      {
        diameter: TILE_SIZE * 0.93, // 1.86 units
        height: 0.24,
        tessellation: 8,
      },
      this.scene
    );
    this.basePlatform.position.set(0, 0.12, 0);
    this.basePlatform.material = this.housingMat;
    this.basePlatform.parent = this.rootNode;

    // 2.2 Inset cybernetic conduit tray with accent rim
    this.conduitTray = MeshBuilder.CreateCylinder(
      'baseConduitTray',
      {
        diameter: TILE_SIZE * 0.82, // 1.64 units
        height: 0.28,
        tessellation: 8,
      },
      this.scene
    );
    this.conduitTray.position.set(0, 0.14, 0);
    this.conduitTray.material = this.trimMat;
    this.conduitTray.parent = this.rootNode;

    // 2.3 Four corner structural shock-absorbing stanchions / braces
    const braceRadius = 0.65;
    const braceAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];
    braceAngles.forEach((angle, idx) => {
      const stanchion = MeshBuilder.CreateBox(
        `baseStanchion_${idx}`,
        { width: 0.22, depth: 0.32, height: 0.48 },
        this.scene
      );
      stanchion.position.set(
        Math.cos(angle) * braceRadius,
        0.25,
        Math.sin(angle) * braceRadius
      );
      stanchion.rotation.y = -angle;
      stanchion.rotation.x = 0.18; // Inward tilt
      stanchion.material = this.housingMat;
      stanchion.parent = this.rootNode;
      this.stanchions.push(stanchion);
    });

    // 2.4 Armored sanctuary altar pedestal
    this.reactorMesh = MeshBuilder.CreateCylinder(
      'baseSanctuaryAltar',
      {
        diameter: 1.16,
        height: 0.36,
        tessellation: 8,
      },
      this.scene
    );
    this.reactorMesh.position.set(0, 0.32, 0);
    this.reactorMesh.material = this.housingMat;
    this.reactorMesh.parent = this.rootNode;

    // 2.5 Glowing sanctuary halo platform
    this.coreMesh = MeshBuilder.CreateCylinder(
      'baseCoreHalo',
      {
        diameter: 1.10,
        height: 0.12,
        tessellation: 16,
      },
      this.scene
    );
    this.coreMesh.position.set(0, 0.44, 0);
    this.coreMesh.material = this.coreMat;
    this.coreMesh.parent = this.rootNode;

    // 2.6 Angel Guardian Emblem (HERO defended object / protected life of player)
    this.angelMat = new StandardMaterial('baseAngelMat', this.scene);
    try {
      this.angelTexture = new Texture('/assets/angel_base.png', this.scene, true, false);
      this.angelTexture.hasAlpha = true;
      this.angelMat.diffuseTexture = this.angelTexture;
      this.angelMat.emissiveTexture = this.angelTexture;
      this.angelMat.opacityTexture = this.angelTexture;
    } catch {
      this.angelTexture = null;
    }
    this.angelMat.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.angelMat.emissiveColor = new Color3(0.90, 0.82, 0.70);
    this.angelMat.backFaceCulling = false;

    this.angelMesh = MeshBuilder.CreatePlane(
      'baseAngelEmblem',
      { width: 1.70, height: 1.70 },
      this.scene
    );
    // Tilted slightly backward (~14 deg) so the angel faces the angled top-down camera directly
    this.angelMesh.position.set(0, 1.18, 0);
    this.angelMesh.rotation.x = 0.24;
    this.angelMesh.material = this.angelMat;
    this.angelMesh.parent = this.rootNode;
    this.angelMesh.isPickable = false;

    // 3. Ruined / Destroyed Breach Overlays (hidden by default)
    const breach1 = MeshBuilder.CreateBox(
      'baseBreach1',
      { width: 0.45, height: 0.3, depth: 0.5 },
      this.scene
    );
    breach1.position.set(0.2, 0.6, 0.2);
    breach1.rotation.set(0.1, 0.3, -0.15);
    breach1.material = this.breachMat;
    breach1.parent = this.rootNode;
    breach1.setEnabled(false);
    this.breachMeshes.push(breach1);

    const breach2 = MeshBuilder.CreateBox(
      'baseBreach2',
      { width: 0.5, height: 0.25, depth: 0.4 },
      this.scene
    );
    breach2.position.set(-0.25, 0.5, -0.2);
    breach2.rotation.set(-0.2, -0.4, 0.1);
    breach2.material = this.breachMat;
    breach2.parent = this.rootNode;
    breach2.setEnabled(false);
    this.breachMeshes.push(breach2);

    // 4. Pre-allocate Pooled Explosion VFX
    this.flashMat = new StandardMaterial('baseExplosionFlashMat', this.scene);
    this.flashMat.diffuseColor = new Color3(1.0, 0.8, 0.3);
    this.flashMat.emissiveColor = new Color3(1.0, 0.5, 0.1);
    this.flashMat.disableLighting = true;

    this.sparkMat = new StandardMaterial('baseExplosionSparkMat', this.scene);
    this.sparkMat.diffuseColor = new Color3(1.0, 0.4, 0.1);
    this.sparkMat.emissiveColor = new Color3(0.9, 0.3, 0.05);
    this.sparkMat.disableLighting = true;

    this.flashMesh = MeshBuilder.CreateSphere(
      'baseFlashMesh',
      { diameter: 1.4, segments: 8 },
      this.scene
    );
    this.flashMesh.material = this.flashMat;
    this.flashMesh.position.set(0, VISUAL_HEIGHTS.BASE / 2, 0);
    this.flashMesh.parent = this.rootNode;
    this.flashMesh.setEnabled(false);
    this.flashMesh.isPickable = false;

    // 8 spark / fragment debris meshes
    for (let i = 0; i < 8; i++) {
      const spark = MeshBuilder.CreateBox(
        `baseSpark_${i}`,
        { size: 0.12 },
        this.scene
      );
      spark.material = this.sparkMat;
      spark.parent = this.rootNode;
      spark.setEnabled(false);
      spark.isPickable = false;

      this.explosionParticles.push({
        mesh: spark,
        vx: 0,
        vy: 0,
        vz: 0
      });
    }
  }

  /**
   * Destroys the command base. Idempotent: returns true if newly destroyed,
   * false if already destroyed.
   */
  public destroy(): boolean {
    if (this.state === BaseState.DESTROYED) {
      return false;
    }

    this.state = BaseState.DESTROYED;

    // 1. Shatter/dim angel into ruined dark stone relic
    this.angelMat.emissiveColor.set(0.0, 0.0, 0.0);
    this.angelMat.diffuseColor.set(0.18, 0.18, 0.20);
    this.angelMesh.rotation.z = 0.18;
    this.angelMesh.position.y = 0.95;

    // Extinguish core halo
    this.coreMat.diffuseColor.set(0.12, 0.12, 0.14);
    this.coreMat.albedoColor.set(0.12, 0.12, 0.14);
    this.coreMat.emissiveColor.set(0.04, 0.04, 0.04);

    // 2. Enable charred breach wreckage
    for (let i = 0; i < this.breachMeshes.length; i++) {
      this.breachMeshes[i].setEnabled(true);
    }

    // 3. Trigger controlled explosion VFX
    this.triggerExplosion();

    return true;
  }

  /**
   * Applies data-driven stage presentation styling to the command base core.
   */
  public setPresentation(presentation?: StagePresentationConfig): void {
    this.currentPresentation = presentation;
    this.pulseTimer = 0;

    if (this.state === BaseState.ACTIVE) {
      if (presentation?.floorTheme === 'NEXUS') {
        this.coreMat.diffuseColor.set(0.0, 0.85, 1.0);
        this.coreMat.albedoColor.set(0.0, 0.85, 1.0);
        this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
      } else {
        this.coreMat.diffuseColor.set(0.0, 0.82, 1.0);
        this.coreMat.albedoColor.set(0.0, 0.82, 1.0);
        this.coreMat.emissiveColor.set(0.0, 0.45, 0.7);
      }
    }
  }

  /**
   * Restores the base to its pristine active state with glowing cyan core and radiant Angel.
   */
  public reset(): void {
    this.state = BaseState.ACTIVE;

    // Restore radiant angel guardian
    this.angelMat.emissiveColor.set(0.90, 0.82, 0.70);
    this.angelMat.diffuseColor.set(1.0, 1.0, 1.0);
    this.angelMesh.rotation.z = 0;
    this.angelMesh.position.set(0, 1.18, 0);

    // Restore active reactor core glow based on presentation
    if (this.currentPresentation?.floorTheme === 'NEXUS') {
      this.coreMat.diffuseColor.set(0.0, 0.85, 1.0);
      this.coreMat.albedoColor.set(0.0, 0.85, 1.0);
      this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
    } else {
      this.coreMat.diffuseColor.set(0.0, 0.82, 1.0);
      this.coreMat.albedoColor.set(0.0, 0.82, 1.0);
      this.coreMat.emissiveColor.set(0.0, 0.45, 0.7);
    }

    // Hide breach wreckage
    for (let i = 0; i < this.breachMeshes.length; i++) {
      this.breachMeshes[i].setEnabled(false);
    }

    // Stop and hide explosion
    this.explosionActive = false;
    this.flashMesh.setEnabled(false);
    for (let i = 0; i < this.explosionParticles.length; i++) {
      this.explosionParticles[i].mesh.setEnabled(false);
    }
  }

  /**
   * Fires the pooled shockwave flash and spark burst.
   */
  private triggerExplosion(): void {
    this.explosionActive = true;
    this.explosionTimer = 0;

    this.flashMesh.setEnabled(true);
    this.flashMesh.scaling.setAll(0.3);

    for (let i = 0; i < this.explosionParticles.length; i++) {
      const p = this.explosionParticles[i];
      p.mesh.position.set(0, VISUAL_HEIGHTS.BASE / 2, 0);
      p.mesh.setEnabled(true);
      p.mesh.scaling.setAll(1.0);

      const angle = (i / 8) * Math.PI * 2;
      const speed = 2.5 + (i % 3) * 0.4;
      p.vx = Math.cos(angle) * speed;
      p.vz = Math.sin(angle) * speed;
      p.vy = 1.8 + (i % 2) * 0.8;
    }
  }

  /**
   * Updates explosion VFX animation and ambient divine angel breathing pulse.
   */
  public update(deltaTime: number, reducedMotion: boolean = false): void {
    // 1. Ambient divine angel breathing pulse when active
    if (this.state === BaseState.ACTIVE) {
      this.pulseTimer += deltaTime;
      if (!reducedMotion) {
        const pulse = 0.82 + 0.18 * Math.sin(this.pulseTimer * 3.0);
        this.angelMat.emissiveColor.set(
          0.90 * pulse,
          0.82 * pulse,
          0.70 * pulse
        );
      }
    }

    // 2. Ambient cyan/violet energy core halo pulse when active
    if (this.state === BaseState.ACTIVE && this.currentPresentation?.pulseEnabled) {
      if (reducedMotion) {
        this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
      } else {
        const rate = this.currentPresentation.pulseRate ?? 2.2;
        const pulse = 0.5 + 0.5 * Math.sin((this.pulseTimer * 2 * Math.PI) / rate);
        // Sinusoidal cyan <-> violet modulation (zero allocations)
        this.coreMat.emissiveColor.set(
          0.05 + 0.18 * pulse,
          0.32 + 0.18 * (1 - pulse),
          0.65 + 0.20 * pulse
        );
      }
    }

    // 3. Explosion VFX update
    if (this.explosionActive) {
      this.explosionTimer += deltaTime;
      const progress = Math.min(1.0, this.explosionTimer / this.explosionDuration);

      if (progress >= 1.0) {
        this.explosionActive = false;
        this.flashMesh.setEnabled(false);
        for (let i = 0; i < this.explosionParticles.length; i++) {
          this.explosionParticles[i].mesh.setEnabled(false);
        }
        return;
      }

      // Flash expansion and fade
      const flashScale = 0.3 + progress * 1.8;
      this.flashMesh.scaling.setAll(flashScale);

      // Particle ballistic dispersion
      const particleScale = Math.max(0.1, 1.0 - progress);
      for (let i = 0; i < this.explosionParticles.length; i++) {
        const p = this.explosionParticles[i];
        p.vy -= 9.8 * deltaTime; // Gravity
        p.mesh.position.x += p.vx * deltaTime;
        p.mesh.position.y += p.vy * deltaTime;
        p.mesh.position.z += p.vz * deltaTime;
        p.mesh.scaling.setAll(particleScale);
      }
    }
  }

  public getBasePlatform(): Mesh {
    return this.basePlatform;
  }

  public getReactorMesh(): Mesh {
    return this.reactorMesh;
  }

  public getState(): BaseState {
    return this.state;
  }

  public isDestroyed(): boolean {
    return this.state === BaseState.DESTROYED;
  }

  public getPosition(): Vector3 {
    return this.worldPosition;
  }

  public getRootNode(): TransformNode {
    return this.rootNode;
  }

  public dispose(): void {
    this.reset();
    this.basePlatform.dispose();
    this.conduitTray.dispose();
    this.stanchions.forEach((s) => s.dispose());
    this.reactorMesh.dispose();
    this.coreMesh.dispose();
    this.angelMesh.dispose();
    this.containmentRings.forEach((r) => r.dispose());
    for (let i = 0; i < this.breachMeshes.length; i++) {
      this.breachMeshes[i].dispose();
    }
    this.flashMesh.dispose();
    for (let i = 0; i < this.explosionParticles.length; i++) {
      this.explosionParticles[i].mesh.dispose();
    }
    this.angelTexture?.dispose();
    this.angelMat.dispose();
    this.coreMat.dispose();
    this.flashMat.dispose();
    this.sparkMat.dispose();
    this.rootNode.dispose();
  }
}
