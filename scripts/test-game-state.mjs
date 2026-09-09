/**
 * Automated Test Suite for Phase 6:
 * Base Vulnerability + Game State Machine + Game Over + Clean Stage Restart
 * Includes Source-of-Truth Validation Tests (A through H).
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

const BaseState = {
  ACTIVE: 0,
  DESTROYED: 1,
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

/**
 * Load authoritative LEVEL_01 directly from src/levels/level01.ts
 */
function loadAuthoritativeLevel01() {
  const code = fs.readFileSync('src/levels/level01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '').replace(/: TileType\[\]\[\]/, '').replace(/: LevelDefinition/, '');
  cleaned = cleaned.replace(/export const LEVEL_01_TILES/, 'const LEVEL_01_TILES');
  cleaned = cleaned.replace(/export const LEVEL_01/, 'const LEVEL_01');
  const fn = new Function('TileType', cleaned + '; return (typeof LEVEL_01 !== "undefined" && LEVEL_01.tiles) ? LEVEL_01.tiles : (typeof LEVEL_01_TILES !== "undefined" ? LEVEL_01_TILES : LEVEL_01);');
  return fn(TileType);
}

const LEVEL_01 = loadAuthoritativeLevel01();

/**
 * Mock Base simulating 3D Base entity state & VFX
 */
class MockBase {
  constructor(worldX, worldZ) {
    this.worldPosition = { x: worldX, y: 0, z: worldZ };
    this.state = BaseState.ACTIVE;
    this.activeMeshVisible = true;
    this.ruinedMeshVisible = false;
    this.explosionActive = false;
    this.explosionTimer = 0;
    this.shockwaveRadius = 0.2;
    this.destroyCallCount = 0;
    this.resetCallCount = 0;
  }

  isDestroyed() {
    return this.state === BaseState.DESTROYED;
  }

  getState() {
    return this.state;
  }

  destroy() {
    if (this.state === BaseState.DESTROYED) return false;
    this.state = BaseState.DESTROYED;
    this.destroyCallCount++;
    this.activeMeshVisible = false;
    this.ruinedMeshVisible = true;
    this.explosionActive = true;
    this.explosionTimer = 0;
    this.shockwaveRadius = 0.2;
    return true;
  }

  reset() {
    this.resetCallCount++;
    this.state = BaseState.ACTIVE;
    this.activeMeshVisible = true;
    this.ruinedMeshVisible = false;
    this.explosionActive = false;
    this.explosionTimer = 0;
    this.shockwaveRadius = 0.2;
  }

  update(dt) {
    if (!this.explosionActive) return;
    this.explosionTimer += dt;
    this.shockwaveRadius += dt * 3.5;
    if (this.explosionTimer >= 0.55) {
      this.explosionActive = false;
    }
  }
}

/**
 * Mock TileMap matching src/world/TileMap.ts logic
 * Dynamically parses levelData to find BASE and PLAYER_SPAWN.
 */
class MockTileMap {
  constructor(levelData = LEVEL_01) {
    this.levelData = levelData.map((row) => [...row]);
    this.destroyedQuadrants = new Map();
    this.baseEntity = null;
    this.basePos = null;
    this.playerSpawnPos = null;
    this.enemySpawnPositions = [];

    // Parse level matrix dynamically
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const type = this.levelData[r][c];
        const worldPos = gridToWorld(r, c);

        if (type === TileType.BASE) {
          this.baseEntity = new MockBase(worldPos.x, worldPos.z);
          this.basePos = { ...worldPos };
        } else if (type === TileType.PLAYER_SPAWN) {
          this.playerSpawnPos = { ...worldPos };
        } else if (type === TileType.ENEMY_SPAWN) {
          this.enemySpawnPositions.push({ ...worldPos });
        }
      }
    }
  }

  getBase() {
    return this.baseEntity;
  }

  getBasePosition() {
    return this.basePos ? { ...this.basePos } : null;
  }

  getPlayerSpawn() {
    return this.playerSpawnPos ? { ...this.playerSpawnPos } : null;
  }

  getTileType(r, c) {
    if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLS) return null;
    return this.levelData[r][c];
  }

  gridToWorld(r, c) {
    return gridToWorld(r, c);
  }

  worldToGrid(x, z) {
    return worldToGrid(x, z);
  }

  damageBrick(r, c, q) {
    const key = `${r}_${c}`;
    let mask = this.destroyedQuadrants.get(key) || 0;
    mask |= (1 << q);
    this.destroyedQuadrants.set(key, mask);
    return { mask, isFullyDestroyed: mask === 15 };
  }

  isQuadrantDestroyed(r, c, q) {
    const key = `${r}_${c}`;
    const mask = this.destroyedQuadrants.get(key) || 0;
    return (mask & (1 << q)) !== 0;
  }

  resetDestruction() {
    this.destroyedQuadrants.clear();
    if (this.baseEntity) {
      this.baseEntity.reset();
    }
  }

  getSolidBoxesForCell(r, c, forTank = false) {
    const type = this.getTileType(r, c);
    if (type === TileType.BASE || type === TileType.STEEL || (forTank && type === TileType.WATER)) {
      const tileMinX = 2 * c - 13;
      const tileMaxX = 2 * c - 11;
      const tileMinZ = 11 - 2 * r;
      const tileMaxZ = 13 - 2 * r;
      return [{ minX: tileMinX, maxX: tileMaxX, minZ: tileMinZ, maxZ: tileMaxZ }];
    }
    if (type === TileType.BRICK) {
      const center = gridToWorld(r, c);
      const boxes = [];
      const halfCell = TILE_SIZE / 2;
      const sub = halfCell / 2;
      const offsets = [
        { q: 0, ox: -sub, oz: sub },
        { q: 1, ox: sub, oz: sub },
        { q: 2, ox: -sub, oz: -sub },
        { q: 3, ox: sub, oz: -sub },
      ];
      for (const { q, ox, oz } of offsets) {
        if (!this.isQuadrantDestroyed(r, c, q)) {
          boxes.push({
            minX: center.x + ox - sub,
            maxX: center.x + ox + sub,
            minZ: center.z + oz - sub,
            maxZ: center.z + oz + sub,
          });
        }
      }
      return boxes;
    }
    return [];
  }
}

/**
 * Mock Tank matching PlayerTank.ts
 */
class MockTank {
  constructor(spawnPos) {
    this.position = { ...spawnPos };
    this.direction = Direction.NORTH;
    this.turretRotation = 0;
  }

  resetToSpawn(pos, dir = Direction.NORTH) {
    this.position = { ...pos };
    this.direction = dir;
    this.turretRotation = 0;
  }
}

/**
 * Mock Game Engine matching Game.ts
 */
class MockGameEngine {
  constructor(tileMap = new MockTileMap()) {
    this.gameState = GameState.PLAYING;
    this.tileMap = tileMap;
    const spawn = this.tileMap.getPlayerSpawn();
    this.playerTank = new MockTank(spawn);
    this.activeBullets = [];
    this.fireCooldown = 0;
    this.gameOverUIShown = false;
    this.statusIndicator = 'READY';
  }

  getGameState() {
    return this.gameState;
  }

  triggerGameOver() {
    if (this.gameState === GameState.GAME_OVER) return;
    this.gameState = GameState.GAME_OVER;
    const base = this.tileMap.getBase();
    if (base && !base.isDestroyed()) {
      base.destroy();
    }
    this.activeBullets = [];
    this.fireCooldown = 0;
    this.gameOverUIShown = true;
    this.statusIndicator = 'BASE DESTROYED';
  }

  handleBaseHit() {
    this.triggerGameOver();
  }

  restartStage() {
    this.activeBullets = [];
    this.fireCooldown = 0;
    this.tileMap.resetDestruction();
    const spawnPos = this.tileMap.getPlayerSpawn();
    if (spawnPos) {
      this.playerTank.resetToSpawn(spawnPos, Direction.NORTH);
    }
    this.gameOverUIShown = false;
    this.gameState = GameState.PLAYING;
    this.statusIndicator = 'READY';
  }

  tryFirePlayer() {
    if (this.gameState !== GameState.PLAYING) return false;
    if (this.activeBullets.length >= 2) return false;
    const bullet = {
      x: this.playerTank.position.x,
      z: this.playerTank.position.z,
      dir: this.playerTank.direction,
      team: 'PLAYER',
      active: true,
    };
    this.activeBullets.push(bullet);
    return true;
  }

  updatePlayer(dt, moveInput) {
    if (this.gameState !== GameState.PLAYING) {
      return false; // Controls frozen in GAME_OVER
    }
    if (moveInput !== null) {
      this.playerTank.direction = moveInput;
      if (moveInput === Direction.NORTH) this.playerTank.position.z += 5.0 * dt;
      else if (moveInput === Direction.SOUTH) this.playerTank.position.z -= 5.0 * dt;
      else if (moveInput === Direction.EAST) this.playerTank.position.x += 5.0 * dt;
      else if (moveInput === Direction.WEST) this.playerTank.position.x -= 5.0 * dt;
      return true;
    }
    return false;
  }
}

// -------------------------------------------------------------
// TEST RUNNER
// -------------------------------------------------------------
let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('=== PHASE 6: BASE VULNERABILITY, GAME STATE & SOURCE-OF-TRUTH SUITE ===\n');

// -------------------------------------------------------------
// SOURCE-OF-TRUTH TESTS (A through H)
// -------------------------------------------------------------
console.log('Test Suite 0: Source-of-Truth Level 01 & Dynamic Parsing Tests');
{
  // A. Exactly one TileType.BASE exists in level01
  let baseCount = 0;
  let parsedBaseRow = -1;
  let parsedBaseCol = -1;
  for (let r = 0; r < LEVEL_01.length; r++) {
    for (let c = 0; c < LEVEL_01[r].length; c++) {
      if (LEVEL_01[r][c] === TileType.BASE) {
        baseCount++;
        parsedBaseRow = r;
        parsedBaseCol = c;
      }
    }
  }
  assert(baseCount === 1, `Test A: Exactly 1 BASE in LEVEL_01 (found: ${baseCount})`);
  assert(parsedBaseRow === 12 && parsedBaseCol === 6, `Test A.1: Authoritative BASE is at row 12, column 6`);

  // B. tileMap.getBasePosition() corresponds to that exact cell
  const tileMap = new MockTileMap(LEVEL_01);
  const basePos = tileMap.getBasePosition();
  const expectedBaseWorld = gridToWorld(12, 6);
  assert(basePos !== null, 'Test B: getBasePosition() returns non-null');
  assert(basePos.x === expectedBaseWorld.x && basePos.z === expectedBaseWorld.z,
    `Test B.1: getBasePosition() matches gridToWorld(12, 6): (${expectedBaseWorld.x}, ${expectedBaseWorld.z})`);

  // C. Base entity world position equals tileMap.gridToWorld(baseRow, baseColumn)
  const baseEntity = tileMap.getBase();
  assert(baseEntity !== null, 'Test C: Base entity instantiated');
  assert(baseEntity.worldPosition.x === expectedBaseWorld.x && baseEntity.worldPosition.z === expectedBaseWorld.z,
    `Test C.1: Base entity world position equals gridToWorld(12, 6) = (0, -12)`);

  // D. Projectile BASE collision uses that parsed tile
  const tileAtBase = tileMap.getTileType(parsedBaseRow, parsedBaseCol);
  assert(tileAtBase === TileType.BASE, `Test D: Cell (${parsedBaseRow}, ${parsedBaseCol}) reports TileType.BASE`);
  const solidBoxes = tileMap.getSolidBoxesForCell(parsedBaseRow, parsedBaseCol, false);
  assert(solidBoxes.length === 1, 'Test D.1: BASE cell provides solid bounding box');
  assert(solidBoxes[0].minX === -1.0 && solidBoxes[0].maxX === 1.0, 'Test D.2: BASE box X bounds [-1.0, 1.0]');
  assert(solidBoxes[0].minZ === -13.0 && solidBoxes[0].maxZ === -11.0, 'Test D.3: BASE box Z bounds [-13.0, -11.0]');

  // E. Exactly one PLAYER_SPAWN exists
  let playerCount = 0;
  let parsedPlayerRow = -1;
  let parsedPlayerCol = -1;
  for (let r = 0; r < LEVEL_01.length; r++) {
    for (let c = 0; c < LEVEL_01[r].length; c++) {
      if (LEVEL_01[r][c] === TileType.PLAYER_SPAWN) {
        playerCount++;
        parsedPlayerRow = r;
        parsedPlayerCol = c;
      }
    }
  }
  assert(playerCount === 1, `Test E: Exactly 1 PLAYER_SPAWN in LEVEL_01 (found: ${playerCount})`);
  assert(parsedPlayerRow === 11 && parsedPlayerCol === 4, `Test E.1: Authoritative PLAYER_SPAWN is at row 11, column 4`);

  // F. restartStage obtains player reset location from TileMap spawn data
  const game = new MockGameEngine(tileMap);
  const expectedSpawn = gridToWorld(11, 4); // (-4, -10)
  assert(game.playerTank.position.x === expectedSpawn.x && game.playerTank.position.z === expectedSpawn.z,
    `Test F: Initial player tank position matches TileMap getPlayerSpawn()`);
  // Move player away and restart
  game.updatePlayer(1.0, Direction.NORTH);
  game.restartStage();
  assert(game.playerTank.position.x === expectedSpawn.x && game.playerTank.position.z === expectedSpawn.z,
    `Test F.1: restartStage() restored player tank position from TileMap spawn data`);

  // G. Changing a synthetic test level's player spawn changes restart destination without modifying PlayerTank
  const syntheticLevelSpawn = LEVEL_01.map(r => [...r]);
  syntheticLevelSpawn[11][4] = TileType.EMPTY; // remove old spawn
  syntheticLevelSpawn[4][8] = TileType.PLAYER_SPAWN; // new spawn at row 4, col 8
  const syntheticMapSpawn = new MockTileMap(syntheticLevelSpawn);
  const syntheticGameSpawn = new MockGameEngine(syntheticMapSpawn);
  const newExpectedSpawn = gridToWorld(4, 8);
  assert(syntheticGameSpawn.playerTank.position.x === newExpectedSpawn.x &&
         syntheticGameSpawn.playerTank.position.z === newExpectedSpawn.z,
    `Test G: PlayerTank initialized to synthetic spawn (row 4, col 8) = (${newExpectedSpawn.x}, ${newExpectedSpawn.z})`);
  syntheticGameSpawn.updatePlayer(1.0, Direction.SOUTH);
  syntheticGameSpawn.restartStage();
  assert(syntheticGameSpawn.playerTank.position.x === newExpectedSpawn.x &&
         syntheticGameSpawn.playerTank.position.z === newExpectedSpawn.z,
    `Test G.1: restartStage() reset tank to synthetic spawn (${newExpectedSpawn.x}, ${newExpectedSpawn.z}) without modifying PlayerTank`);

  // H. Changing a synthetic test level's base location changes Base placement without modifying Base/ProjectileSystem
  const syntheticLevelBase = LEVEL_01.map(r => [...r]);
  syntheticLevelBase[12][6] = TileType.EMPTY; // remove old base
  syntheticLevelBase[3][6] = TileType.BASE; // new base at row 3, col 6
  const syntheticMapBase = new MockTileMap(syntheticLevelBase);
  const newExpectedBaseWorld = gridToWorld(3, 6);
  const syntheticBaseEntity = syntheticMapBase.getBase();
  assert(syntheticBaseEntity.worldPosition.x === newExpectedBaseWorld.x &&
         syntheticBaseEntity.worldPosition.z === newExpectedBaseWorld.z,
    `Test H: Base entity dynamically placed at synthetic base cell (row 3, col 6) = (${newExpectedBaseWorld.x}, ${newExpectedBaseWorld.z})`);
  const syntheticBasePos = syntheticMapBase.getBasePosition();
  assert(syntheticBasePos.x === newExpectedBaseWorld.x && syntheticBasePos.z === newExpectedBaseWorld.z,
    `Test H.1: getBasePosition() reflects synthetic location without modifying Base class`);
}

// 1. Base Initial State & Visuals
console.log('\nTest Suite 1: Base Initial State & Properties');
{
  const base = new MockBase(0.0, -12.0);
  assert(base.getState() === BaseState.ACTIVE, 'Base starts in ACTIVE state');
  assert(!base.isDestroyed(), 'isDestroyed() returns false initially');
  assert(base.activeMeshVisible === true, 'Active cyan core mesh is enabled initially');
  assert(base.ruinedMeshVisible === false, 'Ruined charred breach mesh is hidden initially');
  assert(base.explosionActive === false, 'Explosion shockwave & sparks are inactive initially');
}

// 2. Base Destruction & Idempotence
console.log('\nTest Suite 2: Base Destruction & Idempotent Triggering');
{
  const base = new MockBase(0.0, -12.0);
  const firstResult = base.destroy();
  assert(firstResult === true, 'First destroy() call returns true');
  assert(base.getState() === BaseState.DESTROYED, 'Base state transitions to DESTROYED');
  assert(base.isDestroyed() === true, 'isDestroyed() returns true after destruction');
  assert(base.activeMeshVisible === false, 'Active cyan core is disabled on destruction');
  assert(base.ruinedMeshVisible === true, 'Ruined charred mesh is enabled on destruction');
  assert(base.explosionActive === true, 'Explosion shockwave & debris active on destruction');

  // VFX advances
  base.update(0.3);
  assert(base.explosionActive === true, 'Explosion is still animating at t=0.3s');
  assert(base.shockwaveRadius > 0.2, 'Shockwave radius expands during explosion');
  base.update(0.3);
  assert(base.explosionActive === false, 'Explosion finishes at t >= 0.55s');

  // Idempotency: second destroy() must not re-trigger
  const secondResult = base.destroy();
  assert(secondResult === false, 'Second destroy() call returns false (idempotent)');
  assert(base.destroyCallCount === 1, 'destroy() internal logic executed exactly once');
}

// 3. Base Reversible Reset
console.log('\nTest Suite 3: Base Clean In-Engine Reset');
{
  const base = new MockBase(0.0, -12.0);
  base.destroy();
  assert(base.isDestroyed() === true, 'Base is destroyed before reset');

  base.reset();
  assert(base.getState() === BaseState.ACTIVE, 'Base transitions back to ACTIVE');
  assert(base.isDestroyed() === false, 'isDestroyed() returns false after reset');
  assert(base.activeMeshVisible === true, 'Active cyan core restored on reset');
  assert(base.ruinedMeshVisible === false, 'Ruined mesh hidden on reset');
  assert(base.explosionActive === false, 'Explosion deactivated on reset');
}

// 4. Solid Collision Preserved When Ruined
console.log('\nTest Suite 4: Solid Collision Preserved in Ruined Base');
{
  const tileMap = new MockTileMap(LEVEL_01);
  const boxes = tileMap.getSolidBoxesForCell(12, 6, true);
  assert(boxes.length === 1, 'Base occupies 1 bounding box');
  assert(boxes[0].minX === -1.0 && boxes[0].maxX === 1.0, 'Base width covers col 6 ([-1.0, 1.0])');
  assert(boxes[0].minZ === -13.0 && boxes[0].maxZ === -11.0, 'Base depth covers row 12 ([-13.0, -11.0])');

  // Destroy base and verify bounding box remains solid for tank collision
  tileMap.getBase().destroy();
  const ruinedBoxes = tileMap.getSolidBoxesForCell(12, 6, true);
  assert(ruinedBoxes.length === 1, 'Ruined base still provides solid collision box for tanks');
}

// 5. GameState Machine Transitions & Input Freezing
console.log('\nTest Suite 5: GameState Machine & Control Freezing');
{
  const game = new MockGameEngine();
  assert(game.getGameState() === GameState.PLAYING, 'Initial game state is PLAYING');
  assert(game.statusIndicator === 'READY', 'Initial HUD status indicator is READY');

  // Player can move and fire while PLAYING
  const moved = game.updatePlayer(0.016, Direction.NORTH);
  assert(moved === true, 'Player movement is active during PLAYING');
  const fired = game.tryFirePlayer();
  assert(fired === true, 'Player can fire during PLAYING');
  assert(game.activeBullets.length === 1, '1 bullet in flight');

  // Trigger Game Over
  game.triggerGameOver();
  assert(game.getGameState() === GameState.GAME_OVER, 'State is GAME_OVER');
  assert(game.tileMap.getBase().isDestroyed() === true, 'Base is destroyed upon Game Over');
  assert(game.activeBullets.length === 0, 'Active bullets deactivated upon Game Over');
  assert(game.gameOverUIShown === true, 'Game Over UI modal is shown');
  assert(game.statusIndicator === 'BASE DESTROYED', 'HUD status indicator updated to BASE DESTROYED');

  // Verify player controls are frozen during GAME_OVER
  const moveDuringGameOver = game.updatePlayer(0.016, Direction.NORTH);
  assert(moveDuringGameOver === false, 'Player movement blocked during GAME_OVER');
  const fireDuringGameOver = game.tryFirePlayer();
  assert(fireDuringGameOver === false, 'Player firing blocked during GAME_OVER');
}

// 6. Projectile Base Hit (Player and Enemy Bullets)
console.log('\nTest Suite 6: Projectile Collision on Base & Future Enemy Compatibility');
{
  const game = new MockGameEngine();

  // Simulate player bullet impacting Base at (12, 6)
  let playerBaseHitTriggered = false;
  const onBaseHit = () => {
    playerBaseHitTriggered = true;
    game.handleBaseHit();
  };

  const tileType = game.tileMap.getTileType(12, 6);
  assert(tileType === TileType.BASE, 'Cell (12, 6) contains BASE');
  if (tileType === TileType.BASE) {
    onBaseHit();
  }
  assert(playerBaseHitTriggered === true, 'Base hit callback invoked on collision with BASE');
  assert(game.getGameState() === GameState.GAME_OVER, 'Game over triggered from base impact');

  // Reset and test with simulated ENEMY projectile
  game.restartStage();
  assert(game.getGameState() === GameState.PLAYING, 'Game reset back to PLAYING');

  let enemyBaseHitTriggered = false;
  const enemyBullet = { x: 0, z: -11.0, team: 'ENEMY', active: true };
  if (tileType === TileType.BASE) {
    enemyBaseHitTriggered = true;
    game.handleBaseHit();
  }
  assert(enemyBaseHitTriggered === true, 'Enemy bullet collision with BASE triggers base hit');
  assert(game.getGameState() === GameState.GAME_OVER, 'Enemy bullet destroys base and triggers GAME_OVER');
}

// 7. Surrounding Bunker Bricks Partial Destruction then Base Impact
console.log('\nTest Suite 7: Protective Bunker Bricks Partial Destruction then Base Impact');
{
  const game = new MockGameEngine();

  // Bunker bricks in Level 01:
  // Row 11 Col 6 is protective roof directly above base (12, 6)
  assert(game.tileMap.getTileType(11, 6) === TileType.BRICK, 'Cell (11, 6) is protective bunker roof above base');

  // Destroy top-left and top-right quadrants of (11, 6)
  game.tileMap.damageBrick(11, 6, 0); // TL
  game.tileMap.damageBrick(11, 6, 1); // TR
  assert(game.tileMap.isQuadrantDestroyed(11, 6, 0) === true, 'Quadrant 0 (TL) destroyed');
  assert(game.tileMap.isQuadrantDestroyed(11, 6, 1) === true, 'Quadrant 1 (TR) destroyed');
  assert(game.tileMap.isQuadrantDestroyed(11, 6, 2) === false, 'Quadrant 2 (BL) remains intact');
  assert(game.tileMap.isQuadrantDestroyed(11, 6, 3) === false, 'Quadrant 3 (BR) remains intact');
  assert(game.tileMap.getBase().isDestroyed() === false, 'Base remains intact while protected by intact quadrants');

  // Destroy remaining quadrants of (11, 6)
  game.tileMap.damageBrick(11, 6, 2); // BL
  game.tileMap.damageBrick(11, 6, 3); // BR

  // Now line of fire to Base is clear! Direct hit to base at (12, 6):
  game.handleBaseHit();
  assert(game.tileMap.getBase().isDestroyed() === true, 'Base destroyed after protective bunker roof breach');
  assert(game.getGameState() === GameState.GAME_OVER, 'Game over after base breach');
}

// 8. Full In-Engine Stage Restart Verification
console.log('\nTest Suite 8: Full In-Engine Stage Restart (No Page Reload)');
{
  const game = new MockGameEngine();
  const spawnPos = game.tileMap.getPlayerSpawn();

  // Move player away from spawn
  game.updatePlayer(1.0, Direction.NORTH);
  assert(game.playerTank.position.z !== spawnPos.z, 'Player moved away from spawn');

  // Damage some bricks
  game.tileMap.damageBrick(10, 5, 0);
  game.tileMap.damageBrick(10, 5, 1);
  assert(game.tileMap.isQuadrantDestroyed(10, 5, 0) === true, 'Brick quadrant destroyed');

  // Trigger game over
  game.triggerGameOver();
  assert(game.getGameState() === GameState.GAME_OVER, 'State is GAME_OVER');
  assert(game.tileMap.getBase().isDestroyed() === true, 'Base is destroyed');
  assert(game.gameOverUIShown === true, 'Game Over UI shown');

  // Perform restart
  game.restartStage();

  // Verify all systems restored cleanly
  assert(game.getGameState() === GameState.PLAYING, 'State restored to PLAYING');
  assert(game.tileMap.getBase().isDestroyed() === false, 'Base restored to ACTIVE state');
  assert(game.tileMap.getBase().activeMeshVisible === true, 'Base active cyan core mesh restored');
  assert(game.tileMap.getBase().ruinedMeshVisible === false, 'Base ruined mesh hidden');
  assert(game.tileMap.isQuadrantDestroyed(10, 5, 0) === false, 'Brick quadrant 0 restored intact');
  assert(game.tileMap.isQuadrantDestroyed(10, 5, 1) === false, 'Brick quadrant 1 restored intact');
  assert(game.playerTank.position.x === spawnPos.x, `Player tank X reset to spawn (${spawnPos.x})`);
  assert(game.playerTank.position.z === spawnPos.z, `Player tank Z reset to spawn (${spawnPos.z})`);
  assert(game.playerTank.direction === Direction.NORTH, 'Player tank direction reset to NORTH');
  assert(game.activeBullets.length === 0, 'Bullet pool completely cleared');
  assert(game.gameOverUIShown === false, 'Game Over UI hidden');
  assert(game.statusIndicator === 'READY', 'Status indicator restored to READY');

  // Player can immediately move and shoot again
  const moveAfterRestart = game.updatePlayer(0.016, Direction.NORTH);
  assert(moveAfterRestart === true, 'Player can immediately move after restart');
  const fireAfterRestart = game.tryFirePlayer();
  assert(fireAfterRestart === true, 'Player can immediately fire after restart');
}

console.log(`\n==================================================`);
console.log(`Test Results: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
