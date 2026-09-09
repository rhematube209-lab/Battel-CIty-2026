import { TileType } from '../game/constants';
import { LevelDefinition } from './LevelDefinition';

/**
 * Level 01: "Cyber Outpost"
 * 13 x 13 combat maze adhering to classic arcade principles with original layout.
 *
 * Row 0 is North (+Z, Enemy Spawns).
 * Row 12 is South (-Z, Player Base & Spawn).
 */
export const LEVEL_01_TILES: TileType[][] = [
  // Row 0: Enemy spawn line with open corridors
  [
    TileType.ENEMY_SPAWN, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.ENEMY_SPAWN,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.ENEMY_SPAWN
  ],

  // Row 1: Clearance transit lane
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 2: Tactical pillars with central steel reinforcement
  [
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.BRICK,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.BRICK
  ],

  // Row 3: Horizontal maneuvering artery
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 4: Mid-field flank barricades
  [
    TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.BRICK
  ],

  // Row 5: Tactical foliage & central combat zone
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BUSH, TileType.BUSH,
    TileType.EMPTY,
    TileType.BUSH, TileType.BUSH, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 6: Center arena with flank steel plates & central cover
  [
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BUSH, TileType.BUSH,
    TileType.EMPTY,
    TileType.BUSH, TileType.BUSH, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL
  ],

  // Row 7: Lower maneuvering corridor
  [
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 8: Defense posts
  [
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.BRICK
  ],

  // Row 9: Southern approach lanes
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 10: Outer base perimeter
  [
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK,
    TileType.BRICK,
    TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.BRICK
  ],

  // Row 11: Player spawn and base protective roof
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.PLAYER_SPAWN, TileType.BRICK,
    TileType.BRICK,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 12: Base bunker and corner pillars
  [
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK,
    TileType.BASE,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK
  ]
];

export const LEVEL_01: LevelDefinition = {
  id: 'level01',
  rows: 13,
  columns: 13,
  tiles: LEVEL_01_TILES,
};
