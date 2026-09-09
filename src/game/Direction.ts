/**
 * Cardinal Direction Representation for 4-Way Arcade Navigation
 */

export enum Direction {
  NORTH = 0,
  EAST = 1,
  SOUTH = 2,
  WEST = 3,
}

export interface DirectionVector {
  x: number;
  z: number;
}

/**
 * Returns normalized movement vector for the given cardinal direction.
 * NORTH: +Z, SOUTH: -Z, EAST: +X, WEST: -X.
 */
export function directionToVector(dir: Direction): DirectionVector {
  switch (dir) {
    case Direction.NORTH:
      return { x: 0, z: 1 };
    case Direction.EAST:
      return { x: 1, z: 0 };
    case Direction.SOUTH:
      return { x: 0, z: -1 };
    case Direction.WEST:
      return { x: -1, z: 0 };
  }
}

/**
 * Returns Y-axis rotation in radians corresponding to the cardinal direction.
 * NORTH (+Z): 0 rad (0°)
 * EAST  (+X): π/2 rad (90°)
 * SOUTH (-Z): π rad (180°)
 * WEST  (-X): -π/2 rad (270° / -90°)
 */
export function directionToRotation(dir: Direction): number {
  switch (dir) {
    case Direction.NORTH:
      return 0;
    case Direction.EAST:
      return Math.PI / 2;
    case Direction.SOUTH:
      return Math.PI;
    case Direction.WEST:
      return -Math.PI / 2;
  }
}

/**
 * Returns opposite cardinal direction.
 */
export function getOppositeDirection(dir: Direction): Direction {
  switch (dir) {
    case Direction.NORTH:
      return Direction.SOUTH;
    case Direction.SOUTH:
      return Direction.NORTH;
    case Direction.EAST:
      return Direction.WEST;
    case Direction.WEST:
      return Direction.EAST;
  }
}
