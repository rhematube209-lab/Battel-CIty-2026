const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;

function gridToWorld(row, column) {
  const x = (column - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
  return { x, y: 0, z };
}

function worldToGrid(x, z) {
  if (isNaN(x) || isNaN(z)) return null;
  const col = Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2);
  const row = Math.round((GRID_ROWS - 1) / 2 - z / TILE_SIZE);
  if (row >= 0 && row < GRID_ROWS && col >= 0 && col < GRID_COLS) {
    return { row, column: col };
  }
  return null;
}

console.log('[TEST] Validating 13x13 Grid Coordinate Calculations...');

// 1. Center check
const center = gridToWorld(6, 6);
if (center.x !== 0 || center.z !== 0) {
  throw new Error(`Center test failed: got (${center.x}, ${center.z})`);
}
console.log('✓ gridToWorld(6, 6) = (0, 0)');

// 2. Corners check
const tl = gridToWorld(0, 0); // Row 0, Col 0 -> (-12, +12)
if (tl.x !== -12 || tl.z !== 12) throw new Error(`Top-left failed: ${JSON.stringify(tl)}`);
console.log('✓ Top-Left (0, 0) = (-12, +12)');

const br = gridToWorld(12, 12); // Row 12, Col 12 -> (+12, -12)
if (br.x !== 12 || br.z !== -12) throw new Error(`Bottom-right failed: ${JSON.stringify(br)}`);
console.log('✓ Bottom-Right (12, 12) = (+12, -12)');

// 3. Full round-trip check
for (let r = 0; r < GRID_ROWS; r++) {
  for (let c = 0; c < GRID_COLS; c++) {
    const w = gridToWorld(r, c);
    const g = worldToGrid(w.x, w.z);
    if (!g || g.row !== r || g.column !== c) {
      throw new Error(`Round-trip mismatch at [${r}, ${c}]: got ${JSON.stringify(g)}`);
    }
  }
}
console.log('✓ Full 13x13 (169 cells) round-trip worldToGrid(gridToWorld(r, c)) passed 100%');

// 4. Sub-tile tolerance check
const sub = worldToGrid(-11.6, 11.7);
if (!sub || sub.row !== 0 || sub.column !== 0) throw new Error(`Sub-tile tolerance failed`);
console.log('✓ Sub-tile tolerance test passed');

// 5. Out of bounds check
const oob = worldToGrid(15.0, -14.0);
if (oob !== null) throw new Error(`Out-of-bounds check failed`);
console.log('✓ Out-of-bounds check passed');

console.log('[SUCCESS] All grid validation tests passed cleanly!');
