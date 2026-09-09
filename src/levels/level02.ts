import { TileType } from '../game/constants';
import { LevelDefinition } from './LevelDefinition';

/**
 * Level 02: "Iron Delta"
 * 13 x 13 tactical combat maze featuring twin water firing lanes,
 * reinforced steel chokepoints, central delta bush crossings,
 * and a reinforced pillbox command base defense.
 *
 * Row 0 is North (+Z, Enemy Spawns).
 * Row 12 is South (-Z, Player Base & Spawn).
 */
export const LEVEL_02_TILES: TileType[][] = [
  // Row 0: North spawn line with tactical brick cover
  [
    TileType.ENEMY_SPAWN, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY,
    TileType.ENEMY_SPAWN,
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.ENEMY_SPAWN
  ],

  // Row 1: Clearance transit lanes & steel funnel pillars
  [
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 2: Hardened flank towers & lateral paths
  [
    TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK
  ],

  // Row 3: Approach corridors guiding tanks toward land crossings
  [
    TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 4: Wide pre-delta maneuvering tier (West River Cryo [4, 1] & East Artery Cryo [4, 8..11])
  [
    TileType.BRICK, TileType.CRYO, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.STEEL,
    TileType.EMPTY,
    TileType.STEEL, TileType.CRYO, TileType.CRYO, TileType.CRYO, TileType.CRYO, TileType.BRICK
  ],

  // Row 5: The Iron Delta (North Bank) - Twin water channels with sniper firing lanes (West River Cryo [5, 1])
  [
    TileType.EMPTY, TileType.CRYO, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.BRICK,
    TileType.BUSH,
    TileType.BRICK, TileType.EMPTY, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 6: The Iron Delta (South Bank) - Water continuation, central bush crossing & steel anchors (West River Cryo [6, 1])
  [
    TileType.STEEL, TileType.CRYO, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.STEEL,
    TileType.BUSH,
    TileType.STEEL, TileType.EMPTY, TileType.WATER, TileType.WATER, TileType.EMPTY, TileType.STEEL
  ],

  // Row 7: Delta southern crossing exits & central foliage cover
  [
    TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY,
    TileType.BUSH,
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 8: Mid-south defensive line
  [
    TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.BRICK
  ],

  // Row 9: High-speed lateral arterial transit lane
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.STEEL, TileType.EMPTY,
    TileType.EMPTY,
    TileType.EMPTY, TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 10: Outer base perimeter bunkers
  [
    TileType.BRICK, TileType.STEEL, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.BRICK,
    TileType.EMPTY,
    TileType.BRICK, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL, TileType.BRICK
  ],

  // Row 11: Base crown (steel corners + brick gate) and Player Spawn at [11, 8]
  [
    TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.EMPTY, TileType.STEEL,
    TileType.BRICK,
    TileType.STEEL, TileType.PLAYER_SPAWN, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY
  ],

  // Row 12: Southern fortress line and Command Base at [12, 6]
  [
    TileType.STEEL, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.BRICK, TileType.BRICK,
    TileType.BASE,
    TileType.BRICK, TileType.BRICK, TileType.EMPTY, TileType.EMPTY, TileType.EMPTY, TileType.STEEL
  ]
];

export const LEVEL_02: LevelDefinition = {
  id: 'level02',
  rows: 13,
  columns: 13,
  tiles: LEVEL_02_TILES,
};
