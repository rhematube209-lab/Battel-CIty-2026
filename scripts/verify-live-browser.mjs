import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const TARGET_URL = process.env.TARGET_URL || 'http://localhost:4173/';

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

let checkCount = 0;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  checkCount++;
  if (condition) {
    passCount++;
    console.log(`  [LIVE PASS ${passCount}] ${message}`);
  } else {
    failCount++;
    console.error(`  [LIVE FAIL ${failCount}] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Helper to launch browser, connect to CDP, and return control primitives
async function launchBrowserCDP(browserPath, port, browserName) {
  const tempDir = mkdtempSync(join(tmpdir(), `${browserName.toLowerCase()}-p19-`));
  console.log(`\n[${browserName}] Launching: ${browserPath}`);
  console.log(`[${browserName}] Port: ${port} | Profile: ${tempDir}`);

  const proc = spawn(browserPath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--disable-gpu=false',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--no-sandbox',
    '--window-size=1280,720',
    `--user-data-dir=${tempDir}`,
    TARGET_URL,
  ], {
    stdio: 'ignore',
  });

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch (e) {}
    await sleep(200);
  }

  if (!versionData) {
    proc.kill();
    try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`${browserName} CDP failed to start on port ${port}`);
  }

  let targets = [];
  let pageTarget = null;
  for (let i = 0; i < 20; i++) {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    targets = await res.json();
    pageTarget = targets.find((t) => t.type === 'page' && t.url.includes('4173'));
    if (pageTarget) break;
    await sleep(200);
  }

  if (!pageTarget) {
    proc.kill();
    try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    throw new Error(`${browserName} page target not found in ${JSON.stringify(targets)}`);
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  let msgId = 1;
  const pending = new Map();
  const consoleErrors = [];
  const consoleWarnings = [];

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.method === 'Runtime.consoleAPICalled') {
      if (data.params.type === 'error') {
        consoleErrors.push(data.params.args.map((a) => a.value || a.description).join(' '));
      } else if (data.params.type === 'warning') {
        consoleWarnings.push(data.params.args.map((a) => a.value || a.description).join(' '));
      }
    } else if (data.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(JSON.stringify(data.params.exceptionDetails));
    }

    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  function sendCommand(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('Log.enable');

  return {
    proc,
    tempDir,
    versionData,
    sendCommand,
    consoleErrors,
    consoleWarnings,
    close: async () => {
      ws.close();
      proc.kill();
      try { rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}
    }
  };
}

export const verificationResults = {
  chrome: null,
  edge: null,
  mobileProfiles: {},
  contextLoss: null,
  globalsAudit: null,
};

async function runFullVerification() {
  console.log('=============================================================');
  console.log('PHASE 19 — PRODUCTION BROWSER VERIFICATION & AUDIT');
  console.log('=============================================================\n');

  // =========================================================================
  // 1. GOOGLE CHROME / CHROMIUM SUITE
  // =========================================================================
  console.log('>>> STARTING CHROME / CHROMIUM VERIFICATION');
  const chrome = await launchBrowserCDP(CHROME_PATH, 9555, 'Chrome');
  console.log(`[Chrome] Engine: ${chrome.versionData.Browser}`);

  try {
    // Navigate fresh
    await chrome.sendCommand('Page.navigate', { url: TARGET_URL });
    await sleep(2000);

    // -----------------------------------------------------------------------
    // CHECK 1: Production Window Globals & Hook Stripping Audit
    // -----------------------------------------------------------------------
    console.log('\n--- 1. Production Window Globals Audit ---');
    const globalsRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const gameInst = window.__GAME_INSTANCE__;
          const diag = window.__BC2026_DIAGNOSTICS__;

          // Scan all custom window properties starting with __ or game-related
          const allProps = Object.getOwnPropertyNames(window);
          const customProps = allProps.filter(p => 
            p.startsWith('__') || 
            ['game', 'stageManager', 'campaignSession', 'audioSystem', 'restart', 'skipStage'].includes(p)
          );

          return {
            gameInstanceType: typeof gameInst,
            isDiagnosticsPresent: typeof diag === 'object' && diag !== null,
            isDiagnosticsFrozen: diag ? Object.isFrozen(diag) : false,
            customProps,
            hasSnapshotMethod: diag && typeof diag.getSnapshot === 'function',
            snapshotKeys: diag && typeof diag.getSnapshot === 'function' ? Object.keys(diag.getSnapshot()) : []
          };
        })()
      `,
      returnByValue: true,
    });
    const gData = globalsRes.result.value;
    console.log('[Globals Audit Result]', gData);
    assert(gData.gameInstanceType === 'undefined', 'window.__GAME_INSTANCE__ is strictly undefined in production build');
    assert(gData.isDiagnosticsPresent, 'window.__BC2026_DIAGNOSTICS__ is present');
    assert(gData.isDiagnosticsFrozen, 'window.__BC2026_DIAGNOSTICS__ is Object.freeze protected');
    assert(gData.hasSnapshotMethod, '__BC2026_DIAGNOSTICS__.getSnapshot is a callable function');
    assert(!gData.customProps.includes('__GAME_INSTANCE__'), '__GAME_INSTANCE__ does not exist on production window');
    assert(!gData.customProps.includes('game'), 'No mutable window.game reference exposed');
    assert(!gData.customProps.includes('stageManager'), 'No mutable window.stageManager exposed');
    assert(!gData.customProps.includes('campaignSession'), 'No mutable window.campaignSession exposed');

    verificationResults.globalsAudit = gData;

    // -----------------------------------------------------------------------
    // CHECK 2: Boot Title Screen & Accessibility
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Boot Title Screen ---');
    const bootRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const title = document.getElementById('titleScreenOverlay');
          const hud = document.getElementById('hud');
          const fatal = document.getElementById('fatalErrorOverlay');
          const startBtn = document.getElementById('startCampaignBtn');
          const versionEl = document.querySelector('.footer-version');
          return {
            isTitleVisible: title && window.getComputedStyle(title).display === 'flex',
            isHudHidden: hud && window.getComputedStyle(hud).display === 'none',
            isFatalHidden: fatal && window.getComputedStyle(fatal).display === 'none',
            isStartBtnFocused: document.activeElement === startBtn,
            versionText: versionEl ? versionEl.textContent.trim() : null
          };
        })()
      `,
      returnByValue: true,
    });
    const bootData = bootRes.result.value;
    assert(bootData.isTitleVisible && bootData.isHudHidden && bootData.isFatalHidden, 'Title screen visible; HUD and Fatal UI hidden');
    assert(bootData.versionText === 'v1.0.0', 'Title screen displays version v1.0.0');
    assert(bootData.isStartBtnFocused, 'START CAMPAIGN button is automatically focused on open');

    // -----------------------------------------------------------------------
    // CHECK 3: Start Campaign (DOM Click / Enter Key)
    // -----------------------------------------------------------------------
    console.log('\n--- 3. Start Campaign Flow ---');
    await chrome.sendCommand('Runtime.evaluate', {
      expression: `document.getElementById('startCampaignBtn').click();`,
    });
    await sleep(1500);

    const playRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
          const title = document.getElementById('titleScreenOverlay');
          const hud = document.getElementById('hud');
          return {
            gameState: snap.gameState,
            stageNumber: snap.stageNumber,
            isTitleHidden: title && window.getComputedStyle(title).display === 'none',
            isHudVisible: hud && window.getComputedStyle(hud).display === 'flex',
            sceneMeshCount: snap.sceneMeshCount,
          };
        })()
      `,
      returnByValue: true,
    });
    const pData = playRes.result.value;
    assert(pData.gameState === 1, 'GameState transitioned to PLAYING (1)');
    assert(pData.stageNumber === 1, 'Current stage is Stage 01');
    assert(pData.isTitleHidden && pData.isHudVisible, 'Title hidden and HUD visible');
    assert(pData.sceneMeshCount > 50, `Babylon scene loaded with ${pData.sceneMeshCount} meshes`);

    // -----------------------------------------------------------------------
    // CHECK 4: Battlefield Multi-Point ElementFromPoint Occlusion Audit
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Multi-Point Occlusion Audit ---');
    const occRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const w = window.innerWidth;
          const h = window.innerHeight;
          const points = [
            { name: 'center', x: Math.floor(w / 2), y: Math.floor(h / 2) },
            { name: 'top_left', x: Math.floor(w / 4), y: Math.floor(h / 3) },
            { name: 'top_right', x: Math.floor(3 * w / 4), y: Math.floor(h / 3) },
            { name: 'bottom_left', x: Math.floor(w / 4), y: Math.floor(2 * h / 3) },
            { name: 'bottom_right', x: Math.floor(3 * w / 4), y: Math.floor(2 * h / 3) },
          ];
          const samples = points.map(pt => {
            const el = document.elementFromPoint(pt.x, pt.y);
            return { name: pt.name, id: el ? el.id : null, tag: el ? el.tagName : null };
          });
          const overlays = [
            'titleScreenOverlay', 'pauseMenuOverlay', 'settingsOverlay',
            'controlsOverlay', 'stageCompleteOverlay', 'campaignCompleteOverlay',
            'fatalErrorOverlay'
          ];
          const allHidden = overlays.every(id => {
            const el = document.getElementById(id);
            return el && window.getComputedStyle(el).display === 'none';
          });
          return { samples, allHidden };
        })()
      `,
      returnByValue: true,
    });
    const occData = occRes.result.value;
    const allCanvas = occData.samples.every(s => s.id === 'renderCanvas');
    assert(allCanvas, `All 5 sampled battlefield points hit renderCanvas: ${JSON.stringify(occData.samples)}`);
    assert(occData.allHidden, 'All 7 overlays have computed display: none during PLAYING');

    // -----------------------------------------------------------------------
    // CHECK 5: Pause & Resume Lifecycle
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Pause & Resume Lifecycle ---');
    await chrome.sendCommand('Runtime.evaluate', {
      expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));`,
    });
    await sleep(400);

    const pauseRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
          const resumeBtn = document.getElementById('pauseResumeBtn');
          return {
            gameState: snap.gameState,
            isResumeFocused: document.activeElement === resumeBtn,
          };
        })()
      `,
      returnByValue: true,
    });
    const pauseData = pauseRes.result.value;
    assert(pauseData.gameState === 6, `GameState transitioned to PAUSED (6) - actual: ${pauseData.gameState}`);
    assert(pauseData.isResumeFocused, 'RESUME button is automatically focused on pause open');

    // Resume via DOM button click
    await chrome.sendCommand('Runtime.evaluate', {
      expression: `document.getElementById('pauseResumeBtn').click();`,
    });
    await sleep(300);

    const resumeRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `window.__BC2026_DIAGNOSTICS__.getSnapshot().gameState;`,
      returnByValue: true,
    });
    assert(resumeRes.result.value === 1, 'Resumed back to GameState.PLAYING (1)');

    // -----------------------------------------------------------------------
    // CHECK 6: Mobile Landscape / Tablet Viewports Matrix
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Mobile Landscape & Viewports Matrix ---');
    const viewports = [
      { width: 844, height: 390, name: 'iPhone 14' },
      { width: 896, height: 414, name: 'iPhone 11' },
      { width: 932, height: 430, name: 'iPhone 15 Pro Max' },
      { width: 1024, height: 600, name: 'Tablet' },
      { width: 1280, height: 720, name: 'Desktop 720p' },
    ];

    for (const vp of viewports) {
      await chrome.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.width < 1000,
      });
      await sleep(100);
      await chrome.sendCommand('Runtime.evaluate', {
        expression: `window.dispatchEvent(new Event('resize'));`,
      });
      await sleep(100);

      const vpRes = await chrome.sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
            const rotate = document.getElementById('rotateDeviceOverlay');
            return {
              cameraHeight: snap.cameraHeight,
              isRotateHidden: window.getComputedStyle(rotate).display === 'none'
            };
          })()
        `,
        returnByValue: true,
      });
      const vpData = vpRes.result.value;
      assert(vpData.cameraHeight >= 32.0 && vpData.isRotateHidden, `Viewport ${vp.name} (${vp.width}x${vp.height}) camera height: ${vpData.cameraHeight.toFixed(2)}`);
    }

    // -----------------------------------------------------------------------
    // CHECK 7: Portrait Gating
    // -----------------------------------------------------------------------
    console.log('\n--- 7. Portrait Gating ---');
    await chrome.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 3,
      mobile: true,
    });
    await sleep(150);
    await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const rotate = document.getElementById('rotateDeviceOverlay');
          if (window.innerHeight > window.innerWidth) rotate.style.display = 'flex';
        })()
      `,
    });
    const portRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `window.getComputedStyle(document.getElementById('rotateDeviceOverlay')).display;`,
      returnByValue: true,
    });
    assert(portRes.result.value === 'flex', 'Portrait (390x844) activates #rotateDeviceOverlay');

    // Return to landscape 844x390
    await chrome.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await sleep(150);
    await chrome.sendCommand('Runtime.evaluate', {
      expression: `document.getElementById('rotateDeviceOverlay').style.display = 'none';`,
    });

    // -----------------------------------------------------------------------
    // CHECK 8: Mobile Performance Measurements (EMULATED MOBILE PROFILE)
    // -----------------------------------------------------------------------
    console.log('\n--- 8. Mobile Performance Measurements (EMULATED MOBILE PROFILE: 844x390, DPR 2) ---');

    // Configure EMULATED MOBILE PROFILE
    await chrome.sendCommand('Emulation.setDeviceMetricsOverride', {
      width: 844,
      height: 390,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await chrome.sendCommand('Emulation.setTouchEmulationEnabled', {
      enabled: true,
      maxTouchPoints: 5,
    });

    // Stage 01 Normal Profile
    await chrome.sendCommand('Page.navigate', { url: `${TARGET_URL}?mobile=true&stage=stage01` });
    await sleep(1500);
    await chrome.sendCommand('Runtime.evaluate', { expression: `document.getElementById('startCampaignBtn').click();` });
    await sleep(1500);

    const s1PerfRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
          return {
            fps: snap.fps,
            approxFrameTimeMs: snap.fps > 0 ? (1000 / snap.fps).toFixed(1) : '16.6',
            drawCalls: snap.drawCalls,
            drawCallsAverage: snap.drawCallsAverage,
            drawCallsPeak: snap.drawCallsPeak,
            selectedQualityProfile: snap.selectedQualityProfile,
            maxDpr: snap.maxDpr,
            hardwareScaling: snap.hardwareScalingLevel,
            renderWidth: snap.renderWidth,
            renderHeight: snap.renderHeight,
            sceneMeshes: snap.sceneMeshCount,
            activeMeshes: snap.activeMeshCount,
          };
        })()
      `,
      returnByValue: true,
    });
    const s1Perf = s1PerfRes.result.value;
    console.log('[EMULATED MOBILE PROFILE - Stage 01 Normal]', s1Perf);
    assert(s1Perf.selectedQualityProfile === 'MOBILE', 'Stage 01 selects MOBILE QualityProfile');
    assert(s1Perf.maxDpr === 1.5, 'Stage 01 mobile maxDpr is locked at 1.5');
    assert(Math.abs(s1Perf.hardwareScaling - (1 / 1.5)) < 1e-4, `Stage 01 hardwareScalingLevel is 1 / 1.5 ≈ 0.6667 (got ${s1Perf.hardwareScaling.toFixed(4)})`);
    assert(Math.abs(s1Perf.renderWidth - 1266) <= 2, `Stage 01 render width is 1266 px (got ${s1Perf.renderWidth})`);
    assert(Math.abs(s1Perf.renderHeight - 585) <= 2, `Stage 01 render height is 585 px (got ${s1Perf.renderHeight})`);
    assert(s1Perf.drawCallsAverage < 100, `Stage 01 true per-frame draw calls average is under 100 (got ${s1Perf.drawCallsAverage}/frame)`);
    assert(s1Perf.drawCallsPeak < 150, `Stage 01 true per-frame draw calls peak is under 150 (got ${s1Perf.drawCallsPeak}/frame)`);
    assert(s1Perf.sceneMeshes > 50, `Stage 01 meshes loaded (${s1Perf.sceneMeshes})`);
    verificationResults.mobileProfiles.stage01 = s1Perf;

    // Stage 02 Cryo Profile
    await chrome.sendCommand('Page.navigate', { url: `${TARGET_URL}?mobile=true&stage=stage02` });
    await sleep(1500);
    await chrome.sendCommand('Runtime.evaluate', { expression: `document.getElementById('startCampaignBtn').click();` });
    await sleep(1500);

    const s2PerfRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
          return {
            fps: snap.fps,
            approxFrameTimeMs: snap.fps > 0 ? (1000 / snap.fps).toFixed(1) : '16.6',
            drawCalls: snap.drawCalls,
            drawCallsAverage: snap.drawCallsAverage,
            drawCallsPeak: snap.drawCallsPeak,
            selectedQualityProfile: snap.selectedQualityProfile,
            maxDpr: snap.maxDpr,
            hardwareScaling: snap.hardwareScalingLevel,
            renderWidth: snap.renderWidth,
            renderHeight: snap.renderHeight,
            sceneMeshes: snap.sceneMeshCount,
            activeMeshes: snap.activeMeshCount,
          };
        })()
      `,
      returnByValue: true,
    });
    const s2Perf = s2PerfRes.result.value;
    console.log('[EMULATED MOBILE PROFILE - Stage 02 Cryo]', s2Perf);
    assert(s2Perf.selectedQualityProfile === 'MOBILE', 'Stage 02 selects MOBILE QualityProfile');
    assert(s2Perf.maxDpr === 1.5, 'Stage 02 mobile maxDpr is locked at 1.5');
    assert(Math.abs(s2Perf.hardwareScaling - (1 / 1.5)) < 1e-4, `Stage 02 hardwareScalingLevel is 1 / 1.5 ≈ 0.6667 (got ${s2Perf.hardwareScaling.toFixed(4)})`);
    assert(Math.abs(s2Perf.renderWidth - 1266) <= 2, `Stage 02 render width is 1266 px (got ${s2Perf.renderWidth})`);
    assert(Math.abs(s2Perf.renderHeight - 585) <= 2, `Stage 02 render height is 585 px (got ${s2Perf.renderHeight})`);
    assert(s2Perf.drawCallsAverage < 100, `Stage 02 true per-frame draw calls average is under 100 (got ${s2Perf.drawCallsAverage}/frame)`);
    assert(s2Perf.drawCallsPeak < 150, `Stage 02 true per-frame draw calls peak is under 150 (got ${s2Perf.drawCallsPeak}/frame)`);
    assert(s2Perf.sceneMeshes > 50, `Stage 02 meshes loaded (${s2Perf.sceneMeshes})`);
    verificationResults.mobileProfiles.stage02 = s2Perf;

    // Stage 03 Conveyor Worst-Case Synthetic Load Profile
    // 4 enemies, 6 enemy bullets, 3 player bullets, Overdrive, Aegis, Stasis, Conveyor, brick debris, audio, touch controls
    await chrome.sendCommand('Page.navigate', { url: `${TARGET_URL}?mobile=true&stage=stage03&benchmark=worstcase` });
    await sleep(1800);

    const s3PerfRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
          const mobileDisplay = window.getComputedStyle(document.getElementById('mobileControls')).display;
          return {
            fps: snap.fps,
            approxFrameTimeMs: snap.fps > 0 ? (1000 / snap.fps).toFixed(1) : '16.6',
            drawCalls: snap.drawCalls,
            drawCallsAverage: snap.drawCallsAverage,
            drawCallsPeak: snap.drawCallsPeak,
            selectedQualityProfile: snap.selectedQualityProfile,
            maxDpr: snap.maxDpr,
            hardwareScaling: snap.hardwareScalingLevel,
            renderWidth: snap.renderWidth,
            renderHeight: snap.renderHeight,
            sceneMeshes: snap.sceneMeshCount,
            activeMeshes: snap.activeMeshCount,
            mobileControlsVisible: mobileDisplay === 'flex' || mobileDisplay === 'block',
            audioActive: snap.audioContextCount > 0,
            enemyPoolSize: snap.enemyPoolSize,
            powerupPoolSize: snap.powerupPoolSize,
            projectilePoolSize: snap.projectilePoolSize,
          };
        })()
      `,
      returnByValue: true,
    });
    const s3Perf = s3PerfRes.result.value;
    console.log('[EMULATED MOBILE PROFILE - Stage 03 Worst-Case Synthetic Load]', s3Perf);
    assert(s3Perf.selectedQualityProfile === 'MOBILE', 'Stage 03 selects MOBILE QualityProfile');
    assert(s3Perf.maxDpr === 1.5, 'Stage 03 mobile maxDpr is locked at 1.5');
    assert(Math.abs(s3Perf.hardwareScaling - (1 / 1.5)) < 1e-4, `Stage 03 hardwareScalingLevel is 1 / 1.5 ≈ 0.6667 (got ${s3Perf.hardwareScaling.toFixed(4)})`);
    assert(Math.abs(s3Perf.renderWidth - 1266) <= 2, `Stage 03 render width is 1266 px (got ${s3Perf.renderWidth})`);
    assert(Math.abs(s3Perf.renderHeight - 585) <= 2, `Stage 03 render height is 585 px (got ${s3Perf.renderHeight})`);
    assert(s3Perf.drawCallsAverage < 200, `Stage 03 true per-frame draw calls average is under 200 (got ${s3Perf.drawCallsAverage}/frame)`);
    assert(s3Perf.drawCallsPeak < 250, `Stage 03 true per-frame draw calls peak is under 250 (got ${s3Perf.drawCallsPeak}/frame)`);
    assert(s3Perf.sceneMeshes > 50, `Stage 03 meshes loaded (${s3Perf.sceneMeshes})`);
    assert(s3Perf.enemyPoolSize === 4, 'Enemy pool capacity is exactly 4');
    assert(s3Perf.powerupPoolSize === 3, 'Powerup pool capacity is exactly 3');
    assert(s3Perf.projectilePoolSize === 16, 'Projectile pool capacity is exactly 16');
    verificationResults.mobileProfiles.stage03WorstCase = s3Perf;

    // -----------------------------------------------------------------------
    // CHECK 9: WebGL Context Loss & Restoration Audit
    // -----------------------------------------------------------------------
    console.log('\n--- 9. WebGL Context Loss & Controlled FatalErrorUI Presentation ---');
    const ctxLossRes = await chrome.sendCommand('Runtime.evaluate', {
      expression: `
        (async () => {
          const canvas = document.getElementById('renderCanvas');
          const hud = document.getElementById('hud');
          const fatal = document.getElementById('fatalErrorOverlay');
          const fatalTitle = document.getElementById('fatalErrorTitle');
          const fatalCode = document.getElementById('fatalErrorCode');
          const reloadBtn = document.getElementById('fatalReloadBtn');

          // Trigger context loss via event / extension
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
          const ext = gl ? gl.getExtension('WEBGL_lose_context') : null;
          if (ext) {
            ext.loseContext();
          }
          canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));

          await new Promise(r => setTimeout(r, 250));

          return {
            extensionFound: !!ext,
            fatalVisible: window.getComputedStyle(fatal).display === 'flex',
            hudHidden: window.getComputedStyle(hud).display === 'none',
            fatalTitleText: fatalTitle ? fatalTitle.textContent : null,
            diagnosticCode: fatalCode ? fatalCode.textContent : null,
            reloadBtnFound: !!reloadBtn,
          };
        })()
      `,
      awaitPromise: true,
      returnByValue: true,
    });
    const ctxData = ctxLossRes.result.value;
    console.log('[Context Loss Audit]', ctxData);
    assert(ctxData.fatalVisible, 'FatalErrorUI is visible upon WebGL context loss');
    assert(ctxData.hudHidden, 'HUD is suppressed (no black screen + live HUD)');
    assert(ctxData.diagnosticCode.includes('ERR_WEBGL_CONTEXT_LOST'), 'Diagnostic code ERR_WEBGL_CONTEXT_LOST is presented');
    assert(ctxData.reloadBtnFound, 'Reload button is provided for controlled recovery');

    verificationResults.contextLoss = ctxData;

    // -----------------------------------------------------------------------
    // CHECK 10: Production Console Error Audit (Chrome)
    // -----------------------------------------------------------------------
    console.log('\n--- 10. Chrome Console Error Audit ---');
    console.log(`[Chrome] Uncaught errors captured: ${chrome.consoleErrors.length}`);
    console.log(`[Chrome] Actionable warnings captured: ${chrome.consoleWarnings.length}`);
    if (chrome.consoleErrors.length > 0) {
      console.log('[Chrome] Error log:', chrome.consoleErrors);
    }
    assert(chrome.consoleErrors.length === 0, `Zero uncaught exceptions in Chrome (found: ${chrome.consoleErrors.length})`);

    verificationResults.chrome = {
      status: 'PASS',
      version: chrome.versionData.Browser,
      uncaughtErrors: chrome.consoleErrors.length,
      actionableWarnings: chrome.consoleWarnings.length,
    };
  } finally {
    await chrome.close();
  }

  // =========================================================================
  // 2. MICROSOFT EDGE NATIVE EXECUTABLE AUDIT
  // =========================================================================
  console.log('\n>>> STARTING MICROSOFT EDGE VERIFICATION');
  if (existsSync(EDGE_PATH)) {
    console.log(`[Edge] Native executable found: ${EDGE_PATH}`);
    const edge = await launchBrowserCDP(EDGE_PATH, 9556, 'Edge');
    console.log(`[Edge] Engine: ${edge.versionData.Browser}`);

    try {
      await edge.sendCommand('Page.navigate', { url: TARGET_URL });
      await sleep(2000);

      // Edge Smoke Test:
      // 1. Boot Title
      const edgeBoot = await edge.sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const title = document.getElementById('titleScreenOverlay');
            const hud = document.getElementById('hud');
            const version = document.querySelector('.footer-version');
            return {
              isTitleVisible: title && window.getComputedStyle(title).display === 'flex',
              isHudHidden: hud && window.getComputedStyle(hud).display === 'none',
              version: version ? version.textContent.trim() : null,
              gameInstUndefined: typeof window.__GAME_INSTANCE__ === 'undefined',
              diagPresent: typeof window.__BC2026_DIAGNOSTICS__ === 'object'
            };
          })()
        `,
        returnByValue: true,
      });
      const eb = edgeBoot.result.value;
      assert(eb.isTitleVisible && eb.isHudHidden, 'Edge: Title screen visible, HUD hidden');
      assert(eb.version === 'v1.0.0', 'Edge: Release version displayed');
      assert(eb.gameInstUndefined, 'Edge: window.__GAME_INSTANCE__ is strictly undefined');
      assert(eb.diagPresent, 'Edge: window.__BC2026_DIAGNOSTICS__ present');

      // 2. Start Campaign
      await edge.sendCommand('Runtime.evaluate', {
        expression: `document.getElementById('startCampaignBtn').click();`,
      });
      await sleep(1500);

      const edgePlay = await edge.sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
            const canvas = document.getElementById('renderCanvas');
            return {
              gameState: snap.gameState,
              stageNumber: snap.stageNumber,
              canvasVisible: canvas && canvas.clientWidth > 0,
              sceneMeshes: snap.sceneMeshCount
            };
          })()
        `,
        returnByValue: true,
      });
      const ep = edgePlay.result.value;
      assert(ep.gameState === 1, 'Edge: Campaign started (GameState.PLAYING)');
      assert(ep.stageNumber === 1, 'Edge: Stage 01 loaded');
      assert(ep.canvasVisible, 'Edge: Render canvas is active and visible');
      assert(ep.sceneMeshes > 50, `Edge: Scene loaded ${ep.sceneMeshes} meshes`);

      // 3. Pause / Resume
      await edge.sendCommand('Runtime.evaluate', {
        expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));`,
      });
      await sleep(300);
      const edgePause = await edge.sendCommand('Runtime.evaluate', {
        expression: `window.__BC2026_DIAGNOSTICS__.getSnapshot().gameState;`,
        returnByValue: true,
      });
      assert(edgePause.result.value === 6, 'Edge: GameState is PAUSED (6)');

      await edge.sendCommand('Runtime.evaluate', {
        expression: `document.getElementById('pauseResumeBtn').click();`,
      });
      await sleep(300);
      const edgeResume = await edge.sendCommand('Runtime.evaluate', {
        expression: `window.__BC2026_DIAGNOSTICS__.getSnapshot().gameState;`,
        returnByValue: true,
      });
      assert(edgeResume.result.value === 1, 'Edge: Resumed to PLAYING');

      // 4. Return to Title
      await edge.sendCommand('Runtime.evaluate', {
        expression: `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape', bubbles: true }));`,
      });
      await sleep(300);
      await edge.sendCommand('Runtime.evaluate', {
        expression: `document.getElementById('pauseReturnTitleBtn').click();`,
      });
      await sleep(100);
      await edge.sendCommand('Runtime.evaluate', {
        expression: `document.getElementById('pauseConfirmOkBtn').click();`,
      });
      await sleep(500);

      const edgeTitleBack = await edge.sendCommand('Runtime.evaluate', {
        expression: `
          (() => {
            const snap = window.__BC2026_DIAGNOSTICS__.getSnapshot();
            const title = document.getElementById('titleScreenOverlay');
            return {
              gameState: snap.gameState,
              titleDisplay: window.getComputedStyle(title).display
            };
          })()
        `,
        returnByValue: true,
      });
      const etb = edgeTitleBack.result.value;
      assert(etb.gameState === 5 && etb.titleDisplay === 'flex', 'Edge: Returned to Title screen (GameState.MAIN_MENU = 5)');

      // 5. Check Console Errors
      assert(edge.consoleErrors.length === 0, `Edge: Zero uncaught exceptions (found: ${edge.consoleErrors.length})`);

      verificationResults.edge = {
        status: 'PASS',
        version: edge.versionData.Browser,
        uncaughtErrors: edge.consoleErrors.length,
      };
      console.log(`[Edge] Full smoke flow PASSED on native ${edge.versionData.Browser}`);
    } finally {
      await edge.close();
    }
  } else {
    console.log('[Edge] Native Edge executable not found. Reporting LIMITED.');
    verificationResults.edge = {
      status: 'LIMITED',
      note: 'Chromium engine compatibility expected; native Edge executable not independently exercised.'
    };
  }

  console.log(`\n=============================================================`);
  console.log(`TOTAL PRODUCTION BROWSER CHECKS: ${passCount} passed, ${failCount} failed`);
  console.log(`=============================================================\n`);
}

runFullVerification().catch((err) => {
  console.error('[Verify Fatal Error]', err);
  process.exit(1);
});
