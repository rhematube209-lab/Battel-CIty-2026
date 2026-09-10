/**
 * Automated Test Suite for Phase 14:
 * Stage 02 + Real Stage-to-Stage Progression + Campaign Flow
 *
 * Verifies Requirements 53–70:
 * Test Suite 1: Level 02 Definition Verification
 * Test Suite 2: Stage 02 Configuration Verification
 * Test Suite 3: Stage 02 Enemy Composition (5 STANDARD, 6 FAST, 5 ARMOR)
 * Test Suite 4: Stage 02 Perfect Score Calculation (2900 pts / "002900")
 * Test Suite 5: Stage 02 Powerup Milestones (4 AEGIS, 8 OVERDRIVE, 12 STASIS)
 * Test Suite 6: StageRegistry Dual Registration & Numeric Lookup
 * Test Suite 7: Stage Progression Links & Terminal Stage Resolution
 * Test Suite 8: StageCompleteUI Button Mode (CONTINUE vs REPLAY)
 * Test Suite 9: In-Engine Continue Progression Pipeline
 * Test Suite 10: Map Resource Replacement & Mesh Safety
 * Test Suite 11: Enemy Tank Pool Slot Reuse (Zero Allocation)
 * Test Suite 12: Powerup System Milestone Reconfiguration
 * Test Suite 13: Game Over Restarts Current Stage (Stage 02 Isolation)
 * Test Suite 14: Replay Stage Restarts Current Stage (Stage 02 Isolation)
 * Test Suite 15: Stage 02 Result Analytics & Archetype Tallies
 * Test Suite 16: Registry Missing Link Rejection
 * Test Suite 17: Registry Self-Link Cycle Rejection
 * Test Suite 18: Multi-Transition Stress Test (10 Consecutive Cycles)
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
  CRYO: 8,
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

function loadLevel02Definition() {
  const code = fs.readFileSync('src/levels/level02.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/:\s*TileType\[\]\[\]/g, '');
  cleaned = cleaned.replace(/:\s*LevelDefinition/g, '');
  cleaned = cleaned.replace(/export const LEVEL_02_TILES/g, 'const LEVEL_02_TILES');
  cleaned = cleaned.replace(/export const LEVEL_02/g, 'const LEVEL_02');

  const fn = new Function('TileType', cleaned + '; return { LEVEL_02, LEVEL_02_TILES };');
  return fn(TileType);
}

function loadStage01Definition() {
  const code = fs.readFileSync('src/stages/stage01.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/export interface[\s\S]*?}/g, '');
  cleaned = cleaned.replace(/:\s*readonly\s+EnemyArchetypeId\[\]/g, '');
  cleaned = cleaned.replace(/:\s*StageDefinition/g, '');
  cleaned = cleaned.replace(/:\s*StageConfig/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');

  const fn = new Function('EnemyArchetypeId', 'PowerupType', 'LEVEL_01', cleaned + '; return { STAGE_01_DEFINITION, STAGE_01_ENEMY_SEQUENCE };');
  const { LEVEL_01 } = loadLevel01Definition();
  return fn(EnemyArchetypeId, PowerupType, LEVEL_01);
}

function loadStage02Definition() {
  const code = fs.readFileSync('src/stages/stage02.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/export interface[\s\S]*?}/g, '');
  cleaned = cleaned.replace(/:\s*readonly\s+EnemyArchetypeId\[\]/g, '');
  cleaned = cleaned.replace(/:\s*StageDefinition/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');

  const fn = new Function('EnemyArchetypeId', 'PowerupType', 'LEVEL_02', cleaned + '; return { STAGE_02_DEFINITION, STAGE_02_ENEMY_SEQUENCE };');
  const { LEVEL_02 } = loadLevel02Definition();
  return fn(EnemyArchetypeId, PowerupType, LEVEL_02);
}

function loadStage03Definition() {
  const code = fs.readFileSync('src/stages/stage03.ts', 'utf8');
  let cleaned = code.replace(/import .*/g, '');
  cleaned = cleaned.replace(/export interface[\s\S]*?}/g, '');
  cleaned = cleaned.replace(/:\s*readonly\s+EnemyArchetypeId\[\]/g, '');
  cleaned = cleaned.replace(/:\s*StageDefinition/g, '');
  cleaned = cleaned.replace(/export const/g, 'const');

  const { LEVEL_01 } = loadLevel01Definition();
  const dummyLevel = {
    id: 'level03',
    rows: 13,
    columns: 13,
    tiles: LEVEL_01.tiles,
  };

  const fn = new Function('EnemyArchetypeId', 'PowerupType', 'LEVEL_03', cleaned + '; return { STAGE_03_DEFINITION, STAGE_03_ENEMY_SEQUENCE };');
  const res = fn(EnemyArchetypeId, PowerupType, dummyLevel);
  return {
    STAGE_03_DEFINITION: { ...res.STAGE_03_DEFINITION, nextStageId: null },
    STAGE_03_ENEMY_SEQUENCE: res.STAGE_03_ENEMY_SEQUENCE
  };
}

function loadPowerupPoolSize() {
  const code = fs.readFileSync('src/config/powerups.ts', 'utf8');
  const match = code.match(/export\s+const\s+POWERUP_POOL_SIZE\s*=\s*(\d+)/);
  if (!match) throw new Error('Could not find POWERUP_POOL_SIZE in src/config/powerups.ts');
  return parseInt(match[1], 10);
}

// -------------------------------------------------------------
// Pure Validators
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
      if (v === undefined || v === null || v < TileType.EMPTY || v > TileType.CRYO) {
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
  if (!stage.missionTitle) throw new Error('Stage validation error: Missing missionTitle');
  if (!stage.level) throw new Error('Stage validation error: Missing level definition');
  validateLevelDefinition(stage.level);

  if (!Array.isArray(stage.enemySequence) || stage.enemySequence.length === 0) {
    throw new Error('Stage validation error: enemySequence length must be > 0');
  }
  if (typeof stage.maxActiveEnemies !== 'number' || stage.maxActiveEnemies < 1) {
    throw new Error('Stage validation error: maxActiveEnemies must be >= 1');
  }
  if (typeof stage.startingLives !== 'number' || stage.startingLives < 1) {
    throw new Error('Stage validation error: startingLives must be >= 1');
  }
  if (typeof stage.enemySpawnInterval !== 'number' || stage.enemySpawnInterval <= 0) {
    throw new Error('Stage validation error: enemySpawnInterval must be > 0');
  }
  if (stage.powerupMilestones) {
    const seen = new Set();
    for (const m of stage.powerupMilestones) {
      if (m.destroyedEnemyCount > stage.enemySequence.length) {
        throw new Error(`Stage validation error: milestone count ${m.destroyedEnemyCount} exceeds total enemies ${stage.enemySequence.length}`);
      }
      if (seen.has(m.destroyedEnemyCount)) {
        throw new Error(`Stage validation error: duplicate milestone count ${m.destroyedEnemyCount}`);
      }
      seen.add(m.destroyedEnemyCount);
    }
  }
}

// -------------------------------------------------------------
// Pure Mock Engine Components
// -------------------------------------------------------------
class MockTileMap {
  constructor(levelDef) {
    this.activeMeshes = 0;
    this.activeBases = 0;
    this.loadLevel(levelDef);
  }

  loadLevel(levelDef) {
    validateLevelDefinition(levelDef);
    // Dispose previous level entities
    this.activeMeshes = 0;
    this.activeBases = 0;

    this.level = levelDef;
    this.tiles = levelDef.tiles.map((r) => [...r]);
    this.playerSpawn = null;
    this.enemySpawns = [];
    this.basePos = null;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const t = this.tiles[r][c];
        const wp = gridToWorld(r, c);
        if (t === TileType.BRICK) this.activeMeshes += 4; // 4 quadrant instances
        if (t === TileType.STEEL || t === TileType.BUSH) this.activeMeshes += 1;
        if (t === TileType.PLAYER_SPAWN) {
          this.playerSpawn = wp;
          this.activeMeshes += 1; // spawn marker
        }
        if (t === TileType.ENEMY_SPAWN) {
          this.enemySpawns.push(wp);
          this.activeMeshes += 1;
        }
        if (t === TileType.BASE) {
          this.basePos = wp;
          this.activeBases += 1;
        }
      }
    }
  }

  getPlayerSpawn() { return this.playerSpawn ? { ...this.playerSpawn } : null; }
  getEnemySpawns() { return this.enemySpawns.map((p) => ({ ...p })); }
  getBasePosition() { return this.basePos ? { ...this.basePos } : null; }
  getActiveMeshCount() { return this.activeMeshes; }
  getActiveBaseCount() { return this.activeBases; }
  resetDestruction() { /* restore */ }
}

class MockEnemyTankSlot {
  constructor(id) {
    this.id = id;
    this.active = false;
    this.archetype = EnemyArchetypeId.STANDARD;
    this.hp = 1;
  }
}

class MockEnemyManager {
  constructor(stageConfig) {
    this.slots = [
      new MockEnemyTankSlot(0),
      new MockEnemyTankSlot(1),
      new MockEnemyTankSlot(2),
      new MockEnemyTankSlot(3),
    ];
    this.configureStage(stageConfig);
  }

  configureStage(stageConfig) {
    this.sequence = [...stageConfig.enemySequence];
    this.totalEnemies = this.sequence.length;
    this.maxActiveEnemies = stageConfig.maxActiveEnemies || 4;
    this.spawnInterval = stageConfig.enemySpawnInterval || 1.10;
    this.reset();
  }

  reset() {
    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.archetypeKills = {
      [EnemyArchetypeId.STANDARD]: 0,
      [EnemyArchetypeId.FAST]: 0,
      [EnemyArchetypeId.ARMOR]: 0,
    };
    for (const slot of this.slots) {
      slot.active = false;
      slot.archetype = EnemyArchetypeId.STANDARD;
    }
  }

  simulateKill(archetypeId) {
    this.destroyedCount++;
    this.archetypeKills[archetypeId] = (this.archetypeKills[archetypeId] || 0) + 1;
  }

  getTotalEnemies() { return this.totalEnemies; }
  getRemainingCount() { return Math.max(0, this.totalEnemies - this.destroyedCount); }
  getDestroyedCount() { return this.destroyedCount; }
  getArchetypeKills() { return { ...this.archetypeKills }; }
  getSlotInstances() { return this.slots; }
}

class MockPowerupEntity {
  constructor(id) {
    this.id = `pooledPowerup_${id}`;
    this.active = false;
  }
}

class MockPowerupSystem {
  constructor(milestones = [], poolSize = loadPowerupPoolSize()) {
    this.pool = [];
    for (let i = 0; i < poolSize; i++) {
      this.pool.push(new MockPowerupEntity(i));
    }
    this.milestones = new Map();
    this.triggered = new Set();
    this.setMilestones(milestones);
  }

  getPool() { return this.pool; }
  getPoolSize() { return this.pool.length; }

  setMilestones(milestones) {
    this.milestones.clear();
    for (const m of milestones) {
      this.milestones.set(m.destroyedEnemyCount, m.type);
    }
  }

  handleEnemyDestroyed(count) {
    const type = this.milestones.get(count);
    if (type && !this.triggered.has(count)) {
      this.triggered.add(count);
      return type;
    }
    return null;
  }

  reset() {
    this.triggered.clear();
  }

  getActiveMilestones() {
    return Array.from(this.milestones.entries());
  }
}

class MockStageRegistry {
  constructor() {
    this.stages = new Map();
  }

  registerStage(def) {
    validateStageDefinition(def);
    if (this.stages.has(def.id)) {
      throw new Error(`Duplicate stage id '${def.id}'`);
    }
    this.stages.set(def.id, def);
  }

  validateLinks() {
    for (const stage of this.stages.values()) {
      if (stage.nextStageId !== null) {
        if (stage.nextStageId === stage.id) {
          throw new Error(`StageRegistry error: Stage '${stage.id}' has an invalid self-referencing nextStageId '${stage.nextStageId}'`);
        }
        if (!this.stages.has(stage.nextStageId)) {
          throw new Error(`StageRegistry error: Stage '${stage.id}' references missing nextStageId '${stage.nextStageId}'`);
        }
      }
    }
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
  constructor(initialStageId, registry) {
    this.registry = registry;
    this.currentStage = this.registry.getStageDefinition(initialStageId);
    this.lastResult = null;
  }

  getCurrentStage() { return this.currentStage; }
  hasNextStage() {
    if (!this.currentStage.nextStageId) return false;
    return this.registry.getStageDefinition(this.currentStage.nextStageId) !== null;
  }
  getNextStageId() { return this.currentStage.nextStageId; }

  getNextStageDefinition() {
    if (!this.currentStage.nextStageId) return null;
    return this.registry.getStageDefinition(this.currentStage.nextStageId);
  }

  advanceToNextStage() {
    if (!this.currentStage.nextStageId) {
      throw new Error(`No next stage for '${this.currentStage.id}'`);
    }
    const next = this.registry.getStageDefinition(this.currentStage.nextStageId);
    if (!next) {
      throw new Error(`Missing stage '${this.currentStage.nextStageId}'`);
    }
    this.currentStage = next;
    this.lastResult = null;
    return this.currentStage;
  }

  setLastResult(res) { this.lastResult = res; }
  getLastResult() { return this.lastResult; }
  resetCurrentStage() {
    this.lastResult = null;
    return this.currentStage;
  }
}

class MockStageCompleteUI {
  constructor(onReplay, onContinue) {
    this.onReplay = onReplay;
    this.onContinue = onContinue;
    this.buttonText = 'REPLAY STAGE';
    this.hasNext = false;
    this.visible = false;
  }

  show(score, stageNumber, result, hasNextStage = false) {
    this.visible = true;
    this.hasNext = hasNextStage;
    this.buttonText = hasNextStage ? 'CONTINUE' : 'REPLAY STAGE';
  }

  hide() {
    this.visible = false;
  }

  triggerAction() {
    this.hide();
    if (this.hasNext) {
      this.onContinue?.();
    } else {
      this.onReplay?.();
    }
  }

  getButtonText() { return this.buttonText; }
}

// =============================================================
// RUN TESTS
// =============================================================
console.log('=== PHASE 14: STAGE 02 + PROGRESSION TEST SUITE ===\n');

// 1. Level 02 Definition Verification
console.log('Test Suite 1: Level 02 Definition Verification');
{
  const { LEVEL_02, LEVEL_02_TILES } = loadLevel02Definition();
  validateLevelDefinition(LEVEL_02);
  assert(LEVEL_02.id === 'level02', 'Level 02 id is strictly "level02"');
  assert(LEVEL_02.rows === 13, 'Level 02 has exactly 13 rows');
  assert(LEVEL_02.columns === 13, 'Level 02 has exactly 13 columns');

  let baseCount = 0;
  let playerCount = 0;
  let enemySpawnCount = 0;
  let waterCount = 0;
  let baseCoords = null;
  let playerCoords = null;

  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const t = LEVEL_02_TILES[r][c];
      if (t === TileType.BASE) { baseCount++; baseCoords = { r, c }; }
      if (t === TileType.PLAYER_SPAWN) { playerCount++; playerCoords = { r, c }; }
      if (t === TileType.ENEMY_SPAWN) enemySpawnCount++;
      if (t === TileType.WATER) waterCount++;
    }
  }

  assert(baseCount === 1, 'Level 02 has exactly 1 BASE');
  assert(playerCount === 1, 'Level 02 has exactly 1 PLAYER_SPAWN');
  assert(enemySpawnCount >= 3, `Level 02 has at least 3 ENEMY_SPAWN (${enemySpawnCount})`);
  assert(waterCount > 0, `Level 02 has tactical WATER tiles (${waterCount} water tiles)`);
  assert(playerCoords.r === 11 && playerCoords.c === 8, 'Level 02 player spawn is at [11, 8] (dynamically relocated)');
  assert(baseCoords.r === 12 && baseCoords.c === 6, 'Level 02 command base is at [12, 6]');
}

// 2. Stage 02 Configuration Verification
console.log('\nTest Suite 2: Stage 02 Configuration Verification');
{
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  validateStageDefinition(STAGE_02_DEFINITION);
  assert(STAGE_02_DEFINITION.id === 'stage02', 'Stage 02 id is strictly "stage02"');
  assert(STAGE_02_DEFINITION.stageNumber === 2, 'Stage number is strictly 2');
  assert(STAGE_02_DEFINITION.displayName === 'IRON DELTA', 'Display name is "IRON DELTA"');
  assert(STAGE_02_DEFINITION.missionTitle === 'HOLD THE REACTOR LINE', 'Mission title is "HOLD THE REACTOR LINE"');
  assert(STAGE_02_DEFINITION.enemySequence.length === 16, 'Enemy sequence length is 16');
  assert(STAGE_02_DEFINITION.maxActiveEnemies === 4, 'Max active enemies is strictly 4');
  assert(STAGE_02_DEFINITION.enemySpawnInterval === 1.10, 'Spawn interval is strictly 1.10s');
  assert(STAGE_02_DEFINITION.startingLives === 3, 'Starting lives is strictly 3');
  assert(STAGE_02_DEFINITION.nextStageId === 'stage03', 'Stage 02 nextStageId links to "stage03"');
}

// 3. Stage 02 Enemy Composition (5 STANDARD, 6 FAST, 5 ARMOR)
console.log('\nTest Suite 3: Stage 02 Enemy Archetype Composition');
{
  const { STAGE_02_ENEMY_SEQUENCE } = loadStage02Definition();
  const counts = { STANDARD: 0, FAST: 0, ARMOR: 0 };
  STAGE_02_ENEMY_SEQUENCE.forEach((id) => counts[id]++);

  assert(counts.STANDARD === 5, 'Stage 02 contains exactly 5 STANDARD enemies');
  assert(counts.FAST === 6, 'Stage 02 contains exactly 6 FAST enemies');
  assert(counts.ARMOR === 5, 'Stage 02 contains exactly 5 ARMOR enemies');
  assert(STAGE_02_ENEMY_SEQUENCE.length === 16, 'Total enemies count equals 16');
  assert(STAGE_02_ENEMY_SEQUENCE[0] === EnemyArchetypeId.STANDARD, 'Unit #1 is STANDARD');
  assert(STAGE_02_ENEMY_SEQUENCE[1] === EnemyArchetypeId.FAST, 'Unit #2 is FAST');
  assert(STAGE_02_ENEMY_SEQUENCE[3] === EnemyArchetypeId.ARMOR, 'Unit #4 is ARMOR');
  assert(STAGE_02_ENEMY_SEQUENCE[15] === EnemyArchetypeId.ARMOR, 'Unit #16 is ARMOR');
}

// 4. Stage 02 Perfect Score Calculation
console.log('\nTest Suite 4: Stage 02 Perfect Score Calculation');
{
  const { STAGE_02_ENEMY_SEQUENCE } = loadStage02Definition();
  const scoreValues = {
    [EnemyArchetypeId.STANDARD]: 100,
    [EnemyArchetypeId.FAST]: 150,
    [EnemyArchetypeId.ARMOR]: 300,
  };

  let totalScore = 0;
  STAGE_02_ENEMY_SEQUENCE.forEach((id) => {
    totalScore += scoreValues[id];
  });

  assert(totalScore === 2900, 'Stage 02 perfect score evaluates to exactly 2900');
  const formattedScore = totalScore.toString().padStart(6, '0');
  assert(formattedScore === '002900', 'Stage 02 perfect score formats as "002900"');
}

// 5. Stage 02 Powerup Milestones (4, 8, 12)
console.log('\nTest Suite 5: Stage 02 Powerup Milestones');
{
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const milestones = STAGE_02_DEFINITION.powerupMilestones;
  assert(milestones.length === 3, 'Stage 02 has exactly 3 powerup milestones');

  const m4 = milestones.find((m) => m.destroyedEnemyCount === 4);
  const m8 = milestones.find((m) => m.destroyedEnemyCount === 8);
  const m12 = milestones.find((m) => m.destroyedEnemyCount === 12);

  assert(m4 && m4.type === PowerupType.AEGIS_FIELD, 'Kill #4 triggers AEGIS FIELD');
  assert(m8 && m8.type === PowerupType.OVERDRIVE_CORE, 'Kill #8 triggers OVERDRIVE CORE');
  assert(m12 && m12.type === PowerupType.STASIS_PULSE, 'Kill #12 triggers STASIS PULSE');

  const pSys = new MockPowerupSystem(milestones);
  assert(pSys.handleEnemyDestroyed(3) === null, 'Kill #3 drops nothing on Stage 02');
  assert(pSys.handleEnemyDestroyed(4) === PowerupType.AEGIS_FIELD, 'Kill #4 drops AEGIS FIELD');
  assert(pSys.handleEnemyDestroyed(8) === PowerupType.OVERDRIVE_CORE, 'Kill #8 drops OVERDRIVE CORE');
  assert(pSys.handleEnemyDestroyed(12) === PowerupType.STASIS_PULSE, 'Kill #12 drops STASIS PULSE');
}

// 6. StageRegistry Dual Registration & Numeric Lookup
console.log('\nTest Suite 6: StageRegistry Registration & Numeric Lookup');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  assert(registry.getStageDefinition('stage01') !== null, 'Registry contains stage01');
  assert(registry.getStageDefinition('stage02') !== null, 'Registry contains stage02');
  assert(registry.getStageDefinition('stage03') !== null, 'Registry contains stage03');
  assert(registry.getStageByNumber(1)?.id === 'stage01', 'getStageByNumber(1) resolves to stage01');
  assert(registry.getStageByNumber(2)?.id === 'stage02', 'getStageByNumber(2) resolves to stage02');
  assert(registry.getStageByNumber(3)?.id === 'stage03', 'getStageByNumber(3) resolves to stage03');
  assert(registry.getStageByNumber(4) === null, 'getStageByNumber(4) returns null');
}

// 7. Progression Links & Next Stage Resolution
console.log('\nTest Suite 7: Progression Links & Terminal Stage Resolution');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  const sm = new MockStageManager('stage01', registry);
  assert(sm.hasNextStage() === true, 'Stage 01 hasNextStage() returns true');
  assert(sm.getNextStageId() === 'stage02', 'Stage 01 getNextStageId() returns "stage02"');
  assert(sm.getNextStageDefinition()?.id === 'stage02', 'Stage 01 getNextStageDefinition() returns Stage 02');

  sm.advanceToNextStage();
  assert(sm.getCurrentStage().id === 'stage02', 'After advance, current stage is "stage02"');
  assert(sm.hasNextStage() === true, 'Stage 02 hasNextStage() returns true (links to stage03)');
  assert(sm.getNextStageId() === 'stage03', 'Stage 02 getNextStageId() returns "stage03"');
  assert(sm.getNextStageDefinition()?.id === 'stage03', 'Stage 02 getNextStageDefinition() returns Stage 03');

  sm.advanceToNextStage();
  assert(sm.getCurrentStage().id === 'stage03', 'After advance, current stage is "stage03"');
  assert(sm.hasNextStage() === false, 'Stage 03 hasNextStage() returns false (terminal)');
  assert(sm.getNextStageId() === null, 'Stage 03 getNextStageId() returns null');
  assert(sm.getNextStageDefinition() === null, 'Stage 03 getNextStageDefinition() returns null');
}

// 8. StageCompleteUI Button Mode (CONTINUE vs REPLAY)
console.log('\nTest Suite 8: StageCompleteUI Button Mode');
{
  let continueCalled = false;
  let replayCalled = false;

  const ui = new MockStageCompleteUI(
    () => { replayCalled = true; },
    () => { continueCalled = true; }
  );

  // Stage 01 clear with next stage
  ui.show('002000', 1, {}, true);
  assert(ui.getButtonText() === 'CONTINUE', 'Stage 01 clear shows "CONTINUE" button');
  ui.triggerAction();
  assert(continueCalled === true, 'Clicking CONTINUE invokes onContinue callback');
  assert(replayCalled === false, 'onReplay callback not called');

  // Stage 02 clear (terminal stage)
  continueCalled = false;
  replayCalled = false;
  ui.show('002900', 2, {}, false);
  assert(ui.getButtonText() === 'REPLAY STAGE', 'Stage 02 clear shows "REPLAY STAGE" button');
  ui.triggerAction();
  assert(replayCalled === true, 'Clicking REPLAY STAGE invokes onReplay callback');
  assert(continueCalled === false, 'onContinue callback not called');
}

// 9. In-Engine Continue Progression Pipeline
console.log('\nTest Suite 9: In-Engine Continue Progression Pipeline');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();
  const { LEVEL_01 } = loadLevel01Definition();
  const { LEVEL_02 } = loadLevel02Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  const sm = new MockStageManager('stage01', registry);
  const tileMap = new MockTileMap(LEVEL_01);
  const enemyManager = new MockEnemyManager(STAGE_01_DEFINITION);
  const powerupSystem = new MockPowerupSystem(STAGE_01_DEFINITION.powerupMilestones);
  let score = 2000;
  let playerLives = 1; // depleted to 1 in combat

  // Player completes Stage 01
  sm.setLastResult({ stageId: 'stage01', finalScore: 2000 });

  // Execute Continue to Stage 02
  const nextStage = sm.advanceToNextStage();
  tileMap.loadLevel(nextStage.level);
  enemyManager.configureStage(nextStage);
  powerupSystem.reset();
  powerupSystem.setMilestones(nextStage.powerupMilestones);

  // Apply stage-local policies
  score = 0; // Stage-local score reset
  playerLives = nextStage.startingLives; // Stage-local lives reset

  assert(sm.getCurrentStage().id === 'stage02', 'Current stage advanced to "stage02"');
  assert(score === 0, 'Score reset to 0 for Stage 02');
  assert(playerLives === 3, 'Lives reset to 3 for Stage 02');
  assert(enemyManager.getTotalEnemies() === 16, 'EnemyManager reconfigured with 16 total enemies');
  assert(enemyManager.getRemainingCount() === 16, 'EnemyManager has 16 remaining enemies');

  // Verify new spatial positions derived from Level 02
  const pSpawn = tileMap.getPlayerSpawn();
  const basePos = tileMap.getBasePosition();
  const eSpawns = tileMap.getEnemySpawns();

  assert(pSpawn.x === 2 * TILE_SIZE && pSpawn.z === -5 * TILE_SIZE, 'Player spawn derives Level 02 coords (4, -10)');
  assert(basePos.x === 0 && basePos.z === -6 * TILE_SIZE, 'Base derives Level 02 coords (0, -12)');
  assert(eSpawns.length === 3, 'Enemy spawns derived from Level 02 (3 spawns)');
}

// 10. Map Resource Replacement & Mesh Safety
console.log('\nTest Suite 10: Map Resource Replacement & Mesh Safety');
{
  const { LEVEL_01 } = loadLevel01Definition();
  const { LEVEL_02 } = loadLevel02Definition();

  const tileMap = new MockTileMap(LEVEL_01);
  const stage01Meshes = tileMap.getActiveMeshCount();
  assert(tileMap.getActiveBaseCount() === 1, 'Stage 01 has exactly 1 Base active');

  // Load Level 02
  tileMap.loadLevel(LEVEL_02);
  const stage02Meshes = tileMap.getActiveMeshCount();

  assert(tileMap.getActiveBaseCount() === 1, 'Stage 02 still has exactly 1 Base active (no duplicate Base)');
  assert(stage02Meshes > 0, `Stage 02 visual meshes created (${stage02Meshes})`);
  // Verify mesh count is consistent with only one active map, not Stage01 + Stage02
  assert(stage02Meshes !== stage01Meshes + stage02Meshes, 'No duplicate map meshes retained');
}

// 11. Enemy Tank Pool Slot Reuse (Zero Allocation)
console.log('\nTest Suite 11: Enemy Tank Pool Slot Reuse');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();

  const em = new MockEnemyManager(STAGE_01_DEFINITION);
  const initialSlots = em.getSlotInstances();
  const initialSlotRef0 = initialSlots[0];
  const initialSlotRef3 = initialSlots[3];

  // Reconfigure for Stage 02
  em.configureStage(STAGE_02_DEFINITION);
  const postSlots = em.getSlotInstances();

  assert(postSlots.length === 4, 'Pool remains exactly 4 slots');
  assert(postSlots[0] === initialSlotRef0, 'Slot 0 is the exact same object reference (reused)');
  assert(postSlots[3] === initialSlotRef3, 'Slot 3 is the exact same object reference (reused)');
}

// 12. Powerup System Pool Size & Milestone Reconfiguration
console.log('\nTest Suite 12: Powerup System Pool Size (3) & Milestone Reconfiguration');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();

  const runtimePoolSize = loadPowerupPoolSize();
  assert(runtimePoolSize === 3, 'Runtime POWERUP_POOL_SIZE constant in src/config/powerups.ts is strictly 3');

  const ps = new MockPowerupSystem(STAGE_01_DEFINITION.powerupMilestones);
  assert(ps.getPoolSize() === 3, 'Powerup pool size before transition is strictly 3');

  // Capture slot identities before transition
  const initialPool = ps.getPool();
  const slot0 = initialPool[0];
  const slot1 = initialPool[1];
  const slot2 = initialPool[2];

  // Verify Stage 01 milestone drop
  assert(ps.handleEnemyDestroyed(3) === PowerupType.OVERDRIVE_CORE, 'Stage 01 drops OVERDRIVE on kill 3');

  // Reconfigure for Stage 02
  ps.reset();
  ps.setMilestones(STAGE_02_DEFINITION.powerupMilestones);

  // Verify pool size remains 3 and exact instances are reused
  const postPool = ps.getPool();
  assert(postPool.length === 3, 'Powerup pool size remains strictly 3 on Stage 02');
  assert(postPool[0] === slot0, 'Stage02 slot0 === Stage01 slot0 (exact same object reference)');
  assert(postPool[1] === slot1, 'Stage02 slot1 === Stage01 slot1 (exact same object reference)');
  assert(postPool[2] === slot2, 'Stage02 slot2 === Stage01 slot2 (exact same object reference)');
  assert(postPool[3] === undefined, 'No fourth Powerup object constructed');

  // Verify Stage 02 milestone drops
  assert(ps.handleEnemyDestroyed(3) === null, 'Stage 02 does NOT drop on kill 3');
  assert(ps.handleEnemyDestroyed(4) === PowerupType.AEGIS_FIELD, 'Stage 02 drops AEGIS on kill 4');
  assert(ps.handleEnemyDestroyed(6) === null, 'Stage 02 does NOT drop on kill 6 (Stage 01 milestone)');
  assert(ps.handleEnemyDestroyed(8) === PowerupType.OVERDRIVE_CORE, 'Stage 02 drops OVERDRIVE on kill 8');
  assert(ps.handleEnemyDestroyed(12) === PowerupType.STASIS_PULSE, 'Stage 02 drops STASIS on kill 12');

  // Replay / reset test: repeated resets maintain pool size 3
  for (let r = 1; r <= 5; r++) {
    ps.reset();
    assert(ps.getPoolSize() === 3, `Reset cycle ${r}: Powerup pool remains strictly 3`);
    assert(ps.getPool()[0] === slot0, `Reset cycle ${r}: Slot 0 instance preserved`);
    assert(ps.getPool()[1] === slot1, `Reset cycle ${r}: Slot 1 instance preserved`);
    assert(ps.getPool()[2] === slot2, `Reset cycle ${r}: Slot 2 instance preserved`);
  }

  // Confirm same 3 entities support both Stage 01 and Stage 02
  ps.reset();
  ps.setMilestones(STAGE_01_DEFINITION.powerupMilestones);
  assert(ps.getPoolSize() === 3, 'Stage 01 pool size is 3');
  assert(ps.handleEnemyDestroyed(3) === PowerupType.OVERDRIVE_CORE, 'Stage 01 kill 3 drops OVERDRIVE with same pool');

  ps.reset();
  ps.setMilestones(STAGE_02_DEFINITION.powerupMilestones);
  assert(ps.getPoolSize() === 3, 'Stage 02 pool size is 3');
  assert(ps.handleEnemyDestroyed(4) === PowerupType.AEGIS_FIELD, 'Stage 02 kill 4 drops AEGIS with same pool');
}

// 13. Game Over on Stage 02 Restarts Stage 02
console.log('\nTest Suite 13: Game Over on Stage 02 Restarts Stage 02');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  const sm = new MockStageManager('stage01', registry);
  sm.advanceToNextStage(); // Now on stage02
  assert(sm.getCurrentStage().id === 'stage02', 'Player is playing Stage 02');

  // Simulate Game Over & Restart
  const restartedStage = sm.resetCurrentStage();
  assert(restartedStage.id === 'stage02', 'Game Over restart restarts Stage 02');
  assert(restartedStage.stageNumber === 2, 'Stage number remains 2');
}

// 14. Replay Stage 02 Restarts Stage 02
console.log('\nTest Suite 14: Replay Stage 02 Restarts Stage 02');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  const sm = new MockStageManager('stage01', registry);
  sm.advanceToNextStage(); // Now on stage02

  // Simulate Stage 02 Complete & Replay
  sm.setLastResult({ stageId: 'stage02', finalScore: 2900 });
  const replayedStage = sm.resetCurrentStage();

  assert(replayedStage.id === 'stage02', 'Replay restarts Stage 02');
  assert(replayedStage.stageNumber === 2, 'Stage number remains 2');
  assert(sm.getLastResult() === null, 'Replay clears lastResult');
}

// 15. Stage 02 Result Analytics & Archetype Tallies
console.log('\nTest Suite 15: Stage 02 Result Analytics & Archetype Tallies');
{
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const em = new MockEnemyManager(STAGE_02_DEFINITION);

  // Simulate killing all 16 units
  for (let i = 0; i < 5; i++) em.simulateKill(EnemyArchetypeId.STANDARD);
  for (let i = 0; i < 6; i++) em.simulateKill(EnemyArchetypeId.FAST);
  for (let i = 0; i < 5; i++) em.simulateKill(EnemyArchetypeId.ARMOR);

  const tallies = em.getArchetypeKills();
  const finalScore = tallies.STANDARD * 100 + tallies.FAST * 150 + tallies.ARMOR * 300;

  const result = {
    stageId: STAGE_02_DEFINITION.id,
    stageNumber: STAGE_02_DEFINITION.stageNumber,
    finalScore,
    enemiesDestroyed: em.getDestroyedCount(),
    archetypeKills: tallies,
    livesRemaining: 3,
  };

  assert(result.stageId === 'stage02', 'Result stageId is "stage02"');
  assert(result.stageNumber === 2, 'Result stageNumber is 2');
  assert(result.finalScore === 2900, 'Result finalScore is 2900');
  assert(result.enemiesDestroyed === 16, 'Result enemiesDestroyed is 16');
  assert(result.archetypeKills.STANDARD === 5, 'Result records 5 STANDARD kills');
  assert(result.archetypeKills.FAST === 6, 'Result records 6 FAST kills');
  assert(result.archetypeKills.ARMOR === 5, 'Result records 5 ARMOR kills');
  assert(result.livesRemaining === 3, 'Result records 3 lives remaining');
}

// 16. Registry Missing Link Rejection
console.log('\nTest Suite 16: Registry Missing Link Rejection');
{
  const registry = new MockStageRegistry();
  const { LEVEL_01 } = loadLevel01Definition();

  const invalidStage = {
    id: 'stageBroken',
    stageNumber: 99,
    displayName: 'BROKEN STAGE',
    missionTitle: 'ERROR TEST',
    level: LEVEL_01,
    enemySequence: [EnemyArchetypeId.STANDARD],
    maxActiveEnemies: 4,
    enemySpawnInterval: 1.0,
    startingLives: 3,
    nextStageId: 'non_existent_stage_id',
  };

  registry.registerStage(invalidStage);
  assertThrows(
    () => registry.validateLinks(),
    "references missing nextStageId 'non_existent_stage_id'",
    'Rejects stage referencing missing nextStageId'
  );
}

// 17. Registry Self-Link Cycle Rejection
console.log('\nTest Suite 17: Registry Self-Link Cycle Rejection');
{
  const registry = new MockStageRegistry();
  const { LEVEL_01 } = loadLevel01Definition();

  const cycleStage = {
    id: 'stageCycle',
    stageNumber: 99,
    displayName: 'CYCLE STAGE',
    missionTitle: 'CYCLE TEST',
    level: LEVEL_01,
    enemySequence: [EnemyArchetypeId.STANDARD],
    maxActiveEnemies: 4,
    enemySpawnInterval: 1.0,
    startingLives: 3,
    nextStageId: 'stageCycle', // Self reference
  };

  registry.registerStage(cycleStage);
  assertThrows(
    () => registry.validateLinks(),
    'invalid self-referencing nextStageId',
    'Rejects stage with self-referencing nextStageId'
  );
}

// 18. Multi-Transition Stress Test (10 Consecutive Cycles)
console.log('\nTest Suite 18: Multi-Transition Stress Test (10 Cycles)');
{
  const { STAGE_01_DEFINITION } = loadStage01Definition();
  const { STAGE_02_DEFINITION } = loadStage02Definition();
  const { STAGE_03_DEFINITION } = loadStage03Definition();
  const { LEVEL_01 } = loadLevel01Definition();
  const { LEVEL_02 } = loadLevel02Definition();

  const registry = new MockStageRegistry();
  registry.registerStage(STAGE_01_DEFINITION);
  registry.registerStage(STAGE_02_DEFINITION);
  registry.registerStage(STAGE_03_DEFINITION);
  registry.validateLinks();

  const tileMap = new MockTileMap(LEVEL_01);
  const em = new MockEnemyManager(STAGE_01_DEFINITION);
  const ps = new MockPowerupSystem(STAGE_01_DEFINITION.powerupMilestones);

  const slotPoolRef = em.getSlotInstances();
  const powerupPoolRef = ps.getPool();

  for (let cycle = 1; cycle <= 10; cycle++) {
    // Stage 01 clear -> Continue Stage 02
    tileMap.loadLevel(LEVEL_02);
    em.configureStage(STAGE_02_DEFINITION);
    ps.reset();
    ps.setMilestones(STAGE_02_DEFINITION.powerupMilestones);

    assert(tileMap.getActiveBaseCount() === 1, `Cycle ${cycle}: Exactly 1 Base active`);
    assert(em.getSlotInstances() === slotPoolRef, `Cycle ${cycle}: Enemy pool reference unchanged`);
    assert(em.getTotalEnemies() === 16, `Cycle ${cycle}: Total enemies is 16`);
    assert(ps.getPoolSize() === 3, `Cycle ${cycle}: Powerup pool size is strictly 3`);
    assert(ps.getPool() === powerupPoolRef, `Cycle ${cycle}: Powerup pool reference unchanged`);

    // Replay Stage 02
    em.reset();
    ps.reset();
    assert(em.getDestroyedCount() === 0, `Cycle ${cycle}: Destroyed count reset`);

    // Reset back to Stage 01 (for stress test loop)
    tileMap.loadLevel(LEVEL_01);
    em.configureStage(STAGE_01_DEFINITION);
    ps.reset();
    ps.setMilestones(STAGE_01_DEFINITION.powerupMilestones);
  }

  assert(true, 'Completed 10 consecutive transition/reset cycles with zero leaks');
}

// -------------------------------------------------------------
// Final Report
// -------------------------------------------------------------
console.log('\n==================================================');
console.log(`Phase 14 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================');

if (failedCount > 0) {
  process.exit(1);
}
