import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Mesh,
  Color3
} from '@babylonjs/core';
import { Direction, directionToRotation } from '../game/Direction';
import { PROJECTILE_CONFIG, ProjectileTeam } from '../game/constants';

/**
 * Bullet entity representing a single logical and visual projectile.
 * Features an incandescent white-hot supersonic core slug and dual-plane
 * fiery plasma tracer fins (+ cross-planes) matching high-energy tank combat.
 * Managed and simulated by ProjectileSystem.
 */
export class Bullet {
  private scene: Scene;
  private mesh: Mesh;
  private coreMesh: Mesh;
  private horizontalFin: Mesh;
  private verticalFin: Mesh;

  private active: boolean = false;
  private position: Vector3 = new Vector3();
  private direction: Direction = Direction.NORTH;
  private speed: number = PROJECTILE_CONFIG.SPEED;
  private team: ProjectileTeam = ProjectileTeam.PLAYER;
  private lifetime: number = 0;
  private maxLifetime: number = PROJECTILE_CONFIG.MAX_LIFETIME;

  private static coreMaterial: StandardMaterial | null = null;

  private static getCoreMaterial(scene: Scene): StandardMaterial {
    if (!Bullet.coreMaterial || Bullet.coreMaterial.getScene() !== scene) {
      const mat = new StandardMaterial('bullet_core_mat', scene);
      mat.diffuseColor = new Color3(1.0, 1.0, 1.0);
      mat.emissiveColor = new Color3(1.0, 1.0, 0.95);
      mat.disableLighting = true;
      Bullet.coreMaterial = mat;
    }
    return Bullet.coreMaterial;
  }

  constructor(name: string, scene: Scene, sharedMaterial: StandardMaterial) {
    this.scene = scene;

    // 1. Root container mesh for unified transform & enablement
    this.mesh = new Mesh(name, this.scene);
    this.mesh.isPickable = false;
    this.mesh.setEnabled(false);

    // 2. White-hot supersonic core dart (solid incandescent slug along center spine)
    this.coreMesh = MeshBuilder.CreateBox(
      `${name}_core`,
      {
        width: PROJECTILE_CONFIG.WIDTH * 0.75,  // 0.09
        height: PROJECTILE_CONFIG.HEIGHT * 0.75, // 0.09
        depth: 0.38
      },
      this.scene
    );
    this.coreMesh.position.z = -0.05; // Head at +0.14, core spans [-0.24, +0.14]
    this.coreMesh.material = Bullet.getCoreMaterial(this.scene);
    this.coreMesh.isPickable = false;
    this.coreMesh.parent = this.mesh;

    // 3. Horizontal plasma tracer fin (XZ plane, length along Z: head at +0.15, tail at -1.35)
    this.horizontalFin = MeshBuilder.CreatePlane(
      `${name}_h`,
      { width: 1.50, height: 0.40 },
      this.scene
    );
    this.horizontalFin.position.z = -0.60;
    this.horizontalFin.rotation.x = Math.PI / 2;
    this.horizontalFin.rotation.y = Math.PI / 2;
    this.horizontalFin.material = sharedMaterial;
    this.horizontalFin.isPickable = false;
    this.horizontalFin.parent = this.mesh;

    // 4. Vertical plasma tracer fin (YZ plane, length along Z: head at +0.15, tail at -1.35)
    this.verticalFin = MeshBuilder.CreatePlane(
      `${name}_v`,
      { width: 1.50, height: 0.40 },
      this.scene
    );
    this.verticalFin.position.z = -0.60;
    this.verticalFin.rotation.y = Math.PI / 2;
    this.verticalFin.material = sharedMaterial;
    this.verticalFin.isPickable = false;
    this.verticalFin.parent = this.mesh;
  }

  public setMaterial(material: StandardMaterial): void {
    this.horizontalFin.material = material;
    this.verticalFin.material = material;
  }

  public getMesh(): Mesh {
    return this.mesh;
  }

  /**
   * Activates the bullet at the specified spawn world position facing cardinal direction.
   */
  public activate(
    spawnPos: Vector3,
    dir: Direction,
    team: ProjectileTeam = ProjectileTeam.PLAYER,
    speed: number = PROJECTILE_CONFIG.SPEED,
    maxLifetime: number = PROJECTILE_CONFIG.MAX_LIFETIME
  ): void {
    this.active = true;
    this.position.copyFrom(spawnPos);
    this.direction = dir;
    this.team = team;
    this.speed = speed;
    this.lifetime = 0;
    this.maxLifetime = maxLifetime;

    this.mesh.position.copyFrom(this.position);
    this.mesh.rotation.y = directionToRotation(dir);
    this.mesh.setEnabled(true);
  }

  /**
   * Deactivates the bullet and hides its visual mesh.
   */
  public deactivate(): void {
    this.active = false;
    this.mesh.setEnabled(false);
  }

  public isActive(): boolean {
    return this.active;
  }

  public getPosition(): Vector3 {
    return this.position;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
    this.mesh.position.copyFrom(this.position);
  }

  public getDirection(): Direction {
    return this.direction;
  }

  public getTeam(): ProjectileTeam {
    return this.team;
  }

  public getSpeed(): number {
    return this.speed;
  }

  public getLifetime(): number {
    return this.lifetime;
  }

  /**
   * Updates flight time and checks maximum lifetime expiry.
   * Returns false if deactivated due to timeout.
   */
  public updateLifetime(deltaTime: number): boolean {
    if (!this.active) return false;
    this.lifetime += deltaTime;
    if (this.lifetime >= this.maxLifetime) {
      this.deactivate();
      return false;
    }
    return true;
  }

  /**
   * Synchronizes visual transform with logical state.
   */
  public update(_deltaTime: number): void {
    if (this.active) {
      this.mesh.position.copyFrom(this.position);
    }
  }

  /**
   * Disposes visual mesh and child components.
   */
  public dispose(): void {
    this.deactivate();
    this.mesh.dispose(false, true);
  }
}
