/**
 * Standalone Automated Collision & AABB Footprint Validation Suite
 */

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;
const ARENA_HALF = 13.0;
const COLLISION_HALF = 0.60;

// Replicate TileType enum
const TileType = {
  EMPTY: 0,
  BRICK: 1,
  STEEL: 2,
  BUSH: 3,
  WATER: 4,
  BASE: 5,
  PLAYER_SPAWN: 6,
  ENEMY_SPAWN: 7,
};

function isSolidTile(type) {
  return (
    type === TileType.BRICK ||
    type === TileType.STEEL ||
    type === TileType.WATER ||
    type === TileType.BASE
  );
}

// Minimal 13x13 grid fixture matching Level 01
const fixture = [
  [7, 0, 0, 1, 0, 0, 7, 0, 0, 1, 0, 0, 7], // 0
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0], // 1
  [1, 1, 0, 1, 0, 2, 1, 2, 0, 1, 0, 1, 1], // 2 (Steel at col 5, 7)
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // 3
  [1, 2, 0, 1, 1, 0, 0, 0, 1, 1, 0, 2, 1], // 4
  [0, 0, 0, 0, 3, 3, 0, 3, 3, 0, 0, 0, 0], // 5 (Bush at col 4, 5, 7, 8)
  [2, 0, 1, 0, 3, 3, 0, 3, 3, 0, 1, 0, 2], // 6
  [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0], // 7
  [1, 1, 0, 1, 0, 2, 0, 2, 0, 1, 0, 1, 1], // 8
  [0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0], // 9
  [1, 0, 0, 1, 0, 1, 1, 1, 0, 1, 0, 0, 1], // 10
  [0, 0, 0, 0, 6, 1, 1, 1, 0, 0, 0, 0, 0], // 11 (Player at 4, Brick at 5,6,7)
  [1, 0, 0, 0, 0, 1, 5, 1, 0, 0, 0, 0, 1], // 12 (Base at 6, Brick at 5,7)
];

function gridToWorld(r, c) {
  return {
    x: (c - 6) * TILE_SIZE,
    z: (6 - r) * TILE_SIZE
  };
}

function checkPositionValid(x, z, grid = fixture) {
  const minX = x - COLLISION_HALF;
  const maxX = x + COLLISION_HALF;
  const minZ = z - COLLISION_HALF;
  const maxZ = z + COLLISION_HALF;

  // 1. Arena Boundary
  if (minX < -ARENA_HALF || maxX > ARENA_HALF || minZ < -ARENA_HALF || maxZ > ARENA_HALF) {
    return false;
  }

  // 2. Candidate tiles
  const minCol = Math.max(0, Math.floor((minX + ARENA_HALF) / TILE_SIZE));
  const maxCol = Math.min(12, Math.floor((maxX + ARENA_HALF) / TILE_SIZE));
  const minRow = Math.max(0, Math.floor((ARENA_HALF - maxZ) / TILE_SIZE));
  const maxRow = Math.min(12, Math.floor((ARENA_HALF - minZ) / TILE_SIZE));

  const EPSILON = 0.002;

  for (let r = minRow; r <= maxRow; r++) {
    for (let c = minCol; c <= maxCol; c++) {
      if (isSolidTile(grid[r][c])) {
        const tileMinX = 2 * c - 13;
        const tileMaxX = 2 * c - 11;
        const tileMinZ = 11 - 2 * r;
        const tileMaxZ = 13 - 2 * r;

        const overlapX = maxX > tileMinX + EPSILON && minX < tileMaxX - EPSILON;
        const overlapZ = maxZ > tileMinZ + EPSILON && minZ < tileMaxZ - EPSILON;

        if (overlapX && overlapZ) {
          return false;
        }
      }
    }
  }

  return true;
}

console.log('[TEST] Running Deterministic AABB Collision Tests...');

// 1. Empty tile accepted
const emptyPos = gridToWorld(1, 1);
if (!checkPositionValid(emptyPos.x, emptyPos.z)) {
  throw new Error('FAIL: Empty tile was incorrectly rejected');
}
console.log('✓ Empty tile accepted');

// 2. Bush tile accepted (passable)
const bushPos = gridToWorld(5, 4);
if (!checkPositionValid(bushPos.x, bushPos.z)) {
  throw new Error('FAIL: Bush tile was incorrectly rejected');
}
console.log('✓ Bush tile accepted (passable)');

// 3. Brick tile rejected
const brickPos = gridToWorld(0, 3);
if (checkPositionValid(brickPos.x, brickPos.z)) {
  throw new Error('FAIL: Brick tile was incorrectly accepted');
}
console.log('✓ Brick tile rejected (solid)');

// 4. Steel tile rejected
const steelPos = gridToWorld(2, 5);
if (checkPositionValid(steelPos.x, steelPos.z)) {
  throw new Error('FAIL: Steel tile was incorrectly accepted');
}
console.log('✓ Steel tile rejected (solid)');

// 5. Base tile rejected
const basePos = gridToWorld(12, 6);
if (checkPositionValid(basePos.x, basePos.z)) {
  throw new Error('FAIL: Base tile was incorrectly accepted');
}
console.log('✓ Base tile rejected (solid)');

// 6. Water tile rejected
const waterGrid = JSON.parse(JSON.stringify(fixture));
waterGrid[3][3] = TileType.WATER;
const waterPos = gridToWorld(3, 3);
if (checkPositionValid(waterPos.x, waterPos.z, waterGrid)) {
  throw new Error('FAIL: Water tile was incorrectly accepted');
}
console.log('✓ Water tile rejected (solid)');

// 7. Outside arena boundary rejected
if (checkPositionValid(13.2, 0)) throw new Error('FAIL: East boundary breach accepted');
if (checkPositionValid(-13.2, 0)) throw new Error('FAIL: West boundary breach accepted');
if (checkPositionValid(0, 13.2)) throw new Error('FAIL: North boundary breach accepted');
if (checkPositionValid(0, -13.2)) throw new Error('FAIL: South boundary breach accepted');
console.log('✓ Outside arena bounds rejected (all 4 cardinal edges)');

// 8. Corner Case: Center in EMPTY tile, but footprint AABB overlaps adjacent BRICK tile
// Row 1, Col 2 is EMPTY (center at -8.0, 10.0). Col 3 is BRICK (starts at x = -7.0).
// Tank at x = -7.4 has maxX = -7.4 + 0.60 = -6.8 > -7.0 (overlapping brick by 0.2 units).
if (checkPositionValid(-7.4, 10.0)) {
  throw new Error('FAIL: Footprint overlapping adjacent brick was not detected!');
}
console.log('✓ Corner Case: Center in empty cell with footprint overlapping adjacent brick REJECTED');

// When placed comfortably inside empty tile (x = -8.0, maxX = -7.4 < -7.0)
if (!checkPositionValid(-8.0, 10.0)) {
  throw new Error('FAIL: Footprint inside empty cell with safe clearance was rejected!');
}
console.log('✓ Footprint inside empty cell with safe clearance ACCEPTED');

console.log('[SUCCESS] All Collision & AABB Footprint Tests Passed Cleanly!');
