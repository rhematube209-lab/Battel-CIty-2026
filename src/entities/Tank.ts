import { Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { Direction, directionToRotation } from '../game/Direction';

/**
 * Base abstract tank class representing common physical state and transform nodes.
 */
export abstract class Tank {
  protected scene: Scene;
  public readonly rootNode: TransformNode;

  protected direction: Direction = Direction.NORTH;
  protected speed: number = 5.0;
  protected isMovingState: boolean = false;

  constructor(name: string, scene: Scene, initialPosition: Vector3, initialDirection = Direction.NORTH) {
    this.scene = scene;
    this.rootNode = new TransformNode(name, this.scene);
    this.rootNode.position.copyFrom(initialPosition);
    this.setDirection(initialDirection);
  }

  public getPosition(): Vector3 {
    return this.rootNode.position;
  }

  public getDirection(): Direction {
    return this.direction;
  }

  public isMoving(): boolean {
    return this.isMovingState;
  }

  public getSpeed(): number {
    return this.speed;
  }

  /**
   * Snaps rotation immediately to the given cardinal direction.
   */
  public setDirection(dir: Direction): void {
    this.direction = dir;
    this.rootNode.rotation.y = directionToRotation(dir);
  }

  public abstract update(deltaTime: number): void;

  public dispose(): void {
    this.rootNode.dispose();
  }
}
