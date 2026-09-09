import { StageResult } from '../stages/StageDefinition';
import { EnemyArchetypeId } from '../config/enemyArchetypes';

export const CAMPAIGN_START_STAGE_ID = 'stage01';

/**
 * Read-only snapshot of current campaign progress and state.
 */
export interface CampaignSnapshot {
  completedStages: readonly StageResult[];
  cumulativeScore: number;
  carriedLives: number;
  campaignComplete: boolean;
}

/**
 * Structured summary of an entire completed campaign run across all stages.
 */
export interface CampaignResult {
  stageResults: readonly StageResult[];
  totalScore: number;
  totalEnemiesDestroyed: number;
  totalArchetypeKills: Record<EnemyArchetypeId, number>;
  livesRemaining: number;
}

/**
 * CampaignSession manages high-level campaign progression, cumulative scoring,
 * cross-stage life carry, and stage retry checkpointing.
 *
 * Sits directly above StageManager:
 * CampaignSession -> StageManager -> StageDefinition -> Gameplay Systems
 *
 * Strictly decoupled from Babylon rendering, 3D meshes, input, and TileMap.
 */
export class CampaignSession {
  private completedStages: StageResult[] = [];
  private cumulativeScore: number = 0;
  private carriedLives: number = 3;
  private stageEntryLives: number = 3;
  private currentStageId: string = CAMPAIGN_START_STAGE_ID;
  private campaignComplete: boolean = false;

  constructor(initialLives: number = 3) {
    this.start(initialLives);
  }

  /**
   * Initializes a fresh campaign run starting at Stage 01.
   */
  public start(initialLives: number = 3): void {
    this.completedStages = [];
    this.cumulativeScore = 0;
    this.carriedLives = Math.max(1, initialLives);
    this.stageEntryLives = this.carriedLives;
    this.currentStageId = CAMPAIGN_START_STAGE_ID;
    this.campaignComplete = false;
  }

  /**
   * Checkpoints campaign entry state when entering or advancing to a stage.
   */
  public beginStage(stageId: string, fallbackStartingLives?: number): void {
    this.currentStageId = stageId;
    if (this.completedStages.length === 0 && fallbackStartingLives !== undefined) {
      this.carriedLives = Math.max(1, fallbackStartingLives);
    }
    // Checkpoint lives present upon entering this stage for safe Game Over retry
    this.stageEntryLives = this.carriedLives;
  }

  /**
   * Records a completed StageResult into campaign history.
   * Strictly idempotent: prevents duplicate calls for the same stageId from corrupting score or stage history.
   * Updates cumulative score, carried lives, and marks campaign completion if terminal.
   * Returns true if recorded, false if duplicate/ignored.
   */
  public recordStageResult(result: StageResult, isTerminalStage: boolean = false): boolean {
    if (!result || !result.stageId) {
      return false;
    }

    // Idempotent guard: ignore duplicate recording of already completed stage
    const alreadyRecorded = this.completedStages.some((s) => s.stageId === result.stageId);
    if (alreadyRecorded) {
      return false;
    }

    // Deep copy / freeze to guarantee immutability
    const immutableResult: StageResult = {
      stageId: result.stageId,
      stageNumber: result.stageNumber,
      finalScore: result.finalScore,
      enemiesDestroyed: result.enemiesDestroyed,
      archetypeKills: { ...result.archetypeKills },
      livesRemaining: Math.max(1, result.livesRemaining),
    };

    this.completedStages.push(immutableResult);
    this.cumulativeScore += immutableResult.finalScore;
    this.carriedLives = immutableResult.livesRemaining;

    if (isTerminalStage) {
      this.campaignComplete = true;
    }

    return true;
  }

  public recordStageComplete(
    stageDef: { id: string; stageNumber: number; nextStageId?: string | null },
    score: number,
    lives: number,
    archetypeKills: Record<EnemyArchetypeId, number> = { STANDARD: 0, FAST: 0, ARMOR: 0 }
  ): boolean {
    const isTerminal = stageDef ? (stageDef.nextStageId === null || stageDef.stageNumber === 3) : false;
    return this.recordStageResult(
      {
        stageId: stageDef ? stageDef.id : 'stage01',
        stageNumber: stageDef ? stageDef.stageNumber : 1,
        finalScore: score,
        enemiesDestroyed: Object.values(archetypeKills).reduce((a, b) => a + b, 0),
        archetypeKills,
        livesRemaining: lives,
      },
      isTerminal
    );
  }

  public prepareNextStage(carriedLives: number): void {
    this.carriedLives = carriedLives;
    this.stageEntryLives = carriedLives;
  }

  public restoreStageEntryLives(): number {
    this.carriedLives = this.stageEntryLives;
    return this.carriedLives;
  }

  public getCampaignResult(): CampaignResult {
    return this.buildCampaignResult();
  }

  /**
   * Returns cumulative score earned across all strictly COMPLETED stages.
   */
  public getCompletedScore(): number {
    return this.cumulativeScore;
  }

  /**
   * Returns live total score combining completed stages plus uncommitted active stage score.
   */
  public getDisplayTotal(currentStageScore: number): number {
    return this.cumulativeScore + Math.max(0, currentStageScore);
  }

  /**
   * Returns read-only array of completed stage results in completion sequence.
   */
  public getCompletedStages(): readonly StageResult[] {
    return this.completedStages;
  }

  /**
   * Returns player lives carried forward into the next stage or currently active.
   */
  public getCarriedLives(): number {
    return this.carriedLives;
  }

  /**
   * Returns player lives recorded at entry checkpoint of current stage.
   * Used for Game Over retry to prevent state corruption.
   */
  public getStageEntryLives(): number {
    return this.stageEntryLives;
  }

  /**
   * Returns current stage ID.
   */
  public getCurrentStageId(): string {
    return this.currentStageId;
  }

  /**
   * Returns whether the entire campaign has been completed.
   */
  public isComplete(): boolean {
    return this.campaignComplete;
  }

  /**
   * Aggregates completed stage results into a final CampaignResult summary.
   */
  public buildCampaignResult(): CampaignResult {
    const totalArchetypeKills: Record<EnemyArchetypeId, number> = {
      STANDARD: 0,
      FAST: 0,
      ARMOR: 0,
    };

    let totalEnemies = 0;
    for (const stage of this.completedStages) {
      totalEnemies += stage.enemiesDestroyed;
      if (stage.archetypeKills) {
        totalArchetypeKills.STANDARD += stage.archetypeKills.STANDARD ?? 0;
        totalArchetypeKills.FAST += stage.archetypeKills.FAST ?? 0;
        totalArchetypeKills.ARMOR += stage.archetypeKills.ARMOR ?? 0;
      }
    }

    return {
      stageResults: [...this.completedStages],
      totalScore: this.cumulativeScore,
      totalEnemiesDestroyed: totalEnemies,
      totalArchetypeKills,
      livesRemaining: this.carriedLives,
    };
  }

  /**
   * Resets campaign session state to initial conditions for a new campaign run.
   */
  public reset(initialLives: number = 3): void {
    this.start(initialLives);
  }

  public getScore(): number {
    return this.getCompletedScore();
  }

  public isCampaignComplete(): boolean {
    return this.isComplete();
  }

  public resetForNewCampaign(initialLives: number = 3): void {
    this.reset(initialLives);
  }

  /**
   * Returns an immutable snapshot of current campaign state.
   */
  public getSnapshot(): CampaignSnapshot {
    return {
      completedStages: [...this.completedStages],
      cumulativeScore: this.cumulativeScore,
      carriedLives: this.carriedLives,
      campaignComplete: this.campaignComplete,
    };
  }
}
