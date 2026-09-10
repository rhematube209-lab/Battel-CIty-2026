import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tamer\\.gemini\\antigravity-ide\\brain\\d838e124-1001-4be4-8bb5-f77e317caf23';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runVisualRefinementVerification() {
  console.log('=============================================================');
  console.log('PHASE 23 VISUAL REFINEMENT PASS: CAMERA & SCREENSHOT QA');
  console.log('=============================================================\n');

  const tempDir = mkdtempSync(join(tmpdir(), 'chrome-vis-refine-'));
  const port = 9345;
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu=false',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--window-size=1920,1080',
    `--user-data-dir=${tempDir}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const pages = await res.json();
        const page = pages.find((p) => p.type === 'page');
        if (page && page.webSocketDebuggerUrl) {
          wsUrl = page.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
    await sleep(200);
  }

  if (!wsUrl) throw new Error('Failed to connect to Chrome CDP');

  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve) => {
      const id = msgId++;
      pending.set(id, { resolve });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalExpression(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.result?.value;
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // Navigate to Stage 04 direct bootstrap
  await send('Page.navigate', { url: 'http://localhost:3001/?devStage=stage04' });
  await sleep(3000);

  // Helper to query camera, battlefield, and live Babylon projected bounds
  async function queryVisualTelemetry() {
    return await evalExpression(`
      (() => {
        const g = window.__GAME_INSTANCE__;
        const bfShell = document.getElementById('battlefieldShell');
        const sidebar = document.getElementById('tacticalCommandHud');
        const canvas = document.getElementById('renderCanvas');
        const scene = g?.scene;
        const cam = g?.camera;

        const sidebarWidth = (sidebar && getComputedStyle(sidebar).display !== 'none') ? sidebar.offsetWidth : 0;
        const bfWidth = bfShell ? bfShell.clientWidth : 0;
        const bfHeight = bfShell ? bfShell.clientHeight : 0;
        const canvasWidth = canvas ? canvas.clientWidth : 0;
        const canvasHeight = canvas ? canvas.clientHeight : 0;
        const aspect = bfHeight > 0 ? bfWidth / bfHeight : 16 / 9;

        // Analytical perspective projection matching Babylon TargetCamera
        let minY = 99999, maxY = -99999, minX = 99999, maxX = -99999;
        let northBorderY = 0, southBorderY = 0, baseTopY = 0, enemySpawnY = 0;

        if (cam && bfWidth > 0 && bfHeight > 0) {
          const H = cam.position.y;
          const Zc = cam.position.z;
          const fov = cam.fov;
          const aspect = bfWidth / bfHeight;
          const tanHalfFov = Math.tan(fov / 2);
          const d = Math.sqrt(H * H + Zc * Zc);

          const fy = -H / d;
          const fz = -Zc / d;
          const uy = -Zc / d;
          const uz = H / d;

          function projectPoint(x, y, z) {
            const relY = y - H;
            const relZ = z - Zc;
            const pz = relY * fy + relZ * fz;
            const py = relY * uy + relZ * uz;
            const px = x;

            const ndcY = (py / pz) / tanHalfFov;
            const ndcX = (px / pz) / (tanHalfFov * aspect);

            const screenY = (1 - ndcY) / 2 * bfHeight;
            const screenX = (1 + ndcX) / 2 * bfWidth;
            return { x: screenX, y: screenY };
          }

          const testPoints = [
            { name: 'south_border_wall', x: 0, y: 1.8, z: -13.8 },
            { name: 'south_border_ground', x: 0, y: 0, z: -13.8 },
            { name: 'north_border_wall', x: 0, y: 1.8, z: 13.8 },
            { name: 'north_border_ground', x: 0, y: 0, z: 13.8 },
            { name: 'west_border_wall', x: -13.8, y: 1.8, z: 0 },
            { name: 'east_border_wall', x: 13.8, y: 1.8, z: 0 },
            { name: 'sw_corner', x: -13.8, y: 0, z: -13.8 },
            { name: 'se_corner', x: 13.8, y: 0, z: -13.8 },
            { name: 'nw_corner', x: -13.8, y: 0, z: 13.8 },
            { name: 'ne_corner', x: 13.8, y: 0, z: 13.8 },
            { name: 'base_top', x: 0, y: 1.4, z: -11.0 },
            { name: 'enemy_spawn', x: 0, y: 0.02, z: 11.0 },
          ];

          for (const item of testPoints) {
            const p = projectPoint(item.x, item.y, item.z);
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (item.name === 'north_border_wall') northBorderY = p.y;
            if (item.name === 'south_border_wall') southBorderY = p.y;
            if (item.name === 'base_top') baseTopY = p.y;
            if (item.name === 'enemy_spawn') enemySpawnY = p.y;
          }
        }

        const occY = bfHeight > 0 ? (maxY - minY) / bfHeight * 100 : 0;
        const occX = bfWidth > 0 ? (maxX - minX) / bfWidth * 100 : 0;
        const allVisible = minY >= 0 && maxY <= bfHeight && minX >= 0 && maxX <= bfWidth;

        // Instrumentation check
        const activeMeshes = scene ? scene.getActiveMeshes().length : 0;
        const totalMeshes = scene ? scene.meshes.length : 0;

        return {
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
          mode: g?.hud?.getMode(),
          sidebarWidth,
          bfWidth,
          bfHeight,
          canvasWidth,
          canvasHeight,
          aspect: Math.round(aspect * 1000) / 1000,
          camY: cam ? Math.round(cam.position.y * 100) / 100 : 0,
          camZ: cam ? Math.round(cam.position.z * 100) / 100 : 0,
          minY: Math.round(minY * 10) / 10,
          maxY: Math.round(maxY * 10) / 10,
          minX: Math.round(minX * 10) / 10,
          maxX: Math.round(maxX * 10) / 10,
          northBorderY: Math.round(northBorderY * 10) / 10,
          southBorderY: Math.round(southBorderY * 10) / 10,
          baseTopY: Math.round(baseTopY * 10) / 10,
          enemySpawnY: Math.round(enemySpawnY * 10) / 10,
          occY: Math.round(occY * 10) / 10,
          occX: Math.round(occX * 10) / 10,
          allVisible,
          activeMeshes,
          totalMeshes,
          playerLives: document.getElementById('tchLivesCount')?.textContent,
          enemiesRemaining: document.getElementById('tchEnemiesCount')?.textContent,
          score: document.getElementById('tchScoreVal')?.textContent,
          total: document.getElementById('tchTotalScoreVal')?.textContent,
          stageBadge: document.getElementById('tchStageBadge')?.textContent,
          stageName: document.getElementById('tchStageName')?.textContent,
        };
      })()
    `);
  }

  const desktopMatrix = [
    { name: '1920x1080', w: 1920, h: 1080, screenshotName: 'stage04_desktop_1920x1080.png' },
    { name: '1600x900',  w: 1600, h: 900,  screenshotName: null },
    { name: '1440x900',  w: 1440, h: 900,  screenshotName: 'stage04_desktop_1440x900.png' },
    { name: '1366x768',  w: 1366, h: 768,  screenshotName: null },
    { name: '1280x720',  w: 1280, h: 720,  screenshotName: 'stage04_desktop_1280x720.png' },
  ];

  const results = [];

  for (const item of desktopMatrix) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: item.w,
      height: item.h,
      deviceScaleFactor: 1.0,
      mobile: false,
    });
    await evalExpression(`
      (() => {
        window.dispatchEvent(new Event('resize'));
        window.__GAME_INSTANCE__?.syncLayoutAndCamera();
      })()
    `);
    await sleep(400);

    const t = await queryVisualTelemetry();
    results.push({ name: item.name, telemetry: t });

    console.log(`[RESOLUTION ${item.name}]`);
    console.log(`  Battlefield Shell: ${t.bfWidth} x ${t.bfHeight} (aspect: ${t.aspect})`);
    console.log(`  Sidebar Width:     ${t.sidebarWidth}px`);
    console.log(`  Camera Position:   Y=${t.camY}, Z=${t.camZ}`);
    console.log(`  Projected Bounds:  Y=[${t.minY}, ${t.maxY}], X=[${t.minX}, ${t.maxX}]`);
    console.log(`  Height Occupancy:  ${t.occY}% (Target: 88–94%)`);
    console.log(`  All Edges Visible: ${t.allVisible ? 'YES ✓' : 'NO ✗'}`);
    console.log(`  Spawns / Base:     Base Y=${t.baseTopY}, Spawns Y=${t.enemySpawnY}`);
    console.log(`  Telemetry HUD:     Stage: ${t.stageBadge} ${t.stageName}, Enemies: ${t.enemiesRemaining}, Lives: ${t.playerLives}, Score: ${t.score}, Total: ${t.total}\n`);

    if (item.screenshotName) {
      const shot = await send('Page.captureScreenshot', { format: 'png' });
      const buf = Buffer.from(shot.result.data, 'base64');
      const outPath = join(ARTIFACT_DIR, item.screenshotName);
      writeFileSync(outPath, buf);
      console.log(`  ✓ Screenshot saved: ${outPath}\n`);
    }
  }

  // Capture Minimap Close-up
  console.log('--- CAPTURING TACTICAL MINIMAP CLOSE-UP ---');
  // Set to 1920x1080 to get full resolution
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1.0,
    mobile: false,
  });
  await sleep(300);

  // Query minimap bounding rect
  const minimapBox = await evalExpression(`
    (() => {
      const el = document.querySelector('.tch-module-minimap');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    })()
  `);

  if (minimapBox) {
    const shot = await send('Page.captureScreenshot', {
      format: 'png',
      clip: {
        x: minimapBox.x - 10,
        y: minimapBox.y - 10,
        width: minimapBox.width + 20,
        height: minimapBox.height + 20,
        scale: 1,
      },
    });
    const buf = Buffer.from(shot.result.data, 'base64');
    const outPath = join(ARTIFACT_DIR, 'stage04_tactical_minimap_closeup.png');
    writeFileSync(outPath, buf);
    console.log(`  ✓ Minimap close-up saved: ${outPath}\n`);
  }

  await ws.close();
  chromeProc.kill();
  console.log('Visual Refinement Verification Complete.');
}

runVisualRefinementVerification().catch((err) => {
  console.error('ERROR in Visual Refinement Verification:', err);
  process.exit(1);
});
