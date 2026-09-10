import { LevelDefinition, validateLevelDefinition } from '../levels/LevelDefinition';
import { EnemyArchetypeId } from '../config/enemyArchetypes';
import { PowerupType } from '../config/powerups';

/**
 * Battlefield powerup drop milestone triggered on specific enemy kill counts.
 */
export interface PowerupMilestone {
  destroyedEnemyCount: number;
  type: PowerupType;
}

/**
 * Optional visual theme overrides for stage arena styling.
 */
export interface StageThemeConfig {
  floorColor?: string;
  borderColor?: string;
  accentColor?: string;
}

/**
 * Optional environmental and audio presentation configuration for a stage.
 * Decouples stage-specific visual identity and audio accents from Game.ts.
 */
export interface StagePresentationConfig {
  ambientColor?: string;
  accentColor?: string;
  secondaryAccentColor?: string;
  hazardColor?: string;
  pulseEnabled?: boolean;
  pulseRate?: number;
  floorTheme?: 'DEFAULT' | 'NEXUS';
  stageAudioProfile?: 'DEFAULT' | 'NEXUS';
}

/**
 * Authoritative, reusable data definition for a complete playable stage.
 * Decouples all stage-specific parameters from Game.ts and runtime systems.
 */
export interface StageDefinition {
  id: string;
  stageNumber: number;
  displayName: string;
  missionTitle: string;

  level: LevelDefinition;

  enemySequence: readonly EnemyArchetypeId[];

  maxActiveEnemies: number;
  enemySpawnInterval: number;

  startingLives: number;

  powerupMilestones: readonly PowerupMilestone[];

  stageTheme?: StageThemeConfig;
  presentation?: StagePresentationConfig;

  nextStageId: string | null;
}

/**
 * Structured summary of completed stage performance for results, scoring, and analytics.
 */
export interface StageResult {
  stageId: string;
  stageNumber: number;
  finalScore: number;
  enemiesDestroyed: number;
  archetypeKills: Record<EnemyArchetypeId, number>;
  livesRemaining: number;
}

/**
 * Validates stage definition rules, enemy counts, milestone constraints, and level layout.
 * Fails fast with descriptive Error during development if stage data is invalid.
 */
export function validateStageDefinition(stage: StageDefinition): void {
  if (!stage) {
    throw new Error('Stage validation error: StageDefinition is null or undefined');
  }

  if (!stage.id || typeof stage.id !== 'string' || stage.id.trim() === '') {
    throw new Error('Stage validation error: Missing or invalid stage id');
  }

  if (typeof stage.stageNumber !== 'number' || stage.stageNumber < 1) {
    throw new Error(`Stage validation error: stageNumber must be >= 1, got ${stage.stageNumber}`);
  }

  if (!stage.displayName || typeof stage.displayName !== 'string' || stage.displayName.trim() === '') {
    throw new Error('Stage validation error: Missing or invalid displayName');
  }

  if (!stage.enemySequence || stage.enemySequence.length === 0) {
    throw new Error('Stage validation error: enemySequence length must be > 0');
  }

  if (typeof stage.maxActiveEnemies !== 'number' || stage.maxActiveEnemies < 1) {
    throw new Error(`Stage validation error: maxActiveEnemies must be >= 1, got ${stage.maxActiveEnemies}`);
  }

  if (typeof stage.startingLives !== 'number' || stage.startingLives < 1) {
    throw new Error(`Stage validation error: startingLives must be >= 1, got ${stage.startingLives}`);
  }

  if (typeof stage.enemySpawnInterval !== 'number' || stage.enemySpawnInterval <= 0) {
    throw new Error(`Stage validation error: enemySpawnInterval must be > 0, got ${stage.enemySpawnInterval}`);
  }

  // Validate powerup milestones
  if (stage.powerupMilestones) {
    const seenCounts = new Set<number>();
    for (const milestone of stage.powerupMilestones) {
      if (typeof milestone.destroyedEnemyCount !== 'number' || milestone.destroyedEnemyCount <= 0) {
        throw new Error(
          `Stage validation error: milestone count must be positive, got ${milestone.destroyedEnemyCount}`
        );
      }

      if (milestone.destroyedEnemyCount > stage.enemySequence.length) {
        throw new Error(
          `Stage validation error: milestone count ${milestone.destroyedEnemyCount} exceeds total enemies ${stage.enemySequence.length}`
        );
      }

      if (seenCounts.has(milestone.destroyedEnemyCount)) {
        throw new Error(`Stage validation error: duplicate milestone count ${milestone.destroyedEnemyCount}`);
      }
      seenCounts.add(milestone.destroyedEnemyCount);
    }
  }

  // Validate embedded level definition
  if (!stage.level) {
    throw new Error('Stage validation error: Missing level definition in stage');
  }
  validateLevelDefinition(stage.level);

  // Validate optional presentation config
  if (stage.presentation) {
    if (
      stage.presentation.pulseRate !== undefined &&
      (typeof stage.presentation.pulseRate !== 'number' || stage.presentation.pulseRate <= 0)
    ) {
      throw new Error(
        `Stage validation error: presentation pulseRate must be > 0, got ${stage.presentation.pulseRate}`
      );
    }
  }
}

