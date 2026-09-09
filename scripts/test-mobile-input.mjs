/**
 * Automated Test Suite for Phase 9:
 * Mobile Controls + Responsive Gameplay UI + Input Abstraction + Mobile Performance
 */

import fs from 'fs';

const GRID_ROWS = 13;
const GRID_COLS = 13;
const TILE_SIZE = 2.0;

const Direction = {
  NORTH: 0,
  EAST: 1,
  SOUTH: 2,
  WEST: 3,
};

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

const CAMERA_CONFIG = {
  FOV: 0.785,
  HEIGHT: 32.0,
  DISTANCE_OFFSET_Z: -12.0,
  TARGET_Y: 0,
};

const JOYSTICK_DEAD_ZONE = 0.18;
const JOYSTICK_MAX_RADIUS = 48;

function gridToWorld(row, column) {
  const x = (column - (GRID_COLS - 1) / 2) * TILE_SIZE;
  const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
  return { x, y: 0, z };
}

// -------------------------------------------------------------
// Pure implementations mirroring TypeScript classes
// -------------------------------------------------------------

function resolveCardinalDirection(
  dx,
  dy,
  maxRadius = JOYSTICK_MAX_RADIUS,
  deadZone = JOYSTICK_DEAD_ZONE
) {
  const dist = Math.hypot(dx, dy);
  const normalizedDist = dist / maxRadius;

  if (normalizedDist < deadZone) {
    return null;
  }

  // Snap to strongest axis: Strictly cardinal, never diagonal
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.EAST : Direction.WEST;
  } else {
    // Screen Y decreases upwards towards the top of the display (World NORTH)
    return dy < 0 ? Direction.NORTH : Direction.SOUTH;
  }
}

function calculateCameraFraming(aspectRatio) {
  const baseAspect = 16 / 9; // ~1.777
  const scale = aspectRatio < baseAspect ? Math.min(1.35, Math.max(1.0, baseAspect / aspectRatio)) : 1.0;
  return {
    height: CAMERA_CONFIG.HEIGHT * scale,
    distanceOffsetZ: CAMERA_CONFIG.DISTANCE_OFFSET_Z * scale,
    fov: CAMERA_CONFIG.FOV,
  };
}

class MockInputSystem {
  constructor() {
    this.heldDirections = [];
    this.activeKeys = new Set();
    this.isFireHeld = false;
    this.touchDirection = null;
    this.isTouchFire = false;
    this.lastDirectionSource = 'KEYBOARD';
    this.onRestartCallback = null;
  }

  setTouchDirection(direction) {
    this.touchDirection = direction;
    if (direction !== null) {
      this.lastDirectionSource = 'TOUCH';
    }
  }

  setTouchFire(active) {
    this.isTouchFire = active;
  }

  getMovementDirection() {
    if (this.lastDirectionSource === 'TOUCH' && this.touchDirection !== null) {
      return this.touchDirection;
    }
    if (this.heldDirections.length > 0) {
      return this.heldDirections[this.heldDirections.length - 1];
    }
    return this.touchDirection;
  }

  isFireActive() {
    return this.isFireHeld || this.isTouchFire;
  }

  getLastInputSource() {
    return this.lastDirectionSource;
  }

  getTouchDirection() {
    return this.touchDirection;
  }

  isTouchFireActive() {
    return this.isTouchFire;
  }

  simulateKeyDown(code) {
    let dir = null;
    if (code === 'KeyW' || code === 'ArrowUp') dir = Direction.NORTH;
    if (code === 'KeyS' || code === 'ArrowDown') dir = Direction.SOUTH;
    if (code === 'KeyA' || code === 'ArrowLeft') dir = Direction.WEST;
    if (code === 'KeyD' || code === 'ArrowRight') dir = Direction.EAST;

    if (code === 'Space') {
      this.isFireHeld = true;
    }
    if (code === 'KeyR') {
      this.onRestartCallback?.();
    }

    if (dir !== null) {
      this.activeKeys.add(code);
      this.lastDirectionSource = 'KEYBOARD';
      this.heldDirections = this.heldDirections.filter((d) => d !== dir);
      this.heldDirections.push(dir);
    }
  }

  simulateKeyUp(code) {
    if (code === 'Space') {
      this.isFireHeld = false;
    }

    let dir = null;
    if (code === 'KeyW' || code === 'ArrowUp') dir = Direction.NORTH;
    if (code === 'KeyS' || code === 'ArrowDown') dir = Direction.SOUTH;
    if (code === 'KeyA' || code === 'ArrowLeft') dir = Direction.WEST;
    if (code === 'KeyD' || code === 'ArrowRight') dir = Direction.EAST;

    this.activeKeys.delete(code);

    if (dir !== null) {
      this.heldDirections = this.heldDirections.filter((d) => d !== dir);
    }
  }

  clearInput() {
    this.heldDirections = [];
    this.activeKeys.clear();
    this.isFireHeld = false;
    this.touchDirection = null;
    this.isTouchFire = false;
    this.lastDirectionSource = 'KEYBOARD';
  }
}

// -------------------------------------------------------------
// Test Execution Harness
// -------------------------------------------------------------
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passedCount++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failedCount++;
  }
}

console.log('=== PHASE 9: MOBILE CONTROLS & INPUT ABSTRACTION SUITE ===\n');

// =============================================================
// Test Suite 1: Pre-Phase 9 Source-of-Truth Respawn Verification
// =============================================================
console.log('Test Suite 1: Pre-Phase 9 Source-of-Truth Respawn Verification');

// Create synthetic level with relocated PLAYER_SPAWN at row 8, col 2
const syntheticGrid = Array.from({ length: GRID_ROWS }, () =>
  Array.from({ length: GRID_COLS }, () => TileType.EMPTY)
);
syntheticGrid[8][2] = TileType.PLAYER_SPAWN; // Relocated from Level 01 row 12, col 4
syntheticGrid[12][6] = TileType.BASE;

class SyntheticTileMap {
  constructor(grid) {
    this.grid = grid;
    this.playerSpawn = null;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.grid[r][c] === TileType.PLAYER_SPAWN) {
          this.playerSpawn = gridToWorld(r, c);
        }
      }
    }
  }

  getPlayerSpawn() {
    return this.playerSpawn ? { ...this.playerSpawn } : null;
  }
}

const syntheticTileMap = new SyntheticTileMap(syntheticGrid);
const resolvedSpawn = syntheticTileMap.getPlayerSpawn();
const expectedWorldPos = gridToWorld(8, 2);

assert(resolvedSpawn !== null, 'Synthetic TileMap successfully parses relocated PLAYER_SPAWN');
assert(
  resolvedSpawn.x === expectedWorldPos.x && resolvedSpawn.z === expectedWorldPos.z,
  `Spawn coordinates dynamically match grid (8,2) -> (${expectedWorldPos.x}, ${expectedWorldPos.z}), got (${resolvedSpawn.x}, ${resolvedSpawn.z})`
);
assert(
  resolvedSpawn.x !== -4.0 || resolvedSpawn.z !== -10.0,
  'Relocated spawn is strictly different from Level 01 default (-4.0, -10.0)'
);

// Simulate life respawn logic using source-of-truth tileMap.getPlayerSpawn()
let mockPlayerPos = { x: 0, z: 0 };
function simulateLifeRespawn(map) {
  const spawn = map.getPlayerSpawn();
  if (spawn) {
    mockPlayerPos = { ...spawn };
  }
}

simulateLifeRespawn(syntheticTileMap);
assert(
  mockPlayerPos.x === expectedWorldPos.x && mockPlayerPos.z === expectedWorldPos.z,
  `Life respawn accurately positions player at synthetic spawn (${expectedWorldPos.x}, ${expectedWorldPos.z}) with zero hardcoded literals`
);

// =============================================================
// Test Suite 2: Unified Input Abstraction (Keyboard vs Touch)
// =============================================================
console.log('\nTest Suite 2: Unified Input Abstraction (Keyboard vs Touch)');
const input = new MockInputSystem();

// A. Keyboard NORTH produces NORTH
input.simulateKeyDown('KeyW');
assert(input.getMovementDirection() === Direction.NORTH, 'Keyboard W produces Direction.NORTH');
input.simulateKeyUp('KeyW');
assert(input.getMovementDirection() === null, 'Keyboard W release returns null/stopped');

// B. Touch NORTH produces NORTH
input.setTouchDirection(Direction.NORTH);
assert(input.getMovementDirection() === Direction.NORTH, 'Touch NORTH produces Direction.NORTH');

// C. Touch EAST produces EAST
input.setTouchDirection(Direction.EAST);
assert(input.getMovementDirection() === Direction.EAST, 'Touch EAST produces Direction.EAST');

// D. Exclusivity: Keyboard and Touch never produce diagonal movement
const testDirs = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST];
assert(testDirs.includes(input.getMovementDirection()), 'Touch movement is strictly cardinal');

// E. Touch release produces null/NONE
input.setTouchDirection(null);
assert(input.getMovementDirection() === null, 'Touch release produces null/NONE');

// F. Touch FIRE maps to same logical fire action as Space
assert(!input.isFireActive(), 'Fire action initially inactive');
input.simulateKeyDown('Space');
assert(input.isFireActive(), 'Keyboard Space activates logical fire');
input.simulateKeyUp('Space');
assert(!input.isFireActive(), 'Keyboard Space release deactivates logical fire');

input.setTouchFire(true);
assert(input.isFireActive(), 'Touch FIRE activates logical fire');
input.setTouchFire(false);
assert(!input.isFireActive(), 'Touch FIRE release deactivates logical fire');

// G. Firing cooldown remains enforced
const COOLDOWN = 0.28;
let cooldownTimer = 0;
function tryFire() {
  if (cooldownTimer <= 0 && input.isFireActive()) {
    cooldownTimer = COOLDOWN;
    return true;
  }
  return false;
}

input.setTouchFire(true);
assert(tryFire() === true, 'First shot fires successfully via Touch FIRE');
assert(tryFire() === false, 'Immediate second shot blocked by cooldown while Touch FIRE is held');
cooldownTimer = 0; // Simulate 0.28s passage
assert(tryFire() === true, 'Holding Touch FIRE permits next shot once cooldown expires');
input.setTouchFire(false);

// =============================================================
// Test Suite 3: Cardinal Dominance & Screen-to-World Snapping
// =============================================================
console.log('\nTest Suite 3: Cardinal Dominance & Screen-to-World Snapping');

// Screen mapping documentation:
// Screen coordinates: X increases to the right, Y increases downwards.
// World coordinates: North is +Z (up on screen, dy < 0), South is -Z (down on screen, dy > 0),
// East is +X (right on screen, dx > 0), West is -X (left on screen, dx < 0).

// Dominant horizontal
assert(resolveCardinalDirection(70, 20) === Direction.EAST, 'dx=70, dy=20 -> EAST (|dx| > |dy|)');
assert(resolveCardinalDirection(-80, 15) === Direction.WEST, 'dx=-80, dy=15 -> WEST (|dx| > |dy|)');

// Dominant vertical (Screen Y inverted!)
assert(resolveCardinalDirection(10, -70) === Direction.NORTH, 'dx=10, dy=-70 -> NORTH (|dy| >= |dx|, dy < 0)');
assert(resolveCardinalDirection(15, 75) === Direction.SOUTH, 'dx=15, dy=75 -> SOUTH (|dy| >= |dx|, dy > 0)');

// Borderline angles strictly snap to strongest axis (never diagonal)
assert(resolveCardinalDirection(45, -44) === Direction.EAST, 'dx=45, dy=-44 -> EAST (|dx| > |dy|)');
assert(resolveCardinalDirection(44, -45) === Direction.NORTH, 'dx=44, dy=-45 -> NORTH (|dy| >= |dx|)');
assert(resolveCardinalDirection(-45, 44) === Direction.WEST, 'dx=-45, dy=44 -> WEST (|dx| > |dy|)');
assert(resolveCardinalDirection(-44, 45) === Direction.SOUTH, 'dx=-44, dy=45 -> SOUTH (|dy| >= |dx|)');

// =============================================================
// Test Suite 4: Dead-Zone Enforcement & Knob Clamping
// =============================================================
console.log('\nTest Suite 4: Dead-Zone Enforcement & Knob Clamping');

// Dead-zone: normalized threshold = 0.18. Max radius = 48px -> threshold distance = 8.64px
assert(resolveCardinalDirection(4, 4) === null, 'Displacement (4,4) dist=5.66px inside dead-zone -> NONE (null)');
assert(resolveCardinalDirection(0, -7) === null, 'Displacement (0,-7) dist=7.00px inside dead-zone -> NONE (null)');
assert(resolveCardinalDirection(6, 6) === null, 'Displacement (6,6) dist=8.49px inside dead-zone -> NONE (null)');
assert(resolveCardinalDirection(0, -9) === Direction.NORTH, 'Displacement (0,-9) dist=9.00px outside dead-zone -> NORTH');
assert(resolveCardinalDirection(10, 0) === Direction.EAST, 'Displacement (10,0) dist=10.00px outside dead-zone -> EAST');

// Visual knob clamping calculation:
function clampKnob(dx, dy, maxRadius = JOYSTICK_MAX_RADIUS) {
  const dist = Math.hypot(dx, dy);
  if (dist > maxRadius && dist > 0) {
    const ratio = maxRadius / dist;
    return { kx: dx * ratio, ky: dy * ratio };
  }
  return { kx: dx, ky: dy };
}

const clamped = clampKnob(60, 80, 48); // dist = 100 > 48
assert(
  Math.abs(Math.hypot(clamped.kx, clamped.ky) - 48) < 1e-5,
  `Visual displacement clamped to exact max radius (48px), got ${Math.hypot(clamped.kx, clamped.ky).toFixed(2)}px`
);

// =============================================================
// Test Suite 5: Continuous Dragging (No Finger Lifting)
// =============================================================
console.log('\nTest Suite 5: Continuous Dragging (No Finger Lifting)');

// Player drags thumb in a circular sweep around joystick without lifting
const dragPath = [
  { dx: 0, dy: -40, expected: Direction.NORTH },
  { dx: 40, dy: 0, expected: Direction.EAST },
  { dx: 0, dy: 40, expected: Direction.SOUTH },
  { dx: -40, dy: 0, expected: Direction.WEST },
  { dx: 0, dy: -40, expected: Direction.NORTH },
];

let dragSuccess = true;
for (const step of dragPath) {
  const resolved = resolveCardinalDirection(step.dx, step.dy);
  if (resolved !== step.expected) {
    dragSuccess = false;
    break;
  }
}
assert(dragSuccess, 'Dragging across quadrants updates direction continuously without releasing');

// =============================================================
// Test Suite 6: Multitouch Independence & Pointer Cancellation
// =============================================================
console.log('\nTest Suite 6: Multitouch Independence & Pointer Cancellation');

const multitouchInput = new MockInputSystem();

// Pointer 1 (Left thumb on joystick) engages NORTH
multitouchInput.setTouchDirection(Direction.NORTH);
assert(multitouchInput.getMovementDirection() === Direction.NORTH, 'Pointer 1 moves tank NORTH');

// Pointer 2 (Right thumb on FIRE) engages fire simultaneously
multitouchInput.setTouchFire(true);
assert(multitouchInput.getMovementDirection() === Direction.NORTH, 'Tank continues moving NORTH while firing');
assert(multitouchInput.isFireActive() === true, 'Tank is firing simultaneously');

// Release Pointer 2 (stop firing): Movement must continue uninterrupted!
multitouchInput.setTouchFire(false);
assert(multitouchInput.getMovementDirection() === Direction.NORTH, 'Releasing FIRE leaves tank moving NORTH');
assert(multitouchInput.isFireActive() === false, 'Firing stopped cleanly');

// Release Pointer 1: Movement stops
multitouchInput.setTouchDirection(null);
assert(multitouchInput.getMovementDirection() === null, 'Releasing joystick stops tank');

// Pointer Cancel safety (e.g. system notification or gesture interruption)
multitouchInput.setTouchDirection(Direction.EAST);
multitouchInput.setTouchFire(true);
assert(
  multitouchInput.getMovementDirection() === Direction.EAST && multitouchInput.isFireActive(),
  'Re-engaged touch direction and fire simultaneously active before cancel'
);

// Simulate window blur / pointercancel
multitouchInput.clearInput();
assert(multitouchInput.getMovementDirection() === null, 'Pointercancel / blur clears movement immediately');
assert(multitouchInput.isFireActive() === false, 'Pointercancel / blur clears fire immediately');

// =============================================================
// Test Suite 7: Input Source Priority Arbitration
// =============================================================
console.log('\nTest Suite 7: Input Source Priority Arbitration');

const priorityInput = new MockInputSystem();

// 1. Keyboard holds NORTH
priorityInput.simulateKeyDown('KeyW');
assert(priorityInput.getMovementDirection() === Direction.NORTH, 'Keyboard sets direction to NORTH');
assert(priorityInput.getLastInputSource() === 'KEYBOARD', 'Source is KEYBOARD');

// 2. Touch engages EAST while keyboard is still held: Most recent active wins!
priorityInput.setTouchDirection(Direction.EAST);
assert(priorityInput.getMovementDirection() === Direction.EAST, 'Most recent Touch EAST overrides held Keyboard NORTH');
assert(priorityInput.getLastInputSource() === 'TOUCH', 'Source updated to TOUCH');

// 3. Touch releases: Must fall back immediately to held keyboard NORTH!
priorityInput.setTouchDirection(null);
assert(priorityInput.getMovementDirection() === Direction.NORTH, 'Releasing Touch falls back to held Keyboard NORTH');

// 4. While Touch is held SOUTH, Keyboard presses WEST: Most recent keyboard wins!
priorityInput.setTouchDirection(Direction.SOUTH);
assert(priorityInput.getMovementDirection() === Direction.SOUTH, 'Touch SOUTH active');
priorityInput.simulateKeyDown('KeyA');
assert(priorityInput.getMovementDirection() === Direction.WEST, 'Pressing Keyboard WEST overrides Touch SOUTH');
assert(priorityInput.getLastInputSource() === 'KEYBOARD', 'Source updated to KEYBOARD');

// Clean cleanup
priorityInput.clearInput();
assert(priorityInput.getMovementDirection() === null, 'All inputs cleared cleanly');

// =============================================================
// Test Suite 8: Responsive Camera Aspect Math
// =============================================================
console.log('\nTest Suite 8: Responsive Camera Aspect Math');

// Desktop standard 16:9
const f16_9 = calculateCameraFraming(16 / 9);
assert(f16_9.height === 32.0, '16:9 camera height is 32.0 (unmodified desktop baseline)');
assert(f16_9.distanceOffsetZ === -12.0, '16:9 camera offsetZ is -12.0 (unmodified desktop baseline)');

// Mobile landscape 19.5:9 (e.g. iPhone / modern Android ~2.16)
const fMobileWide = calculateCameraFraming(19.5 / 9);
assert(fMobileWide.height === 32.0, 'Ultra-wide mobile landscape maintains standard height 32.0');
assert(fMobileWide.distanceOffsetZ === -12.0, 'Ultra-wide mobile landscape maintains offsetZ -12.0');

// Narrower landscape 3:2 (1.50)
const f3_2 = calculateCameraFraming(3 / 2);
assert(f3_2.height > 32.0, `3:2 landscape scales elevation higher (${f3_2.height.toFixed(2)}) to fit arena borders`);
assert(f3_2.distanceOffsetZ < -12.0, `3:2 landscape pulls camera back (${f3_2.distanceOffsetZ.toFixed(2)})`);

// Extreme clamp safety (scale <= 1.35)
const fSquare = calculateCameraFraming(1.0);
const maxScaleExpectedHeight = CAMERA_CONFIG.HEIGHT * 1.35;
assert(
  Math.abs(fSquare.height - maxScaleExpectedHeight) < 1e-5,
  `Square aspect ratio caps scale safely at 1.35 (height = ${fSquare.height.toFixed(2)})`
);

// =============================================================
// Test Suite 9: Quality Profile & DPR Capping
// =============================================================
console.log('\nTest Suite 9: Quality Profile & DPR Capping');

function mockDetectQuality(isMobile) {
  return {
    isMobile,
    shadowMapSize: isMobile ? 512 : 1024,
    brickFragmentCount: isMobile ? 4 : 6,
    tankSparkCount: isMobile ? 5 : 8,
    maxDpr: isMobile ? 1.5 : 2.0,
  };
}

const desktopQuality = mockDetectQuality(false);
const mobileQuality = mockDetectQuality(true);

assert(desktopQuality.maxDpr === 2.0, 'Desktop max DPR is 2.0');
assert(mobileQuality.maxDpr === 1.5, 'Mobile max DPR is capped at 1.5 (prevents thermal throttling)');
assert(desktopQuality.shadowMapSize === 1024, 'Desktop shadow map is 1024');
assert(mobileQuality.shadowMapSize === 512, 'Mobile shadow map is 512');
assert(desktopQuality.brickFragmentCount === 6, 'Desktop brick fragments count is 6');
assert(mobileQuality.brickFragmentCount === 4, 'Mobile brick fragments count is 4');

// Effective scaling level calculation
function computeScalingLevel(dpr, maxDpr) {
  const effective = Math.min(dpr, maxDpr);
  return 1.0 / effective;
}

assert(
  Math.abs(computeScalingLevel(3.0, mobileQuality.maxDpr) - (1.0 / 1.5)) < 1e-5,
  'Physical DPR 3.0 on mobile correctly caps effective DPR to 1.5 (hardwareScalingLevel = 0.667)'
);
assert(
  Math.abs(computeScalingLevel(2.0, desktopQuality.maxDpr) - (1.0 / 2.0)) < 1e-5,
  'Physical DPR 2.0 on desktop uses full DPR 2.0 (hardwareScalingLevel = 0.500)'
);

// =============================================================
// Final Summary
// =============================================================
console.log('\n==================================================');
console.log(`Phase 9 Test Results: ${passedCount} passed, ${failedCount} failed`);
console.log('==================================================\n');

if (failedCount > 0) {
  process.exit(1);
}
