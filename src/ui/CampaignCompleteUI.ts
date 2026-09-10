import { CampaignResult } from '../game/CampaignSession';
import { stageRegistry } from '../stages/stageRegistry';

/**
 * CampaignCompleteUI manages the victory modal overlay presented upon completing
 * the final campaign stage.
 *
 * Dynamically displays multi-stage breakdown for any number of campaign stages,
 * cumulative campaign score, full archetype destruction totals,
 * remaining carried lives, and the NEW CAMPAIGN action button with keyboard/touch support.
 */
export class CampaignCompleteUI {
  private overlay: HTMLElement | null;
  private newCampaignBtn: HTMLElement | null;
  private stagesBox: HTMLElement | null;
  private totalScoreEl: HTMLElement | null;
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
    this.stagesBox = (this.overlay && typeof this.overlay.querySelector === 'function')
      ? this.overlay.querySelector('.campaign-stages-box')
      : (typeof document !== 'undefined' && typeof document.querySelector === 'function')
        ? document.querySelector('.campaign-stages-box')
        : null;
    this.totalScoreEl = document.getElementById('campaignCompleteTotalScore');
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
   * Dynamically constructs DOM rows for all completed stages without hardcoding.
   */
  public show(result: CampaignResult): void {
    this.isVisible = true;

    if (this.totalScoreEl) {
      this.totalScoreEl.textContent = result.totalScore.toString().padStart(6, '0');
    }

    // Dynamically populate stage breakdown rows using safe DOM manipulation
    if (this.stagesBox && Array.isArray(result.stageResults) && typeof document !== 'undefined' && typeof document.createElement === 'function') {
      this.stagesBox.textContent = '';
      for (const stageResult of result.stageResults) {
        const row = document.createElement('div');
        row.className = 'campaign-stage-row';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'campaign-stage-name';
        const stageDef = stageRegistry.getStageDefinition(stageResult.stageId);
        const stageNumStr = stageResult.stageNumber.toString().padStart(2, '0');
        nameSpan.textContent = stageDef ? `${stageNumStr} ${stageDef.displayName}` : `STAGE ${stageNumStr}`;

        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'campaign-stage-score';
        scoreSpan.id = `campaignStage${stageResult.stageNumber}Score`;
        scoreSpan.textContent = stageResult.finalScore.toString().padStart(6, '0');

        row.appendChild(nameSpan);
        row.appendChild(scoreSpan);
        this.stagesBox.appendChild(row);
      }
    }

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
    this.stagesBox = null;
    this.totalScoreEl = null;
    this.totalEnemiesEl = null;
    this.standardKillsEl = null;
    this.fastKillsEl = null;
    this.armorKillsEl = null;
    this.remainingLivesEl = null;
  }
}
