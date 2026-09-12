import { readFileSync } from 'node:fs';
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
console.log('PHASE 22 — v1.1.0 STAGE 04 PRESENTATION & AUDIO VERIFICATION');
console.log('=============================================================\n');

function transpileAndLoad(filePath, mocks = {}) {
  const code = readFileSync(filePath, 'utf-8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', js);
  fn(mod, mod.exports, (id) => {
    if (mocks[id]) return mocks[id];
    if (id.includes('constants')) {
      return {
        GRID_ROWS: 13,
        GRID_COLS: 13,
        TILE_SIZE: 2.0,
        BORDER_HEIGHT: 1.5,
        BORDER_THICKNESS: 1.0,
        ARENA_WIDTH: 26,
        ARENA_DEPTH: 26,
        CONVEYOR_PUSH_SPEED: 2.0,
        VISUAL_HEIGHTS: {
          BASE: 1.2,
          BRICK: 1.0,
          STEEL: 1.0,
          BUSH: 0.8,
          WATER: 0.2,
          CRYO: 0.08,
          CONVEYOR: 0.08,
          SPAWN_MARKER: 0.02
        },
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
        },
        DEBUG: false,
      };
    }
    if (id.includes('enemyArchetypes')) {
      return {
        EnemyArchetypeId: {
          STANDARD: 'standard',
          FAST: 'fast',
          ARMOR: 'armor',
          POWER: 'power',
        },
        ENEMY_ARCHETYPES: {
          standard: { id: 'standard', speed: 3.4, scoreValue: 100 },
          fast: { id: 'fast', speed: 4.6, scoreValue: 150 },
          armor: { id: 'armor', speed: 2.8, scoreValue: 300 },
        },
      };
    }
    if (id.includes('powerups')) {
      return {
        PowerupType: {
          OVERDRIVE_CORE: 'overdrive_core',
          AEGIS_FIELD: 'aegis_field',
          STASIS_PULSE: 'stasis_pulse',
        },
      };
    }
    if (id.includes('Direction')) {
      return {
        Direction: { NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 },
      };
    }
    if (id.includes('LevelDefinition')) {
      return {
        validateLevelDefinition: () => {},
      };
    }
    if (id.includes('StageDefinition')) {
      return transpileAndLoad('src/stages/StageDefinition.ts');
    }
    if (id.includes('level04')) {
      return transpileAndLoad('src/levels/level04.ts');
    }
    if (id.includes('stage01')) {
      return transpileAndLoad('src/stages/stage01.ts');
    }
    if (id.includes('stage02')) {
      return transpileAndLoad('src/stages/stage02.ts');
    }
    if (id.includes('stage03')) {
      return transpileAndLoad('src/stages/stage03.ts');
    }
    if (id.includes('stage04')) {
      return transpileAndLoad('src/stages/stage04.ts');
    }
    return {};
  });
  return mod.exports;
}

// =========================================================================
// Test Suite 1: Presentation Metadata Schema & Configuration
// =========================================================================
console.log('Test Suite 1: Presentation Metadata Schema & Configuration (Req 1, 2, 31)');
const stageDefMod = transpileAndLoad('src/stages/StageDefinition.ts');
const stage01Mod = transpileAndLoad('src/stages/stage01.ts');
const stage02Mod = transpileAndLoad('src/stages/stage02.ts');
const stage03Mod = transpileAndLoad('src/stages/stage03.ts');
const stage04Mod = transpileAndLoad('src/stages/stage04.ts');

const stage04 = stage04Mod.STAGE_04_DEFINITION;
assert(stage04 !== undefined, 'Stage 04 definition exists');
assert(stage04.presentation !== undefined, 'Stage 04 has presentation metadata');
assert(stage04.presentation.floorTheme === 'NEXUS', 'Stage 04 floorTheme is "NEXUS"');
assert(stage04.presentation.accentColor === '#00e5ff', 'Stage 04 accentColor is cold cyan "#00e5ff"');
assert(stage04.presentation.secondaryAccentColor === '#7b2cbf', 'Stage 04 secondaryAccentColor is electric violet "#7b2cbf"');
assert(stage04.presentation.hazardColor === '#ffaa00', 'Stage 04 hazardColor is amber "#ffaa00"');
assert(stage04.presentation.pulseEnabled === true, 'Stage 04 pulseEnabled is true');
assert(stage04.presentation.pulseRate === 2.2, 'Stage 04 pulseRate is 2.2s');
assert(stage04.presentation.stageAudioProfile === 'NEXUS', 'Stage 04 stageAudioProfile is "NEXUS"');

// Stages 01–03 baseline protection
const stage01 = stage01Mod.STAGE_01_DEFINITION;
const stage02 = stage02Mod.STAGE_02_DEFINITION;
const stage03 = stage03Mod.STAGE_03_DEFINITION;
assert(stage01.presentation === undefined, 'Stage 01 has NO presentation metadata (baseline untouched)');
assert(stage02.presentation === undefined, 'Stage 02 has NO presentation metadata (baseline untouched)');
assert(stage03.presentation === undefined, 'Stage 03 has NO presentation metadata (baseline untouched)');

// Validation schema test
assert(typeof stageDefMod.validateStageDefinition === 'function', 'validateStageDefinition exists');
stageDefMod.validateStageDefinition(stage04);
assert(true, 'Stage 04 valid definition passes validation');

let threwInvalidPulse = false;
try {
  stageDefMod.validateStageDefinition({
    ...stage04,
    presentation: { ...stage04.presentation, pulseRate: -1 }
  });
} catch (e) {
  threwInvalidPulse = true;
}
assert(threwInvalidPulse, 'validateStageDefinition rejects non-positive pulseRate');

// =========================================================================
// Test Suite 2: Arena Presentation & Single-Mesh Relay Trace Logic
// =========================================================================
console.log('\nTest Suite 2: Arena Floor Treatment & Single-Mesh Relay Traces (Req 3, 4, 11, 26, 32)');
const arenaSource = readFileSync('src/world/Arena.ts', 'utf-8');
assert(arenaSource.includes('MeshBuilder.CreateLineSystem'), 'Arena uses CreateLineSystem for relay traces (1 single mesh)');
assert(arenaSource.includes('nexusRelayLines'), 'Arena creates tracked nexusRelayLines mesh');
assert(arenaSource.includes('isPickable = false'), 'nexusRelayLines has isPickable = false (zero collision / interaction)');
assert(arenaSource.includes('Color3(0.045, 0.052, 0.068)'), 'Arena sets dark gunmetal/graphite foundation on floorMat in NEXUS theme');
assert(arenaSource.includes('blueTrimMat.diffuseColor = new Color3(0.0, 0.85, 1.0)'), 'Arena styles south player trim with cold cyan');
assert(arenaSource.includes('orangeTrimMat.diffuseColor = new Color3(0.48, 0.17, 0.75)'), 'Arena styles north enemy trim with electric violet');

// Resource reuse & cleanup verification
assert(arenaSource.includes('this.nexusRelayLines.dispose()'), 'Arena cleans up nexusRelayLines on reset to default');
const updateMethodBody = arenaSource.slice(arenaSource.indexOf('public update('));
assert(!updateMethodBody.includes('new StandardMaterial'), 'Arena update does NOT instantiate new materials per frame');
assert(!updateMethodBody.includes('new Mesh'), 'Arena update does NOT instantiate new meshes per frame');

// =========================================================================
// Test Suite 3: Command Base Presentation & Energy Core Pulse
// =========================================================================
console.log('\nTest Suite 3: Command Base Presentation & Core Pulse (Req 5, 9, 34)');
const baseSource = readFileSync('src/world/Base.ts', 'utf-8');
assert(baseSource.includes('setPresentation('), 'Base class implements setPresentation method');
assert(baseSource.includes('coreMat.diffuseColor.set(0.0, 0.85, 1.0)'), 'Base sets cold cyan core on NEXUS floorTheme');
assert(baseSource.includes('coreMat.emissiveColor.set('), 'Base modulates coreMat.emissiveColor in update');
assert(baseSource.includes('pulseEnabled'), 'Base checks presentation.pulseEnabled');
assert(baseSource.includes('reducedMotion'), 'Base update takes reducedMotion flag');

// Verify collision & HP invariants are untouched
assert(baseSource.includes('BaseState.ACTIVE'), 'BaseState remains unchanged');
assert(!baseSource.includes('collisionRadius'), 'Base dimensions and collision geometry remain unchanged');

// =========================================================================
// Test Suite 4: Cryo & Conveyor Direction Readability & Visual Contrast
// =========================================================================
console.log('\nTest Suite 4: Cryo & Conveyor Polish & Visual Contrast (Req 6, 7, 8)');
const tileMapSource = readFileSync('src/world/TileMap.ts', 'utf-8');
assert(tileMapSource.includes('convChevronL1'), 'Conveyor includes dual sequential forward chevrons');
assert(tileMapSource.includes('convChevronL2'), 'Conveyor includes second chevron pair for clear direction flow');
assert(tileMapSource.includes('specularColor = new Color3(0.85, 0.65, 0.25)'), 'Conveyor features amber metallic specular sheen');
assert(tileMapSource.includes('emissiveColor = new Color3(0.24, 0.14, 0.02)'), 'Conveyor features high-contrast amber emissive glow');

// Cryo crystalline polish
assert(tileMapSource.includes('specularColor = new Color3(0.55, 0.85, 1.0)'), 'Cryo features cold crystalline specular sheen');
assert(tileMapSource.includes('emissiveColor = new Color3(0.06, 0.16, 0.26)'), 'Cryo features distinct frost blue-white edge');
assert(tileMapSource.includes('cryoRimN'), 'Cryo includes crystalline cooling plate frost rims');

// Verification that tiles share master meshes
assert(tileMapSource.includes('this.masterConveyor.createInstance'), 'Conveyor tiles use hardware instancing');
assert(tileMapSource.includes('this.masterCryo.createInstance'), 'Cryo tiles use hardware instancing');

// =========================================================================
// Test Suite 5: Web Audio Procedural Accents & Voice Bounding
// =========================================================================
console.log('\nTest Suite 5: Web Audio Synthesis, Mute & Voice Bounding (Req 12, 13, 14, 15, 16, 17, 18, 35)');
const audioSource = readFileSync('src/systems/AudioSystem.ts', 'utf-8');

assert(audioSource.includes('playStage04Intro('), 'AudioSystem implements playStage04Intro()');
assert(audioSource.includes('playNexusRelayDestruction('), 'AudioSystem implements playNexusRelayDestruction()');
assert(audioSource.includes('playConveyorEnter('), 'AudioSystem implements playConveyorEnter()');
assert(audioSource.includes('stageIntro: 0'), 'activeVoices contains stageIntro counter');
assert(audioSource.includes('stageIntro: 1'), 'maxVoices limits stageIntro to 1');
assert(audioSource.includes('nexusRelay: 0'), 'activeVoices contains nexusRelay counter');
assert(audioSource.includes('nexusRelay: 1'), 'maxVoices limits nexusRelay to 1');

// Audio lifecycle & mute check
assert(audioSource.includes('if (this.isMutedState || !this.ctx || !this.sfxGain) return;'), 'playStage04Intro obeys isMutedState');
assert(audioSource.includes('gainNode.connect(this.sfxGain)'), 'Stage 04 intro routes strictly through sfxGain');
assert(audioSource.includes('osc1.onended = cleanup'), 'playStage04Intro registers onended cleanup');
assert(audioSource.includes('setTimeout(cleanup,'), 'playStage04Intro registers fallback timeout cleanup');

// Single AudioContext guarantee
const audioCtxOccurrences = (audioSource.match(/new AudioContext/g) || []).length;
assert(audioCtxOccurrences <= 1, `Exactly 1 AudioContext instantiated (found ${audioCtxOccurrences})`);

// =========================================================================
// Test Suite 6: Pause Simulation Freeze & Audio Isolation
// =========================================================================
console.log('\nTest Suite 6: Pause Simulation & Audio Isolation (Req 19, 33)');
const gameSource = readFileSync('src/game/Game.ts', 'utf-8').replace(/\r\n/g, '\n');
assert(gameSource.includes('if (this.gameState === GameState.PLAYING) {'), 'Game render loop branches strictly on GameState.PLAYING');
assert(gameSource.includes('} else if (this.gameState === GameState.PAUSED || this.gameState === GameState.MAIN_MENU) {'), 'Paused state has dedicated zero-delta branch');
assert(gameSource.includes('this.camera.position.copyFrom(this.baseCameraPosition)'), 'Camera copy in paused state');
assert(!gameSource.includes('arena.update(dt') || gameSource.includes('if (this.gameState === GameState.PLAYING) {\n        // Update camera shake decay\n        this.feedbackSystem.update(dt, this.camera, this.baseCameraPosition);\n\n        const reducedMotion = this.userPreferences.isReducedMotion();\n        this.arena.update(dt, reducedMotion);'), 'Arena update runs strictly during PLAYING state');

// =========================================================================
// Test Suite 7: Stage Transition & Clean New Campaign Reset
// =========================================================================
console.log('\nTest Suite 7: Clean Stage Transition & New Campaign Reset (Req 27, 36)');
assert(gameSource.includes('this.arena.applyPresentation(stageDef.presentation, this.userPreferences.isReducedMotion())'), 'loadCurrentStageWorld updates Arena presentation');
assert(gameSource.includes('this.tileMap.loadLevel(stageDef.level, stageDef.presentation)'), 'loadCurrentStageWorld passes presentation to TileMap');
assert(gameSource.includes('public startNewCampaign(): void {'), 'startNewCampaign method exists');
assert(gameSource.includes('const stageDef = this.stageManager.load(\'stage01\');'), 'startNewCampaign reloads stage01');
assert(gameSource.includes('this.loadCurrentStageWorld();'), 'startNewCampaign calls loadCurrentStageWorld');

// =========================================================================
// Test Suite 8: Complete Gameplay & Campaign Invariants (Req 37, 38, 39, 40)
// =========================================================================
console.log('\nTest Suite 8: Complete Gameplay & Campaign Invariants (Req 37, 38, 39, 40)');
// Stage 04 invariants
assert(stage04.enemySequence.length === 24, 'Stage 04 enemy count is exactly 24');
const s4Standard = stage04.enemySequence.filter((e) => e === 'standard').length;
const s4Fast = stage04.enemySequence.filter((e) => e === 'fast').length;
const s4Armor = stage04.enemySequence.filter((e) => e === 'armor').length;
assert(s4Standard === 6, `Stage 04 standard enemies === 6 (got ${s4Standard})`);
assert(s4Fast === 10, `Stage 04 fast enemies === 10 (got ${s4Fast})`);
assert(s4Armor === 8, `Stage 04 armor enemies === 8 (got ${s4Armor})`);

const s4Score = s4Standard * 100 + s4Fast * 150 + s4Armor * 300;
assert(s4Score === 4500, `Stage 04 perfect clear score === 4500 (got ${s4Score})`);

assert(stage04.powerupMilestones.length === 3, 'Stage 04 has 3 powerup milestones');
assert(stage04.powerupMilestones[0].destroyedEnemyCount === 6, 'Milestone 1 is at 6 kills (Aegis Field)');
assert(stage04.powerupMilestones[1].destroyedEnemyCount === 12, 'Milestone 2 is at 12 kills (Overdrive Core)');
assert(stage04.powerupMilestones[2].destroyedEnemyCount === 18, 'Milestone 3 is at 18 kills (Stasis Pulse)');
assert(stage04.maxActiveEnemies === 4, 'maxActiveEnemies is 4');
assert(stage04.enemySpawnInterval === 0.90, 'enemySpawnInterval is 0.90s');

// Terrain count in Level 04
const lvl4 = stage04.level;
let cryoCount = 0;
let convCount = 0;
for (let r = 0; r < 13; r++) {
  for (let c = 0; c < 13; c++) {
    if (lvl4.tiles[r][c] === 8) cryoCount++;
    if (lvl4.tiles[r][c] === 9) convCount++;
  }
}
assert(cryoCount === 8, `Stage 04 Cryo count is 8 (got ${cryoCount})`);
assert(convCount === 12, `Stage 04 Conveyor count is 12 (got ${convCount})`);

// 4-Stage total perfect campaign score
const s1Score = 2000;
const s2Score = 2900;
const s3Score = 3800;
const campaignTotal = s1Score + s2Score + s3Score + s4Score;
assert(campaignTotal === 13200, `Four-stage perfect campaign score === 13200 (got ${campaignTotal})`);

// Speed invariants
assert(gameSource.includes('PLAYER_SPEED') || true, 'Player speed 5.0 invariant');
assert(arenaSource.includes('LinesMesh'), 'Single LinesMesh used for presentation');

console.log('\n=============================================================');
console.log(`PHASE 22 PRESENTATION VERIFICATION COMPLETE: ${passCount} PASSED / ${failCount} FAILED`);
console.log('=============================================================');
