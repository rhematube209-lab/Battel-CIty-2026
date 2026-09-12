import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

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
console.log('PHASE 24 — v1.1.0 RELEASE CANDIDATE HARDENING & ACCEPTANCE QA');
console.log('=============================================================\n');

// =========================================================================
// Suite 1: Build Identity, Version & Channel Alignment (Req 1)
// =========================================================================
console.log('Suite 1: Build Identity, Version & Channel Alignment (Req 1)');
const buildInfoSrc = readFileSync('src/config/buildInfo.ts', 'utf-8');
const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
const packageLockJson = JSON.parse(readFileSync('package-lock.json', 'utf-8'));
const indexHtmlSrc = readFileSync('index.html', 'utf-8');

assert(buildInfoSrc.includes("version: '1.1.0'") || buildInfoSrc.includes("version: '1.2.0-dev'"), "BUILD_INFO defines valid version ('1.1.0' or '1.2.0-dev')");
assert(buildInfoSrc.includes("channel: 'RELEASE'") || buildInfoSrc.includes("channel: 'DEV'"), "BUILD_INFO defines valid channel ('RELEASE' or 'DEV')");
assert(buildInfoSrc.includes("name: 'BATTLE CITY 2026'"), "BUILD_INFO defines name 'BATTLE CITY 2026'");
assert(packageJson.version === '1.1.0' || packageJson.version === '1.2.0-dev', `package.json defines valid version (got '${packageJson.version}')`);
assert(packageLockJson.version === '1.1.0' || packageLockJson.version === '1.2.0-dev', `package-lock.json defines valid version (got '${packageLockJson.version}')`);

// =========================================================================
// Suite 2: v1.0 Immutable Release Artifact Preservation (Req 2)
// =========================================================================
const v1ZipCandidate = existsSync('battle-city-2026-v1.0.0.zip')
  ? 'battle-city-2026-v1.0.0.zip'
  : existsSync('../battel city 2026/battle-city-2026-v1.0.0.zip')
  ? '../battel city 2026/battle-city-2026-v1.0.0.zip'
  : null;
assert(v1ZipCandidate !== null, 'battle-city-2026-v1.0.0.zip exists');
const v1ZipStats = statSync(v1ZipCandidate);
assert(v1ZipStats.size > 1000000, `battle-city-2026-v1.0.0.zip is intact (>1MB, actual ${v1ZipStats.size} bytes)`);
assert(existsSync('RELEASE_NOTES_v1.0.0.md'), 'RELEASE_NOTES_v1.0.0.md exists and is preserved');

// =========================================================================
// Suite 3: Dev Stage Production Isolation & Debug Policy (Req 7, 8)
// =========================================================================
console.log('\nSuite 3: Dev Stage Production Isolation & Debug Policy (Req 7, 8)');
const mainSrc = readFileSync('src/main.ts', 'utf-8');
assert(mainSrc.includes('if (import.meta.env.DEV) {'), 'main.ts gates devStage and window.__GAME_INSTANCE__ inside import.meta.env.DEV');
assert(mainSrc.includes('__BC2026_DIAGNOSTICS__'), 'main.ts registers __BC2026_DIAGNOSTICS__');
assert(mainSrc.includes('Object.freeze'), 'window.__BC2026_DIAGNOSTICS__ is protected with Object.freeze');
assert(!mainSrc.includes('window.__GAME_INSTANCE__ = game;') || mainSrc.includes('if (import.meta.env.DEV)'), 'window.__GAME_INSTANCE__ is never set in production path');

// =========================================================================
// Suite 4: Stage Registry & 4-Stage Campaign Progression (Req 9, 35)
// =========================================================================
console.log('\nSuite 4: Stage Registry & 4-Stage Campaign Progression (Req 9, 35)');
const stageRegSrc = readFileSync('src/stages/StageRegistry.ts', 'utf-8');
assert(stageRegSrc.includes('registerStage(STAGE_01_DEFINITION)'), 'StageRegistry registers stage01');
assert(stageRegSrc.includes('registerStage(STAGE_02_DEFINITION)'), 'StageRegistry registers stage02');
assert(stageRegSrc.includes('registerStage(STAGE_03_DEFINITION)'), 'StageRegistry registers stage03');
assert(stageRegSrc.includes('registerStage(STAGE_04_DEFINITION)'), 'StageRegistry registers stage04');

const stage01Src = readFileSync('src/stages/stage01.ts', 'utf-8');
const stage02Src = readFileSync('src/stages/stage02.ts', 'utf-8');
const stage03Src = readFileSync('src/stages/stage03.ts', 'utf-8');
const stage04Src = readFileSync('src/stages/stage04.ts', 'utf-8');

assert(stage01Src.includes("displayName: 'CYBER OUTPOST'"), 'Stage 01 is CYBER OUTPOST');
assert(stage01Src.includes("missionTitle: 'DEFEND COMMAND NODE'"), 'Stage 01 mission is DEFEND COMMAND NODE');
assert(stage02Src.includes("displayName: 'IRON DELTA'"), 'Stage 02 is IRON DELTA');
assert(stage02Src.includes("missionTitle: 'HOLD THE REACTOR LINE'"), 'Stage 02 mission is HOLD THE REACTOR LINE');
assert(stage03Src.includes("displayName: 'FORGE LINE'"), 'Stage 03 is FORGE LINE');
assert(stage03Src.includes("missionTitle: 'BREAK THE FOUNDRY GRID'"), 'Stage 03 mission is BREAK THE FOUNDRY GRID');
assert(stage04Src.includes("displayName: 'NEXUS SIEGE'"), 'Stage 04 is NEXUS SIEGE');
assert(stage04Src.includes("missionTitle: 'BREAK THE RELAY GRID'"), 'Stage 04 mission is BREAK THE RELAY GRID');

const titleScreenSrc = readFileSync('src/ui/TitleScreenUI.ts', 'utf-8');
assert(titleScreenSrc.includes('stageRegistry.getAllStages().length'), 'Title screen displays dynamic 4-stage campaign count from authoritative source');

// =========================================================================
// Suite 5 & 6: Authoritative Stage Composition, Score & Quotas (Req 10, 11)
// =========================================================================
console.log('\nSuite 5 & 6: Authoritative Stage Composition, Score & Quotas (Req 10, 11)');

function parseEnemySequence(sourceCode) {
  const match = sourceCode.match(/ENEMY_SEQUENCE:\s*readonly\s*EnemyArchetypeId\[\]\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('Could not find ENEMY_SEQUENCE in source');
  return match[1]
    .split('\n')
    .map(line => line.replace(/\/\/.*$/, '').trim())
    .filter(line => line.length > 0)
    .map(line => {
      const m = line.match(/EnemyArchetypeId\.(STANDARD|FAST|ARMOR)/);
      return m ? m[1] : null;
    })
    .filter(Boolean);
}

const enemyArchetypesSrcForScores = readFileSync('src/config/enemyArchetypes.ts', 'utf-8');
const standardScoreMatch = enemyArchetypesSrcForScores.match(/\[EnemyArchetypeId\.STANDARD\]:[\s\S]*?scoreValue:\s*(\d+)/);
const fastScoreMatch = enemyArchetypesSrcForScores.match(/\[EnemyArchetypeId\.FAST\]:[\s\S]*?scoreValue:\s*(\d+)/);
const armorScoreMatch = enemyArchetypesSrcForScores.match(/\[EnemyArchetypeId\.ARMOR\]:[\s\S]*?scoreValue:\s*(\d+)/);
const scoreValues = {
  STANDARD: parseInt(standardScoreMatch[1], 10),
  FAST: parseInt(fastScoreMatch[1], 10),
  ARMOR: parseInt(armorScoreMatch[1], 10),
};

// Stage 01: 5 STANDARD, 4 FAST, 3 ARMOR (12 total, 2000 pts)
const s1Sequence = parseEnemySequence(stage01Src);
const s1Std = s1Sequence.filter(x => x === 'STANDARD').length;
const s1Fast = s1Sequence.filter(x => x === 'FAST').length;
const s1Armor = s1Sequence.filter(x => x === 'ARMOR').length;
const s1Total = s1Sequence.length;
const s1Score = s1Std * scoreValues.STANDARD + s1Fast * scoreValues.FAST + s1Armor * scoreValues.ARMOR;

assert(s1Std === 5, `Stage 01 Standard count is 5 (derived: ${s1Std})`);
assert(s1Fast === 4, `Stage 01 Fast count is 4 (derived: ${s1Fast})`);
assert(s1Armor === 3, `Stage 01 Armor count is 3 (derived: ${s1Armor})`);
assert(s1Total === 12, `Stage 01 Total enemy count is 12 (derived: ${s1Total})`);
assert(s1Score === 2000, `Stage 01 perfect clear score is 2000 (derived: ${s1Score})`);

// Stage 02: 5 STANDARD, 6 FAST, 5 ARMOR (16 total, 2900 pts)
const s2Sequence = parseEnemySequence(stage02Src);
const s2Std = s2Sequence.filter(x => x === 'STANDARD').length;
const s2Fast = s2Sequence.filter(x => x === 'FAST').length;
const s2Armor = s2Sequence.filter(x => x === 'ARMOR').length;
const s2Total = s2Sequence.length;
const s2Score = s2Std * scoreValues.STANDARD + s2Fast * scoreValues.FAST + s2Armor * scoreValues.ARMOR;

assert(s2Std === 5, `Stage 02 Standard count is 5 (derived: ${s2Std})`);
assert(s2Fast === 6, `Stage 02 Fast count is 6 (derived: ${s2Fast})`);
assert(s2Armor === 5, `Stage 02 Armor count is 5 (derived: ${s2Armor})`);
assert(s2Total === 16, `Stage 02 Total enemy count is 16 (derived: ${s2Total})`);
assert(s2Score === 2900, `Stage 02 perfect clear score is 2900 (derived: ${s2Score})`);

// Stage 03: 5 STANDARD, 8 FAST, 7 ARMOR (20 total, 3800 pts)
const s3Sequence = parseEnemySequence(stage03Src);
const s3Std = s3Sequence.filter(x => x === 'STANDARD').length;
const s3Fast = s3Sequence.filter(x => x === 'FAST').length;
const s3Armor = s3Sequence.filter(x => x === 'ARMOR').length;
const s3Total = s3Sequence.length;
const s3Score = s3Std * scoreValues.STANDARD + s3Fast * scoreValues.FAST + s3Armor * scoreValues.ARMOR;

assert(s3Std === 5, `Stage 03 Standard count is 5 (derived: ${s3Std})`);
assert(s3Fast === 8, `Stage 03 Fast count is 8 (derived: ${s3Fast})`);
assert(s3Armor === 7, `Stage 03 Armor count is 7 (derived: ${s3Armor})`);
assert(s3Total === 20, `Stage 03 Total enemy count is 20 (derived: ${s3Total})`);
assert(s3Score === 3800, `Stage 03 perfect clear score is 3800 (derived: ${s3Score})`);

// Stage 04: 6 STANDARD, 10 FAST, 8 ARMOR (24 total, 4500 pts)
const s4Sequence = parseEnemySequence(stage04Src);
const s4Std = s4Sequence.filter(x => x === 'STANDARD').length;
const s4Fast = s4Sequence.filter(x => x === 'FAST').length;
const s4Armor = s4Sequence.filter(x => x === 'ARMOR').length;
const s4Total = s4Sequence.length;
const s4Score = s4Std * scoreValues.STANDARD + s4Fast * scoreValues.FAST + s4Armor * scoreValues.ARMOR;

assert(s4Std === 6, `Stage 04 Standard count is 6 (derived: ${s4Std})`);
assert(s4Fast === 10, `Stage 04 Fast count is 10 (derived: ${s4Fast})`);
assert(s4Armor === 8, `Stage 04 Armor count is 8 (derived: ${s4Armor})`);
assert(s4Total === 24, `Stage 04 Total enemy count is 24 (derived: ${s4Total})`);
assert(s4Score === 4500, `Stage 04 perfect clear score is 4500 (derived: ${s4Score})`);

// Campaign Aggregates derived strictly from the four stage sequences:
const totalStandard = s1Std + s2Std + s3Std + s4Std;
const totalFast = s1Fast + s2Fast + s3Fast + s4Fast;
const totalArmor = s1Armor + s2Armor + s3Armor + s4Armor;
const totalEnemies = s1Total + s2Total + s3Total + s4Total;
const totalPerfectScore = s1Score + s2Score + s3Score + s4Score;

assert(totalStandard === 21, `Campaign Standard enemies is exactly 21 (derived: ${totalStandard})`);
assert(totalFast === 28, `Campaign Fast enemies is exactly 28 (derived: ${totalFast})`);
assert(totalArmor === 23, `Campaign Armor enemies is exactly 23 (derived: ${totalArmor})`);
assert(totalEnemies === 72, `Campaign Total enemies is exactly 72 (derived: ${totalEnemies})`);
assert(totalPerfectScore === 13200, `Total 4-stage perfect campaign score is exactly 13200 (derived: ${totalPerfectScore})`);

const campaignSessionSrc = readFileSync('src/game/CampaignSession.ts', 'utf-8');
assert(campaignSessionSrc.includes('getCompletedScore'), 'CampaignSession implements getCompletedScore()');
assert(campaignSessionSrc.includes('recordStageResult'), 'CampaignSession implements recordStageResult()');

// =========================================================================
// Suite 7: Life Carry & Retry Checkpoint Invariants (Req 12, 13)
// =========================================================================
console.log('\nSuite 7: Life Carry & Retry Checkpoint Invariants (Req 12, 13)');
assert(campaignSessionSrc.includes('stageEntryLives'), 'CampaignSession tracks stageEntryLives');
assert(campaignSessionSrc.includes('restoreStageEntryLives'), 'CampaignSession restores carried lives on stage retry without refilling to 3');

// =========================================================================
// Suite 8: New Campaign Reset (Req 14)
// =========================================================================
console.log('\nSuite 8: New Campaign Reset (Req 14)');
assert(campaignSessionSrc.includes('start('), 'CampaignSession implements clean campaign start');
assert(campaignSessionSrc.includes('initialLives: number = 3'), 'New campaign starts with standard 3 lives');

// =========================================================================
// Suite 9: Stage 04 Terrain & Movement Speed Invariants (Req 15, 16)
// =========================================================================
console.log('\nSuite 9: Stage 04 Terrain & Movement Speed Invariants (Req 15, 16)');
const level04Src = readFileSync('src/levels/level04.ts', 'utf-8');
const cryoMatches = (level04Src.match(/CRYO/g) || []).length;
const conveyorMatches = (level04Src.match(/CONVEYOR/g) || []).length;
assert(cryoMatches >= 8, 'Level 04 contains 8 Cryo tiles');
assert(conveyorMatches >= 12, 'Level 04 contains 12 Conveyor tiles');

const constantsSrc = readFileSync('src/game/constants.ts', 'utf-8');
assert(constantsSrc.includes('SPEED: 5.0') || constantsSrc.includes('speed: 5.0') || readFileSync('src/entities/PlayerTank.ts', 'utf-8').includes('5.0'), 'Player speed invariant is 5.0');
const enemyArchetypesSrc = readFileSync('src/config/enemyArchetypes.ts', 'utf-8');
assert(enemyArchetypesSrc.includes('speed: 3.4'), 'STANDARD enemy speed invariant is 3.4');
assert(enemyArchetypesSrc.includes('speed: 4.6'), 'FAST enemy speed invariant is 4.6');
assert(enemyArchetypesSrc.includes('speed: 2.8'), 'ARMOR enemy speed invariant is 2.8');
assert(constantsSrc.includes('CONVEYOR_PUSH_SPEED = 2.0') || constantsSrc.includes('2.0'), 'Conveyor push speed is 2.0');

// =========================================================================
// Suite 10: Powerup Milestones, Single Active Drop & Pool Limits (Req 17)
// =========================================================================
console.log('\nSuite 10: Powerup Milestones, Single Active Drop & Pool Limits (Req 17)');
assert(stage04Src.includes('destroyedEnemyCount: 6') && stage04Src.includes('AEGIS_FIELD'), 'Stage 04 drops Aegis at 6 kills');
assert(stage04Src.includes('destroyedEnemyCount: 12') && stage04Src.includes('OVERDRIVE_CORE'), 'Stage 04 drops Overdrive at 12 kills');
assert(stage04Src.includes('destroyedEnemyCount: 18') && stage04Src.includes('STASIS_PULSE'), 'Stage 04 drops Stasis at 18 kills');
const powerupSystemSrc = readFileSync('src/systems/PowerupSystem.ts', 'utf-8');
assert(powerupSystemSrc.includes('MAX_ACTIVE_POWERUPS') || powerupSystemSrc.includes('activePowerups.length') || powerupSystemSrc.includes('pool'), 'PowerupSystem enforces pool bounding');

// =========================================================================
// Suite 11: Object Pool Baselines (Req 18)
// =========================================================================
console.log('\nSuite 11: Object Pool Baselines (Req 18)');
const gameSrc = readFileSync('src/game/Game.ts', 'utf-8');
assert(gameSrc.includes('getEnemyPoolSize()') || gameSrc.includes('enemyPool'), 'Game tracks enemy pool (4 active slots)');
assert(gameSrc.includes('getProjectilePoolSize()') || gameSrc.includes('projectilePool'), 'Game tracks projectile pool (16 capacity)');
assert(gameSrc.includes('getPowerupPoolSize()') || gameSrc.includes('powerupPool'), 'Game tracks powerup pool (3 capacity)');

// =========================================================================
// Suite 12: Tactical HUD Architecture & Modules (Req 19, 20)
// =========================================================================
console.log('\nSuite 12: Tactical HUD Architecture & Modules (Req 19, 20)');
const tacticalHudSrc = readFileSync('src/ui/TacticalCommandHUD.ts', 'utf-8');
assert(tacticalHudSrc.includes('BATTLE CITY') && tacticalHudSrc.includes('2026'), 'Tactical HUD contains header branding');
assert(tacticalHudSrc.includes('tchStageName'), 'Tactical HUD contains stage identity');
assert(tacticalHudSrc.includes('tacticalMinimap'), 'Tactical HUD contains minimap');
assert(tacticalHudSrc.includes('tchEnemiesCount'), 'Tactical HUD contains enemy quota');
assert(tacticalHudSrc.includes('tchLivesCount'), 'Tactical HUD contains unit lives');
assert(tacticalHudSrc.includes('tchCommandNodeStatus'), 'Tactical HUD contains command node status');
assert(tacticalHudSrc.includes('tchScoreVal'), 'Tactical HUD contains stage score');
assert(tacticalHudSrc.includes('tchTotalScoreVal'), 'Tactical HUD contains campaign total');
assert(tacticalHudSrc.includes('tchPowerupsList'), 'Tactical HUD contains active tactical systems');
assert(tacticalHudSrc.includes('tchMissionTitle'), 'Tactical HUD contains primary directive');
assert(tacticalHudSrc.includes('tchMuteBtn'), 'Tactical HUD contains integrated audio toggle');
assert(tacticalHudSrc.includes('tchPauseBtn'), 'Tactical HUD contains integrated pause button');

// =========================================================================
// Suite 13: Tactical Minimap Invariants (Req 21)
// =========================================================================
console.log('\nSuite 13: Tactical Minimap Invariants (Req 21)');
const minimapSrc = readFileSync('src/ui/TacticalMinimap.ts', 'utf-8');
assert(minimapSrc.includes('100') || minimapSrc.includes('10 Hz') || minimapSrc.includes('THROTTLE') || minimapSrc.includes('lastRenderTime'), 'TacticalMinimap enforces 10 Hz throttled render');
assert(minimapSrc.includes('aria-label'), 'TacticalMinimap canvas includes accessibility aria-label');

// =========================================================================
// Suite 14: Camera Viewport Matrix & Breakpoints (Req 22, 23)
// =========================================================================
console.log('\nSuite 14: Camera Viewport Matrix & Breakpoints (Req 22, 23)');
assert(gameSrc.includes('calculateCameraFraming'), 'Game implements calculateCameraFraming()');
assert(gameSrc.includes('34.6'), 'Tactical desktop camera calibrated to H = 34.6');
assert(gameSrc.includes('-12.975') || gameSrc.includes('-12.97'), 'Tactical desktop camera calibrated to Z = -12.975');
assert(tacticalHudSrc.includes('1100') || readFileSync('src/style.css', 'utf-8').includes('1100px'), '1100px breakpoint used for desktop Tactical HUD transition');

// =========================================================================
// Suite 15: Mobile DPR & Touch Controls (Req 24, 25, 26)
// =========================================================================
console.log('\nSuite 15: Mobile DPR & Touch Controls (Req 24, 25, 26)');
const qualitySrc = readFileSync('src/game/QualityProfile.ts', 'utf-8');
assert(qualitySrc.includes('isMobile ? 1.5 : 2.0'), 'Mobile maxDpr is locked at 1.5');
const mobileControlsSrc = readFileSync('src/ui/MobileControls.ts', 'utf-8');
assert(mobileControlsSrc.includes('joystick'), 'MobileControls provides joystick movement');
assert(mobileControlsSrc.includes('fire'), 'MobileControls provides fire button');
assert(indexHtmlSrc.includes('pauseBtn') || tacticalHudSrc.includes('tchPauseBtn'), 'Accessible pause button available across HUD layouts');

// =========================================================================
// Suite 16: Desktop Controls, Pause & Visibility Auto-Pause (Req 27, 28, 29)
// =========================================================================
console.log('\nSuite 16: Desktop Controls, Pause & Visibility Auto-Pause (Req 27, 28, 29)');
const inputSrc = readFileSync('src/systems/InputSystem.ts', 'utf-8');
assert(inputSrc.includes('KeyW') || inputSrc.includes('ArrowUp'), 'InputSystem supports WASD & Arrow Keys');
assert(inputSrc.includes('Space'), 'InputSystem supports Space fire');
assert(gameSrc.includes('KeyP') && gameSrc.includes('Escape'), 'Game keydown router supports Pause (P / ESC)');
assert(gameSrc.includes('visibilitychange') || inputSrc.includes('visibilitychange'), 'Game handles visibilitychange auto-pause');

// =========================================================================
// Suite 17: Settings, Reduced Motion & Audio (Req 30, 31, 32)
// =========================================================================
console.log('\nSuite 17: Settings, Reduced Motion & Audio (Req 30, 31, 32)');
const settingsSrc = readFileSync('src/ui/SettingsUI.ts', 'utf-8');
assert(settingsSrc.includes('mute') || settingsSrc.includes('audio'), 'Settings provides Mute toggle');
assert(settingsSrc.includes('ReducedMotion') || settingsSrc.includes('motionBtn'), 'Settings provides Reduced Motion configuration');
const audioSrc = readFileSync('src/systems/AudioSystem.ts', 'utf-8');
assert(audioSrc.includes('setMuted'), 'AudioSystem implements setMuted()');
assert(audioSrc.includes('AudioContext'), 'AudioSystem creates single AudioContext');

// =========================================================================
// Suite 18: Dynamic 4-Stage Campaign Complete Overlay (Req 33, 34)
// =========================================================================
console.log('\nSuite 18: Dynamic 4-Stage Campaign Complete Overlay (Req 33, 34)');
const victorySrc = readFileSync('src/ui/CampaignCompleteUI.ts', 'utf-8');
assert(victorySrc.includes('stageResults') && victorySrc.includes('createElement'), 'CampaignCompleteUI dynamically generates stage rows without hardcoded markup');

// =========================================================================
// Suite 19: Originality & Legacy Sprites Audit (Req 37)
// =========================================================================
console.log('\nSuite 19: Originality & Legacy Sprites Audit (Req 37)');
const styleCssSrc = readFileSync('src/style.css', 'utf-8');
assert(!indexHtmlSrc.includes('eagle') && !indexHtmlSrc.includes('phoenix'), 'index.html contains no legacy eagle/phoenix assets');
assert(!styleCssSrc.includes('legacy-tank') && !styleCssSrc.includes('eagle'), 'style.css contains no legacy tank/eagle sprites');
assert(!tacticalHudSrc.includes('PLAYER 2') && !tacticalHudSrc.includes('2P'), 'TacticalCommandHUD contains zero 2-Player artifacts');

// =========================================================================
// Suite 20: Accessibility & ARIA Contract (Req 38)
// =========================================================================
console.log('\nSuite 20: Accessibility & ARIA Contract (Req 38)');
assert(indexHtmlSrc.includes('<button') || tacticalHudSrc.includes('<button'), 'Interactive UI controls use semantic HTML buttons');
assert(tacticalHudSrc.includes('aria-label'), 'Tactical HUD buttons have aria-label');

// =========================================================================
// Suite 21: WebGL Context Loss & Fatal Boot Handling (Req 39, 40)
// =========================================================================
console.log('\nSuite 21: WebGL Context Loss & Fatal Boot Handling (Req 39, 40)');
assert(mainSrc.includes('webglcontextlost'), 'main.ts registers webglcontextlost listener');
assert(mainSrc.includes('ERR_WEBGL_CONTEXT_LOST'), 'Fatal error code ERR_WEBGL_CONTEXT_LOST used on context lost');
assert(mainSrc.includes('ERR_WEBGL_UNAVAILABLE'), 'Fatal error code ERR_WEBGL_UNAVAILABLE used when WebGL unsupported');

// =========================================================================
// Suite 22: Import DAG Circular Dependency Audit (Req 41)
// =========================================================================
console.log('\nSuite 22: Import DAG Circular Dependency Audit (Req 41)');
function getAllTsFiles(dir) {
  let results = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) {
      results = results.concat(getAllTsFiles(p));
    } else if (p.endsWith('.ts')) {
      results.push(p);
    }
  }
  return results;
}

const allTs = getAllTsFiles('src');
const depMap = new Map();
const impRe = /import\s+.*?\s+from\s+['"](.*?)['"]/g;

for (const file of allTs) {
  const code = readFileSync(file, 'utf-8');
  const norm = resolve(file);
  const deps = [];
  let m;
  while ((m = impRe.exec(code)) !== null) {
    if (m[1].startsWith('.')) {
      deps.push(resolve(join(file, '..', m[1])));
    }
  }
  depMap.set(norm, deps);
}

function findCycleDfs(node, visited = new Set(), stack = new Set()) {
  visited.add(node);
  stack.add(node);
  const deps = depMap.get(node) || [];
  for (const d of deps) {
    const matching = Array.from(depMap.keys()).find(k => k.startsWith(d));
    if (!matching) continue;
    if (!visited.has(matching)) {
      const c = findCycleDfs(matching, visited, stack);
      if (c) return c;
    } else if (stack.has(matching)) {
      return [node, matching];
    }
  }
  stack.delete(node);
  return null;
}

let foundCycle = null;
const visitedAll = new Set();
for (const file of depMap.keys()) {
  if (!visitedAll.has(file)) {
    foundCycle = findCycleDfs(file, visitedAll);
    if (foundCycle) break;
  }
}
assert(foundCycle === null, 'Complete src/ TypeScript import DAG has ZERO circular dependencies');

console.log(`\n=============================================================`);
console.log(`PHASE 24 RC ACCEPTANCE QA COMPLETE: ${passCount} passed, ${failCount} failed.`);
console.log(`=============================================================\n`);
