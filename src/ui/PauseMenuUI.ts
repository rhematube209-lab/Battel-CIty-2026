/**
 * PauseMenuUI manages the in-game pause screen:
 * - RESUME
 * - RESTART STAGE (with in-game confirmation dialog)
 * - SETTINGS
 * - RETURN TO TITLE (with in-game confirmation dialog)
 * Enforces Phase 17 overlay safety standards.
 */

export type ConfirmAction = 'RESTART' | 'RETURN_TITLE' | null;

export class PauseMenuUI {
  private overlay: HTMLElement | null;
  private resumeBtn: HTMLButtonElement | null;
  private restartBtn: HTMLButtonElement | null;
  private settingsBtn: HTMLButtonElement | null;
  private returnTitleBtn: HTMLButtonElement | null;

  // Compact Confirmation Box
  private confirmDialog: HTMLElement | null;
  private confirmMessageEl: HTMLElement | null;
  private confirmOkBtn: HTMLButtonElement | null;
  private confirmCancelBtn: HTMLButtonElement | null;
  private activeConfirmAction: ConfirmAction = null;

  private onResumeCallback?: () => void;
  private onRestartCallback?: () => void;
  private onSettingsCallback?: () => void;
  private onReturnTitleCallback?: () => void;

  private _isModalVisible: boolean = false;

  constructor(callbacks: {
    onResume: () => void;
    onRestartStage: () => void;
    onSettings: () => void;
    onReturnToTitle: () => void;
  }) {
    this.onResumeCallback = callbacks.onResume;
    this.onRestartCallback = callbacks.onRestartStage;
    this.onSettingsCallback = callbacks.onSettings;
    this.onReturnTitleCallback = callbacks.onReturnToTitle;

    this.overlay = document.getElementById('pauseMenuOverlay');
    this.resumeBtn = document.getElementById('pauseResumeBtn') as HTMLButtonElement | null;
    this.restartBtn = document.getElementById('pauseRestartBtn') as HTMLButtonElement | null;
    this.settingsBtn = document.getElementById('pauseSettingsBtn') as HTMLButtonElement | null;
    this.returnTitleBtn = document.getElementById('pauseReturnTitleBtn') as HTMLButtonElement | null;

    this.confirmDialog = document.getElementById('pauseConfirmDialog');
    this.confirmMessageEl = document.getElementById('pauseConfirmMessage');
    this.confirmOkBtn = document.getElementById('pauseConfirmOkBtn') as HTMLButtonElement | null;
    this.confirmCancelBtn = document.getElementById('pauseConfirmCancelBtn') as HTMLButtonElement | null;

    this.resumeBtn?.addEventListener('click', () => this.handleResume());
    this.restartBtn?.addEventListener('click', () => this.promptRestart());
    this.settingsBtn?.addEventListener('click', () => this.handleSettings());
    this.returnTitleBtn?.addEventListener('click', () => this.promptReturnTitle());

    this.confirmOkBtn?.addEventListener('click', () => this.handleConfirmOk());
    this.confirmCancelBtn?.addEventListener('click', () => this.closeConfirm());

    // Guarantee initial hidden state
    this.hide();
  }

  private handleResume(): void {
    if (!this._isModalVisible || this.activeConfirmAction !== null) return;
    this.hide();
    this.onResumeCallback?.();
  }

  private handleSettings(): void {
    if (!this._isModalVisible || this.activeConfirmAction !== null) return;
    this.hide();
    this.onSettingsCallback?.();
  }

  public promptRestart(): void {
    this.activeConfirmAction = 'RESTART';
    if (this.confirmMessageEl) {
      this.confirmMessageEl.textContent = 'RESTART CURRENT STAGE?';
    }
    if (this.confirmOkBtn) {
      this.confirmOkBtn.textContent = 'RESTART';
    }
    this.showConfirmDialog();
  }

  public promptReturnTitle(): void {
    this.activeConfirmAction = 'RETURN_TITLE';
    if (this.confirmMessageEl) {
      this.confirmMessageEl.textContent = 'END CURRENT CAMPAIGN? CURRENT RUN PROGRESS WILL BE LOST.';
    }
    if (this.confirmOkBtn) {
      this.confirmOkBtn.textContent = 'RETURN TO TITLE';
    }
    this.showConfirmDialog();
  }

  private showConfirmDialog(): void {
    if (this.confirmDialog) {
      this.confirmDialog.style.display = 'flex';
      this.confirmDialog.classList.remove('hidden');
      this.confirmDialog.classList.add('visible');
      this.confirmDialog.removeAttribute?.('aria-hidden');
    }
    this.confirmCancelBtn?.focus?.();
    setTimeout(() => {
      this.confirmCancelBtn?.focus?.();
    }, 50);
  }

  public closeConfirm(): void {
    this.activeConfirmAction = null;
    if (this.confirmDialog) {
      this.confirmDialog.style.display = 'none';
      this.confirmDialog.classList.add('hidden');
      this.confirmDialog.classList.remove('visible');
      this.confirmDialog.setAttribute?.('aria-hidden', 'true');
    }
    if (this._isModalVisible) {
      this.resumeBtn?.focus?.();
      setTimeout(() => {
        this.resumeBtn?.focus?.();
      }, 50);
    }
  }

  public isConfirmOpen(): boolean {
    return this.activeConfirmAction !== null;
  }

  private handleConfirmOk(): void {
    const action = this.activeConfirmAction;
    this.closeConfirm();
    this.hide();

    if (action === 'RESTART') {
      this.onRestartCallback?.();
    } else if (action === 'RETURN_TITLE') {
      this.onReturnTitleCallback?.();
    }
  }

  public show(): void {
    this._isModalVisible = true;
    this.closeConfirm();
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
      this.overlay.removeAttribute?.('aria-hidden');
    }
    this.resumeBtn?.focus?.();
    setTimeout(() => {
      this.resumeBtn?.focus?.();
    }, 50);
  }

  public hide(): void {
    this._isModalVisible = false;
    this.closeConfirm();
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

  public isConfirmDialogOpen(): boolean {
    return this.isConfirmOpen();
  }

  public closeConfirmDialog(): void {
    this.closeConfirm();
  }

  public setOnResume(cb: () => void): void {
    this.onResumeCallback = cb;
  }

  public setOnRestartStage(cb: () => void): void {
    this.onRestartCallback = cb;
  }

  public setOnSettings(cb: () => void): void {
    this.onSettingsCallback = cb;
  }

  public setOnReturnToTitle(cb: () => void): void {
    this.onReturnTitleCallback = cb;
  }

  public dispose(): void {
    this.hide();
  }
}
