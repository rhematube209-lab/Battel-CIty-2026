import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEV_URL = 'http://localhost:3001/?devStage=stage04';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runComparison() {
  console.log('=============================================================');
  console.log('PHASE 22: RECONCILE DRAW-CALL BASELINE & APPLES-TO-APPLES QA');
  console.log('=============================================================\n');

  const tempDir = mkdtempSync(join(tmpdir(), 'chrome-comp-'));
  const port = 9335;
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu=false',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--window-size=1280,720',
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

  console.log('[1/4] Navigating to Stage 04 in DEV mode...');
  await send('Page.navigate', { url: DEV_URL });
  await sleep(2000);

  // Helper to sample draw calls over N frames using SceneInstrumentation
  async function sampleRenderMetrics(durationMs = 1500) {
    return await evalExpression(`
      (async () => {
        const game = window.__GAME_INSTANCE__;
        const instrumentation = game.sceneInstrumentation;
        if (!instrumentation) return null;

        const samples = [];
        const start = performance.now();
        while (performance.now() - start < ${durationMs}) {
          samples.push(instrumentation.drawCallsCounter.current);
          await new Promise(r => requestAnimationFrame(r));
        }

        const validSamples = samples.filter(s => s > 0);
        const sum = validSamples.reduce((a, b) => a + b, 0);
        const avg = validSamples.length > 0 ? sum / validSamples.length : 0;
        const peak = validSamples.length > 0 ? Math.max(...validSamples) : 0;
        const min = validSamples.length > 0 ? Math.min(...validSamples) : 0;

        return {
          avg: Math.round(avg * 10) / 10,
          peak,
          min,
          sampleCount: validSamples.length,
          sceneMeshCount: game.getSceneMeshCount(),
          activeMeshCount: game.getActiveMeshCount(),
          fps: game.getFps(),
          hardwareScalingLevel: game.getHardwareScalingLevel(),
          renderWidth: game.getRenderWidth(),
          renderHeight: game.getRenderHeight(),
          qualityProfile: game.getSelectedQualityProfile(),
          maxDpr: game.getMaxDpr(),
        };
      })()
    `);
  }

  // Set reproducible fixed load: 4 enemies, 3 player bullets, 6 enemy bullets, powerups active
  console.log('\n[2/4] Applying Fixed Reproducible Load (4 active enemies, 9 bullets, powerups, debris)...');
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      g.setupWorstCaseBenchmark();
    })()
  `);
  await sleep(1000);

  // =========================================================================
  // Desktop Tests
  // =========================================================================
  console.log('\n--- DESKTOP APPLES-TO-APPLES (1280 x 720 Viewport) ---');

  // Test with Presentation ON
  const desktopOn = await sampleRenderMetrics(1500);
  console.log('PRESENTATION ON (Desktop):');
  console.log(`  Draw Calls (avg/frame): ${desktopOn.avg}`);
  console.log(`  Draw Calls (peak): ${desktopOn.peak}`);
  console.log(`  Draw Calls (min): ${desktopOn.min}`);
  console.log(`  Scene Meshes: ${desktopOn.sceneMeshCount}`);
  console.log(`  Active Meshes: ${desktopOn.activeMeshCount}`);
  console.log(`  Sample Count: ${desktopOn.sampleCount} frames`);

  // Switch Presentation OFF in the EXACT same state
  console.log('\nDisabling Stage 04 presentation in-engine...');
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      g.arena.applyPresentation(undefined, g.userPreferences.isReducedMotion());
      const base = g.tileMap.getBase();
      if (base) base.setPresentation(undefined);
    })()
  `);
  await sleep(500);

  const desktopOff = await sampleRenderMetrics(1500);
  console.log('PRESENTATION OFF (Desktop):');
  console.log(`  Draw Calls (avg/frame): ${desktopOff.avg}`);
  console.log(`  Draw Calls (peak): ${desktopOff.peak}`);
  console.log(`  Draw Calls (min): ${desktopOff.min}`);
  console.log(`  Scene Meshes: ${desktopOff.sceneMeshCount}`);
  console.log(`  Active Meshes: ${desktopOff.activeMeshCount}`);
  console.log(`  Sample Count: ${desktopOff.sampleCount} frames`);

  const desktopDelta = Math.round((desktopOn.avg - desktopOff.avg) * 10) / 10;
  console.log(`\nDesktop Draw Call Delta (ON - OFF): ${desktopDelta >= 0 ? '+' : ''}${desktopDelta} / frame`);
  console.log(`Desktop Scene Mesh Delta (ON - OFF): ${desktopOn.sceneMeshCount - desktopOff.sceneMeshCount}`);

  // Re-enable Presentation ON
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      const stageDef = g.stageManager.getCurrentStage();
      g.arena.applyPresentation(stageDef.presentation, g.userPreferences.isReducedMotion());
      const base = g.tileMap.getBase();
      if (base) base.setPresentation(stageDef.presentation);
    })()
  `);
  await sleep(500);

  // =========================================================================
  // Mobile Tests
  // =========================================================================
  console.log('\n--- MOBILE APPLES-TO-APPLES (844 x 390, DPR 2.0, touch enabled) ---');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 2.0,
    mobile: true,
  });
  await send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await evalExpression(`window.dispatchEvent(new Event('resize'))`);
  await sleep(1500);

  // Test Mobile Presentation ON
  const mobileOn = await sampleRenderMetrics(1500);
  console.log('PRESENTATION ON (Mobile):');
  console.log(`  Profile: ${mobileOn.qualityProfile}`);
  console.log(`  maxDpr: ${mobileOn.maxDpr}`);
  console.log(`  hardwareScalingLevel: ${mobileOn.hardwareScalingLevel.toFixed(7)}`);
  console.log(`  Render Dimensions: ${mobileOn.renderWidth} x ${mobileOn.renderHeight}`);
  console.log(`  Draw Calls (avg/frame): ${mobileOn.avg}`);
  console.log(`  Draw Calls (peak): ${mobileOn.peak}`);
  console.log(`  Draw Calls (min): ${mobileOn.min}`);
  console.log(`  Scene Meshes: ${mobileOn.sceneMeshCount}`);
  console.log(`  Active Meshes: ${mobileOn.activeMeshCount}`);
  console.log(`  Sample Count: ${mobileOn.sampleCount} frames`);

  // Switch Presentation OFF in the EXACT same mobile state
  console.log('\nDisabling Stage 04 presentation in-engine on Mobile...');
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      g.arena.applyPresentation(undefined, g.userPreferences.isReducedMotion());
      const base = g.tileMap.getBase();
      if (base) base.setPresentation(undefined);
    })()
  `);
  await sleep(500);

  const mobileOff = await sampleRenderMetrics(1500);
  console.log('PRESENTATION OFF (Mobile):');
  console.log(`  Draw Calls (avg/frame): ${mobileOff.avg}`);
  console.log(`  Draw Calls (peak): ${mobileOff.peak}`);
  console.log(`  Draw Calls (min): ${mobileOff.min}`);
  console.log(`  Scene Meshes: ${mobileOff.sceneMeshCount}`);
  console.log(`  Active Meshes: ${mobileOff.activeMeshCount}`);
  console.log(`  Sample Count: ${mobileOff.sampleCount} frames`);

  const mobileDelta = Math.round((mobileOn.avg - mobileOff.avg) * 10) / 10;
  console.log(`\nMobile Draw Call Delta (ON - OFF): ${mobileDelta >= 0 ? '+' : ''}${mobileDelta} / frame`);
  console.log(`Mobile Scene Mesh Delta (ON - OFF): ${mobileOn.sceneMeshCount - mobileOff.sceneMeshCount}`);

  // Test Resting Load (0 enemies, 0 bullets, player idle at spawn) to explain 112 vs 140
  console.log('\n--- RECONCILIATION: IDLE BOOT LOAD vs FULL COMBAT LOAD ---');
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      g.restartStage();
    })()
  `);
  await sleep(200); // Sample immediately before enemy spawns
  const idleSample = await sampleRenderMetrics(600);
  console.log('STAGE 04 EARLY BOOT (0 enemies, 0 bullets, idle at spawn):');
  console.log(`  Draw Calls (avg/frame): ${idleSample.avg}`);
  console.log(`  Draw Calls (peak): ${idleSample.peak}`);
  console.log(`  Scene Meshes: ${idleSample.sceneMeshCount}`);
  console.log(`  Active Meshes: ${idleSample.activeMeshCount}`);

  await ws.close();
  chromeProc.kill();
  console.log('\nComparison complete.');
}

runComparison().catch((err) => {
  console.error(err);
  process.exit(1);
});
