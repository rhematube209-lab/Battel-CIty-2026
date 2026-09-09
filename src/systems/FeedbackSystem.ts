import { Vector3, TargetCamera } from '@babylonjs/core';

/**
 * FeedbackSystem coordinates sensory and visual impact feedback:
 * - Subtle camera shake respecting prefers-reduced-motion
 * - Strict baseline camera framing preservation (zero accumulation drift)
 * - HUD / screen damage vignette pulses
 * - Floating score pops (+100)
 * - Stage start presentation banner
 */
export class FeedbackSystem {
  private currentShakeIntensity: number = 0;
  private shakeTimer: number = 0;
  private shakeDuration: number = 0.2;

  // Maximum conservative camera shake clamp
  public static readonly MAX_SHAKE = 0.15;

  private isReducedMotion: boolean = false;
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryHandler: (e: MediaQueryListEvent) => void;

  // Container references for DOM visual feedback
  private damageVignetteEl: HTMLElement | null = null;
  private floatingFeedbackContainer: HTMLElement | null = null;
  private stageBannerEl: HTMLElement | null = null;

  constructor() {
    this.mediaQueryHandler = (e: MediaQueryListEvent) => {
      this.isReducedMotion = e.matches;
    };

    if (typeof window !== 'undefined') {
      this.mediaQueryList = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
      if (this.mediaQueryList) {
        this.isReducedMotion = this.mediaQueryList.matches;
        this.mediaQueryList.addEventListener?.('change', this.mediaQueryHandler);
      }
      this.initDomOverlays();
    }
  }

  private initDomOverlays(): void {
    // 1. Screen edge red/amber damage vignette
    let vignette = document.getElementById('damageVignette');
    if (!vignette) {
      vignette = document.createElement('div');
      vignette.id = 'damageVignette';
      vignette.className = 'damage-vignette hidden';
      document.body.appendChild(vignette);
    }
    this.damageVignetteEl = vignette;

    // 2. Floating feedback container for +100 score pops
    let feedback = document.getElementById('feedbackContainer');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'feedbackContainer';
      feedback.className = 'feedback-container';
      document.body.appendChild(feedback);
    }
    this.floatingFeedbackContainer = feedback;

    // 3. Stage start presentation banner
    let banner = document.getElementById('stageStartBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'stageStartBanner';
      banner.className = 'stage-start-banner hidden';
      banner.innerHTML = `
        <div class="stage-start-box">
          <span class="stage-start-tag">MISSION START</span>
          <h2 class="stage-start-title">STAGE 01</h2>
          <span class="stage-start-sub">SECURE COMMAND CORE</span>
        </div>
      `;
      document.body.appendChild(banner);
    }
    this.stageBannerEl = banner;
  }

  /**
   * Requests conservative camera shake feedback.
   *
   * Suggested intensities:
   * - Player cannon kick: 0.01 - 0.02 (subtle)
   * - Tank explosion: 0.04 - 0.07
   * - Base destruction: 0.08 - 0.12 (critical failure)
   */
  public triggerShake(intensity: number, duration: number = 0.22): void {
    if (this.isReducedMotion) {
      return; // Respect accessibility settings
    }

    const clampedIntensity = Math.min(FeedbackSystem.MAX_SHAKE, intensity);
    this.currentShakeIntensity = Math.max(this.currentShakeIntensity, clampedIntensity);
    this.shakeDuration = duration;
    this.shakeTimer = duration;
  }

  /**
   * Sets reduced motion override from UserPreferences.
   */
  public setReducedMotion(reduced: boolean): void {
    this.isReducedMotion = reduced;
    if (reduced) {
      this.shakeTimer = 0;
      this.currentShakeIntensity = 0;
    }
  }

  /**
   * Evaluates camera shake decay each render frame.
   * Strictly returns camera position to basePos upon decay expiration (zero accumulation).
   */
  public update(dt: number, camera: TargetCamera, basePos: Vector3): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const progress = Math.max(0, this.shakeTimer / this.shakeDuration);
      const intensity = this.currentShakeIntensity * progress;

      // Random jitter offset scaled by intensity
      const dx = (Math.random() * 2 - 1) * intensity;
      const dy = (Math.random() * 2 - 1) * intensity * 0.4; // Restrained vertical pitch
      const dz = (Math.random() * 2 - 1) * intensity;

      camera.position.set(basePos.x + dx, basePos.y + dy, basePos.z + dz);

      if (this.shakeTimer <= 0) {
        this.currentShakeIntensity = 0;
        camera.position.copyFrom(basePos);
      }
    } else {
      camera.position.copyFrom(basePos);
    }
  }

  /**
   * Dispatches a brief red screen-edge vignette pulse when player loses a life.
   */
  public triggerDamagePulse(): void {
    if (!this.damageVignetteEl) return;

    this.damageVignetteEl.classList.remove('hidden');
    this.damageVignetteEl.classList.remove('pulse');

    // Force reflow for immediate restart
    void this.damageVignetteEl.offsetWidth;

    this.damageVignetteEl.classList.add('pulse');

    setTimeout(() => {
      if (this.damageVignetteEl) {
        this.damageVignetteEl.classList.add('hidden');
        this.damageVignetteEl.classList.remove('pulse');
      }
    }, 450);
  }

  /**
   * Spawns a floating "+100" popup near the score counter or destroyed enemy.
   */
  public triggerScorePop(text: string = '+100'): void {
    if (!this.floatingFeedbackContainer) return;

    const pop = document.createElement('div');
    pop.className = 'score-pop-badge';
    pop.textContent = text;
    this.floatingFeedbackContainer.appendChild(pop);

    setTimeout(() => {
      if (pop.parentElement) {
        pop.parentElement.removeChild(pop);
      }
    }, 600);
  }

  /**
   * Displays brief entry banner on level start or restart (~0.85s, non-blocking).
   * Dynamically formats stage number, displayName, and missionTitle.
   */
  public showStageBanner(stageNumber: number = 1, displayName?: string, missionTitle?: string): void {
    if (!this.stageBannerEl) return;

    const title = this.stageBannerEl.querySelector('.stage-start-title');
    if (title) {
      title.textContent = `STAGE ${stageNumber.toString().padStart(2, '0')}`;
    }

    const sub = this.stageBannerEl.querySelector('.stage-start-sub');
    if (sub) {
      if (displayName && missionTitle) {
        sub.textContent = `${displayName} — ${missionTitle}`;
      } else if (displayName || missionTitle) {
        sub.textContent = displayName || missionTitle || 'SECURE COMMAND CORE';
      } else {
        sub.textContent = 'SECURE COMMAND CORE';
      }
    }

    this.stageBannerEl.classList.remove('hidden');
    this.stageBannerEl.classList.add('visible');

    setTimeout(() => {
      if (this.stageBannerEl) {
        this.stageBannerEl.classList.remove('visible');
        this.stageBannerEl.classList.add('hidden');
      }
    }, 850);
  }

  public getShakeTimer(): number {
    return this.shakeTimer;
  }

  public getCurrentShakeIntensity(): number {
    return this.currentShakeIntensity;
  }

  public isMotionReduced(): boolean {
    return this.isReducedMotion;
  }

  public dispose(): void {
    if (this.mediaQueryList && this.mediaQueryHandler) {
      this.mediaQueryList.removeEventListener?.('change', this.mediaQueryHandler);
    }
    if (this.damageVignetteEl && this.damageVignetteEl.parentElement) {
      this.damageVignetteEl.parentElement.removeChild(this.damageVignetteEl);
    }
    if (this.floatingFeedbackContainer && this.floatingFeedbackContainer.parentElement) {
      this.floatingFeedbackContainer.parentElement.removeChild(this.floatingFeedbackContainer);
    }
    if (this.stageBannerEl && this.stageBannerEl.parentElement) {
      this.stageBannerEl.parentElement.removeChild(this.stageBannerEl);
    }
  }
}
