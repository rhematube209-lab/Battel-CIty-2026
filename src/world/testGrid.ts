import { GRID_ROWS, GRID_COLS, TILE_SIZE, GridPosition } from '../game/constants';

/**
 * Pure coordinate conversion helper functions for standalone testing and runtime validation.
 */
export function gridToWorld(row: number, column: number): { x: number; y: number; z: number } {
  const x = (column - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
  return { x, y: 0, z };
}

export function worldToGrid(x: number, z: number): GridPosition | null {
  if (isNaN(x) || isNaN(z)) return null;

  const col = Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2);
  const row = Math.round((GRID_ROWS - 1) / 2 - z / TILE_SIZE);

  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    return { row, column: col };
  }
  return null;
}

export function runGridConversionTests(): void {
  console.log('[TEST] Running Grid Conversion Validation Tests...');

  // 1. Center alignment check
  const center = gridToWorld(6, 6);
  if (Math.abs(center.x) > 0.0001 || Math.abs(center.z) > 0.0001) {
    throw new Error(`[FAIL] gridToWorld(6, 6) expected (0,0), got (${center.x}, ${center.z})`);
  }
  console.log('✓ gridToWorld(6, 6) correctly maps to center (0, 0, 0)');

  // 2. Full 13x13 round-trip check
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const w = gridToWorld(r, c);
      const g = worldToGrid(w.x, w.z);
      if (!g || g.row !== r || g.column !== c) {
        throw new Error(`[FAIL] Round trip failed for [${r}, ${c}]: got ${JSON.stringify(g)}`);
      }
    }
  }
  console.log(`✓ Full ${GRID_ROWS}x${GRID_COLS} round-trip worldToGrid(gridToWorld(r, c)) passed`);

  // 3. Sub-tile tolerance check (tank moving inside cell)
  const offsetPos = gridToWorld(4, 8);
  const snapped = worldToGrid(offsetPos.x + 0.4, offsetPos.z - 0.4);
  if (!snapped || snapped.row !== 4 || snapped.column !== 8) {
    throw new Error(`[FAIL] Sub-tile offset test failed: got ${JSON.stringify(snapped)}`);
  }
  console.log('✓ Sub-tile offset tolerance passed');

  // 4. Out of bounds check
  const outOfBounds = worldToGrid(100, -100);
  if (outOfBounds !== null) {
    throw new Error(`[FAIL] Out of bounds check failed: expected null, got ${JSON.stringify(outOfBounds)}`);
  }
  console.log('✓ Out of bounds boundary check passed');

  console.log('[TEST] All Grid Conversion Tests Passed Successfully!');
}
