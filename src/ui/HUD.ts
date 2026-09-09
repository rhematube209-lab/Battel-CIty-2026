import { DEBUG } from '../game/constants';
import { PowerupType } from '../config/powerups';
import { ActivePowerupStatus } from '../systems/PowerupSystem';

export interface DebugTelemetry {
  fps: number;
  meshes: number;
  inputSource?: string;
  touchDir?: string;
  touchFire?: boolean;
  aspect?: number;
  quality?: string;
  dpr?: number;
}

/**
 * HUD Controller for Battle City 2026.
 * Efficiently manages arcade gameplay stats: STAGE, ENEMIES, LIVES, SCORE.
 * Uses value caching to minimize DOM layout thrashing.
 */
export class HUD {
  private enemiesElement: HTMLElement | null;
  private livesElement: HTMLElement | null;
  private scoreElement: HTMLElement | null;
  private totalScoreElement: HTMLElement | null;
  private statusElement: HTMLElement | null;
  private stageElement: HTMLElement | null;
  private fpsElement: HTMLElement | null;
  private meshElement: HTMLElement | null;
  private debugContainer: HTMLElement | null;

  private debugInputSourceEl: HTMLElement | null;
  private debugTouchDirEl: HTMLElement | null;
  private debugTouchFireEl: HTMLElement | null;
  private debugAspectEl: HTMLElement | null;
  private debugQualityEl: HTMLElement | null;
  private debugDprEl: HTMLElement | null;

  private cachedStageNumber: number = -1;
  private cachedEnemies: number = -1;
  private cachedLives: number = -1;
  private cachedScore: string = '';
  private cachedTotalScore: string = '';
  private cachedStatus: string = '';
  private cachedFps: number = -1;
  private cachedMeshes: number = -1;

  private powerupsContainer: HTMLElement | null;
  private cachedEffectsKey: string = '';

  private hudContainer: HTMLElement | null;
  private muteButton: HTMLButtonElement | null;
  private muteIcon: HTMLElement | null;
  private pauseButton: HTMLButtonElement | null;
  private onToggleMuteCallback?: () => void;
  private onPauseCallback?: () => void;
  private onKeyDownHandler: (e: KeyboardEvent) => void;

  constructor() {
    this.hudContainer = document.getElementById('hud');
    this.enemiesElement = document.getElementById('enemiesCounter');
    this.livesElement = document.getElementById('livesCounter');
    this.scoreElement = document.getElementById('scoreCounter');
    this.totalScoreElement = document.getElementById('totalScoreCounter');
    this.statusElement = document.getElementById('statusIndicator');
    this.stageElement = document.getElementById('stageBadge') || document.querySelector('.hud-stage-badge');
    this.fpsElement = document.getElementById('fpsCounter');
    this.meshElement = document.getElementById('meshCounter');
    this.debugContainer = document.getElementById('hudDebug');
    this.powerupsContainer = document.getElementById('hudPowerups');

    this.muteButton = document.getElementById('muteBtn') as HTMLButtonElement | null;
    this.muteIcon = document.getElementById('muteIcon');
    this.pauseButton = document.getElementById('pauseBtn') as HTMLButtonElement | null;

    this.debugInputSourceEl = document.getElementById('debugInputSource');
    this.debugTouchDirEl = document.getElementById('debugTouchDir');
    this.debugTouchFireEl = document.getElementById('debugTouchFire');
    this.debugAspectEl = document.getElementById('debugAspect');
    this.debugQualityEl = document.getElementById('debugQuality');
    this.debugDprEl = document.getElementById('debugDpr');

    if (this.debugContainer) {
      this.debugContainer.style.display = DEBUG ? 'flex' : 'none';
    }

    this.muteButton?.addEventListener('click', () => {
      this.onToggleMuteCallback?.();
    });

    this.pauseButton?.addEventListener('click', () => {
      this.onPauseCallback?.();
    });

    this.onKeyDownHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        this.onToggleMuteCallback?.();
      }
    };
    window.addEventListener('keydown', this.onKeyDownHandler);
  }

  /**
   * Connects callback when user clicks the pause button.
   */
  public setOnPause(cb: () => void): void {
    this.onPauseCallback = cb;
  }

  /**
   * Controls HUD visibility across game states.
   */
  public setVisible(visible: boolean): void {
    if (this.hudContainer) {
      this.hudContainer.style.display = visible ? 'flex' : 'none';
    }
  }

  /**
   * Connects callback when user toggles sound via mute button or 'M' key.
   */
  public setOnToggleMute(cb: () => void): void {
    this.onToggleMuteCallback = cb;
  }

  /**
   * Updates mute icon display.
   */
  public setMuted(muted: boolean): void {
    if (this.muteIcon) {
      this.muteIcon.textContent = muted ? '🔇' : '🔊';
    }
  }

  /**
   * Updates HUD stage badge with formatted stage label (e.g. STAGE 01, STAGE 07).
   */
  public setStageNumber(stageNumber: number): void {
    if (this.cachedStageNumber === stageNumber) return;
    this.cachedStageNumber = stageNumber;
    if (this.stageElement) {
      this.stageElement.textContent = `STAGE ${stageNumber.toString().padStart(2, '0')}`;
    }
  }

  /**
   * Returns current displayed stage badge text.
   */
  public getStageText(): string {
    return this.stageElement?.textContent || '';
  }

  /**
   * Triggers brief pulse animation on the enemies counter when an enemy is destroyed.
   */
  public pulseEnemies(): void {
    if (!this.enemiesElement) return;
    this.enemiesElement.classList.remove('hud-pulse-alert');
    void this.enemiesElement.offsetWidth;
    this.enemiesElement.classList.add('hud-pulse-alert');
    setTimeout(() => {
      this.enemiesElement?.classList.remove('hud-pulse-alert');
    }, 350);
  }

  /**
   * Triggers brief score highlight flash when points are scored.
   */
  public pulseScore(): void {
    if (!this.scoreElement) return;
    this.scoreElement.classList.remove('hud-pulse-score');
    void this.scoreElement.offsetWidth;
    this.scoreElement.classList.add('hud-pulse-score');
    setTimeout(() => {
      this.scoreElement?.classList.remove('hud-pulse-score');
    }, 350);
  }

  /**
   * Triggers red warning pulse on lives counter when player loses a life.
   */
  public pulseLives(): void {
    if (!this.livesElement) return;
    this.livesElement.classList.remove('hud-pulse-danger');
    void this.livesElement.offsetWidth;
    this.livesElement.classList.add('hud-pulse-danger');
    setTimeout(() => {
      this.livesElement?.classList.remove('hud-pulse-danger');
    }, 450);
  }

  /**
   * Updates core gameplay statistics with caching to avoid redundant DOM writes.
   */
  public update(
    remainingEnemies: number,
    lives: number,
    formattedScore: string,
    formattedTotalScore?: string
  ): void {
    if (this.cachedEnemies !== remainingEnemies) {
      this.cachedEnemies = remainingEnemies;
      if (this.enemiesElement) {
        this.enemiesElement.textContent = remainingEnemies.toString();
      }
    }

    if (this.cachedLives !== lives) {
      this.cachedLives = lives;
      if (this.livesElement) {
        this.livesElement.textContent = lives.toString();
      }
    }

    if (this.cachedScore !== formattedScore) {
      this.cachedScore = formattedScore;
      if (this.scoreElement) {
        this.scoreElement.textContent = formattedScore;
      }
    }

    if (formattedTotalScore !== undefined && this.cachedTotalScore !== formattedTotalScore) {
      this.cachedTotalScore = formattedTotalScore;
      if (this.totalScoreElement) {
        this.totalScoreElement.textContent = formattedTotalScore;
      }
    }
  }

  /**
   * Updates status indicator badge (e.g. READY, BASE DESTROYED, TANK DESTROYED, STAGE CLEAR).
   */
  public setStatus(text: string, isDead: boolean = false): void {
    if (this.cachedStatus !== text) {
      this.cachedStatus = text;
      if (this.statusElement) {
        this.statusElement.textContent = text;
        if (isDead) {
          this.statusElement.classList.remove('hud-status-ok');
          this.statusElement.classList.add('hud-status-dead');
        } else {
          this.statusElement.classList.remove('hud-status-dead');
          this.statusElement.classList.add('hud-status-ok');
        }
      }
    }
  }

  /**
   * Updates debug metrics (FPS, active meshes, input source, touch dir, fire, DPR, etc.) when DEBUG is active.
   */
  public updateDebug(stats: DebugTelemetry | number, meshCount?: number): void {
    if (!DEBUG) return;

    if (typeof stats === 'number') {
      const fps = stats;
      const meshes = meshCount ?? 0;
      if (this.cachedFps !== fps) {
        this.cachedFps = fps;
        if (this.fpsElement) this.fpsElement.textContent = fps.toString();
      }
      if (this.cachedMeshes !== meshes) {
        this.cachedMeshes = meshes;
        if (this.meshElement) this.meshElement.textContent = meshes.toString();
      }
      return;
    }

    const { fps, meshes, inputSource, touchDir, touchFire, aspect, quality, dpr } = stats;

    if (this.cachedFps !== fps) {
      this.cachedFps = fps;
      if (this.fpsElement) this.fpsElement.textContent = fps.toString();
    }

    if (this.cachedMeshes !== meshes) {
      this.cachedMeshes = meshes;
      if (this.meshElement) this.meshElement.textContent = meshes.toString();
    }

    if (inputSource && this.debugInputSourceEl) {
      this.debugInputSourceEl.textContent = inputSource;
    }
    if (touchDir !== undefined && this.debugTouchDirEl) {
      this.debugTouchDirEl.textContent = touchDir;
    }
    if (touchFire !== undefined && this.debugTouchFireEl) {
      this.debugTouchFireEl.textContent = touchFire ? '1' : '0';
    }
    if (aspect !== undefined && this.debugAspectEl) {
      this.debugAspectEl.textContent = aspect.toFixed(2);
    }
    if (quality && this.debugQualityEl) {
      this.debugQualityEl.textContent = quality;
    }
    if (dpr !== undefined && this.debugDprEl) {
      this.debugDprEl.textContent = dpr.toFixed(1);
    }
  }

  /**
   * Updates active battlefield powerup indicators.
   * Throttles DOM updates to avoid unnecessary layout work.
   */
  public updatePowerups(effects: ActivePowerupStatus[], isMobile: boolean = false): void {
    if (!this.powerupsContainer) return;

    if (effects.length === 0) {
      if (this.cachedEffectsKey !== '') {
        this.powerupsContainer.style.display = 'none';
        this.powerupsContainer.innerHTML = '';
        this.cachedEffectsKey = '';
      }
      return;
    }

    const key = effects
      .map((e) => {
        const timeStr = isMobile
          ? Math.ceil(e.remainingTime).toString()
          : e.remainingTime.toFixed(1);
        return `${e.shortCode}:${timeStr}`;
      })
      .join('|');

    if (key === this.cachedEffectsKey) return;
    this.cachedEffectsKey = key;

    this.powerupsContainer.style.display = 'flex';
    this.powerupsContainer.innerHTML = effects
      .map((e) => {
        const timeStr = isMobile
          ? Math.ceil(e.remainingTime).toString()
          : e.remainingTime.toFixed(1);
        const label = isMobile ? e.shortCode : e.name;
        let cls = 'od';
        if (e.type === PowerupType.AEGIS_FIELD) cls = 'ag';
        else if (e.type === PowerupType.STASIS_PULSE) cls = 'st';
        return `<span class="hud-powerup-chip ${cls}">${label} ${timeStr}</span>`;
      })
      .join('');
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownHandler);
    // Clear references
    this.enemiesElement = null;
    this.livesElement = null;
    this.scoreElement = null;
    this.totalScoreElement = null;
    this.statusElement = null;
    this.fpsElement = null;
    this.meshElement = null;
    this.debugContainer = null;
    this.debugInputSourceEl = null;
    this.debugTouchDirEl = null;
    this.debugTouchFireEl = null;
    this.debugAspectEl = null;
    this.debugQualityEl = null;
    this.debugDprEl = null;
    this.muteButton = null;
    this.muteIcon = null;
  }
}

