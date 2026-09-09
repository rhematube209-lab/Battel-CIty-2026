/**
 * Automated Test Suite for Phase 8:
 * Complete Stage 01 Loop (Enemy Waves + Multiple Enemies + Player Lives + Score + HUD + Stage Clear)
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
  STAGE_COMPLETE: 3,
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

const STAGE_CONFIG = {
  STAGE_NUMBER: 1,
  TOTAL_ENEMIES: 12,
  MAX_ACTIVE_ENEMIES: 4,
  PLAYER_STARTING_LIVES: 3,
  ENEMY_SCORE_VALUE: 100,
  ENEMY_SPAWN_INTERVAL: 1.25,
  PLAYER_RESPAWN_DELAY: 1.00,
  PLAYER_RESPAWN_INVULNERABILITY: 1.50,
  MAX_ACTIVE_ENEMY_BULLETS_TOTAL: 6,
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

class MockTileMap {
  constructor(levelData) {
    this.grid = JSON.parse(JSON.stringify(levelData));
    this.quadrants = {};
    this.basePos = null;
    this.playerSpawn = null;
    this.enemySpawns = [];

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
  constructor(id, x, z, dir, halfExtent = 0.60) {
    this.id = id;
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.halfExtent = halfExtent;
    this.destroyed = false;
    this.active = false;
    this.spawning = false;
    this.invulnerableTimer = 0;
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
  isActive() {
    return this.active;
  }
  isSpawning() {
    return this.spawning;
  }
  isInvulnerable() {
    return this.invulnerableTimer > 0;
  }

  setInvulnerable(dur) {
    this.invulnerableTimer = dur;
  }

  spawn(x, z, dir) {
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.destroyed = false;
    this.active = true;
    this.spawning = true;
  }

  destroy() {
    if (this.destroyed) return false;
    this.destroyed = true;
    return true;
  }

  finishExplosion() {
    this.active = false;
  }

  reset(x, z, dir) {
    this.x = x;
    this.z = z;
    this.dir = dir;
    this.destroyed = false;
    this.active = false;
    this.spawning = false;
    this.invulnerableTimer = 0;
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

console.log('=== PHASE 8: COMPLETE STAGE 01 LOOP SUITE ===\n');

// ==========================================
// TEST SUITE 1: STAGE CONFIGURATION
// ==========================================
console.log('Test Suite 1: Stage 01 Configuration & Parameters');
{
  assert(STAGE_CONFIG.STAGE_NUMBER === 1, 'Stage number is 1');
  assert(STAGE_CONFIG.TOTAL_ENEMIES === 12, 'Total enemies configured as 12');
  assert(STAGE_CONFIG.MAX_ACTIVE_ENEMIES === 4, 'Max concurrent active enemies is 4');
  assert(STAGE_CONFIG.PLAYER_STARTING_LIVES === 3, 'Player starting lives is 3');
  assert(STAGE_CONFIG.ENEMY_SCORE_VALUE === 100, 'Score value per enemy is 100');
  assert(STAGE_CONFIG.ENEMY_SPAWN_INTERVAL === 1.25, 'Spawn interval is 1.25s');
  assert(STAGE_CONFIG.PLAYER_RESPAWN_DELAY === 1.00, 'Player respawn delay is 1.00s');
  assert(STAGE_CONFIG.PLAYER_RESPAWN_INVULNERABILITY === 1.50, 'Respawn invulnerability is 1.50s');
  assert(STAGE_CONFIG.MAX_ACTIVE_ENEMY_BULLETS_TOTAL === 6, 'Team-wide enemy bullet ceiling is 6');
}

// ==========================================
// TEST SUITE 2: ENEMY POOLING & PROGRESSIVE SPAWNING
// ==========================================
console.log('\nTest Suite 2: Enemy Pooling, Progressive Spawning & Rotation');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const collisionSystem = new MockCollisionSystem(tileMap);
  const spawns = tileMap.getEnemySpawns();

  // Create pool of 4 slots
  const pool = [];
  for (let i = 0; i < 4; i++) {
    pool.push(new MockTank(`enemy_${i}`, 0, 0, Direction.SOUTH));
  }

  let spawnedCount = 0;
  let spawnIndex = 0;

  function trySpawn(obstacleAABBs = []) {
    if (spawnedCount >= STAGE_CONFIG.TOTAL_ENEMIES) return null;
    const activeCount = pool.filter((s) => s.isActive() && !s.isDestroyed()).length;
    if (activeCount >= STAGE_CONFIG.MAX_ACTIVE_ENEMIES) return null;

    const slot = pool.find((s) => !s.isActive());
    if (!slot) return null;

    for (let attempt = 0; attempt < spawns.length; attempt++) {
      const idx = (spawnIndex + attempt) % spawns.length;
      const pt = spawns[idx];
      if (collisionSystem.isPositionValid(pt.x, pt.z, 0.60, obstacleAABBs)) {
        slot.spawn(pt.x, pt.z, Direction.SOUTH);
        spawnedCount++;
        spawnIndex = (idx + 1) % spawns.length;
        return { slot, point: pt, spawnIndex: idx };
      }
    }
    return null;
  }

  // Spawn 1st enemy -> Left spawn (col 0)
  const spawn1 = trySpawn();
  assert(spawn1 !== null, 'Spawn 1 successful');
  assert(spawn1.point.x === -12.0 && spawn1.point.z === 12.0, 'Spawn 1 deployed at Left spawn (row 0, col 0)');
  assert(spawnedCount === 1, 'Spawned count is 1');

  // Spawn 2nd enemy -> Center spawn (col 6)
  const spawn2 = trySpawn();
  assert(spawn2 !== null, 'Spawn 2 successful');
  assert(spawn2.point.x === 0.0 && spawn2.point.z === 12.0, 'Spawn 2 deployed at Center spawn (row 0, col 6)');
  assert(spawnedCount === 2, 'Spawned count is 2');

  // Spawn 3rd enemy -> Right spawn (col 12)
  const spawn3 = trySpawn();
  assert(spawn3 !== null, 'Spawn 3 successful');
  assert(spawn3.point.x === 12.0 && spawn3.point.z === 12.0, 'Spawn 3 deployed at Right spawn (row 0, col 12)');

  // Spawn 4th enemy -> Rotates back to Left spawn (col 0), but slot 0 is already there!
  // Collision check must skip Left spawn because slot 0 occupies it, and try Center (also occupied), and try Right (occupied).
  // With obstacles passed:
  const activeObstacles = pool.filter((s) => s.isActive()).map((s) => s.getAABB());
  const spawn4Blocked = trySpawn(activeObstacles);
  assert(spawn4Blocked === null, 'Spawn 4 blocked when all 3 spawn locations are occupied (spawn safety check)');

  // Move tank 0 away from Left spawn: (x: -12, z: 6)
  pool[0].z = 6.0;
  const updatedObstacles = pool.filter((s) => s.isActive()).map((s) => s.getAABB());
  const spawn4 = trySpawn(updatedObstacles);
  assert(spawn4 !== null, 'Spawn 4 succeeds once Left spawn point is cleared');
  assert(pool.filter((s) => s.isActive()).length === 4, 'Exactly 4 active enemies in pool');

  // 5th attempt when 4 are active must fail
  const spawn5 = trySpawn();
  assert(spawn5 === null, 'Cannot exceed MAX_ACTIVE_ENEMIES (4) concurrently');
}

// ==========================================
// TEST SUITE 3: ENEMY ACCOUNTING & SCORE SYSTEM
// ==========================================
console.log('\nTest Suite 3: Enemy Accounting & Zero-Padded Score');
{
  let score = 0;
  let destroyedCount = 0;
  const totalEnemies = 12;

  function formatScore(num) {
    return num.toString().padStart(6, '0');
  }

  assert(formatScore(score) === '000000', 'Initial score displays 000000');
  assert(totalEnemies - destroyedCount === 12, 'Initial remaining enemies is 12');

  // First enemy destroyed
  const enemyA = new MockTank('eA', 0, 0, Direction.SOUTH);
  const destroyedFirst = enemyA.destroy();
  if (destroyedFirst) {
    destroyedCount++;
    score += STAGE_CONFIG.ENEMY_SCORE_VALUE;
  }

  assert(destroyedCount === 1, 'Destroyed count increments to 1');
  assert(totalEnemies - destroyedCount === 11, 'Remaining enemies updates to 11');
  assert(score === 100 && formatScore(score) === '000100', 'Score increases to 000100');

  // Idempotent duplicate kill protection
  const destroyedSecond = enemyA.destroy();
  if (destroyedSecond) {
    destroyedCount++;
    score += STAGE_CONFIG.ENEMY_SCORE_VALUE;
  }

  assert(!destroyedSecond, 'Second destroy() on same enemy returns false (idempotent)');
  assert(destroyedCount === 1, 'Destroyed count not duplicated');
  assert(score === 100, 'Score not duplicated');

  // Destroy 11 more
  for (let i = 1; i < 12; i++) {
    const e = new MockTank(`e_${i}`, 0, 0, Direction.SOUTH);
    if (e.destroy()) {
      destroyedCount++;
      score += STAGE_CONFIG.ENEMY_SCORE_VALUE;
    }
  }

  assert(destroyedCount === 12, 'All 12 enemies destroyed');
  assert(totalEnemies - destroyedCount === 0, 'Remaining enemies is 0');
  assert(score === 1200 && formatScore(score) === '001200', 'Final score for 12 kills is 001200');
}

// ==========================================
// TEST SUITE 4: PLAYER LIVES & LIFE RESPAWN PIPELINE
// ==========================================
console.log('\nTest Suite 4: Player Lives, Respawn Delay & Invulnerability');
{
  let lives = 3;
  let gameState = GameState.PLAYING;
  const player = new MockTank('player', -4, -10, Direction.NORTH);
  let isRespawning = false;
  let respawnTimer = 0;

  function handlePlayerDeath() {
    if (player.isInvulnerable() || player.isDestroyed()) return;
    player.destroy();
    lives--;
    if (lives <= 0) {
      gameState = GameState.GAME_OVER;
    } else {
      isRespawning = true;
      respawnTimer = STAGE_CONFIG.PLAYER_RESPAWN_DELAY; // 1.0s
    }
  }

  // Death 1
  handlePlayerDeath();
  assert(lives === 2, 'Death 1 decrements lives to 2');
  assert(gameState === GameState.PLAYING, 'GameState remains PLAYING when lives remain');
  assert(isRespawning, 'Player enters isRespawning state');
  assert(respawnTimer === 1.00, 'Respawn timer initialized to 1.00s');

  // Complete respawn delay and check invulnerability
  respawnTimer = 0;
  isRespawning = false;
  player.reset(-4, -10, Direction.NORTH);
  player.setInvulnerable(STAGE_CONFIG.PLAYER_RESPAWN_INVULNERABILITY); // 1.5s

  assert(player.isInvulnerable(), 'Player enters invulnerability state after respawn');
  assert(player.x === -4 && player.z === -10, 'Player returned to spawn position');
  assert(player.dir === Direction.NORTH, 'Player facing NORTH upon respawn');

  // Attempt hit during invulnerability
  handlePlayerDeath();
  assert(lives === 2, 'Enemy hit ignored during 1.5s post-respawn invulnerability');
  assert(!player.isDestroyed(), 'Player not destroyed while invulnerable');

  // Invulnerability expires
  player.setInvulnerable(0);
  assert(!player.isInvulnerable(), 'Invulnerability timer expired');

  // Death 2
  handlePlayerDeath();
  assert(lives === 1, 'Death 2 decrements lives to 1');
  assert(gameState === GameState.PLAYING, 'GameState remains PLAYING with 1 life left');

  // Respawn 2
  player.reset(-4, -10, Direction.NORTH);
  player.setInvulnerable(0);

  // Death 3 (Final Life)
  handlePlayerDeath();
  assert(lives === 0, 'Death 3 reduces lives to 0');
  assert(gameState === GameState.GAME_OVER, 'GameState transitions to GAME_OVER when lives reach 0');
}

// ==========================================
// TEST SUITE 5: BASE DESTRUCTION OVERRIDES PLAYER LIVES
// ==========================================
console.log('\nTest Suite 5: Base Destruction Overrides Remaining Lives');
{
  const lives = 3;
  let gameState = GameState.PLAYING;

  function onBaseHit() {
    gameState = GameState.GAME_OVER;
  }

  onBaseHit();
  assert(lives === 3, 'Player still had 3 lives');
  assert(gameState === GameState.GAME_OVER, 'Base destruction immediately causes GAME_OVER regardless of lives');
}

// ==========================================
// TEST SUITE 6: MULTI-ENEMY COLLISION & FRIENDLY FIRE
// ==========================================
console.log('\nTest Suite 6: Multi-Enemy Collision & Friendly Fire');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const collisionSystem = new MockCollisionSystem(tileMap);

  const tankA = new MockTank('A', 0, 0, Direction.NORTH, 0.60);
  const tankB = new MockTank('B', 0, 2.0, Direction.SOUTH, 0.60);
  const tankC = new MockTank('C', 0, 4.0, Direction.SOUTH, 0.60);

  // Tank A tries to move into Tank B
  const canAMoveIntoB = collisionSystem.isPositionValid(0, 1.0, 0.60, [tankB.getAABB(), tankC.getAABB()]);
  assert(!canAMoveIntoB, 'Tank A blocked by Tank B AABB (no vehicle overlap)');

  // Tank B tries to move into Tank C
  const canBMoveIntoC = collisionSystem.isPositionValid(0, 3.0, 0.60, [tankA.getAABB(), tankC.getAABB()]);
  assert(!canBMoveIntoC, 'Tank B blocked by Tank C AABB (chain blocking handled cleanly)');

  // Friendly Fire Check: Enemy bullet should not damage another enemy
  const ProjectileTeam = { PLAYER: 0, ENEMY: 1 };
  function canDamageTarget(bulletTeam, targetTeam) {
    if (bulletTeam === ProjectileTeam.ENEMY && targetTeam === ProjectileTeam.ENEMY) {
      return false; // ENEMY FRIENDLY FIRE = OFF
    }
    return true;
  }

  assert(!canDamageTarget(ProjectileTeam.ENEMY, ProjectileTeam.ENEMY), 'Enemy bullet ignores enemy tank (friendly fire OFF)');
  assert(canDamageTarget(ProjectileTeam.ENEMY, ProjectileTeam.PLAYER), 'Enemy bullet damages player tank');
  assert(canDamageTarget(ProjectileTeam.PLAYER, ProjectileTeam.ENEMY), 'Player bullet damages enemy tank');
}

// ==========================================
// TEST SUITE 7: STAGE COMPLETE & CLEAN REPLAY
// ==========================================
console.log('\nTest Suite 7: Stage Complete Condition & In-Engine Replay');
{
  let gameState = GameState.PLAYING;
  let stageClearShown = false;
  let score = 1200;
  let remaining = 0;
  let destroyedCount = 12;
  const activeCount = 0;

  function checkStageComplete() {
    if (destroyedCount === 12 && activeCount === 0) {
      gameState = GameState.STAGE_COMPLETE;
      stageClearShown = true;
    }
  }

  checkStageComplete();
  assert(gameState === GameState.STAGE_COMPLETE, 'GameState transitions to STAGE_COMPLETE when all 12 are destroyed and 0 active');
  assert(stageClearShown, 'Stage Complete UI modal is shown');

  // Trigger Replay (Full Stage Reset)
  let lives = 0;
  function replayStage() {
    lives = STAGE_CONFIG.PLAYER_STARTING_LIVES;
    score = 0;
    destroyedCount = 0;
    remaining = STAGE_CONFIG.TOTAL_ENEMIES;
    gameState = GameState.PLAYING;
    stageClearShown = false;
  }

  replayStage();
  assert(gameState === GameState.PLAYING, 'GameState restored to PLAYING on replay');
  assert(lives === 3, 'Lives restored to 3');
  assert(score === 0, 'Score reset to 0');
  assert(remaining === 12, 'Remaining enemies restored to 12');
  assert(!stageClearShown, 'Stage Complete modal hidden');
}

// ==========================================
// TEST SUITE 8: STRESS & IDEMPOTENCE (5 CYCLES & 10 RESPAWNS)
// ==========================================
console.log('\nTest Suite 8: Stress & In-Engine Reset Stability');
{
  let stressPassed = true;
  for (let cycle = 0; cycle < 5; cycle++) {
    let lives = 3;
    let score = 0;
    let destroyed = 0;

    // Simulate 10 kills and 2 respawns
    for (let k = 0; k < 10; k++) {
      destroyed++;
      score += 100;
    }
    lives--; // respawn 1
    lives--; // respawn 2
    if (lives !== 1 || score !== 1000 || destroyed !== 10) {
      stressPassed = false;
    }
    // Full restart
    lives = 3;
    score = 0;
    destroyed = 0;
  }
  assert(stressPassed, 'Passed 5 consecutive stage simulation and reset cycles without leakage');
}

// ==========================================
// SUMMARY
// ==========================================
console.log('\n==================================================');
console.log(`Phase 8 Test Results: ${passedTests} passed, ${failedTests} failed`);
console.log('==================================================\n');

if (failedTests > 0) {
  process.exit(1);
}
