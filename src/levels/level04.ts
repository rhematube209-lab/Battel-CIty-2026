import { TileType } from '../game/constants';
import { Direction } from '../game/Direction';
import { LevelDefinition } from './LevelDefinition';

/**
 * Level 04: "Nexus Siege"
 * 13 x 13 high-security relay and network nexus combat arena.
 * First level combining Cryo ice and Mag-Drive Conveyor belts in one combat environment:
 * - West Midfield Relay Shunt: Row 4, Cols 3..5 (Direction.EAST) buffered by Cryo cells at [4, 2] and [4, 6]
 * - East Midfield Relay Shunt: Row 8, Cols 6..8 (Direction.EAST) delivering directly onto open floor
 * - West Flank Heavy Channel: Col 1, Rows 6..8 (Direction.SOUTH) fed from Cryo [5, 1] and spilling into Cryo [9, 1]
 * - East Flank Heavy Channel: Col 11, Rows 6..8 (Direction.SOUTH) fed from Cryo [5, 11] and spilling into Cryo [9, 11]
 * - Central Core Superconductor Nexus: Cryo cells at [6, 5] and [6, 7] flanking the hardened central pillar
 *
 * Row 0 is North (+Z, Enemy Spawns at cols 0, 6, 12).
 * Row 12 is South (-Z, Player Base at [12, 6], Player Spawn at [11, 4]).
 */
export const LEVEL_04_TILES: TileType[][] = [
  // Row 0: North spawn line with hardened security blast gates
  [
    TileType.ENEMY_SPAWN, TileType.EMPTY, TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.EMPTY,
    TileType.ENEMY_SPAWN,
    TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.BRICK, TileType.EMPTY, TileType.ENEMY_SPAWN
  ],

  // Row 1: Clearance transit lanes & reinforced funnel pillars
  [
    TileType.EMPTY, TileType.STEEL, TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.STEEL, TileType.EMPTY
  ],

  // Row 2: Lateral crossways and data terminal cells
  [
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK,
    TileType.BUSH,
    TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.BRICK
  ],

  // Row 3: Approach tier with coolant channels and sensor foliage
  [
    TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.BRICK, TileType.EMPTY, TileType.WATER,
    TileType.BUSH,
    TileType.WATER, TileType.EMPTY, TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 4: West Midfield Belt [4, 3..5] (EAST) with Cryo buffers [4, 2] & [4, 6]
  [
    TileType.BRICK, TileType.EMPTY, TileType.CRYO, TileType.CONVEYOR, TileType.CONVEYOR, TileType.CONVEYOR,
    TileType.CRYO,
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK
  ],

  // Row 5: Central Coolant Moat & Flank Cryo entry points [5, 1] & [5, 11]
  [
    TileType.EMPTY, TileType.CRYO, TileType.STEEL, TileType.EMPTY, TileType.WATER, TileType.WATER,
    TileType.BUSH,
    TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.STEEL, TileType.CRYO, TileType.EMPTY
  ],

  // Row 6: Central Core Superconductor Nexus [6, 5 & 6, 7 Cryo] & Flank Belts [6, 1 & 6, 11 SOUTH]
  [
    TileType.STEEL, TileType.CONVEYOR, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.CRYO,
    TileType.STEEL,
    TileType.CRYO, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.CONVEYOR, TileType.STEEL
  ],

  // Row 7: Flank Belts continuation [7, 1 & 7, 11 SOUTH] & midfield bypass
  [
    TileType.EMPTY, TileType.CONVEYOR, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY,
    TileType.BUSH,
    TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.CONVEYOR, TileType.EMPTY
  ],

  // Row 8: Flank Belts [8, 1 & 8, 11 SOUTH] & East Midfield Shunt [8, 6..8 EAST]
  [
    TileType.BRICK, TileType.CONVEYOR, TileType.EMPTY, TileType.BRICK, TileType.STEEL, TileType.EMPTY,
    TileType.CONVEYOR,
    TileType.CONVEYOR, TileType.CONVEYOR, TileType.EMPTY, TileType.EMPTY, TileType.CONVEYOR, TileType.BRICK
  ],

  // Row 9: Flank Cryo discharge basins [9, 1] & [9, 11]
  [
    TileType.EMPTY, TileType.CRYO, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.CRYO, TileType.EMPTY
  ],

  // Row 10: Southern defense approach tier
  [
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.BRICK
  ],

  // Row 11: Base perimeter crown with Player Spawn at [11, 4]
  [
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.PLAYER_SPAWN, TileType.BRICK,
    TileType.BRICK,
    TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY
  ],

  // Row 12: Command Node Bunker with Base at [12, 6]
  [
    TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK,
    TileType.BASE,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.STEEL
  ]
];

export const LEVEL_04: LevelDefinition = {
  id: 'level04',
  rows: 13,
  columns: 13,
  tiles: LEVEL_04_TILES,
  terrainMetadata: {
    conveyors: [
      // West Midfield Relay Shunt: Row 4, Cols 3..5 (EAST)
      { row: 4, column: 3, direction: Direction.EAST },
      { row: 4, column: 4, direction: Direction.EAST },
      { row: 4, column: 5, direction: Direction.EAST },

      // West Flank Heavy Channel: Col 1, Rows 6..8 (SOUTH)
      { row: 6, column: 1, direction: Direction.SOUTH },
      { row: 7, column: 1, direction: Direction.SOUTH },
      { row: 8, column: 1, direction: Direction.SOUTH },

      // East Flank Heavy Channel: Col 11, Rows 6..8 (SOUTH)
      { row: 6, column: 11, direction: Direction.SOUTH },
      { row: 7, column: 11, direction: Direction.SOUTH },
      { row: 8, column: 11, direction: Direction.SOUTH },

      // East Midfield Relay Shunt: Row 8, Cols 6..8 (EAST)
      { row: 8, column: 6, direction: Direction.EAST },
      { row: 8, column: 7, direction: Direction.EAST },
      { row: 8, column: 8, direction: Direction.EAST },
    ]
  }
};
