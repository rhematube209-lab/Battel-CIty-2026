import { DEBUG } from '../game/constants';
import { PowerupType } from '../config/powerups';
import { ActivePowerupStatus } from '../systems/PowerupSystem';
import { TacticalCommandHUD } from './TacticalCommandHUD';
import { TacticalHUDSnapshot, EnemyArchetypeComposition } from './TacticalHUDSnapshot';
import { TileType } from '../game/constants';
import { MinimapEntityProvider } from './TacticalMinimap';

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

export type HUDLayoutMode = 'COMPACT' | 'TACTICAL';

/**
 * HUD Controller for Battle City 2026.
 * Single authoritative coordinator for gameplay telemetry.
 * Serves both:
 * 1. CompactHUD (top bar for mobile landscape / narrow viewports)
 * 2. TacticalCommandHUD (right-side futuristic command console for desktop >= 1100px)
 * Uses value caching to minimize DOM layout thrashing.
 */
export class HUD {
  // Compact HUD DOM Elements
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
  private cachedStageName: string = 'CYBER OUTPOST';
  private cachedMissionTitle: string = 'NEUTRALIZE ENEMY RECON UNITS';
  private cachedEnemies: number = -1;
  private cachedTotalEnemies: number = -1;
  private cachedLives: number = -1;
  private cachedScore: string = '';
  private cachedTotalScore: string = '';
  private cachedStatus: string = '';
  private cachedFps: number = -1;
  private cachedMeshes: number = -1;
  private cachedActivePowerups: ActivePowerupStatus[] = [];
  private cachedArchetypes?: EnemyArchetypeComposition;
  private cachedCommandNodeStatus: 'SECURE' | 'LOST' = 'SECURE';

  private powerupsContainer: HTMLElement | null;
  private cachedEffectsKey: string = '';

  private hudContainer: HTMLElement | null;
  private muteButton: HTMLButtonElement | null;
  private muteIcon: HTMLElement | null;
  private pauseButton: HTMLButtonElement | null;
  private onToggleMuteCallback?: () => void;
  private onPauseCallback?: () => void;
  private onKeyDownHandler: (e: KeyboardEvent) => void;

  // Tactical Desktop Command Sidebar Component
  private tacticalHUD: TacticalCommandHUD;
  private mode: HUDLayoutMode = 'COMPACT';
  private isVisibleState: boolean = false;
  private isMutedState: boolean = false;
  private isPausedState: boolean = false;

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

    // Initialize Tactical Desktop Sidebar
    this.tacticalHUD = new TacticalCommandHUD('tacticalCommandHud');

    this.muteButton?.addEventListener('click', () => {
      this.onToggleMuteCallback?.();
    });

    this.pauseButton?.addEventListener('click', () => {
      this.onPauseCallback?.();
    });

    this.tacticalHUD.setOnToggleMute(() => {
      this.onToggleMuteCallback?.();
    });

    this.tacticalHUD.setOnPause(() => {
      this.onPauseCallback?.();
    });

    this.onKeyDownHandler = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        this.onToggleMuteCallback?.();
      }
    };
    window.addEventListener('keydown', this.onKeyDownHandler);

    // Initial responsive layout mode evaluation
    this.syncResponsiveMode();
  }

  /**
   * Sets explicit layout mode ('COMPACT' or 'TACTICAL').
   */
  public setMode(mode: HUDLayoutMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.applyVisibility();
  }

  public getMode(): HUDLayoutMode {
    return this.mode;
  }

  /**
   * Evaluates viewport width and device profile to choose COMPACT vs TACTICAL.
   * Desktop (>= 1100px and non-touch) uses TACTICAL.
   * Mobile / narrow (< 1100px) uses COMPACT.
   */
  public syncResponsiveMode(isMobileDevice: boolean = false): void {
    const width = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const shouldBeTactical = !isMobileDevice && width >= 1100;
    this.setMode(shouldBeTactical ? 'TACTICAL' : 'COMPACT');
  }

  /**
   * Applies visibility based on current isVisibleState and layout mode.
   */
  private applyVisibility(): void {
    if (!this.isVisibleState) {
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      this.tacticalHUD.setVisible(false);
      return;
    }

    if (this.mode === 'TACTICAL') {
      // On desktop wide: hide top compact HUD to avoid duplicate telemetry
      if (this.hudContainer) this.hudContainer.style.display = 'none';
      this.tacticalHUD.setVisible(true);
    } else {
      // On mobile / narrow: show top compact HUD, hide sidebar
      if (this.hudContainer) this.hudContainer.style.display = 'flex';
      this.tacticalHUD.setVisible(false);
    }
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
    this.isVisibleState = visible;
    this.applyVisibility();
  }

  public isVisible(): boolean {
    return this.isVisibleState;
  }

  /**
   * Connects callback when user toggles sound via mute button or 'M' key.
   */
  public setOnToggleMute(cb: () => void): void {
    this.onToggleMuteCallback = cb;
  }

  /**
   * Updates mute icon display across both compact and tactical interfaces.
   */
  public setMuted(muted: boolean): void {
    this.isMutedState = muted;
    if (this.muteIcon) {
      this.muteIcon.textContent = muted ? '🔇' : '🔊';
    }
    this.tacticalHUD.setMuted(muted);
  }

  /**
   * Notifies HUD of game pause state.
   */
  public setPaused(paused: boolean): void {
    this.isPausedState = paused;
    this.tacticalHUD.setPaused(paused);
  }

  public setReducedMotion(reduced: boolean): void {
    this.tacticalHUD.setReducedMotion(reduced);
  }

  /**
   * Updates HUD stage badge with formatted stage label.
   */
  public setStageNumber(stageNumber: number, stageName?: string, missionTitle?: string): void {
    if (stageName) this.cachedStageName = stageName;
    if (missionTitle) this.cachedMissionTitle = missionTitle;

    if (this.cachedStageNumber === stageNumber) return;
    this.cachedStageNumber = stageNumber;
    if (this.stageElement) {
      this.stageElement.textContent = `STAGE ${stageNumber.toString().padStart(2, '0')}`;
    }
    this.dispatchTacticalSnapshot();
  }

  public setStageMetadata(stageNumber: number, stageName: string, missionTitle: string, totalEnemies: number): void {
    this.cachedStageNumber = stageNumber;
    this.cachedStageName = stageName;
    this.cachedMissionTitle = missionTitle;
    this.cachedTotalEnemies = totalEnemies;
    if (this.stageElement) {
      this.stageElement.textContent = `STAGE ${stageNumber.toString().padStart(2, '0')}`;
    }
    this.dispatchTacticalSnapshot();
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
    if (this.enemiesElement) {
      this.enemiesElement.classList.remove('hud-pulse-alert');
      void this.enemiesElement.offsetWidth;
      this.enemiesElement.classList.add('hud-pulse-alert');
      setTimeout(() => {
        this.enemiesElement?.classList.remove('hud-pulse-alert');
      }, 350);
    }
    this.tacticalHUD.pulseEnemies();
  }

  /**
   * Triggers brief score highlight flash when points are scored.
   */
  public pulseScore(): void {
    if (this.scoreElement) {
      this.scoreElement.classList.remove('hud-pulse-score');
      void this.scoreElement.offsetWidth;
      this.scoreElement.classList.add('hud-pulse-score');
      setTimeout(() => {
        this.scoreElement?.classList.remove('hud-pulse-score');
      }, 350);
    }
    this.tacticalHUD.pulseScore();
  }

  /**
   * Triggers red warning pulse on lives counter when player loses a life.
   */
  public pulseLives(): void {
    if (this.livesElement) {
      this.livesElement.classList.remove('hud-pulse-danger');
      void this.livesElement.offsetWidth;
      this.livesElement.classList.add('hud-pulse-danger');
      setTimeout(() => {
        this.livesElement?.classList.remove('hud-pulse-danger');
      }, 450);
    }
    this.tacticalHUD.pulseLives();
  }

  /**
   * Updates core gameplay statistics with caching to avoid redundant DOM writes.
   * Simultaneously updates TacticalCommandHUD snapshot.
   */
  public update(
    remainingEnemies: number,
    lives: number,
    formattedScore: string,
    formattedTotalScore?: string,
    archetypes?: EnemyArchetypeComposition,
    commandNodeStatus: 'SECURE' | 'LOST' = 'SECURE'
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

    if (archetypes) {
      this.cachedArchetypes = archetypes;
    }

    this.cachedCommandNodeStatus = commandNodeStatus;
    this.dispatchTacticalSnapshot();
  }

  /**
   * Dispatches snapshot to TacticalCommandHUD.
   */
  private dispatchTacticalSnapshot(): void {
    const totalEnemies = this.cachedTotalEnemies > 0
      ? this.cachedTotalEnemies
      : Math.max(this.cachedEnemies, 12);

    const snapshot: TacticalHUDSnapshot = {
      stageNumber: this.cachedStageNumber > 0 ? this.cachedStageNumber : 1,
      stageName: this.cachedStageName,
      missionTitle: this.cachedMissionTitle,
      enemiesRemaining: Math.max(0, this.cachedEnemies),
      totalEnemies,
      archetypeComposition: this.cachedArchetypes,
      lives: Math.max(0, this.cachedLives),
      stageScore: parseInt(this.cachedScore || '0', 10),
      formattedStageScore: this.cachedScore || '000000',
      campaignScore: parseInt(this.cachedTotalScore || '0', 10),
      formattedCampaignScore: this.cachedTotalScore || '000000',
      statusText: this.cachedStatus || 'READY',
      isDead: this.cachedStatus === 'TANK DESTROYED' || this.cachedStatus === 'BASE DESTROYED',
      commandNodeStatus: this.cachedCommandNodeStatus,
      activePowerups: this.cachedActivePowerups,
      isMuted: this.isMutedState,
      isPaused: this.isPausedState,
    };

    this.tacticalHUD.renderSnapshot(snapshot);
  }

  /**
   * Updates status indicator badge across both compact and tactical interfaces.
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
      this.dispatchTacticalSnapshot();
    }
  }

  /**
   * Updates debug metrics when DEBUG is active.
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
   */
  public updatePowerups(effects: ActivePowerupStatus[], isMobile: boolean = false): void {
    this.cachedActivePowerups = [...effects];
    this.dispatchTacticalSnapshot();

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

  /**
   * Sets stage topology for TacticalMinimap.
   */
  public setStageTopology(tiles: readonly (readonly TileType[])[] | TileType[][]): void {
    this.tacticalHUD.setStageTopology(tiles);
  }

  /**
   * Sets entity provider for TacticalMinimap.
   */
  public setMinimapEntityProvider(provider: MinimapEntityProvider): void {
    this.tacticalHUD.setMinimapEntityProvider(provider);
  }

  /**
   * Triggers throttled minimap update.
   */
  public updateMinimap(now?: number): void {
    if (this.mode === 'TACTICAL' && this.isVisibleState && !this.isPausedState) {
      this.tacticalHUD.updateMinimap(now);
    }
  }

  public getTacticalHUD(): TacticalCommandHUD {
    return this.tacticalHUD;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownHandler);
    this.tacticalHUD.dispose();
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
    this.pauseButton = null;
  }
}
