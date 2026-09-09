import { BUILD_INFO } from '../config/buildInfo';

export interface FatalErrorOptions {
  title?: string;
  message?: string;
  code?: string;
  isWebGLUnavailable?: boolean;
}

/**
 * FatalErrorUI handles critical boot and runtime initialization failures.
 * Conceals gameplay HUD, mobile controls, and all game-flow overlays to prevent
 * partial or occluded black-screen states. Provides a user-friendly diagnostic
 * notification and a browser reload action.
 */
export class FatalErrorUI {
  private overlay: HTMLElement;
  private titleElement: HTMLElement;
  private messageElement: HTMLElement;
  private codeElement: HTMLElement;
  private reloadBtn: HTMLButtonElement;

  constructor() {
    let el = document.getElementById('fatalErrorOverlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fatalErrorOverlay';
      el.className = 'fatal-error-overlay hidden';
      el.style.display = 'none';
      el.setAttribute('role', 'alertdialog');
      el.setAttribute('aria-modal', 'true');
      el.setAttribute('aria-labelledby', 'fatalErrorTitle');
      el.setAttribute('aria-describedby', 'fatalErrorMessage');

      el.innerHTML = `
        <div class="fatal-error-modal">
          <div class="fatal-error-badge">BOOT FAILURE</div>
          <h1 id="fatalErrorTitle" class="fatal-error-title">UNABLE TO INITIALIZE GAME</h1>
          <p id="fatalErrorMessage" class="fatal-error-message">A critical system initialization error occurred.</p>
          <div id="fatalErrorCode" class="fatal-error-code" style="display: none;"></div>
          <div class="fatal-error-actions">
            <button id="fatalReloadBtn" class="fatal-error-btn" type="button" aria-label="Reload Game">
              <span class="btn-text">RELOAD</span>
            </button>
          </div>
          <div class="fatal-error-footer">
            <span class="fatal-footer-version">${BUILD_INFO.name} v${BUILD_INFO.version} [${BUILD_INFO.channel}]</span>
          </div>
        </div>
      `;
      document.body.appendChild(el);
    }
    this.overlay = el;

    const versionEl = el.querySelector('.fatal-footer-version');
    if (versionEl) {
      versionEl.textContent = `${BUILD_INFO.name} v${BUILD_INFO.version} [${BUILD_INFO.channel}]`;
    }

    this.titleElement = document.getElementById('fatalErrorTitle') || el.querySelector('.fatal-error-title')!;
    this.messageElement = document.getElementById('fatalErrorMessage') || el.querySelector('.fatal-error-message')!;
    this.codeElement = document.getElementById('fatalErrorCode') || el.querySelector('.fatal-error-code')!;
    this.reloadBtn = (document.getElementById('fatalReloadBtn') || el.querySelector('.fatal-error-btn')!) as HTMLButtonElement;

    this.reloadBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }

  public show(options: FatalErrorOptions = {}): void {
    // 1. Hide HUD, mobile controls, and all standard game overlays
    this.suppressStandardUI();

    // 2. Format title and message
    const title = options.title || 'UNABLE TO INITIALIZE GAME';
    let message = options.message || 'A critical system initialization error occurred.';

    if (options.isWebGLUnavailable) {
      message = 'WEBGL GRAPHICS ARE UNAVAILABLE.\nTRY UPDATING YOUR BROWSER OR ENABLE HARDWARE ACCELERATION.';
    }

    if (this.titleElement) this.titleElement.textContent = title;
    if (this.messageElement) {
      this.messageElement.textContent = message;
      this.messageElement.style.whiteSpace = 'pre-line';
    }

    if (this.codeElement) {
      if (options.code) {
        this.codeElement.textContent = `DIAGNOSTIC: ${options.code}`;
        this.codeElement.style.display = 'block';
      } else {
        this.codeElement.style.display = 'none';
      }
    }

    // 3. Make overlay visible
    this.overlay.classList.remove('hidden');
    this.overlay.style.display = 'flex';
    this.overlay.removeAttribute('aria-hidden');

    // 4. Focus reload button
    setTimeout(() => {
      this.reloadBtn?.focus?.();
    }, 50);
  }

  public hide(): void {
    this.overlay.classList.add('hidden');
    this.overlay.style.display = 'none';
    this.overlay.setAttribute('aria-hidden', 'true');
  }

  public isVisible(): boolean {
    return this.overlay.style.display === 'flex' && !this.overlay.classList.contains('hidden');
  }

  /**
   * Specifically prevents the "static HUD visible + dead black game" bug
   * by concealing all standard UI elements when boot fails.
   */
  private suppressStandardUI(): void {
    const idsToHide = [
      'hud',
      'mobileControls',
      'titleScreenOverlay',
      'pauseMenuOverlay',
      'settingsOverlay',
      'controlsOverlay',
      'gameOverOverlay',
      'stageCompleteOverlay',
      'campaignCompleteOverlay',
      'rotateDeviceOverlay',
    ];

    for (const id of idsToHide) {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    }
  }
}
