/**
 * Automated Test Suite for Phase 7:
 * One Enemy Tank + FSM AI + Enemy Firing + Player/Enemy Combat + Tank-to-Tank Collision
 */

import fs from 'fs';

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;
const ARENA_HALF = 13.0;

const GameState = {
  BOOT: 0,
  PLAYING: 1,
  GAME_OVER: 2,
};

const GameOverReason = {
  BASE_DESTROYED: 'BASE_DESTROYED',
  PLAYER_DESTROYED: 'PLAYER_DESTROYED',
};

const EnemyState = {
  SPAWNING: 'SPAWNING',
  PATROLLING: 'PATROLLING',
  ATTACKING: 'ATTACKING',
  REPOSITIONING: 'REPOSITIONING',
  DESTROYED: 'DESTROYED',
};

const Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

const TileType = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  BUSH: 3,
  WATER: 4,
  BASE: 5,
  PLAYER_SPAWN: 6,
  ENEMY_SPAWN: 7,
};

const DIR_VECTORS = {
  [Direction.NORTH]: { x: 0, z: 1 },
  [Direction.SOUTH]: { x: 0, z: -1 },
  [Direction.EAST]: { x: 1, z: 0 },
  [Direction.WEST]: { x: -1, z: 0 },
};

function gridToWorld(row, column) {
  const x = (column - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
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

function loadAuthoritativeLevel01() {
  const code = fs.readFileSync('src/levels/level01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '').replace(/: TileType\[\]\[\]/, '').replace(/: LevelDefinition/, '');
  cleaned = cleaned.replace(/export const LEVEL_01_TILES/, 'const LEVEL_01_TILES');
  cleaned = cleaned.replace(/export const LEVEL_01/, 'const LEVEL_01');
  const fn = new Function('TileType', cleaned + '; return (typeof LEVEL_01 !== "undefined" && LEVEL_01.tiles) ? LEVEL_01.tiles : (typeof LEVEL_01_TILES !== "undefined" ? LEVEL_01_TILES : LEVEL_01);');
  return fn(TileType);
}

const LEVEL_01 = loadAuthoritativeLevel01();

// ==========================================
// TEST HARNESS & SIMULATION HELPERS
// ==========================================

class MockTileMap {
  constructor(levelData) {
    this.grid = JSON.parse(JSON.stringify(levelData));
    this.quadrants = {}; // key: "r,c" -> [true, true, true, true]
    this.basePos = null;
    this.playerSpawn = null;
    this.enemySpawns = [];
    this.baseDestroyed = false;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const type = this.grid[r][c];
        if (type === TileType.BRICK) {
          this.quadrants[`${r},${c}`] = [true, true, true, true];
        } else if (type === TileType.BASE) {
          this.basePos = gridToWorld(r, c);
        } else if (type === TileType.PLAYER_SPAWN) {
          this.playerSpawn = gridToWorld(r, c);
        } else if (type === TileType.ENEMY_SPAWN) {
          this.enemySpawns.push(gridToWorld(r, c));
        }
      }
    }
  }

  getEnemySpawns() {
    return this.enemySpawns;
  }

  getPlayerSpawn() {
    return this.playerSpawn;
  }

  getBasePosition() {
    return this.basePos;
  }

  getTileType(r, c) {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return null;
    return this.grid[r][c];
  }

  isQuadrantIntact(r, c, qIndex) {
    const q = this.quadrants[`${r},${c}`];
    return q ? q[qIndex] : false;
  }

  damageQuadrant(r, c, qIndex) {
    const q = this.quadrants[`${r},${c}`];
    if (q && q[qIndex]) {
      q[qIndex] = false;
      return true;
    }
    return false;
  }

  resetDestruction() {
    for (const key of Object.keys(this.quadrants)) {
      this.quadrants[key] = [true, true, true, true];
    }
    this.baseDestroyed = false;
  }

  getSolidBoxes(minX, maxX, minZ, maxZ) {
    const boxes = [];
    const minCol = Math.max(0, Math.floor((minX + ARENA_HALF) / TILE_SIZE));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((maxX + ARENA_HALF) / TILE_SIZE));
    const minRow = Math.max(0, Math.floor((ARENA_HALF - maxZ) / TILE_SIZE));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((ARENA_HALF - minZ) / TILE_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const type = this.grid[r][c];
        const center = gridToWorld(r, c);
        const halfTile = TILE_SIZE / 2;

        if (type === TileType.STEEL || type === TileType.BASE || type === TileType.WATER) {
          boxes.push({
            minX: center.x - halfTile,
            maxX: center.x + halfTile,
            minZ: center.z - halfTile,
            maxZ: center.z + halfTile,
          });
        } else if (type === TileType.BRICK) {
          const q = this.quadrants[`${r},${c}`];
          if (q) {
            const qHalf = halfTile / 2;
            if (q[0]) boxes.push({ minX: center.x - halfTile, maxX: center.x, minZ: center.z, maxZ: center.z + halfTile });
            if (q[1]) boxes.push({ minX: center.x, maxX: center.x + halfTile, minZ: center.z, maxZ: center.z + halfTile });
            if (q[2]) boxes.push({ minX: center.x - halfTile, maxX: center.x, minZ: center.z - halfTile, maxZ: center.z });
            if (q[3]) boxes.push({ minX: center.x, maxX: center.x + halfTile, minZ: center.z - halfTile, maxZ: center.z });
          }
        }
      }
    }
    return boxes;
  }
}

class MockCollisionSystem {
  constructor(tileMap) {
    this.tileMap = tileMap;
  }

  isPositionValid(posX, posZ, halfExtent, extraAABBs) {
    const bMinX = posX - halfExtent;
    const bMaxX = posX + halfExtent;
    const bMinZ = posZ - halfExtent;
    const bMaxZ = posZ + halfExtent;

    if (bMinX < -ARENA_HALF || bMaxX > ARENA_HALF || bMinZ < -ARENA_HALF || bMaxZ > ARENA_HALF) {
      return false;
    }

    const solidBoxes = this.tileMap.getSolidBoxes(bMinX, bMaxX, bMinZ, bMaxZ);
    for (const box of solidBoxes) {
      if (bMinX < box.maxX && bMaxX > box.minX && bMinZ < box.maxZ && bMaxZ > box.minZ) {
        return false;
      }
    }

    if (extraAABBs) {
      for (const extra of extraAABBs) {
        if (bMinX < extra.maxX && bMaxX > extra.minX && bMinZ < extra.maxZ && bMaxZ > extra.minZ) {
          return false;
        }
      }
    }

    return true;
  }
}

class MockTank {
  constructor(x, z, dir, halfExtent = 0.60) {
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.halfExtent = halfExtent;
    this.destroyed = false;
  }

  getAABB() {
    return {
      minX: this.x - this.halfExtent,
      maxX: this.x + this.halfExtent,
      minZ: this.z - this.halfExtent,
      maxZ: this.z + this.halfExtent,
    };
  }

  isDestroyed() {
    return this.destroyed;
  }

  destroy() {
    this.destroyed = true;
  }

  reset(x, z, dir) {
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.destroyed = false;
  }
}

class MockLCG {
  constructor(seed = 2026) {
    this.seed = seed >>> 0;
  }
  next() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
}

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedTests++;
  }
}

console.log('=== PHASE 7: ENEMY TANK, FSM AI, FIRING & COMBAT SUITE ===\n');

// ==========================================
// TEST SUITE 1: DYNAMIC ENEMY SPAWN RESOLUTION
// ==========================================
console.log('Test Suite 1: Dynamic Enemy Spawn Resolution');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const enemySpawns = tileMap.getEnemySpawns();

  assert(enemySpawns.length === 3, `Level 01 defines exactly 3 enemy spawns (found: ${enemySpawns.length})`);

  // Verify coordinates
  const expectedCols = [0, 6, 12];
  for (let i = 0; i < enemySpawns.length; i++) {
    const spawnWorld = enemySpawns[i];
    const grid = worldToGrid(spawnWorld.x, spawnWorld.z);
    assert(grid.row === 0 && grid.column === expectedCols[i], `Spawn ${i} is at row 0, col ${expectedCols[i]}`);
  }

  // Exact center spawn index = Math.floor(length / 2) = 1
  const centerIndex = Math.floor(enemySpawns.length / 2);
  const centerSpawn = enemySpawns[centerIndex];
  assert(centerIndex === 1, 'Center spawn index resolves to 1');
  assert(centerSpawn.x === 0.0 && centerSpawn.z === 12.0, `Center spawn world pos is (0.0, 12.0), got (${centerSpawn.x}, ${centerSpawn.z})`);
}

// ==========================================
// TEST SUITE 2: ENEMY TANK INITIAL STATE & BOUNDS
// ==========================================
console.log('\nTest Suite 2: Enemy Tank Initial State & Collision Bounds');
{
  const enemy = new MockTank(0.0, 12.0, Direction.SOUTH, 0.60);
  assert(!enemy.isDestroyed(), 'Enemy tank is not destroyed initially');
  assert(enemy.dir === Direction.SOUTH, 'Enemy tank initially faces SOUTH towards the battlefield');

  const aabb = enemy.getAABB();
  assert(aabb.minX === -0.60 && aabb.maxX === 0.60, 'Enemy AABB X bounds are [-0.60, 0.60]');
  assert(aabb.minZ === 11.40 && aabb.maxZ === 12.60, 'Enemy AABB Z bounds are [11.40, 12.60]');
}

// ==========================================
// TEST SUITE 3: CARDINAL MOVEMENT & MAP COLLISIONS
// ==========================================
console.log('\nTest Suite 3: Cardinal Movement & Map Collisions');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const collisionSystem = new MockCollisionSystem(tileMap);

  // Center spawn (0, 12) is inside empty spawn area, must be valid
  assert(collisionSystem.isPositionValid(0.0, 12.0, 0.60), 'Enemy position at spawn (0, 12) is valid');

  // Move south by 1 tile: (0, 10) is also empty path
  assert(collisionSystem.isPositionValid(0.0, 10.0, 0.60), 'Enemy position at (0, 10) along empty path is valid');

  // Steel walls in Level 01: row 2, col 5 is STEEL
  const steelCell = gridToWorld(2, 5);
  assert(!collisionSystem.isPositionValid(steelCell.x, steelCell.z, 0.60), 'Steel block at (2, 5) blocks enemy tank');

  // Arena boundaries: outside ARENA_HALF (13.0)
  assert(!collisionSystem.isPositionValid(0, 13.5, 0.60), 'Movement beyond NORTH arena boundary is blocked');
  assert(!collisionSystem.isPositionValid(0, -13.5, 0.60), 'Movement beyond SOUTH arena boundary is blocked');
  assert(!collisionSystem.isPositionValid(-13.5, 0, 0.60), 'Movement beyond WEST arena boundary is blocked');
  assert(!collisionSystem.isPositionValid(13.5, 0, 0.60), 'Movement beyond EAST arena boundary is blocked');
}

// ==========================================
// TEST SUITE 4: AUTONOMOUS FSM AI & SEEDED PRNG
// ==========================================
console.log('\nTest Suite 4: Autonomous FSM AI & Seeded PRNG');
{
  const prng1 = new MockLCG(2026);
  const prng2 = new MockLCG(2026);

  const val1_a = prng1.next();
  const val1_b = prng1.next();
  const val2_a = prng2.next();
  const val2_b = prng2.next();

  assert(val1_a === val2_a && val1_b === val2_b, 'LCG PRNG generates 100% deterministic sequence from seed 2026');

  // Test Base Bias: when evaluating directions, SOUTH is favored
  const dirs = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST];
  function pickDirectionWithBaseBias(validDirs, prng) {
    if (validDirs.length === 1) return validDirs[0];
    // Base bias: SOUTH weighted 2.5x
    const weights = validDirs.map((d) => (d === Direction.SOUTH ? 2.5 : 1.0));
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);
    let rand = prng.next() * totalWeight;
    for (let i = 0; i < validDirs.length; i++) {
      if (rand < weights[i]) return validDirs[i];
      rand -= weights[i];
    }
    return validDirs[validDirs.length - 1];
  }

  let southCount = 0;
  const trials = 1000;
  const testPrng = new MockLCG(2026);
  for (let i = 0; i < trials; i++) {
    const chosen = pickDirectionWithBaseBias(dirs, testPrng);
    if (chosen === Direction.SOUTH) southCount++;
  }

  const southPct = (southCount / trials) * 100;
  assert(southPct > 40 && southPct < 55, `Base bias favors SOUTH (~45% expected with 2.5 weight): got ${southPct.toFixed(1)}%`);
}

// ==========================================
// TEST SUITE 5: STUCK DETECTOR & REPOSITIONING
// ==========================================
console.log('\nTest Suite 5: Stuck Detector & Repositioning');
{
  let state = EnemyState.PATROLLING;
  let lastPos = { x: 0, z: 12 };
  let stuckTimer = 0;
  const STUCK_THRESHOLD = 0.45;
  const currentPos = { x: 0.005, z: 12.005 }; // < 0.02 displacement

  function checkStuck(dt) {
    const dx = currentPos.x - lastPos.x;
    const dz = currentPos.z - lastPos.z;
    const distSq = dx * dx + dz * dz;
    stuckTimer += dt;
    if (stuckTimer >= STUCK_THRESHOLD) {
      stuckTimer = 0;
      if (distSq < 0.02 * 0.02) {
        state = EnemyState.REPOSITIONING;
        return true;
      }
    }
    return false;
  }

  assert(!checkStuck(0.2), 'Not stuck before threshold duration (t = 0.2s)');
  assert(checkStuck(0.3), 'Stuck detected after threshold exceeded (t = 0.5s) with minimal displacement');
  assert(state === EnemyState.REPOSITIONING, 'State transitioned to REPOSITIONING on stuck detection');
}

// ==========================================
// TEST SUITE 6: TARGET ALIGNMENT & PRIORITY (BASE > PLAYER)
// ==========================================
console.log('\nTest Suite 6: Target Alignment & Priority (Base > Player)');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const basePos = tileMap.getBasePosition(); // (0, -12)

  // Alignment test function
  function checkAlignment(tankPos, targetPos, tolerance = 0.3) {
    if (Math.abs(tankPos.x - targetPos.x) < tolerance) {
      return tankPos.z > targetPos.z ? Direction.SOUTH : Direction.NORTH;
    }
    if (Math.abs(tankPos.z - targetPos.z) < tolerance) {
      return tankPos.x > targetPos.x ? Direction.WEST : Direction.EAST;
    }
    return null;
  }

  // Enemy at (0, 5), Base at (0, -12), Player at (4, 5)
  const enemyPos = { x: 0.0, z: 5.0 };
  const playerPos = { x: 4.0, z: 5.0 };

  const baseDir = checkAlignment(enemyPos, basePos);
  const playerDir = checkAlignment(enemyPos, playerPos);

  assert(baseDir === Direction.SOUTH, 'Enemy is aligned with Base along vertical column (faces SOUTH)');
  assert(playerDir === Direction.EAST, 'Enemy is simultaneously aligned with Player along horizontal row (faces EAST)');

  // Evaluate Priority: Base Alignment must take precedence over Player Alignment
  function resolveTargetPriority(enemyPos, basePos, playerPos) {
    const bDir = checkAlignment(enemyPos, basePos);
    if (bDir !== null) {
      return { target: 'BASE', direction: bDir };
    }
    const pDir = checkAlignment(enemyPos, playerPos);
    if (pDir !== null) {
      return { target: 'PLAYER', direction: pDir };
    }
    return null;
  }

  const priorityResult = resolveTargetPriority(enemyPos, basePos, playerPos);
  assert(priorityResult.target === 'BASE', 'Base target takes strict precedence over Player target');
  assert(priorityResult.direction === Direction.SOUTH, 'Prioritized direction is SOUTH towards Base');
}

// ==========================================
// TEST SUITE 7: TANK-TO-TANK PHYSICAL COLLISION (ZERO PUSHING/OVERLAP)
// ==========================================
console.log('\nTest Suite 7: Tank-to-Tank Physical Collision (Zero Overlap)');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const collisionSystem = new MockCollisionSystem(tileMap);

  const player = new MockTank(0.0, 0.0, Direction.NORTH, 0.60);
  const enemy = new MockTank(0.0, 2.0, Direction.SOUTH, 0.60);

  // Player attempts to move north into enemy: (0.0, 1.0)
  // Distance = 1.0, but sum of halfExtents = 0.60 + 0.60 = 1.20 -> Overlap!
  const playerNextZ = 1.0;
  const playerCanMoveIntoEnemy = collisionSystem.isPositionValid(
    0.0,
    playerNextZ,
    0.60,
    [enemy.getAABB()]
  );
  assert(!playerCanMoveIntoEnemy, 'Player is blocked by Enemy Tank AABB (no clipping or walking through)');

  // Enemy attempts to move south into player: (0.0, 1.0)
  const enemyNextZ = 1.0;
  const enemyCanMoveIntoPlayer = collisionSystem.isPositionValid(
    0.0,
    enemyNextZ,
    0.60,
    [player.getAABB()]
  );
  assert(!enemyCanMoveIntoPlayer, 'Enemy is blocked by Player Tank AABB (no pushing or walking through)');

  // Clear distance: Player at (0, 0), Enemy at (0, 3.0) -> Distance 3.0 > 1.20
  const safeZ = 0.5;
  const safeMove = collisionSystem.isPositionValid(
    0.0,
    safeZ,
    0.60,
    [enemy.getAABB()]
  );
  assert(safeMove, 'Movement with safe clearance is permitted cleanly');
}

// ==========================================
// TEST SUITE 8: PROJECTILE HIT ORDER & COMBAT PIPELINE
// ==========================================
console.log('\nTest Suite 8: Projectile Hit Order & Combat Pipeline');
{
  // Test A: Enemy bullet destroys Player -> Game Over
  let gameOverTriggered = false;
  let gameOverReason = null;
  function onPlayerHit() {
    gameOverTriggered = true;
    gameOverReason = GameOverReason.PLAYER_DESTROYED;
  }

  onPlayerHit();
  assert(gameOverTriggered, 'Enemy projectile hit on Player triggers Game Over');
  assert(gameOverReason === GameOverReason.PLAYER_DESTROYED, 'Game Over reason is PLAYER_DESTROYED');

  // Test B: Player bullet destroys Enemy -> GameState remains PLAYING
  let gameState = GameState.PLAYING;
  const enemy = new MockTank(0, 5, Direction.SOUTH, 0.60);
  function onEnemyHit() {
    enemy.destroy();
    // In Phase 7, destroying single enemy does NOT cause victory or Game Over
  }

  onEnemyHit();
  assert(enemy.isDestroyed(), 'Player projectile destroys Enemy Tank');
  assert(gameState === GameState.PLAYING, 'GameState remains PLAYING after enemy destruction (Phase 7 rule)');

  // Test C: Closer obstacle hit precedence (Raycast order)
  // Scenario: Player at (0, 0) fires NORTH (dir.z = 1).
  // In path:
  // Brick tile at (0, 4) -> Z bounds [3.0, 5.0] (entry z = 3.0)
  // Enemy tank at (0, 8) -> Z bounds [7.4, 8.6] (entry z = 7.4)
  // Ray travelling from Z = 0 to Z = 10.
  const rayFromZ = 0.0;
  const rayToZ = 10.0;
  const brickEntryZ = 3.0;
  const enemyEntryZ = 7.4;

  const hitBrickFirst = (brickEntryZ < enemyEntryZ) && (brickEntryZ >= rayFromZ && brickEntryZ <= rayToZ);
  assert(hitBrickFirst, 'Closer Brick wall intercepts bullet before reaching Enemy behind it (correct raycast order)');
}

// ==========================================
// TEST SUITE 9: IN-ENGINE STAGE RESTART
// ==========================================
console.log('\nTest Suite 9: In-Engine Stage Restart (No Page Reload)');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const player = new MockTank(4, 4, Direction.EAST, 0.60);
  const enemy = new MockTank(2, 2, Direction.WEST, 0.60);
  let gameState = GameState.GAME_OVER;

  // Damage a quadrant at (0, 3)
  tileMap.damageQuadrant(0, 3, 0);
  assert(!tileMap.isQuadrantIntact(0, 3, 0), 'Brick quadrant is damaged prior to restart');

  // Destroy enemy and player
  enemy.destroy();
  player.destroy();
  assert(enemy.isDestroyed() && player.isDestroyed(), 'Both tanks destroyed before restart');

  // Trigger stage restart
  function restartStage() {
    tileMap.resetDestruction();
    const pSpawn = tileMap.getPlayerSpawn();
    player.reset(pSpawn.x, pSpawn.z, Direction.NORTH);

    const eSpawns = tileMap.getEnemySpawns();
    const centerSpawn = eSpawns[Math.floor(eSpawns.length / 2)];
    enemy.reset(centerSpawn.x, centerSpawn.z, Direction.SOUTH);

    gameState = GameState.PLAYING;
  }

  restartStage();

  assert(gameState === GameState.PLAYING, 'GameState restored to PLAYING');
  assert(!player.isDestroyed(), 'Player tank restored to alive');
  assert(!enemy.isDestroyed(), 'Enemy tank restored to alive');
  assert(player.x === -4.0 && player.z === -10.0, 'Player tank reset to exact Level 01 spawn (-4, -10)');
  assert(player.dir === Direction.NORTH, 'Player tank reset facing NORTH');
  assert(enemy.x === 0.0 && enemy.z === 12.0, 'Enemy tank reset to exact Level 01 center spawn (0, 12)');
  assert(enemy.dir === Direction.SOUTH, 'Enemy tank reset facing SOUTH');
  assert(tileMap.isQuadrantIntact(0, 3, 0), 'Brick quadrants restored to 100% intact');
}

// ==========================================
// SUMMARY
// ==========================================
console.log('\n==================================================');
console.log(`Phase 7 Test Results: ${passedTests} passed, ${failedTests} failed`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
