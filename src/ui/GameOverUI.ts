export enum GameOverReason {
  BASE_DESTROYED = 'BASE_DESTROYED',
  PLAYER_DESTROYED = 'PLAYER_DESTROYED'
}

/**
 * GameOverUI manages the game over modal overlay,
 * presenting mission failure status and offering both
 * keyboard shortcut [R] and button-click restart actions.
 */
export class GameOverUI {
  private container: HTMLElement;
  private restartButton: HTMLButtonElement;
  private subtitleElement: HTMLElement | null = null;
  private onRestartCallback?: () => void;
  private isShown: boolean = false;

  constructor(onRestart?: () => void) {
    this.onRestartCallback = onRestart;

    // Check if element already exists in DOM or create it
    let existing = document.getElementById('gameOverOverlay');
    if (existing) {
      this.container = existing;
      this.restartButton = this.container.querySelector('#restartBtn') as HTMLButtonElement;
    } else {
      this.container = document.createElement('div');
      this.container.id = 'gameOverOverlay';
      this.container.className = 'game-over-overlay hidden';
      this.container.innerHTML = `
        <div class="game-over-modal">
          <div class="game-over-badge">MISSION FAILED</div>
          <h1 class="game-over-title">GAME OVER</h1>
          <p class="game-over-subtitle">COMMAND BASE DESTROYED</p>
          <div class="game-over-divider"></div>
          <p class="game-over-prompt">PRESS <span class="key-badge">R</span> TO RESTART</p>
          <button id="restartBtn" class="game-over-btn" type="button">
            <span class="btn-glow"></span>
            <span class="btn-text">RESTART MISSION</span>
          </button>
        </div>
      `;
      document.body.appendChild(this.container);
      this.restartButton = this.container.querySelector('#restartBtn') as HTMLButtonElement;
    }

    this.subtitleElement = this.container.querySelector('.game-over-subtitle');

    if (this.restartButton) {
      this.restartButton.addEventListener('click', this.handleButtonClick);
    }

    this.hide();
  }

  private handleButtonClick = (e: MouseEvent): void => {
    e.preventDefault();
    if (this.onRestartCallback) {
      this.onRestartCallback();
    }
  };

  /**
   * Sets callback to run when restart is requested.
   */
  public setOnRestart(cb: () => void): void {
    this.onRestartCallback = cb;
  }

  /**
   * Displays the Game Over overlay with context-specific failure reason.
   */
  public show(reason: GameOverReason = GameOverReason.BASE_DESTROYED): void {
    if (this.subtitleElement) {
      if (reason === GameOverReason.PLAYER_DESTROYED) {
        this.subtitleElement.textContent = 'PLAYER TANK DESTROYED';
      } else {
        this.subtitleElement.textContent = 'COMMAND BASE DESTROYED';
      }
    }
    this.isShown = true;
    this.container.style.display = 'flex';
    this.container.classList.remove('hidden');
    this.container.classList.add('visible');
    if (this.restartButton) {
      this.restartButton.blur();
    }
  }

  /**
   * Hides the Game Over overlay.
   */
  public hide(): void {
    this.isShown = false;
    this.container.classList.remove('visible');
    this.container.classList.add('hidden');
    this.container.style.display = 'none';
  }

  /**
   * Returns whether the Game Over overlay is currently visible.
   */
  public isVisible(): boolean {
    return this.isShown;
  }

  /**
   * Cleanup event listeners.
   */
  public dispose(): void {
    if (this.restartButton) {
      this.restartButton.removeEventListener('click', this.handleButtonClick);
    }
    if (this.container && this.container.parentElement) {
      this.container.parentElement.removeChild(this.container);
    }
  }
}
