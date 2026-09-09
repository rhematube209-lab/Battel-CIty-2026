import {
  ARENA_WIDTH,
  ARENA_DEPTH,
  TILE_SIZE,
  PLAYER_CONFIG
} from '../game/constants';
import { Direction } from '../game/Direction';
import { TileMap } from '../world/TileMap';

export interface BoxBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/**
 * Deterministic AABB Collision System for Battle City 2026.
 * Checks logical tank footprints against TileMap solid tiles and arena boundaries.
 * No physics engine / rigidbodies used.
 */
export class CollisionSystem {
  private tileMap: TileMap;
  private readonly halfExtent: number;
  private readonly arenaHalfWidth: number;
  private readonly arenaHalfDepth: number;

  constructor(tileMap: TileMap, halfExtent = PLAYER_CONFIG.COLLISION_HALF_EXTENT) {
    this.tileMap = tileMap;
    this.halfExtent = halfExtent;
    this.arenaHalfWidth = ARENA_WIDTH / 2;   // 13.0
    this.arenaHalfDepth = ARENA_DEPTH / 2;   // 13.0
  }

  /**
   * Rebinds the active TileMap reference upon stage transition.
   */
  public setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
  }

  /**
   * Returns active TileMap reference for terrain and surface queries.
   */
  public getTileMap(): TileMap {
    return this.tileMap;
  }

  /**
   * Returns true if an AABB centered at (x, z) with halfExtent is collision-free.
   * Can check against static world geometry and optional dynamic obstacle AABBs (e.g. other tanks).
   */
  public isPositionValid(x: number, z: number, extraAABBs?: BoxBounds[]): boolean {
    const minX = x - this.halfExtent;
    const maxX = x + this.halfExtent;
    const minZ = z - this.halfExtent;
    const maxZ = z + this.halfExtent;

    // 1. Arena Boundary Check
    if (
      minX < -this.arenaHalfWidth ||
      maxX > this.arenaHalfWidth ||
      minZ < -this.arenaHalfDepth ||
      maxZ > this.arenaHalfDepth
    ) {
      return false;
    }

    // 2. Broad-Phase Grid Range
    // Coordinates: x in [-13, 13], z in [-13, 13]
    const minCol = Math.max(0, Math.floor((minX + this.arenaHalfWidth) / TILE_SIZE));
    const maxCol = Math.min(12, Math.floor((maxX + this.arenaHalfWidth) / TILE_SIZE));

    const minRow = Math.max(0, Math.floor((this.arenaHalfDepth - maxZ) / TILE_SIZE));
    const maxRow = Math.min(12, Math.floor((this.arenaHalfDepth - minZ) / TILE_SIZE));

    // 3. Narrow-Phase AABB Check Against Candidate Solid Boxes (including active brick quadrants)
    const EPSILON = 0.002;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const solidBoxes = this.tileMap.getSolidBoxesForCell(r, c, true);
        for (let i = 0; i < solidBoxes.length; i++) {
          const box = solidBoxes[i];
          const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
          const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;

          if (overlapX && overlapZ) {
            return false; // Intersection with solid wall, quadrant, or base
          }
        }
      }
    }

    // 4. Dynamic Obstacle AABB Check (Tank-to-Tank collision blocking)
    if (extraAABBs && extraAABBs.length > 0) {
      for (let i = 0; i < extraAABBs.length; i++) {
        const box = extraAABBs[i];
        const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
        const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;

        if (overlapX && overlapZ) {
          return false; // Intersection with other vehicle
        }
      }
    }

    return true;
  }

  /**
   * Attempts to move a tank from (startX, startZ) in direction `dir` by `distance`.
   * Splits movement into sub-steps if necessary to guarantee tunnel-free resolution.
   * Also applies subtle lane alignment assistance on the perpendicular axis.
   * Returns final accepted { x, z, moved }.
   */
  public resolveMovement(
    startX: number,
    startZ: number,
    dir: Direction,
    distance: number,
    deltaTime: number,
    extraAABBs?: BoxBounds[]
  ): { x: number; z: number; moved: boolean } {
    let currentX = startX;
    let currentZ = startZ;

    // 1. Subtle Lane Alignment Assist
    const ALIGN_SPEED = 6.0; // Units per second gentle ease
    if (dir === Direction.NORTH || dir === Direction.SOUTH) {
      // Find nearest column center along X
      const col = Math.round((currentX + this.arenaHalfWidth) / TILE_SIZE - 0.5);
      const colCenter = (col - 6) * TILE_SIZE;
      const dx = colCenter - currentX;

      if (Math.abs(dx) <= PLAYER_CONFIG.LANE_SNAP_TOLERANCE && Math.abs(dx) > 0.001) {
        const nudge = Math.sign(dx) * Math.min(Math.abs(dx), ALIGN_SPEED * deltaTime);
        if (this.isPositionValid(currentX + nudge, currentZ, extraAABBs)) {
          currentX += nudge;
        }
      }
    } else if (dir === Direction.EAST || dir === Direction.WEST) {
      // Find nearest row center along Z
      const row = Math.round(this.arenaHalfDepth / TILE_SIZE - 0.5 - currentZ / TILE_SIZE);
      const rowCenter = (6 - row) * TILE_SIZE;
      const dz = rowCenter - currentZ;

      if (Math.abs(dz) <= PLAYER_CONFIG.LANE_SNAP_TOLERANCE && Math.abs(dz) > 0.001) {
        const nudge = Math.sign(dz) * Math.min(Math.abs(dz), ALIGN_SPEED * deltaTime);
        if (this.isPositionValid(currentX, currentZ + nudge, extraAABBs)) {
          currentZ += nudge;
        }
      }
    }

    // 2. Sub-step Movement
    const maxSubstep = PLAYER_CONFIG.MAX_SUBSTEP;
    const steps = Math.max(1, Math.ceil(distance / maxSubstep));
    const stepDist = distance / steps;

    let dirX = 0;
    let dirZ = 0;
    if (dir === Direction.NORTH) dirZ = 1;
    else if (dir === Direction.SOUTH) dirZ = -1;
    else if (dir === Direction.EAST) dirX = 1;
    else if (dir === Direction.WEST) dirX = -1;

    let movedAny = false;

    for (let i = 0; i < steps; i++) {
      const nextX = currentX + dirX * stepDist;
      const nextZ = currentZ + dirZ * stepDist;

      if (this.isPositionValid(nextX, nextZ, extraAABBs)) {
        currentX = nextX;
        currentZ = nextZ;
        movedAny = true;
      } else {
        // Blocked along primary direction - stop immediately without sliding or bouncing
        break;
      }
    }

    return { x: currentX, z: currentZ, moved: movedAny };
  }
}
