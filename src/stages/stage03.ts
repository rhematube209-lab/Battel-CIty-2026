import { StageDefinition } from './StageDefinition';
import { LEVEL_03 } from '../levels/level03';
import { EnemyArchetypeId } from '../config/enemyArchetypes';
import { PowerupType } from '../config/powerups';

/**
 * Deterministic Stage 03 20-enemy archetype sequence:
 * 5 STANDARD, 8 FAST, 7 ARMOR.
 * Total score on perfect clear: 5*100 + 8*150 + 7*300 = 3800 pts.
 */
export const STAGE_03_ENEMY_SEQUENCE: readonly EnemyArchetypeId[] = [
  EnemyArchetypeId.STANDARD, // 1
  EnemyArchetypeId.FAST,     // 2
  EnemyArchetypeId.FAST,     // 3
  EnemyArchetypeId.ARMOR,    // 4
  EnemyArchetypeId.STANDARD, // 5 (Milestone 1: OVERDRIVE CORE)
  EnemyArchetypeId.FAST,     // 6
  EnemyArchetypeId.ARMOR,    // 7
  EnemyArchetypeId.FAST,     // 8
  EnemyArchetypeId.ARMOR,    // 9
  EnemyArchetypeId.STANDARD, // 10 (Milestone 2: AEGIS FIELD)
  EnemyArchetypeId.FAST,     // 11
  EnemyArchetypeId.ARMOR,    // 12
  EnemyArchetypeId.FAST,     // 13
  EnemyArchetypeId.STANDARD, // 14
  EnemyArchetypeId.ARMOR,    // 15 (Milestone 3: STASIS PULSE)
  EnemyArchetypeId.FAST,     // 16
  EnemyArchetypeId.ARMOR,    // 17
  EnemyArchetypeId.FAST,     // 18
  EnemyArchetypeId.STANDARD, // 19
  EnemyArchetypeId.ARMOR,    // 20: Final heavy anchor
];

/**
 * Authoritative Stage 03 Definition for Battle City 2026.
 * "FORGE LINE - BREAK THE FOUNDRY GRID"
 */
export const STAGE_03_DEFINITION: StageDefinition = {
  id: 'stage03',
  stageNumber: 3,
  displayName: 'FORGE LINE',
  missionTitle: 'BREAK THE FOUNDRY GRID',

  level: LEVEL_03,

  enemySequence: STAGE_03_ENEMY_SEQUENCE,

  maxActiveEnemies: 4,
  enemySpawnInterval: 1.00,

  startingLives: 3,

  powerupMilestones: [
    { destroyedEnemyCount: 5, type: PowerupType.OVERDRIVE_CORE },
    { destroyedEnemyCount: 10, type: PowerupType.AEGIS_FIELD },
    { destroyedEnemyCount: 15, type: PowerupType.STASIS_PULSE },
  ],

  stageTheme: {
    floorColor: '#140e0a',
    borderColor: '#30180d',
    accentColor: '#ff6600',
  },

  nextStageId: 'stage04',
};

export const stage03 = STAGE_03_DEFINITION;
