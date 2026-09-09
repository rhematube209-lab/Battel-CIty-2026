/**
 * ControlsUI manages the reference modal displaying actual game controls
 * for desktop keyboard and mobile touch interface.
 * Enforces Phase 17 overlay safety standards.
 */

export class ControlsUI {
  private overlay: HTMLElement | null;
  private backBtn: HTMLButtonElement | null;
  private onBackCallback?: () => void;
  private _isModalVisible: boolean = false;

  constructor(onBack: () => void) {
    this.onBackCallback = onBack;
    this.overlay = document.getElementById('controlsOverlay');
    this.backBtn = document.getElementById('controlsBackBtn') as HTMLButtonElement | null;

    this.backBtn?.addEventListener('click', () => this.handleBack());

    this.hide();
  }

  private handleBack(): void {
    this.hide();
    this.onBackCallback?.();
  }

  public show(): void {
    this._isModalVisible = true;
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
      this.overlay.removeAttribute?.('aria-hidden');
    }
    setTimeout(() => {
      this.backBtn?.focus?.();
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

  public setOnBack(cb: () => void): void {
    this.onBackCallback = cb;
  }

  public dispose(): void {
    this.hide();
  }
}
