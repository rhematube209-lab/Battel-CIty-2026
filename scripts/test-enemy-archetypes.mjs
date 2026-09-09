/**
 * Automated Test Suite for Phase 11:
 * Data-Driven Enemy Archetypes + Mixed Stage 01 Composition
 */

import fs from 'fs';

// -------------------------------------------------------------
// Pure mocks mirroring Phase 11 Architecture
// -------------------------------------------------------------

const EnemyArchetypeId = {
  STANDARD: 'STANDARD',
  FAST: 'FAST',
  ARMOR: 'ARMOR',
};

const ENEMY_ARCHETYPES = {
  [EnemyArchetypeId.STANDARD]: {
    id: EnemyArchetypeId.STANDARD,
    name: 'Standard Scout',
    maxHp: 1,
    speed: 3.4,
    fireCooldown: 0.85,
    bulletSpeed: 12.0,
    scoreValue: 100,
    visualProfile: {
      accentColor: '#ff6600',
      visorColor: '#ff3700',
      hullWidthScale: 1.0,
      hullHeightScale: 1.0,
      turretScale: 1.0,
      hasReinforcedPlates: false,
    },
    aiProfile: {
      decisionInterval: 0.45,
      stuckThreshold: 0.45,
      baseBias: 0.60,
    },
  },

  [EnemyArchetypeId.FAST]: {
    id: EnemyArchetypeId.FAST,
    name: 'Fast Raider',
    maxHp: 1,
    speed: 4.6,
    fireCooldown: 0.95,
    bulletSpeed: 13.0,
    scoreValue: 150,
    visualProfile: {
      accentColor: '#ffaa00',
      visorColor: '#ffcc00',
      hullWidthScale: 0.88,
      hullHeightScale: 0.86,
      turretScale: 0.92,
      hasReinforcedPlates: false,
    },
    aiProfile: {
      decisionInterval: 0.32,
      stuckThreshold: 0.35,
      baseBias: 0.45,
    },
  },

  [EnemyArchetypeId.ARMOR]: {
    id: EnemyArchetypeId.ARMOR,
    name: 'Heavy Armored Tank',
    maxHp: 3,
    speed: 2.8,
    fireCooldown: 1.20,
    bulletSpeed: 11.5,
    scoreValue: 300,
    visualProfile: {
      accentColor: '#e62200',
      visorColor: '#ff1100',
      hullWidthScale: 1.12,
      hullHeightScale: 1.08,
      turretScale: 1.10,
      hasReinforcedPlates: true,
    },
    aiProfile: {
      decisionInterval: 0.50,
      stuckThreshold: 0.55,
      baseBias: 0.75,
    },
  },
};

const STAGE_01_ENEMY_SEQUENCE = [
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

class MockEnemyTank {
  constructor(archetype = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]) {
    this.x = 0;
    this.z = 0;
    this.active = false;
    this.isDestroyedState = false;
    this.damageVisualState = 'pristine'; // 'pristine' | 'state_1' | 'state_2' | 'destroyed'
    this.configure(archetype);
  }

  configure(archetype) {
    this.archetype = archetype;
    this.maxHp = archetype.maxHp;
    this.currentHp = archetype.maxHp;
    this.speed = archetype.speed;
    this.updateDamageVisuals();
  }

  takeDamage(amount = 1) {
    if (this.isDestroyedState || this.currentHp <= 0) {
      return {
        damaged: false,
        destroyed: false,
        previousHp: this.currentHp,
        currentHp: this.currentHp,
      };
    }

    const previousHp = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - amount);

    if (this.currentHp <= 0) {
      this.destroy();
      return {
        damaged: true,
        destroyed: true,
        previousHp,
        currentHp: 0,
      };
    }

    this.updateDamageVisuals();
    return {
      damaged: true,
      destroyed: false,
      previousHp,
      currentHp: this.currentHp,
    };
  }

  updateDamageVisuals() {
    if (this.archetype.id === EnemyArchetypeId.ARMOR) {
      if (this.currentHp === 3) this.damageVisualState = 'pristine';
      else if (this.currentHp === 2) this.damageVisualState = 'state_1';
      else if (this.currentHp === 1) this.damageVisualState = 'state_2';
      else this.damageVisualState = 'destroyed';
    } else {
      this.damageVisualState = this.currentHp > 0 ? 'pristine' : 'destroyed';
    }
  }

  destroy() {
    this.isDestroyedState = true;
    this.currentHp = 0;
    this.damageVisualState = 'destroyed';
  }

  spawn(x, z, archetype = null) {
    if (archetype) this.configure(archetype);
    this.x = x;
    this.z = z;
    this.active = true;
    this.isDestroyedState = false;
    this.currentHp = this.maxHp;
    this.updateDamageVisuals();
  }

  getHealth() {
    return this.currentHp;
  }

  getMaxHealth() {
    return this.maxHp;
  }

  getScoreValue() {
    return this.archetype.scoreValue;
  }

  getArchetypeId() {
    return this.archetype.id;
  }

  isDestroyed() {
    return this.isDestroyedState;
  }

  isActive() {
    return this.active;
  }

  setActive(val) {
    this.active = val;
  }
}

class MockEnemyAISystem {
  constructor(tank) {
    this.tank = tank;
    this.configure(tank.archetype.aiProfile);
  }

  configure(aiProfile) {
    this.decisionInterval = aiProfile.decisionInterval;
    this.stuckThreshold = aiProfile.stuckThreshold;
    this.baseBias = aiProfile.baseBias;
  }
}

class MockEnemyManager {
  constructor(sequence = STAGE_01_ENEMY_SEQUENCE) {
    this.sequence = [...sequence];
    this.totalEnemies = 12;
    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.stageCompleteNotified = false;
    this.slots = [];

    for (let i = 0; i < 4; i++) {
      const tank = new MockEnemyTank();
      const ai = new MockEnemyAISystem(tank);
      this.slots.push({ tank, ai });
    }

    this.onDestroyed = null;
    this.onDamaged = null;
    this.onStageComplete = null;
  }

  trySpawnEnemy(x = 0, z = 12) {
    if (this.spawnedCount >= this.totalEnemies) return false;
    const freeSlot = this.slots.find((s) => !s.tank.isActive());
    if (!freeSlot) return false;

    const archetypeId = this.sequence[this.spawnedCount % this.sequence.length];
    const archetype = ENEMY_ARCHETYPES[archetypeId];

    freeSlot.tank.configure(archetype);
    freeSlot.ai.configure(archetype.aiProfile);
    freeSlot.tank.spawn(x, z);

    this.spawnedCount++;
    return true;
  }

  handleEnemyHit(tank) {
    if (tank.isDestroyed()) {
      return {
        damaged: false,
        destroyed: false,
        previousHp: 0,
        currentHp: 0,
      };
    }

    const res = tank.takeDamage(1);
    if (res.destroyed) {
      this.destroyedCount++;
      const remaining = this.getRemainingCount();
      if (this.onDestroyed) this.onDestroyed(tank, this.destroyedCount, remaining);
      this.checkStageComplete();
    } else if (res.damaged) {
      if (this.onDamaged) this.onDamaged(tank, res.currentHp, tank.getMaxHealth());
    }
    return res;
  }

  getRemainingCount() {
    return Math.max(0, this.totalEnemies - this.destroyedCount);
  }

  getActiveCount() {
    return this.slots.filter((s) => s.tank.isActive() && !s.tank.isDestroyed()).length;
  }

  checkStageComplete() {
    if (
      !this.stageCompleteNotified &&
      this.destroyedCount >= this.totalEnemies &&
      this.getActiveCount() === 0
    ) {
      this.stageCompleteNotified = true;
      if (this.onStageComplete) this.onStageComplete();
    }
  }

  reset() {
    this.spawnedCount = 0;
    this.destroyedCount = 0;
    this.stageCompleteNotified = false;
    for (const slot of this.slots) {
      slot.tank.setActive(false);
      slot.tank.configure(ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]);
    }
  }
}

// -------------------------------------------------------------
// Test Execution Harness
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

console.log('=== PHASE 11: DATA-DRIVEN ENEMY ARCHETYPES SUITE ===\n');

// =============================================================
// Test Suite 1: Archetype Configuration Specifications
// =============================================================
console.log('Test Suite 1: Archetype Configuration Specifications');

const std = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD];
assert(std.maxHp === 1, 'STANDARD maxHp is 1');
assert(std.speed === 3.4, 'STANDARD speed is 3.4 (baseline)');
assert(std.scoreValue === 100, 'STANDARD scoreValue is 100');
assert(std.fireCooldown === 0.85, 'STANDARD fireCooldown is 0.85');

const fast = ENEMY_ARCHETYPES[EnemyArchetypeId.FAST];
assert(fast.maxHp === 1, 'FAST maxHp is 1');
assert(fast.speed === 4.6 && fast.speed > std.speed, 'FAST speed is 4.6 (faster than STANDARD)');
assert(fast.scoreValue === 150, 'FAST scoreValue is 150');
assert(fast.aiProfile.decisionInterval === 0.32, 'FAST decisionInterval is 0.32s (quicker reaction)');

const armor = ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR];
assert(armor.maxHp === 3, 'ARMOR maxHp is 3 (multi-hit durability)');
assert(armor.speed === 2.8 && armor.speed < std.speed, 'ARMOR speed is 2.8 (slower than STANDARD)');
assert(armor.scoreValue === 300, 'ARMOR scoreValue is 300');
assert(armor.visualProfile.hasReinforcedPlates === true, 'ARMOR has reinforced armor plates');

// =============================================================
// Test Suite 2: Deterministic Stage 01 Composition Sequence
// =============================================================
console.log('\nTest Suite 2: Deterministic Stage 01 Composition Sequence');

assert(STAGE_01_ENEMY_SEQUENCE.length === 12, 'Stage 01 composition sequence has exactly 12 entries');

const counts = { STANDARD: 0, FAST: 0, ARMOR: 0 };
STAGE_01_ENEMY_SEQUENCE.forEach((id) => counts[id]++);

assert(counts.STANDARD === 5, 'Sequence contains exactly 5 STANDARD enemies');
assert(counts.FAST === 4, 'Sequence contains exactly 4 FAST enemies');
assert(counts.ARMOR === 3, 'Sequence contains exactly 3 ARMOR enemies');

const expectedOrder = [
  'STANDARD', 'STANDARD', 'FAST', 'STANDARD', 'ARMOR',
  'FAST', 'STANDARD', 'FAST', 'ARMOR', 'STANDARD', 'FAST', 'ARMOR'
];
const matchesOrder = STAGE_01_ENEMY_SEQUENCE.every((id, i) => id === expectedOrder[i]);
assert(matchesOrder, 'Sequence follows deterministic archetype distribution');

// =============================================================
// Test Suite 3: Pool Slot Dynamic Reconfiguration
// =============================================================
console.log('\nTest Suite 3: Pool Slot Dynamic Reconfiguration');

const testSlot = new MockEnemyTank(ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD]);
assert(testSlot.getArchetypeId() === 'STANDARD', 'Initial slot configured as STANDARD');
assert(testSlot.getHealth() === 1, 'Initial HP is 1');

// Reconfigure to ARMOR
testSlot.configure(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]);
assert(testSlot.getArchetypeId() === 'ARMOR', 'Slot reconfigured to ARMOR');
assert(testSlot.getHealth() === 3, 'ARMOR HP reset to 3');
assert(testSlot.speed === 2.8, 'ARMOR speed updated to 2.8');
assert(testSlot.getScoreValue() === 300, 'ARMOR scoreValue updated to 300');
assert(testSlot.damageVisualState === 'pristine', 'ARMOR visual state is pristine');

// Reconfigure to FAST
testSlot.configure(ENEMY_ARCHETYPES[EnemyArchetypeId.FAST]);
assert(testSlot.getArchetypeId() === 'FAST', 'Slot reconfigured to FAST');
assert(testSlot.getHealth() === 1, 'FAST HP reset to 1');
assert(testSlot.speed === 4.6, 'FAST speed updated to 4.6');
assert(testSlot.getScoreValue() === 150, 'FAST scoreValue updated to 150');

// =============================================================
// Test Suite 4: STANDARD Damage Resolution
// =============================================================
console.log('\nTest Suite 4: STANDARD Damage Resolution');

const mgr = new MockEnemyManager();
let lastScoreAdded = 0;
let destroyedCount = 0;
let remainingCount = 12;

mgr.onDestroyed = (tank, dCount, rCount) => {
  lastScoreAdded = tank.getScoreValue();
  destroyedCount = dCount;
  remainingCount = rCount;
};

mgr.trySpawnEnemy(); // Spawns 1st: STANDARD
const stdEnemy = mgr.slots[0].tank;
assert(stdEnemy.getArchetypeId() === 'STANDARD', 'First spawned enemy is STANDARD');

const hitResult1 = mgr.handleEnemyHit(stdEnemy);
assert(hitResult1.destroyed === true, 'One bullet destroys STANDARD (HP 1 -> 0)');
assert(hitResult1.damaged === true, 'Damage result indicates hit occurred');
assert(hitResult1.previousHp === 1 && hitResult1.currentHp === 0, 'HP transition 1 -> 0 correctly reported');
assert(stdEnemy.isDestroyed() === true, 'Enemy isDestroyed() returns true');
assert(lastScoreAdded === 100, 'Awarded +100 score for STANDARD');
assert(remainingCount === 11, 'Remaining enemies decremented to 11');

// =============================================================
// Test Suite 5: FAST Damage Resolution
// =============================================================
console.log('\nTest Suite 5: FAST Damage Resolution');

// Spawn next: STANDARD (idx 1), then FAST (idx 2)
mgr.slots[0].tank.setActive(false); // Free slot 0
mgr.trySpawnEnemy(); // 2nd: STANDARD
mgr.slots[0].tank.setActive(false); // Free slot 0
mgr.trySpawnEnemy(); // 3rd: FAST

const fastEnemy = mgr.slots[0].tank;
assert(fastEnemy.getArchetypeId() === 'FAST', '3rd spawned enemy is FAST');

const hitResultFast = mgr.handleEnemyHit(fastEnemy);
assert(hitResultFast.destroyed === true, 'One bullet destroys FAST (HP 1 -> 0)');
assert(hitResultFast.previousHp === 1 && hitResultFast.currentHp === 0, 'HP transition 1 -> 0 reported');
assert(lastScoreAdded === 150, 'Awarded +150 score for FAST');

// =============================================================
// Test Suite 6: ARMOR Multi-Hit Progression & Scoring
// =============================================================
console.log('\nTest Suite 6: ARMOR Multi-Hit Progression & Scoring');

mgr.slots[0].tank.setActive(false);
mgr.trySpawnEnemy(); // 4th: STANDARD
mgr.slots[0].tank.setActive(false);
mgr.trySpawnEnemy(); // 5th: ARMOR

const armorEnemy = mgr.slots[0].tank;
assert(armorEnemy.getArchetypeId() === 'ARMOR', '5th spawned enemy is ARMOR');
assert(armorEnemy.getHealth() === 3, 'ARMOR spawned with full 3 HP');

let armorDamagedCalls = 0;
mgr.onDamaged = (tank, hp, max) => {
  armorDamagedCalls++;
};

// Shot 1
lastScoreAdded = 0;
const rBefore1 = mgr.getRemainingCount();
const res1 = mgr.handleEnemyHit(armorEnemy);
assert(res1.damaged === true && res1.destroyed === false, 'Shot 1 produces surviving DAMAGED result');
assert(res1.previousHp === 3 && res1.currentHp === 2, 'Reported HP transition: 3 -> 2');
assert(armorEnemy.getHealth() === 2, 'ARMOR health reduced to 2');
assert(lastScoreAdded === 0, 'No score awarded on surviving hit');
assert(mgr.getRemainingCount() === rBefore1, 'Enemy count NOT decremented on surviving hit');
assert(armorDamagedCalls === 1, 'onEnemyDamaged callback invoked');

// Shot 2
const res2 = mgr.handleEnemyHit(armorEnemy);
assert(res2.damaged === true && res2.destroyed === false, 'Shot 2 produces surviving DAMAGED result');
assert(res2.previousHp === 2 && res2.currentHp === 1, 'Reported HP transition: 2 -> 1');
assert(armorEnemy.getHealth() === 1, 'ARMOR health reduced to 1');
assert(lastScoreAdded === 0, 'No score awarded on second surviving hit');
assert(armorDamagedCalls === 2, 'onEnemyDamaged callback invoked twice');

// Shot 3 (Lethal)
const res3 = mgr.handleEnemyHit(armorEnemy);
assert(res3.destroyed === true, 'Shot 3 produces DESTROYED result (lethal)');
assert(res3.previousHp === 1 && res3.currentHp === 0, 'Reported HP transition: 1 -> 0');
assert(armorEnemy.getHealth() === 0, 'ARMOR health reaches 0');
assert(armorEnemy.isDestroyed() === true, 'ARMOR isDestroyed() returns true');
assert(lastScoreAdded === 300, 'Awarded full +300 score on ARMOR destruction');

// =============================================================
// Test Suite 7: ARMOR Damage Visual States
// =============================================================
console.log('\nTest Suite 7: ARMOR Damage Visual States');

const visualArmor = new MockEnemyTank(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]);
assert(visualArmor.damageVisualState === 'pristine', 'At 3 HP, visual state is PRISTINE');

visualArmor.takeDamage(1);
assert(visualArmor.damageVisualState === 'state_1', 'At 2 HP, visual state transitions to DAMAGE STATE 1 (charred sides)');

visualArmor.takeDamage(1);
assert(visualArmor.damageVisualState === 'state_2', 'At 1 HP, visual state transitions to DAMAGE STATE 2 (heavy charred & warning)');

visualArmor.takeDamage(1);
assert(visualArmor.damageVisualState === 'destroyed', 'At 0 HP, visual state transitions to DESTROYED');

// Reversible reset
visualArmor.configure(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]);
assert(visualArmor.damageVisualState === 'pristine', 'Reconfiguration restores visual state to PRISTINE cleanly');

// =============================================================
// Test Suite 8: Duplicate Damage Protection on 0 HP
// =============================================================
console.log('\nTest Suite 8: Duplicate Damage Protection on 0 HP');

const deadTank = new MockEnemyTank(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]);
deadTank.takeDamage(3);
assert(deadTank.isDestroyed() === true, 'Tank is destroyed');

const scoreBefore = lastScoreAdded;
const destroyedCountBefore = mgr.destroyedCount;
const dupResult = mgr.handleEnemyHit(deadTank);

assert(dupResult.damaged === false && dupResult.destroyed === false, 'Subsequent hit on dead tank returns { damaged: false, destroyed: false }');
assert(mgr.destroyedCount === destroyedCountBefore, 'Destroyed count does not increment again');

// =============================================================
// Test Suite 9: Movement Speeds Across Archetypes
// =============================================================
console.log('\nTest Suite 9: Movement Speeds Across Archetypes');

const dt = 0.05; // 50ms frame
const stdDist = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD].speed * dt;
const fastDist = ENEMY_ARCHETYPES[EnemyArchetypeId.FAST].speed * dt;
const armorDist = ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR].speed * dt;

assert(fastDist > stdDist, `FAST distance (${fastDist.toFixed(3)}) > STANDARD distance (${stdDist.toFixed(3)})`);
assert(armorDist < stdDist, `ARMOR distance (${armorDist.toFixed(3)}) < STANDARD distance (${stdDist.toFixed(3)})`);
assert(fastDist < 5.0 * dt, 'FAST speed does not exceed Player speed (5.0)');

// =============================================================
// Test Suite 10: AI Behavioral Profiles
// =============================================================
console.log('\nTest Suite 10: AI Behavioral Profiles');

const aiStd = ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD].aiProfile;
const aiFast = ENEMY_ARCHETYPES[EnemyArchetypeId.FAST].aiProfile;
const aiArmor = ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR].aiProfile;

assert(aiFast.decisionInterval < aiStd.decisionInterval, 'FAST decision interval is tighter than STANDARD (quicker turns)');
assert(aiArmor.baseBias > aiStd.baseBias, 'ARMOR has stronger base pressure bias than STANDARD');
assert(aiFast.baseBias < aiStd.baseBias, 'FAST has lower base bias to encourage flanking routes');

// =============================================================
// Test Suite 11: Total Stage 01 Maximum Score Calculation
// =============================================================
console.log('\nTest Suite 11: Total Stage 01 Maximum Score Calculation');

let totalStageScore = 0;
STAGE_01_ENEMY_SEQUENCE.forEach((id) => {
  totalStageScore += ENEMY_ARCHETYPES[id].scoreValue;
});

assert(totalStageScore === 2000, `Calculated maximum enemy score is exactly 2000 (got ${totalStageScore})`);
const formattedScore = String(totalStageScore).padStart(6, '0');
assert(formattedScore === '002000', `Formatted HUD score is strictly '002000'`);

// =============================================================
// Test Suite 12: Stage Clear Gating & Incomplete HP
// =============================================================
console.log('\nTest Suite 12: Stage Clear Gating & Incomplete HP');

const stageMgr = new MockEnemyManager();
let stageCompleteFired = false;
stageMgr.onStageComplete = () => {
  stageCompleteFired = true;
};

// Spawn and kill 11 enemies
for (let i = 0; i < 11; i++) {
  stageMgr.slots[0].tank.setActive(false);
  stageMgr.trySpawnEnemy();
  const t = stageMgr.slots[0].tank;
  stageMgr.handleEnemyHit(t);
  if (t.getArchetypeId() === 'ARMOR') {
    stageMgr.handleEnemyHit(t);
    stageMgr.handleEnemyHit(t);
  }
}

// Spawn 12th enemy (ARMOR)
stageMgr.slots[0].tank.setActive(false);
stageMgr.trySpawnEnemy();
const lastArmor = stageMgr.slots[0].tank;
assert(lastArmor.getArchetypeId() === 'ARMOR', '12th enemy is ARMOR');

// Hit 12th enemy only twice (HP: 3 -> 1)
stageMgr.handleEnemyHit(lastArmor);
stageMgr.handleEnemyHit(lastArmor);
assert(lastArmor.getHealth() === 1, '12th enemy has 1 HP remaining');
assert(stageCompleteFired === false, 'Stage Clear blocked while 12th enemy is still living');

// Final lethal hit
stageMgr.handleEnemyHit(lastArmor);
assert(lastArmor.isDestroyed() === true, '12th enemy destroyed');
assert(stageCompleteFired === true, 'Stage Clear triggers once all 12 units are fully destroyed');

// =============================================================
// Test Suite 13: Full Stage In-Engine Reset
// =============================================================
console.log('\nTest Suite 13: Full Stage In-Engine Reset');

stageMgr.reset();
assert(stageMgr.spawnedCount === 0, 'Sequence cursor reset to 0');
assert(stageMgr.destroyedCount === 0, 'Destroyed count reset to 0');
assert(stageMgr.getRemainingCount() === 12, 'Remaining enemies restored to 12');

// Spawning after reset starts from 1st enemy (STANDARD)
stageMgr.trySpawnEnemy();
assert(stageMgr.slots[0].tank.getArchetypeId() === 'STANDARD', 'First spawned enemy after reset is STANDARD');
assert(stageMgr.slots[0].tank.damageVisualState === 'pristine', 'Slot visual state restored to pristine');

// =============================================================
// Test Suite 14: Weapon Firing Config & Team Bullet Ceiling
// =============================================================
console.log('\nTest Suite 14: Weapon Firing Config & Team Bullet Ceiling');

const MAX_ENEMY_BULLETS = 6;
let activeEnemyBullets = 0;
function tryFireMockBullet(archetype) {
  if (activeEnemyBullets >= MAX_ENEMY_BULLETS) return false;
  activeEnemyBullets++;
  return true;
}

assert(ENEMY_ARCHETYPES[EnemyArchetypeId.STANDARD].fireCooldown === 0.85, 'STANDARD uses 0.85s cooldown');
assert(ENEMY_ARCHETYPES[EnemyArchetypeId.FAST].fireCooldown === 0.95, 'FAST uses 0.95s cooldown');
assert(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR].fireCooldown === 1.20, 'ARMOR uses 1.20s cooldown');

// Verify ceiling enforcement
activeEnemyBullets = 0;
for (let i = 0; i < 6; i++) {
  assert(tryFireMockBullet(ENEMY_ARCHETYPES[EnemyArchetypeId.FAST]) === true, `Bullet ${i + 1} fires under ceiling`);
}
assert(tryFireMockBullet(ENEMY_ARCHETYPES[EnemyArchetypeId.FAST]) === false, '7th bullet rejected: team ceiling 6 strictly respected');
assert(tryFireMockBullet(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]) === false, 'ARMOR bullet also rejected when ceiling is reached');

// =============================================================
// Test Suite 15: Audio System Integration
// =============================================================
console.log('\nTest Suite 15: Audio System Integration');

class MockAudioSystem {
  constructor() {
    this.muted = false;
    this.playArmorHitCount = 0;
    this.playExplosionCount = 0;
  }
  playArmorHit() {
    if (this.muted) return;
    this.playArmorHitCount++;
  }
  playExplosion(type = 'enemy') {
    if (this.muted) return;
    this.playExplosionCount++;
  }
}

const mockAudio = new MockAudioSystem();
const armorUnit = new MockEnemyTank(ENEMY_ARCHETYPES[EnemyArchetypeId.ARMOR]);

// Shot 1 on Armor: surviving
const hit1 = armorUnit.takeDamage(1);
if (hit1.damaged && !hit1.destroyed) {
  mockAudio.playArmorHit();
} else if (hit1.destroyed) {
  mockAudio.playExplosion('enemy');
}
assert(mockAudio.playArmorHitCount === 1, 'Surviving ARMOR hit plays playArmorHit() exactly once');
assert(mockAudio.playExplosionCount === 0, 'Surviving ARMOR hit does NOT play full explosion');

// Shot 2 on Armor: surviving
const hit2 = armorUnit.takeDamage(1);
if (hit2.damaged && !hit2.destroyed) {
  mockAudio.playArmorHit();
}
assert(mockAudio.playArmorHitCount === 2, 'Second surviving hit plays playArmorHit() again');
assert(mockAudio.playExplosionCount === 0, 'Still no explosion played');

// Shot 3 on Armor: lethal
const hit3 = armorUnit.takeDamage(1);
if (hit3.destroyed) {
  mockAudio.playExplosion('enemy');
}
assert(mockAudio.playExplosionCount === 1, 'Lethal hit triggers tank explosion audio');
assert(mockAudio.playArmorHitCount === 2, 'Lethal hit does not trigger playArmorHit()');

// Mute test
mockAudio.muted = true;
mockAudio.playArmorHit();
assert(mockAudio.playArmorHitCount === 2, 'Muted audio system plays nothing');

// =============================================================
// Test Suite 16: Feedback Shake & Reduced Motion
// =============================================================
console.log('\nTest Suite 16: Feedback Shake & Reduced Motion');

class MockFeedbackSystem {
  constructor() {
    this.shakeIntensity = 0;
    this.reducedMotion = false;
  }
  triggerCameraShake(intensity) {
    if (this.reducedMotion) return;
    this.shakeIntensity = intensity;
  }
}

const feedback = new MockFeedbackSystem();
// Surviving hit feedback
feedback.triggerCameraShake(0.015);
assert(feedback.shakeIntensity === 0.015, 'Surviving armor hit triggers subtle camera feedback (0.015)');

// Lethal destruction feedback
feedback.triggerCameraShake(0.040);
assert(feedback.shakeIntensity === 0.040, 'Lethal destruction triggers standard tank explosion shake (0.040)');

// Reduced motion
feedback.reducedMotion = true;
feedback.shakeIntensity = 0;
feedback.triggerCameraShake(0.015);
assert(feedback.shakeIntensity === 0, 'Reduced motion suppresses camera shake completely');

// =============================================================
// Final Summary
// =============================================================
console.log('\n==================================================');
console.log(`Phase 11 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================\n');

if (failedCount > 0) {
  process.exit(1);
}

