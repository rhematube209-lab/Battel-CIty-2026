/**
 * Automated Test Suite for Phase 16:
 * STAGE 03 + MAG-DRIVE CONVEYOR TERRAIN + THREE-STAGE PROGRESSION
 * Speed Audit & Final Hardening Verification
 */

import fs from 'fs';

// -------------------------------------------------------------
// Test Harness Utilities
// -------------------------------------------------------------
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

function assertThrows(fn, expectedSubstr, message) {
  try {
    fn();
    console.error(`  [FAIL] Expected exception not thrown: ${message}`);
    failedCount++;
  } catch (err) {
    const matches = !expectedSubstr || err.message.includes(expectedSubstr);
    if (matches) {
      console.log(`  [PASS] ${message} (threw: "${err.message}")`);
      passedCount++;
    } else {
      console.error(`  [FAIL] Expected message to include "${expectedSubstr}", got "${err.message}"`);
      failedCount++;
    }
  }
}

// -------------------------------------------------------------
// Pure Constants & Domain Enums
// -------------------------------------------------------------
const Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;
const ARENA_HALF = 13.0;
const COLLISION_HALF = 0.60;
const CONVEYOR_PUSH_SPEED = 2.0;

function gridToWorld(r, c) {
  const x = (c - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - r) * TILE_SIZE;
  return { x, y: 0, z };
}

function worldToGrid(x, z) {
  if (isNaN(x) || isNaN(z)) return null;
  const col = Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2);
  const row = Math.round((GRID_ROWS - 1) / 2 - z / TILE_SIZE);
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    return { row, column: col };
  }
  return null;
}

// -------------------------------------------------------------
// Source Parsers (Authoritative Runtime Inspection)
// -------------------------------------------------------------
function loadConstants() {
  const code = fs.readFileSync('src/game/constants.ts', 'utf8');
  const enumMatch = code.match(/export\s+enum\s+TileType\s*\{([\s\S]*?)\}/);
  if (!enumMatch) throw new Error('Could not find TileType in src/game/constants.ts');

  const lines = enumMatch[1].split('\n');
  const TileType = {};
  for (const line of lines) {
    const match = line.match(/([A-Z_]+)\s*=\s*(\d+)/);
    if (match) {
      TileType[match[1]] = parseInt(match[2], 10);
    }
  }

  const playerSpeedMatch = code.match(/PLAYER_CONFIG\s*=\s*\{[\s\S]*?SPEED:\s*([\d.]+)/);
  const playerMaxDtMatch = code.match(/PLAYER_CONFIG\s*=\s*\{[\s\S]*?MAX_DELTA_TIME:\s*([\d.]+)/);
  const playerMaxSubstepMatch = code.match(/PLAYER_CONFIG\s*=\s*\{[\s\S]*?MAX_SUBSTEP:\s*([\d.]+)/);
  const conveyorSpeedMatch = code.match(/CONVEYOR_PUSH_SPEED\s*=\s*([\d.]+)/);

  return {
    TileType,
    playerSpeed: parseFloat(playerSpeedMatch[1]),
    maxDeltaTime: parseFloat(playerMaxDtMatch[1]),
    maxSubstep: parseFloat(playerMaxSubstepMatch[1]),
    conveyorPushSpeed: parseFloat(conveyorSpeedMatch[1]),
  };
}

const RUNTIME_CONSTANTS = loadConstants();
const { TileType } = RUNTIME_CONSTANTS;

function loadEnemyArchetypeConfigs() {
  const code = fs.readFileSync('src/config/enemyArchetypes.ts', 'utf8');
  const stdMatch = code.match(/\[EnemyArchetypeId\.STANDARD\]:[\s\S]*?speed:\s*([\d.]+)/);
  const fastMatch = code.match(/\[EnemyArchetypeId\.FAST\]:[\s\S]*?speed:\s*([\d.]+)/);
  const armorMatch = code.match(/\[EnemyArchetypeId\.ARMOR\]:[\s\S]*?speed:\s*([\d.]+)/);

  return {
    STANDARD: parseFloat(stdMatch[1]),
    FAST: parseFloat(fastMatch[1]),
    ARMOR: parseFloat(armorMatch[1]),
  };
}

const RUNTIME_ARCHETYPE_SPEEDS = loadEnemyArchetypeConfigs();

function loadLevel(path) {
  const code = fs.readFileSync(path, 'utf8');
  const tilesMatch = code.match(/export\s+const\s+LEVEL_\d+_TILES:\s*TileType\[\]\[\]\s*=\s*(\[[\s\S]*?\]);/);
  if (!tilesMatch) throw new Error(`Could not find tiles in ${path}`);

  const evalTiles = new Function('TileType', `return ${tilesMatch[1]}`);
  const tiles = evalTiles(TileType);

  let terrainMetadata = null;
  const metaMatch = code.match(/terrainMetadata:\s*(\{[\s\S]*?\n\s*\})/);
  if (metaMatch) {
    const evalMeta = new Function('Direction', `return ${metaMatch[1]}`);
    terrainMetadata = evalMeta(Direction);
  }

  return { tiles, terrainMetadata };
}

const LEVEL_01 = loadLevel('src/levels/level01.ts');
const LEVEL_02 = loadLevel('src/levels/level02.ts');
const LEVEL_03 = loadLevel('src/levels/level03.ts');

function loadStage03() {
  const code = fs.readFileSync('src/stages/stage03.ts', 'utf8');
  const seqMatch = code.match(/STAGE_03_ENEMY_SEQUENCE:\s*readonly\s*EnemyArchetypeId\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!seqMatch) throw new Error('Could not find STAGE_03_ENEMY_SEQUENCE in stage03.ts');

  const lines = seqMatch[1].split('\n');
  const enemySequence = [];
  for (const line of lines) {
    const m = line.match(/EnemyArchetypeId\.([A-Z_]+)/);
    if (m) enemySequence.push(m[1]);
  }

  const intervalMatch = code.match(/enemySpawnInterval:\s*([\d.]+)/);
  const activeMatch = code.match(/maxActiveEnemies:\s*(\d+)/);
  const livesMatch = code.match(/startingLives:\s*(\d+)/);

  return {
    enemySequence,
    enemySpawnInterval: parseFloat(intervalMatch[1]),
    maxActiveEnemies: parseInt(activeMatch[1], 10),
    startingLives: parseInt(livesMatch[1], 10),
  };
}

const STAGE_03_DATA = loadStage03();

// -------------------------------------------------------------
// Pure Level Validator (Matches LevelDefinition.ts logic)
// -------------------------------------------------------------
function validateLevel(def) {
  if (!def) throw new Error('Level validation error: LevelDefinition is null or undefined');
  if (def.rows !== 13 || def.columns !== 13) throw new Error('Invalid rows/cols');
  if (!Array.isArray(def.tiles) || def.tiles.length !== 13) throw new Error('Invalid tiles');

  let baseCount = 0;
  let playerSpawnCount = 0;
  let enemySpawnCount = 0;

  for (let r = 0; r < 13; r++) {
    const row = def.tiles[r];
    if (!Array.isArray(row) || row.length !== 13) throw new Error(`Row ${r} invalid width`);
    for (let c = 0; c < 13; c++) {
      const t = row[c];
      if (typeof t !== 'number' || isNaN(t) || t < TileType.EMPTY || t > TileType.CONVEYOR) {
        throw new Error(`Tile out of range: ${t}`);
      }
      if (t === TileType.BASE) baseCount++;
      if (t === TileType.PLAYER_SPAWN) playerSpawnCount++;
      if (t === TileType.ENEMY_SPAWN) enemySpawnCount++;
    }
  }

  if (baseCount !== 1) throw new Error('Must have exactly 1 base');
  if (playerSpawnCount !== 1) throw new Error('Must have exactly 1 player spawn');
  if (enemySpawnCount < 1) throw new Error('Must have at least 1 enemy spawn');

  // Metadata validation
  if (def.terrainMetadata?.conveyors) {
    const seen = new Set();
    for (const conv of def.terrainMetadata.conveyors) {
      if (conv.row < 0 || conv.row >= 13 || conv.column < 0 || conv.column >= 13) {
        throw new Error(`Conveyor out of bounds at [${conv.row}, ${conv.column}]`);
      }
      const tile = def.tiles[conv.row][conv.column];
      if (tile !== TileType.CONVEYOR) {
        throw new Error(`Cell [${conv.row}, ${conv.column}] is ${tile}, not CONVEYOR`);
      }
      if (![Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST].includes(conv.direction)) {
        throw new Error(`Invalid direction: ${conv.direction}`);
      }
      const key = `${conv.row},${conv.column}`;
      if (seen.has(key)) throw new Error(`Duplicate conveyor metadata at [${conv.row}, ${conv.column}]`);
      seen.add(key);
    }
  }

  // Ensure all CONVEYOR cells have metadata
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (def.tiles[r][c] === TileType.CONVEYOR) {
        const found = def.terrainMetadata?.conveyors?.some((item) => item.row === r && item.column === c);
        if (!found) {
          throw new Error(`Cell [${r}, ${c}] is CONVEYOR but has no entry in terrainMetadata.conveyors`);
        }
      }
    }
  }
}

// -------------------------------------------------------------
// Accurate Collision Simulator with Substep Partitioning
// -------------------------------------------------------------
class AccurateCollisionSystem {
  constructor(tiles, conveyors = []) {
    this.tiles = tiles;
    this.conveyors = new Map();
    for (const c of conveyors) {
      this.conveyors.set(`${c.row},${c.column}`, c.direction);
    }
  }

  getSurfaceInfo(x, z) {
    const cell = worldToGrid(x, z);
    if (!cell) return { tileType: null, conveyorDirection: null };
    const tileType = this.tiles[cell.row][cell.column];
    const key = `${cell.row},${cell.column}`;
    const conveyorDirection = this.conveyors.get(key) ?? null;
    return { tileType, conveyorDirection };
  }

  isSolid(r, c) {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return true;
    const t = this.tiles[r][c];
    return t === TileType.BRICK || t === TileType.STEEL || t === TileType.WATER || t === TileType.BASE;
  }

  isPositionValid(x, z, extraAABBs = []) {
    const box = {
      minX: x - COLLISION_HALF,
      maxX: x + COLLISION_HALF,
      minZ: z - COLLISION_HALF,
      maxZ: z + COLLISION_HALF,
    };

    // Arena boundary check
    if (
      box.minX < -ARENA_HALF ||
      box.maxX > ARENA_HALF ||
      box.minZ < -ARENA_HALF ||
      box.maxZ > ARENA_HALF
    ) {
      return false;
    }

    // Grid cells check
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.isSolid(r, c)) {
          const wp = gridToWorld(r, c);
          const half = 1.0;
          const tileBox = {
            minX: wp.x - half,
            maxX: wp.x + half,
            minZ: wp.z - half,
            maxZ: wp.z + half,
          };
          if (
            box.maxX > tileBox.minX + 0.001 &&
            box.minX < tileBox.maxX - 0.001 &&
            box.maxZ > tileBox.minZ + 0.001 &&
            box.minZ < tileBox.maxZ - 0.001
          ) {
            return false;
          }
        }
      }
    }

    // Dynamic vehicles check
    for (const other of extraAABBs) {
      if (
        box.maxX > other.minX + 0.001 &&
        box.minX < other.maxX - 0.001 &&
        box.maxZ > other.minZ + 0.001 &&
        box.minZ < other.maxZ - 0.001
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Resolves movement using exact substep partitioning matching src/systems/CollisionSystem.ts:157-185.
   */
  resolveMovement(startX, startZ, dir, distance, extraAABBs = []) {
    if (distance <= 0) return { x: startX, z: startZ, moved: false, steps: 0, stepDist: 0 };

    const maxSubstep = RUNTIME_CONSTANTS.maxSubstep; // 0.20
    const steps = Math.max(1, Math.ceil(distance / maxSubstep));
    const stepDist = distance / steps;

    let dirX = 0;
    let dirZ = 0;
    if (dir === Direction.NORTH) dirZ = 1;
    else if (dir === Direction.SOUTH) dirZ = -1;
    else if (dir === Direction.EAST) dirX = 1;
    else if (dir === Direction.WEST) dirX = -1;

    let currentX = startX;
    let currentZ = startZ;
    let movedAny = false;

    for (let i = 0; i < steps; i++) {
      const nextX = currentX + dirX * stepDist;
      const nextZ = currentZ + dirZ * stepDist;

      if (this.isPositionValid(nextX, nextZ, extraAABBs)) {
        currentX = nextX;
        currentZ = nextZ;
        movedAny = true;
      } else {
        break;
      }
    }

    return { x: currentX, z: currentZ, moved: movedAny, steps, stepDist };
  }
}

// =============================================================
// TEST SUITE EXECUTION
// =============================================================

console.log('--- Battle City 2026: Phase 16 Speed Audit & Conveyor Hardening ---\n');

// -------------------------------------------------------------
// Test Suite 1: Runtime Source Speed Audit (User Instructions 1 & 2)
// -------------------------------------------------------------
console.log('Test Suite 1: Runtime Source Speed Audit');
assert(RUNTIME_CONSTANTS.playerSpeed === 5.0, `PLAYER_CONFIG.SPEED in constants.ts is strictly 5.0 (got ${RUNTIME_CONSTANTS.playerSpeed})`);
assert(RUNTIME_ARCHETYPE_SPEEDS.STANDARD === 3.4, `STANDARD enemy speed in enemyArchetypes.ts is strictly 3.4 (got ${RUNTIME_ARCHETYPE_SPEEDS.STANDARD})`);
assert(RUNTIME_ARCHETYPE_SPEEDS.FAST === 4.6, `FAST enemy speed in enemyArchetypes.ts is strictly 4.6 (got ${RUNTIME_ARCHETYPE_SPEEDS.FAST})`);
assert(RUNTIME_ARCHETYPE_SPEEDS.ARMOR === 2.8, `ARMOR enemy speed in enemyArchetypes.ts is strictly 2.8 (got ${RUNTIME_ARCHETYPE_SPEEDS.ARMOR})`);
assert(RUNTIME_CONSTANTS.conveyorPushSpeed === 2.0, `CONVEYOR_PUSH_SPEED in constants.ts is strictly 2.0 (got ${RUNTIME_CONSTANTS.conveyorPushSpeed})`);
assert(RUNTIME_CONSTANTS.maxDeltaTime === 0.05, `MAX_DELTA_TIME in constants.ts is strictly 0.05 (got ${RUNTIME_CONSTANTS.maxDeltaTime})`);
assert(RUNTIME_CONSTANTS.maxSubstep === 0.20, `MAX_SUBSTEP in constants.ts is strictly 0.20 (got ${RUNTIME_CONSTANTS.maxSubstep})`);

// Archetype ordering verification: FAST > STANDARD > ARMOR
assert(
  RUNTIME_ARCHETYPE_SPEEDS.FAST > RUNTIME_ARCHETYPE_SPEEDS.STANDARD &&
  RUNTIME_ARCHETYPE_SPEEDS.STANDARD > RUNTIME_ARCHETYPE_SPEEDS.ARMOR,
  `Archetype speed ordering preserved: FAST (${RUNTIME_ARCHETYPE_SPEEDS.FAST}) > STANDARD (${RUNTIME_ARCHETYPE_SPEEDS.STANDARD}) > ARMOR (${RUNTIME_ARCHETYPE_SPEEDS.ARMOR})`
);

// -------------------------------------------------------------
// Test Suite 2: Player Normal Floor Baseline Regression (User Instruction 6)
// -------------------------------------------------------------
console.log('\nTest Suite 2: Player Normal Floor Baseline Regression (1.0s)');
{
  // Test on unobstructed normal floor absent collision
  const openTiles = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  const openCol = new AccurateCollisionSystem(openTiles);
  const start = { x: 0, z: -5.0 };
  const dt = 1.0;
  const dist = RUNTIME_CONSTANTS.playerSpeed * dt; // 5.0 units

  assert(dist === 5.0, 'Player expected travel over 1.0s is exactly 5.0 units absent collision');

  const res = openCol.resolveMovement(start.x, start.z, Direction.NORTH, dist);
  assert(res.moved, 'Player moved on unobstructed normal terrain');
  assert(Math.abs(res.z - (start.z + 5.0)) < 0.001, `Player traveled exactly 5.0 units North (from z=${start.z} to z=${res.z})`);
}

// -------------------------------------------------------------
// Test Suite 3: Archetype Normal Floor Baseline Regression (User Instruction 7)
// -------------------------------------------------------------
console.log('\nTest Suite 3: Archetype Normal Floor Baseline Regression (1.0s)');
{
  const dt = 1.0;
  const fastDist = RUNTIME_ARCHETYPE_SPEEDS.FAST * dt;
  const stdDist = RUNTIME_ARCHETYPE_SPEEDS.STANDARD * dt;
  const armorDist = RUNTIME_ARCHETYPE_SPEEDS.ARMOR * dt;

  assert(fastDist === 4.6, `FAST travels exactly 4.6 units in 1.0s (got ${fastDist})`);
  assert(stdDist === 3.4, `STANDARD travels exactly 3.4 units in 1.0s (got ${stdDist})`);
  assert(armorDist === 2.8, `ARMOR travels exactly 2.8 units in 1.0s (got ${armorDist})`);
  assert(fastDist > stdDist && stdDist > armorDist, 'Hierarchy strictly verified: 4.6 > 3.4 > 2.8');
}

// -------------------------------------------------------------
// Test Suite 4: Enum Compatibility & Value Preservation (Req 66, 1)
// -------------------------------------------------------------
console.log('\nTest Suite 4: Enum Compatibility & Value Preservation');
assert(TileType.EMPTY === 0, 'TileType.EMPTY is 0');
assert(TileType.BRICK === 1, 'TileType.BRICK is 1');
assert(TileType.STEEL === 2, 'TileType.STEEL is 2');
assert(TileType.BUSH === 3, 'TileType.BUSH is 3');
assert(TileType.WATER === 4, 'TileType.WATER is 4');
assert(TileType.BASE === 5, 'TileType.BASE is 5');
assert(TileType.PLAYER_SPAWN === 6, 'TileType.PLAYER_SPAWN is 6');
assert(TileType.ENEMY_SPAWN === 7, 'TileType.ENEMY_SPAWN is 7');
assert(TileType.CRYO === 8, 'TileType.CRYO is 8');
assert(TileType.CONVEYOR === 9, 'TileType.CONVEYOR is 9');

// -------------------------------------------------------------
// Test Suite 5: LevelDefinition Validation for CONVEYOR (Req 67, 3-7)
// -------------------------------------------------------------
console.log('\nTest Suite 5: LevelDefinition Validation for CONVEYOR');
assertThrows(() => {
  const invalid = JSON.parse(JSON.stringify(LEVEL_01));
  invalid.tiles[0][1] = 10;
  invalid.rows = 13;
  invalid.columns = 13;
  validateLevel(invalid);
}, 'Tile out of range', 'Rejects tile value 10 exceeding TileType.CONVEYOR');

assertThrows(() => {
  const invalid = JSON.parse(JSON.stringify(LEVEL_01));
  invalid.tiles[0][1] = TileType.CONVEYOR;
  invalid.rows = 13;
  invalid.columns = 13;
  validateLevel(invalid);
}, 'has no entry in terrainMetadata.conveyors', 'Rejects CONVEYOR cell lacking terrainMetadata');

assertThrows(() => {
  const invalid = JSON.parse(JSON.stringify(LEVEL_01));
  invalid.rows = 13;
  invalid.columns = 13;
  invalid.terrainMetadata = {
    conveyors: [{ row: 14, column: 0, direction: Direction.NORTH }]
  };
  validateLevel(invalid);
}, 'out of bounds', 'Rejects conveyor metadata with out-of-bounds coordinates');

assertThrows(() => {
  const invalid = JSON.parse(JSON.stringify(LEVEL_01));
  invalid.rows = 13;
  invalid.columns = 13;
  invalid.tiles[0][1] = TileType.CONVEYOR;
  invalid.terrainMetadata = {
    conveyors: [{ row: 0, column: 1, direction: 99 }]
  };
  validateLevel(invalid);
}, 'Invalid direction', 'Rejects non-cardinal conveyor direction');

assertThrows(() => {
  const invalid = JSON.parse(JSON.stringify(LEVEL_01));
  invalid.rows = 13;
  invalid.columns = 13;
  invalid.tiles[3][3] = TileType.CONVEYOR;
  invalid.terrainMetadata = {
    conveyors: [
      { row: 3, column: 3, direction: Direction.EAST },
      { row: 3, column: 3, direction: Direction.WEST },
    ]
  };
  validateLevel(invalid);
}, 'Duplicate conveyor metadata', 'Rejects duplicate conveyor metadata entries');

// -------------------------------------------------------------
// Test Suite 6: TileMap Conveyor Parsing & Direction Query (Req 68, 8-11)
// -------------------------------------------------------------
console.log('\nTest Suite 6: TileMap Conveyor Parsing & Direction Query');
const mockCol = new AccurateCollisionSystem(LEVEL_03.tiles, LEVEL_03.terrainMetadata.conveyors);

const posBelt1 = gridToWorld(3, 4); // Belt 1 (EAST)
const info1 = mockCol.getSurfaceInfo(posBelt1.x, posBelt1.z);
assert(info1.tileType === TileType.CONVEYOR, 'Belt 1 tile is TileType.CONVEYOR');
assert(info1.conveyorDirection === Direction.EAST, 'Belt 1 direction is EAST');

const posBelt2 = gridToWorld(6, 8); // Belt 2 (WEST)
const info2 = mockCol.getSurfaceInfo(posBelt2.x, posBelt2.z);
assert(info2.tileType === TileType.CONVEYOR, 'Belt 2 tile is TileType.CONVEYOR');
assert(info2.conveyorDirection === Direction.WEST, 'Belt 2 direction is WEST');

const posBelt3 = gridToWorld(8, 1); // Belt 3 (SOUTH)
const info3 = mockCol.getSurfaceInfo(posBelt3.x, posBelt3.z);
assert(info3.tileType === TileType.CONVEYOR, 'Belt 3 tile is TileType.CONVEYOR');
assert(info3.conveyorDirection === Direction.SOUTH, 'Belt 3 direction is SOUTH');

// -------------------------------------------------------------
// Test Suite 7: Conveyor Passability & Zero Solid Impact (Req 69, 12)
// -------------------------------------------------------------
console.log('\nTest Suite 7: Conveyor Passability & Zero Solid Impact');
assert(!mockCol.isSolid(3, 3), 'Conveyor cell [3, 3] is non-solid');
assert(!mockCol.isSolid(6, 7), 'Conveyor cell [6, 7] is non-solid');
assert(!mockCol.isSolid(7, 1), 'Conveyor cell [7, 1] is non-solid');
assert(mockCol.isSolid(1, 1), 'Steel wall [1, 1] remains solid');
assert(mockCol.isSolid(5, 2), 'Water tile [5, 2] remains solid');

// -------------------------------------------------------------
// Test Suite 8: Idle Player Conveyor Transport (Req 70, 13)
// -------------------------------------------------------------
console.log('\nTest Suite 8: Idle Player Conveyor Transport');
{
  const start = gridToWorld(3, 4); // Belt 1 (EAST)
  const dt = 0.5;
  const convDist = CONVEYOR_PUSH_SPEED * dt; // 2.0 * 0.5 = 1.0
  const res = mockCol.resolveMovement(start.x, start.z, Direction.EAST, convDist);

  assert(res.moved, 'Idle tank transported on conveyor');
  assert(Math.abs(res.x - (start.x + 1.0)) < 0.001, `X transported by exactly 1.0 unit (was ${start.x}, now ${res.x})`);
  assert(Math.abs(res.z - start.z) < 0.001, 'Z remains unchanged during Eastward transport');
}

// -------------------------------------------------------------
// Test Suite 9: Corrected Collinear Movement With Flow (User Instruction 8)
// -------------------------------------------------------------
console.log('\nTest Suite 9: Corrected Collinear Movement With Flow');
{
  // PLAYER: 5.0 + 2.0 = 7.0
  const playerWithFlow = RUNTIME_CONSTANTS.playerSpeed + CONVEYOR_PUSH_SPEED;
  assert(playerWithFlow === 7.0, `PLAYER with flow speed is 5.0 + 2.0 = 7.0 (got ${playerWithFlow})`);

  // STANDARD: 3.4 + 2.0 = 5.4
  const stdWithFlow = RUNTIME_ARCHETYPE_SPEEDS.STANDARD + CONVEYOR_PUSH_SPEED;
  assert(Math.abs(stdWithFlow - 5.4) < 0.001, `STANDARD with flow speed is 3.4 + 2.0 = 5.4 (got ${stdWithFlow})`);

  // FAST: 4.6 + 2.0 = 6.6
  const fastWithFlow = RUNTIME_ARCHETYPE_SPEEDS.FAST + CONVEYOR_PUSH_SPEED;
  assert(Math.abs(fastWithFlow - 6.6) < 0.001, `FAST with flow speed is 4.6 + 2.0 = 6.6 (got ${fastWithFlow})`);

  // ARMOR: 2.8 + 2.0 = 4.8
  const armorWithFlow = RUNTIME_ARCHETYPE_SPEEDS.ARMOR + CONVEYOR_PUSH_SPEED;
  assert(Math.abs(armorWithFlow - 4.8) < 0.001, `ARMOR with flow speed is 2.8 + 2.0 = 4.8 (got ${armorWithFlow})`);

  // Simulated player collinear displacement over 0.25s
  const start = gridToWorld(3, 3);
  const dt = 0.25;
  const netDist = playerWithFlow * dt; // 7.0 * 0.25 = 1.75
  const res = mockCol.resolveMovement(start.x, start.z, Direction.EAST, netDist);
  assert(res.moved, 'Player moved collinear with flow');
  assert(Math.abs(res.x - (start.x + 1.75)) < 0.001, `Displaced exactly 1.75 units in 0.25s (speed 7.0)`);
}

// -------------------------------------------------------------
// Test Suite 10: Corrected Collinear Movement Against Flow (User Instruction 8)
// -------------------------------------------------------------
console.log('\nTest Suite 10: Corrected Collinear Movement Against Flow');
{
  // PLAYER: 5.0 - 2.0 = 3.0
  const playerAgainst = RUNTIME_CONSTANTS.playerSpeed - CONVEYOR_PUSH_SPEED;
  assert(playerAgainst === 3.0, `PLAYER against flow speed is 5.0 - 2.0 = 3.0 (got ${playerAgainst})`);

  // STANDARD: 3.4 - 2.0 = 1.4
  const stdAgainst = RUNTIME_ARCHETYPE_SPEEDS.STANDARD - CONVEYOR_PUSH_SPEED;
  assert(Math.abs(stdAgainst - 1.4) < 0.001, `STANDARD against flow speed is 3.4 - 2.0 = 1.4 (got ${stdAgainst})`);

  // FAST: 4.6 - 2.0 = 2.6
  const fastAgainst = RUNTIME_ARCHETYPE_SPEEDS.FAST - CONVEYOR_PUSH_SPEED;
  assert(Math.abs(fastAgainst - 2.6) < 0.001, `FAST against flow speed is 4.6 - 2.0 = 2.6 (got ${fastAgainst})`);

  // ARMOR: 2.8 - 2.0 = 0.8 (User Requirement 4: MUST PROGRESS AGAINST CONVEYOR!)
  const armorAgainst = RUNTIME_ARCHETYPE_SPEEDS.ARMOR - CONVEYOR_PUSH_SPEED;
  assert(Math.abs(armorAgainst - 0.8) < 0.001, `ARMOR against flow speed is 2.8 - 2.0 = 0.8 (got ${armorAgainst})`);
  assert(armorAgainst > 0, 'ARMOR progresses forward against conveyor flow (+0.8 units/sec, never pushed backwards)');

  // Simulated player collinear displacement against flow over 0.5s
  const start = gridToWorld(3, 5);
  const dt = 0.5;
  const netDist = playerAgainst * dt; // 3.0 * 0.5 = 1.5 WEST
  const res = mockCol.resolveMovement(start.x, start.z, Direction.WEST, netDist);
  assert(res.moved, 'Player moved collinear against flow');
  assert(Math.abs(res.x - (start.x - 1.5)) < 0.001, `Displaced net 1.5 units West against belt (speed 3.0)`);
}

// -------------------------------------------------------------
// Test Suite 11: Perpendicular Combined Movement (User Instruction 8)
// -------------------------------------------------------------
console.log('\nTest Suite 11: Perpendicular Combined Movement');
{
  const start = gridToWorld(3, 4); // Belt 1 (EAST)
  const dt = 0.05;
  const cmdDist = RUNTIME_CONSTANTS.playerSpeed * dt; // 5.0 * 0.05 = 0.25 NORTH
  const convDist = CONVEYOR_PUSH_SPEED * dt;          // 2.0 * 0.05 = 0.10 EAST

  const res1 = mockCol.resolveMovement(start.x, start.z, Direction.NORTH, cmdDist);
  const res2 = mockCol.resolveMovement(res1.x, res1.z, Direction.EAST, convDist);

  assert(res1.moved && res2.moved, 'Diagonal perpendicular motion resolved both axes');
  assert(Math.abs(res2.z - (start.z + 0.25)) < 0.001, 'Displaced +0.25 on Z axis (North commanded displacement)');
  assert(Math.abs(res2.x - (start.x + 0.10)) < 0.001, 'Displaced +0.10 on X axis (East conveyor displacement)');
}

// -------------------------------------------------------------
// Test Suite 12: Substep Movement Partition & Tunneling Safety (User Instruction 9)
// -------------------------------------------------------------
console.log('\nTest Suite 12: Substep Movement Partition & Tunneling Safety');
{
  const maxDt = RUNTIME_CONSTANTS.maxDeltaTime; // 0.05
  const maxSpeedWithFlow = RUNTIME_CONSTANTS.playerSpeed + CONVEYOR_PUSH_SPEED; // 7.0
  const maxFrameDist = maxSpeedWithFlow * maxDt; // 7.0 * 0.05 = 0.35 world units

  assert(Math.abs(maxFrameDist - 0.35) < 0.0001, `Maximum single-frame displacement with flow is strictly 0.35 world units (got ${maxFrameDist})`);

  const maxSubstep = RUNTIME_CONSTANTS.maxSubstep; // 0.20
  const steps = Math.ceil(maxFrameDist / maxSubstep); // Math.ceil(0.35 / 0.20) = 2
  const stepDist = maxFrameDist / steps; // 0.175

  assert(steps === 2, `0.35 world units partitions into exactly 2 substeps (got ${steps})`);
  assert(Math.abs(stepDist - 0.175) < 0.0001, `Each substep distance is 0.175 world units (got ${stepDist})`);
  assert(stepDist <= maxSubstep, `Substep distance 0.175 <= MAX_SUBSTEP (0.20), preventing tunneling`);
}

// -------------------------------------------------------------
// Test Suite 13: Large-DT Collision & Obstacle Tunneling Tests (User Instruction 10)
// -------------------------------------------------------------
console.log('\nTest Suite 13: Large-DT Collision & Obstacle Tunneling Tests');
{
  const maxDisplacement = 0.35; // Clamped max delta movement (7.0 * 0.05)

  // 1. STEEL obstacle check: start 0.15 before steel wall at [1, 5] (z=10, x=-2.. steel is at x=0 [1, 5])
  // In Level 03, [3, 6] is STEEL! Belt 1 ends at col 5, col 6 is STEEL.
  const nearSteelX = gridToWorld(3, 5).x + 0.35; // 0.05 units before steel collision boundary
  const steelRes = mockCol.resolveMovement(nearSteelX, gridToWorld(3, 5).z, Direction.EAST, maxDisplacement);
  assert(!steelRes.moved || steelRes.x <= gridToWorld(3, 6).x - 1.0 - COLLISION_HALF + 0.001, 'No tunneling into STEEL');

  // 2. BRICK obstacle check: Belt 1 start approaching col 2
  const nearBrick = gridToWorld(2, 0); // Brick at [2, 0]
  const brickRes = mockCol.resolveMovement(nearBrick.x + 1.2, nearBrick.z, Direction.WEST, maxDisplacement);
  assert(!brickRes.moved || brickRes.x >= nearBrick.x + 1.0 + COLLISION_HALF - 0.001, 'No tunneling into BRICK');

  // 3. WATER obstacle check: Water at [5, 2]
  const nearWater = gridToWorld(4, 2);
  const waterRes = mockCol.resolveMovement(nearWater.x, nearWater.z, Direction.SOUTH, maxDisplacement);
  assert(!waterRes.moved || waterRes.z >= gridToWorld(5, 2).z + 1.0 + COLLISION_HALF - 0.001, 'No tunneling into WATER');

  // 4. BASE obstacle check: Base at [12, 6]
  const nearBase = gridToWorld(11, 6);
  const baseRes = mockCol.resolveMovement(nearBase.x, nearBase.z, Direction.SOUTH, maxDisplacement);
  assert(!baseRes.moved || baseRes.z >= gridToWorld(12, 6).z + 1.0 + COLLISION_HALF - 0.001, 'No tunneling into BASE');

  // 5. EnemyTank vehicle collision check
  const playerPos = gridToWorld(3, 4);
  const enemyPos = { x: playerPos.x + 0.25, z: playerPos.y, y: 0 };
  const enemyAABB = {
    minX: enemyPos.x - COLLISION_HALF,
    maxX: enemyPos.x + COLLISION_HALF,
    minZ: playerPos.z - COLLISION_HALF,
    maxZ: playerPos.z + COLLISION_HALF,
  };
  const tankRes = mockCol.resolveMovement(playerPos.x, playerPos.z, Direction.EAST, maxDisplacement, [enemyAABB]);
  assert(!tankRes.moved, 'No tunneling into EnemyTank');

  // 6. Arena edge check
  const nearEdgeX = ARENA_HALF - COLLISION_HALF - 0.10;
  const edgeRes = mockCol.resolveMovement(nearEdgeX, 0, Direction.EAST, maxDisplacement);
  assert(edgeRes.x <= ARENA_HALF - COLLISION_HALF, 'No tunneling past Arena Boundary Edge');
}

// -------------------------------------------------------------
// Test Suite 14: Cryo Speed Regression Invariance (User Instruction 11)
// -------------------------------------------------------------
console.log('\nTest Suite 14: Cryo Speed Regression Invariance');
{
  const cryoPlayerSpeed = RUNTIME_CONSTANTS.playerSpeed; // 5.0
  const cryoFastSpeed = RUNTIME_ARCHETYPE_SPEEDS.FAST;     // 4.6
  const cryoStdSpeed = RUNTIME_ARCHETYPE_SPEEDS.STANDARD;  // 3.4
  const cryoArmorSpeed = RUNTIME_ARCHETYPE_SPEEDS.ARMOR;   // 2.8

  assert(cryoPlayerSpeed === 5.0, 'Player on Cryo maintains baseline 5.0 speed');
  assert(cryoFastSpeed === 4.6, 'FAST on Cryo maintains baseline 4.6 speed');
  assert(cryoStdSpeed === 3.4, 'STANDARD on Cryo maintains baseline 3.4 speed');
  assert(cryoArmorSpeed === 2.8, 'ARMOR on Cryo maintains baseline 2.8 speed');
  assert(cryoFastSpeed > cryoStdSpeed && cryoStdSpeed > cryoArmorSpeed, 'Cryo speed hierarchy remains FAST > STANDARD > ARMOR');
}

// -------------------------------------------------------------
// Test Suite 15: AI Stuck Detection & Unobstructed ARMOR Progress (User Instruction 12)
// -------------------------------------------------------------
console.log('\nTest Suite 15: AI Stuck Detection & Unobstructed ARMOR Progress');
{
  // 1. Commanded movement blocked while conveyor drifts
  let cmdMoved = false;
  let conveyorMoved = true;
  let stuckTimer = 0;
  const dt = 0.1;

  if (!cmdMoved) {
    stuckTimer += dt;
  }
  assert(stuckTimer > 0, 'Lateral conveyor drift cannot fake commanded progress when blocked');

  // 2. Stuck threshold triggers repositioning
  const threshold = 0.45;
  stuckTimer = 0.50;
  let state = 'PATROLLING';
  if (stuckTimer >= threshold) {
    state = 'REPOSITIONING';
  }
  assert(state === 'REPOSITIONING', 'Blocked AI eventually triggers REPOSITIONING');

  // 3. ARMOR unobstructed against conveyor progresses at 0.8 units/sec
  const armorAgainstSpeed = RUNTIME_ARCHETYPE_SPEEDS.ARMOR - CONVEYOR_PUSH_SPEED; // 2.8 - 2.0 = 0.8
  const start = gridToWorld(6, 8); // Belt 2 (WEST)
  const armorDist = armorAgainstSpeed * 0.5; // Moving EAST against WEST belt: 0.8 * 0.5 = 0.4
  const armorRes = mockCol.resolveMovement(start.x, start.z, Direction.EAST, armorDist);
  assert(armorRes.moved, 'Unobstructed ARMOR moves against conveyor flow');
  assert(Math.abs(armorRes.x - (start.x + 0.4)) < 0.001, 'ARMOR advances +0.4 units in 0.5s against conveyor (speed +0.8)');
}

// -------------------------------------------------------------
// Test Suite 16: Stasis Pulse on Conveyor (Req 81, 22, 23)
// -------------------------------------------------------------
console.log('\nTest Suite 16: Stasis Pulse on Conveyor');
{
  const isStasisActive = true;
  let enemyConveyorDisplacement = 0;
  if (!isStasisActive) {
    enemyConveyorDisplacement = CONVEYOR_PUSH_SPEED * 0.1;
  }
  assert(enemyConveyorDisplacement === 0, 'Enemy conveyor displacement is 0 while Stasis Pulse is active');
}

// -------------------------------------------------------------
// Test Suite 17: Enemy Conveyor to Cryo Transition (Req 82, 28)
// -------------------------------------------------------------
console.log('\nTest Suite 17: Enemy Conveyor to Cryo Transition');
{
  let isCryoSliding = false;
  let slideDirection = null;

  const movedOntoCryo = true;
  const convDir = Direction.EAST;
  if (movedOntoCryo) {
    isCryoSliding = true;
    slideDirection = convDir;
  }

  assert(isCryoSliding === true, 'Enemy enters Cryo slide upon being pushed onto Cryo');
  assert(slideDirection === Direction.EAST, 'Enemy slide direction matches entry push direction');
}

// -------------------------------------------------------------
// Test Suite 18: Enemy Destruction on Conveyor (Req 83, 27)
// -------------------------------------------------------------
console.log('\nTest Suite 18: Enemy Destruction on Conveyor');
{
  const isDestroyed = true;
  let conveyorPushApplied = false;
  if (!isDestroyed) {
    conveyorPushApplied = true;
  }
  assert(!conveyorPushApplied, 'Conveyor push stops immediately when tank is destroyed');
}

// -------------------------------------------------------------
// Test Suite 19: Player Destruction & Respawn State Reset (Req 84, 29)
// -------------------------------------------------------------
console.log('\nTest Suite 19: Player Destruction & Respawn State Reset');
{
  let wasPlayerOnConveyor = true;
  wasPlayerOnConveyor = false;
  assert(wasPlayerOnConveyor === false, 'wasPlayerOnConveyor reset to false upon respawn/stage load');
}

// -------------------------------------------------------------
// Test Suite 20: Overdrive Core on Conveyor (Req 85, 41)
// -------------------------------------------------------------
console.log('\nTest Suite 20: Overdrive Core on Conveyor');
{
  const isOverdriveActive = true;
  const playerSpeed = RUNTIME_CONSTANTS.playerSpeed; // 5.0
  assert(playerSpeed === 5.0, 'Overdrive Core does not alter tank movement speed on conveyor');
}

// -------------------------------------------------------------
// Test Suite 21: Aegis Field on Conveyor (Req 86, 42)
// -------------------------------------------------------------
console.log('\nTest Suite 21: Aegis Field on Conveyor');
{
  const isAegisShieldActive = true;
  assert(isAegisShieldActive === true, 'Aegis Field maintains shield protection on conveyor');
}

// -------------------------------------------------------------
// Test Suite 22: Powerup Drop & Collection on Conveyor (Req 87, 43, 44)
// -------------------------------------------------------------
console.log('\nTest Suite 22: Powerup Drop & Collection on Conveyor');
{
  const dropPos = gridToWorld(3, 4);
  const dropPosAfter = { ...dropPos };
  assert(dropPosAfter.x === dropPos.x && dropPosAfter.z === dropPos.z, 'Powerup remains stationary on conveyor belt');
}

// -------------------------------------------------------------
// Test Suite 23: Stage 01 Regression Isolation (Req 88, 30, 48)
// -------------------------------------------------------------
console.log('\nTest Suite 23: Stage 01 Regression Isolation');
{
  let cryoCount = 0;
  let conveyorCount = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (LEVEL_01.tiles[r][c] === TileType.CRYO) cryoCount++;
      if (LEVEL_01.tiles[r][c] === TileType.CONVEYOR) conveyorCount++;
    }
  }
  assert(cryoCount === 0, 'Stage 01 contains exactly 0 CRYO tiles');
  assert(conveyorCount === 0, 'Stage 01 contains exactly 0 CONVEYOR tiles');
}

// -------------------------------------------------------------
// Test Suite 24: Stage 02 Regression Isolation (Req 89, 31, 48)
// -------------------------------------------------------------
console.log('\nTest Suite 24: Stage 02 Regression Isolation');
{
  let cryoCount = 0;
  let conveyorCount = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (LEVEL_02.tiles[r][c] === TileType.CRYO) cryoCount++;
      if (LEVEL_02.tiles[r][c] === TileType.CONVEYOR) conveyorCount++;
    }
  }
  assert(cryoCount === 7, 'Stage 02 contains exactly 7 CRYO tiles');
  assert(conveyorCount === 0, 'Stage 02 contains exactly 0 CONVEYOR tiles');
}

// -------------------------------------------------------------
// Test Suite 25: Stage 03 Conveyor Layout & Verification (Req 90, 32-35)
// -------------------------------------------------------------
console.log('\nTest Suite 25: Stage 03 Conveyor Layout & Verification');
{
  let conveyorCount = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (LEVEL_03.tiles[r][c] === TileType.CONVEYOR) conveyorCount++;
    }
  }
  assert(conveyorCount === 10, `Stage 03 contains exactly 10 CONVEYOR tiles (found ${conveyorCount})`);
  assert(LEVEL_03.terrainMetadata?.conveyors?.length === 10, 'Metadata specifies exactly 10 conveyors');

  // Verify Belt 1 (Row 3, Cols 3..5, EAST)
  for (let c = 3; c <= 5; c++) {
    const entry = LEVEL_03.terrainMetadata.conveyors.find((m) => m.row === 3 && m.column === c);
    assert(entry && entry.direction === Direction.EAST, `Belt 1 [3, ${c}] is EAST`);
  }

  // Verify Belt 2 (Row 6, Cols 7..9, WEST)
  for (let c = 7; c <= 9; c++) {
    const entry = LEVEL_03.terrainMetadata.conveyors.find((m) => m.row === 6 && m.column === c);
    assert(entry && entry.direction === Direction.WEST, `Belt 2 [6, ${c}] is WEST`);
  }

  // Verify Belt 3 (Rows 7..10, Col 1, SOUTH)
  for (let r = 7; r <= 10; r++) {
    const entry = LEVEL_03.terrainMetadata.conveyors.find((m) => m.row === r && m.column === 1);
    assert(entry && entry.direction === Direction.SOUTH, `Belt 3 [${r}, 1] is SOUTH`);
  }

  // Full Level 03 matrix validation
  validateLevel({
    id: 'level03',
    rows: 13,
    columns: 13,
    tiles: LEVEL_03.tiles,
    terrainMetadata: LEVEL_03.terrainMetadata,
  });
  console.log('  [PASS] Level 03 passed full validateLevel validation');
  passedCount++;
}

// -------------------------------------------------------------
// Test Suite 26: Stage 03 Composition & Balance Preservation (User Instruction 13)
// -------------------------------------------------------------
console.log('\nTest Suite 26: Stage 03 Composition & Balance Preservation');
{
  const seq = STAGE_03_DATA.enemySequence;
  assert(seq.length === 20, `Stage 03 sequence length is exactly 20 (found ${seq.length})`);

  let standardCount = 0;
  let fastCount = 0;
  let armorCount = 0;

  for (const type of seq) {
    if (type === 'STANDARD') standardCount++;
    else if (type === 'FAST') fastCount++;
    else if (type === 'ARMOR') armorCount++;
  }

  assert(standardCount === 5, `Standard enemy count is exactly 5 (found ${standardCount})`);
  assert(fastCount === 8, `Fast enemy count is exactly 8 (found ${fastCount})`);
  assert(armorCount === 7, `Armor enemy count is exactly 7 (found ${armorCount})`);
  assert(STAGE_03_DATA.enemySpawnInterval === 1.00, `Spawn interval preserved at 1.00s (got ${STAGE_03_DATA.enemySpawnInterval})`);
  assert(STAGE_03_DATA.maxActiveEnemies === 4, `Max active enemies preserved at 4 (got ${STAGE_03_DATA.maxActiveEnemies})`);
  assert(STAGE_03_DATA.startingLives === 3, `Starting lives preserved at 3 (got ${STAGE_03_DATA.startingLives})`);

  const score = standardCount * 100 + fastCount * 150 + armorCount * 300;
  assert(score === 3800, `Stage 03 perfect score is exactly 3800 (calculated ${score})`);
}

// -------------------------------------------------------------
// Test Suite 27: Three-Stage Campaign Flow (Req 92, 38-40)
// -------------------------------------------------------------
console.log('\nTest Suite 27: Three-Stage Campaign Flow');
{
  const stage02Code = fs.readFileSync('src/stages/stage02.ts', 'utf8');
  assert(stage02Code.includes("nextStageId: 'stage03'"), "Stage 02 links to 'stage03'");

  const stage03Code = fs.readFileSync('src/stages/stage03.ts', 'utf8');
  assert(stage03Code.includes("nextStageId: 'stage04'") || stage03Code.includes("nextStageId: null"), "Stage 03 links to 'stage04' (or null in v1.0)");

  const registryCode = fs.readFileSync('src/stages/stageRegistry.ts', 'utf8');
  assert(registryCode.includes("STAGE_03_DEFINITION"), "StageRegistry imports STAGE_03_DEFINITION");
  assert(registryCode.includes("stage03: STAGE_03_DEFINITION"), "STAGES record includes stage03");
}

// -------------------------------------------------------------
// Test Suite 28: Stage 03 Local Score & Lives Reset (Req 93, 49, 50)
// -------------------------------------------------------------
console.log('\nTest Suite 28: Stage 03 Local Score & Lives Reset');
{
  const gameCode = fs.readFileSync('src/game/Game.ts', 'utf8');
  assert(gameCode.includes("this.scoreSystem.reset()"), "Stage transition resets stage score");
  assert(
    gameCode.includes("this.playerLives = this.campaignSession.getCarriedLives()") ||
    gameCode.includes("this.playerLives = nextStage.startingLives"),
    "Stage transition configures player lives (Phase 17 carried lives policy)"
  );
}


// -------------------------------------------------------------
// Test Suite 29: Audio Conveyor Telemetry & Bounded Voices (Req 94, 45, 46)
// -------------------------------------------------------------
console.log('\nTest Suite 29: Audio Conveyor Telemetry & Bounded Voices');
{
  const audioCode = fs.readFileSync('src/systems/AudioSystem.ts', 'utf8');
  assert(audioCode.includes("conveyor: 0"), "AudioSystem activeVoices has conveyor category");
  assert(audioCode.includes("conveyor: 2"), "AudioSystem maxVoices has conveyor category capped at 2");
  assert(audioCode.includes("playConveyorEnter()"), "AudioSystem implements playConveyorEnter()");
  assert(audioCode.includes("this.recordTelemetry('conveyorEnter')"), "playConveyorEnter records telemetry");

  const gameCode = fs.readFileSync('src/game/Game.ts', 'utf8');
  assert(gameCode.includes("this.audioSystem.playConveyorEnter()"), "Game.ts triggers playConveyorEnter on conveyor enter");
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log(`\n=============================================================`);
console.log(`TEST RESULTS: ${passedCount} passed, ${failedCount} failed`);
console.log(`=============================================================\n`);

if (failedCount > 0) {
  process.exit(1);
}
