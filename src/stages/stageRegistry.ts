import { StageDefinition, validateStageDefinition } from './StageDefinition';
import { STAGE_01_DEFINITION } from './stage01';
import { STAGE_02_DEFINITION } from './stage02';
import { STAGE_03_DEFINITION } from './stage03';
import { STAGE_04_DEFINITION } from './stage04';

/**
 * In-memory registry of all available StageDefinitions.
 * Fails fast with clear validation error on duplicate, invalid stage registrations,
 * missing nextStageId references, or self-referencing cycles.
 */
export class StageRegistry {
  private stages: Map<string, StageDefinition> = new Map();

  constructor() {
    this.registerStage(STAGE_01_DEFINITION);
    this.registerStage(STAGE_02_DEFINITION);
    this.registerStage(STAGE_03_DEFINITION);
    this.registerStage(STAGE_04_DEFINITION);
    this.validateLinks();
  }

  /**
   * Registers a validated StageDefinition.
   * Throws if stage is invalid or if a stage with the same ID already exists.
   */
  public registerStage(definition: StageDefinition): void {
    validateStageDefinition(definition);

    if (this.stages.has(definition.id)) {
      throw new Error(`StageRegistry error: Duplicate stage id '${definition.id}' already registered`);
    }

    this.stages.set(definition.id, definition);
  }

  /**
   * Validates that all non-null nextStageId references point to existing registered stages
   * and that no stage contains an invalid self-reference.
   */
  public validateLinks(): void {
    for (const stage of this.stages.values()) {
      if (stage.nextStageId !== null) {
        if (stage.nextStageId === stage.id) {
          throw new Error(`StageRegistry error: Stage '${stage.id}' has an invalid self-referencing nextStageId '${stage.nextStageId}'`);
        }
        if (!this.stages.has(stage.nextStageId)) {
          throw new Error(`StageRegistry error: Stage '${stage.id}' references missing nextStageId '${stage.nextStageId}'`);
        }
      }
    }
  }

  /**
   * Retrieves a StageDefinition by its unique identifier.
   */
  public getStageDefinition(id: string): StageDefinition | null {
    return this.stages.get(id) ?? null;
  }

  /**
   * Retrieves a StageDefinition by its numeric stage number.
   */
  public getStageByNumber(stageNumber: number): StageDefinition | null {
    for (const stage of this.stages.values()) {
      if (stage.stageNumber === stageNumber) {
        return stage;
      }
    }
    return null;
  }

  /**
   * Returns all registered stages.
   */
  public getAllStages(): StageDefinition[] {
    return Array.from(this.stages.values());
  }

  /**
   * Clears registry for testing.
   */
  public clear(): void {
    this.stages.clear();
  }

  /**
   * Restores pristine state with default STAGE_01_DEFINITION and STAGE_02_DEFINITION.
   */
  public reset(): void {
    this.stages.clear();
    this.registerStage(STAGE_01_DEFINITION);
    this.registerStage(STAGE_02_DEFINITION);
    this.registerStage(STAGE_03_DEFINITION);
    this.registerStage(STAGE_04_DEFINITION);
    this.validateLinks();
  }
}

export const stageRegistry = new StageRegistry();

export const STAGES: Record<string, StageDefinition> = {
  stage01: STAGE_01_DEFINITION,
  stage02: STAGE_02_DEFINITION,
  stage03: STAGE_03_DEFINITION,
  stage04: STAGE_04_DEFINITION,
};
