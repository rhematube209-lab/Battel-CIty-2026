import { StageDefinition } from './StageDefinition';
import { LEVEL_02 } from '../levels/level02';
import { EnemyArchetypeId } from '../config/enemyArchetypes';
import { PowerupType } from '../config/powerups';

/**
 * Deterministic Stage 02 16-enemy archetype sequence:
 * 5 STANDARD, 6 FAST, 5 ARMOR.
 * Total score on perfect clear: 5*100 + 6*150 + 5*300 = 2900 pts.
 */
export const STAGE_02_ENEMY_SEQUENCE: readonly EnemyArchetypeId[] = [
  EnemyArchetypeId.STANDARD, // 1
  EnemyArchetypeId.FAST,     // 2
  EnemyArchetypeId.STANDARD, // 3
  EnemyArchetypeId.ARMOR,    // 4
  EnemyArchetypeId.FAST,     // 5
  EnemyArchetypeId.STANDARD, // 6
  EnemyArchetypeId.FAST,     // 7
  EnemyArchetypeId.ARMOR,    // 8
  EnemyArchetypeId.STANDARD, // 9
  EnemyArchetypeId.FAST,     // 10
  EnemyArchetypeId.ARMOR,    // 11
  EnemyArchetypeId.FAST,     // 12
  EnemyArchetypeId.STANDARD, // 13
  EnemyArchetypeId.ARMOR,    // 14
  EnemyArchetypeId.FAST,     // 15
  EnemyArchetypeId.ARMOR,    // 16: Final Armor heavy anchor
];

/**
 * Authoritative Stage 02 Definition for Battle City 2026.
 * "IRON DELTA - HOLD THE REACTOR LINE"
 */
export const STAGE_02_DEFINITION: StageDefinition = {
  id: 'stage02',
  stageNumber: 2,
  displayName: 'IRON DELTA',
  missionTitle: 'HOLD THE REACTOR LINE',

  level: LEVEL_02,

  enemySequence: STAGE_02_ENEMY_SEQUENCE,

  maxActiveEnemies: 4,
  enemySpawnInterval: 1.10,

  startingLives: 3,

  powerupMilestones: [
    { destroyedEnemyCount: 4, type: PowerupType.AEGIS_FIELD },
    { destroyedEnemyCount: 8, type: PowerupType.OVERDRIVE_CORE },
    { destroyedEnemyCount: 12, type: PowerupType.STASIS_PULSE },
  ],

  stageTheme: {
    floorColor: '#0c151c',
    borderColor: '#1b2a3a',
    accentColor: '#00e5ff',
  },

  nextStageId: 'stage03',
};

export const stage02 = STAGE_02_DEFINITION;
