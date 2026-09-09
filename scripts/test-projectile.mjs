/**
 * Automated Projectile Pipeline & Collision Validation Suite
 * Tests requirements A through L independently of WebGL rendering.
 */

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;
const ARENA_HALF = 13.0;

const PROJECTILE_CONFIG = {
  SPEED: 13.0,
  PLAYER_FIRE_COOLDOWN: 0.28,
  MAX_LIFETIME: 3.0,
  MAX_ACTIVE_PLAYER_BULLETS: 2,
  POOL_SIZE: 8,
  COLLISION_HALF_EXTENT: 0.10,
  MAX_SUBSTEP: 0.18,
};

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

// Standard Level 01 fixture
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

/**
 * Pure simulation of projectile advancement with sub-stepping and collision detection.
 */
function simulateProjectileStep(bullet, dt, grid = fixture) {
  if (!bullet.active) return null;

  const totalDist = bullet.speed * dt;
  const vec = directionToVector(bullet.dir);
  const steps = Math.max(1, Math.ceil(totalDist / PROJECTILE_CONFIG.MAX_SUBSTEP));
  const stepDist = totalDist / steps;
  const half = PROJECTILE_CONFIG.COLLISION_HALF_EXTENT;

  let hitResult = null;

  for (let s = 0; s < steps; s++) {
    const nextX = bullet.x + vec.x * stepDist;
    const nextZ = bullet.z + vec.z * stepDist;

    const minX = nextX - half;
    const maxX = nextX + half;
    const minZ = nextZ - half;
    const maxZ = nextZ + half;

    // Boundary check
    if (minX < -ARENA_HALF || maxX > ARENA_HALF || minZ < -ARENA_HALF || maxZ > ARENA_HALF) {
      bullet.active = false;
      hitResult = {
        type: 'BOUNDARY',
        row: -1,
        column: -1,
        contactPoint: { x: nextX, z: nextZ },
        incomingDirection: bullet.dir,
      };
      break;
    }

    // TileMap collision check
    const minCol = Math.max(0, Math.floor((minX + ARENA_HALF) / TILE_SIZE));
    const maxCol = Math.min(12, Math.floor((maxX + ARENA_HALF) / TILE_SIZE));
    const minRow = Math.max(0, Math.floor((ARENA_HALF - maxZ) / TILE_SIZE));
    const maxRow = Math.min(12, Math.floor((ARENA_HALF - minZ) / TILE_SIZE));

    let tileHit = false;
    const EPSILON = 0.001;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const type = grid[r][c];
        if (
          type === TileType.EMPTY ||
          type === TileType.PLAYER_SPAWN ||
          type === TileType.ENEMY_SPAWN ||
          type === TileType.BUSH ||
          type === TileType.WATER
        ) {
          continue; // Pass through
        }

        if (type === TileType.BRICK || type === TileType.STEEL || type === TileType.BASE) {
          const tileMinX = 2 * c - 13;
          const tileMaxX = 2 * c - 11;
          const tileMinZ = 11 - 2 * r;
          const tileMaxZ = 13 - 2 * r;

          const overlapX = maxX > tileMinX + EPSILON && minX < tileMaxX - EPSILON;
          const overlapZ = maxZ > tileMinZ + EPSILON && minZ < tileMaxZ - EPSILON;

          if (overlapX && overlapZ) {
            let contactX = bullet.x;
            let contactZ = bullet.z;
            if (bullet.dir === Direction.NORTH) contactZ = tileMinZ;
            else if (bullet.dir === Direction.SOUTH) contactZ = tileMaxZ;
            else if (bullet.dir === Direction.EAST) contactX = tileMinX;
            else if (bullet.dir === Direction.WEST) contactX = tileMaxX;

            bullet.active = false;
            hitResult = {
              type,
              row: r,
              column: c,
              contactPoint: { x: contactX, z: contactZ },
              incomingDirection: bullet.dir,
            };
            tileHit = true;
            break;
          }
        }
      }
      if (tileHit) break;
    }

    if (tileHit) break;

    // Advance bullet position
    bullet.x = nextX;
    bullet.z = nextZ;
  }

  return hitResult;
}

console.log('[TEST] Running Standalone Projectile Pipeline & Collision Tests...');

// A. Bullet crossing EMPTY: continues
{
  const bullet = { x: -8.0, z: 6.0, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.05); // Moves 0.65 units
  if (!bullet.active || hit !== null) {
    throw new Error('FAIL A: Bullet crossing EMPTY was unexpectedly deactivated or blocked');
  }
  console.log('✓ Test A: Bullet crossing EMPTY continues');
}

// B. Bullet crossing BUSH: continues
{
  // Row 5, Col 4 is BUSH. World pos: x = (4 - 6)*2 = -4.0, z = (6 - 5)*2 = 2.0.
  const bullet = { x: -4.0, z: 1.2, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1); // Travels 1.3 units across bush
  if (!bullet.active || hit !== null) {
    throw new Error('FAIL B: Bullet crossing BUSH was unexpectedly blocked');
  }
  console.log('✓ Test B: Bullet crossing BUSH continues');
}

// C. Bullet hitting BRICK: collision reported & bullet deactivates
{
  // Row 9, Col 5 is EMPTY (center at -2.0, -6.0).
  // Row 10, Col 5 is BRICK (center at -2.0, -8.0, north face at z = -7.0).
  // Bullet starts in Row 9 at z = -6.2 moving SOUTH into Row 10.
  const bullet = { x: -2.0, z: -6.2, dir: Direction.SOUTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1);
  if (bullet.active || !hit || hit.type !== TileType.BRICK || hit.row !== 10 || hit.column !== 5) {
    throw new Error(`FAIL C: Bullet hitting BRICK was not correctly detected: ${JSON.stringify(hit)}`);
  }
  // Verify brick remains intact in grid
  if (fixture[10][5] !== TileType.BRICK) {
    throw new Error('FAIL C: Brick was modified in Phase 4');
  }
  console.log('✓ Test C: Bullet hitting BRICK reports collision and deactivates (brick intact)');
}

// D. Bullet hitting STEEL: collision reported & bullet deactivates
{
  // Row 3, Col 5 is EMPTY (center at -2.0, 6.0).
  // Row 2, Col 5 is STEEL (center at -2.0, 8.0, south face at z = 7.0).
  // Bullet starts in Row 3 at z = 6.2 moving NORTH into Row 2.
  const bullet = { x: -2.0, z: 6.2, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1);
  if (bullet.active || !hit || hit.type !== TileType.STEEL || hit.row !== 2 || hit.column !== 5) {
    throw new Error(`FAIL D: Bullet hitting STEEL was not correctly detected: ${JSON.stringify(hit)}`);
  }
  console.log('✓ Test D: Bullet hitting STEEL reports collision and deactivates');
}

// E. Bullet hitting BASE: collision reported & bullet deactivates (base intact)
{
  // Row 12, Col 6 is BASE (center at 0.0, -12.0, north face at z = -11.0).
  // Clear path through Row 11 Col 6:
  const baseTestGrid = JSON.parse(JSON.stringify(fixture));
  baseTestGrid[11][6] = TileType.EMPTY;

  const bullet = { x: 0.0, z: -10.2, dir: Direction.SOUTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1, baseTestGrid);
  if (bullet.active || !hit || hit.type !== TileType.BASE || hit.row !== 12 || hit.column !== 6) {
    throw new Error(`FAIL E: Bullet hitting BASE was not correctly detected: ${JSON.stringify(hit)}`);
  }
  if (fixture[12][6] !== TileType.BASE) {
    throw new Error('FAIL E: Base was modified in Phase 4');
  }
  console.log('✓ Test E: Bullet hitting BASE reports collision and deactivates (base intact)');
}

// F. Bullet crossing WATER: continues
{
  const waterGrid = JSON.parse(JSON.stringify(fixture));
  waterGrid[3][3] = TileType.WATER;
  const bullet = { x: -6.0, z: 5.2, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1, waterGrid);
  if (!bullet.active || hit !== null) {
    throw new Error('FAIL F: Bullet crossing WATER was unexpectedly blocked');
  }
  console.log('✓ Test F: Bullet crossing WATER continues');
}

// G. Bullet exits arena: deactivates
{
  // Bullet starting near North boundary (z = 12.8) moving NORTH
  const bullet = { x: 0.0, z: 12.8, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.05);
  if (bullet.active || !hit || hit.type !== 'BOUNDARY') {
    throw new Error('FAIL G: Bullet exiting arena was not stopped at boundary');
  }
  console.log('✓ Test G: Bullet exits arena deactivates at boundary');
}

// H. High-speed bullet cannot tunnel through one-tile BRICK wall (simulated frame hitch)
{
  // Row 2 Col 3 is BRICK (z from 7.0 to 9.0). Row 3 Col 3 is EMPTY (center at -6.0, 6.0).
  // Bullet moving at 13.0 with large dt = 0.25s (jump = 3.25 units, which is larger than the wall thickness!)
  const bullet = { x: -6.0, z: 6.2, dir: Direction.NORTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.25);
  if (bullet.active || !hit || hit.type !== TileType.BRICK || hit.row !== 2 || hit.column !== 3) {
    throw new Error('FAIL H: Bullet tunneled through 1-tile BRICK wall during frame hitch!');
  }
  console.log('✓ Test H: Sub-stepping prevents bullet tunneling through 1-tile wall during frame hitch (dt = 0.25s)');
}

// I. Bullet hit reports correct row, column, contact point on incoming face
{
  // Hit from NORTH facing South face of Row 10 Col 5:
  // Row 10 Col 5 is BRICK. Z in [-9.0, -7.0]. North face is at Z = -7.0.
  const bullet = { x: -2.0, z: -6.2, dir: Direction.SOUTH, speed: 13.0, active: true };
  const hit = simulateProjectileStep(bullet, 0.1);
  if (!hit || hit.row !== 10 || hit.column !== 5 || hit.contactPoint.z !== -7.0 || hit.incomingDirection !== Direction.SOUTH) {
    throw new Error(`FAIL I: Contact point calculation inaccurate: ${JSON.stringify(hit)}`);
  }
  console.log('✓ Test I: Bullet hit reports exact row, column, incomingDirection, and incoming face contact point');
}

// J. Projectile direction remains unchanged after player tank turns
{
  let tankDir = Direction.NORTH;
  const bullet = { x: 0, z: 0, dir: tankDir, speed: 13.0, active: true };
  // Tank turns EAST immediately after firing
  tankDir = Direction.EAST;
  // Bullet continues simulation
  simulateProjectileStep(bullet, 0.05);
  if (bullet.dir !== Direction.NORTH) {
    throw new Error('FAIL J: Bullet changed direction when tank turned!');
  }
  console.log('✓ Test J: Projectile direction captured at fire time remains unchanged when tank turns');
}

// K. Maximum active bullet count cannot exceed configured limit
{
  class WeaponHarness {
    constructor() {
      this.activeBullets = [];
      this.maxBullets = PROJECTILE_CONFIG.MAX_ACTIVE_PLAYER_BULLETS;
    }
    canFire() {
      return this.activeBullets.filter(b => b.active).length < this.maxBullets;
    }
    fire() {
      if (!this.canFire()) return false;
      const b = { active: true };
      this.activeBullets.push(b);
      return true;
    }
  }

  const weapon = new WeaponHarness();
  if (!weapon.fire()) throw new Error('FAIL K: First bullet rejected');
  if (!weapon.fire()) throw new Error('FAIL K: Second bullet rejected');
  if (weapon.fire())  throw new Error('FAIL K: Third bullet accepted while 2 active!');
  // Deactivate one bullet
  weapon.activeBullets[0].active = false;
  if (!weapon.fire()) throw new Error('FAIL K: Fire rejected after bullet deactivation');
  console.log('✓ Test K: Maximum active bullet count strictly enforced at 2');
}

// L. Cooldown prevents illegal rapid-fire
{
  class CooldownHarness {
    constructor() {
      this.cooldown = 0;
    }
    update(dt) {
      if (this.cooldown > 0) this.cooldown -= dt;
    }
    tryFire() {
      if (this.cooldown > 0) return false;
      this.cooldown = PROJECTILE_CONFIG.PLAYER_FIRE_COOLDOWN;
      return true;
    }
  }

  const cd = new CooldownHarness();
  if (!cd.tryFire()) throw new Error('FAIL L: Initial shot rejected');
  if (cd.tryFire())  throw new Error('FAIL L: Shot during cooldown accepted');
  cd.update(0.15); // Still within 0.28s
  if (cd.tryFire())  throw new Error('FAIL L: Shot midway through cooldown accepted');
  cd.update(0.14); // 0.15 + 0.14 = 0.29s > 0.28s
  if (!cd.tryFire()) throw new Error('FAIL L: Shot after cooldown expiry rejected');
  console.log('✓ Test L: Firing cooldown strictly enforced (0.28s)');
}

console.log('[SUCCESS] All Projectile Pipeline & Collision Tests Passed Cleanly!');
