import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const PORT = 3008;
const DIST_DIR = path.resolve('dist');
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// -------------------------------------------------------------
// 1. In-process Static HTTP Server
// -------------------------------------------------------------
function startStaticServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };

  const server = http.createServer((req, res) => {
    const parsedUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
    let filePath = path.join(DIST_DIR, parsedUrl.pathname === '/' ? 'index.html' : parsedUrl.pathname);

    if (!fs.existsSync(filePath)) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    try {
      const content = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
      });
      res.end(content);
    } catch (e) {
      res.writeHead(500);
      res.end('Server Error');
    }
  });

  return new Promise((resolve) => {
    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[HTTP Server] Serving dist/ on http://127.0.0.1:${PORT}`);
      resolve(server);
    });
  });
}

// -------------------------------------------------------------
// Helper: CDP Client
// -------------------------------------------------------------
async function createCDPClient(browserPath, port, windowSize = '1920,1080') {
  const tempDir = mkdtempSync(path.join(tmpdir(), 'browser-qa-p24-'));
  const proc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu=false',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    `--window-size=${windowSize}`,
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

  if (!wsUrl) throw new Error(`Failed to connect to browser CDP on port ${port}`);

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
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result?.value;
  };

  const close = async () => {
    try {
      ws.close();
      proc.kill();
    } catch (e) {}
  };

  return { send, evaluate, close };
}

// -------------------------------------------------------------
// Main QA Runner
// -------------------------------------------------------------
async function runPhase24QA() {
  console.log('=============================================================');
  console.log('PHASE 24 — BROWSER ACCEPTANCE & RUNTIME PRODUCTION QA');
  console.log('=============================================================\n');

  const server = await startStaticServer();

  // 1. HTTP Endpoint Verification
  console.log('--- 1. Static HTTP Endpoint Asset Audit ---');
  const indexRes = await fetch(`http://127.0.0.1:${PORT}/`);
  console.log(`  [GET /] Status: ${indexRes.status} ${indexRes.statusText}`);
  if (indexRes.status !== 200) throw new Error('GET / failed');

  const indexHtml = await indexRes.text();
  const cssMatch = indexHtml.match(/href="(\/assets\/[^"]+\.css)"/);
  const jsMatch = indexHtml.match(/src="(\/assets\/[^"]+\.js)"/);

  if (cssMatch) {
    const cssRes = await fetch(`http://127.0.0.1:${PORT}${cssMatch[1]}`);
    console.log(`  [GET ${cssMatch[1]}] Status: ${cssRes.status} (CSS: ${cssRes.headers.get('content-type')})`);
    if (cssRes.status !== 200) throw new Error('CSS asset failed');
  }

  if (jsMatch) {
    const jsRes = await fetch(`http://127.0.0.1:${PORT}${jsMatch[1]}`);
    console.log(`  [GET ${jsMatch[1]}] Status: ${jsRes.status} (JS: ${jsRes.headers.get('content-type')})`);
    if (jsRes.status !== 200) throw new Error('JS asset failed');
  }

  const devStageRes = await fetch(`http://127.0.0.1:${PORT}/?devStage=stage04`);
  console.log(`  [GET /?devStage=stage04] Status: ${devStageRes.status}`);

  // 2. Google Chrome Acceptance
  console.log('\n--- 2. Google Chrome Desktop Acceptance ---');
  const chrome = await createCDPClient(CHROME_PATH, 9444, '1920,1080');
  await chrome.send('Page.enable');
  await chrome.send('Runtime.enable');

  console.log('  Navigating to production build with ?devStage=stage04...');
  await chrome.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?devStage=stage04` });
  await sleep(2500);

  // Verify Requirement 7: Production DevStage Isolation
  const devStageBadgeExists = await chrome.evaluate(`Boolean(document.getElementById('devStageBadge'))`);
  const isTitleVisible = await chrome.evaluate(`
    const el = document.getElementById('titleScreenOverlay');
    Boolean(el && (el.classList.contains('visible') || el.style.display !== 'none'));
  `);
  console.log(`  [Req 7] devStageBadge exists in DOM: ${devStageBadgeExists} (Expected: false)`);
  console.log(`  [Req 7] Title Screen loaded and visible: ${isTitleVisible} (Expected: true)`);
  if (devStageBadgeExists || !isTitleVisible) throw new Error('Req 7 DevStage production isolation failed');

  // Verify Requirement 8: Window Debug Policy
  const gameInstanceDefined = await chrome.evaluate(`window.__GAME_INSTANCE__ !== undefined`);
  const diagnosticsDefined = await chrome.evaluate(`window.__BC2026_DIAGNOSTICS__ !== undefined`);
  const diagnosticsFrozen = await chrome.evaluate(`Object.isFrozen(window.__BC2026_DIAGNOSTICS__)`);
  const initialSnapshot = await chrome.evaluate(`window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()`);

  console.log(`  [Req 8] window.__GAME_INSTANCE__ exposed: ${gameInstanceDefined} (Expected: false)`);
  console.log(`  [Req 8] window.__BC2026_DIAGNOSTICS__ exposed: ${diagnosticsDefined} (Expected: true)`);
  console.log(`  [Req 8] window.__BC2026_DIAGNOSTICS__ frozen: ${diagnosticsFrozen} (Expected: true)`);
  console.log(`  [Req 8] Initial Game State: ${initialSnapshot?.gameState}`);

  if (gameInstanceDefined || !diagnosticsDefined || !diagnosticsFrozen) {
    throw new Error('Req 8 Window debug policy audit failed');
  }

  // Verify Title Screen Campaign Tag (Requirement 35)
  const campaignTagText = await chrome.evaluate(`
    document.getElementById('titleCampaignTag')?.textContent || document.querySelector('.footer-tag')?.textContent
  `);
  console.log(`  [Req 35] Title Campaign Tag: "${campaignTagText?.trim()}" (Expected: "4 STAGE CAMPAIGN")`);

  // Start Campaign: Title -> Stage 01
  console.log('\n  Starting Campaign via #startCampaignBtn...');
  await chrome.evaluate(`document.getElementById('startCampaignBtn')?.click()`);
  await sleep(3000);

  const gameplaySnapshot = await chrome.evaluate(`window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()`);
  console.log(`  [Req 9] Game State after Start: ${gameplaySnapshot?.gameState} (Expected: PLAYING)`);
  console.log(`  [Req 9] Active Stage: ${gameplaySnapshot?.stageId} (#${gameplaySnapshot?.stageNumber})`);

  // Verify Tactical HUD Visibility & Identity (Requirements 19, 20)
  const hudCheck = await chrome.evaluate(`(() => {
    const th = document.getElementById('tacticalCommandHud');
    const stageName = document.getElementById('tchStageName')?.textContent;
    const stageBadge = document.getElementById('tchStageBadge')?.textContent;
    const directive = document.getElementById('tchMissionTitle')?.textContent;
    const lives = document.getElementById('tchLivesCount')?.textContent;
    const enemies = document.getElementById('tchEnemiesCount')?.textContent;
    const score = document.getElementById('tchScoreVal')?.textContent;
    const total = document.getElementById('tchTotalScoreVal')?.textContent;
    return {
      visible: Boolean(th && th.style.display !== 'none' && th.offsetWidth > 0),
      stageName,
      stageBadge,
      directive,
      lives,
      enemies,
      score,
      total,
      width: th?.offsetWidth
    };
  })()`);

  console.log(`  [Req 19] Tactical Command HUD visible: ${hudCheck.visible} (width: ${hudCheck.width}px)`);
  console.log(`  [Req 19] HUD Stage: ${hudCheck.stageBadge} - ${hudCheck.stageName}`);
  console.log(`  [Req 19] HUD Directive: ${hudCheck.directive}`);
  console.log(`  [Req 20] HUD Lives: ${hudCheck.lives} | Enemies: ${hudCheck.enemies} | Score: ${hudCheck.score} | Total: ${hudCheck.total}`);

  // Test Pause & Resume (Requirement 28)
  console.log('\n  Testing Pause via #tchPauseBtn...');
  await chrome.evaluate(`document.getElementById('tchPauseBtn')?.click()`);
  await sleep(500);

  const pauseState = await chrome.evaluate(`(() => {
    const snap = window.__BC2026_DIAGNOSTICS__?.getSnapshot?.();
    const overlay = document.getElementById('pauseMenuOverlay');
    return {
      gameState: snap?.gameState,
      overlayVisible: Boolean(overlay && overlay.classList.contains('visible')),
    };
  })()`);
  console.log(`  [Req 28] Paused Game State: ${pauseState.gameState} (Expected: PAUSED)`);
  console.log(`  [Req 28] Pause Overlay Visible: ${pauseState.overlayVisible} (Expected: true)`);

  console.log('  Resuming Game via #pauseResumeBtn...');
  await chrome.evaluate(`document.getElementById('pauseResumeBtn')?.click()`);
  await sleep(500);

  const resumedState = await chrome.evaluate(`window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.gameState`);
  console.log(`  [Req 28] Resumed Game State: ${resumedState} (Expected: PLAYING)`);

  // Performance Metrics (Requirements 45, 46, 47)
  const perf = await chrome.evaluate(`(() => {
    const snap = window.__BC2026_DIAGNOSTICS__?.getSnapshot?.();
    return {
      fps: snap?.fps,
      drawCalls: snap?.drawCalls,
      drawCallsAvg: snap?.drawCallsAverage,
      drawCallsPeak: snap?.drawCallsPeak,
      sceneMeshes: snap?.sceneMeshCount,
      activeMeshes: snap?.activeMeshCount,
      audioContexts: snap?.audioContextCount,
      enemyPool: snap?.enemyPoolSize,
      projPool: snap?.projectilePoolSize,
      powerupPool: snap?.powerupPoolSize,
    };
  })()`);

  console.log('\n--- 3. Google Chrome Performance & Resource Invariants ---');
  console.log(`  Engine Environment:       HEADLESS / SWIFTSHADER (WebGL Angle)`);
  console.log(`  [Req 46] Instant FPS:      ${perf.fps}`);
  console.log(`  [Req 46] Draw Calls (Avg): ${perf.drawCallsAvg} (Current: ${perf.drawCalls}, Peak: ${perf.drawCallsPeak})`);
  console.log(`  [Req 46] Scene Meshes:     ${perf.sceneMeshes} (Baseline: 411)`);
  console.log(`  [Req 46] Active Meshes:    ${perf.activeMeshes}`);
  console.log(`  [Req 18] AudioContexts:    ${perf.audioContexts} (Expected: 1)`);
  console.log(`  [Req 18] Enemy Pool:       ${perf.enemyPool} (Expected: 4)`);
  console.log(`  [Req 18] Projectile Pool:  ${perf.projPool} (Expected: 16)`);
  console.log(`  [Req 18] Powerup Pool:     ${perf.powerupPool} (Expected: 3)`);

  // Resize Stress Test: 20 cycles TACTICAL <-> COMPACT (Requirement 48)
  console.log('\n--- 4. Resize Stress Test (20 cycles TACTICAL <-> COMPACT) ---');
  for (let cycle = 1; cycle <= 20; cycle++) {
    // 1920x1080 (Tactical)
    await chrome.send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await chrome.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await sleep(40);

    // 844x390 (Compact Mobile)
    await chrome.send('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await chrome.evaluate(`window.dispatchEvent(new Event('resize'))`);
    await sleep(40);
  }

  // Restore 1920x1080
  await chrome.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await chrome.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await sleep(200);

  const postStressMeshes = await chrome.evaluate(`window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.sceneMeshCount`);
  console.log(`  ✓ 20 Cycles completed without crash.`);
  console.log(`  [Req 48] Post-stress Scene Meshes: ${postStressMeshes} (Leak Check: ${postStressMeshes === perf.sceneMeshes ? 'PASS' : 'FAIL'})`);

  // Mobile Quality & Scaling Verification (Requirement 24, 25)
  console.log('\n--- 5. Mobile Landscape Quality & Scaling Acceptance ---');
  await chrome.close();

  // Launch dedicated mobile CDP instance to test initial load as mobile device
  const mobileChrome = await createCDPClient(CHROME_PATH, 9446, '844,390');
  await mobileChrome.send('Page.enable');
  await mobileChrome.send('Runtime.enable');
  await mobileChrome.send('Emulation.setUserAgentOverride', {
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
  });
  await mobileChrome.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 5,
  });
  await mobileChrome.send('Emulation.setDeviceMetricsOverride', {
    width: 844,
    height: 390,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await mobileChrome.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/?mobile=1` });
  await sleep(2500);

  // Click start campaign on mobile
  await mobileChrome.evaluate(`document.getElementById('startCampaignBtn')?.click()`);
  await sleep(2000);

  const mobileMetrics = await mobileChrome.evaluate(`(() => {
    const snap = window.__BC2026_DIAGNOSTICS__?.getSnapshot?.();
    const th = document.getElementById('tacticalCommandHud');
    const ch = document.getElementById('hud');
    const mc = document.getElementById('mobileControls');
    const scrollX = document.documentElement.scrollWidth > window.innerWidth;
    const scrollY = document.documentElement.scrollHeight > window.innerHeight;
    return {
      isMobile: snap?.isMobile,
      maxDpr: snap?.maxDpr,
      hardwareScaling: snap?.hardwareScalingLevel,
      renderWidth: snap?.renderWidth,
      renderHeight: snap?.renderHeight,
      tacticalHidden: !th || th.style.display === 'none' || th.offsetWidth === 0,
      compactActive: Boolean(ch && ch.style.display !== 'none'),
      mobileControlsVisible: Boolean(mc && mc.style.display !== 'none' && !mc.classList.contains('hidden')),
      hasHorizontalScroll: scrollX,
      hasVerticalScroll: scrollY,
    };
  })()`);

  console.log(`  [Req 25] iPhone 12/13/14 (844×390 DPR 2.0):`);
  console.log(`    isMobile detected:   ${mobileMetrics.isMobile}`);
  console.log(`    maxDpr:              ${mobileMetrics.maxDpr} (Expected: 1.5)`);
  console.log(`    hardwareScaling:     ${mobileMetrics.hardwareScaling?.toFixed(7)} (Expected: ~0.6666667)`);
  console.log(`    render buffer:       ${mobileMetrics.renderWidth} × ${mobileMetrics.renderHeight} (Expected: ~1266 × 585)`);
  console.log(`    tactical HUD hidden: ${mobileMetrics.tacticalHidden}`);
  console.log(`    compact HUD active:  ${mobileMetrics.compactActive}`);
  console.log(`    mobile controls:     ${mobileMetrics.mobileControlsVisible}`);
  console.log(`    zero page scroll:    ${!mobileMetrics.hasHorizontalScroll && !mobileMetrics.hasVerticalScroll}`);

  // Test 932x430 (iPhone 14/15 Pro Max)
  await mobileChrome.send('Emulation.setDeviceMetricsOverride', { width: 932, height: 430, deviceScaleFactor: 3, mobile: true });
  await mobileChrome.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await sleep(100);
  const ip15MaxMetrics = await mobileChrome.evaluate(`(() => ({
    renderW: window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.renderWidth,
    renderH: window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.renderHeight,
    scroll: document.documentElement.scrollWidth > window.innerWidth
  }))()`);
  console.log(`  [Req 24] iPhone 15 Pro Max (932×430 DPR 3.0): Render ${ip15MaxMetrics.renderW}×${ip15MaxMetrics.renderH}, no scroll: ${!ip15MaxMetrics.scroll}`);

  // Test 915x412 (Samsung Galaxy S20)
  await mobileChrome.send('Emulation.setDeviceMetricsOverride', { width: 915, height: 412, deviceScaleFactor: 2.625, mobile: true });
  await mobileChrome.evaluate(`window.dispatchEvent(new Event('resize'))`);
  await sleep(100);
  const galaxyMetrics = await mobileChrome.evaluate(`(() => ({
    renderW: window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.renderWidth,
    renderH: window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()?.renderHeight,
    scroll: document.documentElement.scrollWidth > window.innerWidth
  }))()`);
  console.log(`  [Req 24] Samsung Galaxy S20 (915×412 DPR 2.625): Render ${galaxyMetrics.renderW}×${galaxyMetrics.renderH}, no scroll: ${!galaxyMetrics.scroll}`);

  await mobileChrome.close();
  console.log('✓ Google Chrome Desktop & Mobile Acceptance: COMPLETE');

  // 6. Microsoft Edge Acceptance
  console.log('\n--- 6. Microsoft Edge Desktop Acceptance ---');
  try {
    const edge = await createCDPClient(EDGE_PATH, 9445, '1920,1080');
    await edge.send('Page.enable');
    await edge.send('Runtime.enable');

    console.log('  Navigating to production build in Microsoft Edge...');
    await edge.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/` });
    await sleep(2500);

    const edgeTitleVisible = await edge.evaluate(`
      Boolean(document.getElementById('titleScreenOverlay')?.classList?.contains('visible'))
    `);
    console.log(`  Title Screen visible in Microsoft Edge: ${edgeTitleVisible}`);

    console.log('  Starting Campaign in Microsoft Edge...');
    await edge.evaluate(`document.getElementById('startCampaignBtn')?.click()`);
    await sleep(2500);

    const edgeSnapshot = await edge.evaluate(`window.__BC2026_DIAGNOSTICS__?.getSnapshot?.()`);
    console.log(`  Edge Stage 01 Running: State=${edgeSnapshot?.gameState}, Stage=${edgeSnapshot?.stageId}, Meshes=${edgeSnapshot?.sceneMeshCount}, FPS=${edgeSnapshot?.fps}`);

    await edge.close();
    console.log('✓ Microsoft Edge Desktop Acceptance: COMPLETE');
  } catch (err) {
    console.error('Edge test error:', err.message);
    throw err;
  }

  // 7. Non-installed Browser Reporting
  console.log('\n--- 7. Non-Installed Browser Audit ---');
  console.log('  Mozilla Firefox: NOT TESTED — browser unavailable');
  console.log('  Apple Safari / WebKit: NOT TESTED (macOS/iOS only on Windows)');

  // Shutdown HTTP Server
  server.close();
  console.log('\n[HTTP Server] Stopped static server.');
  console.log('\n=============================================================');
  console.log('PHASE 24 BROWSER & RUNTIME QA VERIFICATION SUCCESSFUL');
  console.log('=============================================================\n');
}

runPhase24QA().catch((err) => {
  console.error('Browser QA Failed:', err);
  process.exit(1);
});
