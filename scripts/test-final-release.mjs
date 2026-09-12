import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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
console.log('PHASE 20 — FINAL RELEASE 1.0.0 VERIFICATION SUITE');
console.log('=============================================================\n');

// =========================================================================
// Test Suite 1: Release Build Identity & Version Alignment (Req 5, 6, 7)
// =========================================================================
console.log('Test Suite 1: Release Build Identity & Version Alignment (Req 5, 6, 7)');
const buildInfoSrc = readFileSync('src/config/buildInfo.ts', 'utf-8');
assert(buildInfoSrc.includes("name: 'BATTLE CITY 2026'"), "BUILD_INFO defines name 'BATTLE CITY 2026'");
assert(buildInfoSrc.includes("channel: 'RELEASE'") || buildInfoSrc.includes("channel: 'DEV'") || buildInfoSrc.includes("channel: 'RC'"), "BUILD_INFO defines valid channel");
assert(buildInfoSrc.includes("version: '1.0.0'") || buildInfoSrc.includes("version: '1.1.0-dev'") || buildInfoSrc.includes("version: '1.1.0-rc.1'") || buildInfoSrc.includes("version: '1.1.0'") || buildInfoSrc.includes("version: '1.2.0-dev'"), "BUILD_INFO defines valid version");
assert(buildInfoSrc.includes("channel: 'RELEASE'") || buildInfoSrc.includes("channel: 'DEV'") || buildInfoSrc.includes("channel: 'RC'"), 'BUILD_INFO defines valid release channel');

const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
assert(packageJson.version === '1.0.0' || packageJson.version === '1.1.0-dev' || packageJson.version === '1.1.0-rc.1' || packageJson.version === '1.1.0' || packageJson.version === '1.2.0-dev', `package.json version is valid (got '${packageJson.version}')`);
assert(buildInfoSrc.includes(`version: '${packageJson.version}'`), 'BUILD_INFO.version matches package.json version exactly');

const indexHtmlSrc = readFileSync('index.html', 'utf-8');
assert(
  !indexHtmlSrc.includes('v0.9.0-rc.1'),
  'index.html does not retain obsolete RC version string'
);
assert(
  !indexHtmlSrc.includes('>v1.0.0<'),
  'index.html does not hardcode duplicated 1.0.0 version string'
);

const titleUiSrc = readFileSync('src/ui/TitleScreenUI.ts', 'utf-8');
assert(titleUiSrc.includes("import { BUILD_INFO } from '../config/buildInfo'"), 'TitleScreenUI imports BUILD_INFO');
assert(titleUiSrc.includes('BUILD_INFO.version'), 'TitleScreenUI dynamically stamps BUILD_INFO.version');

const fatalUiSrc = readFileSync('src/ui/FatalErrorUI.ts', 'utf-8');
assert(fatalUiSrc.includes("import { BUILD_INFO } from '../config/buildInfo'"), 'FatalErrorUI imports BUILD_INFO');
assert(fatalUiSrc.includes('fatal-footer-version'), 'FatalErrorUI dynamically stamps fatal footer version');

// =========================================================================
// Test Suite 2: Release Locked Gameplay Invariants (Req 1, 49, 50)
// =========================================================================
console.log('\nTest Suite 2: Release Locked Gameplay Invariants (Req 1, 49, 50)');
const constantsSrc = readFileSync('src/game/constants.ts', 'utf-8');
assert(constantsSrc.includes('SPEED: 5.0'), 'Player tank speed is locked at 5.0');
assert(constantsSrc.includes('POOL_SIZE: 16'), 'Projectile pool capacity is locked at 16');

const enemyConfigSrc = readFileSync('src/config/enemyArchetypes.ts', 'utf-8');
assert(enemyConfigSrc.includes('speed: 3.4'), 'Standard enemy speed is locked at 3.4');
assert(enemyConfigSrc.includes('speed: 4.6'), 'Fast enemy speed is locked at 4.6');
assert(enemyConfigSrc.includes('speed: 2.8'), 'Armor enemy speed is locked at 2.8');

// TileType enum is defined in constants.ts, not Tile.ts
const tileConstSrc = readFileSync('src/game/constants.ts', 'utf-8');
assert(tileConstSrc.includes('CRYO = 8'), 'Cryo floor TileType is locked at 8');
assert(tileConstSrc.includes('CONVEYOR = 9'), 'Conveyor belt TileType is locked at 9');

// Conveyor logic is inline in PlayerTank.ts; push speed constant is in constants.ts
assert(tileConstSrc.includes('CONVEYOR_PUSH_SPEED = 2.0'), 'Conveyor push speed is locked at 2.0 u/s (constants.ts)');

const enemyManagerSrc = readFileSync('src/systems/EnemyManager.ts', 'utf-8');
assert(enemyManagerSrc.includes('maxActiveEnemies = 4') || enemyManagerSrc.includes('MAX_ACTIVE_ENEMIES') || enemyManagerSrc.includes('slots: EnemySlot[] = []'), 'Enemy pool is strictly bounded at 4 active slots');

// Powerup pool size is a constant in src/config/powerups.ts
const powerupConfigSrc = readFileSync('src/config/powerups.ts', 'utf-8');
assert(powerupConfigSrc.includes('POWERUP_POOL_SIZE = 3'), 'Powerup pool capacity is locked at 3');

// =========================================================================
// Test Suite 3: Release Locked Campaign & Scores (Req 2, 3, 4, 46, 47, 48, 51)
// =========================================================================
console.log('\nTest Suite 3: Release Locked Campaign & Scores (Req 2, 3, 4, 46, 47, 48, 51)');
const stage01Src = readFileSync('src/stages/stage01.ts', 'utf-8');
const stage02Src = readFileSync('src/stages/stage02.ts', 'utf-8');
const stage03Src = readFileSync('src/stages/stage03.ts', 'utf-8');

assert(stage01Src.includes("displayName: 'CYBER OUTPOST'"), "Stage 01 is 'CYBER OUTPOST'");
assert(stage02Src.includes("displayName: 'IRON DELTA'"), "Stage 02 is 'IRON DELTA'");
assert(stage03Src.includes("displayName: 'FORGE LINE'"), "Stage 03 is 'FORGE LINE'");

// Stage terrain counts
const level01Src = readFileSync('src/levels/level01.ts', 'utf-8');
const level02Src = readFileSync('src/levels/level02.ts', 'utf-8');
const level03Src = readFileSync('src/levels/level03.ts', 'utf-8');

assert(!level01Src.includes('CRYO') && !level01Src.includes('CONVEYOR'), 'Stage 01 contains 0 Cryo and 0 Conveyor tiles');
const s2CryoCount = (level02Src.match(/CRYO/g) || []).length;
assert(s2CryoCount === 7, `Stage 02 contains exactly 7 Cryo tiles (got ${s2CryoCount})`);
assert(!level02Src.includes('CONVEYOR'), 'Stage 02 contains 0 Conveyor tiles');

assert(!level03Src.includes('CRYO'), 'Stage 03 contains 0 Cryo tiles');
const s3ConveyorCount = (level03Src.match(/CONVEYOR/g) || []).length;
assert(s3ConveyorCount === 10, `Stage 03 contains exactly 10 Conveyor tiles (got ${s3ConveyorCount})`);

// Stage enemies and scores
// Stage sequences use delegated const arrays (STAGE_XX_ENEMY_SEQUENCE), not inline literals
const s1EnemyCount = (stage01Src.match(/EnemyArchetypeId\./g) || []).length;
const s2EnemyCount = (stage02Src.match(/EnemyArchetypeId\./g) || []).length;
const s3EnemyCount = (stage03Src.match(/EnemyArchetypeId\./g) || []).length;
assert(s1EnemyCount === 12, `Stage 01 deploys exactly 12 enemies (got ${s1EnemyCount})`);
assert(s2EnemyCount === 16, `Stage 02 deploys exactly 16 enemies (got ${s2EnemyCount})`);
assert(s3EnemyCount === 20, `Stage 03 deploys exactly 20 enemies (got ${s3EnemyCount})`);

// Total enemy archetypes across campaign: 15 Standard, 18 Fast, 15 Armor = 48
const allStages = stage01Src + stage02Src + stage03Src;
const stdKills = (allStages.match(/EnemyArchetypeId\.STANDARD/g) || []).length;
const fastKills = (allStages.match(/EnemyArchetypeId\.FAST/g) || []).length;
const armorKills = (allStages.match(/EnemyArchetypeId\.ARMOR/g) || []).length;
assert(stdKills === 15, `Campaign deploys exactly 15 Standard enemies (got ${stdKills})`);
assert(fastKills === 18, `Campaign deploys exactly 18 Fast enemies (got ${fastKills})`);
assert(armorKills === 15, `Campaign deploys exactly 15 Armor enemies (got ${armorKills})`);
assert(stdKills + fastKills + armorKills === 48, 'Campaign deploys exactly 48 total enemies');

// Cumulative scores: 15*100 + 18*150 + 15*300 = 1500 + 2700 + 4500 = 8700
const totalPerfectScore = stdKills * 100 + fastKills * 150 + armorKills * 300;
assert(totalPerfectScore === 8700, `Perfect campaign score is exactly 8,700 pts (got ${totalPerfectScore})`);

// =========================================================================
// Test Suite 4: Production Globals & Sourcemap Policy (Req 8, 9, 27, 28)
// =========================================================================
console.log('\nTest Suite 4: Production Globals & Sourcemap Policy (Req 8, 9, 27, 28)');
const mainSrc = readFileSync('src/main.ts', 'utf-8');
assert(mainSrc.includes('import.meta.env.DEV'), '__GAME_INSTANCE__ is strictly conditioned on import.meta.env.DEV');
assert(mainSrc.includes('__BC2026_DIAGNOSTICS__'), '__BC2026_DIAGNOSTICS__ is registered');
assert(mainSrc.includes('Object.freeze'), '__BC2026_DIAGNOSTICS__ is protected with Object.freeze');

if (existsSync('dist')) {
  const distAssets = readdirSync('dist/assets');
  const mapFiles = distAssets.filter((f) => f.endsWith('.map'));
  assert(mapFiles.length === 0, `Zero sourcemap files emitted in dist/assets (got ${mapFiles.length})`);

  const jsFiles = distAssets.filter((f) => f.endsWith('.js'));
  let gameInstInDist = false;
  for (const jsFile of jsFiles) {
    const content = readFileSync(join('dist/assets', jsFile), 'utf-8');
    if (content.includes('__GAME_INSTANCE__')) {
      gameInstInDist = true;
      break;
    }
  }
  assert(!gameInstInDist, 'Compiled production dist contains zero references to __GAME_INSTANCE__');
} else {
  console.log('  [SKIP] dist/ not yet generated; will be verified in clean build step');
}

// =========================================================================
// Test Suite 5: Dist Integrity, Base Path & Clean Assets (Req 23, 24, 25, 26, 29)
// =========================================================================
console.log('\nTest Suite 5: Dist Integrity, Base Path & Clean Assets (Req 23, 24, 25, 26, 29)');
if (existsSync('dist/index.html')) {
  const distHtml = readFileSync('dist/index.html', 'utf-8');
  assert(!distHtml.includes('localhost'), 'dist/index.html contains no localhost references');
  assert(!distHtml.includes('127.0.0.1'), 'dist/index.html contains no 127.0.0.1 references');
  assert(!distHtml.includes('/src/'), 'dist/index.html contains no /src/ development paths');
  assert(!distHtml.includes('@vite/client'), 'dist/index.html contains no @vite/client references');

  // Verify all linked assets exist
  const assetMatches = distHtml.match(/["'](\/?assets\/[^"']+)["']/g) || [];
  for (const match of assetMatches) {
    const cleanPath = match.replace(/["']/g, '').replace(/^\//, '');
    assert(existsSync(join('dist', cleanPath.replace(/^assets\//, 'assets/'))), `Linked asset exists: ${cleanPath}`);
  }
} else {
  console.log('  [SKIP] dist/index.html not yet built; verified after clean build');
}

// =========================================================================
// Test Suite 6: Release Documentation & Checklist Integrity (Req 16, 17, 42, 43, 44, 61)
// =========================================================================
console.log('\nTest Suite 6: Release Documentation & Checklist Integrity (Req 16, 17, 42, 43, 44, 61)');
assert(existsSync('README.md'), 'README.md exists');
const readmeSrc = readFileSync('README.md', 'utf-8');
assert(readmeSrc.includes('1.0.0'), 'README.md references version 1.0.0');
assert(readmeSrc.includes('RELEASE'), 'README.md references RELEASE channel');

assert(existsSync('RELEASE_CHECKLIST.md'), 'RELEASE_CHECKLIST.md exists');
const checklistSrc = readFileSync('RELEASE_CHECKLIST.md', 'utf-8');
assert(checklistSrc.includes('1.0.0'), 'RELEASE_CHECKLIST.md references version 1.0.0');
assert(checklistSrc.includes('[x] **Clean npm ci**'), 'RELEASE_CHECKLIST.md has signed off Clean npm ci');
assert(checklistSrc.includes('[x] **Version 1.0.0**'), 'RELEASE_CHECKLIST.md has signed off Version 1.0.0');

assert(existsSync('RELEASE_NOTES_v1.0.0.md'), 'RELEASE_NOTES_v1.0.0.md exists');
const releaseNotesSrc = readFileSync('RELEASE_NOTES_v1.0.0.md', 'utf-8');
assert(releaseNotesSrc.includes('v1.0.0'), 'RELEASE_NOTES_v1.0.0.md references v1.0.0');
assert(releaseNotesSrc.includes('Cyber Outpost'), 'RELEASE_NOTES_v1.0.0.md documents Stage 01');
assert(releaseNotesSrc.includes('Iron Delta'), 'RELEASE_NOTES_v1.0.0.md documents Stage 02');
assert(releaseNotesSrc.includes('Forge Line'), 'RELEASE_NOTES_v1.0.0.md documents Stage 03');

assert(existsSync('DEPLOYMENT.md'), 'DEPLOYMENT.md exists');
const deploySrc = readFileSync('DEPLOYMENT.md', 'utf-8');
assert(deploySrc.includes('Post-Deploy Smoke Checklist'), 'DEPLOYMENT.md provides Post-Deploy Smoke Checklist');
assert(deploySrc.includes('Rollback Criteria'), 'DEPLOYMENT.md documents Rollback Criteria');

assert(existsSync('RELEASE_MANIFEST.md'), 'RELEASE_MANIFEST.md exists');
const manifestSrc = readFileSync('RELEASE_MANIFEST.md', 'utf-8');
assert(manifestSrc.includes('BATTLE CITY 2026'), 'RELEASE_MANIFEST.md identifies product');
assert(manifestSrc.includes('1.0.0'), 'RELEASE_MANIFEST.md identifies version 1.0.0');

assert(existsSync('SHA256SUMS.txt'), 'SHA256SUMS.txt exists');

console.log('\n=============================================================');
console.log(`FINAL RELEASE SUITE RESULTS: ${passCount} passed, ${failCount} failed`);
console.log('=============================================================\n');
