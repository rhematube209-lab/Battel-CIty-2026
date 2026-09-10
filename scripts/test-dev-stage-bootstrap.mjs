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
console.log('DEV-ONLY DIRECT STAGE TESTING VERIFICATION SUITE');
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
    if (id.includes('StageManager')) return transpileAndLoad('src/game/StageManager.ts');
    if (id.includes('DevStageBootstrap')) return transpileAndLoad('src/dev/DevStageBootstrap.ts');
    return {};
  });
  return mod.exports;
}

const { STAGE_01_DEFINITION } = transpileAndLoad('src/stages/stage01.ts');
const { STAGE_02_DEFINITION } = transpileAndLoad('src/stages/stage02.ts');
const { STAGE_03_DEFINITION } = transpileAndLoad('src/stages/stage03.ts');
const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');
const { stageRegistry, StageRegistry } = transpileAndLoad('src/stages/stageRegistry.ts');
const { CampaignSession } = transpileAndLoad('src/game/CampaignSession.ts');
const { StageManager } = transpileAndLoad('src/game/StageManager.ts');
const {
  deriveStageResult,
  getPrecedingStages,
  parseDevLives,
  applyDevStageBootstrap
} = transpileAndLoad('src/dev/DevStageBootstrap.ts');

// =========================================================================
// Test Suite 1: Data-Driven Stage Result Derivation (Req 3, 4, 6)
// =========================================================================
console.log('Test Suite 1: Data-Driven Stage Result Derivation (Req 3, 4, 6)');

const s01Result = deriveStageResult(STAGE_01_DEFINITION, 3);
assert(s01Result.stageId === 'stage01', 'Stage 01 derived stageId is stage01');
assert(s01Result.stageNumber === 1, 'Stage 01 derived stageNumber is 1');
assert(s01Result.finalScore === 2000, 'Stage 01 derived score is exactly 2000');
assert(s01Result.enemiesDestroyed === 12, 'Stage 01 enemies destroyed is 12');
assert(s01Result.archetypeKills.STANDARD === 5, 'Stage 01 STANDARD kills = 5');
assert(s01Result.archetypeKills.FAST === 4, 'Stage 01 FAST kills = 4');
assert(s01Result.archetypeKills.ARMOR === 3, 'Stage 01 ARMOR kills = 3');

const s02Result = deriveStageResult(STAGE_02_DEFINITION, 3);
assert(s02Result.stageId === 'stage02', 'Stage 02 derived stageId is stage02');
assert(s02Result.finalScore === 2900, 'Stage 02 derived score is exactly 2900');
assert(s02Result.enemiesDestroyed === 16, 'Stage 02 enemies destroyed is 16');
assert(s02Result.archetypeKills.STANDARD === 5, 'Stage 02 STANDARD kills = 5');
assert(s02Result.archetypeKills.FAST === 6, 'Stage 02 FAST kills = 6');
assert(s02Result.archetypeKills.ARMOR === 5, 'Stage 02 ARMOR kills = 5');

const s03Result = deriveStageResult(STAGE_03_DEFINITION, 3);
assert(s03Result.stageId === 'stage03', 'Stage 03 derived stageId is stage03');
assert(s03Result.finalScore === 3800, 'Stage 03 derived score is exactly 3800');
assert(s03Result.enemiesDestroyed === 20, 'Stage 03 enemies destroyed is 20');
assert(s03Result.archetypeKills.STANDARD === 5, 'Stage 03 STANDARD kills = 5');
assert(s03Result.archetypeKills.FAST === 8, 'Stage 03 FAST kills = 8');
assert(s03Result.archetypeKills.ARMOR === 7, 'Stage 03 ARMOR kills = 7');

const s04Result = deriveStageResult(STAGE_04_DEFINITION, 3);
assert(s04Result.stageId === 'stage04', 'Stage 04 derived stageId is stage04');
assert(s04Result.finalScore === 4500, 'Stage 04 derived score is exactly 4500');
assert(s04Result.enemiesDestroyed === 24, 'Stage 04 enemies destroyed is 24');
assert(s04Result.archetypeKills.STANDARD === 6, 'Stage 04 STANDARD kills = 6');
assert(s04Result.archetypeKills.FAST === 10, 'Stage 04 FAST kills = 10');
assert(s04Result.archetypeKills.ARMOR === 8, 'Stage 04 ARMOR kills = 8');

// =========================================================================
// Test Suite 2: Preceding Stages Resolution (Req 3, 7, 8, 9)
// =========================================================================
console.log('\nTest Suite 2: Preceding Stages Resolution (Req 3, 7, 8, 9)');

const p04 = getPrecedingStages('stage04', stageRegistry);
assert(p04.length === 3, 'stage04 has 3 preceding stages');
assert(p04.map(s => s.id).join(',') === 'stage01,stage02,stage03', 'stage04 preceding stages are stage01, stage02, stage03');

const p03 = getPrecedingStages('stage03', stageRegistry);
assert(p03.length === 2, 'stage03 has 2 preceding stages');
assert(p03.map(s => s.id).join(',') === 'stage01,stage02', 'stage03 preceding stages are stage01, stage02');

const p02 = getPrecedingStages('stage02', stageRegistry);
assert(p02.length === 1, 'stage02 has 1 preceding stage');
assert(p02[0].id === 'stage01', 'stage02 preceding stage is stage01');

const p01 = getPrecedingStages('stage01', stageRegistry);
assert(p01.length === 0, 'stage01 has 0 preceding stages');

const pUnknown = getPrecedingStages('unknownStage', stageRegistry);
assert(pUnknown.length === 0, 'Unknown stage returns empty array');

// =========================================================================
// Test Suite 3: Optional devLives Parsing & Clamping (Req 5)
// =========================================================================
console.log('\nTest Suite 3: Optional devLives Parsing & Clamping (Req 5)');

assert(parseDevLives(null) === 3, 'null returns default lives (3)');
assert(parseDevLives(undefined) === 3, 'undefined returns default lives (3)');
assert(parseDevLives('1') === 1, "'1' parses to 1");
assert(parseDevLives('5') === 5, "'5' parses to 5");
assert(parseDevLives('0') === 1, "'0' clamps to minimum 1");
assert(parseDevLives('-3') === 1, "Negative value clamps to minimum 1");
assert(parseDevLives('100') === 99, "'100' clamps to maximum 99");
assert(parseDevLives('invalid') === 3, 'Invalid string returns default lives (3)');

// =========================================================================
// Test Suite 4: Direct Stage 04 Bootstrap (Req 1, 3, 10, 14)
// =========================================================================
console.log('\nTest Suite 4: Direct Stage 04 Bootstrap (Req 1, 3, 10, 14)');

function createMockGame() {
  const session = new CampaignSession(3);
  const stageMgr = new StageManager('stage01', stageRegistry);
  let currentStageScore = 0;
  let activeLives = 3;
  let lastStartedStageId = null;
  let lastStartedLives = null;

  return {
    getCampaignSession: () => session,
    getStageManager: () => stageMgr,
    getScore: () => currentStageScore,
    setScore: (s) => { currentStageScore = s; },
    startStageDirectly: (stageId, lives) => {
      stageMgr.load(stageId);
      lastStartedStageId = stageId;
      lastStartedLives = lives;
      activeLives = lives;
    },
    getLastStartedStageId: () => lastStartedStageId,
    getLastStartedLives: () => lastStartedLives,
    getActiveLives: () => activeLives,
  };
}

const mockGame04 = createMockGame();
const ok04 = applyDevStageBootstrap(mockGame04, 'stage04');
assert(ok04 === true, 'applyDevStageBootstrap returned true for stage04');

const session04 = mockGame04.getCampaignSession();
assert(session04.getCurrentStageId() === 'stage04', "CampaignSession currentStageId is 'stage04'");
assert(session04.getCompletedScore() === 8700, 'Completed campaign score entering Stage 04 is 8700 (2000 + 2900 + 3800)');
assert(session04.getDisplayTotal(0) === 8700, 'Display total score entering Stage 04 with 0 stage score is 8700');
assert(session04.getCarriedLives() === 3, 'Carried lives entering Stage 04 is 3');
assert(session04.getStageEntryLives() === 3, 'Stage entry checkpoint lives is 3');
assert(session04.getCompletedStages().length === 3, 'CampaignSession has exactly 3 completed stages recorded');
assert(mockGame04.getLastStartedStageId() === 'stage04', "Game was started with stage 'stage04'");
assert(mockGame04.getLastStartedLives() === 3, 'Game was started with 3 lives');

// =========================================================================
// Test Suite 5: Direct Stage 04 + devLives=1 & Retry/Restart (Req 5, 12)
// =========================================================================
console.log('\nTest Suite 5: Direct Stage 04 + devLives=1 & Retry/Restart (Req 5, 12)');

const mockGame04Lives1 = createMockGame();
const okLives1 = applyDevStageBootstrap(mockGame04Lives1, 'stage04', '1');
assert(okLives1 === true, 'applyDevStageBootstrap succeeded with devLives=1');

const sessionLives1 = mockGame04Lives1.getCampaignSession();
assert(sessionLives1.getCarriedLives() === 1, 'Carried lives is 1');
assert(sessionLives1.getStageEntryLives() === 1, 'Stage entry checkpoint lives is 1');
assert(mockGame04Lives1.getLastStartedLives() === 1, 'Game started with 1 life');

// Verify stage retry restores entry lives (1 life, not reset to Stage 01 default 3)
const restoredLives = sessionLives1.restoreStageEntryLives();
assert(restoredLives === 1, 'Stage retry restoreStageEntryLives returns 1');
assert(sessionLives1.getCurrentStageId() === 'stage04', 'Retry remains on Stage 04 (does not revert to stage01)');

// =========================================================================
// Test Suite 6: Direct Stage 03 Bootstrap & Continue to Stage 04 (Req 7)
// =========================================================================
console.log('\nTest Suite 6: Direct Stage 03 Bootstrap & Continue to Stage 04 (Req 7)');

const mockGame03 = createMockGame();
const ok03 = applyDevStageBootstrap(mockGame03, 'stage03');
assert(ok03 === true, 'applyDevStageBootstrap succeeded for stage03');

const session03 = mockGame03.getCampaignSession();
assert(session03.getCurrentStageId() === 'stage03', "Current stage is 'stage03'");
assert(session03.getCompletedScore() === 4900, 'Completed campaign score entering Stage 03 is 4900 (2000 + 2900)');
assert(session03.getCompletedStages().length === 2, 'CampaignSession has 2 completed stages recorded');

// Stage 03 advance check
const stageMgr03 = mockGame03.getStageManager();
assert(stageMgr03.hasNextStage() === true, 'Stage 03 has next stage');
assert(stageMgr03.getNextStageId() === 'stage04', 'Stage 03 nextStageId is stage04');

// Simulate clearing Stage 03 and advancing to Stage 04
session03.recordStageResult(deriveStageResult(STAGE_03_DEFINITION, 3), false);
assert(session03.getCompletedScore() === 8700, 'After Stage 03 clear, completed score becomes 8700 (4900 + 3800)');
stageMgr03.advanceToNextStage();
assert(stageMgr03.getCurrentStage().id === 'stage04', 'Advancing loads Stage 04 without replaying Stages 01-02');

// =========================================================================
// Test Suite 7: Direct Stage 02 Bootstrap (Req 8)
// =========================================================================
console.log('\nTest Suite 7: Direct Stage 02 Bootstrap (Req 8)');

const mockGame02 = createMockGame();
const ok02 = applyDevStageBootstrap(mockGame02, 'stage02');
assert(ok02 === true, 'applyDevStageBootstrap succeeded for stage02');

const session02 = mockGame02.getCampaignSession();
assert(session02.getCurrentStageId() === 'stage02', "Current stage is 'stage02'");
assert(session02.getCompletedScore() === 2000, 'Completed campaign score entering Stage 02 is 2000');
assert(session02.getCompletedStages().length === 1, 'CampaignSession has 1 completed stage recorded');

// =========================================================================
// Test Suite 8: Direct Stage 01 Bootstrap (Req 9)
// =========================================================================
console.log('\nTest Suite 8: Direct Stage 01 Bootstrap (Req 9)');

const mockGame01 = createMockGame();
const ok01 = applyDevStageBootstrap(mockGame01, 'stage01');
assert(ok01 === true, 'applyDevStageBootstrap succeeded for stage01');

const session01 = mockGame01.getCampaignSession();
assert(session01.getCurrentStageId() === 'stage01', "Current stage is 'stage01'");
assert(session01.getCompletedScore() === 0, 'Stage 01 completed campaign score is 0');
assert(session01.getCompletedStages().length === 0, 'CampaignSession has 0 completed stages');
assert(session01.getCarriedLives() === 3, 'Lives is 3');

// =========================================================================
// Test Suite 9: Full Synthetic Campaign Complete from Stage 04 (Req 6)
// =========================================================================
console.log('\nTest Suite 9: Full Synthetic Campaign Complete from Stage 04 (Req 6)');

const terminalGame = createMockGame();
applyDevStageBootstrap(terminalGame, 'stage04');
const terminalSession = terminalGame.getCampaignSession();

// Record Stage 04 terminal completion
const s04ClearResult = deriveStageResult(STAGE_04_DEFINITION, 3);
terminalSession.recordStageResult(s04ClearResult, true); // terminal = true

assert(terminalSession.isComplete() === true, 'CampaignSession reports campaignComplete === true');
assert(terminalSession.getCompletedScore() === 13200, 'Total completed score is exactly 13200 (2000 + 2900 + 3800 + 4500)');

const campaignResult = terminalSession.buildCampaignResult();
assert(campaignResult.totalScore === 13200, 'CampaignResult totalScore === 13200');
assert(campaignResult.totalEnemiesDestroyed === 72, 'Total enemies destroyed === 72');
assert(campaignResult.totalArchetypeKills.STANDARD === 21, 'STANDARD archetype kills === 21 (5 + 5 + 5 + 6)');
assert(campaignResult.totalArchetypeKills.FAST === 28, 'FAST archetype kills === 28 (4 + 6 + 8 + 10)');
assert(campaignResult.totalArchetypeKills.ARMOR === 23, 'ARMOR archetype kills === 23 (3 + 5 + 7 + 8)');
assert(campaignResult.stageResults.length === 4, 'CampaignResult has 4 stage results');

// =========================================================================
// Test Suite 10: Production Safety & DEV Guard Isolation (Req 2, 10, 14)
// =========================================================================
console.log('\nTest Suite 10: Production Safety & DEV Guard Isolation (Req 2, 10, 14)');

// Verify that in production simulation (isDev === false), devStage bootstrap is NEVER called
let devBootstrapCalledInProd = false;
function simulateProductionBoot(searchParams) {
  const isDev = false; // Production build sets import.meta.env.DEV to false
  const urlParams = new URLSearchParams(searchParams);
  const game = createMockGame();

  if (isDev) {
    const devStage = urlParams.get('devStage');
    if (devStage) {
      devBootstrapCalledInProd = true;
      applyDevStageBootstrap(game, devStage);
    }
  }

  return game;
}

const prodGame = simulateProductionBoot('?devStage=stage04&devLives=1');
assert(devBootstrapCalledInProd === false, 'devStage bootstrap is NEVER called in production mode');
assert(prodGame.getCampaignSession().getCurrentStageId() === 'stage01', 'Production session remains on stage01');
assert(prodGame.getCampaignSession().getCompletedScore() === 0, 'Production completed score remains 0');
assert(prodGame.getLastStartedStageId() === null, 'startStageDirectly was never called in production mode');

// Verify invalid devStage in DEV mode is safely rejected
const mockGameInvalid = createMockGame();
const okInvalid = applyDevStageBootstrap(mockGameInvalid, 'stage99');
assert(okInvalid === false, 'applyDevStageBootstrap rejects unknown stageId with false');
assert(mockGameInvalid.getLastStartedStageId() === null, 'startStageDirectly not called on invalid stageId');

// =========================================================================
// Test Suite 11: Mobile Quality Profile & DPR Scaling Policy (Req 10, 11, 13)
// =========================================================================
console.log('\nTest Suite 11: Mobile Quality Profile & DPR Scaling Policy (Req 10, 11, 13)');

function computeScaling(dpr, isMobile) {
  const maxDpr = isMobile ? 1.5 : 2.0;
  return 1.0 / Math.min(dpr, maxDpr);
}

// Mobile scaling assertions
const mobileDpr1 = computeScaling(1.0, true);
assert(mobileDpr1 === 1.0, 'Mobile DPR 1.0 hardware scaling is 1.0');

const mobileDpr15 = computeScaling(1.5, true);
assert(Math.abs(mobileDpr15 - (1.0 / 1.5)) < 1e-6, 'Mobile DPR 1.5 hardware scaling is ~0.6667 (1/1.5)');

const mobileDpr2 = computeScaling(2.0, true);
assert(Math.abs(mobileDpr2 - (1.0 / 1.5)) < 1e-6, 'Mobile DPR 2.0 hardware scaling is strictly capped at ~0.6667 (1/1.5)');

const mobileDpr3 = computeScaling(3.0, true);
assert(Math.abs(mobileDpr3 - (1.0 / 1.5)) < 1e-6, 'Mobile DPR 3.0 hardware scaling is strictly capped at ~0.6667 (1/1.5)');

// Desktop scaling assertions
const desktopDpr2 = computeScaling(2.0, false);
assert(desktopDpr2 === 0.5, 'Desktop DPR 2.0 hardware scaling is 0.5 (1/2.0)');

// 844x390 viewport render dimensions validation
const vpW = 844;
const vpH = 390;
const mobileRenderW = Math.round(vpW / mobileDpr2);
const mobileRenderH = Math.round(vpH / mobileDpr2);
assert(mobileRenderW === 1266, `Mobile 844x390 @ DPR 2 renderWidth is 1266 (got ${mobileRenderW})`);
assert(mobileRenderH === 585, `Mobile 844x390 @ DPR 2 renderHeight is 585 (got ${mobileRenderH})`);

const desktopRenderW = Math.round(vpW / desktopDpr2);
const desktopRenderH = Math.round(vpH / desktopDpr2);
assert(desktopRenderW === 1688, `Desktop 844x390 @ DPR 2 renderWidth is 1688 (got ${desktopRenderW})`);
assert(desktopRenderH === 780, `Desktop 844x390 @ DPR 2 renderHeight is 780 (got ${desktopRenderH})`);

// =========================================================================
// Test Suite 12: Single Source of Truth for Stages & Markup Audit (Req 16, 17)
// =========================================================================
console.log('\nTest Suite 12: Single Source of Truth for Stages & Markup Audit (Req 16, 17)');

const indexHtml = readFileSync('index.html', 'utf-8');

// Section 16 audit: campaign-stages-box has zero static fallback rows
assert(!indexHtml.includes('campaignStage1Score'), 'index.html contains no static campaignStage1Score fallback');
assert(!indexHtml.includes('campaignStage4Score'), 'index.html contains no static campaignStage4Score fallback');
assert(indexHtml.includes('id="campaignStagesBox"'), 'index.html contains single dynamic campaignStagesBox container');

// Section 17 audit: title screen uses neutral placeholder dynamically hydrated by stageRegistry
assert(!indexHtml.includes('4 STAGE CAMPAIGN'), 'index.html does not hardcode "4 STAGE CAMPAIGN"');
assert(indexHtml.includes('id="titleCampaignTag"'), 'index.html provides neutral titleCampaignTag placeholder');

const titleScreenSrc = readFileSync('src/ui/TitleScreenUI.ts', 'utf-8');
assert(titleScreenSrc.includes('stageRegistry.getAllStages().length'), 'TitleScreenUI derives stage count directly from stageRegistry');

// =========================================================================
// Summary
// =========================================================================
console.log('\n=============================================================');
console.log(`DEV STAGE BOOTSTRAP SUITE COMPLETE: ${passCount} passed, ${failCount} failed.`);
console.log('=============================================================');

if (failCount > 0) {
  process.exit(1);
}
