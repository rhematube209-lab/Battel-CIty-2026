import { Vector3, Mesh, InstancedMesh } from '@babylonjs/core';
import { TileType } from '../game/constants';
import { Direction } from '../game/Direction';

export type BrickQuadrant = 'tl' | 'tr' | 'bl' | 'br';

export interface SolidAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface BrickQuadrants {
  tl: boolean; // Top-Left (North-West)
  tr: boolean; // Top-Right (North-East)
  bl: boolean; // Bottom-Left (South-West)
  br: boolean; // Bottom-Right (South-East)
}

export interface BrickQuadrantMeshes {
  tl?: InstancedMesh;
  tr?: InstancedMesh;
  bl?: InstancedMesh;
  br?: InstancedMesh;
}

export class Tile {
  public readonly row: number;
  public readonly column: number;
  public type: TileType;
  public readonly worldPosition: Vector3;

  // Brick-specific quadrant tracking for Phase 5 destruction
  public brickQuadrants?: BrickQuadrants;
  public quadrantMeshes?: BrickQuadrantMeshes;

  // Visual mesh reference for non-quadrant tiles
  public mesh?: Mesh | InstancedMesh;

  // Mag-Drive Conveyor direction (Phase 16)
  public conveyorDirection?: Direction;

  constructor(row: number, column: number, type: TileType, worldPosition: Vector3) {
    this.row = row;
    this.column = column;
    this.type = type;
    this.worldPosition = worldPosition;

    if (type === TileType.BRICK) {
      this.brickQuadrants = { tl: true, tr: true, bl: true, br: true };
      this.quadrantMeshes = {};
    }
  }

  /**
   * Returns whether a specific quadrant is currently intact.
   */
  public isBrickQuadrantActive(quadrant: BrickQuadrant): boolean {
    if (!this.brickQuadrants) return false;
    return !!this.brickQuadrants[quadrant];
  }

  /**
   * Destroys a single quadrant reversibly:
   * Marks logical state false and hides the instanced mesh.
   * Returns true if newly destroyed, false if already destroyed or not a brick tile.
   */
  public destroyBrickQuadrant(quadrant: BrickQuadrant): boolean {
    if (!this.brickQuadrants || !this.brickQuadrants[quadrant]) {
      return false;
    }

    this.brickQuadrants[quadrant] = false;

    // Reversible hiding - do NOT dispose mesh instance
    if (this.quadrantMeshes && this.quadrantMeshes[quadrant]) {
      this.quadrantMeshes[quadrant]!.setEnabled(false);
    }

    return true;
  }

  /**
   * Returns true if at least one quadrant remains intact.
   */
  public hasAnyBrickQuadrants(): boolean {
    if (!this.brickQuadrants) return false;
    const { tl, tr, bl, br } = this.brickQuadrants;
    return tl || tr || bl || br;
  }

  /**
   * Returns true if this is a brick tile and all 4 quadrants have been destroyed.
   */
  public isBrickFullyDestroyed(): boolean {
    return this.type === TileType.BRICK && !this.hasAnyBrickQuadrants();
  }

  /**
   * Restores all brick quadrants to intact state and re-enables their meshes.
   */
  public resetBrickQuadrants(): void {
    if (this.type !== TileType.BRICK || !this.brickQuadrants) return;

    this.brickQuadrants.tl = true;
    this.brickQuadrants.tr = true;
    this.brickQuadrants.bl = true;
    this.brickQuadrants.br = true;

    if (this.quadrantMeshes) {
      this.quadrantMeshes.tl?.setEnabled(true);
      this.quadrantMeshes.tr?.setEnabled(true);
      this.quadrantMeshes.bl?.setEnabled(true);
      this.quadrantMeshes.br?.setEnabled(true);
    }
  }

  /**
   * Returns world AABBs for all currently active quadrants in this tile.
   * Quadrants occupy 1.0 x 1.0 world units.
   */
  public getActiveQuadrantAABBs(): { quadrant: BrickQuadrant; bounds: SolidAABB }[] {
    if (this.type !== TileType.BRICK || !this.brickQuadrants) {
      return [];
    }

    const cx = this.worldPosition.x;
    const cz = this.worldPosition.z;
    const activeList: { quadrant: BrickQuadrant; bounds: SolidAABB }[] = [];

    // TL: North-West [cx - 1.0, cx] x [cz, cz + 1.0]
    if (this.brickQuadrants.tl) {
      activeList.push({
        quadrant: 'tl',
        bounds: { minX: cx - 1.0, maxX: cx, minZ: cz, maxZ: cz + 1.0 }
      });
    }

    // TR: North-East [cx, cx + 1.0] x [cz, cz + 1.0]
    if (this.brickQuadrants.tr) {
      activeList.push({
        quadrant: 'tr',
        bounds: { minX: cx, maxX: cx + 1.0, minZ: cz, maxZ: cz + 1.0 }
      });
    }

    // BL: South-West [cx - 1.0, cx] x [cz - 1.0, cz]
    if (this.brickQuadrants.bl) {
      activeList.push({
        quadrant: 'bl',
        bounds: { minX: cx - 1.0, maxX: cx, minZ: cz - 1.0, maxZ: cz }
      });
    }

    // BR: South-East [cx, cx + 1.0] x [cz - 1.0, cz]
    if (this.brickQuadrants.br) {
      activeList.push({
        quadrant: 'br',
        bounds: { minX: cx, maxX: cx + 1.0, minZ: cz - 1.0, maxZ: cz }
      });
    }

    return activeList;
  }

  /**
   * Determines if this tile physically blocks tanks.
   * Solid: intact BRICK, STEEL, WATER, BASE.
   * Non-solid: fully destroyed BRICK, EMPTY, BUSH, PLAYER_SPAWN, ENEMY_SPAWN.
   */
  public isSolid(): boolean {
    switch (this.type) {
      case TileType.BRICK:
        return this.hasAnyBrickQuadrants();
      case TileType.STEEL:
      case TileType.WATER:
      case TileType.BASE:
        return true;
      case TileType.EMPTY:
      case TileType.BUSH:
      case TileType.PLAYER_SPAWN:
      case TileType.ENEMY_SPAWN:
      case TileType.CRYO:
      case TileType.CONVEYOR:
      default:
        return false;
    }
  }

  /**
   * Cleans up any attached Babylon mesh instances.
   */
  public dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = undefined;
    }
    if (this.quadrantMeshes) {
      if (this.quadrantMeshes.tl) this.quadrantMeshes.tl.dispose();
      if (this.quadrantMeshes.tr) this.quadrantMeshes.tr.dispose();
      if (this.quadrantMeshes.bl) this.quadrantMeshes.bl.dispose();
      if (this.quadrantMeshes.br) this.quadrantMeshes.br.dispose();
      this.quadrantMeshes = {};
    }
  }
}
