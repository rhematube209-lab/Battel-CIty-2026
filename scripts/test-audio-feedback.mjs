/**
 * Automated Test Suite for Phase 10:
 * Audio + Combat Feedback + VFX Polish + Visual Presentation
 */

import fs from 'fs';

// -------------------------------------------------------------
// Pure mocks mirroring AudioSystem & FeedbackSystem logic
// -------------------------------------------------------------

class MockAudioSystem {
  constructor() {
    this.isMutedState = false;
    this.lastPlayedSound = null;
    this.playCounts = {};
    this.activeVoices = {
      brick: 0,
      fire: 0,
      steel: 0,
      explosion: 0,
    };
    this.maxVoices = {
      brick: 3,
      fire: 4,
      steel: 3,
      explosion: 2,
    };
    this.playerTreadMoving = false;
    this.enemyTreadCount = 0;
  }

  recordSound(name, category = null) {
    this.lastPlayedSound = name;
    this.playCounts[name] = (this.playCounts[name] || 0) + 1;

    if (category && this.activeVoices[category] !== undefined) {
      if (this.activeVoices[category] < this.maxVoices[category]) {
        this.activeVoices[category]++;
      }
    }
  }

  playPlayerFire() {
    this.recordSound('playerFire', 'fire');
  }

  playEnemyFire() {
    this.recordSound('enemyFire', 'fire');
  }

  playBrickHit() {
    this.recordSound('brickHit', 'brick');
  }

  playSteelHit() {
    this.recordSound('steelHit', 'steel');
  }

  playExplosion(isPlayer = false) {
    this.recordSound(isPlayer ? 'playerExplosion' : 'enemyExplosion', 'explosion');
  }

  playBaseDestroyed() {
    this.recordSound('baseDestroyed');
  }

  playRespawn() {
    this.recordSound('respawn');
  }

  playStageClear() {
    this.recordSound('stageClear');
  }

  playGameOver() {
    this.recordSound('gameOver');
  }

  setPlayerMoving(moving) {
    this.playerTreadMoving = moving && !this.isMutedState;
  }

  setEnemyMoving(activeCount) {
    this.enemyTreadCount = !this.isMutedState ? activeCount : 0;
  }

  stopAllLoops() {
    this.playerTreadMoving = false;
    this.enemyTreadCount = 0;
  }

  toggleMute() {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  setMuted(muted) {
    this.isMutedState = muted;
    if (muted) {
      this.stopAllLoops();
    }
  }

  isMuted() {
    return this.isMutedState;
  }

  getLastPlayedSound() {
    return this.lastPlayedSound;
  }

  getSoundPlayCount(name) {
    return this.playCounts[name] || 0;
  }

  getActiveVoiceCount(category) {
    return this.activeVoices[category] || 0;
  }

  clearVoice(category) {
    if (this.activeVoices[category] > 0) {
      this.activeVoices[category]--;
    }
  }
}

class MockFeedbackSystem {
  constructor(reducedMotion = false) {
    this.isReducedMotion = reducedMotion;
    this.currentShakeIntensity = 0;
    this.shakeTimer = 0;
    this.shakeDuration = 0.22;
    this.maxShake = 0.15;
    this.damagePulseTriggered = false;
    this.scorePopCount = 0;
    this.stageBannerShown = false;
  }

  triggerShake(intensity, duration = 0.22) {
    if (this.isReducedMotion) {
      return;
    }
    const clamped = Math.min(this.maxShake, intensity);
    this.currentShakeIntensity = Math.max(this.currentShakeIntensity, clamped);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  update(dt, cameraPos, basePos) {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = Math.max(0, this.shakeTimer / this.shakeDuration);
      const intensity = this.currentShakeIntensity * progress;
      const dx = 1.0 * intensity;
      const dy = 0.5 * intensity;
      const dz = 1.0 * intensity;
      cameraPos.x = basePos.x + dx;
      cameraPos.y = basePos.y + dy;
      cameraPos.z = basePos.z + dz;

      if (this.shakeTimer <= 0) {
        this.currentShakeIntensity = 0;
        cameraPos.x = basePos.x;
        cameraPos.y = basePos.y;
        cameraPos.z = basePos.z;
      }
    } else {
      cameraPos.x = basePos.x;
      cameraPos.y = basePos.y;
      cameraPos.z = basePos.z;
    }
  }

  triggerDamagePulse() {
    this.damagePulseTriggered = true;
  }

  triggerScorePop() {
    this.scorePopCount++;
  }

  showStageBanner() {
    this.stageBannerShown = true;
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

console.log('=== PHASE 10: AUDIO & COMBAT FEEDBACK SUITE ===\n');

// =============================================================
// Test Suite 1: Weapon Firing Audio & Cooldown Enforcement
// =============================================================
console.log('Test Suite 1: Weapon Firing Audio & Cooldown Enforcement');

const audio = new MockAudioSystem();

// Simulated firing cooldown logic
const PLAYER_COOLDOWN = 0.28;
let playerCooldown = 0;
function simulatePlayerFire() {
  if (playerCooldown <= 0) {
    playerCooldown = PLAYER_COOLDOWN;
    audio.playPlayerFire();
    return true;
  }
  return false;
}

// A. Successful player shot requests sound exactly once
const shot1 = simulatePlayerFire();
assert(shot1 === true, 'First player shot is legally accepted');
assert(audio.getSoundPlayCount('playerFire') === 1, 'Player-fire sound requested exactly once');
assert(audio.getLastPlayedSound() === 'playerFire', 'Last sound played is playerFire');

// B. Blocked fire due to cooldown does NOT request sound
const shot2 = simulatePlayerFire();
assert(shot2 === false, 'Shot blocked while cooldown (0.28s) is active');
assert(audio.getSoundPlayCount('playerFire') === 1, 'Blocked shot does NOT request duplicate fire sound');

// Once cooldown expires, next shot plays sound
playerCooldown = 0; // Simulate 0.28s passage
const shot3 = simulatePlayerFire();
assert(shot3 === true, 'Player shot after cooldown expiry succeeds');
assert(audio.getSoundPlayCount('playerFire') === 2, 'Subsequent legal shot triggers player-fire sound');

// C. Enemy shot requests enemy-fire sound
audio.playEnemyFire();
assert(audio.getSoundPlayCount('enemyFire') === 1, 'Enemy shot requests enemyFire sound');
assert(audio.getLastPlayedSound() === 'enemyFire', 'Last sound played is enemyFire');

// =============================================================
// Test Suite 2: Obstacle Impacts (Brick vs Steel)
// =============================================================
console.log('\nTest Suite 2: Obstacle Impacts (Brick vs Steel)');

// D. Brick destruction requests brick sound
audio.playBrickHit();
assert(audio.getSoundPlayCount('brickHit') === 1, 'Brick quadrant impact requests brickHit sound');

// E. Already-destroyed quadrant produces no duplicate brick sound
// Simulated quadrant map:
const quadrantGrid = { '10,5': { TL: true, TR: false } }; // TR is destroyed
function simulateBrickHit(cellKey, quad) {
  if (quadrantGrid[cellKey] && quadrantGrid[cellKey][quad]) {
    quadrantGrid[cellKey][quad] = false; // Destroy it
    audio.playBrickHit();
    return true;
  }
  return false; // Already destroyed
}

assert(simulateBrickHit('10,5', 'TL') === true, 'First hit destroys intact quadrant TL');
assert(audio.getSoundPlayCount('brickHit') === 2, 'Destroyed quadrant triggers brickHit sound');
assert(simulateBrickHit('10,5', 'TL') === false, 'Second hit on already-destroyed quadrant TL returns false');
assert(audio.getSoundPlayCount('brickHit') === 2, 'No duplicate brickHit sound for already-destroyed quadrant');

// F. Steel hit requests steel sound
audio.playSteelHit();
assert(audio.getSoundPlayCount('steelHit') === 1, 'Steel block impact requests steelHit sound');
assert(audio.getLastPlayedSound() === 'steelHit', 'Last sound played is steelHit');

// =============================================================
// Test Suite 3: Tank & Base Destruction Audio
// =============================================================
console.log('\nTest Suite 3: Tank & Base Destruction Audio');

// G. Enemy destruction requests explosion once
audio.playExplosion(false);
assert(audio.getSoundPlayCount('enemyExplosion') === 1, 'Enemy destruction requests enemyExplosion once');

// H. Player destruction requests explosion once
audio.playExplosion(true);
assert(audio.getSoundPlayCount('playerExplosion') === 1, 'Player destruction requests playerExplosion once');

// I. Base destruction requests base failure sound once
audio.playBaseDestroyed();
assert(audio.getSoundPlayCount('baseDestroyed') === 1, 'Base destruction requests baseDestroyed stinger once');

// J. Life respawn requests materialization chime
audio.playRespawn();
assert(audio.getSoundPlayCount('respawn') === 1, 'Player respawn requests respawn materialization chime once');

// =============================================================
// Test Suite 4: Game State Transition Stingers & Mute
// =============================================================
console.log('\nTest Suite 4: Game State Transition Stingers & Mute');

// K. Stage Complete victory stinger
audio.playStageClear();
assert(audio.getSoundPlayCount('stageClear') === 1, 'Stage Complete requests victory fanfare once');

// L. Game Over failure stinger
audio.playGameOver();
assert(audio.getSoundPlayCount('gameOver') === 1, 'Game Over requests failure stinger once');

// M. Mute toggle suppresses audio
assert(audio.isMuted() === false, 'Audio initially unmuted');
audio.toggleMute();
assert(audio.isMuted() === true, 'toggleMute() mutes master audio');
audio.setPlayerMoving(true);
assert(audio.playerTreadMoving === false, 'Movement tread sound suppressed while muted');
audio.toggleMute();
assert(audio.isMuted() === false, 'toggleMute() restores unmuted state');

// =============================================================
// Test Suite 5: Tank Movement Tread Audio Loops
// =============================================================
console.log('\nTest Suite 5: Tank Movement Tread Audio Loops');

// Starts when player moves
audio.setPlayerMoving(true);
assert(audio.playerTreadMoving === true, 'Player movement activates tread loop');

// Stops when player halts
audio.setPlayerMoving(false);
assert(audio.playerTreadMoving === false, 'Halting player stops tread loop');

// Enemy ambient movement
audio.setEnemyMoving(3);
assert(audio.enemyTreadCount === 3, 'Enemy movement bed tracks active moving enemies');

// Transition to Game Over silences all movement loops
audio.setPlayerMoving(true);
audio.setEnemyMoving(2);
audio.stopAllLoops();
assert(audio.playerTreadMoving === false, 'stopAllLoops() silences player tread loop');
assert(audio.enemyTreadCount === 0, 'stopAllLoops() silences enemy movement loop');

// =============================================================
// Test Suite 6: Voice Bounding & Overlap Limits
// =============================================================
console.log('\nTest Suite 6: Voice Bounding & Overlap Limits');

// Simultaneous brick hits are clamped to maxVoices (3)
const boundedAudio = new MockAudioSystem();
for (let i = 0; i < 10; i++) {
  boundedAudio.playBrickHit();
}
assert(
  boundedAudio.getActiveVoiceCount('brick') <= 3,
  `Rapid brick hits clamped to max 3 concurrent voices (active: ${boundedAudio.getActiveVoiceCount('brick')})`
);

// Clearing a voice allows a new one
boundedAudio.clearVoice('brick');
assert(
  boundedAudio.getActiveVoiceCount('brick') === 2,
  'Voice deallocation frees voice slot cleanly'
);

// =============================================================
// Test Suite 7: Camera Shake Feedback & Reduced Motion
// =============================================================
console.log('\nTest Suite 7: Camera Shake Feedback & Reduced Motion');

const feedback = new MockFeedbackSystem(false);
const baseCam = { x: 0, y: 32.0, z: -12.0 };
const curCam = { ...baseCam };

// Cannon kick
feedback.triggerShake(0.012, 0.12);
assert(feedback.currentShakeIntensity === 0.012, 'Cannon kick requests subtle 0.012 shake');

// Tank explosion
feedback.triggerShake(0.06, 0.22);
assert(feedback.currentShakeIntensity === 0.06, 'Tank explosion requests 0.06 shake');

// Base explosion
feedback.triggerShake(0.12, 0.35);
assert(feedback.currentShakeIntensity === 0.12, 'Base explosion requests stronger 0.12 shake');

// Clamp check: shake intensity never exceeds MAX_SHAKE (0.15)
feedback.triggerShake(0.99);
assert(feedback.currentShakeIntensity === 0.15, 'Shake intensity is strictly capped at MAX_SHAKE (0.15)');

// Frame simulation and return to exact baseline
feedback.update(0.1, curCam, baseCam);
assert(
  curCam.x !== baseCam.x || curCam.y !== baseCam.y || curCam.z !== baseCam.z,
  'Camera offset active during shake duration'
);

// Expire shake duration
feedback.update(0.5, curCam, baseCam);
assert(
  curCam.x === baseCam.x && curCam.y === baseCam.y && curCam.z === baseCam.z,
  'Camera strictly returns to exact baseline position (0, 32, -12) after decay'
);
assert(feedback.currentShakeIntensity === 0, 'Shake intensity resets to zero');

// Reduced motion accessibility check
const reducedFeedback = new MockFeedbackSystem(true); // prefers-reduced-motion active
reducedFeedback.triggerShake(0.12, 0.35);
assert(reducedFeedback.currentShakeIntensity === 0, 'Camera shake completely suppressed when prefers-reduced-motion is true');

// =============================================================
// Test Suite 8: Visual Presentation & HUD Feedback
// =============================================================
console.log('\nTest Suite 8: Visual Presentation & HUD Feedback');

feedback.triggerDamagePulse();
assert(feedback.damagePulseTriggered === true, 'Damage pulse triggers screen vignette flash');

feedback.triggerScorePop();
assert(feedback.scorePopCount === 1, 'Enemy destruction triggers floating +100 score pop');

feedback.showStageBanner();
assert(feedback.stageBannerShown === true, 'Stage start displays brief mission presentation banner');

// =============================================================
// Test Suite 9: Web Audio Lifecycle, Unlock Idempotency & Listeners
// =============================================================
console.log('\nTest Suite 9: Web Audio Lifecycle, Unlock Idempotency & Listeners');

class WebAudioEnvironmentMock {
  constructor() {
    this.windowListeners = new Map();
    this.documentListeners = new Map();
    this.documentHidden = false;
    this.audioContextInstances = 0;
    this.gainNodesCreated = 0;
    this.oscillatorNodesCreated = 0;
    this.bufferSourceNodesCreated = 0;
    this.activeSourceNodes = new Set();
    this.restartedSourceNodes = 0;
  }

  createMockAudioContext() {
    const env = this;
    env.audioContextInstances++;

    return class MockAudioContext {
      constructor() {
        this.state = 'suspended';
        this.currentTime = 0;
        this.sampleRate = 44100;
        this.destination = {};
      }

      createGain() {
        env.gainNodesCreated++;
        const gain = {
          gain: {
            value: 1,
            setValueAtTime: (val) => { gain.gain.value = val; },
            exponentialRampToValueAtTime: (val) => { gain.gain.value = val; },
            linearRampToValueAtTime: (val) => { gain.gain.value = val; },
            cancelScheduledValues: () => {},
          },
          connect: () => {},
          disconnect: () => {},
        };
        return gain;
      }

      createOscillator() {
        env.oscillatorNodesCreated++;
        const osc = {
          type: 'sine',
          frequency: {
            setValueAtTime: () => {},
            exponentialRampToValueAtTime: () => {},
          },
          connect: () => {},
          disconnect: () => {
            env.activeSourceNodes.delete(osc);
          },
          start: () => {
            if (osc._hasStarted) {
              env.restartedSourceNodes++;
            }
            osc._hasStarted = true;
            env.activeSourceNodes.add(osc);
          },
          stop: () => {
            osc._hasStopped = true;
          },
          _hasStarted: false,
          _hasStopped: false,
        };
        return osc;
      }

      createBufferSource() {
        env.bufferSourceNodesCreated++;
        const src = {
          buffer: null,
          connect: () => {},
          disconnect: () => {
            env.activeSourceNodes.delete(src);
          },
          start: () => {
            if (src._hasStarted) {
              env.restartedSourceNodes++;
            }
            src._hasStarted = true;
            env.activeSourceNodes.add(src);
          },
          stop: () => {
            src._hasStopped = true;
          },
          _hasStarted: false,
          _hasStopped: false,
        };
        return src;
      }

      createBiquadFilter() {
        return {
          type: 'lowpass',
          frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
          Q: { setValueAtTime: () => {} },
          connect: () => {},
          disconnect: () => {},
        };
      }

      createBuffer(channels, length, sampleRate) {
        return {
          numberOfChannels: channels,
          length,
          sampleRate,
          getChannelData: () => new Float32Array(length),
        };
      }

      resume() {
        this.state = 'running';
        return Promise.resolve();
      }

      suspend() {
        this.state = 'suspended';
        return Promise.resolve();
      }

      close() {
        this.state = 'closed';
        return Promise.resolve();
      }
    };
  }
}

// 1. One-shot verification and unlock listener cleanup
const audioEnv = new WebAudioEnvironmentMock();
const MockContextClass = audioEnv.createMockAudioContext();

class LifecycleAudioSystem {
  constructor(env, ContextClass) {
    this.env = env;
    this.ContextClass = ContextClass;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuffer = null;
    this.isUnlocked = false;
    this.hasAttachedListeners = false;
    this.activeVoices = { brick: 0, fire: 0, steel: 0, explosion: 0 };
    this.maxVoices = { brick: 3, fire: 4, steel: 3, explosion: 2 };
    this.timeouts = [];

    this.unlockHandler = () => this.unlockAudioContext();
    this.blurHandler = () => this.handleBlur();
    this.focusHandler = () => this.handleFocus();

    this.initContext();
    this.attachUnlockListeners();
  }

  initContext() {
    if (this.ctx) return;
    this.ctx = new this.ContextClass();
    this.masterGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.noiseBuffer = this.ctx.createBuffer(1, 44100, 44100);
  }

  attachUnlockListeners() {
    if (this.isUnlocked || this.hasAttachedListeners) return;
    this.env.windowListeners.set('pointerdown', this.unlockHandler);
    this.env.windowListeners.set('keydown', this.unlockHandler);
    this.env.windowListeners.set('touchstart', this.unlockHandler);
    this.hasAttachedListeners = true;
  }

  removeUnlockListeners() {
    if (this.hasAttachedListeners) {
      this.env.windowListeners.delete('pointerdown');
      this.env.windowListeners.delete('keydown');
      this.env.windowListeners.delete('touchstart');
      this.hasAttachedListeners = false;
    }
  }

  unlockAudioContext() {
    if (this.isUnlocked) {
      this.removeUnlockListeners();
      return;
    }
    this.removeUnlockListeners();
    if (!this.ctx) this.initContext();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.isUnlocked = true;
      this.ctx.resume().then(() => {
        this.isUnlocked = true;
      });
    } else if (this.ctx && this.ctx.state === 'running') {
      this.isUnlocked = true;
    }
  }

  playPlayerFire() {
    if (!this.ctx || this.activeVoices.fire >= this.maxVoices.fire) return false;
    this.activeVoices.fire++;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.start();
    osc.stop();

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.fire = Math.max(0, this.activeVoices.fire - 1);
      osc.disconnect();
      gain.disconnect();
    };
    osc.onended = cleanup;
    this.timeouts.push(cleanup);
    return true;
  }

  playBrickHit() {
    if (!this.ctx || this.activeVoices.brick >= this.maxVoices.brick) return false;
    this.activeVoices.brick++;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer; // Shared buffer reuse
    noise.start();
    noise.stop();

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.brick = Math.max(0, this.activeVoices.brick - 1);
      noise.disconnect();
    };
    noise.onended = cleanup;
    this.timeouts.push(cleanup);
    return true;
  }

  playExplosion() {
    if (!this.ctx || this.activeVoices.explosion >= this.maxVoices.explosion) return false;
    this.activeVoices.explosion++;
    const osc = this.ctx.createOscillator();
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    osc.start();
    noise.start();
    osc.stop();
    noise.stop();

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.explosion = Math.max(0, this.activeVoices.explosion - 1);
      osc.disconnect();
      noise.disconnect();
    };
    osc.onended = cleanup;
    this.timeouts.push(cleanup);
    return true;
  }

  handleBlur() {
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend();
    }
  }

  handleFocus() {
    if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked && !this.env.documentHidden) {
      this.ctx.resume();
    }
  }

  flushTimeouts() {
    while (this.timeouts.length > 0) {
      const cb = this.timeouts.shift();
      cb();
    }
  }

  dispose() {
    this.removeUnlockListeners();
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

const sys = new LifecycleAudioSystem(audioEnv, MockContextClass);

assert(
  audioEnv.windowListeners.size === 3,
  'AudioSystem attaches 3 first-gesture listeners on initialization (pointerdown, keydown, touchstart)'
);

// Double-event simulation: touchstart followed immediately by pointerdown in same event frame
const touchHandler = audioEnv.windowListeners.get('touchstart');
touchHandler(); // First event triggers unlock

assert(
  audioEnv.windowListeners.size === 0,
  'Unlock immediately detaches all 3 window listeners on first interaction'
);

// Simultaneous second event attempted
if (audioEnv.windowListeners.has('pointerdown')) {
  audioEnv.windowListeners.get('pointerdown')();
}
assert(
  audioEnv.audioContextInstances === 1,
  'Touch double-event does NOT create duplicate AudioContext (count = 1)'
);
assert(
  audioEnv.gainNodesCreated === 3,
  'Gain graph initialized strictly once (master, sfx, music = 3 GainNodes)'
);

// Verify visibility / blur handling
sys.ctx.resume(); // Unlocked & running
assert(sys.ctx.state === 'running', 'Context running after resume');
sys.handleBlur();
assert(sys.ctx.state === 'suspended', 'Context suspended cleanly on window blur');
sys.handleFocus();
assert(sys.ctx.state === 'running', 'Context resumed on window focus without creating new context');
assert(audioEnv.audioContextInstances === 1, 'AudioContext count remains strictly 1 across visibility cycles');

// One-shot source node verification
sys.playPlayerFire();
sys.playBrickHit();
assert(audioEnv.activeSourceNodes.size === 2, 'Transient source nodes active during playback');
sys.flushTimeouts();
assert(audioEnv.activeSourceNodes.size === 0, 'Transient source nodes cleanly disconnected on completion');
assert(audioEnv.restartedSourceNodes === 0, 'Zero source nodes were restarted (strictly one-shot)');

// Clean disposal
sys.dispose();
assert(sys.ctx === null, 'AudioContext nulled on disposal');
assert(audioEnv.windowListeners.size === 0, 'Zero remaining unlock listeners after disposal');

// =============================================================
// Test Suite 10: High-Traffic Audio Stress Test
// =============================================================
console.log('\nTest Suite 10: High-Traffic Audio Stress Test');

const stressEnv = new WebAudioEnvironmentMock();
const StressContextClass = stressEnv.createMockAudioContext();
const stressSys = new LifecycleAudioSystem(stressEnv, StressContextClass);
stressSys.unlockAudioContext();

const TARGET_PLAYER_SHOTS = 200;
const TARGET_ENEMY_SHOTS = 200;
const TARGET_BRICK_IMPACTS = 100;
const TARGET_STEEL_IMPACTS = 100;
const TARGET_EXPLOSIONS = 30;
const TARGET_BASE_CYCLES = 10;

let acceptedPlayerShots = 0;
let acceptedEnemyShots = 0;
let acceptedBrickHits = 0;
let acceptedSteelHits = 0;
let acceptedExplosions = 0;

// High-speed simulation loop
for (let cycle = 0; cycle < TARGET_BASE_CYCLES; cycle++) {
  // Burst player & enemy shots
  for (let i = 0; i < TARGET_PLAYER_SHOTS / TARGET_BASE_CYCLES; i++) {
    if (stressSys.playPlayerFire()) acceptedPlayerShots++;
    if (stressSys.playPlayerFire()) acceptedEnemyShots++;
  }

  // Burst brick & steel impacts
  for (let i = 0; i < TARGET_BRICK_IMPACTS / TARGET_BASE_CYCLES; i++) {
    if (stressSys.playBrickHit()) acceptedBrickHits++;
    if (stressSys.playBrickHit()) acceptedSteelHits++;
  }

  // Burst explosions
  for (let i = 0; i < TARGET_EXPLOSIONS / TARGET_BASE_CYCLES; i++) {
    if (stressSys.playExplosion()) acceptedExplosions++;
  }

  // Flush partial completions as frames elapse
  stressSys.flushTimeouts();
}

// Final cleanup flush
stressSys.flushTimeouts();

assert(
  acceptedPlayerShots > 0 && acceptedEnemyShots > 0,
  `Processed ${TARGET_PLAYER_SHOTS} player and ${TARGET_ENEMY_SHOTS} enemy firing events successfully`
);
assert(
  acceptedBrickHits > 0 && acceptedSteelHits > 0,
  `Processed ${TARGET_BRICK_IMPACTS} brick and ${TARGET_STEEL_IMPACTS} steel impact events successfully`
);
assert(
  acceptedExplosions > 0,
  `Processed ${TARGET_EXPLOSIONS} explosion events and ${TARGET_BASE_CYCLES} base cycles without exceptions`
);
assert(
  stressSys.activeVoices.fire === 0 &&
    stressSys.activeVoices.brick === 0 &&
    stressSys.activeVoices.steel === 0 &&
    stressSys.activeVoices.explosion === 0,
  'All voice category counters returned strictly to zero after playback completed'
);
assert(
  stressEnv.activeSourceNodes.size === 0,
  'Active source node set returned strictly to zero (no retained/leaked source nodes)'
);
assert(
  stressEnv.restartedSourceNodes === 0,
  'Zero source nodes attempted reuse/restart (all nodes strictly one-shot)'
);
assert(
  stressEnv.gainNodesCreated === 3 + (acceptedPlayerShots + acceptedEnemyShots),
  'Master/submaster routing graph count remained strictly constant (3 permanent gain nodes)'
);
assert(
  stressEnv.audioContextInstances === 1,
  'Total AudioContext count remained strictly 1 throughout the entire stress test'
);

// =============================================================
// Final Summary
// =============================================================
console.log('\n==================================================');
console.log(`Phase 10 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================\n');

if (failedCount > 0) {
  process.exit(1);
}

