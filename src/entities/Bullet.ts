import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Mesh
} from '@babylonjs/core';
import { Direction, directionToRotation } from '../game/Direction';
import { PROJECTILE_CONFIG, ProjectileTeam } from '../game/constants';

/**
 * Bullet entity representing a single logical and visual projectile.
 * Managed and simulated by ProjectileSystem.
 * Decoupled from input and tank lifecycle.
 */
export class Bullet {
  private scene: Scene;
  private mesh: Mesh;
  private active: boolean = false;
  private position: Vector3 = new Vector3();
  private direction: Direction = Direction.NORTH;
  private speed: number = PROJECTILE_CONFIG.SPEED;
  private team: ProjectileTeam = ProjectileTeam.PLAYER;
  private lifetime: number = 0;
  private maxLifetime: number = PROJECTILE_CONFIG.MAX_LIFETIME;

  constructor(name: string, scene: Scene, sharedMaterial: StandardMaterial) {
    this.scene = scene;

    // Compact aerodynamic projectile slug oriented along local Z
    this.mesh = MeshBuilder.CreateBox(
      name,
      {
        width: PROJECTILE_CONFIG.WIDTH,
        height: PROJECTILE_CONFIG.HEIGHT,
        depth: PROJECTILE_CONFIG.LENGTH
      },
      this.scene
    );
    this.mesh.material = sharedMaterial;
    this.mesh.setEnabled(false);
    this.mesh.isPickable = false;
  }

  public setMaterial(material: StandardMaterial): void {
    this.mesh.material = material;
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
   * Disposes visual mesh.
   */
  public dispose(): void {
    this.deactivate();
    this.mesh.dispose();
  }
}
