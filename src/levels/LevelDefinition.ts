import { GRID_ROWS, GRID_COLS, TileType } from '../game/constants';
import { Direction } from '../game/Direction';

/**
 * Metadata definition for a single Mag-Drive Conveyor cell.
 */
export interface ConveyorDefinition {
  row: number;
  column: number;
  direction: Direction;
}

/**
 * Reusable stage terrain metadata container.
 */
export interface LevelTerrainMetadata {
  conveyors?: readonly ConveyorDefinition[];
}

/**
 * Reusable typed representation of a 13x13 combat maze layout.
 */
export interface LevelDefinition {
  id: string;
  rows: number;
  columns: number;
  tiles: readonly (readonly TileType[])[];
  terrainMetadata?: LevelTerrainMetadata;
}

/**
 * Validates level matrix dimensions, required spawn points, base existence, tile integrity,
 * and conveyor terrain metadata.
 * Throws a descriptive Error if any rule is violated.
 */
export function validateLevelDefinition(level: LevelDefinition): void {
  if (!level) {
    throw new Error('Level validation error: LevelDefinition is null or undefined');
  }

  if (!level.id || typeof level.id !== 'string' || level.id.trim() === '') {
    throw new Error('Level validation error: Missing or invalid level id');
  }

  if (level.rows !== GRID_ROWS || level.columns !== GRID_COLS) {
    throw new Error(
      `Level validation error: Expected ${GRID_ROWS}x${GRID_COLS} arena dimensions, got ${level.rows}x${level.columns}`
    );
  }

  if (!level.tiles || level.tiles.length !== level.rows) {
    throw new Error(
      `Level validation error: Expected ${level.rows} rows in tiles matrix, got ${level.tiles?.length ?? 0}`
    );
  }

  let playerCount = 0;
  let baseCount = 0;
  let enemyCount = 0;
  let conveyorCount = 0;

  for (let r = 0; r < level.rows; r++) {
    const row = level.tiles[r];
    if (!row || row.length !== level.columns) {
      throw new Error(
        `Level validation error: Row ${r} must have exactly ${level.columns} columns, got ${row?.length ?? 0}`
      );
    }

    for (let c = 0; c < level.columns; c++) {
      const val = row[c];
      if (val === undefined || val === null || val < TileType.EMPTY || val > TileType.CONVEYOR) {
        throw new Error(`Level validation error at [${r}, ${c}]: Unknown or invalid TileType ${val}`);
      }

      if (val === TileType.PLAYER_SPAWN) playerCount++;
      if (val === TileType.BASE) baseCount++;
      if (val === TileType.ENEMY_SPAWN) enemyCount++;
      if (val === TileType.CONVEYOR) conveyorCount++;
    }
  }

  if (playerCount !== 1) {
    throw new Error(`Level validation error: Expected exactly 1 PLAYER_SPAWN, found ${playerCount}`);
  }

  if (baseCount !== 1) {
    throw new Error(`Level validation error: Expected exactly 1 BASE, found ${baseCount}`);
  }

  if (enemyCount < 1) {
    throw new Error(`Level validation error: Expected at least 1 ENEMY_SPAWN, found ${enemyCount}`);
  }

  // Validate conveyor metadata
  const conveyors = level.terrainMetadata?.conveyors ?? [];
  const conveyorMap = new Set<string>();

  for (const conv of conveyors) {
    if (conv.row < 0 || conv.row >= level.rows || conv.column < 0 || conv.column >= level.columns) {
      throw new Error(
        `Level validation error: Conveyor metadata coordinate [${conv.row}, ${conv.column}] out of bounds`
      );
    }

    const key = `${conv.row}_${conv.column}`;
    if (conveyorMap.has(key)) {
      throw new Error(
        `Level validation error: Duplicate conveyor metadata entry at [${conv.row}, ${conv.column}]`
      );
    }
    conveyorMap.add(key);

    const actualTile = level.tiles[conv.row][conv.column];
    if (actualTile !== TileType.CONVEYOR) {
      throw new Error(
        `Level validation error: Conveyor metadata at [${conv.row}, ${conv.column}] references non-conveyor tile (${actualTile})`
      );
    }

    if (
      conv.direction !== Direction.NORTH &&
      conv.direction !== Direction.EAST &&
      conv.direction !== Direction.SOUTH &&
      conv.direction !== Direction.WEST
    ) {
      throw new Error(
        `Level validation error: Invalid conveyor direction ${conv.direction} at [${conv.row}, ${conv.column}]`
      );
    }
  }

  if (conveyorMap.size !== conveyorCount) {
    throw new Error(
      `Level validation error: Found ${conveyorCount} CONVEYOR tiles in matrix, but metadata defines ${conveyorMap.size}`
    );
  }
}
