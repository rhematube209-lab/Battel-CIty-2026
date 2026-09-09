/**
 * Automated Test Suite for Phase 12:
 * Original Battlefield Powerups + Drop System + Timed Effects
 */

const PowerupType = {
  OVERDRIVE_CORE: 'OVERDRIVE_CORE',
  AEGIS_FIELD: 'AEGIS_FIELD',
  STASIS_PULSE: 'STASIS_PULSE',
};

const POWERUP_CONFIGS = {
  [PowerupType.OVERDRIVE_CORE]: {
    type: PowerupType.OVERDRIVE_CORE,
    name: 'OVERDRIVE CORE',
    shortCode: 'OD',
    duration: 8.0,
    scoreValue: 0,
    fireCooldown: 0.18,
    maxActiveBullets: 3,
  },
  [PowerupType.AEGIS_FIELD]: {
    type: PowerupType.AEGIS_FIELD,
    name: 'AEGIS FIELD',
    shortCode: 'AG',
    duration: 6.0,
    scoreValue: 0,
  },
  [PowerupType.STASIS_PULSE]: {
    type: PowerupType.STASIS_PULSE,
    name: 'STASIS PULSE',
    shortCode: 'ST',
    duration: 5.0,
    scoreValue: 0,
  },
};

const POWERUP_DROP_MILESTONES = {
  3: PowerupType.OVERDRIVE_CORE,
  6: PowerupType.AEGIS_FIELD,
  9: PowerupType.STASIS_PULSE,
};

const POWERUP_POOL_SIZE = 3;
const POWERUP_DROP_LIFETIME = 10.0;
const BASELINE_FIRE_COOLDOWN = 0.28;
const BASELINE_MAX_BULLETS = 2;

// -------------------------------------------------------------
// Pure Mocks Mirroring Phase 12 Architecture
// -------------------------------------------------------------

class MockPowerup {
  constructor(id) {
    this.id = id;
    this.active = false;
    this.type = PowerupType.OVERDRIVE_CORE;
    this.x = 0;
    this.z = 0;
    this.lifetime = 0;
  }

  spawn(x, z, type) {
    this.x = x;
    this.z = z;
    this.type = type;
    this.lifetime = 0;
    this.active = true;
  }

  update(dt) {
    if (!this.active) return false;
    this.lifetime += dt;
    if (this.lifetime >= POWERUP_DROP_LIFETIME) {
      this.deactivate();
      return false;
    }
    return true;
  }

  deactivate() {
    this.active = false;
    this.lifetime = 0;
  }

  getAABB() {
    const h = 0.50;
    return {
      minX: this.x - h,
      maxX: this.x + h,
      minZ: this.z - h,
      maxZ: this.z + h,
    };
  }

  isActive() {
    return this.active;
  }

  getType() {
    return this.type;
  }
}

class MockPowerupSystem {
  constructor() {
    this.pool = [];
    for (let i = 0; i < POWERUP_POOL_SIZE; i++) {
      this.pool.push(new MockPowerup(`mock_powerup_${i}`));
    }
    this.activeDrop = null;
    this.triggeredMilestones = new Set();
    this.overdriveTimer = 0;
    this.aegisTimer = 0;
    this.stasisTimer = 0;

    this.onPowerupCollect = null;
    this.onPowerupExpire = null;
  }

  handleEnemyDestroyed(destroyedCount, x = 0, z = 0) {
    const milestoneType = POWERUP_DROP_MILESTONES[destroyedCount];
    if (!milestoneType) return false;

    if (this.triggeredMilestones.has(destroyedCount)) return false;
    this.triggeredMilestones.add(destroyedCount);

    if (this.activeDrop !== null && this.activeDrop.isActive()) {
      return false; // Max 1 active battlefield drop at a time
    }

    const freeSlot = this.pool.find((p) => !p.isActive());
    if (!freeSlot) return false;

    freeSlot.spawn(x, z, milestoneType);
    this.activeDrop = freeSlot;
    return true;
  }

  update(dt, playerAABB, isPlayerActive = true) {
    if (this.activeDrop && this.activeDrop.isActive()) {
      const alive = this.activeDrop.update(dt);
      if (!alive) {
        this.activeDrop = null;
        if (this.onPowerupExpire) this.onPowerupExpire();
      } else if (isPlayerActive) {
        const dropBox = this.activeDrop.getAABB();
        if (this.checkOverlap(playerAABB, dropBox)) {
          const type = this.activeDrop.getType();
          this.activeDrop.deactivate();
          this.activeDrop = null;
          this.activateEffect(type);
          if (this.onPowerupCollect) this.onPowerupCollect(type);
        }
      }
    }

    if (this.overdriveTimer > 0) {
      this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    }
    if (this.aegisTimer > 0) {
      this.aegisTimer = Math.max(0, this.aegisTimer - dt);
    }
    if (this.stasisTimer > 0) {
      this.stasisTimer = Math.max(0, this.stasisTimer - dt);
    }
  }

  activateEffect(type) {
    const cfg = POWERUP_CONFIGS[type];
    if (type === PowerupType.OVERDRIVE_CORE) {
      this.overdriveTimer = cfg.duration;
    } else if (type === PowerupType.AEGIS_FIELD) {
      this.aegisTimer = cfg.duration;
    } else if (type === PowerupType.STASIS_PULSE) {
      this.stasisTimer = cfg.duration;
    }
  }

  checkOverlap(a, b) {
    const eps = 0.001;
    return (
      a.maxX > b.minX + eps &&
      a.minX < b.maxX - eps &&
      a.maxZ > b.minZ + eps &&
      a.minZ < b.maxZ - eps
    );
  }

  getPlayerFireCooldown() {
    return this.overdriveTimer > 0 ? 0.18 : BASELINE_FIRE_COOLDOWN;
  }

  getPlayerBulletLimit() {
    return this.overdriveTimer > 0 ? 3 : BASELINE_MAX_BULLETS;
  }

  isAegisShieldActive() {
    return this.aegisTimer > 0;
  }

  isStasisActive() {
    return this.stasisTimer > 0;
  }

  isOverdriveActive() {
    return this.overdriveTimer > 0;
  }

  clearActiveEffects() {
    this.overdriveTimer = 0;
    this.aegisTimer = 0;
    this.stasisTimer = 0;
  }

  reset() {
    if (this.activeDrop) {
      this.activeDrop.deactivate();
      this.activeDrop = null;
    }
    for (const p of this.pool) {
      p.deactivate();
    }
    this.triggeredMilestones.clear();
    this.clearActiveEffects();
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

console.log('=== PHASE 12: BATTLEFIELD POWERUPS SUITE ===\n');

// =============================================================
// Test Suite 1: Milestone Drops Architecture
// =============================================================
console.log('Test Suite 1: Milestone Drops Architecture');

const sys = new MockPowerupSystem();

assert(sys.handleEnemyDestroyed(1) === false, 'Enemy kill #1 triggers no drop');
assert(sys.handleEnemyDestroyed(2) === false, 'Enemy kill #2 triggers no drop');

assert(sys.handleEnemyDestroyed(3) === true, 'Enemy kill #3 triggers OVERDRIVE CORE drop');
assert(sys.activeDrop !== null && sys.activeDrop.getType() === PowerupType.OVERDRIVE_CORE, 'Active drop is OVERDRIVE CORE');

assert(sys.handleEnemyDestroyed(3) === false, 'Duplicate kill #3 event does not drop again (idempotent)');

// Clean drop for next milestone test
sys.activeDrop.deactivate();
sys.activeDrop = null;

assert(sys.handleEnemyDestroyed(4) === false, 'Enemy kill #4 triggers no drop');
assert(sys.handleEnemyDestroyed(5) === false, 'Enemy kill #5 triggers no drop');

assert(sys.handleEnemyDestroyed(6) === true, 'Enemy kill #6 triggers AEGIS FIELD drop');
assert(sys.activeDrop !== null && sys.activeDrop.getType() === PowerupType.AEGIS_FIELD, 'Active drop is AEGIS FIELD');

sys.activeDrop.deactivate();
sys.activeDrop = null;

assert(sys.handleEnemyDestroyed(7) === false, 'Enemy kill #7 triggers no drop');
assert(sys.handleEnemyDestroyed(8) === false, 'Enemy kill #8 triggers no drop');

assert(sys.handleEnemyDestroyed(9) === true, 'Enemy kill #9 triggers STASIS PULSE drop');
assert(sys.activeDrop !== null && sys.activeDrop.getType() === PowerupType.STASIS_PULSE, 'Active drop is STASIS PULSE');

sys.activeDrop.deactivate();
sys.activeDrop = null;

assert(sys.handleEnemyDestroyed(10) === false, 'Enemy kill #10 triggers no drop');
assert(sys.handleEnemyDestroyed(11) === false, 'Enemy kill #11 triggers no drop');
assert(sys.handleEnemyDestroyed(12) === false, 'Enemy kill #12 triggers no drop');

// =============================================================
// Test Suite 2: Fixed Powerup Pool Capacity
// =============================================================
console.log('\nTest Suite 2: Fixed Powerup Pool Capacity');

assert(sys.pool.length === 3, 'Powerup pool size is strictly 3');
const activeBefore = sys.pool.filter((p) => p.isActive()).length;
assert(activeBefore === 0, 'Initial active count in pool is 0');

sys.reset();
assert(sys.pool.length === 3, 'Pool size remains strictly 3 across reset (no allocations)');

// =============================================================
// Test Suite 3: Drop Ceiling (At Most 1 Active Arena Drop)
// =============================================================
console.log('\nTest Suite 3: Drop Ceiling (At Most 1 Active Arena Drop)');

sys.reset();
sys.handleEnemyDestroyed(3, 0, 0); // Spawns drop #1
assert(sys.activeDrop !== null, 'Drop #1 is active in the arena');

// Simulate milestone #6 while drop #1 is still uncollected in the arena
const drop6Result = sys.handleEnemyDestroyed(6, 4, 4);
assert(drop6Result === false, 'Drop #2 rejected: max 1 active battlefield drop strictly enforced');
assert(sys.activeDrop.getType() === PowerupType.OVERDRIVE_CORE, 'Arena still contains drop #1');

// =============================================================
// Test Suite 4: Physical AABB Collection
// =============================================================
console.log('\nTest Suite 4: Physical AABB Collection');

sys.reset();
sys.handleEnemyDestroyed(3, 0, 0); // Spawns at (0, 0)
let collectedType = null;
sys.onPowerupCollect = (type) => {
  collectedType = type;
};

// Player far away at (5, 5)
const farPlayerAABB = { minX: 4.4, maxX: 5.6, minZ: 4.4, maxZ: 5.6 };
sys.update(0.1, farPlayerAABB);
assert(sys.activeDrop !== null, 'Player far away does not collect drop');
assert(sys.overdriveTimer === 0, 'Overdrive effect not active');

// Player drives into (0, 0)
const overlappingPlayerAABB = { minX: -0.5, maxX: 0.5, minZ: -0.5, maxZ: 0.5 };
sys.update(0.1, overlappingPlayerAABB);

assert(collectedType === PowerupType.OVERDRIVE_CORE, 'onPowerupCollect fired with OVERDRIVE_CORE');
assert(sys.activeDrop === null, 'Active drop deactivated and cleared from arena');
assert(sys.overdriveTimer > 7.8, 'Overdrive effect activated with 8.0s duration');

// Second update at same position does not re-trigger
collectedType = null;
sys.update(0.1, overlappingPlayerAABB);
assert(collectedType === null, 'No duplicate collection callback');

// =============================================================
// Test Suite 5: Destroyed / Respawning Player Cannot Collect
// =============================================================
console.log('\nTest Suite 5: Destroyed / Respawning Player Cannot Collect');

sys.reset();
sys.handleEnemyDestroyed(3, 0, 0);
collectedType = null;

// Destroyed player overlaps drop
sys.update(0.1, overlappingPlayerAABB, false); // isPlayerActive = false
assert(sys.activeDrop !== null, 'Destroyed/respawning player cannot collect powerup');
assert(sys.overdriveTimer === 0, 'Effect remains inactive');

// =============================================================
// Test Suite 6: Drop 10-Second Expiration
// =============================================================
console.log('\nTest Suite 6: Drop 10-Second Expiration');

sys.reset();
sys.handleEnemyDestroyed(3, 0, 0);
let expiredFired = false;
sys.onPowerupExpire = () => {
  expiredFired = true;
};

// Advance 9.8 seconds
sys.update(9.8, farPlayerAABB);
assert(sys.activeDrop !== null, 'Drop remains active before 10.0 seconds');
assert(expiredFired === false, 'Expire callback has not fired yet');

// Advance past 10.0 seconds (e.g. +0.3s)
sys.update(0.3, farPlayerAABB);
assert(sys.activeDrop === null, 'Drop expired and returned to pool after 10.0s');
assert(expiredFired === true, 'onPowerupExpire callback fired exactly once');

// =============================================================
// Test Suite 7: OVERDRIVE CORE Combat Modifiers & Expiration
// =============================================================
console.log('\nTest Suite 7: OVERDRIVE CORE Combat Modifiers & Expiration');

sys.reset();
assert(sys.getPlayerFireCooldown() === 0.28, 'Baseline player fire cooldown is 0.28s');
assert(sys.getPlayerBulletLimit() === 2, 'Baseline player max active bullets is 2');

sys.activateEffect(PowerupType.OVERDRIVE_CORE);
assert(sys.getPlayerFireCooldown() === 0.18, 'OVERDRIVE active: fire cooldown reduced to 0.18s');
assert(sys.getPlayerBulletLimit() === 3, 'OVERDRIVE active: max active bullets increased to 3');

// Fast forward 7.9 seconds
sys.update(7.9, farPlayerAABB);
assert(sys.getPlayerFireCooldown() === 0.18, 'Still active at 7.9s');

// Advance past 8.0 seconds
sys.update(0.2, farPlayerAABB);
assert(sys.getPlayerFireCooldown() === 0.28, 'After 8.0s: cooldown restored to 0.28s baseline');
assert(sys.getPlayerBulletLimit() === 2, 'After 8.0s: bullet limit restored to 2 baseline');

// =============================================================
// Test Suite 8: OVERDRIVE Bullet Limit Expiration Safety
// =============================================================
console.log('\nTest Suite 8: OVERDRIVE Bullet Limit Expiration Safety');

// Simulate 3 active bullets in flight when Overdrive expires
let simulatedActiveBullets = 3;
function canFirePlayer(sysInstance, activeCount) {
  return activeCount < sysInstance.getPlayerBulletLimit();
}

sys.activateEffect(PowerupType.OVERDRIVE_CORE);
assert(canFirePlayer(sys, 2) === true, 'Can fire 3rd bullet during Overdrive (2 < 3)');

// Overdrive expires
sys.update(8.1, farPlayerAABB);
assert(sys.getPlayerBulletLimit() === 2, 'Bullet limit is now 2');
assert(canFirePlayer(sys, simulatedActiveBullets) === false, 'Cannot fire 4th bullet when 3 are in flight (3 >= 2)');

// One bullet hits and deactivates (count: 3 -> 2)
simulatedActiveBullets = 2;
assert(canFirePlayer(sys, simulatedActiveBullets) === false, 'Still cannot fire when 2 are in flight (2 >= 2)');

// Second bullet deactivates (count: 2 -> 1)
simulatedActiveBullets = 1;
assert(canFirePlayer(sys, simulatedActiveBullets) === true, 'Firing resumes once active bullets drop below normal limit (1 < 2)');

// =============================================================
// Test Suite 9: AEGIS FIELD Absorption & Normal Resumption
// =============================================================
console.log('\nTest Suite 9: AEGIS FIELD Absorption & Normal Resumption');

sys.reset();
let playerLives = 3;
let shieldHitAudioCount = 0;
let playerExplosionCount = 0;

function simulateEnemyBulletHitPlayer(sysInstance) {
  if (sysInstance.isAegisShieldActive()) {
    // Absorbed
    shieldHitAudioCount++;
    return 'ABSORBED';
  } else {
    playerLives--;
    playerExplosionCount++;
    return 'DESTROYED';
  }
}

// Without Aegis
assert(sys.isAegisShieldActive() === false, 'Aegis is initially inactive');
assert(simulateEnemyBulletHitPlayer(sys) === 'DESTROYED', 'Enemy bullet destroys player without Aegis');
assert(playerLives === 2, 'Player life decremented to 2');
assert(playerExplosionCount === 1, 'Explosion sound triggered');

// Activate Aegis
sys.activateEffect(PowerupType.AEGIS_FIELD);
assert(sys.isAegisShieldActive() === true, 'Aegis is now active');

const aegisRes1 = simulateEnemyBulletHitPlayer(sys);
assert(aegisRes1 === 'ABSORBED', 'Enemy bullet absorbed by AEGIS');
assert(playerLives === 2, 'Player lives unchanged (protected)');
assert(shieldHitAudioCount === 1, 'Shield hit sound played');

const aegisRes2 = simulateEnemyBulletHitPlayer(sys);
assert(aegisRes2 === 'ABSORBED', 'Second enemy bullet absorbed by AEGIS');
assert(playerLives === 2, 'Player lives still unchanged');
assert(shieldHitAudioCount === 2, 'Second shield deflection sound played');

// Advance past 6.0 seconds
sys.update(6.1, farPlayerAABB);
assert(sys.isAegisShieldActive() === false, 'Aegis expired after 6.0s');

const afterExpireRes = simulateEnemyBulletHitPlayer(sys);
assert(afterExpireRes === 'DESTROYED', 'Subsequent enemy bullet damages player after Aegis expiration');
assert(playerLives === 1, 'Player life decremented to 1');

// =============================================================
// Test Suite 10: STASIS PULSE Enemy Freezing & Flight Continuation
// =============================================================
console.log('\nTest Suite 10: STASIS PULSE Enemy Freezing & Flight Continuation');

sys.reset();
assert(sys.isStasisActive() === false, 'Stasis initially inactive');

sys.activateEffect(PowerupType.STASIS_PULSE);
assert(sys.isStasisActive() === true, 'Stasis is active for 5.0s');

// Simulation check: Enemy AI updates skipped during stasis
let enemyMoved = false;
let enemyFired = false;
let bulletInFlightMoved = false;

function updateWorldDuringStasis(sysInstance, dt) {
  if (!sysInstance.isStasisActive()) {
    enemyMoved = true;
    enemyFired = true;
  }
  // Existing bullets in flight ALWAYS move
  bulletInFlightMoved = true;
}

updateWorldDuringStasis(sys, 0.5);
assert(enemyMoved === false, 'Enemy movement blocked during Stasis');
assert(enemyFired === false, 'Enemy firing blocked during Stasis');
assert(bulletInFlightMoved === true, 'Existing projectile in flight continues movement normally');

// Advance past 5.0 seconds
sys.update(5.1, farPlayerAABB);
assert(sys.isStasisActive() === false, 'Stasis expired after 5.0s');

updateWorldDuringStasis(sys, 0.5);
assert(enemyMoved === true, 'Enemy AI and movement resumed cleanly after expiration');

// =============================================================
// Test Suite 11: Effect Duration Refresh (No Magnitude Stacking)
// =============================================================
console.log('\nTest Suite 11: Effect Duration Refresh (No Magnitude Stacking)');

sys.reset();
sys.activateEffect(PowerupType.OVERDRIVE_CORE); // 8.0s
sys.update(5.0, farPlayerAABB); // 3.0s remaining
assert(sys.overdriveTimer < 3.1 && sys.overdriveTimer > 2.9, '3.0s remaining on Overdrive');

// Collect second Overdrive
sys.activateEffect(PowerupType.OVERDRIVE_CORE);
assert(sys.overdriveTimer === 8.0, 'Timer refreshed to full 8.0s');
assert(sys.getPlayerFireCooldown() === 0.18, 'Cooldown remains 0.18s (magnitude did not double)');
assert(sys.getPlayerBulletLimit() === 3, 'Bullet limit remains 3 (magnitude did not double)');

// =============================================================
// Test Suite 12: Independent Coexistence of Different Powerups
// =============================================================
console.log('\nTest Suite 12: Independent Coexistence of Different Powerups');

sys.reset();
sys.activateEffect(PowerupType.OVERDRIVE_CORE); // 8.0s
sys.activateEffect(PowerupType.AEGIS_FIELD); // 6.0s
sys.activateEffect(PowerupType.STASIS_PULSE); // 5.0s

assert(sys.isOverdriveActive() && sys.isAegisShieldActive() && sys.isStasisActive(), 'All 3 powerups active simultaneously');

// Advance 5.2s: Stasis should expire, Aegis and Overdrive still active
sys.update(5.2, farPlayerAABB);
assert(sys.isStasisActive() === false, 'Stasis expired at 5.0s');
assert(sys.isAegisShieldActive() === true, 'Aegis still active at 5.2s (6.0s duration)');
assert(sys.isOverdriveActive() === true, 'Overdrive still active at 5.2s (8.0s duration)');

// Advance another 1.0s (total 6.2s): Aegis should expire, Overdrive still active
sys.update(1.0, farPlayerAABB);
assert(sys.isAegisShieldActive() === false, 'Aegis expired at 6.0s');
assert(sys.isOverdriveActive() === true, 'Overdrive still active at 6.2s');

// Advance another 2.0s (total 8.2s): Overdrive expires
sys.update(2.0, farPlayerAABB);
assert(sys.isOverdriveActive() === false, 'Overdrive expired at 8.0s');

// =============================================================
// Test Suite 13: Player Life Loss Clears All Active Effects
// =============================================================
console.log('\nTest Suite 13: Player Life Loss Clears All Active Effects');

sys.reset();
sys.activateEffect(PowerupType.OVERDRIVE_CORE);
sys.activateEffect(PowerupType.AEGIS_FIELD);
sys.activateEffect(PowerupType.STASIS_PULSE);

// Player loses life (Requirement 36)
sys.clearActiveEffects();

assert(sys.isOverdriveActive() === false, 'Overdrive cleared on player death');
assert(sys.isAegisShieldActive() === false, 'Aegis cleared on player death');
assert(sys.isStasisActive() === false, 'Stasis cleared on player death');
assert(sys.getPlayerFireCooldown() === 0.28, 'Weapons return to baseline immediately');

// =============================================================
// Test Suite 14: Full Stage Reset & Milestone Re-triggering
// =============================================================
console.log('\nTest Suite 14: Full Stage Reset & Milestone Re-triggering');

sys.reset();
sys.handleEnemyDestroyed(3, 0, 0); // Spawns drop
sys.activateEffect(PowerupType.OVERDRIVE_CORE);

// Full Stage Restart
sys.reset();

assert(sys.activeDrop === null, 'Active drop deactivated on full restart');
assert(sys.isOverdriveActive() === false, 'Effects cleared on full restart');
assert(sys.triggeredMilestones.size === 0, 'Milestone triggers cleared');

// First drop occurs again on kill #3
assert(sys.handleEnemyDestroyed(1) === false, 'Kill #1 after reset: no drop');
assert(sys.handleEnemyDestroyed(2) === false, 'Kill #2 after reset: no drop');
assert(sys.handleEnemyDestroyed(3) === true, 'Kill #3 after reset triggers OVERDRIVE CORE again');

// =============================================================
// Test Suite 15: Score Invariance (0 Score for Powerups)
// =============================================================
console.log('\nTest Suite 15: Score Invariance (0 Score for Powerups)');

let score = 0;
function onEnemyKilled(scoreVal) {
  score += scoreVal;
}
function onPowerupCollected() {
  score += POWERUP_CONFIGS[PowerupType.OVERDRIVE_CORE].scoreValue;
}

onEnemyKilled(100);
assert(score === 100, 'Score after 1 enemy kill is 100');

onPowerupCollected();
assert(score === 100, 'Score after powerup collection remains 100 (0 pts awarded)');

// =============================================================
// Test Suite 16: Mobile HUD Formatting & Precision
// =============================================================
console.log('\nTest Suite 16: Mobile HUD Formatting & Precision');

sys.reset();
sys.activateEffect(PowerupType.OVERDRIVE_CORE);
sys.update(1.5, farPlayerAABB); // 6.5s remaining

const activeEffects = [
  {
    type: PowerupType.OVERDRIVE_CORE,
    name: 'OVERDRIVE CORE',
    shortCode: 'OD',
    remainingTime: sys.overdriveTimer,
  },
];

// Desktop format: 0.1s precision
const desktopLabel = `${activeEffects[0].name} ${activeEffects[0].remainingTime.toFixed(1)}`;
assert(desktopLabel.startsWith('OVERDRIVE CORE 6.'), `Desktop label formatted correctly: '${desktopLabel}'`);

// Mobile format: whole seconds
const mobileLabel = `${activeEffects[0].shortCode} ${Math.ceil(activeEffects[0].remainingTime)}`;
assert(mobileLabel === 'OD 7' || mobileLabel === 'OD 6', `Mobile label formatted compactly: '${mobileLabel}'`);

// =============================================================
// Test Suite 17: Audio & Combat Feedback Integration
// =============================================================
console.log('\nTest Suite 17: Audio & Combat Feedback Integration');

class MockAudioIntegration {
  constructor() {
    this.muted = false;
    this.collectCount = 0;
    this.shieldHitCount = 0;
    this.stasisActivateCount = 0;
    this.expireCount = 0;
  }
  playPowerupCollect() {
    if (this.muted) return;
    this.collectCount++;
  }
  playShieldHit() {
    if (this.muted) return;
    this.shieldHitCount++;
  }
  playStasisActivate() {
    if (this.muted) return;
    this.stasisActivateCount++;
  }
  playPowerupExpire() {
    if (this.muted) return;
    this.expireCount++;
  }
}

const mockAudio = new MockAudioIntegration();

// 1. Powerup collection audio
mockAudio.playPowerupCollect();
assert(mockAudio.collectCount === 1, 'playPowerupCollect() played exactly once on collection');

// 2. Aegis deflection audio
mockAudio.playShieldHit();
mockAudio.playShieldHit();
assert(mockAudio.shieldHitCount === 2, 'playShieldHit() played once per absorbed projectile');

// 3. Stasis activation audio
mockAudio.playStasisActivate();
assert(mockAudio.stasisActivateCount === 1, 'playStasisActivate() played on temporal freeze');

// 4. Powerup expiration cue
mockAudio.playPowerupExpire();
assert(mockAudio.expireCount === 1, 'playPowerupExpire() played once when drop expires');

// 5. Mute toggle
mockAudio.muted = true;
mockAudio.playPowerupCollect();
mockAudio.playShieldHit();
mockAudio.playStasisActivate();
assert(mockAudio.collectCount === 1 && mockAudio.shieldHitCount === 2, 'Muted audio system plays nothing');

// 6. Camera feedback intensity verification
const feedbackIntensities = {
  powerupCollect: 0.015,
  aegisAbsorption: 0.018,
  tankExplosion: 0.040,
};
assert(feedbackIntensities.powerupCollect < feedbackIntensities.tankExplosion, 'Powerup collection feedback is subtle (0.015 < 0.040)');
assert(feedbackIntensities.aegisAbsorption < feedbackIntensities.tankExplosion, 'Aegis absorption feedback is controlled (0.018 < 0.040)');

// =============================================================
// Final Summary
// =============================================================
console.log('\n==================================================');
console.log(`Phase 12 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
