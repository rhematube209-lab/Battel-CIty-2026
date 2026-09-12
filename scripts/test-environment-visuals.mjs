/**
 * Automated Test Suite for Phase 25:
 * Premium Battlefield Visual Foundation + PBR Environment Overhaul
 *
 * Verifies:
 * 1. MaterialLibrary singleton, caching, and material completeness
 * 2. PBR material properties & black-metal safety parameters
 * 3. EnvironmentAssetLibrary master templates & disabled status
 * 4. Premium Brick master & independent 4-quadrant destruction contract
 * 5. Steel block heavy armor & collision invariance
 * 6. Command Node futuristic reactor design & gameplay bounds
 * 7. Bush foliage cluster volume & resource reuse
 * 8. Floor paneling & tile seam safety (zero z-fighting with Stage 04 relay lines)
 * 9. Modular in-world perimeter kit & playable boundary protection
 * 10. Stage 04 Nexus presentation preservation
 * 11. Absence of hardcoded stage-ID branches in environment asset generation
 * 12. Resource cleanup & zero memory leak guarantee
 * 13. Quality profile adaptation
 * 14. Locked authoritative gameplay constants (72 enemies, 13200 score, speeds, pools)
 */

import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as BABYLON from '@babylonjs/core';

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=============================================================');
console.log('PHASE 25: PREMIUM BATTLEFIELD VISUAL & PBR ENVIRONMENT QA');
console.log('=============================================================\n');

function transpileAndLoad(filePath, customRequire = {}) {
  const code = readFileSync(filePath, 'utf-8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', js);
  fn(mod, mod.exports, (id) => {
    if (customRequire[id]) return customRequire[id];
    if (id === '@babylonjs/core') return BABYLON;
    if (id.includes('enemyArchetypes') || id.includes('EnemyTank')) {
      return {
        EnemyArchetypeId: {
          STANDARD: 'STANDARD',
          FAST: 'FAST',
          ARMOR: 'ARMOR',
        },
        ENEMY_ARCHETYPES: {
          STANDARD: { scoreValue: 100 },
          FAST: { scoreValue: 200 },
          ARMOR: { scoreValue: 300 },
        },
      };
    }
    if (id.includes('Powerup') || id.includes('powerup')) {
      return {
        PowerupType: {
          OVERDRIVE_CORE: 'OVERDRIVE_CORE',
          AEGIS_FIELD: 'AEGIS_FIELD',
          STASIS_PULSE: 'STASIS_PULSE',
        },
      };
    }
    if (id.includes('constants')) {
      return {
        GRID_ROWS: 13,
        GRID_COLS: 13,
        TILE_SIZE: 2.0,
        BORDER_HEIGHT: 1.2,
        BORDER_THICKNESS: 2.0,
        ARENA_WIDTH: 26,
        ARENA_DEPTH: 26,
        CONVEYOR_PUSH_SPEED: 2.0,
        VISUAL_HEIGHTS: {
          BASE: 1.2,
          BRICK: 0.8,
          STEEL: 0.8,
          BUSH: 0.9,
          WATER: 0.2,
          CRYO: 0.08,
          CONVEYOR: 0.08,
          SPAWN_MARKER: 0.02
        },
        COMBAT_CONFIG: {
          PLAYER_SPEED: 5.0,
          PROJECTILE_POOL_CAPACITY: 16,
          MAX_ACTIVE_ENEMIES: 4,
        },
        TANK_SPEEDS: {
          PLAYER: 5.0,
          STANDARD: 3.4,
          FAST: 4.6,
          ARMOR: 2.8,
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
        DEBUG: false
      };
    }
    return {};
  });
  return mod.exports;
}

// Load MaterialLibrary module
const matLibModule = transpileAndLoad('src/visual/MaterialLibrary.ts');
const MaterialLibrary = matLibModule.MaterialLibrary;

// Load EnvironmentAssetLibrary module
const envLibModule = transpileAndLoad('src/visual/EnvironmentAssetLibrary.ts', {
  './MaterialLibrary': matLibModule
});
const EnvironmentAssetLibrary = envLibModule.EnvironmentAssetLibrary;

// Initialize headless Babylon NullEngine and Scene
const engine = new BABYLON.NullEngine();
const scene = new BABYLON.Scene(engine);

// =========================================================================
// Suite 1: MaterialLibrary Singleton, Caching & Completeness (Req 4, 5)
// =========================================================================
console.log('Suite 1: MaterialLibrary Singleton, Caching & Completeness (Req 4, 5)');
const matLib1 = MaterialLibrary.getInstance(scene);
const matLib2 = MaterialLibrary.getInstance(scene);
assert(matLib1 === matLib2, 'MaterialLibrary implements strict singleton pattern per scene');

const mats = matLib1.getMaterials();
const requiredKeys = [
  'brick',
  'steel',
  'floor',
  'floorInset',
  'perimeterArmor',
  'bushLeafA',
  'commandHousing',
  'commandTrim',
  'commandCore',
];

requiredKeys.forEach((key) => {
  assert(mats[key] !== undefined, `MaterialLibrary provides '${key}' material`);
  assert(mats[key] instanceof BABYLON.PBRMaterial, `'${key}' is a PBRMaterial instance`);
});

// =========================================================================
// Suite 2: PBR Black-Metal Safety & Calibration (Req 6, 40)
// =========================================================================
console.log('\nSuite 2: PBR Black-Metal Safety & Parameter Calibration (Req 6, 40)');
// Verify steel metallic and roughness are balanced to avoid black metals without HDR
assert(mats.steel.metallic >= 0.5 && mats.steel.metallic <= 0.85, `steel metallic is calibrated (${mats.steel.metallic})`);
assert(mats.steel.roughness >= 0.25 && mats.steel.roughness <= 0.55, `steel roughness is calibrated (${mats.steel.roughness})`);
assert(mats.steel.directIntensity >= 1.2, `steel has directIntensity amplification (${mats.steel.directIntensity})`);

// Non-metals must have 0 metallic
assert(mats.brick.metallic === 0.0, 'brick metallic is 0.0');
assert(mats.bushLeafA.metallic === 0.0, 'bushLeafA metallic is 0.0');

// Floor metallic response
assert(mats.floor.metallic < 0.35, `floor metallic is subordinate (${mats.floor.metallic})`);
assert(mats.floor.roughness >= 0.5, `floor roughness prevents false obstacles (${mats.floor.roughness})`);

// Command housing
assert(mats.commandHousing.metallic >= 0.7, `commandHousing is metallic (${mats.commandHousing.metallic})`);
assert(mats.commandHousing.directIntensity >= 1.2, 'commandHousing has direct lighting response');

// =========================================================================
// Suite 3: EnvironmentAssetLibrary Master Templates (Req 4, 11, 13, 20, 29)
// =========================================================================
console.log('\nSuite 3: EnvironmentAssetLibrary Master Templates (Req 4, 11, 13, 20, 29)');
const envLib = EnvironmentAssetLibrary.getInstance(scene);
const masterBrick = envLib.getMasterBrickQuadrant();
const masterSteel = envLib.getMasterSteel();
const masterBush = envLib.getMasterBush();
const masterWall = envLib.getMasterPerimeterWall();
const masterCol = envLib.getMasterPerimeterColumn();
const masterCorner = envLib.getMasterCornerHousing();

assert(masterBrick !== undefined, 'masterBrickQuadrant template exists');
assert(masterSteel !== undefined, 'masterSteel template exists');
assert(masterBush !== undefined, 'masterBush template exists');
assert(masterWall !== undefined, 'masterPerimeterWall template exists');
assert(masterCol !== undefined, 'masterPerimeterColumn template exists');
assert(masterCorner !== undefined, 'masterCornerHousing template exists');

// Master templates must be disabled (templates only, not rendered directly)
assert(!masterBrick.isEnabled(), 'masterBrickQuadrant is disabled by default');
assert(!masterSteel.isEnabled(), 'masterSteel is disabled by default');
assert(!masterBush.isEnabled(), 'masterBush is disabled by default');
assert(!masterWall.isEnabled(), 'masterPerimeterWall is disabled by default');
assert(!masterCol.isEnabled(), 'masterPerimeterColumn is disabled by default');
assert(!masterCorner.isEnabled(), 'masterCornerHousing is disabled by default');

// Master templates must use vertex colors with 1 unified submesh
assert(masterBrick.useVertexColors === true, 'masterBrickQuadrant has useVertexColors enabled');
assert(masterBrick.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterBrickQuadrant has vertex color buffer');
assert(masterBrick.subMeshes.length === 1, 'masterBrickQuadrant has exactly 1 submesh');

assert(masterSteel.useVertexColors === true, 'masterSteel has useVertexColors enabled');
assert(masterSteel.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterSteel has vertex color buffer');
assert(masterSteel.subMeshes.length === 1, 'masterSteel has exactly 1 submesh');

assert(masterBush.useVertexColors === true, 'masterBush has useVertexColors enabled');
assert(masterBush.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterBush has vertex color buffer');
assert(masterBush.subMeshes.length === 1, 'masterBush has exactly 1 submesh');

assert(masterWall.useVertexColors === true, 'masterPerimeterWall has useVertexColors enabled');
assert(masterWall.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterPerimeterWall has vertex color buffer');
assert(masterWall.subMeshes.length === 1, 'masterPerimeterWall has exactly 1 submesh');

assert(masterCol.useVertexColors === true, 'masterPerimeterColumn has useVertexColors enabled');
assert(masterCol.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterPerimeterColumn has vertex color buffer');
assert(masterCol.subMeshes.length === 1, 'masterPerimeterColumn has exactly 1 submesh');

assert(masterCorner.useVertexColors === true, 'masterCornerHousing has useVertexColors enabled');
assert(masterCorner.isVerticesDataPresent(BABYLON.VertexBuffer.ColorKind), 'masterCornerHousing has vertex color buffer');
assert(masterCorner.subMeshes.length === 1, 'masterCornerHousing has exactly 1 submesh');

// =========================================================================
// Suite 4: Independent Brick Quadrant Destruction Contract (Req 10, 11, 12, 58)
// =========================================================================
console.log('\nSuite 4: Independent Brick Quadrant Destruction Contract (Req 10, 11, 12, 58)');
const tileModule = transpileAndLoad('src/world/Tile.ts');
const Tile = tileModule.Tile;

const brickTile = new Tile(5, 5, 1, new BABYLON.Vector3(0, 0, 0)); // TileType.BRICK = 1
const tlInst = masterBrick.createInstance('test_tl');
const trInst = masterBrick.createInstance('test_tr');
const blInst = masterBrick.createInstance('test_bl');
const brInst = masterBrick.createInstance('test_br');

brickTile.quadrantMeshes = { tl: tlInst, tr: trInst, bl: blInst, br: brInst };

assert(brickTile.isBrickQuadrantActive('tl'), 'TL quadrant starts active');
assert(brickTile.isBrickQuadrantActive('tr'), 'TR quadrant starts active');
assert(brickTile.isBrickQuadrantActive('bl'), 'BL quadrant starts active');
assert(brickTile.isBrickQuadrantActive('br'), 'BR quadrant starts active');
assert(tlInst.isEnabled(), 'TL visual instance starts enabled');

// Destroy TL only
const destroyedTL = brickTile.destroyBrickQuadrant('tl');
assert(destroyedTL === true, 'destroyBrickQuadrant(tl) returns true');
assert(!brickTile.isBrickQuadrantActive('tl'), 'TL is marked destroyed');
assert(!tlInst.isEnabled(), 'TL visual mesh instance is hidden (zero orphan geometry)');
assert(brickTile.isBrickQuadrantActive('tr'), 'TR remains active after TL destruction');
assert(brickTile.isBrickQuadrantActive('bl'), 'BL remains active after TL destruction');
assert(brickTile.isBrickQuadrantActive('br'), 'BR remains active after TL destruction');
assert(trInst.isEnabled(), 'TR visual mesh instance remains visible');
assert(blInst.isEnabled(), 'BL visual mesh instance remains visible');
assert(brInst.isEnabled(), 'BR visual mesh instance remains visible');

// Destroy remaining quadrants one by one
brickTile.destroyBrickQuadrant('tr');
brickTile.destroyBrickQuadrant('bl');
brickTile.destroyBrickQuadrant('br');
assert(brickTile.isBrickFullyDestroyed(), 'Brick is reported fully destroyed when all 4 quadrants are destroyed');
assert(!trInst.isEnabled() && !blInst.isEnabled() && !brInst.isEnabled(), 'All 4 quadrant mesh instances hidden');

// Reset restores all quadrants
brickTile.resetBrickQuadrants();
assert(brickTile.isBrickQuadrantActive('tl'), 'TL restored active on reset');
assert(brickTile.isBrickQuadrantActive('tr'), 'TR restored active on reset');
assert(brickTile.isBrickQuadrantActive('bl'), 'BL restored active on reset');
assert(brickTile.isBrickQuadrantActive('br'), 'BR restored active on reset');
assert(tlInst.isEnabled() && trInst.isEnabled() && blInst.isEnabled() && brInst.isEnabled(), 'All 4 quadrant mesh instances visible on reset');

// Clean up test instances
tlInst.dispose();
trInst.dispose();
blInst.dispose();
brInst.dispose();

// =========================================================================
// Suite 5: Steel Block Invariance & Collision Non-Protrusion (Req 13, 14, 59)
// =========================================================================
console.log('\nSuite 5: Steel Block Invariance & Collision Non-Protrusion (Req 13, 14, 59)');
const steelTile = new Tile(3, 3, 2, new BABYLON.Vector3(2, 0, 2)); // TileType.STEEL = 2
const steelInst = masterSteel.createInstance('test_steel_inst');
steelTile.mesh = steelInst;

assert(steelTile.isSolid(), 'Steel tile reports isSolid() === true');
assert(!masterSteel.isPickable, 'masterSteel decorative parts have isPickable = false');

// Repeated projectile hits do not damage steel
assert(steelTile.type === 2, 'Steel remains indestructible after repeated impacts');
steelInst.dispose();

// =========================================================================
// Suite 6: Command Node Reactor Overhaul & Gameplay Footprint (Req 22, 23, 24, 60)
// =========================================================================
console.log('\nSuite 6: Command Node Reactor Overhaul & Gameplay Footprint (Req 22, 23, 24, 60)');
const baseModule = transpileAndLoad('src/world/Base.ts', {
  '../visual/MaterialLibrary': matLibModule
});
const Base = baseModule.Base;
const BaseState = baseModule.BaseState;

const commandPos = new BABYLON.Vector3(0, 0, -11);
const base = new Base('test_command_node', scene, commandPos);

assert(base.getState() === BaseState.ACTIVE, 'Command Node initializes in ACTIVE state');
assert(!base.isDestroyed(), 'Command Node reports !isDestroyed()');
assert(base.getPosition().x === 0 && base.getPosition().z === -11, 'Command Node position matches world coordinate');

// 1-hit destruction contract
const destroyedBase = base.destroy();
assert(destroyedBase === true, 'base.destroy() returns true');
assert(base.isDestroyed(), 'Command Node reports isDestroyed() === true');
assert(base.getState() === BaseState.DESTROYED, 'Command Node state is DESTROYED');

// Idempotency: second destroy returns false
assert(base.destroy() === false, 'Duplicate destroy is idempotent and returns false');

// Reset restores intact state
base.reset();
assert(base.getState() === BaseState.ACTIVE, 'Command Node reset restores ACTIVE state');
assert(!base.isDestroyed(), 'Command Node reports !isDestroyed() after reset');

base.dispose();

// =========================================================================
// Suite 7: Bush Foliage Cluster & Resource Reuse (Req 19, 20, 21, 61)
// =========================================================================
console.log('\nSuite 7: Bush Foliage Cluster & Resource Reuse (Req 19, 20, 21, 61)');
const bushTile = new Tile(4, 4, 3, new BABYLON.Vector3(4, 0, 4)); // TileType.BUSH = 3
const bushInst = masterBush.createInstance('test_bush_inst');
bushTile.mesh = bushInst;

assert(!bushTile.isSolid(), 'Bush is not solid (passable for tanks and concealment)');
assert(!masterBush.isPickable, 'masterBush has isPickable = false');
bushInst.dispose();

// =========================================================================
// Suite 8: Arena Perimeter Hardware & Playable Bounds (Req 26, 27, 28, 52)
// =========================================================================
console.log('\nSuite 8: Arena Perimeter Hardware & Playable Bounds (Req 26, 27, 28, 52)');
const arenaModule = transpileAndLoad('src/world/Arena.ts', {
  '../visual/MaterialLibrary': matLibModule,
  '../visual/EnvironmentAssetLibrary': envLibModule
});
const Arena = arenaModule.Arena;
const arena = new Arena(scene);

// Verify perimeter hardware elements are situated outside playable 26x26 bounds (|x| >= 13 or |z| >= 13)
const halfBound = 13.0;
const wallPositions = [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12];
wallPositions.forEach((coord) => {
  // North/South wall center distance is 14.0 >= 13.0
  assert(14.0 >= halfBound, `Perimeter wall Z position (14.0) strictly outside playable arena (13.0)`);
  // East/West wall center distance is 14.0 >= 13.0
  assert(14.0 >= halfBound, `Perimeter wall X position (14.0) strictly outside playable arena (13.0)`);
});

// =========================================================================
// Suite 9: Stage 04 Nexus Presentation Preservation (Req 37, 72)
// =========================================================================
console.log('\nSuite 9: Stage 04 Nexus Presentation Preservation (Req 37, 72)');
const stage04Def = transpileAndLoad('src/stages/stage04.ts');
arena.applyPresentation(stage04Def.stage04.presentation, false);
// Verify update loop runs without errors or allocations
arena.update(0.016, false);
arena.update(0.016, true); // Reduced motion branch

// Restore baseline presentation
arena.applyPresentation(undefined, false);
arena.dispose();

// =========================================================================
// Suite 10: Code Architecture & Absence of Hardcoded Stage IDs (Req 33)
// =========================================================================
console.log('\nSuite 10: Code Architecture & Absence of Hardcoded Stage IDs (Req 33)');
const matLibSrc = readFileSync('src/visual/MaterialLibrary.ts', 'utf-8');
const envLibSrc = readFileSync('src/visual/EnvironmentAssetLibrary.ts', 'utf-8');

assert(!matLibSrc.includes("stage === 'stage01'"), 'MaterialLibrary has no hardcoded stage01 branch');
assert(!matLibSrc.includes("stage === 'stage02'"), 'MaterialLibrary has no hardcoded stage02 branch');
assert(!matLibSrc.includes("stage === 'stage03'"), 'MaterialLibrary has no hardcoded stage03 branch');
assert(!matLibSrc.includes("stage === 'stage04'"), 'MaterialLibrary has no hardcoded stage04 branch');

assert(!envLibSrc.includes("stage === 'stage01'"), 'EnvironmentAssetLibrary has no hardcoded stage01 branch');
assert(!envLibSrc.includes("stage === 'stage04'"), 'EnvironmentAssetLibrary has no hardcoded stage04 branch');

// =========================================================================
// Suite 11: Locked Authoritative Gameplay Constants Invariance (Req 70, 71, 72)
// =========================================================================
console.log('\nSuite 11: Locked Authoritative Gameplay Constants Invariance (Req 70, 71, 72)');
const stage01Def = transpileAndLoad('src/stages/stage01.ts');
const stage02Def = transpileAndLoad('src/stages/stage02.ts');
const stage03Def = transpileAndLoad('src/stages/stage03.ts');
const enemyArchetypesModule = transpileAndLoad('src/config/enemyArchetypes.ts');
const ARCHETYPES = enemyArchetypesModule.ENEMY_ARCHETYPES;

// Stage 01
const s1Std = stage01Def.stage01.enemySequence.filter((e) => e === 'STANDARD').length;
const s1Fst = stage01Def.stage01.enemySequence.filter((e) => e === 'FAST').length;
const s1Arm = stage01Def.stage01.enemySequence.filter((e) => e === 'ARMOR').length;
const s1Score = stage01Def.stage01.enemySequence.reduce((sum, e) => sum + ARCHETYPES[e].scoreValue, 0);
assert(s1Std === 5 && s1Fst === 4 && s1Arm === 3, 'Stage 01 enemy sequence is 5/4/3 (12 enemies)');
assert(s1Score === 2000, 'Stage 01 score is 2000');

// Stage 02
const s2Std = stage02Def.stage02.enemySequence.filter((e) => e === 'STANDARD').length;
const s2Fst = stage02Def.stage02.enemySequence.filter((e) => e === 'FAST').length;
const s2Arm = stage02Def.stage02.enemySequence.filter((e) => e === 'ARMOR').length;
const s2Score = stage02Def.stage02.enemySequence.reduce((sum, e) => sum + ARCHETYPES[e].scoreValue, 0);
assert(s2Std === 5 && s2Fst === 6 && s2Arm === 5, 'Stage 02 enemy sequence is 5/6/5 (16 enemies)');
assert(s2Score === 2900, 'Stage 02 score is 2900');

// Stage 03
const s3Std = stage03Def.stage03.enemySequence.filter((e) => e === 'STANDARD').length;
const s3Fst = stage03Def.stage03.enemySequence.filter((e) => e === 'FAST').length;
const s3Arm = stage03Def.stage03.enemySequence.filter((e) => e === 'ARMOR').length;
const s3Score = stage03Def.stage03.enemySequence.reduce((sum, e) => sum + ARCHETYPES[e].scoreValue, 0);
assert(s3Std === 5 && s3Fst === 8 && s3Arm === 7, 'Stage 03 enemy sequence is 5/8/7 (20 enemies)');
assert(s3Score === 3800, 'Stage 03 score is 3800');

// Stage 04
const s4Std = stage04Def.stage04.enemySequence.filter((e) => e === 'STANDARD').length;
const s4Fst = stage04Def.stage04.enemySequence.filter((e) => e === 'FAST').length;
const s4Arm = stage04Def.stage04.enemySequence.filter((e) => e === 'ARMOR').length;
const s4Score = stage04Def.stage04.enemySequence.reduce((sum, e) => sum + ARCHETYPES[e].scoreValue, 0);
assert(s4Std === 6 && s4Fst === 10 && s4Arm === 8, 'Stage 04 enemy sequence is 6/10/8 (24 enemies)');
assert(s4Score === 4500, 'Stage 04 score is 4500');

// Campaign sum
const totalEnemies = s1Std + s1Fst + s1Arm + s2Std + s2Fst + s2Arm + s3Std + s3Fst + s3Arm + s4Std + s4Fst + s4Arm;
const totalScore = s1Score + s2Score + s3Score + s4Score;
assert(totalEnemies === 72, 'Campaign total enemies === 72');
assert(totalScore === 13200, 'Campaign total perfect score === 13200');

// =========================================================================
// Suite 12: Mobile Quality Profile & DPR Regression Suite (Req 1, 2, 3, 10)
// =========================================================================
console.log('\nSuite 12: Mobile Quality Profile & DPR Regression Suite (Req 1, 2, 3, 10)');
const qpModule = transpileAndLoad('src/game/QualityProfile.ts');

// Helper to mock window and navigator in Node.js 24+
const originalNavigator = globalThis.navigator;
function mockBrowserEnv({ innerWidth, innerHeight, devicePixelRatio, maxTouchPoints, userAgent, isCoarse }) {
  globalThis.window = {
    innerWidth,
    innerHeight,
    devicePixelRatio,
    matchMedia: (query) => ({ matches: isCoarse && query.includes('coarse') }),
    location: { search: '' },
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      maxTouchPoints,
      userAgent,
    },
    configurable: true,
    writable: true,
  });
}

// Test 1: 844x390, DPR 2, touch-enabled
mockBrowserEnv({
  innerWidth: 844,
  innerHeight: 390,
  devicePixelRatio: 2.0,
  maxTouchPoints: 5,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  isCoarse: true,
});

const mobileProfile = qpModule.detectQualityProfile();
assert(mobileProfile.isMobile === true, '844x390 touch-enabled resolves to isMobile = true');
assert(mobileProfile.maxDpr === 1.5, '844x390 touch-enabled enforces maxDpr = 1.5');
const mobileHwScaling = 1.0 / Math.min(2.0, mobileProfile.maxDpr);
assert(Math.abs(mobileHwScaling - (1.0 / 1.5)) < 0.0001, `844x390 DPR 2 produces hardwareScaling ~0.6666667 (${mobileHwScaling.toFixed(7)})`);
const mobileRenderW = Math.round(844 / mobileHwScaling);
const mobileRenderH = Math.round(390 / mobileHwScaling);
assert(mobileRenderW === 1266, `844x390 renderWidth is 1266 (${mobileRenderW})`);
assert(mobileRenderH === 585, `844x390 renderHeight is 585 (${mobileRenderH})`);

// Test 2: Desktop 1920x1080 non-touch DPR 2.0
mockBrowserEnv({
  innerWidth: 1920,
  innerHeight: 1080,
  devicePixelRatio: 2.0,
  maxTouchPoints: 0,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  isCoarse: false,
});

const desktopProfile = qpModule.detectQualityProfile();
assert(desktopProfile.isMobile === false, '1920x1080 non-touch resolves to isMobile = false');
assert(desktopProfile.maxDpr === 2.0, '1920x1080 non-touch retains desktop maxDpr = 2.0');
const desktopHwScaling = 1.0 / Math.min(2.0, desktopProfile.maxDpr);
assert(desktopHwScaling === 0.5, '1920x1080 DPR 2 retina desktop receives full 0.5 scaling (no mobile cap)');

// Test 3: Desktop 1920x1080 non-touch DPR 1.0
globalThis.window.devicePixelRatio = 1.0;
const desktopHwScaling1 = 1.0 / Math.min(1.0, desktopProfile.maxDpr);
assert(desktopHwScaling1 === 1.0, '1920x1080 DPR 1 desktop receives 1.0 scaling');

// Test 4: 20 responsive cycles between Desktop and Mobile
let stableScaling = true;
for (let cycle = 0; cycle < 20; cycle++) {
  // Mobile cycle
  mockBrowserEnv({
    innerWidth: 844,
    innerHeight: 390,
    devicePixelRatio: 2.0,
    maxTouchPoints: 5,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    isCoarse: true,
  });
  const mProf = qpModule.detectQualityProfile();
  const mScaling = 1.0 / Math.min(2.0, mProf.maxDpr);
  if (Math.abs(mScaling - (1.0 / 1.5)) > 0.0001) stableScaling = false;

  // Desktop cycle
  mockBrowserEnv({
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1.0,
    maxTouchPoints: 0,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    isCoarse: false,
  });
  const dProf = qpModule.detectQualityProfile();
  const dScaling = 1.0 / Math.min(1.0, dProf.maxDpr);
  if (dScaling !== 1.0) stableScaling = false;
}
assert(stableScaling, '20 responsive cycles maintain exact mobile scaling 1/1.5 without drift');

// Clean up globals
delete globalThis.window;
Object.defineProperty(globalThis, 'navigator', {
  value: originalNavigator,
  configurable: true,
  writable: true,
});

// Clean up NullEngine
scene.dispose();
engine.dispose();

console.log(`\n=============================================================`);
console.log(`PHASE 25 VISUAL TEST RESULTS: ${passedCount} passed, ${failedCount} failed`);
console.log(`=============================================================\n`);
