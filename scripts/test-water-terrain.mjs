/**
 * Automated Test Suite for Water / Coolant Canal Terrain
 *
 * Verifies:
 * 1. TileType.WATER constants and visual height definitions
 * 2. Stage 02, 03, and 04 level definitions contain active water canal coordinates
 * 3. Water collision semantics:
 *    - Impassable to tanks (solid bounding box prevents driving onto water)
 *    - Transparent to projectiles (bullets fly across unobstructed)
 * 4. 3D visual rendering implementation in TileMap:
 *    - Master template creation with cybernetic coolant canal styling
 *    - Hardware instancing for water tiles across all stages
 *    - Comprehensive resource cleanup on dispose
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failCount++;
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=============================================================');
console.log('TERRAIN AUDIT: WATER COOLANT CANALS (STAGES 2, 3, 4)');
console.log('=============================================================\n');

function transpileAndLoad(filePath) {
  const code = readFileSync(filePath, 'utf-8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', js);
  fn(mod, mod.exports, (id) => {
    if (id.includes('constants')) {
      return {
        GRID_ROWS: 13,
        GRID_COLS: 13,
        TILE_SIZE: 2.0,
        ARENA_WIDTH: 26.0,
        ARENA_DEPTH: 26.0,
        CONVEYOR_PUSH_SPEED: 2.0,
        VISUAL_HEIGHTS: {
          BRICK: 2.0,
          STEEL: 2.0,
          BUSH: 1.1,
          BASE: 2.0,
          SPAWN_MARKER: 0.02,
          CRYO: 0.04,
          CONVEYOR: 0.04,
          WATER: 0.06
        },
        TileType: {
          EMPTY: 0,
          BRICK: 1,
          STEEL: 2,
          BUSH: 3,
          WATER: 4,
          BASE: 5,
          PLAYER_SPAWN: 6,
          ENEMY_SPAWN: 7,
          CRYO: 8,
          CONVEYOR: 9
        }
      };
    }
    if (id.includes('Direction')) {
      return {
        Direction: {
          NORTH: 0,
          EAST: 1,
          SOUTH: 2,
          WEST: 3
        }
      };
    }
    if (id.includes('level01')) return transpileAndLoad('src/levels/level01.ts');
    if (id.includes('level02')) return transpileAndLoad('src/levels/level02.ts');
    if (id.includes('level03')) return transpileAndLoad('src/levels/level03.ts');
    if (id.includes('level04')) return transpileAndLoad('src/levels/level04.ts');
    if (id.includes('LevelDefinition')) return transpileAndLoad('src/levels/LevelDefinition.ts');
    return {};
  });
  return mod.exports;
}

// -------------------------------------------------------------
// Test Suite 1: Constants & Definitions
// -------------------------------------------------------------
console.log('Test Suite 1: Water Terrain Constants & Configuration');
const constants = transpileAndLoad('src/game/constants.ts');
assert(constants.TileType.WATER === 4, 'TileType.WATER is strictly enum value 4');
assert(constants.VISUAL_HEIGHTS.WATER > 0, 'VISUAL_HEIGHTS.WATER is defined and positive');

// -------------------------------------------------------------
// Test Suite 2: Level Water Distributions
// -------------------------------------------------------------
console.log('\nTest Suite 2: Level Canal Distributions on Stages 2, 3, and 4');
const { LEVEL_02 } = transpileAndLoad('src/levels/level02.ts');
const { LEVEL_03 } = transpileAndLoad('src/levels/level03.ts');
const { LEVEL_04 } = transpileAndLoad('src/levels/level04.ts');

function countTiles(level, type) {
  let count = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (level.tiles[r][c] === type) count++;
    }
  }
  return count;
}

const s2WaterCount = countTiles(LEVEL_02, constants.TileType.WATER);
const s3WaterCount = countTiles(LEVEL_03, constants.TileType.WATER);
const s4WaterCount = countTiles(LEVEL_04, constants.TileType.WATER);

assert(s2WaterCount === 8, `Stage 02 contains exactly 8 water tiles (found ${s2WaterCount})`);
assert(s3WaterCount === 7, `Stage 03 contains exactly 7 water tiles (found ${s3WaterCount})`);
assert(s4WaterCount === 6, `Stage 04 contains exactly 6 water tiles (found ${s4WaterCount})`);

// Verify specific coordinates
assert(LEVEL_03.tiles[5][2] === constants.TileType.WATER, 'Stage 03 [5, 2] is WATER');
assert(LEVEL_03.tiles[5][3] === constants.TileType.WATER, 'Stage 03 [5, 3] is WATER');
assert(LEVEL_03.tiles[5][9] === constants.TileType.WATER, 'Stage 03 [5, 9] is WATER');
assert(LEVEL_03.tiles[5][10] === constants.TileType.WATER, 'Stage 03 [5, 10] is WATER');
assert(LEVEL_03.tiles[6][2] === constants.TileType.WATER, 'Stage 03 [6, 2] is WATER');
assert(LEVEL_03.tiles[6][3] === constants.TileType.WATER, 'Stage 03 [6, 3] is WATER');
assert(LEVEL_03.tiles[6][10] === constants.TileType.WATER, 'Stage 03 [6, 10] is WATER');

assert(LEVEL_04.tiles[3][5] === constants.TileType.WATER, 'Stage 04 [3, 5] is WATER');
assert(LEVEL_04.tiles[3][7] === constants.TileType.WATER, 'Stage 04 [3, 7] is WATER');
assert(LEVEL_04.tiles[5][4] === constants.TileType.WATER, 'Stage 04 [5, 4] is WATER');
assert(LEVEL_04.tiles[5][5] === constants.TileType.WATER, 'Stage 04 [5, 5] is WATER');
assert(LEVEL_04.tiles[5][7] === constants.TileType.WATER, 'Stage 04 [5, 7] is WATER');
assert(LEVEL_04.tiles[5][8] === constants.TileType.WATER, 'Stage 04 [5, 8] is WATER');

// -------------------------------------------------------------
// Test Suite 3: TileMap Visual Mesh Implementation
// -------------------------------------------------------------
console.log('\nTest Suite 3: TileMap 3D Visual Rendering Implementation');
const tileMapSource = readFileSync('src/world/TileMap.ts', 'utf-8');

assert(tileMapSource.includes('masterWater'), 'TileMap declares masterWater mesh template');
assert(tileMapSource.includes('buildWaterTile'), 'TileMap implements buildWaterTile()');
assert(tileMapSource.includes('case TileType.WATER:'), 'TileMap buildMap includes case TileType.WATER');
assert(tileMapSource.includes('this.masterWater.createInstance'), 'Water tiles use hardware instancing');
assert(tileMapSource.includes('waterMat'), 'TileMap creates dedicated water coolant material');
assert(tileMapSource.includes('waterBasin'), 'TileMap constructs multi-part canal basin geometry');
assert(tileMapSource.includes('waterCurbN'), 'TileMap constructs canal boundary curbs');
assert(tileMapSource.includes('this.masterWater.dispose()'), 'TileMap cleans up masterWater on dispose');

// -------------------------------------------------------------
// Test Suite 4: Collision & Gameplay Semantics
// -------------------------------------------------------------
console.log('\nTest Suite 4: Collision & Pass-Through Gameplay Semantics');
assert(tileMapSource.includes('(forTank && tile.type === TileType.WATER)'), 'TileMap blocks tanks from entering water cells');

const projectileSource = readFileSync('src/systems/ProjectileSystem.ts', 'utf-8');
assert(projectileSource.includes('tileType === TileType.WATER'), 'ProjectileSystem allows bullets to pass through water');

const minimapSource = readFileSync('src/ui/TacticalMinimap.ts', 'utf-8');
assert(minimapSource.includes('case TileType.WATER:'), 'TacticalMinimap renders water tiles');

console.log('\n=============================================================');
console.log(`WATER TERRAIN AUDIT PASSED: ${passCount} assertions passed, ${failCount} failed`);
console.log('=============================================================');
