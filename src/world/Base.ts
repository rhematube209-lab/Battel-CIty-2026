import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  TransformNode
} from '@babylonjs/core';
import { TILE_SIZE, VISUAL_HEIGHTS } from '../game/constants';
import { StagePresentationConfig } from '../stages/StageDefinition';

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
 * Base entity representing the player's futuristic command node.
 * Owns reversible active and destroyed visual states and pre-allocated explosion VFX.
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
  private pedestalMesh: Mesh;
  private reactorMesh: Mesh;
  private coreMesh: Mesh;
  private breachMeshes: Mesh[] = [];

  // Materials
  private pedestalMat: StandardMaterial;
  private coreMat: StandardMaterial;
  private breachMat: StandardMaterial;

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

    // 1. Pre-allocate Materials
    this.pedestalMat = new StandardMaterial('basePedestalMat', this.scene);
    this.pedestalMat.diffuseColor = new Color3(0.12, 0.16, 0.22);
    this.pedestalMat.specularColor = new Color3(0.4, 0.45, 0.55);

    this.coreMat = new StandardMaterial('baseCoreMat', this.scene);
    this.coreMat.diffuseColor = new Color3(0.0, 0.82, 1.0);
    this.coreMat.emissiveColor = new Color3(0.0, 0.45, 0.7);

    this.breachMat = new StandardMaterial('baseBreachMat', this.scene);
    this.breachMat.diffuseColor = new Color3(0.1, 0.1, 0.12);
    this.breachMat.specularColor = new Color3(0.15, 0.15, 0.15);

    // 2. Build Base Geometry
    // Hexagonal reinforced command platform
    this.pedestalMesh = MeshBuilder.CreateCylinder(
      'basePedestal',
      {
        diameter: TILE_SIZE * 0.88,
        height: 0.5,
        tessellation: 6
      },
      this.scene
    );
    this.pedestalMesh.position.set(0, 0.25, 0);
    this.pedestalMesh.material = this.pedestalMat;
    this.pedestalMesh.parent = this.rootNode;

    // Inner protective power reactor node
    this.reactorMesh = MeshBuilder.CreateBox(
      'baseReactor',
      {
        width: 0.8,
        depth: 0.8,
        height: 0.65
      },
      this.scene
    );
    this.reactorMesh.position.set(0, 0.55 + 0.325, 0);
    this.reactorMesh.material = this.pedestalMat;
    this.reactorMesh.parent = this.rootNode;

    // Glowing futuristic tactical reactor core
    this.coreMesh = MeshBuilder.CreateCylinder(
      'baseCore',
      {
        diameter: 0.6,
        height: 0.2,
        tessellation: 8
      },
      this.scene
    );
    this.coreMesh.position.set(0, VISUAL_HEIGHTS.BASE + 0.05, 0);
    this.coreMesh.material = this.coreMat;
    this.coreMesh.parent = this.rootNode;

    // 3. Build Ruined/Destroyed Breach Overlays (hidden by default)
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

    // 1. Extinguish cyan energy core (reactor failure)
    this.coreMat.diffuseColor = new Color3(0.12, 0.12, 0.14);
    this.coreMat.emissiveColor = new Color3(0.04, 0.04, 0.04);

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
        this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
      } else {
        this.coreMat.diffuseColor.set(0.0, 0.82, 1.0);
        this.coreMat.emissiveColor.set(0.0, 0.45, 0.7);
      }
    }
  }

  /**
   * Restores the base to its pristine active state with glowing cyan core.
   */
  public reset(): void {
    this.state = BaseState.ACTIVE;

    // Restore active reactor core glow based on presentation
    if (this.currentPresentation?.floorTheme === 'NEXUS') {
      this.coreMat.diffuseColor.set(0.0, 0.85, 1.0);
      this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
    } else {
      this.coreMat.diffuseColor.set(0.0, 0.82, 1.0);
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
   * Updates explosion VFX animation and ambient presentation core pulse.
   */
  public update(deltaTime: number, reducedMotion: boolean = false): void {
    // 1. Ambient cyan/violet energy core pulse when active
    if (this.state === BaseState.ACTIVE && this.currentPresentation?.pulseEnabled) {
      if (reducedMotion) {
        this.coreMat.emissiveColor.set(0.10, 0.40, 0.75);
      } else {
        this.pulseTimer += deltaTime;
        const rate = this.currentPresentation.pulseRate ?? 2.2;
        const pulse = 0.5 + 0.5 * Math.sin((this.pulseTimer * 2 * Math.PI) / rate);
        // Sinusoidal cyan <-> violet modulation (zero allocations)
        this.coreMat.emissiveColor.set(
          0.05 + 0.18 * pulse,
          0.32 + 0.18 * (1 - pulse),
          0.65 + 0.22 * pulse
        );
      }
    }

    // 2. Destruction explosion VFX animation
    if (!this.explosionActive) return;

    this.explosionTimer += deltaTime;
    const progress = this.explosionTimer / this.explosionDuration;

    if (progress >= 1.0) {
      this.explosionActive = false;
      this.flashMesh.setEnabled(false);
      for (let i = 0; i < this.explosionParticles.length; i++) {
        this.explosionParticles[i].mesh.setEnabled(false);
      }
    } else {
      // Expanding flash ring
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
    this.pedestalMesh.dispose();
    this.reactorMesh.dispose();
    this.coreMesh.dispose();
    for (let i = 0; i < this.breachMeshes.length; i++) {
      this.breachMeshes[i].dispose();
    }
    this.flashMesh.dispose();
    for (let i = 0; i < this.explosionParticles.length; i++) {
      this.explosionParticles[i].mesh.dispose();
    }
    this.pedestalMat.dispose();
    this.coreMat.dispose();
    this.breachMat.dispose();
    this.flashMat.dispose();
    this.sparkMat.dispose();
    this.rootNode.dispose();
  }
}
