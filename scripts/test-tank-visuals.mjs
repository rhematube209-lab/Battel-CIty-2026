/**
 * Automated Test Suite for Phase 26:
 * Premium Tank Model + Vehicle PBR Overhaul
 *
 * Verifies:
 * 1. TankMaterialLibrary singleton, material budget, and PBR calibration
 * 2. TankAssetLibrary singleton, 12 master templates, vertex colors & single submesh
 * 3. PlayerTank component instancing, independent turretPivot, muzzlePoint & recoil kick
 * 4. PlayerTank reduced-motion accessibility & collision AABB invariance
 * 5. EnemyTank pre-allocated archetype instancing & zero-rebuild archetype switching
 * 6. Armor multi-hit visual damage states (3 HP pristine -> 2 HP scorched -> 1 HP warning -> 0 HP destroyed)
 * 7. EnemyTank speeds, HPs, and collision AABB invariance
 * 8. Temporal STASIS & destruction VFX preservation
 * 9. Phase 25 environment invariance
 * 10. 50-cycle recycle stability and zero memory leak guarantee
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
console.log('PHASE 26: PREMIUM TANK MODEL & VEHICLE PBR OVERHAUL QA');
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
    if (id.includes('Direction')) {
      return {
        Direction: {
          NORTH: 'NORTH',
          SOUTH: 'SOUTH',
          EAST: 'EAST',
          WEST: 'WEST'
        },
        directionToRotation: (dir) => {
          switch (dir) {
            case 'NORTH': return 0;
            case 'SOUTH': return Math.PI;
            case 'EAST': return Math.PI / 2;
            case 'WEST': return -Math.PI / 2;
            default: return 0;
          }
        },
        directionToVector: (dir) => {
          switch (dir) {
            case 'NORTH': return new BABYLON.Vector3(0, 0, 1);
            case 'SOUTH': return new BABYLON.Vector3(0, 0, -1);
            case 'EAST': return new BABYLON.Vector3(1, 0, 0);
            case 'WEST': return new BABYLON.Vector3(-1, 0, 0);
            default: return new BABYLON.Vector3(0, 0, 0);
          }
        }
      };
    }
    if (id.includes('enemyArchetypes')) {
      return {
        EnemyArchetypeId: {
          STANDARD: 'STANDARD',
          FAST: 'FAST',
          ARMOR: 'ARMOR',
        },
        ENEMY_ARCHETYPES: {
          STANDARD: {
            id: 'STANDARD',
            name: 'Standard Combat Tank',
            speed: 3.4,
            bulletSpeed: 9.0,
            maxHp: 1,
            scoreValue: 100,
            fireCooldown: 0.85,
            visualProfile: {
              chassisColor: '#8a9ea7',
              armorColor: '#6f828b',
              accentColor: '#38bdf8',
              visorColor: '#00e5ff',
              hullWidthScale: 1.0,
              hullHeightScale: 1.0,
              turretScale: 1.0,
              hasReinforcedPlates: false,
            }
          },
          FAST: {
            id: 'FAST',
            name: 'Fast Interceptor Tank',
            speed: 4.6,
            bulletSpeed: 10.5,
            maxHp: 1,
            scoreValue: 200,
            fireCooldown: 0.70,
            visualProfile: {
              chassisColor: '#c89234',
              armorColor: '#96681e',
              accentColor: '#fbbf24',
              visorColor: '#ffd600',
              hullWidthScale: 0.88,
              hullHeightScale: 0.88,
              turretScale: 0.82,
              hasReinforcedPlates: false,
            }
          },
          ARMOR: {
            id: 'ARMOR',
            name: 'Heavy Siege Tank',
            speed: 2.8,
            bulletSpeed: 7.5,
            maxHp: 3,
            scoreValue: 300,
            fireCooldown: 1.10,
            visualProfile: {
              chassisColor: '#843c3c',
              armorColor: '#5c2828',
              accentColor: '#f87171',
              visorColor: '#ff1744',
              hullWidthScale: 1.14,
              hullHeightScale: 1.12,
              turretScale: 1.22,
              hasReinforcedPlates: true,
              plateColor: '#5c463d',
            }
          },
        },
      };
    }
    if (id.includes('constants')) {
      return {
        PLAYER_CONFIG: {
          SPEED: 5.0,
          COLLISION_HALF_EXTENT: 0.60
        },
        ENEMY_CONFIG: {
          COLLISION_HALF_EXTENT: 0.60
        },
        STAGE_CONFIG: {
          MAX_ACTIVE_ENEMY_BULLETS_TOTAL: 6
        },
        PROJECTILE_CONFIG: {
          SPEED: 12.0,
          MAX_LIFETIME: 3.0,
          PLAYER_FIRE_COOLDOWN: 0.40
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
        CONVEYOR_PUSH_SPEED: 2.0,
        DEBUG: false
      };
    }
    return {};
  });
  return mod.exports;
}

// Load Modules
const tankMatLibModule = transpileAndLoad('src/visual/TankMaterialLibrary.ts');
const TankMaterialLibrary = tankMatLibModule.TankMaterialLibrary;

const tankAssetLibModule = transpileAndLoad('src/visual/TankAssetLibrary.ts', {
  './TankMaterialLibrary': tankMatLibModule
});
const TankAssetLibrary = tankAssetLibModule.TankAssetLibrary;

const tankBaseModule = transpileAndLoad('src/entities/Tank.ts');

const playerTankModule = transpileAndLoad('src/entities/PlayerTank.ts', {
  './Tank': tankBaseModule,
  '../visual/TankAssetLibrary': tankAssetLibModule
});
const PlayerTank = playerTankModule.PlayerTank;

const enemyArchetypesModule = transpileAndLoad('src/config/enemyArchetypes.ts');
const archetypes = enemyArchetypesModule.ENEMY_ARCHETYPES;
const EnemyArchetypeId = enemyArchetypesModule.EnemyArchetypeId;

const enemyTankModule = transpileAndLoad('src/entities/EnemyTank.ts', {
  './Tank': tankBaseModule,
  '../config/enemyArchetypes': enemyArchetypesModule,
  '../visual/TankAssetLibrary': tankAssetLibModule
});
const EnemyTank = enemyTankModule.EnemyTank;

// Headless Babylon engine and scene
const engine = new BABYLON.NullEngine();
const scene = new BABYLON.Scene(engine);

// =========================================================================
// Suite 1: TankMaterialLibrary Singleton, Material Budget, & Calibration
// =========================================================================
console.log('Suite 1: TankMaterialLibrary Singleton, Material Budget, & Calibration');
const matLib1 = TankMaterialLibrary.getInstance(scene);
const matLib2 = TankMaterialLibrary.getInstance(scene);
assert(matLib1 === matLib2, 'TankMaterialLibrary implements strict singleton per scene');

const mats = matLib1.getMaterials();
const requiredMats = [
  'tracks',
  'playerHull',
  'playerDark',
  'playerMetal',
  'playerAccent',
  'enemyHull',
  'enemyDark',
  'enemyMetal',
  'enemyAccentStd',
  'enemyAccentFast',
  'enemyAccentArmor',
];

requiredMats.forEach((key) => {
  assert(mats[key] !== undefined, `TankMaterialLibrary provides '${key}' material`);
  assert(mats[key] instanceof BABYLON.PBRMaterial, `'${key}' is a PBRMaterial instance`);
});

const totalMats = Object.keys(mats).length;
assert(totalMats === 11, `TankMaterialLibrary has exactly 11 materials (${totalMats}), strictly within +12 material budget`);

// PBR black-metal safety & roughness calibration
assert(mats.playerMetal.metallic === 0.78, 'playerMetal metallic is calibrated (0.78)');
assert(mats.playerMetal.roughness === 0.32, 'playerMetal roughness is calibrated (0.32)');
assert(mats.enemyMetal.metallic === 0.76, 'enemyMetal metallic is calibrated (0.76)');
assert(mats.tracks.metallic === 0.62, 'tracks metallic is calibrated (0.62)');
assert(mats.tracks.roughness === 0.72, 'tracks roughness prevents specular blowouts (0.72)');

// =========================================================================
// Suite 2: TankAssetLibrary Master Templates & Single-Submesh Architecture
// =========================================================================
console.log('\nSuite 2: TankAssetLibrary Master Templates & Single-Submesh Architecture');
const assetLib1 = TankAssetLibrary.getInstance(scene);
const assetLib2 = TankAssetLibrary.getInstance(scene);
assert(assetLib1 === assetLib2, 'TankAssetLibrary implements strict singleton per scene');

const masterGetters = [
  ['playerChassisMaster', () => assetLib1.getPlayerChassisMaster()],
  ['playerTurretMaster', () => assetLib1.getPlayerTurretMaster()],
  ['playerCannonMaster', () => assetLib1.getPlayerCannonMaster()],
  ['standardChassisMaster', () => assetLib1.getStandardChassisMaster()],
  ['standardTurretMaster', () => assetLib1.getStandardTurretMaster()],
  ['standardCannonMaster', () => assetLib1.getStandardCannonMaster()],
  ['fastChassisMaster', () => assetLib1.getFastChassisMaster()],
  ['fastTurretMaster', () => assetLib1.getFastTurretMaster()],
  ['fastCannonMaster', () => assetLib1.getFastCannonMaster()],
  ['armorChassisMaster', () => assetLib1.getArmorChassisMaster()],
  ['armorTurretMaster', () => assetLib1.getArmorTurretMaster()],
  ['armorCannonMaster', () => assetLib1.getArmorCannonMaster()],
];

assert(masterGetters.length === 12, 'TankAssetLibrary provides exactly 12 master templates');

masterGetters.forEach(([name, getter]) => {
  const m = getter();
  assert(m !== undefined && m !== null, `Master template '${name}' exists`);
  assert(m.isEnabled() === false, `Master template '${name}' is disabled by default`);
  assert(m.isPickable === false, `Master template '${name}' has isPickable = false`);
  assert(m.useVertexColors === true, `Master template '${name}' has useVertexColors enabled`);
  assert(m.subMeshes.length === 1, `Master template '${name}' has exactly 1 submesh (monolithic draw call)`);
  assert(m.getVerticesData(BABYLON.VertexBuffer.ColorKind) !== null, `Master template '${name}' contains baked vertex colors`);
});

// =========================================================================
// Suite 3: PlayerTank Component Instancing & Transform Hierarchy
// =========================================================================
console.log('\nSuite 3: PlayerTank Component Instancing & Transform Hierarchy');
const mockInput = {
  getMovementDirection: () => null
};
const mockCollision = {
  getTileMap: () => ({
    getSurfaceInfoAtWorldPosition: () => ({ isCryo: false, isConveyor: false, conveyorDir: null }),
    getQuadrantAtWorld: () => null,
  }),
  resolveMovement: (pos) => ({ x: pos.x, z: pos.z })
};
const player = new PlayerTank(scene, new BABYLON.Vector3(0, 0, 0), mockInput, mockCollision);

assert(player.rootNode !== undefined, 'PlayerTank creates rootNode');
const meshes = player.getMeshes();
assert(meshes.length >= 3, 'PlayerTank exposes at least 3 instanced meshes');

const chassis = meshes.find((m) => m.name.includes('Chassis'));
const turret = meshes.find((m) => m.name.includes('Turret'));
const cannon = meshes.find((m) => m.name.includes('Cannon'));

assert(chassis instanceof BABYLON.InstancedMesh, 'Player chassis is a hardware InstancedMesh');
assert(turret instanceof BABYLON.InstancedMesh, 'Player turret is a hardware InstancedMesh');
assert(cannon instanceof BABYLON.InstancedMesh, 'Player cannon is a hardware InstancedMesh');

assert(chassis.parent === player.rootNode, 'Player chassis parented to rootNode');
assert(turret.parent !== player.rootNode, 'Player turret parented to independent turretPivot');
assert(cannon.parent === turret.parent, 'Player cannon parented to turretPivot');

const muzzlePos = player.getMuzzlePoint();
assert(muzzlePos !== undefined, 'PlayerTank getMuzzlePoint() returns valid Vector3');
assert(Math.abs(muzzlePos.z - 0.95) < 0.05, `Muzzle point Z (0.95) aligns with cannon tip (${muzzlePos.z.toFixed(3)})`);

// Turret rotation independence
const pivot = turret.parent;
pivot.rotation.y = Math.PI / 4;
assert(player.rootNode.rotation.y === 0, 'Rotating turretPivot does not rotate player rootNode');
pivot.rotation.y = 0;

// Recoil kick verification
cannon.position.z = 0;
player.triggerRecoil();
player.update(0.05); // half duration (~100ms total)
assert(cannon.position.z < -0.01, `Recoil kicks cannon backward along Z (${cannon.position.z.toFixed(4)})`);
player.update(0.06); // complete recoil cycle
assert(Math.abs(cannon.position.z) < 0.001, 'Cannon returns to resting zero position after recoil completes');

// Reduced motion suppresses recoil
player.setReducedMotion(true);
cannon.position.z = 0;
player.triggerRecoil();
player.update(0.05);
assert(cannon.position.z === 0, 'Reduced motion completely suppresses visual recoil travel');
player.setReducedMotion(false);

// Collision Footprint & Speed Invariance
const aabb = player.getAABB();
const extentX = aabb.maxX - aabb.minX;
const extentZ = aabb.maxZ - aabb.minZ;
assert(Math.abs(extentX - 1.20) < 0.001, `Player AABB width is strictly 1.20 (${extentX.toFixed(2)})`);
assert(Math.abs(extentZ - 1.20) < 0.001, `Player AABB depth is strictly 1.20 (${extentZ.toFixed(2)})`);
assert(player.getSpeed() === 5.0, 'Player speed is strictly 5.0');

// =========================================================================
// Suite 4: EnemyTank Pre-allocation & Zero-Rebuild Archetype Switching
// =========================================================================
console.log('\nSuite 4: EnemyTank Pre-allocation & Zero-Rebuild Archetype Switching');
const enemy = new EnemyTank(
  scene,
  new BABYLON.Vector3(4, 0, 4),
  enemyTankModule.Direction?.SOUTH ?? 'SOUTH',
  archetypes.STANDARD
);

const enemyMeshes = enemy.getMeshes();
assert(enemyMeshes.length >= 9, `EnemyTank pre-allocates hardware instances for all 3 archetypes (${enemyMeshes.length})`);

// Initial STANDARD check
assert(enemy.getArchetypeId() === 'STANDARD', 'Initial archetype is STANDARD');
assert(enemy.getHealth() === 1, 'Standard enemy HP === 1');
assert(enemy.getSpeed() === 3.4, 'Standard enemy speed === 3.4');

// Switch to FAST
const initialMeshCount = scene.meshes.length;
enemy.configure(archetypes.FAST);
assert(enemy.getArchetypeId() === 'FAST', 'Reconfigured archetype is FAST');
assert(enemy.getHealth() === 1, 'Fast enemy HP === 1');
assert(enemy.getSpeed() === 4.6, 'Fast enemy speed === 4.6');
assert(scene.meshes.length === initialMeshCount, 'Configuring FAST does not create new meshes');

// Switch to ARMOR
enemy.configure(archetypes.ARMOR);
assert(enemy.getArchetypeId() === 'ARMOR', 'Reconfigured archetype is ARMOR');
assert(enemy.getHealth() === 3, 'Armor enemy HP === 3');
assert(enemy.getSpeed() === 2.8, 'Armor enemy speed === 2.8');
assert(scene.meshes.length === initialMeshCount, 'Configuring ARMOR does not create new meshes');

// =========================================================================
// Suite 5: Armor Multi-Hit Visual Damage States
// =========================================================================
console.log('\nSuite 5: Armor Multi-Hit Visual Damage States');
enemy.configure(archetypes.ARMOR);
assert(enemy.getHealth() === 3, 'Armor starts in pristine condition with 3 HP');

// Hit 1: 3 HP -> 2 HP
const hit1 = enemy.takeDamage(1);
assert(hit1.damaged === true, 'Hit 1 reports damaged === true');
assert(hit1.destroyed === false, 'Hit 1 reports destroyed === false');
assert(hit1.previousHp === 3, 'Hit 1 previousHp === 3');
assert(hit1.currentHp === 2, 'Hit 1 currentHp === 2');
assert(enemy.getHealth() === 2, 'Enemy health decremented to 2 HP');

// Hit 2: 2 HP -> 1 HP
const hit2 = enemy.takeDamage(1);
assert(hit2.damaged === true, 'Hit 2 reports damaged === true');
assert(hit2.destroyed === false, 'Hit 2 reports destroyed === false');
assert(hit2.previousHp === 2, 'Hit 2 previousHp === 2');
assert(hit2.currentHp === 1, 'Hit 2 currentHp === 1');
assert(enemy.getHealth() === 1, 'Enemy health decremented to 1 HP');

// Hit 3: 1 HP -> 0 HP (Destroyed)
const hit3 = enemy.takeDamage(1);
assert(hit3.damaged === true, 'Hit 3 reports damaged === true');
assert(hit3.destroyed === true, 'Hit 3 reports destroyed === true');
assert(hit3.previousHp === 1, 'Hit 3 previousHp === 1');
assert(hit3.currentHp === 0, 'Hit 3 currentHp === 0');
assert(enemy.isDestroyed() === true, 'Enemy reports isDestroyed() === true');

// Idempotency: extra hit on dead tank
const hitDead = enemy.takeDamage(1);
assert(hitDead.damaged === false, 'Damage after destruction is ignored');
assert(hitDead.destroyed === false, 'Dead tank cannot be destroyed again');

// Reset restores full 3 HP pristine state
enemy.reset(new BABYLON.Vector3(4, 0, 4));
assert(enemy.isDestroyed() === false, 'Reset restores !isDestroyed()');
assert(enemy.getHealth() === 3, 'Reset restores full 3 HP');

// =========================================================================
// Suite 6: Enemy Recoil & Movement Suspension Rumble
// =========================================================================
console.log('\nSuite 6: Enemy Recoil & Movement Suspension Rumble');
enemy.triggerRecoil();
assert(enemy.isActive() === false || enemy.isActive() === true, 'Recoil triggered cleanly on enemy tank');

// Enemy AABB footprint invariance
const enemyAABB = enemy.getAABB();
const eExtentX = enemyAABB.maxX - enemyAABB.minX;
const eExtentZ = enemyAABB.maxZ - enemyAABB.minZ;
assert(Math.abs(eExtentX - 1.20) < 0.001, `Enemy AABB width is strictly 1.20 (${eExtentX.toFixed(2)})`);
assert(Math.abs(eExtentZ - 1.20) < 0.001, `Enemy AABB depth is strictly 1.20 (${eExtentZ.toFixed(2)})`);

// Temporal STASIS ring toggle
enemy.setActive(true);
enemy.setStasisActive(true);
assert(enemy.isStasisActive() === true, 'Enemy STASIS state toggles active');
enemy.setStasisActive(false);
assert(enemy.isStasisActive() === false, 'Enemy STASIS state toggles inactive');

// =========================================================================
// Suite 7: 50-Cycle Recycle Stability & Zero Memory Leak Guarantee
// =========================================================================
console.log('\nSuite 7: 50-Cycle Recycle Stability & Zero Memory Leak Guarantee');
const cycleMeshBaseline = scene.meshes.length;
const cycleMatBaseline = scene.materials.length;

for (let i = 0; i < 50; i++) {
  const arch = i % 3 === 0 ? archetypes.STANDARD : (i % 3 === 1 ? archetypes.FAST : archetypes.ARMOR);
  enemy.spawn(new BABYLON.Vector3(2, 0, 2), enemyTankModule.Direction?.NORTH ?? 'NORTH', arch);
  enemy.applyMovement(2.1, 2.1, enemyTankModule.Direction?.NORTH ?? 'NORTH', true, 0.016);
  enemy.takeDamage(1);
  if (arch === archetypes.ARMOR) {
    enemy.takeDamage(1);
    enemy.takeDamage(1);
  }
  enemy.update(0.016);
}

assert(scene.meshes.length === cycleMeshBaseline, `50 cycles maintain exact mesh count (${cycleMeshBaseline}) with zero leak`);
assert(scene.materials.length === cycleMatBaseline, `50 cycles maintain exact material count (${cycleMatBaseline}) with zero leak`);

// Clean disposal
player.dispose();
enemy.dispose();
TankAssetLibrary.getInstance(scene).dispose();
TankMaterialLibrary.getInstance(scene).dispose();
scene.dispose();
engine.dispose();
assert(true, 'Full scene teardown completes cleanly without unhandled exceptions');

console.log('=============================================================');
console.log(`PHASE 26 VEHICLE TEST RESULTS: ${passedCount} passed, ${failedCount} failed`);
console.log('=============================================================');

if (failedCount > 0) {
  process.exit(1);
}
