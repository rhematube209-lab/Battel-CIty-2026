import { StageResult } from '../stages/StageDefinition';

/**
 * StageCompleteUI manages the victory modal overlay presented upon destroying all stage enemies.
 * Features glowing cyan/gold accents, dynamic stage title, archetype kill breakdown,
 * and adaptive action button (CONTINUE to next stage vs REPLAY current stage).
 */
export class StageCompleteUI {
  private overlay: HTMLElement | null;
  private replayBtn: HTMLElement | null;
  private btnTextElement: HTMLElement | null;
  private promptElement: HTMLElement | null;
  private scoreElement: HTMLElement | null;
  private subtitleElement: HTMLElement | null;
  private tallyElement: HTMLElement | null;
  private onReplayCallback?: () => void;
  private onContinueCallback?: () => void;
  private hasNextStage: boolean = false;
  private isVisible: boolean = false;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onReplayCallback?: () => void, onContinueCallback?: () => void) {
    this.onReplayCallback = onReplayCallback;
    this.onContinueCallback = onContinueCallback;
    this.overlay = document.getElementById('stageCompleteOverlay');
    this.replayBtn = document.getElementById('replayStageBtn');
    this.btnTextElement = this.replayBtn?.querySelector('.btn-text') ?? this.replayBtn;
    this.promptElement = this.overlay?.querySelector('.stage-complete-prompt') ?? null;
    this.scoreElement = document.getElementById('stageCompleteScore');
    this.subtitleElement = document.getElementById('stageCompleteSubtitle');
    this.tallyElement = document.getElementById('stageCompleteTally');

    this.replayBtn?.addEventListener('click', () => {
      this.triggerAction();
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.isVisible && (e.code === 'Enter' || e.code === 'Space')) {
        this.triggerAction();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    this.hide();
  }

  private triggerAction(): void {
    if (!this.isVisible) return;
    this.hide();
    if (this.hasNextStage && this.onContinueCallback) {
      this.onContinueCallback();
    } else {
      this.onReplayCallback?.();
    }
  }

  public setReplayCallback(callback: () => void): void {
    this.onReplayCallback = callback;
  }

  public setContinueCallback(callback: () => void): void {
    this.onContinueCallback = callback;
  }

  public getButtonText(): string {
    return this.btnTextElement?.textContent?.trim() ?? '';
  }

  public getHasNextStage(): boolean {
    return this.hasNextStage;
  }

  /**
   * Displays Stage Clear victory modal.
   * Dynamically sets formatted score, stage number, archetype destruction tally,
   * and adapts the action button to CONTINUE (if hasNextStage) or REPLAY STAGE (if terminal).
   */
  public show(
    formattedScore: string,
    stageNumber: number = 1,
    stageResult?: StageResult,
    hasNextStage: boolean = false
  ): void {
    this.isVisible = true;
    this.hasNextStage = hasNextStage;

    if (this.btnTextElement) {
      this.btnTextElement.textContent = hasNextStage ? 'CONTINUE' : 'REPLAY STAGE';
    }

    if (this.promptElement) {
      this.promptElement.innerHTML = hasNextStage
        ? 'PRESS <span class="key-badge">ENTER</span> TO CONTINUE'
        : 'PRESS <span class="key-badge">R</span> TO REPLAY';
    }

    if (this.scoreElement) {
      this.scoreElement.textContent = formattedScore;
    }

    if (this.subtitleElement) {
      this.subtitleElement.textContent = `STAGE ${stageNumber.toString().padStart(2, '0')} COMPLETE`;
    }

    if (this.tallyElement && stageResult) {
      this.renderTally(stageResult);
    } else if (this.tallyElement) {
      this.tallyElement.innerHTML = '';
    }

    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
    }
  }

  private renderTally(result: StageResult): void {
    if (!this.tallyElement) return;

    const standardCount = result.archetypeKills.STANDARD ?? 0;
    const fastCount = result.archetypeKills.FAST ?? 0;
    const armorCount = result.archetypeKills.ARMOR ?? 0;

    this.tallyElement.innerHTML = `
      <div class="tally-row">
        <span class="tally-label">STANDARD</span>
        <span class="tally-calc">${standardCount} × 100</span>
        <span class="tally-subtotal">${(standardCount * 100).toString().padStart(6, '0')}</span>
      </div>
      <div class="tally-row">
        <span class="tally-label">FAST</span>
        <span class="tally-calc">${fastCount} × 150</span>
        <span class="tally-subtotal">${(fastCount * 150).toString().padStart(6, '0')}</span>
      </div>
      <div class="tally-row">
        <span class="tally-label">ARMOR</span>
        <span class="tally-calc">${armorCount} × 300</span>
        <span class="tally-subtotal">${(armorCount * 300).toString().padStart(6, '0')}</span>
      </div>
    `;
  }

  public hide(): void {
    this.isVisible = false;
    if (this.overlay) {
      this.overlay.classList.remove('visible');
      this.overlay.classList.add('hidden');
      this.overlay.style.display = 'none';
    }
  }

  public isModalVisible(): boolean {
    return this.isVisible;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.overlay = null;
    this.replayBtn = null;
    this.btnTextElement = null;
    this.promptElement = null;
    this.scoreElement = null;
    this.subtitleElement = null;
    this.tallyElement = null;
  }
}
