import { Game } from './game/Game';
import { runGridConversionTests } from './world/testGrid';
import { BUILD_INFO, getBuildDiagnosticString } from './config/buildInfo';
import { FatalErrorUI } from './ui/FatalErrorUI';
import { applyDevStageBootstrap } from './dev/DevStageBootstrap';

// Track handled error occurrences to prevent duplicate console spam
const loggedErrors = new WeakSet<object>();

// Global runtime diagnostic error listeners (Requirements 9, 78)
window.addEventListener('error', (event) => {
  if (event.error && typeof event.error === 'object') {
    if (loggedErrors.has(event.error)) return;
    loggedErrors.add(event.error);
  }
  console.error('[Runtime Error]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    build: BUILD_INFO.version,
    channel: BUILD_INFO.channel,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  if (reason && typeof reason === 'object') {
    if (loggedErrors.has(reason)) return;
    loggedErrors.add(reason);
  }
  console.error('[Unhandled Promise Rejection]', {
    reason: event.reason instanceof Error ? event.reason.message : event.reason,
    build: BUILD_INFO.version,
    channel: BUILD_INFO.channel,
  });
});

window.addEventListener('DOMContentLoaded', () => {
  const fatalUI = new FatalErrorUI();

  try {
    // 1. Log release build diagnostics
    console.log(`[BOOT] ${getBuildDiagnosticString()} initialized.`);

    // 2. Self-test grid conversions
    runGridConversionTests();

    // 3. Canvas element presence verification (Requirement 7)
    const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement | null;
    if (!canvas) {
      const err = new Error('Fatal: #renderCanvas element not found in DOM.');
      console.error('[Fatal Boot Error]', {
        error: err.message,
        build: getBuildDiagnosticString(),
        userAgent: navigator.userAgent,
      });
      fatalUI.show({
        title: 'UNABLE TO INITIALIZE GAME',
        message: 'Primary display canvas was not found in the page.',
        code: 'ERR_CANVAS_MISSING',
      });
      return;
    }

    // 4. WebGL/WebGL2 hardware acceleration capability check (Requirements 7, 8)
    const hasWebGL = !!(
      window.WebGL2RenderingContext && canvas.getContext('webgl2')
    ) || !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );

    if (!hasWebGL) {
      console.error('[Fatal Boot Error]', {
        error: 'WebGL context initialization failed or hardware acceleration disabled.',
        build: getBuildDiagnosticString(),
        userAgent: navigator.userAgent,
      });
      fatalUI.show({
        title: 'UNABLE TO INITIALIZE GAME',
        isWebGLUnavailable: true,
        code: 'ERR_WEBGL_UNAVAILABLE',
      });
      return;
    }

    // WebGL Context Loss & Restoration Listeners (Requirements 7, 8, Phase 19 Hardening)
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      console.warn('[WebGL Context Lost] GPU context was lost by the browser or driver.');
      fatalUI.show({
        title: 'GRAPHICS CONTEXT LOST',
        message: 'The graphics context was lost by the GPU or browser.\nClick reload to resume gameplay.',
        code: 'ERR_WEBGL_CONTEXT_LOST',
      });
    });

    canvas.addEventListener('webglcontextrestored', () => {
      console.info('[WebGL Context Restored] Context restoration event received. Performing clean reload...');
      window.location.reload();
    });

    // 5. Initialize Core Game within strict exception containment boundary (Requirement 3)
    const urlParams = new URLSearchParams(window.location.search);
    const benchmarkParam = urlParams.get('benchmark');

    const game = new Game(canvas, 'stage01');

    if (benchmarkParam === 'worstcase') {
      game.setupWorstCaseBenchmark();
    }

    // Preferred Dev-Hook Policy: window.__GAME_INSTANCE__ and devStage bootstrap only in DEV; inert in production
    if (import.meta.env.DEV) {
      (window as unknown as { __GAME_INSTANCE__?: Game }).__GAME_INSTANCE__ = game;

      const devStage = urlParams.get('devStage');
      if (devStage) {
        const devLives = urlParams.get('devLives');
        applyDevStageBootstrap(game, devStage, devLives);
      }
    }

    // Production-safe read-only diagnostics alternative (Phase 19 Hardening)
    // Does NOT expose Game, StageManager, CampaignSession, or mutable subsystems.
    (window as unknown as { __BC2026_DIAGNOSTICS__?: object }).__BC2026_DIAGNOSTICS__ = Object.freeze({
      getSnapshot: () => Object.freeze({
        gameState: game.getGameState(),
        stageNumber: game.getStageNumber(),
        stageId: game.getStageId(),
        sceneMeshCount: game.getSceneMeshCount(),
        activeMeshCount: game.getActiveMeshCount(),
        audioContextCount: game.getAudioContextCount(),
        enemyPoolSize: game.getEnemyPoolSize(),
        powerupPoolSize: game.getPowerupPoolSize(),
        projectilePoolSize: game.getProjectilePoolSize(),
        fps: game.getFps(),
        drawCalls: game.getDrawCalls(),
        drawCallsAverage: game.getDrawCallsAverage(),
        drawCallsPeak: game.getDrawCallsPeak(),
        selectedQualityProfile: game.getSelectedQualityProfile(),
        maxDpr: game.getMaxDpr(),
        hardwareScalingLevel: game.getHardwareScalingLevel(),
        renderWidth: game.getRenderWidth(),
        renderHeight: game.getRenderHeight(),
        cameraHeight: game.getCameraHeight(),
        cameraFov: game.getCameraFov(),
      }),
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[Fatal Boot Error]', {
      name: err.name,
      message: err.message,
      stack: err.stack,
      build: getBuildDiagnosticString(),
      userAgent: navigator.userAgent,
    });

    // Conceal HUD/modals and present FatalErrorUI (Requirements 4, 10)
    fatalUI.show({
      title: 'UNABLE TO INITIALIZE GAME',
      message: 'A critical engine initialization error occurred.',
      code: err.name || 'ERR_BOOT_FAILURE',
    });
  }
});
