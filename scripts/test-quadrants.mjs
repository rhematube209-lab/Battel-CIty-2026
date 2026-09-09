/**
 * Phase 5 Automated Test Suite: 4-Quadrant Brick Destruction & Partial Collision
 * Covers Section 30, 31, 32, and 33 requirements.
 */

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;
const ARENA_HALF = 13.0;

const Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

function directionToVector(dir) {
  switch (dir) {
    case Direction.NORTH: return { x: 0, z: 1 };
    case Direction.EAST:  return { x: 1, z: 0 };
    case Direction.SOUTH: return { x: 0, z: -1 };
    case Direction.WEST:  return { x: -1, z: 0 };
  }
}

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

class MockBrickTile {
  constructor(row, col) {
    this.row = row;
    this.column = col;
    this.type = TileType.BRICK;
    this.worldPosition = {
      x: (col - 6) * TILE_SIZE,
      z: (6 - row) * TILE_SIZE
    };
    this.brickQuadrants = { tl: true, tr: true, bl: true, br: true };
  }

  isBrickQuadrantActive(q) {
    return !!this.brickQuadrants[q];
  }

  destroyBrickQuadrant(q) {
    if (!this.brickQuadrants[q]) return false;
    this.brickQuadrants[q] = false;
    return true;
  }

  hasAnyBrickQuadrants() {
    const { tl, tr, bl, br } = this.brickQuadrants;
    return tl || tr || bl || br;
  }

  isBrickFullyDestroyed() {
    return !this.hasAnyBrickQuadrants();
  }

  resetBrickQuadrants() {
    this.brickQuadrants = { tl: true, tr: true, bl: true, br: true };
  }

  getActiveQuadrantAABBs() {
    const cx = this.worldPosition.x;
    const cz = this.worldPosition.z;
    const list = [];
    if (this.brickQuadrants.tl) list.push({ quadrant: 'tl', minX: cx - 1.0, maxX: cx, minZ: cz, maxZ: cz + 1.0 });
    if (this.brickQuadrants.tr) list.push({ quadrant: 'tr', minX: cx, maxX: cx + 1.0, minZ: cz, maxZ: cz + 1.0 });
    if (this.brickQuadrants.bl) list.push({ quadrant: 'bl', minX: cx - 1.0, maxX: cx, minZ: cz - 1.0, maxZ: cz });
    if (this.brickQuadrants.br) list.push({ quadrant: 'br', minX: cx, maxX: cx + 1.0, minZ: cz - 1.0, maxZ: cz });
    return list;
  }
}

function mapHitToQuadrant(tile, hitPoint, dir) {
  const cx = tile.worldPosition.x;
  const cz = tile.worldPosition.z;

  if (dir === Direction.NORTH) {
    if (hitPoint.z < cz) {
      const southCandidate = hitPoint.x < cx ? 'bl' : 'br';
      if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
      const northCandidate = hitPoint.x < cx ? 'tl' : 'tr';
      if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
    } else {
      const northCandidate = hitPoint.x < cx ? 'tl' : 'tr';
      if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
    }
  } else if (dir === Direction.SOUTH) {
    if (hitPoint.z >= cz) {
      const northCandidate = hitPoint.x < cx ? 'tl' : 'tr';
      if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
      const southCandidate = hitPoint.x < cx ? 'bl' : 'br';
      if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
    } else {
      const southCandidate = hitPoint.x < cx ? 'bl' : 'br';
      if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
    }
  } else if (dir === Direction.EAST) {
    if (hitPoint.x < cx) {
      const westCandidate = hitPoint.z >= cz ? 'tl' : 'bl';
      if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
      const eastCandidate = hitPoint.z >= cz ? 'tr' : 'br';
      if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
    } else {
      const eastCandidate = hitPoint.z >= cz ? 'tr' : 'br';
      if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
    }
  } else if (dir === Direction.WEST) {
    if (hitPoint.x >= cx) {
      const eastCandidate = hitPoint.z >= cz ? 'tr' : 'br';
      if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
      const westCandidate = hitPoint.z >= cz ? 'tl' : 'bl';
      if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
    } else {
      const westCandidate = hitPoint.z >= cz ? 'tl' : 'bl';
      if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
    }
  }
  return null;
}

console.log('[TEST] Running Phase 5 Quadrant Suite...');

// ==========================================
// 1. SECTION 30: QUADRANT MAPPING TESTS
// ==========================================
console.log('--- 1. Testing Quadrant Mapping (Section 30) ---');
{
  const tile = new MockBrickTile(6, 6); // Centered at cx = 0, cz = 0
  const cx = 0, cz = 0;

  // NORTH + left side (x < cx) -> BL
  if (mapHitToQuadrant(tile, { x: cx - 0.4, z: cz - 1.0 }, Direction.NORTH) !== 'bl') {
    throw new Error('FAIL: NORTH + left side should map to BL');
  }

  // NORTH + right side (x > cx) -> BR
  if (mapHitToQuadrant(tile, { x: cx + 0.4, z: cz - 1.0 }, Direction.NORTH) !== 'br') {
    throw new Error('FAIL: NORTH + right side should map to BR');
  }

  // SOUTH + left side (x < cx) -> TL
  if (mapHitToQuadrant(tile, { x: cx - 0.4, z: cz + 1.0 }, Direction.SOUTH) !== 'tl') {
    throw new Error('FAIL: SOUTH + left side should map to TL');
  }

  // SOUTH + right side (x > cx) -> TR
  if (mapHitToQuadrant(tile, { x: cx + 0.4, z: cz + 1.0 }, Direction.SOUTH) !== 'tr') {
    throw new Error('FAIL: SOUTH + right side should map to TR');
  }

  // EAST + north side (z >= cz) -> TL
  if (mapHitToQuadrant(tile, { x: cx - 1.0, z: cz + 0.4 }, Direction.EAST) !== 'tl') {
    throw new Error('FAIL: EAST + north side should map to TL');
  }

  // EAST + south side (z < cz) -> BL
  if (mapHitToQuadrant(tile, { x: cx - 1.0, z: cz - 0.4 }, Direction.EAST) !== 'bl') {
    throw new Error('FAIL: EAST + south side should map to BL');
  }

  // WEST + north side (z >= cz) -> TR
  if (mapHitToQuadrant(tile, { x: cx + 1.0, z: cz + 0.4 }, Direction.WEST) !== 'tr') {
    throw new Error('FAIL: WEST + north side should map to TR');
  }

  // WEST + south side (z < cz) -> BR
  if (mapHitToQuadrant(tile, { x: cx + 1.0, z: cz - 0.4 }, Direction.WEST) !== 'br') {
    throw new Error('FAIL: WEST + south side should map to BR');
  }

  // Center seam deterministic tests:
  // North at seam (x = cx = 0) -> BR (since x >= cx)
  if (mapHitToQuadrant(tile, { x: cx, z: cz - 1.0 }, Direction.NORTH) !== 'br') {
    throw new Error('FAIL: NORTH seam should deterministically select BR');
  }
  // South at seam (x = cx = 0) -> TR (since x >= cx)
  if (mapHitToQuadrant(tile, { x: cx, z: cz + 1.0 }, Direction.SOUTH) !== 'tr') {
    throw new Error('FAIL: SOUTH seam should deterministically select TR');
  }
  // East at seam (z = cz = 0) -> TL (since z >= cz)
  if (mapHitToQuadrant(tile, { x: cx - 1.0, z: cz }, Direction.EAST) !== 'tl') {
    throw new Error('FAIL: EAST seam should deterministically select TL');
  }
  // West at seam (z = cz = 0) -> TR (since z >= cz)
  if (mapHitToQuadrant(tile, { x: cx + 1.0, z: cz }, Direction.WEST) !== 'tr') {
    throw new Error('FAIL: WEST seam should deterministically select TR');
  }

  console.log('✓ All 8 cardinal face mappings and 4 center-seam tests passed cleanly');
}

// ==========================================
// 2. SECTION 31: QUADRANT STATE TESTS
// ==========================================
console.log('--- 2. Testing Quadrant State Lifecycle (Section 31) ---');
{
  const tile = new MockBrickTile(2, 2);

  // Initial state: all 4 active
  if (!tile.isBrickQuadrantActive('tl') || !tile.isBrickQuadrantActive('tr') ||
      !tile.isBrickQuadrantActive('bl') || !tile.isBrickQuadrantActive('br')) {
    throw new Error('FAIL: New brick must have all 4 quadrants active');
  }
  if (!tile.hasAnyBrickQuadrants() || tile.isBrickFullyDestroyed()) {
    throw new Error('FAIL: New brick must not be fully destroyed');
  }

  // Destroy BR
  const d1 = tile.destroyBrickQuadrant('br');
  if (!d1 || tile.isBrickQuadrantActive('br')) {
    throw new Error('FAIL: Destroying BR must succeed and set BR false');
  }
  // Remaining must be intact
  if (!tile.isBrickQuadrantActive('tl') || !tile.isBrickQuadrantActive('tr') || !tile.isBrickQuadrantActive('bl')) {
    throw new Error('FAIL: Destroying BR must leave TL, TR, BL intact');
  }

  // Destroying BR again produces false
  const d2 = tile.destroyBrickQuadrant('br');
  if (d2) {
    throw new Error('FAIL: Destroying already destroyed BR must return false');
  }

  // Destroy remaining quadrants one by one
  tile.destroyBrickQuadrant('tl');
  tile.destroyBrickQuadrant('tr');
  if (tile.isBrickFullyDestroyed()) throw new Error('FAIL: Tile with BL remaining is not fully destroyed');

  tile.destroyBrickQuadrant('bl');
  if (!tile.isBrickFullyDestroyed() || tile.hasAnyBrickQuadrants()) {
    throw new Error('FAIL: Tile with all quadrants destroyed must report isBrickFullyDestroyed = true');
  }

  // Reset
  tile.resetBrickQuadrants();
  if (!tile.hasAnyBrickQuadrants() || tile.isBrickFullyDestroyed()) {
    throw new Error('FAIL: Reset must restore brick');
  }
  if (!tile.isBrickQuadrantActive('tl') || !tile.isBrickQuadrantActive('tr') ||
      !tile.isBrickQuadrantActive('bl') || !tile.isBrickQuadrantActive('br')) {
    throw new Error('FAIL: Reset must restore all 4 quadrants to active');
  }

  console.log('✓ Quadrant state lifecycle, sequential destruction, and reset passed');
}

// ==========================================
// 3. SECTION 32: PROJECTILE PARTIAL COLLISION
// ==========================================
console.log('--- 3. Testing Projectile Partial Collision (Section 32) ---');
{
  function simulateProjectileVsTile(bullet, tile, dt = 0.05) {
    const totalDist = bullet.speed * dt;
    const vec = directionToVector(bullet.dir);
    const steps = Math.max(1, Math.ceil(totalDist / 0.18));
    const stepDist = totalDist / steps;
    const half = 0.10; // BULLET_HALF_EXTENT
    const EPSILON = 0.001;

    for (let s = 0; s < steps; s++) {
      const nextX = bullet.x + vec.x * stepDist;
      const nextZ = bullet.z + vec.z * stepDist;
      const minX = nextX - half, maxX = nextX + half;
      const minZ = nextZ - half, maxZ = nextZ + half;

      const solidBoxes = tile.getActiveQuadrantAABBs();
      for (let b = 0; b < solidBoxes.length; b++) {
        const box = solidBoxes[b];
        const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
        const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;

        if (overlapX && overlapZ) {
          let contactX = bullet.x, contactZ = bullet.z;
          if (bullet.dir === Direction.NORTH) contactZ = box.minZ;
          else if (bullet.dir === Direction.SOUTH) contactZ = box.maxZ;
          else if (bullet.dir === Direction.EAST) contactX = box.minX;
          else if (bullet.dir === Direction.WEST) contactX = box.maxX;

          const quadHit = mapHitToQuadrant(tile, { x: contactX, z: contactZ }, bullet.dir);
          tile.destroyBrickQuadrant(quadHit);
          bullet.active = false;
          return { hit: true, quadrant: quadHit, contactPoint: { x: contactX, z: contactZ } };
        }
      }
      bullet.x = nextX;
      bullet.z = nextZ;
    }
    return { hit: false };
  }

  // A. Full brick blocks projectile
  {
    const tile = new MockBrickTile(6, 6); // cx = 0, cz = 0
    const bullet = { x: -0.5, z: -1.2, dir: Direction.NORTH, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.05);
    if (!res.hit || res.quadrant !== 'bl' || bullet.active) {
      throw new Error('FAIL 32A: Full brick did not block projectile entering BL');
    }
    console.log('  ✓ 32A: Full brick blocks projectile and destroys entry quadrant (BL)');
  }

  // B. Destroyed entry quadrant allows projectile to pass into tile
  {
    const tile = new MockBrickTile(6, 6);
    tile.destroyBrickQuadrant('bl'); // BL is destroyed
    // Bullet moving NORTH in left lane (x = -0.5) from z = -1.2 to z = -0.2 (inside BL space)
    const bullet = { x: -0.5, z: -1.2, dir: Direction.NORTH, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.05); // Moves ~0.65 units to z = -0.55 (inside BL)
    if (res.hit || !bullet.active) {
      throw new Error('FAIL 32B: Bullet was blocked by destroyed BL quadrant!');
    }
    console.log('  ✓ 32B: Destroyed entry quadrant allows projectile to pass cleanly into tile');
  }

  // C. Destroyed near quadrant + intact far quadrant: strikes deeper intact quadrant
  {
    const tile = new MockBrickTile(6, 6);
    tile.destroyBrickQuadrant('bl'); // BL is destroyed, TL is intact
    // Bullet moving NORTH from south of tile all the way to north half
    const bullet = { x: -0.5, z: -1.2, dir: Direction.NORTH, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.15); // Travels ~1.95 units, reaches TL
    if (!res.hit || res.quadrant !== 'tl' || bullet.active) {
      throw new Error(`FAIL 32C: Bullet did not hit deeper TL quadrant! Got: ${JSON.stringify(res)}`);
    }
    console.log('  ✓ 32C: Bullet passes destroyed BL and strikes deeper intact TL quadrant');
  }

  // D. Fully destroyed brick allows projectile through entire tile
  {
    const tile = new MockBrickTile(6, 6);
    tile.resetBrickQuadrants();
    tile.destroyBrickQuadrant('tl');
    tile.destroyBrickQuadrant('tr');
    tile.destroyBrickQuadrant('bl');
    tile.destroyBrickQuadrant('br');

    const bullet = { x: -0.5, z: -1.5, dir: Direction.NORTH, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.25); // Travels 3.25 units completely across tile
    if (res.hit || !bullet.active || bullet.z < 1.0) {
      throw new Error('FAIL 32D: Fully destroyed brick blocked bullet or deactivated it');
    }
    console.log('  ✓ 32D: Fully destroyed brick allows projectile through entire tile');
  }

  // E. Projectile cannot hit an already destroyed quadrant
  {
    const tile = new MockBrickTile(6, 6);
    tile.destroyBrickQuadrant('br');
    // Bullet enters through BR space
    const bullet = { x: 0.5, z: -1.2, dir: Direction.NORTH, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.05);
    if (res.hit && res.quadrant === 'br') {
      throw new Error('FAIL 32E: Projectile hit an already destroyed quadrant BR');
    }
    console.log('  ✓ 32E: Projectile cannot collide with already destroyed quadrant');
  }

  // F. High-speed substep projectile correctly detects remaining 1x1 quadrant
  {
    const tile = new MockBrickTile(6, 6);
    // Only TR remains intact
    tile.destroyBrickQuadrant('tl');
    tile.destroyBrickQuadrant('bl');
    tile.destroyBrickQuadrant('br');

    // Bullet moving WEST at high speed across north half (z = 0.5) from East (x = 1.8)
    const bullet = { x: 1.8, z: 0.5, dir: Direction.WEST, speed: 13.0, active: true };
    const res = simulateProjectileVsTile(bullet, tile, 0.15);
    if (!res.hit || res.quadrant !== 'tr' || bullet.active) {
      throw new Error(`FAIL 32F: Substepping missed lone remaining TR quadrant: ${JSON.stringify(res)}`);
    }
    console.log('  ✓ 32F: Sub-stepping guarantees collision with lone remaining 1x1 quadrant');
  }
}

// ==========================================
// 4. SECTION 33: PLAYER TANK COLLISION TESTS
// ==========================================
console.log('--- 4. Testing Player Tank Collision (Section 33) ---');
{
  const TANK_HALF = 0.60;
  const EPSILON = 0.002;

  function isPlayerTankPositionValid(x, z, tile) {
    const minX = x - TANK_HALF, maxX = x + TANK_HALF;
    const minZ = z - TANK_HALF, maxZ = z + TANK_HALF;

    const solidBoxes = tile.getActiveQuadrantAABBs();
    for (let i = 0; i < solidBoxes.length; i++) {
      const box = solidBoxes[i];
      const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
      const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;
      if (overlapX && overlapZ) {
        return false; // Collision with solid quadrant
      }
    }
    return true; // Free
  }

  const tile = new MockBrickTile(6, 6); // cx = 0, cz = 0. Bounds: [-1, 1] x [-1, 1].

  // A. Player overlaps intact quadrant -> blocked
  if (isPlayerTankPositionValid(0, 0, tile)) {
    throw new Error('FAIL 33A: Tank at tile center with intact quadrants was not blocked');
  }
  console.log('  ✓ 33A: Player overlapping intact quadrants is blocked');

  // B. Player overlaps destroyed quadrant space only -> passable
  // Suppose BL is destroyed. BL is [-1, 0] x [-1, 0].
  // If tank is positioned far southwest so it overlaps only inside the destroyed BL region
  // (e.g. tank center at x = -1.2, z = -1.2, footprint [-1.8, -0.6] x [-1.8, -0.6]).
  // Note: maxX = -0.6 < 0 (does not overlap BR), maxZ = -0.6 < 0 (does not overlap TL).
  // Overlaps only BL space.
  tile.destroyBrickQuadrant('bl');
  if (!isPlayerTankPositionValid(-1.2, -1.2, tile)) {
    throw new Error('FAIL 33B: Tank overlapping only destroyed quadrant BL was incorrectly blocked');
  }
  console.log('  ✓ 33B: Tank overlapping only destroyed quadrant region is NOT blocked');

  // C. Player overlaps remaining intact quadrant -> blocked
  // If tank moves slightly northeast to x = -0.9, z = -0.5:
  // maxZ = -0.5 + 0.6 = +0.1 > 0 -> overlaps intact TL!
  if (isPlayerTankPositionValid(-0.9, -0.5, tile)) {
    throw new Error('FAIL 33C: Tank overlapping intact TL was not blocked');
  }
  console.log('  ✓ 33C: Tank overlapping remaining intact quadrant is blocked');

  // D. Fully destroyed brick -> passable
  tile.destroyBrickQuadrant('tl');
  tile.destroyBrickQuadrant('tr');
  tile.destroyBrickQuadrant('br');
  if (!isPlayerTankPositionValid(0, 0, tile)) {
    throw new Error('FAIL 33D: Tank at center of fully destroyed brick was blocked');
  }
  console.log('  ✓ 33D: Fully destroyed brick is completely passable');

  // E. Tank footprint overlaps quadrant from adjacent empty tile -> blocked
  tile.resetBrickQuadrants(); // All intact
  // Tank center at adjacent empty space: x = -1.5, z = 0.
  // Tank maxX = -1.5 + 0.60 = -0.90 > -1.0 (overlaps west quadrants TL and BL by 0.10 units!)
  if (isPlayerTankPositionValid(-1.5, 0, tile)) {
    throw new Error('FAIL 33E: Tank footprint overlapping quadrant from adjacent empty tile was not detected');
  }
  console.log('  ✓ 33E: Tank footprint overlapping brick quadrant from adjacent empty cell is blocked');
}

console.log('[SUCCESS] All Phase 5 Quadrant & Partial Collision Tests Passed Cleanly!');
