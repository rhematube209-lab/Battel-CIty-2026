import { StageDefinition, StageResult } from '../stages/StageDefinition';
import { stageRegistry, StageRegistry } from '../stages/stageRegistry';

/**
 * StageManager manages stage lifecycle, active StageDefinition, stage progression,
 * and completion results.
 * Strictly decoupled from 3D rendering, entity meshes, or scene nodes.
 */
export class StageManager {
  private registry: StageRegistry;
  private currentStage: StageDefinition;
  private lastResult: StageResult | null = null;

  constructor(initialStageId: string = 'stage01', registry: StageRegistry = stageRegistry) {
    this.registry = registry;
    const stage = this.registry.getStageDefinition(initialStageId);
    if (!stage) {
      throw new Error(`StageManager error: Could not load initial stage '${initialStageId}'`);
    }
    this.currentStage = stage;
  }

  /**
   * Loads and switches the active stage by stage ID from the registry.
   */
  public load(stageId: string): StageDefinition {
    const stage = this.registry.getStageDefinition(stageId);
    if (!stage) {
      throw new Error(`StageManager error: Stage with id '${stageId}' not found in registry`);
    }
    this.currentStage = stage;
    this.lastResult = null;
    return this.currentStage;
  }

  /**
   * Directly sets the current stage definition (useful for synthetic test stages).
   */
  public loadDefinition(definition: StageDefinition): void {
    this.currentStage = definition;
    this.lastResult = null;
  }

  /**
   * Returns the currently active StageDefinition.
   */
  public getCurrentStage(): StageDefinition {
    return this.currentStage;
  }

  /**
   * Convenience getter for current stage number.
   */
  public getStageNumber(): number {
    return this.currentStage.stageNumber;
  }

  /**
   * Convenience getter for current stage display name.
   */
  public getDisplayName(): string {
    return this.currentStage.displayName;
  }

  /**
   * Convenience getter for current stage mission title.
   */
  public getMissionTitle(): string {
    return this.currentStage.missionTitle;
  }

  /**
   * Checks whether a valid next stage is defined and registered.
   */
  public hasNextStage(): boolean {
    if (!this.currentStage.nextStageId) return false;
    return this.registry.getStageDefinition(this.currentStage.nextStageId) !== null;
  }

  /**
   * Returns next stage id or null.
   */
  public getNextStageId(): string | null {
    return this.currentStage.nextStageId;
  }

  /**
   * Resolves and returns the next StageDefinition, or null if terminal stage.
   */
  public getNextStageDefinition(): StageDefinition | null {
    if (!this.currentStage.nextStageId) return null;
    return this.registry.getStageDefinition(this.currentStage.nextStageId);
  }

  /**
   * Advances progression to the next stage in the registry.
   * Throws if no next stage is defined.
   */
  public advanceToNextStage(): StageDefinition {
    if (!this.currentStage.nextStageId) {
      throw new Error(`StageManager error: Current stage '${this.currentStage.id}' has no nextStageId`);
    }
    return this.load(this.currentStage.nextStageId);
  }

  /**
   * Records completed stage analytics/results.
   */
  public setLastResult(result: StageResult): void {
    this.lastResult = result;
  }

  /**
   * Retrieves last completed stage result summary.
   */
  public getLastResult(): StageResult | null {
    return this.lastResult;
  }

  /**
   * Resets stage progression / result state for current stage replay.
   */
  public resetCurrentStage(): StageDefinition {
    this.lastResult = null;
    return this.currentStage;
  }
}
