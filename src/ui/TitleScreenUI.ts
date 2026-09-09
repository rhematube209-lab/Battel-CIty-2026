import { BUILD_INFO } from '../config/buildInfo';

/**
 * TitleScreenUI manages the launch screen overlay:
 * "BATTLE CITY 2026 - TACTICAL ARMORED NETWORK"
 * Buttons: START CAMPAIGN, SETTINGS, CONTROLS.
 * Enforces Phase 17 overlay safety standards (display: none !important when hidden).
 */

export class TitleScreenUI {
  private overlay: HTMLElement | null;
  private startBtn: HTMLButtonElement | null;
  private settingsBtn: HTMLButtonElement | null;
  private controlsBtn: HTMLButtonElement | null;

  private onStartCallback?: () => void;
  private onSettingsCallback?: () => void;
  private onControlsCallback?: () => void;

  private _isModalVisible: boolean = false;
  private isStarting: boolean = false;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(
    onStart: () => void,
    onSettings: () => void,
    onControls: () => void
  ) {
    this.onStartCallback = onStart;
    this.onSettingsCallback = onSettings;
    this.onControlsCallback = onControls;

    this.overlay = document.getElementById('titleScreenOverlay');
    this.startBtn = document.getElementById('startCampaignBtn') as HTMLButtonElement | null;
    this.settingsBtn = document.getElementById('titleSettingsBtn') as HTMLButtonElement | null;
    this.controlsBtn = document.getElementById('titleControlsBtn') as HTMLButtonElement | null;

    // Authoritatively populate footer version from BUILD_INFO (Single Source of Truth)
    const versionEl = this.overlay?.querySelector('.footer-version');
    if (versionEl) {
      versionEl.textContent = `v${BUILD_INFO.version}`;
    }

    this.startBtn?.addEventListener('click', () => this.handleStartClick());
    this.settingsBtn?.addEventListener('click', () => this.onSettingsCallback?.());
    this.controlsBtn?.addEventListener('click', () => this.onControlsCallback?.());

    this.keyHandler = (e: KeyboardEvent) => {
      if (this._isModalVisible && e.code === 'Enter') {
        e.preventDefault();
        this.handleStartClick();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Guarantee initial hidden state before explicit show
    this.hide();
  }

  private handleStartClick(): void {
    if (!this._isModalVisible || this.isStarting) return;
    this.isStarting = true;
    this.hide();
    this.onStartCallback?.();
    // Reset starting flag on next tick
    setTimeout(() => {
      this.isStarting = false;
    }, 300);
  }

  public show(): void {
    this._isModalVisible = true;
    this.isStarting = false;
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
      this.overlay.removeAttribute?.('aria-hidden');
    }
    this.startBtn?.focus?.();
    setTimeout(() => {
      this.startBtn?.focus?.();
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

  public setOnStart(cb: () => void): void {
    this.onStartCallback = cb;
  }

  public setOnSettings(cb: () => void): void {
    this.onSettingsCallback = cb;
  }

  public setOnControls(cb: () => void): void {
    this.onControlsCallback = cb;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.hide();
  }
}
