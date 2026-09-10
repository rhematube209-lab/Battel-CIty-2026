import { ActivePowerupStatus } from '../systems/PowerupSystem';

export interface EnemyArchetypeComposition {
  standard: number;
  fast: number;
  armor: number;
}

/**
 * Authoritative UI snapshot representing the complete gameplay HUD state.
 * Produced by Game and consumed by both TacticalCommandHUD (desktop) and CompactHUD (mobile).
 */
export interface TacticalHUDSnapshot {
  stageNumber: number;
  stageName: string;
  missionTitle: string;
  enemiesRemaining: number;
  totalEnemies: number;
  archetypeComposition?: EnemyArchetypeComposition;
  lives: number;
  stageScore: number;
  formattedStageScore: string;
  campaignScore: number;
  formattedCampaignScore: string;
  statusText: string;
  isDead: boolean;
  commandNodeStatus: 'SECURE' | 'LOST';
  activePowerups: readonly ActivePowerupStatus[];
  isMuted: boolean;
  isPaused: boolean;
}
