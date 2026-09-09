/**
 * Pure state manager for in-memory user accessibility and UI preferences.
 * Manages reduced motion settings (SYSTEM vs ON) and provides effective state
 * to FeedbackSystem, UI animations, and media queries without localStorage persistence.
 */

export enum ReducedMotionSetting {
  SYSTEM = 'SYSTEM',
  ON = 'ON',
}

export class UserPreferences {
  private reducedMotionSetting: ReducedMotionSetting = ReducedMotionSetting.SYSTEM;
  private systemPrefersReducedMotion: boolean = false;
  private mediaQueryList: MediaQueryList | null = null;
  private mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;
  private listeners: Set<() => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && window.matchMedia) {
      try {
        this.mediaQueryList = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.systemPrefersReducedMotion = this.mediaQueryList.matches;
        this.mediaQueryListener = (e: MediaQueryListEvent) => {
          this.systemPrefersReducedMotion = e.matches;
          this.applyToDom();
          this.notify();
        };
        this.mediaQueryList.addEventListener?.('change', this.mediaQueryListener);
      } catch {
        // Fallback for environments without matchMedia
      }
    }
    this.applyToDom();
  }

  /**
   * Returns effective reduced-motion decision:
   * True if forced ON by user, or if OS requests reduced motion.
   */
  public isReducedMotion(): boolean {
    return (
      this.reducedMotionSetting === ReducedMotionSetting.ON ||
      this.systemPrefersReducedMotion
    );
  }

  public isReducedMotionActive(): boolean {
    return this.isReducedMotion();
  }

  public getReducedMotionSetting(): ReducedMotionSetting {
    return this.reducedMotionSetting;
  }

  public setReducedMotionSetting(setting: ReducedMotionSetting): void {
    if (this.reducedMotionSetting === setting) return;
    this.reducedMotionSetting = setting;
    this.applyToDom();
    this.notify();
  }

  public toggleReducedMotion(): ReducedMotionSetting {
    const next =
      this.reducedMotionSetting === ReducedMotionSetting.SYSTEM
        ? ReducedMotionSetting.ON
        : ReducedMotionSetting.SYSTEM;
    this.setReducedMotionSetting(next);
    return next;
  }

  public addListener(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  public subscribeReducedMotion(cb: (setting: ReducedMotionSetting) => void): () => void {
    const wrapped = () => cb(this.reducedMotionSetting);
    this.listeners.add(wrapped);
    return () => this.listeners.delete(wrapped);
  }

  private notify(): void {
    this.listeners.forEach((cb) => {
      try { cb(); } catch {}
    });
  }

  private applyToDom(): void {
    if (typeof document !== 'undefined' && document.body) {
      if (this.isReducedMotion()) {
        document.body.classList.add('reduced-motion');
      } else {
        document.body.classList.remove('reduced-motion');
      }
    }
  }

  public dispose(): void {
    if (this.mediaQueryList && this.mediaQueryListener) {
      this.mediaQueryList.removeEventListener?.('change', this.mediaQueryListener);
    }
    this.listeners.clear();
  }
}
