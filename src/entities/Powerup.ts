import {
  Scene,
  Vector3,
  Color3,
  Mesh,
  MeshBuilder,
  StandardMaterial,
  TransformNode,
} from '@babylonjs/core';
import {
  PowerupType,
  POWERUP_CONFIGS,
  POWERUP_DROP_LIFETIME,
  EXPIRATION_WARNING_TIME,
  COLLECTIBLE_HALF_EXTENT,
} from '../config/powerups';
import { BoxBounds } from '../systems/CollisionSystem';

/**
 * Pooled battlefield collectible powerup entity.
 * Represents an original futuristic energy module hovering above the arena floor.
 * Geometry and materials are pre-instantiated in the constructor to eliminate runtime allocations.
 */
export class Powerup {
  private id: string;
  private scene: Scene;
  private rootNode: TransformNode;
  private coreMesh: Mesh;
  private casingMesh: Mesh;
  private groundGlowMesh: Mesh;

  private coreMat: StandardMaterial;
  private casingMat: StandardMaterial;
  private glowMat: StandardMaterial;

  private active: boolean = false;
  private currentType: PowerupType = PowerupType.OVERDRIVE_CORE;
  private lifetime: number = 0;
  private animTimer: number = 0;
  private basePosition: Vector3 = Vector3.Zero();

  constructor(id: string, scene: Scene) {
    this.id = id;
    this.scene = scene;

    this.rootNode = new TransformNode(`powerupRoot_${id}`, this.scene);
    this.rootNode.setEnabled(false);

    // 1. Materials
    this.coreMat = new StandardMaterial(`powerupCoreMat_${id}`, this.scene);
    this.coreMat.diffuseColor = new Color3(1, 1, 1);
    this.coreMat.specularPower = 64;

    this.casingMat = new StandardMaterial(`powerupCasingMat_${id}`, this.scene);
    this.casingMat.diffuseColor = new Color3(0.12, 0.15, 0.2);
    this.casingMat.specularColor = new Color3(0.3, 0.4, 0.5);

    this.glowMat = new StandardMaterial(`powerupGlowMat_${id}`, this.scene);
    this.glowMat.disableLighting = true;
    this.glowMat.alpha = 0.35;

    // 2. Pre-create Geometry
    // Hexagonal cylindrical energy core
    this.coreMesh = MeshBuilder.CreateCylinder(
      `powerupCoreMesh_${id}`,
      { height: 0.38, diameter: 0.52, tessellation: 6 },
      this.scene
    );
    this.coreMesh.material = this.coreMat;
    this.coreMesh.parent = this.rootNode;
    this.coreMesh.position.y = 0.45;

    // Metallic outer collar / casing
    this.casingMesh = MeshBuilder.CreateCylinder(
      `powerupCasingMesh_${id}`,
      { height: 0.14, diameter: 0.72, tessellation: 6 },
      this.scene
    );
    this.casingMesh.material = this.casingMat;
    this.casingMesh.parent = this.rootNode;
    this.casingMesh.position.y = 0.45;

    // Projected ground glow disc
    this.groundGlowMesh = MeshBuilder.CreateDisc(
      `powerupGroundGlow_${id}`,
      { radius: 0.65, tessellation: 16 },
      this.scene
    );
    this.groundGlowMesh.rotation.x = Math.PI / 2; // Flat on arena floor
    this.groundGlowMesh.position.y = 0.04;
    this.groundGlowMesh.material = this.glowMat;
    this.groundGlowMesh.parent = this.rootNode;
  }

  /**
   * Configures and activates the powerup module at a verified world position.
   */
  public spawn(position: Vector3, type: PowerupType): void {
    this.currentType = type;
    this.basePosition.copyFrom(position);
    this.rootNode.position.copyFrom(position);

    const config = POWERUP_CONFIGS[type];
    const profile = config.visualProfile;

    const primaryCol = Color3.FromHexString(profile.primaryColor);
    const glowCol = Color3.FromHexString(profile.glowColor);
    const coreCol = Color3.FromHexString(profile.coreColor);
    const casingCol = Color3.FromHexString(profile.casingColor);

    this.coreMat.diffuseColor = coreCol;
    this.coreMat.emissiveColor = primaryCol;

    this.casingMat.diffuseColor = casingCol;
    this.casingMat.specularColor = primaryCol.scale(0.5);

    this.glowMat.emissiveColor = glowCol;
    this.glowMat.alpha = 0.35;

    this.lifetime = 0;
    this.animTimer = 0;
    this.active = true;
    this.rootNode.setEnabled(true);
  }

  /**
   * Per-frame animation and lifetime countdown update.
   * Returns false when 10-second drop lifetime expires.
   */
  public update(deltaTime: number): boolean {
    if (!this.active) return false;

    this.lifetime += deltaTime;
    this.animTimer += deltaTime;

    if (this.lifetime >= POWERUP_DROP_LIFETIME) {
      this.deactivate();
      return false;
    }

    // Hover bobbing & slow rotation
    const bobOffset = Math.sin(this.animTimer * 3.2) * 0.12;
    this.coreMesh.position.y = 0.48 + bobOffset;
    this.casingMesh.position.y = 0.48 + bobOffset;
    this.rootNode.rotation.y += deltaTime * 1.6;

    // Expiration warning pulse in final 2 seconds
    const remaining = POWERUP_DROP_LIFETIME - this.lifetime;
    if (remaining <= EXPIRATION_WARNING_TIME) {
      // Rapid flashing
      const flash = Math.sin(this.animTimer * 16.0) * 0.5 + 0.5;
      this.coreMesh.visibility = flash > 0.25 ? 1.0 : 0.2;
      this.casingMesh.visibility = flash > 0.25 ? 1.0 : 0.2;
      this.glowMat.alpha = flash * 0.5;
    } else {
      // Subtle rhythmic glow pulse
      const pulse = Math.sin(this.animTimer * 4.0) * 0.15 + 0.35;
      this.glowMat.alpha = pulse;
      this.coreMesh.visibility = 1.0;
      this.casingMesh.visibility = 1.0;
    }

    return true;
  }

  /**
   * Deactivates the collectible and hides its visual hierarchy.
   */
  public deactivate(): void {
    this.active = false;
    this.lifetime = 0;
    this.animTimer = 0;
    this.rootNode.setEnabled(false);
  }

  /**
   * Computes logical AABB for player vehicle collision / collection.
   */
  public getAABB(): BoxBounds {
    const x = this.basePosition.x;
    const z = this.basePosition.z;
    return {
      minX: x - COLLECTIBLE_HALF_EXTENT,
      maxX: x + COLLECTIBLE_HALF_EXTENT,
      minZ: z - COLLECTIBLE_HALF_EXTENT,
      maxZ: z + COLLECTIBLE_HALF_EXTENT,
    };
  }

  public getId(): string {
    return this.id;
  }

  public getType(): PowerupType {
    return this.currentType;
  }

  public isActive(): boolean {
    return this.active;
  }

  public getPosition(): Vector3 {
    return this.basePosition;
  }

  public getLifetime(): number {
    return this.lifetime;
  }

  public reset(): void {
    this.deactivate();
  }

  public dispose(): void {
    this.deactivate();
    this.coreMesh.dispose();
    this.casingMesh.dispose();
    this.groundGlowMesh.dispose();
    this.coreMat.dispose();
    this.casingMat.dispose();
    this.glowMat.dispose();
    this.rootNode.dispose();
  }
}
