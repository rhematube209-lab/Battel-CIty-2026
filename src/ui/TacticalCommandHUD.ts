import { BUILD_INFO } from '../config/buildInfo';
import { TacticalHUDSnapshot } from './TacticalHUDSnapshot';
import { TacticalMinimap, MinimapEntityProvider } from './TacticalMinimap';
import { TileType } from '../game/constants';
import { PowerupType } from '../config/powerups';

/**
 * Tactical Command HUD (Desktop Sidebar).
 * Dedicated command interface for desktop wide layouts (>= 1100px).
 * Displays stage card, enemy accounting with archetype composition, player lives,
 * Command Node status, 6-digit score/total, active powerup countdowns, tactical minimap,
 * mission directive, and accessible mute/pause controls.
 */
export class TacticalCommandHUD {
  private container: HTMLElement | null;
  private minimap: TacticalMinimap;

  // DOM Elements
  private stageBadgeEl: HTMLElement | null = null;
  private stageNameEl: HTMLElement | null = null;
  private enemiesCountEl: HTMLElement | null = null;
  private enemiesTotalEl: HTMLElement | null = null;
  private archetypeStdEl: HTMLElement | null = null;
  private archetypeFastEl: HTMLElement | null = null;
  private archetypeArmEl: HTMLElement | null = null;
  private livesEl: HTMLElement | null = null;
  private commandNodeStatusEl: HTMLElement | null = null;
  private scoreEl: HTMLElement | null = null;
  private totalScoreEl: HTMLElement | null = null;
  private powerupsListEl: HTMLElement | null = null;
  private missionTitleEl: HTMLElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;
  private muteIcon: HTMLElement | null = null;
  private pauseBtn: HTMLButtonElement | null = null;
  private statusBadgeEl: HTMLElement | null = null;

  // Value Caching to prevent DOM thrashing
  private cachedStage: number = -1;
  private cachedEnemies: number = -1;
  private cachedTotalEnemies: number = -1;
  private cachedStd: number = -1;
  private cachedFast: number = -1;
  private cachedArm: number = -1;
  private cachedLives: number = -1;
  private cachedScore: string = '';
  private cachedTotalScore: string = '';
  private cachedBaseStatus: string = '';
  private cachedMission: string = '';
  private cachedPowerupsKey: string = '';
  private cachedStatus: string = '';

  private reducedMotion: boolean = false;
  private onToggleMuteCallback?: () => void;
  private onPauseCallback?: () => void;

  constructor(containerId: string = 'tacticalCommandHud') {
    this.container = document.getElementById(containerId);
    this.buildDOM();
    this.minimap = new TacticalMinimap('tacticalMinimap');
  }

  private buildDOM(): void {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="tch-inner">
        <!-- 1. Unified Console Header & Stage Identity Module -->
        <div class="tch-section tch-module-header">
          <div class="tch-brand-header">
            <span class="tch-logo-dot"></span>
            <div class="tch-title-group">
              <div class="tch-brand-title">BATTLE CITY <span class="tch-brand-accent">2026</span></div>
              <div class="tch-brand-subtitle">TACTICAL COMMAND CONSOLE</div>
            </div>
            <span class="tch-version-tag">v${BUILD_INFO.version}</span>
          </div>
          <div class="tch-stage-subpanel">
            <div class="tch-stage-row">
              <span id="tchStageBadge" class="tch-stage-badge">STAGE 01</span>
              <span id="tchStatusBadge" class="tch-status-badge">READY</span>
            </div>
            <div id="tchStageName" class="tch-stage-name">CYBER OUTPOST</div>
          </div>
        </div>

        <!-- 2. Tactical Topology Module -->
        <div class="tch-section tch-module-minimap">
          <div class="tch-section-label">TACTICAL TOPOLOGY</div>
          <div class="tch-minimap-frame">
            <div class="tch-minimap-corner corner-tl"></div>
            <div class="tch-minimap-corner corner-tr"></div>
            <div class="tch-minimap-corner corner-bl"></div>
            <div class="tch-minimap-corner corner-br"></div>
            <canvas id="tacticalMinimap" aria-label="Tactical minimap" role="img"></canvas>
          </div>
          <div class="tch-minimap-legend">
            <span class="legend-item"><span class="legend-pip pip-player"></span>YOU</span>
            <span class="legend-item"><span class="legend-pip pip-enemy"></span>HOSTILE</span>
            <span class="legend-item"><span class="legend-pip pip-base"></span>CORE</span>
          </div>
        </div>

        <!-- 3. Hostile Threat Quota & Archetype Composition Module -->
        <div class="tch-section tch-module-hostiles">
          <div class="tch-section-label">HOSTILE UNITS REMAINING</div>
          <div class="tch-enemy-main">
            <span id="tchEnemiesCount" class="tch-big-val">12</span>
            <span class="tch-total-divider">/</span>
            <span id="tchEnemiesTotal" class="tch-total-val">12</span>
          </div>
          <div class="tch-archetype-grid">
            <div class="tch-archetype-pill">
              <span class="arch-tag">STD</span>
              <span id="tchArchStd" class="arch-val">0</span>
            </div>
            <div class="tch-archetype-pill">
              <span class="arch-tag">FAST</span>
              <span id="tchArchFast" class="arch-val">0</span>
            </div>
            <div class="tch-archetype-pill">
              <span class="arch-tag">ARM</span>
              <span id="tchArchArm" class="arch-val">0</span>
            </div>
          </div>
        </div>

        <!-- 4. Strategic Defense Grid Module (Unit Lives + Command Node) -->
        <div class="tch-section tch-module-defense">
          <div class="tch-status-grid">
            <div class="tch-status-box">
              <div class="tch-box-label">UNIT LIVES</div>
              <div class="tch-box-val-group">
                <span class="tch-unit-tag">PLAYER</span>
                <span id="tchLivesCount" class="tch-lives-val">× 3</span>
              </div>
            </div>
            <div class="tch-status-box">
              <div class="tch-box-label">COMMAND NODE</div>
              <div id="tchCommandNodeStatus" class="tch-node-status status-secure">SECURE</div>
            </div>
          </div>
        </div>

        <!-- 5. Mission Telemetry Module (Score + Campaign Total) -->
        <div class="tch-section tch-module-telemetry">
          <div class="tch-score-row">
            <span class="tch-score-label">STAGE SCORE</span>
            <span id="tchScoreVal" class="tch-score-val">000000</span>
          </div>
          <div class="tch-score-row">
            <span class="tch-score-label">CAMPAIGN TOTAL</span>
            <span id="tchTotalScoreVal" class="tch-score-val-accent">000000</span>
          </div>
        </div>

        <!-- 6. Active Tactical Systems Module -->
        <div class="tch-section tch-module-systems">
          <div class="tch-systems-header">
            <span class="tch-section-label">ACTIVE SYSTEMS</span>
          </div>
          <div id="tchPowerupsList" class="tch-powerups-list">
            <span class="tch-powerup-standby">SYSTEMS STANDBY</span>
          </div>
        </div>

        <!-- 7. Primary Directive Module -->
        <div class="tch-section tch-module-mission">
          <div class="tch-section-label">PRIMARY DIRECTIVE</div>
          <div id="tchMissionTitle" class="tch-mission-text">DEFEND COMMAND NODE</div>
        </div>

        <!-- 8. Integrated Hardware Controls Module -->
        <div class="tch-section tch-controls-footer">
          <button id="tchMuteBtn" class="tch-btn" type="button" aria-label="Toggle Sound (M)" title="Toggle Sound [M]">
            <span id="tchMuteIcon" class="tch-btn-icon">🔊</span>
            <span class="tch-btn-text">AUDIO</span>
          </button>
          <button id="tchPauseBtn" class="tch-btn tch-btn-pause" type="button" aria-label="Pause Game (ESC / P)" title="Pause Game [ESC / P]">
            <span class="tch-btn-icon">⏸</span>
            <span class="tch-btn-text">PAUSE</span>
          </button>
        </div>
      </div>
    `;

    // Query elements
    this.stageBadgeEl = document.getElementById('tchStageBadge');
    this.stageNameEl = document.getElementById('tchStageName');
    this.statusBadgeEl = document.getElementById('tchStatusBadge');
    this.enemiesCountEl = document.getElementById('tchEnemiesCount');
    this.enemiesTotalEl = document.getElementById('tchEnemiesTotal');
    this.archetypeStdEl = document.getElementById('tchArchStd');
    this.archetypeFastEl = document.getElementById('tchArchFast');
    this.archetypeArmEl = document.getElementById('tchArchArm');
    this.livesEl = document.getElementById('tchLivesCount');
    this.commandNodeStatusEl = document.getElementById('tchCommandNodeStatus');
    this.scoreEl = document.getElementById('tchScoreVal');
    this.totalScoreEl = document.getElementById('tchTotalScoreVal');
    this.powerupsListEl = document.getElementById('tchPowerupsList');
    this.missionTitleEl = document.getElementById('tchMissionTitle');
    this.muteBtn = document.getElementById('tchMuteBtn') as HTMLButtonElement | null;
    this.muteIcon = document.getElementById('tchMuteIcon');
    this.pauseBtn = document.getElementById('tchPauseBtn') as HTMLButtonElement | null;

    this.muteBtn?.addEventListener('click', () => {
      this.onToggleMuteCallback?.();
    });

    this.pauseBtn?.addEventListener('click', () => {
      this.onPauseCallback?.();
    });
  }

  public setOnToggleMute(cb: () => void): void {
    this.onToggleMuteCallback = cb;
  }

  public setOnPause(cb: () => void): void {
    this.onPauseCallback = cb;
  }

  public setReducedMotion(reduced: boolean): void {
    this.reducedMotion = reduced;
  }

  public setVisible(visible: boolean): void {
    if (this.container) {
      this.container.style.display = visible ? 'flex' : 'none';
    }
  }

  public isVisible(): boolean {
    return this.container ? this.container.style.display !== 'none' : false;
  }

  public setStageTopology(tiles: readonly (readonly TileType[])[] | TileType[][]): void {
    this.minimap.setStageTopology(tiles);
  }

  public setMinimapEntityProvider(provider: MinimapEntityProvider): void {
    this.minimap.setEntityProvider(provider);
  }

  public setMuted(muted: boolean): void {
    if (this.muteIcon) {
      this.muteIcon.textContent = muted ? '🔇' : '🔊';
    }
  }

  public setPaused(paused: boolean): void {
    this.minimap.setPaused(paused);
    if (this.pauseBtn) {
      this.pauseBtn.classList.toggle('tch-btn-active', paused);
    }
  }

  public pulseScore(): void {
    if (this.reducedMotion || !this.scoreEl) return;
    this.scoreEl.classList.remove('tch-pulse-highlight');
    void this.scoreEl.offsetWidth;
    this.scoreEl.classList.add('tch-pulse-highlight');
    setTimeout(() => {
      this.scoreEl?.classList.remove('tch-pulse-highlight');
    }, 350);
  }

  public pulseEnemies(): void {
    if (this.reducedMotion || !this.enemiesCountEl) return;
    this.enemiesCountEl.classList.remove('tch-pulse-alert');
    void this.enemiesCountEl.offsetWidth;
    this.enemiesCountEl.classList.add('tch-pulse-alert');
    setTimeout(() => {
      this.enemiesCountEl?.classList.remove('tch-pulse-alert');
    }, 350);
  }

  public pulseLives(): void {
    if (this.reducedMotion || !this.livesEl) return;
    this.livesEl.classList.remove('tch-pulse-danger');
    void this.livesEl.offsetWidth;
    this.livesEl.classList.add('tch-pulse-danger');
    setTimeout(() => {
      this.livesEl?.classList.remove('tch-pulse-danger');
    }, 450);
  }

  /**
   * Authoritatively renders the complete UI snapshot.
   */
  public renderSnapshot(snapshot: TacticalHUDSnapshot): void {
    if (!this.container) return;

    // Stage
    if (this.cachedStage !== snapshot.stageNumber) {
      this.cachedStage = snapshot.stageNumber;
      if (this.stageBadgeEl) {
        this.stageBadgeEl.textContent = `STAGE ${snapshot.stageNumber.toString().padStart(2, '0')}`;
      }
    }

    if (this.stageNameEl && this.stageNameEl.textContent !== snapshot.stageName) {
      this.stageNameEl.textContent = snapshot.stageName;
    }

    // Status Badge
    if (this.cachedStatus !== snapshot.statusText) {
      this.cachedStatus = snapshot.statusText;
      if (this.statusBadgeEl) {
        this.statusBadgeEl.textContent = snapshot.statusText;
        this.statusBadgeEl.className = snapshot.isDead ? 'tch-status-badge badge-dead' : 'tch-status-badge badge-ok';
      }
    }

    // Enemies
    if (this.cachedEnemies !== snapshot.enemiesRemaining) {
      this.cachedEnemies = snapshot.enemiesRemaining;
      if (this.enemiesCountEl) {
        this.enemiesCountEl.textContent = snapshot.enemiesRemaining.toString();
      }
    }

    if (this.cachedTotalEnemies !== snapshot.totalEnemies) {
      this.cachedTotalEnemies = snapshot.totalEnemies;
      if (this.enemiesTotalEl) {
        this.enemiesTotalEl.textContent = snapshot.totalEnemies.toString();
      }
    }

    // Archetype composition
    if (snapshot.archetypeComposition) {
      const { standard, fast, armor } = snapshot.archetypeComposition;
      if (this.cachedStd !== standard) {
        this.cachedStd = standard;
        if (this.archetypeStdEl) this.archetypeStdEl.textContent = standard.toString();
      }
      if (this.cachedFast !== fast) {
        this.cachedFast = fast;
        if (this.archetypeFastEl) this.archetypeFastEl.textContent = fast.toString();
      }
      if (this.cachedArm !== armor) {
        this.cachedArm = armor;
        if (this.archetypeArmEl) this.archetypeArmEl.textContent = armor.toString();
      }
    }

    // Lives
    if (this.cachedLives !== snapshot.lives) {
      this.cachedLives = snapshot.lives;
      if (this.livesEl) {
        this.livesEl.textContent = `× ${snapshot.lives}`;
      }
    }

    // Command Node Status
    if (this.cachedBaseStatus !== snapshot.commandNodeStatus) {
      this.cachedBaseStatus = snapshot.commandNodeStatus;
      if (this.commandNodeStatusEl) {
        this.commandNodeStatusEl.textContent = snapshot.commandNodeStatus;
        if (snapshot.commandNodeStatus === 'SECURE') {
          this.commandNodeStatusEl.className = 'tch-node-status status-secure';
        } else {
          this.commandNodeStatusEl.className = 'tch-node-status status-lost';
        }
      }
    }

    // Scores
    if (this.cachedScore !== snapshot.formattedStageScore) {
      this.cachedScore = snapshot.formattedStageScore;
      if (this.scoreEl) {
        this.scoreEl.textContent = snapshot.formattedStageScore;
      }
    }

    if (this.cachedTotalScore !== snapshot.formattedCampaignScore) {
      this.cachedTotalScore = snapshot.formattedCampaignScore;
      if (this.totalScoreEl) {
        this.totalScoreEl.textContent = snapshot.formattedCampaignScore;
      }
    }

    // Active Systems / Powerups
    if (this.powerupsListEl) {
      if (snapshot.activePowerups.length === 0) {
        if (this.cachedPowerupsKey !== '') {
          this.cachedPowerupsKey = '';
          this.powerupsListEl.innerHTML = '<span class="tch-powerup-standby">SYSTEMS STANDBY</span>';
        }
      } else {
        const key = snapshot.activePowerups
          .map((p) => `${p.shortCode}:${p.remainingTime.toFixed(1)}`)
          .join('|');
        if (this.cachedPowerupsKey !== key) {
          this.cachedPowerupsKey = key;
          this.powerupsListEl.innerHTML = snapshot.activePowerups
            .map((p) => {
              let cls = 'od';
              if (p.type === PowerupType.AEGIS_FIELD) cls = 'ag';
              else if (p.type === PowerupType.STASIS_PULSE) cls = 'st';
              return `
                <div class="tch-powerup-item ${cls}">
                  <span class="tch-powerup-name">${p.name}</span>
                  <span class="tch-powerup-time">${p.remainingTime.toFixed(1)}s</span>
                </div>
              `;
            })
            .join('');
        }
      }
    }

    // Mission Directive
    if (this.cachedMission !== snapshot.missionTitle) {
      this.cachedMission = snapshot.missionTitle;
      if (this.missionTitleEl) {
        this.missionTitleEl.textContent = snapshot.missionTitle;
      }
    }

    // Mute icon
    this.setMuted(snapshot.isMuted);
  }

  /**
   * Throttled minimap update.
   */
  public updateMinimap(now: number = performance.now()): void {
    this.minimap.tick(now);
  }

  public getMinimap(): TacticalMinimap {
    return this.minimap;
  }

  public dispose(): void {
    this.minimap.dispose();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
