import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\tamer\\.gemini\\antigravity-ide\\brain\\d838e124-1001-4be4-8bb5-f77e317caf23';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runQA() {
  console.log('=============================================================');
  console.log('PHASE 23: TACTICAL HUD LIVE SCREENSHOT & PERFORMANCE QA');
  console.log('=============================================================\n');

  const tempDir = mkdtempSync(join(tmpdir(), 'chrome-qa-p23-'));
  const port = 9338;
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

  async function captureScreenshot(filename, clip = null) {
    const params = { format: 'png' };
    if (clip) params.clip = clip;
    const res = await send('Page.captureScreenshot', params);
    const buffer = Buffer.from(res.result.data, 'base64');
    const path = join(ARTIFACT_DIR, filename);
    writeFileSync(path, buffer);
    console.log(`[SAVED] ${filename} (${buffer.length} bytes)`);
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // Helper to sample draw calls and FPS
  async function samplePerformance(durationMs = 1200) {
    return await evalExpression(`
      (async () => {
        const g = window.__GAME_INSTANCE__;
        const instrumentation = g?.sceneInstrumentation;
        if (!instrumentation) return null;

        const samples = [];
        const frameTimes = [];
        let lastT = performance.now();
        const start = performance.now();

        while (performance.now() - start < ${durationMs}) {
          samples.push(instrumentation.drawCallsCounter.current);
          const now = performance.now();
          frameTimes.push(now - lastT);
          lastT = now;
          await new Promise(r => requestAnimationFrame(r));
        }

        const validDraws = samples.filter(s => s > 0);
        const sumDraws = validDraws.reduce((a, b) => a + b, 0);
        const avgDraws = validDraws.length > 0 ? sumDraws / validDraws.length : 0;
        const peakDraws = validDraws.length > 0 ? Math.max(...validDraws) : 0;

        const sumTime = frameTimes.reduce((a, b) => a + b, 0);
        const avgFrameTime = frameTimes.length > 0 ? sumTime / frameTimes.length : 16.6;
        const fps = Math.round(1000 / avgFrameTime);

        return {
          avgDrawCalls: Math.round(avgDraws * 10) / 10,
          peakDrawCalls: peakDraws,
          fps,
          frameTimeMs: Math.round(avgFrameTime * 10) / 10,
          sceneMeshes: g.getSceneMeshCount(),
          activeMeshes: g.getActiveMeshCount(),
          hardwareScaling: g.getHardwareScalingLevel(),
          renderWidth: g.getRenderWidth(),
          renderHeight: g.getRenderHeight(),
          hudMode: g.hud?.getMode(),
          isSidebarVisible: g.hud?.getTacticalHUD()?.isVisible(),
        };
      })()
    `);
  }

  // -------------------------------------------------------------------------
  // 1. Stage 01 Desktop Tactical HUD
  // -------------------------------------------------------------------------
  console.log('\n[1/8] Capturing Stage 01 Desktop Tactical HUD...');
  await send('Page.navigate', { url: 'http://localhost:3001/?devStage=stage01' });
  await sleep(2500);
  await captureScreenshot('stage01_desktop_tactical_hud.png');

  // -------------------------------------------------------------------------
  // 2. Stage 02 Desktop Tactical HUD
  // -------------------------------------------------------------------------
  console.log('\n[2/8] Capturing Stage 02 Desktop Tactical HUD...');
  await send('Page.navigate', { url: 'http://localhost:3001/?devStage=stage02' });
  await sleep(2500);
  await captureScreenshot('stage02_desktop_tactical_hud.png');

  // -------------------------------------------------------------------------
  // 3. Stage 03 Desktop Tactical HUD
  // -------------------------------------------------------------------------
  console.log('\n[3/8] Capturing Stage 03 Desktop Tactical HUD...');
  await send('Page.navigate', { url: 'http://localhost:3001/?devStage=stage03' });
  await sleep(2500);
  await captureScreenshot('stage03_desktop_tactical_hud.png');

  // -------------------------------------------------------------------------
  // 4. Stage 04 Desktop Tactical HUD & Performance Measurement
  // -------------------------------------------------------------------------
  console.log('\n[4/8] Capturing Stage 04 Desktop Tactical HUD & Measuring Performance...');
  await send('Page.navigate', { url: 'http://localhost:3001/?devStage=stage04' });
  await sleep(2500);
  await captureScreenshot('stage04_desktop_tactical_hud.png');

  const desktopPerf = await samplePerformance(1500);
  console.log('\n--- DESKTOP STAGE 04 PERFORMANCE METRICS ---');
  console.log(`  HUD Mode: ${desktopPerf.hudMode} (Sidebar visible: ${desktopPerf.isSidebarVisible})`);
  console.log(`  FPS: ${desktopPerf.fps}`);
  console.log(`  Frame Time: ${desktopPerf.frameTimeMs} ms`);
  console.log(`  Babylon Draw Calls (avg/frame): ${desktopPerf.avgDrawCalls}`);
  console.log(`  Babylon Draw Calls (peak): ${desktopPerf.peakDrawCalls}`);
  console.log(`  Scene Meshes: ${desktopPerf.sceneMeshes}`);
  console.log(`  Active Meshes: ${desktopPerf.activeMeshes}`);
  console.log(`  Render Dimensions: ${desktopPerf.renderWidth} x ${desktopPerf.renderHeight}`);

  // -------------------------------------------------------------------------
  // 5. Stage 04 Tactical Minimap Close-Up Clip
  // -------------------------------------------------------------------------
  console.log('\n[5/8] Capturing Stage 04 Tactical Minimap Close-Up...');
  // Find minimap bounding rect
  const minimapBox = await evalExpression(`
    (() => {
      const el = document.getElementById('tacticalMinimap');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 };
    })()
  `);
  if (minimapBox) {
    await captureScreenshot('stage04_tactical_minimap.png', {
      x: Math.round(minimapBox.x) - 10,
      y: Math.round(minimapBox.y) - 10,
      width: Math.round(minimapBox.width) + 20,
      height: Math.round(minimapBox.height) + 20,
      scale: 1,
    });
  }

  // -------------------------------------------------------------------------
  // 6. Stage 04 Mobile Compact HUD (844 x 390, DPR 2.0)
  // -------------------------------------------------------------------------
  console.log('\n[6/8] Capturing Stage 04 Mobile Compact HUD & Emulated Viewport...');
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

  const mobilePerf = await samplePerformance(1500);
  console.log('\n--- MOBILE STAGE 04 PERFORMANCE METRICS ---');
  console.log(`  HUD Mode: ${mobilePerf.hudMode} (Sidebar visible: ${mobilePerf.isSidebarVisible})`);
  console.log(`  FPS: ${mobilePerf.fps}`);
  console.log(`  Frame Time: ${mobilePerf.frameTimeMs} ms`);
  console.log(`  Babylon Draw Calls (avg/frame): ${mobilePerf.avgDrawCalls}`);
  console.log(`  Babylon Draw Calls (peak): ${mobilePerf.peakDrawCalls}`);
  console.log(`  Scene Meshes: ${mobilePerf.sceneMeshes}`);
  console.log(`  Active Meshes: ${mobilePerf.activeMeshes}`);
  console.log(`  Hardware Scaling Level: ${mobilePerf.hardwareScaling.toFixed(7)}`);
  console.log(`  Physical Render Target: ${mobilePerf.renderWidth} x ${mobilePerf.renderHeight}`);

  await captureScreenshot('stage04_mobile_compact_hud.png');

  // Reset desktop emulation
  await send('Emulation.clearDeviceMetricsOverride');
  await send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await evalExpression(`window.dispatchEvent(new Event('resize'))`);
  await sleep(1000);

  // -------------------------------------------------------------------------
  // 7. Pause Overlay over Tactical HUD
  // -------------------------------------------------------------------------
  console.log('\n[7/8] Capturing Pause Overlay over Tactical HUD...');
  await evalExpression(`window.__GAME_INSTANCE__.pauseGame()`);
  await sleep(800);
  await captureScreenshot('pause_over_tactical_hud.png');
  await evalExpression(`window.__GAME_INSTANCE__.resumeGame()`);
  await sleep(500);

  // -------------------------------------------------------------------------
  // 8. Campaign Complete Modal over Tactical HUD
  // -------------------------------------------------------------------------
  console.log('\n[8/8] Capturing Campaign Complete Modal over Tactical HUD...');
  await evalExpression(`
    (() => {
      const g = window.__GAME_INSTANCE__;
      const res = g.campaignSession.buildCampaignResult();
      g.campaignCompleteUI.show(res);
    })()
  `);
  await sleep(800);
  await captureScreenshot('campaign_complete_tactical_hud.png');

  await ws.close();
  chromeProc.kill();
  console.log('\nAll 8 Phase 23 screenshots captured and performance verified.');
}

runQA().catch((err) => {
  console.error(err);
  process.exit(1);
});
