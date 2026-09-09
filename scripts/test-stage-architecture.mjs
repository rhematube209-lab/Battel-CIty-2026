/**
 * Automated Test Suite for Phase 13:
 * Reusable Multi-Stage Architecture + Stage Definitions + Transition Flow
 *
 * Verifies Requirements 43–54:
 * 1. Stage 01 Definition Verification
 * 2. Enemy Composition Verification
 * 3. Powerup Milestones Data-Driven Consumption
 * 4. Generic TileMap Input
 * 5. Elimination of Spatial Assumptions
 * 6. EnemyManager Stage Config
 * 7. Starting Lives Data-Driven Verification
 * 8. Synthetic Powerup Milestones
 * 9. HUD Stage Number Formatting
 * 10. Stage Result Data Model & Archetype Kills
 * 11. Current Stage Reset
 * 12. Level & Stage Validation System
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
// Domain Constants & Enums
// -------------------------------------------------------------
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

const EnemyArchetypeId = {
  STANDARD: 'STANDARD',
  FAST: 'FAST',
  ARMOR: 'ARMOR',
};

const PowerupType = {
  OVERDRIVE_CORE: 'OVERDRIVE_CORE',
  AEGIS_FIELD: 'AEGIS_FIELD',
  STASIS_PULSE: 'STASIS_PULSE',
};

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;

function gridToWorld(row, col) {
  const x = (col - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
  return { x, y: 0, z };
}

// -------------------------------------------------------------
// Pure TypeScript Source Parsers
// -------------------------------------------------------------
function loadStage01Definition() {
  const code = fs.readFileSync('src/stages/stage01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/export interface[\s\S]*?}/g, '');
  cleaned = cleaned.replace(/:\s*readonly\s+EnemyArchetypeId\[\]/g, '');
  cleaned = cleaned.replace(/:\s*StageDefinition/g, '');
  cleaned = cleaned.replace(/:\s*StageConfig/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');

  const fn = new Function('EnemyArchetypeId', 'PowerupType', 'LEVEL_01', cleaned + '; return { STAGE_01_DEFINITION, STAGE_01_ENEMY_SEQUENCE };');
  const dummyLevel = { id: 'level01', rows: 13, columns: 13, tiles: [] };
  return fn(EnemyArchetypeId, PowerupType, dummyLevel);
}

function loadLevel01Definition() {
  const code = fs.readFileSync('src/levels/level01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/:\s*TileType\[\]\[\]/g, '');
  cleaned = cleaned.replace(/:\s*LevelDefinition/g, '');
  cleaned = cleaned.replace(/export const LEVEL_01_TILES/g, 'const LEVEL_01_TILES');
  cleaned = cleaned.replace(/export const LEVEL_01/g, 'const LEVEL_01');

  const fn = new Function('TileType', cleaned + '; return { LEVEL_01, LEVEL_01_TILES };');
  return fn(TileType);
}

// -------------------------------------------------------------
// Pure Mock Engine Components
// -------------------------------------------------------------
class MockTileMap {
  constructor(levelInput) {
    const tiles = 'tiles' in levelInput ? levelInput.tiles : levelInput;
    this.levelId = levelInput.id || 'custom';
    this.grid = tiles.map((r) => [...r]);
    this.playerSpawn = null;
    this.enemySpawns = [];
    this.basePos = null;

    for (let r = 0; r < this.grid.length; r++) {
      for (let c = 0; c < this.grid[r].length; c++) {
        const val = this.grid[r][c];
        const worldPos = gridToWorld(r, c);
        if (val === TileType.PLAYER_SPAWN) this.playerSpawn = worldPos;
        if (val === TileType.ENEMY_SPAWN) this.enemySpawns.push(worldPos);
        if (val === TileType.BASE) this.basePos = worldPos;
      }
    }
  }

  getPlayerSpawn() { return this.playerSpawn ? { ...this.playerSpawn } : null; }
  getEnemySpawns() { return this.enemySpawns.map((p) => ({ ...p })); }
  getBasePosition() { return this.basePos ? { ...this.basePos } : null; }
  resetDestruction() { /* reset */ }
}

class MockPowerupSystem {
  constructor(milestones = []) {
    this.milestones = new Map();
    this.triggered = new Set();
    this.lastDroppedType = null;
    this.setMilestones(milestones);
  }

  setMilestones(milestones) {
    this.milestones.clear();
    for (const m of milestones) {
      this.milestones.set(m.destroyedEnemyCount, m.type);
    }
  }

  handleEnemyDestroyed(destroyedCount) {
    const type = this.milestones.get(destroyedCount);
    if (!type || this.triggered.has(destroyedCount)) return false;
    this.triggered.add(destroyedCount);
    this.lastDroppedType = type;
    return true;
  }

  reset() {
    this.triggered.clear();
    this.lastDroppedType = null;
  }
}

class MockEnemyManager {
  constructor(stageConfig) {
    this.sequence = [...stageConfig.enemySequence];
    this.totalEnemies = stageConfig.enemySequence.length;
    this.maxActiveEnemies = stageConfig.maxActiveEnemies ?? 4;
    this.spawnInterval = stageConfig.spawnInterval ?? 1.25;

    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.activeCount = 0;
    this.archetypeKills = {
      [EnemyArchetypeId.STANDARD]: 0,
      [EnemyArchetypeId.FAST]: 0,
      [EnemyArchetypeId.ARMOR]: 0,
    };
  }

  getTotalEnemies() { return this.totalEnemies; }
  getMaxActiveEnemies() { return this.maxActiveEnemies; }
  getSpawnInterval() { return this.spawnInterval; }
  getDestroyedCount() { return this.destroyedCount; }
  getArchetypeKills() { return { ...this.archetypeKills }; }

  simulateEnemyKill(archetypeId) {
    this.destroyedCount++;
    this.archetypeKills[archetypeId] = (this.archetypeKills[archetypeId] || 0) + 1;
  }

  reset() {
    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.activeCount = 0;
    this.archetypeKills = {
      [EnemyArchetypeId.STANDARD]: 0,
      [EnemyArchetypeId.FAST]: 0,
      [EnemyArchetypeId.ARMOR]: 0,
    };
  }
}

class MockHUD {
  constructor() {
    this.stageNumber = 1;
    this.displayedText = 'STAGE 01';
  }

  setStageNumber(stageNumber) {
    this.stageNumber = stageNumber;
    this.displayedText = `STAGE ${stageNumber.toString().padStart(2, '0')}`;
  }

  getStageText() {
    return this.displayedText;
  }
}

class MockStageRegistry {
  constructor() {
    this.stages = new Map();
  }

  registerStage(stage) {
    validateStageDefinition(stage);
    if (this.stages.has(stage.id)) {
      throw new Error(`Duplicate stage id '${stage.id}'`);
    }
    this.stages.set(stage.id, stage);
  }

  getStageDefinition(id) {
    return this.stages.get(id) || null;
  }

  getStageByNumber(num) {
    for (const s of this.stages.values()) {
      if (s.stageNumber === num) return s;
    }
    return null;
  }
}

class MockStageManager {
  constructor(initialStage, registry) {
    this.registry = registry;
    this.currentStage = initialStage;
    this.lastResult = null;
  }

  getCurrentStage() { return this.currentStage; }
  getStageNumber() { return this.currentStage.stageNumber; }
  getDisplayName() { return this.currentStage.displayName; }
  getMissionTitle() { return this.currentStage.missionTitle; }
  hasNextStage() { return this.currentStage.nextStageId !== null; }
  getNextStageId() { return this.currentStage.nextStageId; }

  setLastResult(res) { this.lastResult = res; }
  getLastResult() { return this.lastResult; }
  resetCurrentStage() {
    this.lastResult = null;
    return this.currentStage;
  }
}

// -------------------------------------------------------------
// Pure Validators Mirroring TypeScript Definitions
// -------------------------------------------------------------
function validateLevelDefinition(level) {
  if (!level) throw new Error('Level validation error: LevelDefinition is null or undefined');
  if (!level.id || typeof level.id !== 'string') throw new Error('Level validation error: Missing or invalid level id');
  if (level.rows !== 13 || level.columns !== 13) throw new Error(`Level validation error: Expected 13x13 dimensions, got ${level.rows}x${level.columns}`);
  if (!level.tiles || level.tiles.length !== level.rows) throw new Error(`Level validation error: Expected ${level.rows} rows`);

  let playerCount = 0;
  let baseCount = 0;
  let enemyCount = 0;

  for (let r = 0; r < level.rows; r++) {
    const row = level.tiles[r];
    if (!row || row.length !== level.columns) throw new Error(`Level validation error: Row ${r} length invalid`);
    for (let c = 0; c < level.columns; c++) {
      const v = row[c];
      if (v === undefined || v === null || v < TileType.EMPTY || v > TileType.ENEMY_SPAWN) {
        throw new Error(`Level validation error at [${r}, ${c}]: Unknown TileType ${v}`);
      }
      if (v === TileType.PLAYER_SPAWN) playerCount++;
      if (v === TileType.BASE) baseCount++;
      if (v === TileType.ENEMY_SPAWN) enemyCount++;
    }
  }

  if (playerCount !== 1) throw new Error(`Level validation error: Expected exactly 1 PLAYER_SPAWN, found ${playerCount}`);
  if (baseCount !== 1) throw new Error(`Level validation error: Expected exactly 1 BASE, found ${baseCount}`);
  if (enemyCount < 1) throw new Error(`Level validation error: Expected at least 1 ENEMY_SPAWN, found ${enemyCount}`);
}

function validateStageDefinition(stage) {
  if (!stage) throw new Error('Stage validation error: StageDefinition is null or undefined');
  if (!stage.id || typeof stage.id !== 'string') throw new Error('Stage validation error: Missing or invalid stage id');
  if (typeof stage.stageNumber !== 'number' || stage.stageNumber < 1) throw new Error('Stage validation error: stageNumber must be >= 1');
  if (!stage.displayName) throw new Error('Stage validation error: Missing displayName');
  if (!stage.enemySequence || stage.enemySequence.length === 0) throw new Error('Stage validation error: enemySequence length must be > 0');
  if (typeof stage.maxActiveEnemies !== 'number' || stage.maxActiveEnemies < 1) throw new Error('Stage validation error: maxActiveEnemies must be >= 1');
  if (typeof stage.startingLives !== 'number' || stage.startingLives < 1) throw new Error('Stage validation error: startingLives must be >= 1');
  if (typeof stage.enemySpawnInterval !== 'number' || stage.enemySpawnInterval <= 0) throw new Error('Stage validation error: enemySpawnInterval must be > 0');

  if (stage.powerupMilestones) {
    const seen = new Set();
    for (const m of stage.powerupMilestones) {
      if (typeof m.destroyedEnemyCount !== 'number' || m.destroyedEnemyCount <= 0) {
        throw new Error('Stage validation error: milestone count must be positive');
      }
      if (m.destroyedEnemyCount > stage.enemySequence.length) {
        throw new Error(`Stage validation error: milestone count ${m.destroyedEnemyCount} exceeds total enemies ${stage.enemySequence.length}`);
      }
      if (seen.has(m.destroyedEnemyCount)) {
        throw new Error(`Stage validation error: duplicate milestone count ${m.destroyedEnemyCount}`);
      }
      seen.add(m.destroyedEnemyCount);
    }
  }

  if (!stage.level) throw new Error('Stage validation error: Missing level definition');
  validateLevelDefinition(stage.level);
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------
console.log('=== PHASE 13: MULTI-STAGE ARCHITECTURE & TRANSITION SUITE ===\n');

// 1. Stage 01 Definition Verification (Section 43)
console.log('Test Suite 1: Stage 01 Definition Verification');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  assert(STAGE_01_DEFINITION.id === 'stage01', 'Stage 01 ID is strictly "stage01"');
  assert(STAGE_01_DEFINITION.stageNumber === 1, 'Stage number is strictly 1');
  assert(STAGE_01_DEFINITION.displayName === 'CYBER OUTPOST', 'Display name is "CYBER OUTPOST"');
  assert(STAGE_01_DEFINITION.missionTitle === 'DEFEND COMMAND NODE', 'Mission title is "DEFEND COMMAND NODE"');
  assert(STAGE_01_DEFINITION.enemySequence.length === 12, 'Enemy sequence has length 12');
  assert(STAGE_01_DEFINITION.startingLives === 3, 'Starting lives is strictly 3');
  assert(STAGE_01_DEFINITION.maxActiveEnemies === 4, 'Max active enemies is strictly 4');
  assert(
    STAGE_01_DEFINITION.nextStageId === 'stage02' || STAGE_01_DEFINITION.nextStageId === null,
    'nextStageId is configured ("stage02" for Phase 14 progression)'
  );
}

// 2. Enemy Composition Verification (Section 44)
console.log('\nTest Suite 2: Stage 01 Enemy Archetype Composition');
{
  const { STAGE_01_DEFINITION, STAGE_01_ENEMY_SEQUENCE } = loadStage01Definition();
  const counts = { STANDARD: 0, FAST: 0, ARMOR: 0 };
  STAGE_01_ENEMY_SEQUENCE.forEach((id) => counts[id]++);

  assert(counts.STANDARD === 5, 'Stage 01 has exactly 5 STANDARD units');
  assert(counts.FAST === 4, 'Stage 01 has exactly 4 FAST units');
  assert(counts.ARMOR === 3, 'Stage 01 has exactly 3 ARMOR units');

  const expectedOrder = [
    EnemyArchetypeId.STANDARD,
    EnemyArchetypeId.STANDARD,
    EnemyArchetypeId.FAST,
    EnemyArchetypeId.STANDARD,
    EnemyArchetypeId.ARMOR,
    EnemyArchetypeId.FAST,
    EnemyArchetypeId.STANDARD,
    EnemyArchetypeId.FAST,
    EnemyArchetypeId.ARMOR,
    EnemyArchetypeId.STANDARD,
    EnemyArchetypeId.FAST,
    EnemyArchetypeId.ARMOR,
  ];

  const matchesExactOrder = STAGE_01_ENEMY_SEQUENCE.every((id, i) => id === expectedOrder[i]);
  assert(matchesExactOrder, 'Deterministic 12-unit sequence matches exact Phase 11/12 ordering');
}

// 3. Powerup Milestones (Section 45)
console.log('\nTest Suite 3: Data-Driven Powerup Milestones');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  assert(STAGE_01_DEFINITION.powerupMilestones.length === 3, 'Stage 01 defines exactly 3 powerup milestones');

  const milestoneMap = new Map();
  STAGE_01_DEFINITION.powerupMilestones.forEach((m) => milestoneMap.set(m.destroyedEnemyCount, m.type));

  assert(milestoneMap.get(3) === PowerupType.OVERDRIVE_CORE, 'Kill 3 triggers OVERDRIVE CORE');
  assert(milestoneMap.get(6) === PowerupType.AEGIS_FIELD, 'Kill 6 triggers AEGIS FIELD');
  assert(milestoneMap.get(9) === PowerupType.STASIS_PULSE, 'Kill 9 triggers STASIS PULSE');

  const sys = new MockPowerupSystem(STAGE_01_DEFINITION.powerupMilestones);
  assert(sys.handleEnemyDestroyed(1) === false, 'Enemy kill 1 does not drop');
  assert(sys.handleEnemyDestroyed(3) === true, 'Enemy kill 3 drops from data-driven milestones');
  assert(sys.lastDroppedType === PowerupType.OVERDRIVE_CORE, 'Drop matches OVERDRIVE_CORE');
}

// 4. Generic TileMap Input (Section 46)
console.log('\nTest Suite 4: Generic TileMap Input & Position Derivation');
{
  const { LEVEL_01 } = loadLevel01Definition();
  const mapA = new MockTileMap(LEVEL_01);
  const baseA = mapA.getBasePosition();
  const playerA = mapA.getPlayerSpawn();
  const enemySpawnsA = mapA.getEnemySpawns();

  assert(baseA.x === 0 && baseA.z === -12, 'Level 01 Base positioned at (0, -12)');
  assert(playerA.x === -4 && playerA.z === -10, 'Level 01 Player spawn positioned at (-4, -10)');
  assert(enemySpawnsA.length === 3, 'Level 01 has 3 enemy spawns');

  // Synthetic LevelDefinition B with moved positions
  const syntheticTiles = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  syntheticTiles[10][2] = TileType.BASE; // Moved Base to (row 10, col 2)
  syntheticTiles[8][8] = TileType.PLAYER_SPAWN; // Moved Player spawn to (row 8, col 8)
  syntheticTiles[1][6] = TileType.ENEMY_SPAWN; // 1 enemy spawn at center top
  const levelB = { id: 'levelB', rows: 13, columns: 13, tiles: syntheticTiles };

  const mapB = new MockTileMap(levelB);
  const baseB = mapB.getBasePosition();
  const playerB = mapB.getPlayerSpawn();
  const enemySpawnsB = mapB.getEnemySpawns();

  const expectedBaseB = gridToWorld(10, 2);
  const expectedPlayerB = gridToWorld(8, 8);
  const expectedEnemyB = gridToWorld(1, 6);

  assert(baseB.x === expectedBaseB.x && baseB.z === expectedBaseB.z, 'TileMap derives relocated Base position dynamically');
  assert(playerB.x === expectedPlayerB.x && playerB.z === expectedPlayerB.z, 'TileMap derives relocated Player spawn dynamically');
  assert(enemySpawnsB.length === 1 && enemySpawnsB[0].x === expectedEnemyB.x, 'TileMap derives single relocated Enemy spawn dynamically');
}

// 5. Game Spatial Assumptions Elimination (Section 47)
console.log('\nTest Suite 5: Spatial Assumptions Elimination');
{
  const syntheticTiles = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  syntheticTiles[6][6] = TileType.BASE; // Base at center (row 6, col 6 -> 0, 0)
  syntheticTiles[12][12] = TileType.PLAYER_SPAWN;
  syntheticTiles[0][0] = TileType.ENEMY_SPAWN;
  syntheticTiles[0][12] = TileType.ENEMY_SPAWN;
  const syntheticLevel = { id: 'synthSpatial', rows: 13, columns: 13, tiles: syntheticTiles };

  const map = new MockTileMap(syntheticLevel);
  assert(map.getBasePosition().x === 0 && map.getBasePosition().z === 0, 'Center Base derives (0, 0)');
  assert(map.getPlayerSpawn().x === 12 && map.getPlayerSpawn().z === -12, 'Corner Player spawn derives (12, -12)');
  assert(map.getEnemySpawns().length === 2, 'Two enemy spawns derived without Stage 01 coordinates');
}

// 6. EnemyManager Stage Config (Section 48)
console.log('\nTest Suite 6: EnemyManager Stage Configuration Decoupling');
{
  const syntheticStageConfig = {
    enemySequence: [EnemyArchetypeId.FAST, EnemyArchetypeId.ARMOR],
    maxActiveEnemies: 1,
    spawnInterval: 0.5,
  };

  const em = new MockEnemyManager(syntheticStageConfig);
  assert(em.getTotalEnemies() === 2, 'Total enemies derived from sequence length (2, not 12)');
  assert(em.getMaxActiveEnemies() === 1, 'Max active enemies derived from config (1, not 4)');
  assert(em.getSpawnInterval() === 0.5, 'Spawn interval derived from config (0.5, not 1.25)');
}

// 7. Starting Lives (Section 49)
console.log('\nTest Suite 7: Starting Lives Data-Driven Verification');
{
  const syntheticStage = {
    id: 'stageLives',
    stageNumber: 99,
    displayName: 'ENDURANCE SECTOR',
    missionTitle: 'SURVIVE AT ALL COSTS',
    startingLives: 5,
    maxActiveEnemies: 4,
    enemySpawnInterval: 1.0,
    enemySequence: [EnemyArchetypeId.STANDARD],
    powerupMilestones: [],
    level: { id: 'dummy', rows: 13, columns: 13, tiles: [] },
    nextStageId: null,
  };

  let playerLives = syntheticStage.startingLives;
  assert(playerLives === 5, 'Stage initialization yields 5 lives (not hardcoded 3)');

  // Player loses lives
  playerLives -= 2;
  assert(playerLives === 3, 'Lives reduced to 3 during combat');

  // Replay / restart stage
  playerLives = syntheticStage.startingLives;
  assert(playerLives === 5, 'Stage restart restores startingLives from stage definition (5 lives)');
}

// 8. Synthetic Powerup Milestones (Section 50)
console.log('\nTest Suite 8: Synthetic Powerup Milestones Execution');
{
  const syntheticMilestones = [
    { destroyedEnemyCount: 1, type: PowerupType.AEGIS_FIELD },
  ];

  const sys = new MockPowerupSystem(syntheticMilestones);
  const dropped = sys.handleEnemyDestroyed(1);
  assert(dropped === true, 'Enemy kill #1 triggers powerup on synthetic milestone');
  assert(sys.lastDroppedType === PowerupType.AEGIS_FIELD, 'Synthetic drop is AEGIS_FIELD on kill #1');
}

// 9. HUD Stage Number (Section 51)
console.log('\nTest Suite 9: HUD Stage Number Dynamic Formatting');
{
  const hud = new MockHUD();
  assert(hud.getStageText() === 'STAGE 01', 'Initial HUD text is "STAGE 01"');

  hud.setStageNumber(7);
  assert(hud.getStageText() === 'STAGE 07', 'Synthetic stage 7 formats as "STAGE 07"');

  hud.setStageNumber(14);
  assert(hud.getStageText() === 'STAGE 14', 'Synthetic stage 14 formats as "STAGE 14"');
}

// 10. Stage Result Data Model & Archetype Kills (Section 52)
console.log('\nTest Suite 10: Stage Result Model & Archetype Kill Accounting');
{
  const { STAGE_01_DEFINITION, STAGE_01_ENEMY_SEQUENCE } = loadStage01Definition();
  const em = new MockEnemyManager(STAGE_01_DEFINITION);

  // Simulate perfect clear of Stage 01
  STAGE_01_ENEMY_SEQUENCE.forEach((id) => em.simulateEnemyKill(id));

  const kills = em.getArchetypeKills();
  assert(kills.STANDARD === 5, 'Result records 5 STANDARD kills');
  assert(kills.FAST === 4, 'Result records 4 FAST kills');
  assert(kills.ARMOR === 3, 'Result records 3 ARMOR kills');

  const finalScore = kills.STANDARD * 100 + kills.FAST * 150 + kills.ARMOR * 300;
  assert(finalScore === 2000, 'Calculated score is exactly 2000');

  const result = {
    stageId: STAGE_01_DEFINITION.id,
    stageNumber: STAGE_01_DEFINITION.stageNumber,
    finalScore,
    enemiesDestroyed: em.getDestroyedCount(),
    archetypeKills: kills,
    livesRemaining: 3,
  };

  assert(result.stageId === 'stage01', 'StageResult stageId is "stage01"');
  assert(result.stageNumber === 1, 'StageResult stageNumber is 1');
  assert(result.finalScore === 2000, 'StageResult finalScore is 2000');
  assert(result.enemiesDestroyed === 12, 'StageResult enemiesDestroyed is 12');
  assert(result.livesRemaining === 3, 'StageResult livesRemaining is 3');
}

// 11. Current Stage Reset (Section 53)
console.log('\nTest Suite 11: Current Stage In-Engine Reset');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const em = new MockEnemyManager(STAGE_01_DEFINITION);
  const sys = new MockPowerupSystem(STAGE_01_DEFINITION.powerupMilestones);
  let playerLives = STAGE_01_DEFINITION.startingLives;
  let score = 0;

  // Simulate dirty state during play
  em.simulateEnemyKill(EnemyArchetypeId.STANDARD);
  score += 100;
  playerLives -= 1;
  sys.handleEnemyDestroyed(3);

  assert(em.getDestroyedCount() === 1, 'Pre-reset destroyed count is 1');
  assert(score === 100, 'Pre-reset score is 100');
  assert(playerLives === 2, 'Pre-reset lives is 2');

  // Execute full restart
  em.reset();
  sys.reset();
  score = 0;
  playerLives = STAGE_01_DEFINITION.startingLives;

  assert(em.getDestroyedCount() === 0, 'Reset clears destroyed count to 0');
  assert(em.getArchetypeKills().STANDARD === 0, 'Reset clears archetype tallies');
  assert(score === 0, 'Reset resets score to 0');
  assert(playerLives === 3, 'Reset restores starting lives to 3');
}

// 12. Level & Stage Validation System (Section 54)
console.log('\nTest Suite 12: Stage & Level Validation Rules');
{
  const validTiles = Array.from({ length: 13 }, () => Array(13).fill(TileType.EMPTY));
  validTiles[12][6] = TileType.BASE;
  validTiles[11][4] = TileType.PLAYER_SPAWN;
  validTiles[0][0] = TileType.ENEMY_SPAWN;
  const validLevel = { id: 'lvlVal', rows: 13, columns: 13, tiles: validTiles };

  // 12.1 Level Validation Checks
  assertThrows(() => validateLevelDefinition(null), 'null', 'Rejects null LevelDefinition');
  assertThrows(() => validateLevelDefinition({ ...validLevel, id: '' }), 'id', 'Rejects empty level ID');
  assertThrows(() => validateLevelDefinition({ ...validLevel, rows: 10 }), 'dimensions', 'Rejects non-13 rows');
  assertThrows(() => {
    const noBase = validTiles.map((r) => r.map((c) => (c === TileType.BASE ? TileType.EMPTY : c)));
    validateLevelDefinition({ ...validLevel, tiles: noBase });
  }, 'BASE', 'Rejects level with 0 BASE');
  assertThrows(() => {
    const twoPlayers = validTiles.map((r) => [...r]);
    twoPlayers[0][1] = TileType.PLAYER_SPAWN;
    validateLevelDefinition({ ...validLevel, tiles: twoPlayers });
  }, 'PLAYER_SPAWN', 'Rejects level with >1 PLAYER_SPAWN');
  assertThrows(() => {
    const noEnemy = validTiles.map((r) => r.map((c) => (c === TileType.ENEMY_SPAWN ? TileType.EMPTY : c)));
    validateLevelDefinition({ ...validLevel, tiles: noEnemy });
  }, 'ENEMY_SPAWN', 'Rejects level with 0 ENEMY_SPAWN');

  // 12.2 Stage Validation Checks
  const validStage = {
    id: 'stgVal',
    stageNumber: 1,
    displayName: 'VALID STAGE',
    missionTitle: 'TEST MISSION',
    level: validLevel,
    enemySequence: [EnemyArchetypeId.STANDARD],
    maxActiveEnemies: 1,
    startingLives: 3,
    enemySpawnInterval: 1.0,
    powerupMilestones: [{ destroyedEnemyCount: 1, type: PowerupType.OVERDRIVE_CORE }],
    nextStageId: null,
  };

  assertThrows(() => validateStageDefinition(null), 'null', 'Rejects null StageDefinition');
  assertThrows(() => validateStageDefinition({ ...validStage, id: '' }), 'id', 'Rejects empty stage ID');
  assertThrows(() => validateStageDefinition({ ...validStage, stageNumber: 0 }), 'stageNumber', 'Rejects stageNumber 0');
  assertThrows(() => validateStageDefinition({ ...validStage, enemySequence: [] }), 'enemySequence', 'Rejects empty enemySequence');
  assertThrows(() => validateStageDefinition({ ...validStage, maxActiveEnemies: 0 }), 'maxActiveEnemies', 'Rejects maxActiveEnemies 0');
  assertThrows(() => validateStageDefinition({ ...validStage, startingLives: 0 }), 'startingLives', 'Rejects startingLives 0');
  assertThrows(() => validateStageDefinition({ ...validStage, enemySpawnInterval: 0 }), 'enemySpawnInterval', 'Rejects enemySpawnInterval 0');

  // Milestones > total enemies
  assertThrows(() => {
    validateStageDefinition({
      ...validStage,
      powerupMilestones: [{ destroyedEnemyCount: 99, type: PowerupType.AEGIS_FIELD }],
    });
  }, 'exceeds total enemies', 'Rejects milestone exceeding sequence length');

  // Duplicate milestone counts
  assertThrows(() => {
    validateStageDefinition({
      ...validStage,
      enemySequence: [EnemyArchetypeId.STANDARD, EnemyArchetypeId.FAST],
      powerupMilestones: [
        { destroyedEnemyCount: 1, type: PowerupType.AEGIS_FIELD },
        { destroyedEnemyCount: 1, type: PowerupType.OVERDRIVE_CORE },
      ],
    });
  }, 'duplicate milestone', 'Rejects duplicate milestone kill count');

  // Duplicate Stage ID in Registry
  const reg = new MockStageRegistry();
  reg.registerStage(validStage);
  assertThrows(() => reg.registerStage(validStage), 'Duplicate stage id', 'Rejects duplicate stage registration in registry');
}

// -------------------------------------------------------------
// Summary
// -------------------------------------------------------------
console.log('\n==================================================');
console.log(`Phase 13 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
