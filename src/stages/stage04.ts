import { StageDefinition } from './StageDefinition';
import { LEVEL_04 } from '../levels/level04';
import { EnemyArchetypeId } from '../config/enemyArchetypes';
import { PowerupType } from '../config/powerups';

/**
 * Deterministic Stage 04 24-enemy archetype sequence:
 * 6 STANDARD, 10 FAST, 8 ARMOR.
 * Total score on perfect clear: 6*100 + 10*150 + 8*300 = 600 + 1500 + 2400 = 4500 pts.
 */
export const STAGE_04_ENEMY_SEQUENCE: readonly EnemyArchetypeId[] = [
  EnemyArchetypeId.STANDARD, // 1
  EnemyArchetypeId.FAST,     // 2
  EnemyArchetypeId.FAST,     // 3
  EnemyArchetypeId.ARMOR,    // 4
  EnemyArchetypeId.STANDARD, // 5
  EnemyArchetypeId.FAST,     // 6 (Milestone 1: AEGIS FIELD)
  EnemyArchetypeId.ARMOR,    // 7
  EnemyArchetypeId.FAST,     // 8
  EnemyArchetypeId.ARMOR,    // 9
  EnemyArchetypeId.STANDARD, // 10
  EnemyArchetypeId.FAST,     // 11
  EnemyArchetypeId.ARMOR,    // 12 (Milestone 2: OVERDRIVE CORE)
  EnemyArchetypeId.FAST,     // 13
  EnemyArchetypeId.FAST,     // 14
  EnemyArchetypeId.ARMOR,    // 15
  EnemyArchetypeId.STANDARD, // 16
  EnemyArchetypeId.ARMOR,    // 17
  EnemyArchetypeId.FAST,     // 18 (Milestone 3: STASIS PULSE)
  EnemyArchetypeId.STANDARD, // 19
  EnemyArchetypeId.FAST,     // 20
  EnemyArchetypeId.ARMOR,    // 21
  EnemyArchetypeId.FAST,     // 22
  EnemyArchetypeId.STANDARD, // 23
  EnemyArchetypeId.ARMOR,    // 24: Final heavy nexus defender
];

/**
 * Authoritative Stage 04 Definition for Battle City 2026.
 * "NEXUS SIEGE - BREAK THE RELAY GRID"
 */
export const STAGE_04_DEFINITION: StageDefinition = {
  id: 'stage04',
  stageNumber: 4,
  displayName: 'NEXUS SIEGE',
  missionTitle: 'BREAK THE RELAY GRID',

  level: LEVEL_04,

  enemySequence: STAGE_04_ENEMY_SEQUENCE,

  maxActiveEnemies: 4,
  enemySpawnInterval: 0.90,

  startingLives: 3,

  powerupMilestones: [
    { destroyedEnemyCount: 6, type: PowerupType.AEGIS_FIELD },
    { destroyedEnemyCount: 12, type: PowerupType.OVERDRIVE_CORE },
    { destroyedEnemyCount: 18, type: PowerupType.STASIS_PULSE },
  ],

  stageTheme: {
    floorColor: '#11151c',
    borderColor: '#1f2937',
    accentColor: '#00d2ff',
  },

  presentation: {
    ambientColor: '#11151c',
    accentColor: '#00d2ff',
    secondaryAccentColor: '#ff8c00',
    hazardColor: '#ffaa00',
    pulseEnabled: false,
    pulseRate: 2.2,
    floorTheme: 'DEFAULT',
    stageAudioProfile: 'NEXUS',
  },

  nextStageId: null, // Terminal stage in 4-stage campaign
};

export const stage04 = STAGE_04_DEFINITION;
