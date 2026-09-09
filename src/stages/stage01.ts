import { StageDefinition } from './StageDefinition';
import { LEVEL_01 } from '../levels/level01';
import { EnemyArchetypeId } from '../config/enemyArchetypes';
import { PowerupType } from '../config/powerups';

/**
 * Deterministic Stage 01 12-enemy archetype sequence:
 * 5 STANDARD, 4 FAST, 3 ARMOR.
 * Total score on perfect clear: 5*100 + 4*150 + 3*300 = 2000 pts.
 */
export const STAGE_01_ENEMY_SEQUENCE: readonly EnemyArchetypeId[] = [
  EnemyArchetypeId.STANDARD, // 1
  EnemyArchetypeId.STANDARD, // 2
  EnemyArchetypeId.FAST,     // 3: Fast introduces mobility pressure
  EnemyArchetypeId.STANDARD, // 4
  EnemyArchetypeId.ARMOR,    // 5: Armor introduces multi-hit lane pressure
  EnemyArchetypeId.FAST,     // 6
  EnemyArchetypeId.STANDARD, // 7
  EnemyArchetypeId.FAST,     // 8
  EnemyArchetypeId.ARMOR,    // 9
  EnemyArchetypeId.STANDARD, // 10
  EnemyArchetypeId.FAST,     // 11
  EnemyArchetypeId.ARMOR,    // 12: Final Armor anchor
];

/**
 * Authoritative Stage 01 Definition for Battle City 2026.
 */
export const STAGE_01_DEFINITION: StageDefinition = {
  id: 'stage01',
  stageNumber: 1,
  displayName: 'CYBER OUTPOST',
  missionTitle: 'DEFEND COMMAND NODE',

  level: LEVEL_01,

  enemySequence: STAGE_01_ENEMY_SEQUENCE,

  maxActiveEnemies: 4,
  enemySpawnInterval: 1.25,

  startingLives: 3,

  powerupMilestones: [
    { destroyedEnemyCount: 3, type: PowerupType.OVERDRIVE_CORE },
    { destroyedEnemyCount: 6, type: PowerupType.AEGIS_FIELD },
    { destroyedEnemyCount: 9, type: PowerupType.STASIS_PULSE },
  ],

  stageTheme: {
    floorColor: '#11151c',
    borderColor: '#1f2937',
    accentColor: '#00d2ff',
  },

  nextStageId: 'stage02', // Progression link to Stage 02 (Iron Delta)
};

/**
 * Legacy compatibility structure for modules expecting STAGE_01_CONFIG.
 */
export interface StageConfig {
  stageNumber: number;
  totalEnemies: number;
  enemySequence: EnemyArchetypeId[];
}

export const STAGE_01_CONFIG: StageConfig = {
  stageNumber: STAGE_01_DEFINITION.stageNumber,
  totalEnemies: STAGE_01_DEFINITION.enemySequence.length,
  enemySequence: [...STAGE_01_DEFINITION.enemySequence],
};

export const stage01 = STAGE_01_DEFINITION;
