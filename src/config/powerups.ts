/**
 * Battlefield Powerup Configuration for Battle City 2026.
 * Centralized, data-driven registry for original futuristic powerups.
 */

export enum PowerupType {
  OVERDRIVE_CORE = 'OVERDRIVE_CORE',
  AEGIS_FIELD = 'AEGIS_FIELD',
  STASIS_PULSE = 'STASIS_PULSE',
}

export interface PowerupVisualProfile {
  primaryColor: string;
  glowColor: string;
  coreColor: string;
  casingColor: string;
}

export interface PowerupConfig {
  type: PowerupType;
  name: string;
  shortCode: string;
  duration: number; // in seconds
  scoreValue: number; // 0 for Phase 12 (enemy-kill based score only)
  visualProfile: PowerupVisualProfile;
  // Overdrive specific
  fireCooldown?: number;
  maxActiveBullets?: number;
}

export const POWERUP_CONFIGS: Record<PowerupType, PowerupConfig> = {
  [PowerupType.OVERDRIVE_CORE]: {
    type: PowerupType.OVERDRIVE_CORE,
    name: 'OVERDRIVE CORE',
    shortCode: 'OD',
    duration: 8.0,
    scoreValue: 0,
    fireCooldown: 0.18,
    maxActiveBullets: 3,
    visualProfile: {
      primaryColor: '#00e5ff', // Electric cyan
      glowColor: '#00b4d8',
      coreColor: '#ffffff',
      casingColor: '#1e293b',
    },
  },

  [PowerupType.AEGIS_FIELD]: {
    type: PowerupType.AEGIS_FIELD,
    name: 'AEGIS FIELD',
    shortCode: 'AG',
    duration: 6.0,
    scoreValue: 0,
    visualProfile: {
      primaryColor: '#38bdf8', // Blue-violet / cyan
      glowColor: '#6366f1',
      coreColor: '#e0e7ff',
      casingColor: '#1e1b4b',
    },
  },

  [PowerupType.STASIS_PULSE]: {
    type: PowerupType.STASIS_PULSE,
    name: 'STASIS PULSE',
    shortCode: 'ST',
    duration: 5.0,
    scoreValue: 0,
    visualProfile: {
      primaryColor: '#c084fc', // Violet / magenta-cyan
      glowColor: '#a855f7',
      coreColor: '#fae8ff',
      casingColor: '#2e1065',
    },
  },
};

/**
 * Deterministic enemy destruction milestones triggering battlefield drops in Stage 01.
 * Kill #3 -> OVERDRIVE CORE
 * Kill #6 -> AEGIS FIELD
 * Kill #9 -> STASIS PULSE
 */
export const POWERUP_DROP_MILESTONES: Record<number, PowerupType> = {
  3: PowerupType.OVERDRIVE_CORE,
  6: PowerupType.AEGIS_FIELD,
  9: PowerupType.STASIS_PULSE,
};

export const POWERUP_POOL_SIZE = 3;
export const POWERUP_DROP_LIFETIME = 10.0; // Seconds collectible remains on field
export const EXPIRATION_WARNING_TIME = 2.0; // Final seconds where flashing accelerates
export const COLLECTIBLE_HALF_EXTENT = 0.50; // Logical AABB ~1.0x1.0 world units
