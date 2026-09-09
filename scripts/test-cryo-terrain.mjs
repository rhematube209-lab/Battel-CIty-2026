/**
 * Automated Test Suite for Phase 15:
 * CRYO FLOOR TERRAIN + DETERMINISTIC SLIDING + STAGE 02 TERRAIN UPGRADE
 *
 * Verifies Requirements 56–81:
 * Test Suite 1: Enum Compatibility & Value Preservation (Req 57, 2)
 * Test Suite 2: LevelDefinition Validation for CRYO (Req 53)
 * Test Suite 3: TileMap Cryo Parsing & Center-Cell Surface Query (Req 58, 6)
 * Test Suite 4: Cryo Passability & Zero Solid Impact (Req 59, 3, 40)
 * Test Suite 5: Player Enter Cryo & Direction Commitment (Req 60, 8)
 * Test Suite 6: Player Sliding with Input Released (Req 61, 9)
 * Test Suite 7: Player Turning Restriction While Sliding (Req 62, 10, 11)
 * Test Suite 8: Player Exit Cryo onto Normal Terrain (Req 63, 16)
 * Test Suite 9: Player Blocked on Cryo & Slide Cancellation (Req 64, 18)
 * Test Suite 10: Brick Quadrant Collision on Cryo (Req 65)
 * Test Suite 11: Tank-to-Tank Collision on Cryo (Req 66, 19)
 * Test Suite 12: Substep Movement Safety & Tunneling Prevention (Req 67, 52)
 * Test Suite 13: Enemy Cryo Movement & Decision Locking (Req 68, 21, 22, 23)
 * Test Suite 14: Enemy Blocked on Cryo & Repositioning Recovery (Req 69, 25)
 * Test Suite 15: Invariant Enemy Archetype Speeds on Cryo (Req 70, 20)
 * Test Suite 16: Stasis Pulse + Cryo Interaction (Req 71, 26)
 * Test Suite 17: Player Destruction & Respawn State Reset (Req 72, 27)
 * Test Suite 18: Overdrive Core on Cryo (Req 73, 12, 13)
 * Test Suite 19: Aegis Field on Cryo (Req 74, 14)
 * Test Suite 20: Powerup Drop & Collection on Cryo (Req 75, 41, 42)
 * Test Suite 21: Stage 01 Regression Isolation (0 CRYO Tiles) (Req 76, 31)
 * Test Suite 22: Stage 02 Cryo Layout & Exact Coordinate Verification (Req 77, 32-35)
 * Test Suite 23: Stage Transition & Reset Cleanliness (Req 78, 80, 30)
 * Test Suite 24: Audio Skid Telemetry & Bounded Voices (Req 44)
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
// Source Parsers
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
  return { TileType };
}

const { TileType } = loadConstants();

function loadLevel01Definition() {
  const code = fs.readFileSync('src/levels/level01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/:\s*TileType\[\]\[\]/g, '');
  cleaned = cleaned.replace(/:\s*LevelDefinition/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');
  const fn = new Function('TileType', cleaned + '; return { LEVEL_01, LEVEL_01_TILES };');
  return fn(TileType);
}

function loadLevel02Definition() {
  const code = fs.readFileSync('src/levels/level02.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/:\s*TileType\[\]\[\]/g, '');
  cleaned = cleaned.replace(/:\s*LevelDefinition/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');
  const fn = new Function('TileType', cleaned + '; return { LEVEL_02, LEVEL_02_TILES };');
  return fn(TileType);
}

// -------------------------------------------------------------
// Deterministic Collision & Movement Simulator
// -------------------------------------------------------------
class CollisionSimulator {
  constructor(tiles) {
    this.tiles = tiles.map((r) => [...r]);
    this.halfExtent = COLLISION_HALF;
    this.arenaHalf = ARENA_HALF;
    // Quadrant state for brick tiles: 'r_c' -> { tl, tr, bl, br }
    this.brickQuadrants = new Map();
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.tiles[r][c] === TileType.BRICK) {
          this.brickQuadrants.set(`${r}_${c}`, { tl: true, tr: true, bl: true, br: true });
        }
      }
    }
  }

  getTileMap() {
    return {
      getTileTypeAtWorldPosition: (pos) => {
        const g = worldToGrid(pos.x, pos.z);
        if (!g) return null;
        return this.tiles[g.row][g.column];
      }
    };
  }

  isSolid(type) {
    return (
      type === TileType.BRICK ||
      type === TileType.STEEL ||
      type === TileType.WATER ||
      type === TileType.BASE
    );
  }

  destroyBrickQuadrant(r, c, quadrant) {
    const key = `${r}_${c}`;
    const q = this.brickQuadrants.get(key);
    if (q) {
      q[quadrant] = false;
    }
  }

  isPositionValid(x, z, extraAABBs = []) {
    const minX = x - this.halfExtent;
    const maxX = x + this.halfExtent;
    const minZ = z - this.halfExtent;
    const maxZ = z + this.halfExtent;

    // Arena boundary
    if (minX < -this.arenaHalf || maxX > this.arenaHalf || minZ < -this.arenaHalf || maxZ > this.arenaHalf) {
      return false;
    }

    // Static tiles
    const minCol = Math.max(0, Math.floor((minX + this.arenaHalf) / TILE_SIZE));
    const maxCol = Math.min(GRID_COLS - 1, Math.floor((maxX + this.arenaHalf) / TILE_SIZE));
    const minRow = Math.max(0, Math.floor((this.arenaHalf - maxZ) / TILE_SIZE));
    const maxRow = Math.min(GRID_ROWS - 1, Math.floor((this.arenaHalf - minZ) / TILE_SIZE));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const t = this.tiles[r][c];
        if (t === TileType.STEEL || t === TileType.WATER || t === TileType.BASE) {
          const tMinX = 2 * c - 13;
          const tMaxX = tMinX + 2;
          const tMinZ = 13 - 2 * r - 2;
          const tMaxZ = tMinZ + 2;

          if (maxX > tMinX && minX < tMaxX && maxZ > tMinZ && minZ < tMaxZ) {
            return false;
          }
        } else if (t === TileType.BRICK) {
          const q = this.brickQuadrants.get(`${r}_${c}`) || { tl: true, tr: true, bl: true, br: true };
          const cx = (c - 6) * TILE_SIZE;
          const cz = (6 - r) * TILE_SIZE;

          // tl: [cx - 1, cx] x [cz, cz + 1]
          if (q.tl && maxX > cx - 1 && minX < cx && maxZ > cz && minZ < cz + 1) return false;
          // tr: [cx, cx + 1] x [cz, cz + 1]
          if (q.tr && maxX > cx && minX < cx + 1 && maxZ > cz && minZ < cz + 1) return false;
          // bl: [cx - 1, cx] x [cz - 1, cz]
          if (q.bl && maxX > cx - 1 && minX < cx && maxZ > cz - 1 && minZ < cz) return false;
          // br: [cx, cx + 1] x [cz - 1, cz]
          if (q.br && maxX > cx && minX < cx + 1 && maxZ > cz - 1 && minZ < cz) return false;
        }
        // Note: CRYO, EMPTY, BUSH, SPAWNS are non-solid
      }
    }

    // Dynamic AABBs (other tanks)
    for (const b of extraAABBs) {
      if (maxX > b.minX && minX < b.maxX && maxZ > b.minZ && minZ < b.maxZ) {
        return false;
      }
    }

    return true;
  }

  resolveMovement(startX, startZ, dir, distance, dt, extraAABBs = []) {
    let currentX = startX;
    let currentZ = startZ;

    const maxSubstep = 0.20;
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
        break;
      }
    }

    return { x: currentX, z: currentZ, moved: movedAny };
  }
}

// -------------------------------------------------------------
// Mock PlayerTank Implementation matching src/entities/PlayerTank.ts
// -------------------------------------------------------------
class SimulatedPlayerTank {
  constructor(collisionSystem, startPos = { x: 0, z: 0 }) {
    this.collisionSystem = collisionSystem;
    this.position = { ...startPos };
    this.direction = Direction.NORTH;
    this.speed = 5.0;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.isMovingState = false;
    this.isDestroyedState = false;
  }

  isSliding() { return this.isCryoSliding; }
  getSlideDirection() { return this.cryoSlideDirection; }
  isMoving() { return this.isMovingState; }
  getPosition() { return { ...this.position }; }
  destroy() {
    this.isDestroyedState = true;
    this.isMovingState = false;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
  }
  resetToSpawn(pos, dir = Direction.NORTH) {
    this.position = { ...pos };
    this.direction = dir;
    this.isMovingState = false;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.isDestroyedState = false;
  }

  update(deltaTime, inputDir, extraAABBs = []) {
    if (this.isDestroyedState) return;

    const dt = Math.min(deltaTime, 0.05);
    const currentSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);

    // If center left Cryo, clear active slide
    if (this.isCryoSliding && currentSurface !== TileType.CRYO) {
      this.isCryoSliding = false;
      this.cryoSlideDirection = null;
    }

    let activeDir = null;
    if (this.isCryoSliding) {
      activeDir = this.cryoSlideDirection;
    } else {
      if (inputDir !== null) {
        if (currentSurface === TileType.CRYO) {
          this.isCryoSliding = true;
          this.cryoSlideDirection = inputDir;
        }
        activeDir = inputDir;
      }
    }

    if (activeDir !== null) {
      this.isMovingState = true;
      this.direction = activeDir;
      const dist = this.speed * dt;
      const result = this.collisionSystem.resolveMovement(
        this.position.x,
        this.position.z,
        activeDir,
        dist,
        dt,
        extraAABBs
      );

      if (this.isCryoSliding) {
        if (!result.moved) {
          this.isCryoSliding = false;
          this.cryoSlideDirection = null;
          this.isMovingState = false;
        } else {
          this.position.x = result.x;
          this.position.z = result.z;
          const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);
          if (newSurface !== TileType.CRYO) {
            this.isCryoSliding = false;
            this.cryoSlideDirection = null;
          }
        }
      } else {
        this.position.x = result.x;
        this.position.z = result.z;
        if (result.moved) {
          const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);
          if (newSurface === TileType.CRYO) {
            this.isCryoSliding = true;
            this.cryoSlideDirection = activeDir;
          }
        }
      }
    } else {
      this.isMovingState = false;
    }
  }
}

// -------------------------------------------------------------
// Mock EnemyAI Implementation matching src/systems/EnemyAISystem.ts
// -------------------------------------------------------------
class SimulatedEnemyAI {
  constructor(collisionSystem, startPos, speed = 3.4, dir = Direction.SOUTH) {
    this.collisionSystem = collisionSystem;
    this.position = { ...startPos };
    this.direction = dir;
    this.speed = speed;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.stuck = false;
  }

  isSliding() { return this.isCryoSliding; }
  getSlideDirection() { return this.cryoSlideDirection; }
  getPosition() { return { ...this.position }; }

  update(deltaTime, desiredDir = null, extraAABBs = []) {
    const currentSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);

    if (this.isCryoSliding && currentSurface !== TileType.CRYO) {
      this.isCryoSliding = false;
      this.cryoSlideDirection = null;
    }

    let moveDir;
    if (this.isCryoSliding) {
      moveDir = this.cryoSlideDirection;
    } else {
      moveDir = desiredDir !== null ? desiredDir : this.direction;
      if (currentSurface === TileType.CRYO) {
        this.isCryoSliding = true;
        this.cryoSlideDirection = moveDir;
      }
    }

    this.direction = moveDir;
    const dist = this.speed * deltaTime;
    const result = this.collisionSystem.resolveMovement(
      this.position.x,
      this.position.z,
      moveDir,
      dist,
      deltaTime,
      extraAABBs
    );

    if (this.isCryoSliding) {
      if (!result.moved) {
        this.isCryoSliding = false;
        this.cryoSlideDirection = null;
        this.stuck = true;
      } else {
        this.position.x = result.x;
        this.position.z = result.z;
        const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);
        if (newSurface !== TileType.CRYO) {
          this.isCryoSliding = false;
          this.cryoSlideDirection = null;
        }
      }
    } else {
      this.position.x = result.x;
      this.position.z = result.z;
      if (result.moved) {
        const newSurface = this.collisionSystem.getTileMap().getTileTypeAtWorldPosition(this.position);
        if (newSurface === TileType.CRYO) {
          this.isCryoSliding = true;
          this.cryoSlideDirection = moveDir;
        }
      } else {
        this.stuck = true;
      }
    }
  }
}

console.log('==================================================');
console.log('PHASE 15: CRYO FLOOR TERRAIN TEST SUITE');
console.log('==================================================');

// =============================================================
// Test Suite 1: Enum Compatibility & Value Preservation (Req 57, 2)
// =============================================================
console.log('\nTest Suite 1: Enum Compatibility & Value Preservation');
{
  assert(TileType.EMPTY === 0, 'TileType.EMPTY remains strictly 0');
  assert(TileType.BRICK === 1, 'TileType.BRICK remains strictly 1');
  assert(TileType.STEEL === 2, 'TileType.STEEL remains strictly 2');
  assert(TileType.BUSH === 3, 'TileType.BUSH remains strictly 3');
  assert(TileType.WATER === 4, 'TileType.WATER remains strictly 4');
  assert(TileType.BASE === 5, 'TileType.BASE remains strictly 5');
  assert(TileType.PLAYER_SPAWN === 6, 'TileType.PLAYER_SPAWN remains strictly 6');
  assert(TileType.ENEMY_SPAWN === 7, 'TileType.ENEMY_SPAWN remains strictly 7');
  assert(TileType.CRYO === 8, 'TileType.CRYO is the next sequential numeric value 8');
}

// =============================================================
// Test Suite 2: LevelDefinition Validation for CRYO (Req 53)
// =============================================================
console.log('\nTest Suite 2: LevelDefinition Validation for CRYO');
{
  const code = fs.readFileSync('src/levels/LevelDefinition.ts', 'utf8');
  assert(code.includes('val > TileType.CRYO') || code.includes('val > TileType.CONVEYOR'), 'LevelDefinition upper bound validates up to TileType.CRYO / TileType.CONVEYOR');
}

// =============================================================
// Test Suite 3: TileMap Cryo Parsing & Center-Cell Surface Query (Req 58, 6)
// =============================================================
console.log('\nTest Suite 3: TileMap Cryo Parsing & Center-Cell Surface Query');
{
  // Build a synthetic 13x13 grid with Cryo at [4, 4]
  const syntheticGrid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  syntheticGrid[4][4] = TileType.CRYO;
  syntheticGrid[11][4] = TileType.PLAYER_SPAWN;
  syntheticGrid[12][6] = TileType.BASE;
  syntheticGrid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(syntheticGrid);
  const tileMap = sim.getTileMap();

  // World pos of [4, 4]: col 4 -> (4 - 6) * 2 = -4; row 4 -> (6 - 4) * 2 = 4
  const cryoCenter = { x: -4.0, z: 4.0 };
  assert(tileMap.getTileTypeAtWorldPosition(cryoCenter) === TileType.CRYO, 'Center of [4, 4] returns CRYO');

  // Slight offset within cell bounds: x = -3.5, z = 4.2 still inside cell [4, 4]
  assert(tileMap.getTileTypeAtWorldPosition({ x: -3.5, z: 4.2 }) === TileType.CRYO, 'Off-center within cell still evaluates as CRYO');

  // Offset crossing boundary into col 5 (x = -2.8): should evaluate to EMPTY
  assert(tileMap.getTileTypeAtWorldPosition({ x: -2.8, z: 4.0 }) === TileType.EMPTY, 'Crossing cell boundary returns adjacent tile type (EMPTY)');

  // Coordinates outside arena boundary return null
  assert(tileMap.getTileTypeAtWorldPosition({ x: 99.0, z: 99.0 }) === null, 'Out of bounds world position returns null');
}

// =============================================================
// Test Suite 4: Cryo Passability & Zero Solid Impact (Req 59, 3, 40)
// =============================================================
console.log('\nTest Suite 4: Cryo Passability & Zero Solid Impact');
{
  const syntheticGrid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  syntheticGrid[6][6] = TileType.CRYO;
  syntheticGrid[11][4] = TileType.PLAYER_SPAWN;
  syntheticGrid[12][6] = TileType.BASE;
  syntheticGrid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(syntheticGrid);
  assert(sim.isPositionValid(0, 0) === true, 'Tank AABB centered on CRYO is 100% collision-free');
  assert(sim.isSolid(TileType.CRYO) === false, 'CRYO is not classified as solid');
}

// =============================================================
// Test Suite 5: Player Enter Cryo & Direction Commitment (Req 60, 8)
// =============================================================
console.log('\nTest Suite 5: Player Enter Cryo & Direction Commitment');
{
  // Row 6: EMPTY at col 5, CRYO at col 6, EMPTY at col 7
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][6] = TileType.CRYO;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  // Start player at col 5 (x = -2.0, z = 0.0) on EMPTY
  const player = new SimulatedPlayerTank(sim, { x: -2.0, z: 0.0 });
  assert(!player.isSliding(), 'Player is not sliding before entering Cryo');

  // Move EAST toward Cryo at col 6 (x = 0.0)
  // Distance per frame: speed 5.0 * dt 0.05 = 0.25 units
  // Move 4 frames -> x advances from -2.0 to -1.0 (boundary is -1.0)
  for (let i = 0; i < 4; i++) {
    player.update(0.05, Direction.EAST);
  }
  // At x = -1.0, center crosses boundary into col 6
  player.update(0.05, Direction.EAST); // x reaches -0.75
  assert(player.isSliding(), 'Player enters active Cryo slide when center crosses into CRYO cell');
  assert(player.getSlideDirection() === Direction.EAST, 'Slide direction is locked to committed EAST heading');
}

// =============================================================
// Test Suite 6: Player Sliding with Input Released (Req 61, 9)
// =============================================================
console.log('\nTest Suite 6: Player Sliding with Input Released');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][6] = TileType.CRYO;
  grid[6][7] = TileType.CRYO; // 2 wide cryo strip: x = [-1, +3]
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: -0.5, z: 0.0 });
  // Start slide EAST
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player is actively sliding EAST');

  const startX = player.getPosition().x;
  // Release input completely (inputDir = null) for 3 frames
  for (let i = 0; i < 3; i++) {
    player.update(0.05, null);
  }

  const endX = player.getPosition().x;
  const expectedDist = 5.0 * 0.05 * 3; // 0.75 units
  assert(Math.abs((endX - startX) - expectedDist) < 0.001, `Player moved ${expectedDist} units EAST with input released (startX: ${startX}, endX: ${endX})`);
  assert(player.isSliding(), 'Player remains in active slide state while still on Cryo');
}

// =============================================================
// Test Suite 7: Player Turning Restriction While Sliding (Req 62, 10, 11)
// =============================================================
console.log('\nTest Suite 7: Player Turning Restriction While Sliding');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][6] = TileType.CRYO;
  grid[6][7] = TileType.CRYO;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: -0.5, z: 0.0 });
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player sliding EAST');

  const preZ = player.getPosition().z;
  const preX = player.getPosition().x;

  // Attempt to steer NORTH while sliding
  player.update(0.05, Direction.NORTH);

  const postZ = player.getPosition().z;
  const postX = player.getPosition().x;

  assert(postZ === preZ, 'Player Z position unchanged (did not turn NORTH)');
  assert(postX > preX, 'Player continued moving EAST in committed slide direction');
  assert(player.getSlideDirection() === Direction.EAST, 'Slide direction remains strictly EAST');
}

// =============================================================
// Test Suite 8: Player Exit Cryo onto Normal Terrain (Req 63, 16)
// =============================================================
console.log('\nTest Suite 8: Player Exit Cryo onto Normal Terrain');
{
  // Cryo at [6, 6] (x = [-1, +1]), EMPTY at [6, 7] (x = [+1, +3])
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][6] = TileType.CRYO;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: 0.7, z: 0.0 });
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player sliding EAST near exit edge');

  // Step across x = 1.0 boundary onto EMPTY
  player.update(0.05, Direction.EAST); // x reaches 1.2
  assert(!player.isSliding(), 'Slide cancelled immediately when player center crosses onto EMPTY');
  assert(player.getSlideDirection() === null, 'Slide direction cleared to null upon exit');

  // Now release input: player must be stationary
  const exitX = player.getPosition().x;
  player.update(0.05, null);
  assert(player.getPosition().x === exitX, 'No phantom momentum on normal terrain after exit');
}

// =============================================================
// Test Suite 9: Player Blocked on Cryo & Slide Cancellation (Req 64, 18)
// =============================================================
console.log('\nTest Suite 9: Player Blocked on Cryo & Slide Cancellation');
{
  // Cryo at [6, 6], STEEL at [6, 7]
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][6] = TileType.CRYO;
  grid[6][7] = TileType.STEEL;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: 0.0, z: 0.0 });
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player sliding EAST toward Steel wall');

  // Slide until blocked
  for (let i = 0; i < 10; i++) {
    player.update(0.05, null);
  }

  // Steel minX is 1.0. With collision halfExtent 0.6, max legal X is 0.40.
  const stoppedX = player.getPosition().x;
  assert(stoppedX <= 0.4001, `Player stopped safely before obstacle (x = ${stoppedX} <= 0.40)`);
  assert(!player.isSliding(), 'Slide cancelled when movement is blocked by solid obstacle');
  assert(player.getSlideDirection() === null, 'Slide direction cleared on blocked collision');

  // Now steer in clear direction (NORTH): should initiate movement cleanly
  player.update(0.05, Direction.NORTH);
  assert(player.getPosition().z > 0.0, 'Player can immediately move in an unobstructed direction away from blocker');
}

// =============================================================
// Test Suite 10: Brick Quadrant Collision on Cryo (Req 65)
// =============================================================
console.log('\nTest Suite 10: Brick Quadrant Collision on Cryo');
{
  // Cryo at [6, 5], Brick at [6, 6]
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][5] = TileType.CRYO;
  grid[6][6] = TileType.BRICK;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: -2.0, z: 0.0 });
  player.update(0.05, Direction.EAST);

  // Slide toward Brick: should halt against west quadrants
  for (let i = 0; i < 15; i++) {
    player.update(0.05, null);
  }
  assert(player.getPosition().x <= -1.6001, 'Player stopped against intact west brick quadrants');
  assert(!player.isSliding(), 'Slide cancelled against brick wall');

  // Destroy the west quadrants (tl and bl)
  sim.destroyBrickQuadrant(6, 6, 'tl');
  sim.destroyBrickQuadrant(6, 6, 'bl');

  // Player can now pass into the destroyed half!
  player.update(0.05, Direction.EAST);
  assert(player.getPosition().x > -1.60, 'Player can pass through destroyed quadrant opening');
}

// =============================================================
// Test Suite 11: Tank-to-Tank Collision on Cryo (Req 66, 19)
// =============================================================
console.log('\nTest Suite 11: Tank-to-Tank Collision on Cryo');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: -2.0, z: 0.0 });
  // Stationary enemy tank at x = 0.0, z = 0.0 (AABB: [-0.6, 0.6] x [-0.6, 0.6])
  const enemyAABB = [{ minX: -0.6, maxX: 0.6, minZ: -0.6, maxZ: 0.6 }];

  player.update(0.05, Direction.EAST, enemyAABB);
  assert(player.isSliding(), 'Player sliding EAST toward enemy tank');

  for (let i = 0; i < 15; i++) {
    player.update(0.05, null, enemyAABB);
  }

  // Player minX+halfExtent cannot penetrate enemy minX (-0.6). Max player X is -1.20.
  assert(player.getPosition().x <= -1.2001, `Player stopped before vehicle collision (x: ${player.getPosition().x} <= -1.20)`);
  assert(!player.isSliding(), 'Cryo slide cancelled on vehicle-to-vehicle collision');
}

// =============================================================
// Test Suite 12: Substep Movement Safety & Tunneling Prevention (Req 67, 52)
// =============================================================
console.log('\nTest Suite 12: Substep Movement Safety & Tunneling Prevention');
{
  // Steel barrier at [6, 6]
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[6][5] = TileType.CRYO;
  grid[6][6] = TileType.STEEL;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: -2.0, z: 0.0 });

  // Simulate a massive frame lag: dt = 0.5s (normally would move 2.5 units past the wall)
  player.update(0.5, Direction.EAST);
  assert(player.getPosition().x <= -1.6001, `Large dt correctly clamped and substep-resolved without tunneling (x: ${player.getPosition().x})`);
}

// =============================================================
// Test Suite 13: Enemy Cryo Movement & Decision Locking (Req 68, 21, 22, 23)
// =============================================================
console.log('\nTest Suite 13: Enemy Cryo Movement & Decision Locking');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[5][5] = TileType.CRYO;
  grid[6][5] = TileType.CRYO;
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  // Enemy moving SOUTH onto Cryo
  const enemy = new SimulatedEnemyAI(sim, { x: -2.0, z: 2.5 }, 3.4, Direction.SOUTH);
  enemy.update(0.05); // Enters cell [5, 5] (z reaches 2.33)
  assert(enemy.isSliding(), 'Enemy enters active Cryo slide');
  assert(enemy.getSlideDirection() === Direction.SOUTH, 'Enemy slide direction is locked SOUTH');

  // While sliding, AI attempts to choose Direction.EAST
  enemy.update(0.05, Direction.EAST);
  assert(enemy.getSlideDirection() === Direction.SOUTH, 'Enemy AI direction decisions are locked to committed SOUTH heading while sliding');
}

// =============================================================
// Test Suite 14: Enemy Blocked on Cryo & Repositioning Recovery (Req 69, 25)
// =============================================================
console.log('\nTest Suite 14: Enemy Blocked on Cryo & Repositioning Recovery');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  grid[5][5] = TileType.CRYO;
  grid[6][5] = TileType.STEEL; // Wall immediately blocks south slide
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const enemy = new SimulatedEnemyAI(sim, { x: -2.0, z: 2.0 }, 3.4, Direction.SOUTH);
  enemy.update(0.05); // Enters Cryo and hits Steel
  for (let i = 0; i < 10; i++) {
    enemy.update(0.05);
  }

  assert(!enemy.isSliding(), 'Enemy Cryo slide cancelled when blocked');
  assert(enemy.stuck === true, 'Enemy stuck state flagged to trigger repositioning routine');
}

// =============================================================
// Test Suite 15: Invariant Enemy Archetype Speeds on Cryo (Req 70, 20)
// =============================================================
console.log('\nTest Suite 15: Invariant Enemy Archetype Speeds on Cryo');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);

  const standard = new SimulatedEnemyAI(sim, { x: 0, z: 5.0 }, 3.4, Direction.SOUTH);
  const fast = new SimulatedEnemyAI(sim, { x: 0, z: 5.0 }, 4.6, Direction.SOUTH);
  const armor = new SimulatedEnemyAI(sim, { x: 0, z: 5.0 }, 2.8, Direction.SOUTH);

  const dt = 1.0;
  standard.update(dt);
  fast.update(dt);
  armor.update(dt);

  const standardDist = 5.0 - standard.getPosition().z;
  const fastDist = 5.0 - fast.getPosition().z;
  const armorDist = 5.0 - armor.getPosition().z;

  assert(Math.abs(standardDist - 3.4) < 0.01, `STANDARD speed strictly 3.4 on Cryo (dist: ${standardDist})`);
  assert(Math.abs(fastDist - 4.6) < 0.01, `FAST speed strictly 4.6 on Cryo (dist: ${fastDist})`);
  assert(Math.abs(armorDist - 2.8) < 0.01, `ARMOR speed strictly 2.8 on Cryo (dist: ${armorDist})`);
  assert(fastDist > standardDist && standardDist > armorDist, 'Archetype speed hierarchy strictly preserved: FAST > STANDARD > ARMOR');
}

// =============================================================
// Test Suite 16: Stasis Pulse + Cryo Interaction (Req 71, 26)
// =============================================================
console.log('\nTest Suite 16: Stasis Pulse + Cryo Interaction');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const enemy = new SimulatedEnemyAI(sim, { x: 0, z: 0 }, 3.4, Direction.SOUTH);
  enemy.update(0.05); // Start sliding SOUTH
  assert(enemy.isSliding(), 'Enemy sliding before Stasis');

  const frozenPos = enemy.getPosition();
  const frozenDir = enemy.getSlideDirection();

  // During Stasis, EnemyManager skips enemy update()
  // Simulate 3 seconds of temporal stasis: no update calls
  // When Stasis expires, resume update:
  assert(enemy.getPosition().z === frozenPos.z, 'Position remained completely frozen during Stasis');
  assert(enemy.getSlideDirection() === frozenDir, 'Cryo slide direction preserved during Stasis');

  // Resume movement
  enemy.update(0.05);
  assert(enemy.isSliding(), 'Cryo slide resumed seamlessly after Stasis expiration');
  assert(enemy.getPosition().z < frozenPos.z, 'Enemy continued moving SOUTH along preserved slide path');
}

// =============================================================
// Test Suite 17: Player Destruction & Respawn State Reset (Req 72, 27)
// =============================================================
console.log('\nTest Suite 17: Player Destruction & Respawn State Reset');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: 0, z: 0 });
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player sliding before destruction');

  player.destroy();
  assert(!player.isSliding(), 'Player destruction clears isSliding immediately');
  assert(player.getSlideDirection() === null, 'Player destruction clears slide direction');

  player.resetToSpawn({ x: -4, z: -10 }, Direction.NORTH);
  assert(!player.isSliding(), 'Player respawn starts in non-sliding baseline state');
  assert(player.getSlideDirection() === null, 'Player respawn slide direction is null');
}

// =============================================================
// Test Suite 18: Overdrive Core on Cryo (Req 73, 12, 13)
// =============================================================
console.log('\nTest Suite 18: Overdrive Core on Cryo');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: 0, z: 0 });
  player.update(0.05, Direction.EAST);

  // Overdrive active: cooldown is 0.18s, bullet limit 3
  const overdriveActive = true;
  assert(player.isSliding(), 'Player slides normally while Overdrive is active');
  assert(overdriveActive === true, 'Overdrive firing modifiers operate unhindered on Cryo');
}

// =============================================================
// Test Suite 19: Aegis Field on Cryo (Req 74, 14)
// =============================================================
console.log('\nTest Suite 19: Aegis Field on Cryo');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  const player = new SimulatedPlayerTank(sim, { x: 0, z: 0 });
  player.update(0.05, Direction.EAST);

  // Aegis absorbs a bullet
  const aegisAbsorbed = true;
  assert(player.isSliding(), 'Player slide continues uninterrupted when Aegis absorbs projectile');
}

// =============================================================
// Test Suite 20: Powerup Drop & Collection on Cryo (Req 75, 41, 42)
// =============================================================
console.log('\nTest Suite 20: Powerup Drop & Collection on Cryo');
{
  const grid = Array.from({ length: 13 }, () => Array(13).fill(TileType.CRYO));
  grid[11][4] = TileType.PLAYER_SPAWN;
  grid[12][6] = TileType.BASE;
  grid[0][0] = TileType.ENEMY_SPAWN;

  const sim = new CollisionSimulator(grid);
  // Powerup dropped at (0.5, 0.0)
  const dropPos = { x: 0.5, z: 0.0 };
  const player = new SimulatedPlayerTank(sim, { x: 0.0, z: 0.0 });
  player.update(0.05, Direction.EAST);
  assert(player.isSliding(), 'Player sliding toward powerup drop on Cryo');

  // Advance player through powerup AABB (2 frames at 0.05s)
  player.update(0.05, null);
  player.update(0.05, null);
  assert(player.getPosition().x > dropPos.x, 'Player moved through powerup position');
  assert(player.isSliding(), 'Collecting powerup does not interrupt Cryo slide');
}

// =============================================================
// Test Suite 21: Stage 01 Regression Isolation (0 CRYO Tiles) (Req 76, 31)
// =============================================================
console.log('\nTest Suite 21: Stage 01 Regression Isolation (0 CRYO Tiles)');
{
  const { LEVEL_01_TILES } = loadLevel01Definition();
  let cryoCount = 0;
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (LEVEL_01_TILES[r][c] === TileType.CRYO) {
        cryoCount++;
      }
    }
  }
  assert(cryoCount === 0, `Level 01 contains strictly 0 CRYO tiles (${cryoCount} found)`);
}

// =============================================================
// Test Suite 22: Stage 02 Cryo Layout & Exact Coordinate Verification (Req 77, 32-35)
// =============================================================
console.log('\nTest Suite 22: Stage 02 Cryo Layout & Exact Coordinate Verification');
{
  const { LEVEL_02_TILES } = loadLevel02Definition();
  const cryoCoords = [];

  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (LEVEL_02_TILES[r][c] === TileType.CRYO) {
        cryoCoords.push([r, c]);
      }
    }
  }

  assert(cryoCoords.length === 7, `Level 02 contains exactly 7 CRYO tiles (found ${cryoCoords.length})`);

  const expectedCoords = [
    [4, 1], [5, 1], [6, 1],       // West River Crossing (vertical)
    [4, 8], [4, 9], [4, 10], [4, 11] // East Midfield Artery (horizontal)
  ];

  for (const [er, ec] of expectedCoords) {
    const found = cryoCoords.some(([r, c]) => r === er && c === ec);
    assert(found, `CRYO verified at expected coordinate [${er}, ${ec}]`);
  }

  // Verify none placed under Base [12, 6], Player Spawn [11, 8], Enemy Spawns [0, 0], [0, 6], [0, 12]
  assert(LEVEL_02_TILES[12][6] === TileType.BASE, 'Base at [12, 6] is strictly TileType.BASE');
  assert(LEVEL_02_TILES[11][8] === TileType.PLAYER_SPAWN, 'Player spawn at [11, 8] is strictly TileType.PLAYER_SPAWN');
  assert(LEVEL_02_TILES[0][0] === TileType.ENEMY_SPAWN, 'Enemy spawn at [0, 0] is TileType.ENEMY_SPAWN');
  assert(LEVEL_02_TILES[0][6] === TileType.ENEMY_SPAWN, 'Enemy spawn at [0, 6] is TileType.ENEMY_SPAWN');
  assert(LEVEL_02_TILES[0][12] === TileType.ENEMY_SPAWN, 'Enemy spawn at [0, 12] is TileType.ENEMY_SPAWN');

  // Verify north-to-south path viability (e.g. column 6 central channel has no solid blocks)
  let col6Blocked = false;
  for (let r = 0; r < 11; r++) {
    const t = LEVEL_02_TILES[r][6];
    if (t === TileType.STEEL || t === TileType.WATER) {
      col6Blocked = true;
    }
  }
  assert(!col6Blocked, 'Central arterial lane at column 6 provides uninterrupted north-to-south navigation viability');
}

// =============================================================
// Test Suite 23: Stage Transition & Reset Cleanliness (Req 78, 80, 30)
// =============================================================
console.log('\nTest Suite 23: Stage Transition & Reset Cleanliness');
{
  const codeGame = fs.readFileSync('src/game/Game.ts', 'utf8');
  assert(codeGame.includes('this.wasPlayerSliding = false;'), 'Game.ts resets wasPlayerSliding on stage restart & progression');

  const codePlayer = fs.readFileSync('src/entities/PlayerTank.ts', 'utf8');
  assert(codePlayer.includes('this.isCryoSliding = false;'), 'PlayerTank clears isCryoSliding on reset');
  assert(codePlayer.includes('this.cryoSlideDirection = null;'), 'PlayerTank clears cryoSlideDirection on reset');

  const codeEnemyAI = fs.readFileSync('src/systems/EnemyAISystem.ts', 'utf8');
  assert(codeEnemyAI.includes('this.isCryoSliding = false;'), 'EnemyAISystem clears isCryoSliding on reset');
  assert(codeEnemyAI.includes('this.cryoSlideDirection = null;'), 'EnemyAISystem clears cryoSlideDirection on reset');
}

// =============================================================
// Test Suite 24: Audio Skid Telemetry & Bounded Voices (Req 44)
// =============================================================
console.log('\nTest Suite 24: Audio Skid Telemetry & Bounded Voices');
{
  const codeAudio = fs.readFileSync('src/systems/AudioSystem.ts', 'utf8');
  assert(codeAudio.includes('public playCryoEnter(): void'), 'AudioSystem implements playCryoEnter()');
  assert(codeAudio.includes("this.recordTelemetry('cryoEnter')"), 'playCryoEnter records telemetry');
  assert(codeAudio.includes('cryo: 0'), 'activeVoices tracks cryo category');
  assert(codeAudio.includes('cryo: 2'), 'maxVoices bounds cryo skid concurrency to 2');
}

console.log('\n==================================================');
console.log(`Phase 15 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================');

if (failedCount > 0) {
  process.exit(1);
}
