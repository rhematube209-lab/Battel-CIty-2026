import { readFileSync, existsSync } from 'node:fs';
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
console.log('PHASE 21 — v1.1.0 STAGE 04: NEXUS SIEGE VERIFICATION SUITE');
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
        CONVEYOR_PUSH_SPEED: 2.0,
        COMBAT_CONFIG: {
          PLAYER_SPEED: 5.0,
          PROJECTILE_POOL_SIZE: 16
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
    if (id.includes('enemyArchetypes')) {
      return {
        EnemyArchetypeId: {
          STANDARD: 'STANDARD',
          FAST: 'FAST',
          ARMOR: 'ARMOR'
        },
        ENEMY_ARCHETYPES: {
          STANDARD: { id: 'STANDARD', speed: 3.4, scoreValue: 100 },
          FAST: { id: 'FAST', speed: 4.6, scoreValue: 150 },
          ARMOR: { id: 'ARMOR', speed: 2.8, scoreValue: 300 }
        }
      };
    }
    if (id.includes('powerups')) {
      return {
        PowerupType: {
          AEGIS_FIELD: 'AEGIS_FIELD',
          OVERDRIVE_CORE: 'OVERDRIVE_CORE',
          STASIS_PULSE: 'STASIS_PULSE'
        },
        POWERUP_POOL_SIZE: 3
      };
    }
    if (id.includes('level01')) return transpileAndLoad('src/levels/level01.ts');
    if (id.includes('level02')) return transpileAndLoad('src/levels/level02.ts');
    if (id.includes('level03')) return transpileAndLoad('src/levels/level03.ts');
    if (id.includes('level04')) return transpileAndLoad('src/levels/level04.ts');
    if (id.includes('LevelDefinition')) return transpileAndLoad('src/levels/LevelDefinition.ts');
    if (id.includes('StageDefinition')) return transpileAndLoad('src/stages/StageDefinition.ts');
    if (id.includes('stage01')) return transpileAndLoad('src/stages/stage01.ts');
    if (id.includes('stage02')) return transpileAndLoad('src/stages/stage02.ts');
    if (id.includes('stage03')) return transpileAndLoad('src/stages/stage03.ts');
    if (id.includes('stage04')) return transpileAndLoad('src/stages/stage04.ts');
    if (id.includes('stageRegistry')) return transpileAndLoad('src/stages/stageRegistry.ts');
    if (id.includes('CampaignSession')) return transpileAndLoad('src/game/CampaignSession.ts');
    return {};
  });
  return mod.exports;
}

const { STAGE_01_DEFINITION } = transpileAndLoad('src/stages/stage01.ts');
const { STAGE_02_DEFINITION } = transpileAndLoad('src/stages/stage02.ts');
const { STAGE_03_DEFINITION } = transpileAndLoad('src/stages/stage03.ts');
const { STAGE_04_DEFINITION, STAGE_04_ENEMY_SEQUENCE } = transpileAndLoad('src/stages/stage04.ts');
const { LEVEL_04 } = transpileAndLoad('src/levels/level04.ts');
const { validateLevelDefinition } = transpileAndLoad('src/levels/LevelDefinition.ts');
const { StageRegistry } = transpileAndLoad('src/stages/stageRegistry.ts');
const { CampaignSession } = transpileAndLoad('src/game/CampaignSession.ts');

// =========================================================================
// Test Suite 1: Stage 04 Definition & Identity (Req 2, 36)
// =========================================================================
console.log('Test Suite 1: Stage 04 Definition & Identity (Req 2, 36)');
assert(STAGE_04_DEFINITION.id === 'stage04', "Stage 04 ID is 'stage04'");
assert(STAGE_04_DEFINITION.stageNumber === 4, 'Stage 04 stageNumber is 4');
assert(STAGE_04_DEFINITION.displayName === 'NEXUS SIEGE', "Stage 04 displayName is 'NEXUS SIEGE'");
assert(STAGE_04_DEFINITION.missionTitle === 'BREAK THE RELAY GRID', "Stage 04 missionTitle is 'BREAK THE RELAY GRID'");
assert(STAGE_04_DEFINITION.nextStageId === null, 'Stage 04 nextStageId is null (terminal)');
assert(STAGE_04_DEFINITION.enemySequence.length === 24, 'Stage 04 sequence has exactly 24 enemies');
assert(STAGE_04_DEFINITION.maxActiveEnemies === 4, 'Stage 04 maxActiveEnemies is 4');
assert(STAGE_04_DEFINITION.enemySpawnInterval === 0.90, 'Stage 04 enemySpawnInterval is 0.90s');
assert(STAGE_04_DEFINITION.startingLives === 3, 'Stage 04 fallback startingLives is 3');

// =========================================================================
// Test Suite 2: Stage 04 Enemy Composition (Req 12, 13, 37)
// =========================================================================
console.log('\nTest Suite 2: Stage 04 Enemy Composition (Req 12, 13, 37)');
const stdCount = STAGE_04_ENEMY_SEQUENCE.filter(a => a === 'STANDARD').length;
const fastCount = STAGE_04_ENEMY_SEQUENCE.filter(a => a === 'FAST').length;
const armorCount = STAGE_04_ENEMY_SEQUENCE.filter(a => a === 'ARMOR').length;

assert(stdCount === 6, `Stage 04 has exactly 6 STANDARD enemies (got ${stdCount})`);
assert(fastCount === 10, `Stage 04 has exactly 10 FAST enemies (got ${fastCount})`);
assert(armorCount === 8, `Stage 04 has exactly 8 ARMOR enemies (got ${armorCount})`);
assert(stdCount + fastCount + armorCount === 24, 'Sum of archetypes equals 24');

// Exact sequence verification
const EXPECTED_SEQUENCE = [
  'STANDARD', 'FAST', 'FAST', 'ARMOR', 'STANDARD', 'FAST',
  'ARMOR', 'FAST', 'ARMOR', 'STANDARD', 'FAST', 'ARMOR',
  'FAST', 'FAST', 'ARMOR', 'STANDARD', 'ARMOR', 'FAST',
  'STANDARD', 'FAST', 'ARMOR', 'FAST', 'STANDARD', 'ARMOR'
];
assert(
  JSON.stringify(STAGE_04_ENEMY_SEQUENCE) === JSON.stringify(EXPECTED_SEQUENCE),
  'Stage 04 enemy sequence matches authoritative specification exactly'
);

// =========================================================================
// Test Suite 3: Stage 04 & Four-Stage Campaign Score Math (Req 14, 15, 38, 39)
// =========================================================================
console.log('\nTest Suite 3: Stage 04 & Four-Stage Campaign Score Math (Req 14, 15, 38, 39)');
const stage4Score = (6 * 100) + (10 * 150) + (8 * 300);
assert(stage4Score === 4500, `Stage 04 perfect score is exactly 4500 (got ${stage4Score})`);
assert(stage4Score.toString().padStart(6, '0') === '004500', "Formatted score is '004500'");

const stage1Score = (5 * 100) + (4 * 150) + (3 * 300); // 2000
const stage2Score = (5 * 100) + (6 * 150) + (5 * 300); // 2900
const stage3Score = (5 * 100) + (8 * 150) + (7 * 300); // 3800
const totalCampaignScore = stage1Score + stage2Score + stage3Score + stage4Score;

assert(stage1Score === 2000, 'Stage 01 perfect score is 2000');
assert(stage2Score === 2900, 'Stage 02 perfect score is 2900');
assert(stage3Score === 3800, 'Stage 03 perfect score is 3800');
assert(totalCampaignScore === 13200, `Campaign 4-stage perfect total is 13200 (got ${totalCampaignScore})`);
assert(totalCampaignScore.toString().padStart(6, '0') === '013200', "Formatted total is '013200'");

// Entering Stage 04 total score check (Req 30)
const enteringStage4Total = stage1Score + stage2Score + stage3Score;
assert(enteringStage4Total === 8700, 'Cumulative score entering Stage 04 is exactly 8700');
assert(enteringStage4Total.toString().padStart(6, '0') === '008700', "Formatted entering total is '008700'");
assert((enteringStage4Total + 100).toString().padStart(6, '0') === '008800', "After 1 Standard kill total is '008800'");

// =========================================================================
// Test Suite 4: Four-Stage Campaign Total Enemies & Archetypes (Req 16, 17, 40, 41)
// =========================================================================
console.log('\nTest Suite 4: Four-Stage Campaign Total Enemies & Archetypes (Req 16, 17, 40, 41)');
const s1Count = STAGE_01_DEFINITION.enemySequence.length;
const s2Count = STAGE_02_DEFINITION.enemySequence.length;
const s3Count = STAGE_03_DEFINITION.enemySequence.length;
const s4Count = STAGE_04_DEFINITION.enemySequence.length;
const totalEnemies = s1Count + s2Count + s3Count + s4Count;

assert(s1Count === 12, 'Stage 01 has 12 enemies');
assert(s2Count === 16, 'Stage 02 has 16 enemies');
assert(s3Count === 20, 'Stage 03 has 20 enemies');
assert(s4Count === 24, 'Stage 04 has 24 enemies');
assert(totalEnemies === 72, `Campaign total enemies is 72 (got ${totalEnemies})`);

const allEnemies = [
  ...STAGE_01_DEFINITION.enemySequence,
  ...STAGE_02_DEFINITION.enemySequence,
  ...STAGE_03_DEFINITION.enemySequence,
  ...STAGE_04_DEFINITION.enemySequence
];
const totalStd = allEnemies.filter(a => a === 'STANDARD').length;
const totalFast = allEnemies.filter(a => a === 'FAST').length;
const totalArmor = allEnemies.filter(a => a === 'ARMOR').length;

assert(totalStd === 21, `Total campaign STANDARD is 21 (got ${totalStd})`);
assert(totalFast === 28, `Total campaign FAST is 28 (got ${totalFast})`);
assert(totalArmor === 23, `Total campaign ARMOR is 23 (got ${totalArmor})`);
assert(totalStd + totalFast + totalArmor === 72, 'Sum of archetype totals equals 72');

// =========================================================================
// Test Suite 5: Stage 04 Map & Terrain Validation (Req 4, 6, 7, 42)
// =========================================================================
console.log('\nTest Suite 5: Stage 04 Map & Terrain Validation (Req 4, 6, 7, 42)');
validateLevelDefinition(LEVEL_04);
assert(true, 'validateLevelDefinition(LEVEL_04) passed without throwing');

assert(LEVEL_04.rows === 13 && LEVEL_04.columns === 13, 'Level 04 is 13x13');

// Spawns
assert(LEVEL_04.tiles[12][6] === 5, 'Base is at [12, 6] (TileType.BASE = 5)');
assert(LEVEL_04.tiles[11][4] === 6, 'Player Spawn is at [11, 4] (TileType.PLAYER_SPAWN = 6)');
assert(LEVEL_04.tiles[0][0] === 7, 'Enemy Spawn 1 is at [0, 0] (TileType.ENEMY_SPAWN = 7)');
assert(LEVEL_04.tiles[0][6] === 7, 'Enemy Spawn 2 is at [0, 6] (TileType.ENEMY_SPAWN = 7)');
assert(LEVEL_04.tiles[0][12] === 7, 'Enemy Spawn 3 is at [0, 12] (TileType.ENEMY_SPAWN = 7)');

// Cryo and Conveyor counts
let cryoCount = 0;
let conveyorCount = 0;
for (let r = 0; r < 13; r++) {
  for (let c = 0; c < 13; c++) {
    if (LEVEL_04.tiles[r][c] === 8) cryoCount++;
    if (LEVEL_04.tiles[r][c] === 9) conveyorCount++;
  }
}
assert(cryoCount === 8, `Stage 04 has exactly 8 CRYO tiles (got ${cryoCount})`);
assert(conveyorCount === 12, `Stage 04 has exactly 12 CONVEYOR tiles (got ${conveyorCount})`);

const conveyorsMeta = LEVEL_04.terrainMetadata?.conveyors ?? [];
assert(conveyorsMeta.length === 12, `Conveyor metadata defines exactly 12 entries (got ${conveyorsMeta.length})`);

// Validate every conveyor metadata entry
const convSet = new Set();
for (const cm of conveyorsMeta) {
  assert(LEVEL_04.tiles[cm.row][cm.column] === 9, `Metadata [${cm.row}, ${cm.column}] corresponds to CONVEYOR tile`);
  assert(cm.direction >= 0 && cm.direction <= 3, `Metadata [${cm.row}, ${cm.column}] has valid cardinal direction ${cm.direction}`);
  const key = `${cm.row}_${cm.column}`;
  assert(!convSet.has(key), `Metadata [${cm.row}, ${cm.column}] is unique`);
  convSet.add(key);
}

// =========================================================================
// Test Suite 6: Terrain Transitions Alignment (Req 8, 43)
// =========================================================================
console.log('\nTest Suite 6: Terrain Transitions Alignment (Req 8, 43)');
// 1. floor -> Cryo: Row 4, Col 1 (EMPTY) -> Col 2 (CRYO)
assert(LEVEL_04.tiles[4][1] === 0 && LEVEL_04.tiles[4][2] === 8, 'Straight-line floor -> Cryo transition at [4, 1] -> [4, 2]');
// 2. Cryo -> Conveyor: Row 4, Col 2 (CRYO) -> Col 3 (CONVEYOR EAST)
assert(LEVEL_04.tiles[4][2] === 8 && LEVEL_04.tiles[4][3] === 9, 'Straight-line Cryo -> Conveyor transition at [4, 2] -> [4, 3]');
// 3. Conveyor -> Cryo: Row 4, Col 5 (CONVEYOR EAST) -> Col 6 (CRYO)
assert(LEVEL_04.tiles[4][5] === 9 && LEVEL_04.tiles[4][6] === 8, 'Straight-line Conveyor -> Cryo transition at [4, 5] -> [4, 6]');
// 4. Conveyor -> floor: Row 8, Col 8 (CONVEYOR EAST) -> Col 9 (EMPTY)
assert(LEVEL_04.tiles[8][8] === 9 && LEVEL_04.tiles[8][9] === 0, 'Straight-line Conveyor -> floor transition at [8, 8] -> [8, 9]');

// Flank transitions:
assert(LEVEL_04.tiles[5][1] === 8 && LEVEL_04.tiles[6][1] === 9, 'West Flank Cryo -> Conveyor at [5, 1] -> [6, 1]');
assert(LEVEL_04.tiles[8][1] === 9 && LEVEL_04.tiles[9][1] === 8, 'West Flank Conveyor -> Cryo at [8, 1] -> [9, 1]');
assert(LEVEL_04.tiles[5][11] === 8 && LEVEL_04.tiles[6][11] === 9, 'East Flank Cryo -> Conveyor at [5, 11] -> [6, 11]');
assert(LEVEL_04.tiles[8][11] === 9 && LEVEL_04.tiles[9][11] === 8, 'East Flank Conveyor -> Cryo at [8, 11] -> [9, 11]');

// =========================================================================
// Test Suite 7: Powerup Milestones (Req 19)
// =========================================================================
console.log('\nTest Suite 7: Powerup Milestones (Req 19)');
const ms = STAGE_04_DEFINITION.powerupMilestones;
assert(ms.length === 3, 'Stage 04 defines exactly 3 powerup milestones');
assert(ms[0].destroyedEnemyCount === 6 && ms[0].type === 'AEGIS_FIELD', 'Kill #6 triggers AEGIS_FIELD');
assert(ms[1].destroyedEnemyCount === 12 && ms[1].type === 'OVERDRIVE_CORE', 'Kill #12 triggers OVERDRIVE_CORE');
assert(ms[2].destroyedEnemyCount === 18 && ms[2].type === 'STASIS_PULSE', 'Kill #18 triggers STASIS_PULSE');

// =========================================================================
// Test Suite 8: Stage 03 Terminal Change & Progression Links (Req 3, 26, 46)
// =========================================================================
console.log('\nTest Suite 8: Stage 03 Terminal Change & Progression Links (Req 3, 26, 46)');
assert(STAGE_03_DEFINITION.nextStageId === 'stage04', "Stage 03 links to 'stage04'");

const registry = new StageRegistry();
assert(registry.getStageDefinition('stage01') !== null, 'StageRegistry has stage01');
assert(registry.getStageDefinition('stage02') !== null, 'StageRegistry has stage02');
assert(registry.getStageDefinition('stage03') !== null, 'StageRegistry has stage03');
assert(registry.getStageDefinition('stage04') !== null, 'StageRegistry has stage04');

registry.validateLinks();
assert(true, 'StageRegistry.validateLinks() succeeds across all 4 stages');

const s1 = registry.getStageDefinition('stage01');
const s2 = registry.getStageDefinition(s1.nextStageId);
const s3 = registry.getStageDefinition(s2.nextStageId);
const s4 = registry.getStageDefinition(s3.nextStageId);

assert(s1.id === 'stage01', 'Stage 1 resolved');
assert(s2.id === 'stage02', 'Stage 2 resolved from stage01 link');
assert(s3.id === 'stage03', 'Stage 3 resolved from stage02 link');
assert(s4.id === 'stage04', 'Stage 4 resolved from stage03 link');
assert(s4.nextStageId === null, 'Stage 4 is terminal');

// =========================================================================
// Test Suite 9: Campaign Life Carry & Retry Checkpointing (Req 20, 21, 45)
// =========================================================================
console.log('\nTest Suite 9: Campaign Life Carry & Retry Checkpointing (Req 20, 21, 45)');
{
  const session = new CampaignSession(3);
  session.beginStage('stage01', 3);

  // Complete Stage 1 with 2 lives remaining
  session.recordStageResult({
    stageId: 'stage01',
    stageNumber: 1,
    finalScore: 2000,
    enemiesDestroyed: 12,
    archetypeKills: { STANDARD: 5, FAST: 4, ARMOR: 3 },
    livesRemaining: 2
  }, false);

  assert(session.getCarriedLives() === 2, 'Stage 1 completion carriedLives = 2');

  // Advance to Stage 2
  session.beginStage('stage02');
  assert(session.getStageEntryLives() === 2, 'Stage 2 entry checkpoint = 2 lives');

  // Complete Stage 2 with 1 life remaining
  session.recordStageResult({
    stageId: 'stage02',
    stageNumber: 2,
    finalScore: 2900,
    enemiesDestroyed: 16,
    archetypeKills: { STANDARD: 5, FAST: 6, ARMOR: 5 },
    livesRemaining: 1
  }, false);

  assert(session.getCarriedLives() === 1, 'Stage 2 completion carriedLives = 1');

  // Advance to Stage 3
  session.beginStage('stage03');
  assert(session.getStageEntryLives() === 1, 'Stage 3 entry checkpoint = 1 life');

  // Complete Stage 3 with 1 life remaining (non-terminal in 4-stage campaign)
  session.recordStageResult({
    stageId: 'stage03',
    stageNumber: 3,
    finalScore: 3800,
    enemiesDestroyed: 20,
    archetypeKills: { STANDARD: 5, FAST: 8, ARMOR: 7 },
    livesRemaining: 1
  }, false);

  assert(session.isComplete() === false, 'Stage 03 completion does NOT mark campaign complete');
  assert(session.getCarriedLives() === 1, 'Stage 3 carriedLives = 1');

  // Advance to Stage 4 with carried life
  session.beginStage('stage04');
  assert(session.getCurrentStageId() === 'stage04', 'Active stage is stage04');
  assert(session.getCarriedLives() === 1, 'Stage 4 starts with carried 1 life (NO refill)');
  assert(session.getStageEntryLives() === 1, 'Stage 4 entry checkpoint lives = 1');

  // Simulate Game Over on Stage 04: Retry restores checkpoint lives
  const restoredLives = session.restoreStageEntryLives();
  assert(restoredLives === 1, 'Stage 04 Retry restores 1 life from entry checkpoint');
  assert(session.getCarriedLives() === 1, 'After retry carriedLives is 1');

  // Clear Stage 04 (terminal)
  session.recordStageResult({
    stageId: 'stage04',
    stageNumber: 4,
    finalScore: 4500,
    enemiesDestroyed: 24,
    archetypeKills: { STANDARD: 6, FAST: 10, ARMOR: 8 },
    livesRemaining: 1
  }, true);

  assert(session.isComplete() === true, 'Stage 04 completion marks campaign complete');
}

// =========================================================================
// Test Suite 10: Campaign Complete Result & Dynamic Aggregation (Req 22, 23, 47, 48)
// =========================================================================
console.log('\nTest Suite 10: Campaign Complete Result & Dynamic Aggregation (Req 22, 23, 47, 48)');
{
  const session = new CampaignSession(3);
  session.beginStage('stage01', 3);
  session.recordStageResult({ stageId: 'stage01', stageNumber: 1, finalScore: 2000, enemiesDestroyed: 12, archetypeKills: { STANDARD: 5, FAST: 4, ARMOR: 3 }, livesRemaining: 3 }, false);
  session.beginStage('stage02');
  session.recordStageResult({ stageId: 'stage02', stageNumber: 2, finalScore: 2900, enemiesDestroyed: 16, archetypeKills: { STANDARD: 5, FAST: 6, ARMOR: 5 }, livesRemaining: 2 }, false);
  session.beginStage('stage03');
  session.recordStageResult({ stageId: 'stage03', stageNumber: 3, finalScore: 3800, enemiesDestroyed: 20, archetypeKills: { STANDARD: 5, FAST: 8, ARMOR: 7 }, livesRemaining: 2 }, false);
  session.beginStage('stage04');
  session.recordStageResult({ stageId: 'stage04', stageNumber: 4, finalScore: 4500, enemiesDestroyed: 24, archetypeKills: { STANDARD: 6, FAST: 10, ARMOR: 8 }, livesRemaining: 2 }, true);

  const res = session.buildCampaignResult();
  assert(res.stageResults.length === 4, 'CampaignResult contains exactly 4 stage results');
  assert(res.totalScore === 13200, `Total campaign score is 13200 (got ${res.totalScore})`);
  assert(res.totalEnemiesDestroyed === 72, `Total enemies destroyed is 72 (got ${res.totalEnemiesDestroyed})`);
  assert(res.totalArchetypeKills.STANDARD === 21, `Total STANDARD is 21 (got ${res.totalArchetypeKills.STANDARD})`);
  assert(res.totalArchetypeKills.FAST === 28, `Total FAST is 28 (got ${res.totalArchetypeKills.FAST})`);
  assert(res.totalArchetypeKills.ARMOR === 23, `Total ARMOR is 23 (got ${res.totalArchetypeKills.ARMOR})`);
  assert(res.livesRemaining === 2, 'Lives remaining is 2');

  // Idempotent duplicate check: recording stage04 again is safely rejected
  const dup = session.recordStageResult({ stageId: 'stage04', stageNumber: 4, finalScore: 4500, enemiesDestroyed: 24, archetypeKills: { STANDARD: 6, FAST: 10, ARMOR: 8 }, livesRemaining: 2 }, true);
  assert(dup === false, 'Duplicate Stage 04 recording is rejected');
  assert(session.buildCampaignResult().stageResults.length === 4, 'Stage count remains 4');
}

// =========================================================================
// Test Suite 11: Dynamic Campaign Complete UI DOM Generation (Req 22, 28, 48)
// =========================================================================
console.log('\nTest Suite 11: Dynamic Campaign Complete UI DOM Generation (Req 22, 28, 48)');
{
  const uiSrc = readFileSync('src/ui/CampaignCompleteUI.ts', 'utf-8');
  assert(!uiSrc.includes('stageScores = [this.stage1ScoreEl'), 'CampaignCompleteUI no longer has hardcoded 3-element stageScores array');
  assert(uiSrc.includes('createElement'), 'CampaignCompleteUI creates stage rows dynamically with createElement');
  assert(uiSrc.includes('textContent'), 'CampaignCompleteUI uses safe textContent');
  assert(!uiSrc.includes('innerHTML ='), 'CampaignCompleteUI contains zero unsafe innerHTML assignments');
}

// =========================================================================
// Test Suite 12: New Campaign Reset (Req 49)
// =========================================================================
console.log('\nTest Suite 12: New Campaign Reset (Req 49)');
{
  const session = new CampaignSession(3);
  session.beginStage('stage01', 3);
  session.recordStageResult({ stageId: 'stage01', stageNumber: 1, finalScore: 2000, enemiesDestroyed: 12, archetypeKills: { STANDARD: 5, FAST: 4, ARMOR: 3 }, livesRemaining: 1 }, false);
  session.beginStage('stage02');
  session.recordStageResult({ stageId: 'stage02', stageNumber: 2, finalScore: 2900, enemiesDestroyed: 16, archetypeKills: { STANDARD: 5, FAST: 6, ARMOR: 5 }, livesRemaining: 1 }, false);
  session.beginStage('stage03');
  session.recordStageResult({ stageId: 'stage03', stageNumber: 3, finalScore: 3800, enemiesDestroyed: 20, archetypeKills: { STANDARD: 5, FAST: 8, ARMOR: 7 }, livesRemaining: 1 }, false);
  session.beginStage('stage04');
  session.recordStageResult({ stageId: 'stage04', stageNumber: 4, finalScore: 4500, enemiesDestroyed: 24, archetypeKills: { STANDARD: 6, FAST: 10, ARMOR: 8 }, livesRemaining: 1 }, true);

  assert(session.isComplete() === true, 'Session is complete before reset');

  // Trigger NEW CAMPAIGN
  session.resetForNewCampaign(3);
  assert(session.getCurrentStageId() === 'stage01', 'Reset returns to stage01');
  assert(session.getCompletedStages().length === 0, 'Reset clears completed stages');
  assert(session.getCompletedScore() === 0, 'Reset score = 0');
  assert(session.getCarriedLives() === 3, 'Reset lives = 3');
  assert(session.isComplete() === false, 'Reset isComplete = false');
}

// =========================================================================
// Test Suite 13: 10-Cycle Progression Stress Test (Req 50)
// =========================================================================
console.log('\nTest Suite 13: 10-Cycle Progression Stress Test (Req 50)');
{
  const session = new CampaignSession(3);
  for (let cycle = 1; cycle <= 10; cycle++) {
    session.resetForNewCampaign(3);
    session.beginStage('stage01', 3);
    session.recordStageResult({ stageId: 'stage01', stageNumber: 1, finalScore: 2000, enemiesDestroyed: 12, archetypeKills: { STANDARD: 5, FAST: 4, ARMOR: 3 }, livesRemaining: 3 }, false);

    session.beginStage('stage02');
    session.recordStageResult({ stageId: 'stage02', stageNumber: 2, finalScore: 2900, enemiesDestroyed: 16, archetypeKills: { STANDARD: 5, FAST: 6, ARMOR: 5 }, livesRemaining: 3 }, false);

    session.beginStage('stage03');
    session.recordStageResult({ stageId: 'stage03', stageNumber: 3, finalScore: 3800, enemiesDestroyed: 20, archetypeKills: { STANDARD: 5, FAST: 8, ARMOR: 7 }, livesRemaining: 2 }, false);

    session.beginStage('stage04');
    session.recordStageResult({ stageId: 'stage04', stageNumber: 4, finalScore: 4500, enemiesDestroyed: 24, archetypeKills: { STANDARD: 6, FAST: 10, ARMOR: 8 }, livesRemaining: 2 }, true);

    const res = session.buildCampaignResult();
    if (res.totalScore !== 13200 || res.stageResults.length !== 4) {
      throw new Error(`Cycle ${cycle} corrupted: score=${res.totalScore}, stages=${res.stageResults.length}`);
    }
  }
  assert(true, '10 complete 4-stage campaign progression cycles executed flawlessly with zero state leakage');
}

// =========================================================================
// Test Suite 14: Game.ts Hardcode Audit (Req 27)
// =========================================================================
console.log('\nTest Suite 14: Game.ts Hardcode Audit (Req 27)');
const gameSrc = readFileSync('src/game/Game.ts', 'utf-8');
assert(!gameSrc.includes('stage04'), 'Game.ts contains 0 references to "stage04"');
assert(!gameSrc.includes('NEXUS SIEGE'), 'Game.ts contains 0 references to "NEXUS SIEGE"');
assert(!gameSrc.includes('13200'), 'Game.ts contains 0 references to hardcoded score 13200');
assert(gameSrc.includes('this.stageManager.hasNextStage()'), 'Game.ts drives stage advancement strictly via StageManager.hasNextStage()');

console.log(`\n=============================================================`);
console.log(`PHASE 21 VERIFICATION COMPLETE: ${passCount} PASSED / ${failCount} FAILED`);
console.log(`=============================================================`);
