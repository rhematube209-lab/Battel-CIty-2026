/**
 * Battle City 2026 Original Web Audio System.
 * Generates an original futuristic arcade sound identity procedurally
 * using the native browser Web Audio API (zero external asset downloads).
 * Handles mobile audio unlock, volume hierarchy, bounded voices, and graceful degradation.
 *
 * NOTE: Transient Web Audio source nodes (OscillatorNode, AudioBufferSourceNode)
 * are strictly treated as ONE-SHOT objects created per accepted sound event and
 * immediately disconnected on completion. Only the shared noise PCM AudioBuffer
 * and master/submaster GainNodes are persistent.
 */

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private isMutedState: boolean = false;
  private masterVolume: number = 0.8;
  private sfxVolume: number = 1.0;
  private musicVolume: number = 0.35;

  // Cached shared noise PCM buffer for procedural explosions, impacts, and debris
  private noiseBuffer: AudioBuffer | null = null;

  // Persistent movement tread loop nodes (continuous running oscillators modulated via gain ramps)
  private playerTreadOsc: OscillatorNode | null = null;
  private playerTreadGain: GainNode | null = null;
  private playerTreadLfo: OscillatorNode | null = null;
  private isPlayerTreadActive: boolean = false;

  // Enemy movement background bed
  private enemyTreadOsc: OscillatorNode | null = null;
  private enemyTreadGain: GainNode | null = null;

  // Voice bounding to prevent audio stacking on rapid events
  private activeVoices: { [category: string]: number } = {
    brick: 0,
    fire: 0,
    steel: 0,
    explosion: 0,
    powerup: 0,
    cryo: 0,
    conveyor: 0,
  };
  private maxVoices: { [category: string]: number } = {
    brick: 3,
    fire: 4,
    steel: 3,
    explosion: 2,
    powerup: 3,
    cryo: 2,
    conveyor: 2,
  };

  // Telemetry for testing and diagnostics
  private lastPlayedSound: string | null = null;
  private playCounts: { [key: string]: number } = {};

  // Active campaign complete fanfare oscillators for lifecycle bounding
  private campaignOscillators: OscillatorNode[] = [];

  // Unlock and visibility handlers
  private unlockHandler: () => void;
  private visibilityHandler: () => void;
  private blurHandler: () => void;
  private focusHandler: () => void;

  private isUnlocked: boolean = false;
  private isUnlocking: boolean = false;
  private hasAttachedListeners: boolean = false;

  constructor() {
    this.unlockHandler = () => this.unlockAudioContext();
    this.visibilityHandler = () => this.handleVisibilityChange();
    this.blurHandler = () => this.handleBlur();
    this.focusHandler = () => this.handleFocus();

    this.initContext();

    if (typeof window !== 'undefined') {
      this.attachUnlockListeners();
      document.addEventListener('visibilitychange', this.visibilityHandler);
      window.addEventListener('blur', this.blurHandler);
      window.addEventListener('focus', this.focusHandler);
    }
  }

  /**
   * Initializes the AudioContext and persistent gain hierarchy.
   * Strictly idempotent: never re-initializes if ctx already exists.
   */
  private initContext(): void {
    if (typeof window === 'undefined') return;
    if (this.ctx) return; // Idempotent guard

    try {
      const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      this.ctx = new AudioContextClass();

      // Gain Hierarchy: SFX & Music -> Master -> Destination
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(this.sfxVolume, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicVolume, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Pre-generate 1-second white noise buffer for shared reuse
      this.createNoiseBuffer();

      // Initialize persistent tread loops
      this.initTreadLoops();

      if (this.ctx.state === 'running') {
        this.isUnlocked = true;
        this.removeUnlockListeners();
      }
    } catch {
      // Graceful fallback if Web Audio is restricted
      this.ctx = null;
    }
  }

  /**
   * Seamlessly unlocks AudioContext on first user interaction (mobile autoplay requirement).
   * Strictly idempotent: guards against simultaneous touchstart/pointerdown double-event triggers.
   */
  public unlockAudioContext(): void {
    if (this.isUnlocked) {
      this.removeUnlockListeners();
      return;
    }

    // Immediately detach unlock listeners on the very first gesture to prevent duplicate invocations
    this.removeUnlockListeners();

    if (!this.ctx) {
      this.initContext();
    }

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        if (this.isUnlocking) return;
        this.isUnlocking = true;
        this.isUnlocked = true;

        this.ctx
          .resume()
          .then(() => {
            this.isUnlocked = true;
            this.isUnlocking = false;
          })
          .catch(() => {
            this.isUnlocked = false;
            this.isUnlocking = false;
            // If browser blocked resume, re-attach listeners for the next user attempt
            if (!this.isUnlocked) {
              this.attachUnlockListeners();
            }
          });
      } else if (this.ctx.state === 'running') {
        this.isUnlocked = true;
        this.isUnlocking = false;
      }
    }
  }

  private attachUnlockListeners(): void {
    if (typeof window === 'undefined' || this.isUnlocked || this.hasAttachedListeners) return;
    window.addEventListener('pointerdown', this.unlockHandler, { passive: true });
    window.addEventListener('keydown', this.unlockHandler, { passive: true });
    window.addEventListener('touchstart', this.unlockHandler, { passive: true });
    this.hasAttachedListeners = true;
  }

  private removeUnlockListeners(): void {
    if (typeof window !== 'undefined' && this.hasAttachedListeners) {
      window.removeEventListener('pointerdown', this.unlockHandler);
      window.removeEventListener('keydown', this.unlockHandler);
      window.removeEventListener('touchstart', this.unlockHandler);
      this.hasAttachedListeners = false;
    }
  }

  /**
   * Creates a shared, reusable 1-second white noise PCM buffer for procedural SFX.
   */
  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const bufferSize = sampleRate; // 1 second
    this.noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
    const output = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
  }

  /**
   * Prepares persistent looping nodes for player and enemy engine/tread hum.
   */
  private initTreadLoops(): void {
    if (!this.ctx || !this.sfxGain) return;

    try {
      const now = this.ctx.currentTime;

      // Player tread motor: low oscillator with subtle LFO modulation
      this.playerTreadGain = this.ctx.createGain();
      this.playerTreadGain.gain.setValueAtTime(0, now);
      this.playerTreadGain.connect(this.sfxGain);

      this.playerTreadOsc = this.ctx.createOscillator();
      this.playerTreadOsc.type = 'triangle';
      this.playerTreadOsc.frequency.setValueAtTime(52, now);

      this.playerTreadLfo = this.ctx.createOscillator();
      this.playerTreadLfo.type = 'sine';
      this.playerTreadLfo.frequency.setValueAtTime(14, now);

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(12, now);
      this.playerTreadLfo.connect(lfoGain);
      lfoGain.connect(this.playerTreadOsc.frequency);

      this.playerTreadOsc.connect(this.playerTreadGain);
      this.playerTreadOsc.start();
      this.playerTreadLfo.start();

      // Enemy background mechanical bed
      this.enemyTreadGain = this.ctx.createGain();
      this.enemyTreadGain.gain.setValueAtTime(0, now);
      this.enemyTreadGain.connect(this.sfxGain);

      this.enemyTreadOsc = this.ctx.createOscillator();
      this.enemyTreadOsc.type = 'sawtooth';
      this.enemyTreadOsc.frequency.setValueAtTime(38, now);

      const enemyFilter = this.ctx.createBiquadFilter();
      enemyFilter.type = 'lowpass';
      enemyFilter.frequency.setValueAtTime(160, now);

      this.enemyTreadOsc.connect(enemyFilter);
      enemyFilter.connect(this.enemyTreadGain);
      this.enemyTreadOsc.start();
    } catch {
      // Non-critical if loops fail to initialize
    }
  }

  private recordTelemetry(name: string): void {
    this.lastPlayedSound = name;
    this.playCounts[name] = (this.playCounts[name] || 0) + 1;
  }

  // =============================================================
  // SOUND EFFECTS SET (Original Futuristic Arcade Identity)
  // All transient source nodes are ONE-SHOT objects
  // =============================================================

  /**
   * Player cannon fire: snappy mechanical transient + energy punch (0.12s).
   */
  public playPlayerFire(): void {
    this.recordTelemetry('playerFire');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.fire >= this.maxVoices.fire) return;

    this.activeVoices.fire++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(750, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.11);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.fire = Math.max(0, this.activeVoices.fire - 1);
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 140);
  }

  /**
   * Enemy cannon fire: darker, lower energy pulse (0.15s).
   */
  public playEnemyFire(): void {
    this.recordTelemetry('enemyFire');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.fire >= this.maxVoices.fire) return;

    this.activeVoices.fire++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(550, now);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.15);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.fire = Math.max(0, this.activeVoices.fire - 1);
      try { osc.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 170);
  }

  /**
   * Brick quadrant destruction: ceramic crack + short debris crunch (0.10s).
   */
  public playBrickHit(): void {
    this.recordTelemetry('brickHit');
    if (this.isMutedState || !this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    if (this.activeVoices.brick >= this.maxVoices.brick) return;

    this.activeVoices.brick++;
    const now = this.ctx.currentTime;

    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(620, now);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
    noise.stop(now + 0.10);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.brick = Math.max(0, this.activeVoices.brick - 1);
      try { noise.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    noise.onended = cleanup;
    setTimeout(cleanup, 120);
  }

  /**
   * Steel impact: metallic ping + reinforced ricochet click (0.14s).
   */
  public playSteelHit(): void {
    this.recordTelemetry('steelHit');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.steel >= this.maxVoices.steel) return;

    this.activeVoices.steel++;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1850, now);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(2600, now);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.14);
    osc2.stop(now + 0.14);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.steel = Math.max(0, this.activeVoices.steel - 1);
      try { osc1.disconnect(); } catch {}
      try { osc2.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc1.onended = cleanup;
    setTimeout(cleanup, 160);
  }

  /**
   * Armor impact: heavy reinforced plate thud + resonant metallic clank (0.15s).
   * Played when an ARMOR enemy survives a non-lethal shot.
   */
  public playArmorHit(): void {
    this.recordTelemetry('armorHit');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.steel >= this.maxVoices.steel) return;

    this.activeVoices.steel++;
    const now = this.ctx.currentTime;

    const thud = this.ctx.createOscillator();
    const clank = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    thud.type = 'triangle';
    thud.frequency.setValueAtTime(320, now);
    thud.frequency.exponentialRampToValueAtTime(80, now + 0.13);

    clank.type = 'square';
    clank.frequency.setValueAtTime(1150, now);
    clank.frequency.exponentialRampToValueAtTime(380, now + 0.12);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    thud.connect(gain);
    clank.connect(gain);
    gain.connect(this.sfxGain);

    thud.start(now);
    clank.start(now);
    thud.stop(now + 0.15);
    clank.stop(now + 0.15);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.steel = Math.max(0, this.activeVoices.steel - 1);
      try { thud.disconnect(); } catch {}
      try { clank.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    thud.onended = cleanup;
    setTimeout(cleanup, 170);
  }

  /**
   * Powerup collected: energetic harmonic rising sweep (440Hz -> 880Hz, 0.16s).
   */
  public playPowerupCollect(): void {
    this.recordTelemetry('powerupCollect');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.powerup >= this.maxVoices.powerup) return;

    this.activeVoices.powerup++;
    const now = this.ctx.currentTime;

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(660, now);
    osc2.frequency.exponentialRampToValueAtTime(1320, now + 0.15);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxGain);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.16);
    osc2.stop(now + 0.16);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.powerup = Math.max(0, this.activeVoices.powerup - 1);
      try { osc1.disconnect(); } catch {}
      try { osc2.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc1.onended = cleanup;
    setTimeout(cleanup, 180);
  }

  /**
   * Aegis energy shield hit: resonant crystalline deflection ping (1300Hz -> 650Hz, 0.12s).
   */
  public playShieldHit(): void {
    this.recordTelemetry('shieldHit');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.steel >= this.maxVoices.steel) return;

    this.activeVoices.steel++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const shimmer = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1300, now);
    osc.frequency.exponentialRampToValueAtTime(650, now + 0.11);

    shimmer.type = 'triangle';
    shimmer.frequency.setValueAtTime(2600, now);
    shimmer.frequency.exponentialRampToValueAtTime(1200, now + 0.10);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    shimmer.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    shimmer.start(now);
    osc.stop(now + 0.12);
    shimmer.stop(now + 0.12);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.steel = Math.max(0, this.activeVoices.steel - 1);
      try { osc.disconnect(); } catch {}
      try { shimmer.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 140);
  }

  /**
   * Stasis Pulse activated: deep temporal phase-lock pulse (220Hz -> 65Hz, 0.28s).
   */
  public playStasisActivate(): void {
    this.recordTelemetry('stasisActivate');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.powerup >= this.maxVoices.powerup) return;

    this.activeVoices.powerup++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.26);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(180, now + 0.26);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.28);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.powerup = Math.max(0, this.activeVoices.powerup - 1);
      try { osc.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 310);
  }

  /**
   * Cryo Floor enter: subtle cold metallic/electronic skid sound (~0.12s duration).
   */
  public playCryoEnter(): void {
    this.recordTelemetry('cryoEnter');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.cryo >= this.maxVoices.cryo) return;

    this.activeVoices.cryo++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(960, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.11);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(3.0, now);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.cryo = Math.max(0, this.activeVoices.cryo - 1);
      try { osc.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 150);
  }

  /**
   * Mag-Drive Conveyor enter: low magnetic hum / mechanical whir (~0.14s duration).
   */
  public playConveyorEnter(): void {
    this.recordTelemetry('conveyorEnter');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.conveyor >= this.maxVoices.conveyor) return;

    this.activeVoices.conveyor++;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.12);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, now);
    filter.Q.setValueAtTime(2.0, now);

    gain.gain.setValueAtTime(0.20, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.14);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.conveyor = Math.max(0, this.activeVoices.conveyor - 1);
      try { osc.disconnect(); } catch {}
      try { filter.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 160);
  }

  /**
   * Powerup expired or uncollected drop expired: gentle descending cue (0.12s).
   */
  public playPowerupExpire(): void {
    this.recordTelemetry('powerupExpire');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.11);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.12);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 140);
  }

  /**
   * Tank explosion: mechanical energy burst + low rumble + debris scatter (0.45s).
   */
  public playExplosion(isPlayer: boolean = false): void {
    this.recordTelemetry(isPlayer ? 'playerExplosion' : 'enemyExplosion');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;
    if (this.activeVoices.explosion >= this.maxVoices.explosion) return;

    this.activeVoices.explosion++;
    const now = this.ctx.currentTime;
    const duration = isPlayer ? 0.55 : 0.42;

    // Sub-bass sweep
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(isPlayer ? 150 : 130, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + duration);

    // Noise burst using shared PCM buffer
    let noiseSource: AudioBufferSourceNode | null = null;
    let filter: BiquadFilterNode | null = null;
    if (this.noiseBuffer) {
      noiseSource = this.ctx.createBufferSource();
      noiseSource.buffer = this.noiseBuffer;
      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(isPlayer ? 450 : 380, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + duration);
    }

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isPlayer ? 0.45 : 0.38, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    if (noiseSource && filter) {
      noiseSource.connect(filter);
      filter.connect(gain);
      noiseSource.start(now);
      noiseSource.stop(now + duration);
    }

    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + duration);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      this.activeVoices.explosion = Math.max(0, this.activeVoices.explosion - 1);
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
      if (filter) { try { filter.disconnect(); } catch {} }
      if (noiseSource) { try { noiseSource.disconnect(); } catch {} }
    };

    osc.onended = cleanup;
    setTimeout(cleanup, Math.round(duration * 1000) + 30);
  }

  /**
   * Command base destroyed: critical failure stinger (electrical collapse + heavy blast).
   */
  public playBaseDestroyed(): void {
    this.recordTelemetry('baseDestroyed');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;

    // Phase 1: High frequency electrical snap
    const zapOsc = this.ctx.createOscillator();
    const zapGain = this.ctx.createGain();
    zapOsc.type = 'square';
    zapOsc.frequency.setValueAtTime(1100, now);
    zapOsc.frequency.exponentialRampToValueAtTime(180, now + 0.18);
    zapGain.gain.setValueAtTime(0.28, now);
    zapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    zapOsc.connect(zapGain);
    zapGain.connect(this.sfxGain);
    zapOsc.start(now);
    zapOsc.stop(now + 0.18);

    // Phase 2: Heavy low electronic collapse
    const rumbleOsc = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    rumbleOsc.type = 'sawtooth';
    rumbleOsc.frequency.setValueAtTime(180, now + 0.08);
    rumbleOsc.frequency.exponentialRampToValueAtTime(25, now + 0.85);

    rumbleGain.gain.setValueAtTime(0.001, now);
    rumbleGain.gain.setValueAtTime(0.48, now + 0.10);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

    rumbleOsc.connect(rumbleGain);
    rumbleGain.connect(this.sfxGain);
    rumbleOsc.start(now + 0.08);
    rumbleOsc.stop(now + 0.85);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try { zapOsc.disconnect(); } catch {}
      try { zapGain.disconnect(); } catch {}
      try { rumbleOsc.disconnect(); } catch {}
      try { rumbleGain.disconnect(); } catch {}
    };

    rumbleOsc.onended = cleanup;
    setTimeout(cleanup, 920);
  }

  /**
   * Player life respawn: cyan materialization chime (220Hz -> 880Hz, 0.30s).
   */
  public playRespawn(): void {
    this.recordTelemetry('respawn');
    if (this.isMutedState || !this.ctx || !this.sfxGain) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.28);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30);

    osc.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + 0.30);

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      try { osc.disconnect(); } catch {}
      try { gain.disconnect(); } catch {}
    };

    osc.onended = cleanup;
    setTimeout(cleanup, 340);
  }

  /**
   * Stage Clear victory stinger: 4-note ascending futuristic arpeggio (0.9s).
   */
  public playStageClear(): void {
    this.recordTelemetry('stageClear');
    if (this.isMutedState || !this.ctx || !this.musicGain) return;

    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    const now = this.ctx.currentTime;

    notes.forEach((freq, index) => {
      if (!this.ctx || !this.musicGain) return;
      const noteTime = now + index * 0.14;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.28, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.38);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.38);

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        try { osc.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };

      osc.onended = cleanup;
      setTimeout(cleanup, (index * 0.14 + 0.42) * 1000);
    });
  }

  /**
   * Campaign Complete grand victory fanfare: 5-note rising futuristic chord arpeggio
   * with sustained climax harmonic (1.8s, restrained original procedural sequence).
   * Bounded lifecycle, edge-guarded, and safely cleanable.
   */
  public playCampaignComplete(): void {
    this.recordTelemetry('campaignComplete');
    if (this.isMutedState || !this.ctx || !this.musicGain) return;

    this.stopCampaignCompleteAudio();

    // Rising celebratory harmonic progression: C4, G4, C5, E5, G5, C6 (1.8s duration)
    const notes = [261.63, 392.0, 523.25, 659.25, 783.99, 1046.5];
    const now = this.ctx.currentTime;

    notes.forEach((freq, index) => {
      if (!this.ctx || !this.musicGain) return;
      const noteDelay = index * 0.16;
      const noteTime = now + noteDelay;
      const duration = index === notes.length - 1 ? 0.9 : 0.45;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.3, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + duration);

      osc.connect(gain);
      gain.connect(this.musicGain);

      this.campaignOscillators.push(osc);

      osc.start(noteTime);
      osc.stop(noteTime + duration);

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        const idx = this.campaignOscillators.indexOf(osc);
        if (idx !== -1) {
          this.campaignOscillators.splice(idx, 1);
        }
        try { osc.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };

      osc.onended = cleanup;
      setTimeout(cleanup, (noteDelay + duration + 0.05) * 1000);
    });
  }

  /**
   * Cleanly cancels any ongoing campaign completion audio voices.
   */
  public stopCampaignCompleteAudio(): void {
    for (const osc of this.campaignOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    }
    this.campaignOscillators = [];
  }

  /**
   * Game Over failure stinger: 3-note descending drop + sub drone (0.9s).
   */
  public playGameOver(): void {
    this.recordTelemetry('gameOver');
    if (this.isMutedState || !this.ctx || !this.musicGain) return;

    const notes = [349.23, 293.66, 233.08]; // F4, D4, Bb3
    const now = this.ctx.currentTime;

    notes.forEach((freq, index) => {
      if (!this.ctx || !this.musicGain) return;
      const noteTime = now + index * 0.18;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.24, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.42);

      osc.connect(gain);
      gain.connect(this.musicGain);

      osc.start(noteTime);
      osc.stop(noteTime + 0.42);

      let cleanedUp = false;
      const cleanup = () => {
        if (cleanedUp) return;
        cleanedUp = true;
        try { osc.disconnect(); } catch {}
        try { gain.disconnect(); } catch {}
      };

      osc.onended = cleanup;
      setTimeout(cleanup, (index * 0.18 + 0.46) * 1000);
    });
  }

  /**
   * Sets player movement tread rumble. Smoothly fades in/out without restarting node.
   */
  public setPlayerMoving(isMoving: boolean): void {
    if (!this.ctx || !this.playerTreadGain) return;

    if (this.isPlayerTreadActive !== isMoving) {
      this.isPlayerTreadActive = isMoving;
      const now = this.ctx.currentTime;
      const targetGain = isMoving && !this.isMutedState ? 0.12 : 0.0;

      this.playerTreadGain.gain.cancelScheduledValues(now);
      this.playerTreadGain.gain.linearRampToValueAtTime(targetGain, now + 0.08);
    }
  }

  /**
   * Sets ambient enemy movement bed volume scaled by active moving enemies.
   */
  public setEnemyMoving(activeCount: number): void {
    if (!this.ctx || !this.enemyTreadGain) return;

    const now = this.ctx.currentTime;
    const targetGain = activeCount > 0 && !this.isMutedState ? Math.min(0.06, activeCount * 0.02) : 0.0;

    this.enemyTreadGain.gain.cancelScheduledValues(now);
    this.enemyTreadGain.gain.linearRampToValueAtTime(targetGain, now + 0.15);
  }

  /**
   * Silences all active movement and ambient loops (e.g. during Game Over or Stage Clear).
   */
  public stopAllLoops(): void {
    this.setPlayerMoving(false);
    this.setEnemyMoving(0);
    this.stopCampaignCompleteAudio();
  }

  /**
   * Toggles global mute status.
   */
  public toggleMute(): boolean {
    this.setMuted(!this.isMutedState);
    return this.isMutedState;
  }

  /**
   * Sets global mute status.
   */
  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(muted ? 0.0 : this.masterVolume, now);

    if (muted) {
      this.stopAllLoops();
    }
  }

  public isMuted(): boolean {
    return this.isMutedState;
  }

  public getLastPlayedSound(): string | null {
    return this.lastPlayedSound;
  }

  public getSoundPlayCount(name: string): number {
    return this.playCounts[name] || 0;
  }

  public getActiveVoiceCount(category?: string): number {
    if (category) return this.activeVoices[category] || 0;
    return Object.values(this.activeVoices).reduce((a, b) => a + b, 0);
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  public hasUnlockListeners(): boolean {
    return this.hasAttachedListeners;
  }

  public getContextState(): string | null {
    return this.ctx ? this.ctx.state : null;
  }

  private handleBlur(): void {
    this.stopAllLoops();
    if (this.ctx && this.ctx.state === 'running') {
      this.ctx.suspend().catch(() => {});
    }
  }

  private handleFocus(): void {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (this.ctx && this.ctx.state === 'suspended' && this.isUnlocked) {
      this.ctx.resume().catch(() => {});
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.hidden) {
      this.handleBlur();
    } else {
      this.handleFocus();
    }
  }

  /**
   * Cleanly disposes AudioContext, nodes, and event listeners.
   */
  public dispose(): void {
    this.removeUnlockListeners();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.blurHandler);
      window.removeEventListener('focus', this.focusHandler);
    }

    this.stopAllLoops();

    if (this.playerTreadOsc) {
      try { this.playerTreadOsc.stop(); this.playerTreadOsc.disconnect(); } catch {}
      this.playerTreadOsc = null;
    }
    if (this.playerTreadLfo) {
      try { this.playerTreadLfo.stop(); this.playerTreadLfo.disconnect(); } catch {}
      this.playerTreadLfo = null;
    }
    if (this.playerTreadGain) {
      try { this.playerTreadGain.disconnect(); } catch {}
      this.playerTreadGain = null;
    }
    if (this.enemyTreadOsc) {
      try { this.enemyTreadOsc.stop(); this.enemyTreadOsc.disconnect(); } catch {}
      this.enemyTreadOsc = null;
    }
    if (this.enemyTreadGain) {
      try { this.enemyTreadGain.disconnect(); } catch {}
      this.enemyTreadGain = null;
    }

    if (this.masterGain) {
      try { this.masterGain.disconnect(); } catch {}
      this.masterGain = null;
    }
    if (this.sfxGain) {
      try { this.sfxGain.disconnect(); } catch {}
      this.sfxGain = null;
    }
    if (this.musicGain) {
      try { this.musicGain.disconnect(); } catch {}
      this.musicGain = null;
    }

    this.stopCampaignCompleteAudio();

    if (this.ctx) {
      try {
        this.ctx.close().catch(() => {});
      } catch {}
      this.ctx = null;
    }
  }
}
