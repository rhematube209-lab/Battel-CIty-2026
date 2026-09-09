import { CampaignResult } from '../game/CampaignSession';

/**
 * CampaignCompleteUI manages the victory modal overlay presented upon completing
 * the final campaign stage (Stage 03).
 *
 * Displays multi-stage breakdown, cumulative campaign score, full archetype destruction totals,
 * remaining carried lives, and the NEW CAMPAIGN action button with keyboard/touch support.
 */
export class CampaignCompleteUI {
  private overlay: HTMLElement | null;
  private newCampaignBtn: HTMLElement | null;
  private totalScoreEl: HTMLElement | null;
  private stage1ScoreEl: HTMLElement | null;
  private stage2ScoreEl: HTMLElement | null;
  private stage3ScoreEl: HTMLElement | null;
  private totalEnemiesEl: HTMLElement | null;
  private standardKillsEl: HTMLElement | null;
  private fastKillsEl: HTMLElement | null;
  private armorKillsEl: HTMLElement | null;
  private remainingLivesEl: HTMLElement | null;

  private onNewCampaignCallback?: () => void;
  private isVisible: boolean = false;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onNewCampaignCallback?: () => void) {
    this.onNewCampaignCallback = onNewCampaignCallback;

    this.overlay = document.getElementById('campaignCompleteOverlay');
    this.newCampaignBtn = document.getElementById('newCampaignBtn');
    this.totalScoreEl = document.getElementById('campaignCompleteTotalScore');
    this.stage1ScoreEl = document.getElementById('campaignStage1Score');
    this.stage2ScoreEl = document.getElementById('campaignStage2Score');
    this.stage3ScoreEl = document.getElementById('campaignStage3Score');
    this.totalEnemiesEl = document.getElementById('campaignTotalEnemies');
    this.standardKillsEl = document.getElementById('campaignStandardKills');
    this.fastKillsEl = document.getElementById('campaignFastKills');
    this.armorKillsEl = document.getElementById('campaignArmorKills');
    this.remainingLivesEl = document.getElementById('campaignRemainingLives');

    this.newCampaignBtn?.addEventListener('click', () => {
      this.triggerNewCampaign();
    });

    this.keyHandler = (e: KeyboardEvent) => {
      if (this.isVisible && (e.code === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        this.triggerNewCampaign();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Guarantee initial hidden state and display: none
    this.hide();
  }

  private triggerNewCampaign(): void {
    if (!this.isVisible) return;
    this.hide();
    this.onNewCampaignCallback?.();
  }

  public setOnNewCampaign(callback: () => void): void {
    this.onNewCampaignCallback = callback;
  }

  /**
   * Populates and reveals the Campaign Complete victory modal.
   */
  public show(result: CampaignResult): void {
    this.isVisible = true;

    if (this.totalScoreEl) {
      this.totalScoreEl.textContent = result.totalScore.toString().padStart(6, '0');
    }

    // Populate stage breakdown
    const stageScores = [this.stage1ScoreEl, this.stage2ScoreEl, this.stage3ScoreEl];
    (result.stageResults || []).forEach((stageResult, idx) => {
      if (idx < stageScores.length && stageScores[idx]) {
        stageScores[idx]!.textContent = stageResult.finalScore.toString().padStart(6, '0');
      }
    });

    if (this.totalEnemiesEl) {
      this.totalEnemiesEl.textContent = (result.totalEnemiesDestroyed ?? 0).toString();
    }

    if (this.standardKillsEl) {
      this.standardKillsEl.textContent = (result.totalArchetypeKills?.STANDARD ?? 0).toString();
    }

    if (this.fastKillsEl) {
      this.fastKillsEl.textContent = (result.totalArchetypeKills?.FAST ?? 0).toString();
    }

    if (this.armorKillsEl) {
      this.armorKillsEl.textContent = (result.totalArchetypeKills?.ARMOR ?? 0).toString();
    }

    if (this.remainingLivesEl) {
      this.remainingLivesEl.textContent = (result.livesRemaining ?? 0).toString();
    }

    if (this.overlay) {
      this.overlay.style.display = 'flex';
      this.overlay.classList.remove('hidden');
      this.overlay.classList.add('visible');
    }
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
    this.newCampaignBtn = null;
    this.totalScoreEl = null;
    this.stage1ScoreEl = null;
    this.stage2ScoreEl = null;
    this.stage3ScoreEl = null;
    this.totalEnemiesEl = null;
    this.standardKillsEl = null;
    this.fastKillsEl = null;
    this.armorKillsEl = null;
    this.remainingLivesEl = null;
  }
}
