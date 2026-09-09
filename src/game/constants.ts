/**
 * Battle City 2026 Core Constants & Configuration
 */

export const GRID_ROWS = 13;
export const GRID_COLS = 13;
export const TILE_SIZE = 2.0;

export const ARENA_WIDTH = GRID_COLS * TILE_SIZE;   // 26.0 world units
export const ARENA_DEPTH = GRID_ROWS * TILE_SIZE;   // 26.0 world units
export const WALL_HEIGHT = 1.6;
export const BORDER_THICKNESS = 0.8;
export const BORDER_HEIGHT = 1.8;

export enum TileType {
  EMPTY = 0,
  BRICK = 1,
  STEEL = 2,
  BUSH = 3,
  WATER = 4,
  BASE = 5,
  PLAYER_SPAWN = 6,
  ENEMY_SPAWN = 7,
  CRYO = 8,
  CONVEYOR = 9,
}

export const CAMERA_CONFIG = {
  // Balanced top-down angle: high enough for grid clarity, tilted slightly for 3D depth
  FOV: 0.785, // ~45 degrees
  HEIGHT: 32.0,
  DISTANCE_OFFSET_Z: -12.0,
  TARGET_Y: 0,
  MAX_SHAKE_INTENSITY: 0.35,
};

export const DEBUG = false;

export interface GridPosition {
  row: number;
  column: number;
}

export const VISUAL_HEIGHTS = {
  BRICK: 1.2,
  STEEL: 1.2,
  BUSH: 0.9,
  BASE: 1.4,
  SPAWN_MARKER: 0.02,
  CRYO: 0.04,
  CONVEYOR: 0.04,
};

export const CONVEYOR_PUSH_SPEED = 2.0; // 2.0 world units per second directional transport

export const PLAYER_CONFIG = {
  SPEED: 5.0,                   // 5.0 world units per second
  COLLISION_HALF_EXTENT: 0.60,  // 1.20 x 1.20 unit square footprint for snag-free turns
  LANE_SNAP_TOLERANCE: 0.25,    // Subtle lane alignment assist in narrow corridors
  MAX_DELTA_TIME: 0.05,         // Max 50ms per frame to prevent tunneling
  MAX_SUBSTEP: 0.20,            // Sub-step movement partition
};

export const ENEMY_CONFIG = {
  SPEED: 3.4,                   // 3.4 world units per second (deliberately slightly slower than player)
  COLLISION_HALF_EXTENT: 0.60,  // 1.20 x 1.20 unit square footprint
  LANE_SNAP_TOLERANCE: 0.25,
  MAX_DELTA_TIME: 0.05,
  MAX_SUBSTEP: 0.20,
  FIRE_COOLDOWN: 0.85,          // 0.85 seconds between enemy shots
  BULLET_SPEED: 12.0,           // 12.0 world units per second
  MAX_ACTIVE_BULLETS: 2,        // Max 2 concurrent enemy bullets
  SPAWN_DELAY: 0.65,            // 0.65 seconds spawn delay
  AI_DECISION_INTERVAL: 0.45,   // Direction reassessment interval
  STUCK_THRESHOLD: 0.45,        // Stuck detector time threshold
  AIM_TOLERANCE: 0.30,          // Lane alignment tolerance for target detection
  AI_SEED: 2026,                // Deterministic PRNG seed
};

export const COLORS = {
  ARENA_FLOOR: '#11151c',
  ARENA_BORDER: '#1f2937',
  ACCENT_CYAN: '#00d2ff',
  ACCENT_ORANGE: '#ff7700',
  BRICK_WARM: '#c85028',
  BRICK_MORTAR: '#2a1a15',
  STEEL_METALLIC: '#8fa0b0',
  BUSH_GREEN: '#10b981',
  BASE_CORE: '#00d2ff',
  // Player Tank Palette
  PLAYER_CHASSIS: '#222f3e',
  PLAYER_ARMOR: '#34495e',
  PLAYER_ACCENT: '#00d2ff',
  PLAYER_TRACKS: '#10141a',
  PLAYER_COCKPIT: '#00e5ff',
  // Enemy Tank Palette
  ENEMY_CHASSIS: '#2a201c',
  ENEMY_ARMOR: '#3d2e26',
  ENEMY_ACCENT: '#ff6600',
  ENEMY_TRACKS: '#141110',
  ENEMY_VISOR: '#ff3700',
  // Projectile Palette
  BULLET_CORE: '#e6ffff',
  BULLET_GLOW: '#00e5ff',
  BULLET_ENEMY_CORE: '#fff2e6',
  BULLET_ENEMY_GLOW: '#ff5500',
  MUZZLE_FLASH: '#ffffff',
  SPARK_STEEL: '#a8d8ea',
  SPARK_BRICK: '#e67e22',
};

export enum ProjectileTeam {
  PLAYER = 0,
  ENEMY = 1,
}

/**
 * Global engine-wide combat rules (independent of individual stage definitions).
 */
export const COMBAT_CONFIG = {
  PLAYER_RESPAWN_DELAY: 1.00,          // 1.00 seconds before player re-materializes
  PLAYER_RESPAWN_INVULNERABILITY: 1.50, // 1.50 seconds of post-respawn invulnerability
  MAX_ACTIVE_ENEMY_BULLETS_TOTAL: 6,   // Team-wide enemy bullet limit
};

/**
 * @deprecated Prefer StageDefinition and COMBAT_CONFIG for runtime queries.
 * Retained for backward compatibility with legacy test harnesses.
 */
export const STAGE_CONFIG = {
  STAGE_NUMBER: 1,
  TOTAL_ENEMIES: 12,
  MAX_ACTIVE_ENEMIES: 4,
  PLAYER_STARTING_LIVES: 3,
  ENEMY_SCORE_VALUE: 100,
  ENEMY_SPAWN_INTERVAL: 1.25,          // 1.25 seconds between progressive spawns
  PLAYER_RESPAWN_DELAY: 1.00,          // 1.00 seconds before player re-materializes
  PLAYER_RESPAWN_INVULNERABILITY: 1.50, // 1.50 seconds of post-respawn invulnerability
  MAX_ACTIVE_ENEMY_BULLETS_TOTAL: 6,   // Team-wide enemy bullet limit
};

export const PROJECTILE_CONFIG = {
  SPEED: 13.0,                  // 13.0 world units per second
  PLAYER_FIRE_COOLDOWN: 0.28,   // 0.28 seconds between player shots
  MAX_LIFETIME: 3.0,            // 3.0 seconds max flight duration
  MAX_ACTIVE_PLAYER_BULLETS: 2, // Max concurrent player bullets
  POOL_SIZE: 16,                // Fixed pooled projectile capacity (2 player + 6 enemy + safety buffer)
  COLLISION_HALF_EXTENT: 0.10,  // ~0.20x0.20 projectile collision AABB
  MAX_SUBSTEP: 0.18,            // Substep movement limit to eliminate tunneling
  LENGTH: 0.30,                 // Visual mesh dimensions
  WIDTH: 0.12,
  HEIGHT: 0.12,
};

export interface ProjectileHit {
  type: TileType | 'BOUNDARY';
  row: number;
  column: number;
  worldPoint: { x: number; y: number; z: number };
  incomingDirection: number; // Direction enum
}
