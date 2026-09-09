import { TileType } from '../game/constants';
import { Direction } from '../game/Direction';
import { LevelDefinition } from './LevelDefinition';

/**
 * Level 03: "Forge Line"
 * 13 x 13 industrial foundry combat arena featuring three Mag-Drive Conveyor belts:
 * - North-Midfield Rapid Shunt (Row 3, Cols 3..5, Direction.EAST)
 * - Central Core Artery (Row 6, Cols 7..9, Direction.WEST)
 * - West Flank Heavy Feeder (Rows 7..10, Col 1, Direction.SOUTH)
 *
 * Row 0 is North (+Z, Enemy Spawns).
 * Row 12 is South (-Z, Player Base & Spawn).
 */
export const LEVEL_03_TILES: TileType[][] = [
  // Row 0: North spawn line with foundry blast barriers
  [
    TileType.ENEMY_SPAWN, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.ENEMY_SPAWN,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.ENEMY_SPAWN
  ],

  // Row 1: Heavy steel machinery pillars & access lanes
  [
    TileType.EMPTY, TileType.STEEL, TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.STEEL, TileType.EMPTY
  ],

  // Row 2: Lateral crossways and reinforced storage cells
  [
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.BRICK
  ],

  // Row 3: Approach tier containing Belt 1 (North-Midfield Shunt: Eastward boost across midfield)
  [
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.CONVEYOR, TileType.CONVEYOR, TileType.CONVEYOR,
    TileType.STEEL,
    TileType.EMPTY, TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 4: Foundry furnace bypass corridors
  [
    TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.STEEL,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.BRICK
  ],

  // Row 5: Central coolant runoff channels with observation foliage
  [
    TileType.EMPTY, TileType.EMPTY, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.BRICK,
    TileType.BUSH,
    TileType.BRICK, TileType.EMPTY, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 6: Central Core containing Belt 2 (Westward industrial feed towards coolant canal)
  [
    TileType.STEEL, TileType.EMPTY, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.STEEL,
    TileType.BUSH,
    TileType.CONVEYOR, TileType.CONVEYOR, TileType.CONVEYOR, TileType.WATER, TileType.EMPTY, TileType.STEEL
  ],

  // Row 7: Belt 3 West Flank entry (Southward feeder channel)
  [
    TileType.EMPTY, TileType.CONVEYOR, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY,
    TileType.BUSH,
    TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 8: Belt 3 West Flank continuation through hardened corridor
  [
    TileType.BRICK, TileType.CONVEYOR, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK
  ],

  // Row 9: Belt 3 West Flank continuation passing mid-south junction
  [
    TileType.EMPTY, TileType.CONVEYOR, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 10: Belt 3 West Flank terminal chute delivering into base approach sector
  [
    TileType.BRICK, TileType.CONVEYOR, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.BRICK
  ],

  // Row 11: Base crown (steel corners + brick gate) and Player Spawn at [11, 4]
  [
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.PLAYER_SPAWN, TileType.BRICK,
    TileType.BRICK,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 12: Southern fortress perimeter and Command Base at [12, 6]
  [
    TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK,
    TileType.BASE,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.STEEL
  ]
];

export const LEVEL_03: LevelDefinition = {
  id: 'level03',
  rows: 13,
  columns: 13,
  tiles: LEVEL_03_TILES,
  terrainMetadata: {
    conveyors: [
      // Belt 1: North-Midfield Rapid Shunt (Row 3, EAST)
      { row: 3, column: 3, direction: Direction.EAST },
      { row: 3, column: 4, direction: Direction.EAST },
      { row: 3, column: 5, direction: Direction.EAST },

      // Belt 2: Central Core Artery (Row 6, WEST)
      { row: 6, column: 7, direction: Direction.WEST },
      { row: 6, column: 8, direction: Direction.WEST },
      { row: 6, column: 9, direction: Direction.WEST },

      // Belt 3: West Flank Heavy Feeder (Rows 7..10, Col 1, SOUTH)
      { row: 7, column: 1, direction: Direction.SOUTH },
      { row: 8, column: 1, direction: Direction.SOUTH },
      { row: 9, column: 1, direction: Direction.SOUTH },
      { row: 10, column: 1, direction: Direction.SOUTH }
    ]
  }
};
