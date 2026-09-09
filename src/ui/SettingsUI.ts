import { AudioSystem } from '../systems/AudioSystem';
import { UserPreferences, ReducedMotionSetting } from '../game/UserPreferences';

export type SettingsSource = 'TITLE' | 'PAUSED';

/**
 * SettingsUI manages the in-game accessibility and audio settings:
 * - AUDIO: ON / MUTED (synchronized with AudioSystem, HUD mute button, and 'M' key)
 * - REDUCED MOTION: SYSTEM / ON
 * - BACK: Context-aware return to caller (Title Screen or Pause Menu)
 * Enforces Phase 17 overlay safety standards.
 */
export class SettingsUI {
  private overlay: HTMLElement | null;
  private audioBtn: HTMLButtonElement | null;
  private motionBtn: HTMLButtonElement | null;
  private backBtn: HTMLButtonElement | null;

  private audioSystem: AudioSystem;
  private userPreferences: UserPreferences;
  private currentSource: SettingsSource = 'TITLE';

  private onBackCallback?: (source: SettingsSource) => void;
  private onMuteChangedCallback?: (muted: boolean) => void;

  private _isModalVisible: boolean = false;
  private unsubscribePrefs?: () => void;

  constructor(
    audioSystem: AudioSystem,
    userPreferences: UserPreferences,
    onBack: (source: SettingsSource) => void,
    onMuteChanged?: (muted: boolean) => void
  ) {
    this.audioSystem = audioSystem;
    this.userPreferences = userPreferences;
    this.onBackCallback = onBack;
    this.onMuteChangedCallback = onMuteChanged;

    this.overlay = document.getElementById('settingsOverlay');
    this.audioBtn = document.getElementById('settingsAudioBtn') as HTMLButtonElement | null;
    this.motionBtn = document.getElementById('settingsMotionBtn') as HTMLButtonElement | null;
    this.backBtn = document.getElementById('settingsBackBtn') as HTMLButtonElement | null;

    this.audioBtn?.addEventListener('click', () => this.toggleAudio());
    this.motionBtn?.addEventListener('click', () => this.toggleMotion());
    this.backBtn?.addEventListener('click', () => this.handleBack());

    this.unsubscribePrefs = this.userPreferences.addListener(() => {
      this.updateView();
    });

    this.hide();
  }

  private toggleAudio(): void {
    const isMuted = this.audioSystem.isMuted();
    const nextMuted = !isMuted;
    this.audioSystem.setMuted(nextMuted);
    this.onMuteChangedCallback?.(nextMuted);
    this.updateView();
  }

  private toggleMotion(): void {
    this.userPreferences.toggleReducedMotion();
    this.updateView();
  }

  private handleBack(): void {
    const src = this.currentSource;
    this.hide();
    this.onBackCallback?.(src);
  }

  public updateView(): void {
    const muted = this.audioSystem.isMuted();
    if (this.audioBtn) {
      this.audioBtn.textContent = muted ? 'MUTED' : 'ON';
      this.audioBtn.setAttribute('aria-pressed', muted ? 'false' : 'true');
      if (muted) {
        this.audioBtn.classList.add('muted');
      } else {
        this.audioBtn.classList.remove('muted');
      }
    }

    const motionSetting = this.userPreferences.getReducedMotionSetting();
    if (this.motionBtn) {
      this.motionBtn.textContent = motionSetting;
      this.motionBtn.setAttribute('aria-pressed', motionSetting === ReducedMotionSetting.ON ? 'true' : 'false');
      if (motionSetting === ReducedMotionSetting.ON) {
        this.motionBtn.classList.add('active');
      } else {
        this.motionBtn.classList.remove('active');
      }
    }
  }

  public show(source: SettingsSource = 'TITLE'): void {
    this.currentSource = source;
    this._isModalVisible = true;
    this.updateView();
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
      this.overlay.removeAttribute?.('aria-hidden');
    }
    setTimeout(() => {
      this.audioBtn?.focus?.();
    }, 50);
  }

  public hide(): void {
    this._isModalVisible = false;
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.overlay.classList.add('hidden');
      this.overlay.classList.remove('visible');
      this.overlay.setAttribute?.('aria-hidden', 'true');
    }
  }

  public isVisible(): boolean {
    return this._isModalVisible;
  }

  public isModalVisible(): boolean {
    return this._isModalVisible;
  }

  public getSource(): SettingsSource {
    return this.currentSource;
  }

  public getCallerContext(): SettingsSource {
    return this.currentSource;
  }

  public setOnBack(cb: (source: SettingsSource) => void): void {
    this.onBackCallback = cb;
  }

  public dispose(): void {
    this.unsubscribePrefs?.();
    this.hide();
  }
}
