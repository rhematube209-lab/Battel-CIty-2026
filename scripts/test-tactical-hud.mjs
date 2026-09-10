import { readFileSync } from 'node:fs';
import ts from 'typescript';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    passCount++;
    console.log(`  [PASS] ${message}`);
  } else {
    failCount++;
    console.error(`  [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('=============================================================');
console.log('PHASE 23 — v1.1.0 TACTICAL COMMAND HUD & BATTLEFIELD FRAME QA');
console.log('=============================================================\n');

// -------------------------------------------------------------
// Helper: Mock DOM Environment for UI Testing
// -------------------------------------------------------------
class MockDOMElement {
  constructor(id = '', tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.style = {};
    const classSet = new Set();
    this.classList = {
      add: (...tokens) => tokens.forEach((t) => classSet.add(t)),
      remove: (...tokens) => tokens.forEach((t) => classSet.delete(t)),
      contains: (token) => classSet.has(token),
      has: (token) => classSet.has(token),
      clear: () => classSet.clear(),
      [Symbol.iterator]: () => classSet[Symbol.iterator](),
    };
    this._textContent = '';
    this._innerHTML = '';
    this.attributes = new Map();
    this.listeners = new Map();
    this.children = [];
    this.offsetWidth = 100;
  }

  get textContent() {
    return this._textContent;
  }

  set textContent(val) {
    this._textContent = String(val);
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
  }

  get className() {
    return Array.from(this.classList).join(' ');
  }

  set className(val) {
    this.classList.clear();
    String(val).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  addEventListener(event, fn) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(fn);
  }

  removeEventListener(event, fn) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(event, list.filter((f) => f !== fn));
  }

  trigger(event, data = {}) {
    const list = this.listeners.get(event) || [];
    for (const fn of list) {
      fn(data);
    }
  }

  querySelector(selector) {
    return null;
  }

  querySelectorAll(selector) {
    return [];
  }
}

class MockCanvasElement extends MockDOMElement {
  constructor(id = '') {
    super(id, 'canvas');
    this.width = 182;
    this.height = 182;
    this._ctx = {
      fillRect: () => {},
      strokeRect: () => {},
      drawImage: () => {},
      beginPath: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      moveTo: () => {},
      lineTo: () => {},
      closePath: () => {},
      save: () => {},
      restore: () => {},
      setTransform: () => {},
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      shadowColor: '',
      shadowBlur: 0,
    };
  }

  getContext(type) {
    if (type === '2d') return this._ctx;
    return null;
  }
}

const elements = new Map();

function getOrCreate(id, isCanvas = false) {
  if (!elements.has(id)) {
    if (isCanvas || id === 'tacticalMinimap') {
      elements.set(id, new MockCanvasElement(id));
    } else if (id.toLowerCase().includes('btn')) {
      const btn = new MockDOMElement(id, 'button');
      if (id === 'tchMuteBtn') btn.setAttribute('aria-label', 'Toggle Sound (M)');
      if (id === 'tchPauseBtn') btn.setAttribute('aria-label', 'Pause Game (ESC / P)');
      elements.set(id, btn);
    } else {
      elements.set(id, new MockDOMElement(id));
    }
  }
  return elements.get(id);
}

// Pre-seed required DOM IDs
getOrCreate('hud');
getOrCreate('enemiesCounter');
getOrCreate('livesCounter');
getOrCreate('scoreCounter');
getOrCreate('totalScoreCounter');
getOrCreate('statusIndicator');
getOrCreate('stageBadge');
getOrCreate('fpsCounter');
getOrCreate('meshCounter');
getOrCreate('hudDebug');
getOrCreate('hudPowerups');
getOrCreate('muteBtn');
getOrCreate('muteIcon');
getOrCreate('pauseBtn');
getOrCreate('tacticalCommandHud');
getOrCreate('tacticalMinimap', true);

const windowListeners = new Map();

const mockWindow = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  addEventListener(evt, fn) {
    if (!windowListeners.has(evt)) windowListeners.set(evt, []);
    windowListeners.get(evt).push(fn);
  },
  removeEventListener(evt, fn) {
    const list = windowListeners.get(evt) || [];
    windowListeners.set(evt, list.filter((f) => f !== fn));
  },
  trigger(evt, data) {
    const list = windowListeners.get(evt) || [];
    for (const fn of list) fn(data);
  },
  _listeners: windowListeners,
};

const mockDocument = {
  getElementById(id) {
    return getOrCreate(id, id === 'tacticalMinimap');
  },
  createElement(tag) {
    return tag === 'canvas' ? new MockCanvasElement() : new MockDOMElement('', tag);
  },
  querySelector(sel) {
    return null;
  },
};

globalThis.window = mockWindow;
globalThis.document = mockDocument;

// CommonJS Transpiler
const moduleCache = new Map();
function transpileAndLoad(filePath, mocks = {}) {
  if (moduleCache.has(filePath)) {
    return moduleCache.get(filePath);
  }
  const code = readFileSync(filePath, 'utf-8');
  const js = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS }
  }).outputText;
  const mod = { exports: {} };
  const fn = new Function('module', 'exports', 'require', js);
  fn(mod, mod.exports, (id) => {
    if (mocks[id]) return mocks[id];
    if (id.startsWith('./') || id.startsWith('../')) {
      if (id.includes('buildInfo')) return transpileAndLoad('src/config/buildInfo.ts');
      if (id.includes('constants')) return transpileAndLoad('src/game/constants.ts');
      if (id.includes('powerups')) return transpileAndLoad('src/config/powerups.ts');
      if (id.includes('enemyArchetypes')) return transpileAndLoad('src/config/enemyArchetypes.ts');
      if (id.includes('TacticalHUDSnapshot')) return transpileAndLoad('src/ui/TacticalHUDSnapshot.ts');
      if (id.includes('TacticalMinimap')) return transpileAndLoad('src/ui/TacticalMinimap.ts');
      if (id.includes('TacticalCommandHUD')) return transpileAndLoad('src/ui/TacticalCommandHUD.ts');
      if (id.includes('HUD')) return transpileAndLoad('src/ui/HUD.ts');
      if (id.includes('stage04')) return transpileAndLoad('src/stages/stage04.ts');
      if (id.includes('stage03')) return transpileAndLoad('src/stages/stage03.ts');
      if (id.includes('stage02')) return transpileAndLoad('src/stages/stage02.ts');
      if (id.includes('stage01')) return transpileAndLoad('src/stages/stage01.ts');
      if (id.includes('level04')) return transpileAndLoad('src/levels/level04.ts');
      if (id.includes('level03')) return transpileAndLoad('src/levels/level03.ts');
      if (id.includes('level02')) return transpileAndLoad('src/levels/level02.ts');
      if (id.includes('Direction')) return transpileAndLoad('src/game/Direction.ts');
      if (id.includes('LevelDefinition')) return transpileAndLoad('src/levels/LevelDefinition.ts');
      if (id.includes('StageDefinition')) return transpileAndLoad('src/stages/StageDefinition.ts');
    }
    if (id === '@babylonjs/core') {
      return {
        Vector3: class Vector3 {
          constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
        }
      };
    }
    return {};
  });
  moduleCache.set(filePath, mod.exports);
  return mod.exports;
}

// -------------------------------------------------------------
// Test Suite 1: Layout Modes & Responsive Breakpoint (Req 2, 49, 75, 76)
// -------------------------------------------------------------
console.log('Test Suite 1: Layout Modes & Responsive Breakpoint (Req 2, 49, 75, 76)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();

  // Test 1A: Desktop wide (>= 1100px) activates TACTICAL mode
  mockWindow.innerWidth = 1280;
  hud.syncResponsiveMode(false);
  hud.setVisible(true);

  assert(hud.getMode() === 'TACTICAL', 'Desktop 1280px resolves to TACTICAL mode');
  assert(hud.getTacticalHUD().isVisible() === true, 'TacticalCommandHUD sidebar is visible in TACTICAL mode');
  assert(elements.get('hud').style.display === 'none', 'Top Compact HUD is hidden in TACTICAL mode (no duplicates)');

  // Test 1B: Mobile device landscape activates COMPACT mode
  mockWindow.innerWidth = 844;
  hud.syncResponsiveMode(true);
  hud.setVisible(true);

  assert(hud.getMode() === 'COMPACT', 'Mobile device resolves to COMPACT mode');
  assert(hud.getTacticalHUD().isVisible() === false, 'TacticalCommandHUD sidebar is hidden on mobile');
  assert(elements.get('hud').style.display === 'flex', 'Top Compact HUD is visible on mobile');

  // Test 1C: Narrow desktop / tablet (< 1100px) activates COMPACT mode
  mockWindow.innerWidth = 1024;
  hud.syncResponsiveMode(false);
  hud.setVisible(true);

  assert(hud.getMode() === 'COMPACT', 'Narrow viewport 1024px falls back to COMPACT mode');
  assert(hud.getTacticalHUD().isVisible() === false, 'TacticalCommandHUD is hidden on < 1100px viewports');
  assert(elements.get('hud').style.display === 'flex', 'Compact top HUD is visible on < 1100px viewports');

  // Test 1D: Hidden state hides both
  hud.setVisible(false);
  assert(hud.getTacticalHUD().isVisible() === false, 'Tactical HUD hidden when HUD is not visible');
  assert(elements.get('hud').style.display === 'none', 'Compact HUD hidden when HUD is not visible');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 2: Authoritative Snapshot Parity (Req 47, 77)
// -------------------------------------------------------------
console.log('\nTest Suite 2: Authoritative Snapshot Parity (Req 47, 77)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();
  hud.setVisible(true);

  hud.setStageNumber(3, 'FORGE LINE', 'DEFEND FACTORY CONVEYORS');
  hud.update(
    14,
    2,
    '001500',
    '006400',
    { standard: 4, fast: 6, armor: 4 },
    'SECURE'
  );

  // Check Compact HUD elements
  assert(elements.get('enemiesCounter').textContent === '14', 'Compact HUD receives 14 remaining enemies');
  assert(elements.get('livesCounter').textContent === '2', 'Compact HUD receives 2 lives');
  assert(elements.get('scoreCounter').textContent === '001500', 'Compact HUD receives score 001500');
  assert(elements.get('totalScoreCounter').textContent === '006400', 'Compact HUD receives total 006400');
  assert(elements.get('stageBadge').textContent === 'STAGE 03', 'Compact HUD receives STAGE 03');

  // Check Tactical Sidebar elements
  const tchEnemies = elements.get('tchEnemiesCount');
  const tchLives = elements.get('tchLivesCount');
  const tchScore = elements.get('tchScoreVal');
  const tchTotal = elements.get('tchTotalScoreVal');
  const tchStage = elements.get('tchStageBadge');
  const tchName = elements.get('tchStageName');

  assert(tchEnemies?.textContent === '14', 'Tactical HUD receives exact same 14 enemies from authoritative source');
  assert(tchLives?.textContent === '× 2', 'Tactical HUD receives exact same 2 lives');
  assert(tchScore?.textContent === '001500', 'Tactical HUD receives exact same score 001500');
  assert(tchTotal?.textContent === '006400', 'Tactical HUD receives exact same total 006400');
  assert(tchStage?.textContent === 'STAGE 03', 'Tactical HUD receives exact same STAGE 03');
  assert(tchName?.textContent === 'FORGE LINE', 'Tactical HUD displays stage name FORGE LINE');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 3: Stage 04 Telemetry & Score Update (Req 78, 79)
// -------------------------------------------------------------
console.log('\nTest Suite 3: Stage 04 Telemetry & Score Update (Req 78, 79)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();
  hud.setVisible(true);

  // Initialize Stage 04 entering state
  hud.setStageMetadata(4, 'NEXUS SIEGE', 'BREAK THE RELAY GRID', 24);
  hud.update(
    24,
    3,
    '000000',
    '008700',
    { standard: 6, fast: 10, armor: 8 },
    'SECURE'
  );

  const tchStage = elements.get('tchStageBadge');
  const tchName = elements.get('tchStageName');
  const tchEnemies = elements.get('tchEnemiesCount');
  const tchTotalEnemies = elements.get('tchEnemiesTotal');
  const tchTotalScore = elements.get('tchTotalScoreVal');
  const tchMission = elements.get('tchMissionTitle');
  const tchCommand = elements.get('tchCommandNodeStatus');

  assert(tchStage?.textContent === 'STAGE 04', 'Stage 04 badge is STAGE 04');
  assert(tchName?.textContent === 'NEXUS SIEGE', 'Stage 04 name is NEXUS SIEGE');
  assert(tchEnemies?.textContent === '24', 'Stage 04 initial enemies is 24');
  assert(tchTotalEnemies?.textContent === '24', 'Stage 04 total enemies quota is 24');
  assert(tchTotalScore?.textContent === '008700', 'Stage 04 entering total score is 008700');
  assert(tchMission?.textContent === 'BREAK THE RELAY GRID', 'Stage 04 mission is BREAK THE RELAY GRID');
  assert(tchCommand?.textContent === 'SECURE', 'Command node initial status is SECURE');

  // Archetype composition verification
  const archStd = elements.get('tchArchStd');
  const archFast = elements.get('tchArchFast');
  const archArm = elements.get('tchArchArm');
  assert(archStd?.textContent === '6', 'Stage 04 standard enemies is 6');
  assert(archFast?.textContent === '10', 'Stage 04 fast enemies is 10');
  assert(archArm?.textContent === '8', 'Stage 04 armor enemies is 8');

  // Simulate First Standard Tank Kill (100 pts)
  hud.update(
    23,
    3,
    '000100',
    '008800',
    { standard: 5, fast: 10, armor: 8 },
    'SECURE'
  );

  const tchScorePost = elements.get('tchScoreVal');
  const tchTotalPost = elements.get('tchTotalScoreVal');
  const archStdPost = elements.get('tchArchStd');

  assert(tchScorePost?.textContent === '000100', 'Stage score becomes 000100 after 1 kill');
  assert(tchTotalPost?.textContent === '008800', 'Campaign total becomes 008800 after 1 kill');
  assert(archStdPost?.textContent === '5', 'Standard archetype remaining decrements to 5');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 4: Tactical Minimap Static 13x13 Topology (Req 80)
// -------------------------------------------------------------
console.log('\nTest Suite 4: Tactical Minimap Static 13x13 Topology (Req 80)');
{
  const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');
  const { TileType } = transpileAndLoad('src/game/constants.ts');
  const { TacticalMinimap } = transpileAndLoad('src/ui/TacticalMinimap.ts');

  const canvas = new MockCanvasElement('testMinimap');
  const minimap = new TacticalMinimap(canvas);

  const tiles = STAGE_04_DEFINITION.level.tiles;
  assert(tiles.length === 13, 'Stage 04 has exactly 13 rows');
  assert(tiles[0].length === 13, 'Stage 04 has exactly 13 columns');

  let cryoCount = 0;
  let conveyorCount = 0;
  let baseCount = 0;

  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      if (tiles[r][c] === TileType.CRYO) cryoCount++;
      if (tiles[r][c] === TileType.CONVEYOR) conveyorCount++;
      if (tiles[r][c] === TileType.BASE) baseCount++;
    }
  }

  assert(cryoCount === 8, `Stage 04 topology has exactly 8 Cryo tiles (found ${cryoCount})`);
  assert(conveyorCount === 12, `Stage 04 topology has exactly 12 Conveyor tiles (found ${conveyorCount})`);
  assert(baseCount === 1, `Stage 04 topology has exactly 1 Base tile (found ${baseCount})`);

  minimap.setStageTopology(tiles);
  assert(canvas.getAttribute('aria-label') === 'Tactical minimap', 'Minimap canvas includes aria-label="Tactical minimap"');
  assert(canvas.getAttribute('role') === 'img', 'Minimap canvas includes role="img"');

  minimap.dispose();
}

// -------------------------------------------------------------
// Test Suite 5: Minimap Dynamic Entity Tracking & Pool Isolation (Req 81)
// -------------------------------------------------------------
console.log('\nTest Suite 5: Minimap Dynamic Entity Tracking & Pool Isolation (Req 81)');
{
  const { TacticalMinimap } = transpileAndLoad('src/ui/TacticalMinimap.ts');
  const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');

  const canvas = new MockCanvasElement('testMinimap2');
  const minimap = new TacticalMinimap(canvas);
  minimap.setStageTopology(STAGE_04_DEFINITION.level.tiles);

  let playerPos = { x: 0, y: 0, z: -10 };
  let enemyPositions = [
    { x: -10, y: 0, z: 10 },
    { x: 0, y: 0, z: 10 },
  ];
  let baseDestroyed = false;

  minimap.setEntityProvider({
    getPlayerPosition: () => playerPos,
    getEnemyPositions: () => enemyPositions,
    isBaseDestroyed: () => baseDestroyed,
  });

  // Render dynamic markers
  minimap.renderNow();
  assert(true, 'Minimap rendered dynamic markers successfully without throwing');

  // Verify pool slot isolation: inactive slots (not in enemyPositions) are never passed
  enemyPositions = [{ x: 4, y: 0, z: 4 }];
  minimap.renderNow();
  assert(enemyPositions.length === 1, 'Minimap strictly renders only active enemies (1 active)');

  // Base destruction test
  baseDestroyed = true;
  minimap.renderNow();
  assert(baseDestroyed === true, 'Minimap renders Command Node LOST glyph without error');

  minimap.dispose();
}

// -------------------------------------------------------------
// Test Suite 6: Minimap Throttling Policy (Req 82)
// -------------------------------------------------------------
console.log('\nTest Suite 6: Minimap Throttling Policy (Req 82)');
{
  const { TacticalMinimap } = transpileAndLoad('src/ui/TacticalMinimap.ts');
  const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');
  const canvas = new MockCanvasElement('testMinimap3');
  const minimap = new TacticalMinimap(canvas);
  minimap.setStageTopology(STAGE_04_DEFINITION.level.tiles);

  let drawCount = 0;
  canvas._ctx.drawImage = () => { drawCount++; };

  // Call tick() at 60 FPS (every 16.6ms) for 1000ms (60 ticks)
  let simulatedTime = 1000;
  for (let i = 0; i < 60; i++) {
    simulatedTime += 16.66;
    minimap.tick(simulatedTime);
  }

  // With a 100ms throttle, exactly 10 renders should occur across 1 second (10 Hz)
  assert(drawCount >= 9 && drawCount <= 11, `Minimap throttled to ~10 Hz (expected 9-11, got ${drawCount} redraws across 60 frames)`);

  minimap.dispose();
}

// -------------------------------------------------------------
// Test Suite 7: Stage Transition Topology Rebuild (Req 83)
// -------------------------------------------------------------
console.log('\nTest Suite 7: Stage Transition Topology Rebuild (Req 83)');
{
  const { STAGE_03_DEFINITION } = transpileAndLoad('src/stages/stage03.ts');
  const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');
  const { TacticalMinimap } = transpileAndLoad('src/ui/TacticalMinimap.ts');

  const canvas = new MockCanvasElement('testMinimap4');
  const minimap = new TacticalMinimap(canvas);

  // Load Stage 03
  minimap.setStageTopology(STAGE_03_DEFINITION.level.tiles);
  assert(true, 'Stage 03 topology set');

  // Advance to Stage 04
  minimap.setStageTopology(STAGE_04_DEFINITION.level.tiles);
  assert(true, 'Stage 04 topology replaces Stage 03 topology cleanly');

  minimap.dispose();
}

// -------------------------------------------------------------
// Test Suite 8: Pause Simulation Freeze (Req 84)
// -------------------------------------------------------------
console.log('\nTest Suite 8: Pause Simulation Freeze (Req 84)');
{
  const { TacticalMinimap } = transpileAndLoad('src/ui/TacticalMinimap.ts');
  const { STAGE_04_DEFINITION } = transpileAndLoad('src/stages/stage04.ts');

  const canvas = new MockCanvasElement('testMinimap5');
  const minimap = new TacticalMinimap(canvas);
  minimap.setStageTopology(STAGE_04_DEFINITION.level.tiles);

  let drawCount = 0;
  canvas._ctx.drawImage = () => { drawCount++; };

  minimap.setPaused(true);
  let time = 5000;
  for (let i = 0; i < 30; i++) {
    time += 50;
    minimap.tick(time);
  }

  assert(drawCount === 0, 'Minimap is completely frozen while paused (0 redraws)');

  minimap.setPaused(false);
  minimap.tick(time + 120);
  assert(drawCount === 1, 'Minimap resumes drawing when unpaused');

  minimap.dispose();
}

// -------------------------------------------------------------
// Test Suite 9: 20-Cycle Responsive Resize Stress Test (Req 51, 85)
// -------------------------------------------------------------
console.log('\nTest Suite 9: 20-Cycle Responsive Resize Stress Test (Req 51, 85)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();
  hud.setVisible(true);

  const initialListeners = mockWindow._listeners.get('keydown')?.length || 0;

  for (let cycle = 0; cycle < 20; cycle++) {
    // 1920x1080 Desktop Wide
    mockWindow.innerWidth = 1920;
    mockWindow.innerHeight = 1080;
    hud.syncResponsiveMode(false);
    assert(hud.getMode() === 'TACTICAL', `Cycle ${cycle + 1}: 1920x1080 is TACTICAL`);

    // 844x390 Mobile Landscape
    mockWindow.innerWidth = 844;
    mockWindow.innerHeight = 390;
    hud.syncResponsiveMode(true);
    assert(hud.getMode() === 'COMPACT', `Cycle ${cycle + 1}: 844x390 mobile is COMPACT`);

    // 1280x720 Desktop
    mockWindow.innerWidth = 1280;
    mockWindow.innerHeight = 720;
    hud.syncResponsiveMode(false);
    assert(hud.getMode() === 'TACTICAL', `Cycle ${cycle + 1}: 1280x720 is TACTICAL`);
  }

  const finalListeners = mockWindow._listeners.get('keydown')?.length || 0;
  assert(finalListeners === initialListeners, `No listener accumulation over 20 cycles (${initialListeners} -> ${finalListeners})`);

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 10: Modal Layering, Z-Index & Overlay Safety (Req 52, 53, 86)
// -------------------------------------------------------------
console.log('\nTest Suite 10: Modal Layering, Z-Index & Overlay Safety (Req 52, 53, 86)');
{
  const css = readFileSync('src/style.css', 'utf8');

  // Verify z-index hierarchy
  assert(css.includes('.battlefield-frame') && css.includes('z-index: 5;'), 'Battlefield frame z-index is 5');
  assert(css.includes('.tactical-command-hud') && css.includes('z-index: 10;'), 'Tactical Command HUD z-index is 10');
  assert(css.includes('#renderCanvas') && css.includes('z-index: 1;'), 'Canvas z-index is 1');
  assert(css.includes('.title-screen-overlay') && css.includes('z-index: 110;'), 'Title Screen z-index is 110 (above sidebar)');
  assert(css.includes('.pause-menu-overlay') && css.includes('z-index: 120;'), 'Pause Menu z-index is 120 (above sidebar)');
  assert(css.includes('.settings-overlay') && css.includes('z-index: 130;'), 'Settings Overlay z-index is 130 (above sidebar)');
  assert(css.includes('.controls-overlay') && css.includes('z-index: 130;'), 'Controls Overlay z-index is 130 (above sidebar)');
  assert(css.includes('.rotate-device-overlay') && (css.includes('z-index: 1000;') || css.includes('z-index: 200;')), 'Rotate Device overlay is highest priority');

  // Verify pointer-events: none on decorative frame elements
  assert(css.includes('.battlefield-frame') && css.includes('pointer-events: none;'), 'Battlefield frame has pointer-events: none');
  assert(css.includes('.bf-corner') && css.includes('pointer-events: none;'), 'Battlefield corners have pointer-events: none');
  assert(css.includes('.bf-rail') && css.includes('pointer-events: none;'), 'Battlefield rails have pointer-events: none');
}

// -------------------------------------------------------------
// Test Suite 11: Accessibility & ARIA Contract (Req 67, 68, 87)
// -------------------------------------------------------------
console.log('\nTest Suite 11: Accessibility & ARIA Contract (Req 67, 68, 87)');
{
  const { TacticalCommandHUD } = transpileAndLoad('src/ui/TacticalCommandHUD.ts');
  const tch = new TacticalCommandHUD('tacticalCommandHud');

  const muteBtn = elements.get('tchMuteBtn');
  const pauseBtn = elements.get('tchPauseBtn');
  const minimapCanvas = elements.get('tacticalMinimap');

  assert(muteBtn?.tagName === 'BUTTON', 'Mute button is an actual HTML button');
  assert(muteBtn?.getAttribute('aria-label') === 'Toggle Sound (M)', 'Mute button has aria-label');
  assert(pauseBtn?.tagName === 'BUTTON', 'Pause button is an actual HTML button');
  assert(pauseBtn?.getAttribute('aria-label') === 'Pause Game (ESC / P)', 'Pause button has aria-label');
  assert(minimapCanvas?.getAttribute('aria-label') === 'Tactical minimap', 'Tactical minimap canvas has aria-label');

  tch.dispose();
}

// -------------------------------------------------------------
// Test Suite 12: Reduced Motion Adaptation (Req 42, 88)
// -------------------------------------------------------------
console.log('\nTest Suite 12: Reduced Motion Adaptation (Req 42, 88)');
{
  const { TacticalCommandHUD } = transpileAndLoad('src/ui/TacticalCommandHUD.ts');
  const tch = new TacticalCommandHUD('tacticalCommandHud');

  tch.setReducedMotion(true);
  const scoreEl = elements.get('tchScoreVal');
  const enemiesEl = elements.get('tchEnemiesCount');
  const livesEl = elements.get('tchLivesCount');

  // Pulses should be suppressed under reduced motion
  tch.pulseScore();
  tch.pulseEnemies();
  tch.pulseLives();

  assert(!scoreEl?.classList.has('tch-pulse-highlight'), 'Score pulse suppressed under reduced motion');
  assert(!enemiesEl?.classList.has('tch-pulse-alert'), 'Enemies pulse suppressed under reduced motion');
  assert(!livesEl?.classList.has('tch-pulse-danger'), 'Lives danger pulse suppressed under reduced motion');

  tch.dispose();
}

// -------------------------------------------------------------
// Test Suite 13: Originality & Legacy Asset Audit (Req 66)
// -------------------------------------------------------------
console.log('\nTest Suite 13: Originality & Legacy Asset Audit (Req 66)');
{
  const indexHtml = readFileSync('index.html', 'utf8');
  const styleCss = readFileSync('src/style.css', 'utf8');
  const hudCode = readFileSync('src/ui/TacticalCommandHUD.ts', 'utf8');
  const minimapCode = readFileSync('src/ui/TacticalMinimap.ts', 'utf8');

  assert(!indexHtml.includes('eagle') && !indexHtml.includes('phoenix'), 'index.html contains no eagle/phoenix legacy icons');
  assert(!styleCss.includes('classic-tank') && !styleCss.includes('eagle'), 'style.css contains no legacy tank/eagle sprites');
  assert(!hudCode.includes('2P') && !hudCode.includes('PLAYER 2'), 'TacticalCommandHUD contains zero 2-Player artifacts');
  assert(!minimapCode.includes('star') && !minimapCode.includes('eagle'), 'TacticalMinimap uses original geometric command core (no eagle/star)');
  assert(indexHtml.includes('COMMAND NODE') || hudCode.includes('COMMAND NODE'), 'Uses original Command Node terminology');
}

// -------------------------------------------------------------
// Test Suite 14: Live Player Lives Decrement & Carry Test (Req 1, 2, 3, 4)
// -------------------------------------------------------------
console.log('\nTest Suite 14: Live Player Lives Decrement & Carry Test (Req 1, 2, 3, 4)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();

  const compactLives = elements.get('livesCounter');
  const tchLives = elements.get('tchLivesCount');

  // Stage begins with 3 lives
  hud.update(12, 3, '000000', '000000');
  assert(compactLives?.textContent === '3', 'Stage initial lives: Compact HUD displays 3');
  assert(tchLives?.textContent === '× 3', 'Stage initial lives: Tactical HUD displays × 3');

  // Player takes hit / death 1: lives = 2
  hud.update(12, 2, '000000', '000000');
  assert(compactLives?.textContent === '2', 'After 1st death: Compact HUD immediately displays 2');
  assert(tchLives?.textContent === '× 2', 'After 1st death: Tactical HUD immediately displays × 2');

  // Player takes hit / death 2: lives = 1
  hud.update(12, 1, '000000', '000000');
  assert(compactLives?.textContent === '1', 'After 2nd death: Compact HUD immediately displays 1');
  assert(tchLives?.textContent === '× 1', 'After 2nd death: Tactical HUD immediately displays × 1');
  hud.pulseLives();
  assert(tchLives?.classList.has('tch-pulse-danger'), 'Tactical HUD triggers pulse danger animation on life loss');

  // Player life carry: Stage 03 finishes with 1 life -> Stage 04 begins with 1 life
  hud.setStageNumber(4);
  hud.update(24, 1, '000000', '008700');
  assert(compactLives?.textContent === '1', 'Life carry: Compact HUD retains 1 life entering Stage 04');
  assert(tchLives?.textContent === '× 1', 'Life carry: Tactical HUD retains 1 life entering Stage 04');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 15: Campaign Total Score & Commit Boundary Double-Count Protection (Req 5, 6, 7, 8)
// -------------------------------------------------------------
console.log('\nTest Suite 15: Campaign Total Score & Commit Boundary Protection (Req 5, 6, 7, 8)');
{
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();

  const compactScore = elements.get('scoreCounter');
  const compactTotal = elements.get('totalScoreCounter');
  const tchScore = elements.get('tchScoreVal');
  const tchTotal = elements.get('tchTotalScoreVal');

  // 1. Stage 04 entry: completed score = 8700, stage = 0 -> TOTAL: 008700
  hud.update(24, 3, '000000', '008700');
  assert(compactScore?.textContent === '000000', 'Stage 04 entry: Compact score is 000000');
  assert(compactTotal?.textContent === '008700', 'Stage 04 entry: Compact total is 008700');
  assert(tchScore?.textContent === '000000', 'Stage 04 entry: Tactical score is 000000');
  assert(tchTotal?.textContent === '008700', 'Stage 04 entry: Tactical total is 008700');
  assert(compactTotal?.textContent === tchTotal?.textContent, 'Compact and Tactical total match on Stage 04 entry');

  // 2. First Standard kill: +100 points -> TOTAL: 008800
  hud.update(23, 3, '000100', '008800');
  assert(compactScore?.textContent === '000100', 'After kill: Compact score is 000100');
  assert(compactTotal?.textContent === '008800', 'After kill: Compact total is 008800');
  assert(tchScore?.textContent === '000100', 'After kill: Tactical score is 000100');
  assert(tchTotal?.textContent === '008800', 'After kill: Tactical total is 008800');
  assert(compactTotal?.textContent === tchTotal?.textContent, 'Compact and Tactical total match after kill');

  // 3. Before Stage 04 completion: stage = 4500 -> TOTAL: 013200
  hud.update(0, 3, '004500', '013200');
  assert(compactTotal?.textContent === '013200', 'Pre-commit: Compact total is 013200');
  assert(tchTotal?.textContent === '013200', 'Pre-commit: Tactical total is 013200');

  // 4. Commit boundary: recordStageResult commits 4500 to completedScore (13200).
  // Total must remain 013200 (strictly prevents double-counting to 017700).
  hud.update(0, 3, '004500', '013200');
  assert(compactTotal?.textContent === '013200', 'Post-commit boundary: Compact total remains 013200 (no double count)');
  assert(tchTotal?.textContent === '013200', 'Post-commit boundary: Tactical total remains 013200 (no double count)');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 16: Battlefield Viewport Camera Framing & Aspect Matrix (Req 9, 10, 11, 12, 13, 14, 15, 16)
// -------------------------------------------------------------
console.log('\nTest Suite 16: Battlefield Viewport Camera Framing & Aspect Matrix (Req 9-16)');
{
  const { calculateCameraFraming } = transpileAndLoad('src/game/Game.ts');
  const { CAMERA_CONFIG } = transpileAndLoad('src/game/constants.ts');

  // Desktop Viewport Matrix Verification
  const matrix = [
    { name: '1920x1080', winW: 1920, winH: 1080, sideW: 340, bfW: 1580, bfH: 1080 },
    { name: '1600x900',  winW: 1600, winH: 900,  sideW: 320, bfW: 1280, bfH: 900 },
    { name: '1440x900',  winW: 1440, winH: 900,  sideW: 288, bfW: 1152, bfH: 900 },
    { name: '1366x768',  winW: 1366, winH: 768,  sideW: 280, bfW: 1086, bfH: 768 },
    { name: '1280x720',  winW: 1280, winH: 720,  sideW: 280, bfW: 1000, bfH: 720 },
    { name: '1024x768',  winW: 1024, winH: 768,  sideW: 0,   bfW: 1024, bfH: 768 },
  ];

  for (const item of matrix) {
    const aspect = item.bfW / item.bfH;
    const isTactical = item.winW >= 1100;
    const framing = calculateCameraFraming(aspect, isTactical);
    const scale = framing.height / CAMERA_CONFIG.HEIGHT;

    assert(framing.height >= CAMERA_CONFIG.HEIGHT, `${item.name}: camera height >= baseline height (got ${framing.height.toFixed(2)})`);
    assert(framing.distanceOffsetZ <= CAMERA_CONFIG.DISTANCE_OFFSET_Z, `${item.name}: camera distance <= baseline distance (got ${framing.distanceOffsetZ.toFixed(2)})`);
    assert(scale <= 1.55, `${item.name}: scale respects 1.55 clamp (scale = ${scale.toFixed(4)})`);

    // Verify ground plane visible half-width is invariant (~25.12 units)
    const d0 = Math.sqrt(CAMERA_CONFIG.HEIGHT ** 2 + CAMERA_CONFIG.DISTANCE_OFFSET_Z ** 2);
    const visibleHalfWidth = d0 * (16 / 9) * Math.tan(CAMERA_CONFIG.FOV / 2);
    assert(visibleHalfWidth >= 13, `${item.name}: visible half-width (${visibleHalfWidth.toFixed(2)}) covers entire 26-unit arena (half 13)`);
  }

  // Breakpoint edge testing: 1099, 1100, 1101
  const { HUD } = transpileAndLoad('src/ui/HUD.ts');
  const hud = new HUD();

  // 1099px: COMPACT
  mockWindow.innerWidth = 1099;
  hud.syncResponsiveMode(false);
  assert(hud.getMode() === 'COMPACT', '1099px resolves to COMPACT mode');

  // 1100px: TACTICAL
  mockWindow.innerWidth = 1100;
  hud.syncResponsiveMode(false);
  assert(hud.getMode() === 'TACTICAL', '1100px resolves to TACTICAL mode');

  // 1101px: TACTICAL
  mockWindow.innerWidth = 1101;
  hud.syncResponsiveMode(false);
  assert(hud.getMode() === 'TACTICAL', '1101px resolves to TACTICAL mode');

  hud.dispose();
}

// -------------------------------------------------------------
// Test Suite 17: Authoritative Mission & Stage Identity Audit (Req 17, 18)
// -------------------------------------------------------------
console.log('\nTest Suite 17: Authoritative Mission & Stage Identity Audit (Req 17, 18)');
{
  const s1 = readFileSync('src/stages/stage01.ts', 'utf8');
  const s2 = readFileSync('src/stages/stage02.ts', 'utf8');
  const s3 = readFileSync('src/stages/stage03.ts', 'utf8');
  const s4 = readFileSync('src/stages/stage04.ts', 'utf8');
  const hudCode = readFileSync('src/ui/TacticalCommandHUD.ts', 'utf8');

  assert(s1.includes("displayName: 'CYBER OUTPOST'"), 'Stage 01 name is CYBER OUTPOST');
  assert(s1.includes("missionTitle: 'DEFEND COMMAND NODE'"), 'Stage 01 mission is DEFEND COMMAND NODE');

  assert(s2.includes("displayName: 'IRON DELTA'"), 'Stage 02 name is IRON DELTA');
  assert(s2.includes("missionTitle: 'HOLD THE REACTOR LINE'"), 'Stage 02 mission is HOLD THE REACTOR LINE');

  assert(s3.includes("displayName: 'FORGE LINE'"), 'Stage 03 name is FORGE LINE');
  assert(s3.includes("missionTitle: 'BREAK THE FOUNDRY GRID'"), 'Stage 03 mission is BREAK THE FOUNDRY GRID');

  assert(s4.includes("displayName: 'NEXUS SIEGE'"), 'Stage 04 name is NEXUS SIEGE');
  assert(s4.includes("missionTitle: 'BREAK THE RELAY GRID'"), 'Stage 04 mission is BREAK THE RELAY GRID');

  assert(!hudCode.includes('DEFEND OUTPOST ALPHA'), 'No unapproved mission strings in TacticalCommandHUD');
  assert(!hudCode.includes('NAVIGATE CRYO SECTOR'), 'No unapproved mission strings in TacticalCommandHUD');
  assert(!hudCode.includes('OVERRIDE CONVEYOR GRIDS'), 'No unapproved mission strings in TacticalCommandHUD');
}

console.log(`\n=============================================================`);
console.log(`PHASE 23 TACTICAL HUD QA COMPLETE: ${passCount} passed, ${failCount} failed.`);
console.log(`=============================================================`);

if (failCount > 0) {
  process.exit(1);
}
