/**
 * Battle City 2026 - Data-Driven Enemy Archetypes Configuration
 * Defines parameters for STANDARD, FAST, and ARMOR enemy tanks,
 * visual profiles (silhouette scaling, armor plates, colors),
 * AI behavioral profiles, and deterministic Stage 01 composition sequence.
 */

export enum EnemyArchetypeId {
  STANDARD = 'STANDARD',
  FAST = 'FAST',
  ARMOR = 'ARMOR',
}

export interface EnemyVisualProfile {
  // Color specifications
  accentColor: string;
  visorColor: string;
  chassisColor: string;
  armorColor: string;
  plateColor?: string;

  // Silhouette / Geometry modifiers (applied to pre-allocated nodes)
  hullWidthScale: number;
  hullHeightScale: number;
  turretScale: number;
  hasReinforcedPlates: boolean;
}

export interface EnemyAIProfile {
  decisionInterval: number; // Interval in seconds to reconsider heading
  stuckThreshold: number;   // Seconds without displacement before force-turning
  baseBias: number;         // Likelihood factor to head towards player command node
}

export interface EnemyArchetypeConfig {
  id: EnemyArchetypeId;
  name: string;
  maxHp: number;
  speed: number;
  fireCooldown: number;
  bulletSpeed: number;
  scoreValue: number;
  visualProfile: EnemyVisualProfile;
  aiProfile: EnemyAIProfile;
}

export const ENEMY_ARCHETYPES: Record<EnemyArchetypeId, EnemyArchetypeConfig> = {
  [EnemyArchetypeId.STANDARD]: {
    id: EnemyArchetypeId.STANDARD,
    name: 'Standard Scout',
    maxHp: 1,
    speed: 3.4,                  // Baseline Phase 7/8 speed
    fireCooldown: 0.85,          // Baseline Phase 7 cooldown
    bulletSpeed: 12.0,
    scoreValue: 100,
    visualProfile: {
      accentColor: '#ff6600',    // Standard warm arcade orange
      visorColor: '#ff3700',
      chassisColor: '#2a201c',
      armorColor: '#3d2e26',
      hullWidthScale: 1.0,
      hullHeightScale: 1.0,
      turretScale: 1.0,
      hasReinforcedPlates: false,
    },
    aiProfile: {
      decisionInterval: 0.45,
      stuckThreshold: 0.45,
      baseBias: 0.60,
    },
  },

  [EnemyArchetypeId.FAST]: {
    id: EnemyArchetypeId.FAST,
    name: 'Fast Raider',
    maxHp: 1,
    speed: 4.6,                  // High mobility flanking pressure (player is 5.0)
    fireCooldown: 0.95,
    bulletSpeed: 13.0,
    scoreValue: 150,
    visualProfile: {
      accentColor: '#ffaa00',    // Bright energetic amber
      visorColor: '#ffcc00',
      chassisColor: '#24201a',
      armorColor: '#353026',
      hullWidthScale: 0.88,      // Narrower, more streamlined chassis
      hullHeightScale: 0.86,     // Lower profile silhouette
      turretScale: 0.92,
      hasReinforcedPlates: false,
    },
    aiProfile: {
      decisionInterval: 0.32,    // Reconsiders direction more frequently for flanking
      stuckThreshold: 0.35,
      baseBias: 0.45,            // More active wandering/flanking behavior
    },
  },

  [EnemyArchetypeId.ARMOR]: {
    id: EnemyArchetypeId.ARMOR,
    name: 'Heavy Armored Tank',
    maxHp: 3,                    // Multi-hit durability (survives 2 player shots, dies on 3rd)
    speed: 2.8,                  // Deliberately slower heavy advance
    fireCooldown: 1.25,          // Slower cannon cycle (1.25s)
    bulletSpeed: 11.5,
    scoreValue: 300,
    visualProfile: {
      accentColor: '#e62200',    // Deep industrial crimson/orange
      visorColor: '#ff1100',
      chassisColor: '#342622',
      armorColor: '#4a3830',
      plateColor: '#5c463d',
      hullWidthScale: 1.12,      // Bulky wide chassis
      hullHeightScale: 1.08,     // Taller, heavier stance
      turretScale: 1.10,
      hasReinforcedPlates: true, // Pre-created side and front reinforced plates enabled
    },
    aiProfile: {
      decisionInterval: 0.50,    // Steady, persistent lane advance
      stuckThreshold: 0.55,
      baseBias: 0.75,            // Strong persistent baseward pressure
    },
  },
};
