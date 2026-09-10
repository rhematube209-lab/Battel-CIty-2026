# BATTLE CITY 2026 — Release Notes v1.1.0

**Release Tag**: `v1.1.0`  
**Channel**: `RELEASE`  
**Release Date**: `2026-09-11`  
**Build Target**: Production Web (Standalone Static Single-Page Client)

---

## Executive Summary

Battle City 2026 v1.1.0 is a major release introducing the climactic **Stage 04: Nexus Siege**, the responsive **Tactical Command HUD**, combined environmental hazard mechanics (Cryo Ice and Mag-Drive Conveyors), extended 4-stage campaign progression, and adaptive mobile quality scaling. Built with Babylon.js and TypeScript, the game runs completely standalone with zero backend dependencies, pre-allocated object pools, deterministic simulation physics, and 100% offline static hosting support.

---

## Key Features & Enhancements

### 1. Stage 04: Nexus Siege (Grand Campaign Finale)
- **Enemy Force**: 24 hostile armor units (6 Standard Patrols, 10 Fast Interceptors, 8 Heavy Armor tanks).
- **Environmental Hazard Confluence**: First stage combining both **Cryo Ice** (8 frictionless tiles) and **Mag-Drive Conveyors** (12 automated thrust belts).
- **Hazard Transition Physics**: Seamless momentum handoff between drift slip and +2.0 u/s directional conveyor acceleration without velocity resets.
- **Defensive Core**: Fortified Command Node protected by strategic steel pylons and layered brick battlements.
- **Stage Scoring**: 4,500 pt perfect score threshold.

### 2. Tactical Command HUD
- **Desktop Tactical Sidebar**:
  - 340px dedicated tactical operations sidebar docked beside the 3D battlefield shell.
  - **Live Stage Status**: Active stage identifier, subtitle, and dynamic mission directive.
  - **Live Campaign Telemetry**: Real-time remaining lives counter (`× N`), enemy reserve quota, current stage score, and cumulative campaign total.
  - **Tactical Minimap Radar**: Real-time 2D radar displaying player tank (gold chevron), enemy tanks (red pips), Command Node (cyan crest), and perimeter boundaries.
  - **Tactical System Controls**: Integrated Sound FX toggle, Music toggle, and in-game Pause button.
- **Adaptive Responsive Layout**:
  - Automatically transitions between full desktop Tactical Sidebar and compact in-game overlay HUD based on viewport width (`<= 1024px`) and landscape mobile orientation.
  - Zero layout shift or page scrollbar overflow (`overflow: hidden` strictly enforced).
- **Responsive Camera Framing**:
  - Dynamic camera framing based on actual battlefield viewport dimensions after sidebar layout.
  - Arena occupies 88%–94% of battlefield height while preserving full north/south/east/west boundary visibility and spawn zones.

### 3. Four-Stage Tactical Campaign Progression
- **Complete 4-Stage Arc**:
  - **Stage 01: Cyber Outpost**: 12 enemies (5 Standard, 4 Fast, 3 Armor) — 2,000 pts perfect score.
  - **Stage 02: Iron Delta**: 16 enemies (5 Standard, 6 Fast, 5 Armor) — 2,900 pts perfect score.
  - **Stage 03: Forge Line**: 20 enemies (5 Standard, 8 Fast, 7 Armor) — 3,800 pts perfect score.
  - **Stage 04: Nexus Siege**: 24 enemies (6 Standard, 10 Fast, 8 Armor) — 4,500 pts perfect score.
- **Campaign Totals**:
  - **72 Total Enemies**: 21 Standard Patrols, 28 Fast Interceptors, 23 Heavy Armor tanks.
  - **Perfect Cumulative Campaign Score**: **13,200 pts**.
- **Life Carryover & Retry Checkpoints**:
  - Remaining player lives cleanly carry forward across stage completions (e.g., 3 -> 2 -> 1).
  - Mission retry (`R` key or pause menu retry) strictly restores lives held at the entry of the current stage without resetting to 3.
  - New campaign launch cleanly resets to 3 lives, Stage 01, and 0 score.
- **Dynamic Campaign Complete Screen**:
  - Programmatic DOM generation for all 4 stages showing individual scores, enemy counts, archetype kill breakdowns, and grand total.

### 4. Adaptive Mobile Quality & Viewport Scaling
- **Dynamic Quality Profiling**:
  - Viewport and pointer capability detection (`detectQualityProfile()`).
  - Mobile profile locks `maxDpr` to `1.5` (desktop allows up to `2.0`), preventing GPU thermal throttling on high-DPI displays.
  - Adaptive shadow map resolution and particle spawn caps tuned for mobile silicon.
- **Landscape Touch Controls**:
  - Virtual joystick and cannon fire button with multi-touch support.
  - Automatic portrait orientation lock with rotation prompt overlay.

### 5. Production Isolation & Engine Hardening
- **Development Tool Isolation**:
  - Development stage bootstrap (`?devStage=...`) and `#devStageBadge` completely excluded from production builds via dead-code elimination and tree shaking.
  - `window.__GAME_INSTANCE__` completely eliminated from production.
  - `window.__BC2026_DIAGNOSTICS__` hardened with `Object.freeze` to expose read-only runtime health diagnostics.
- **Zero Resource Leaks**:
  - Fixed pre-allocated pools: 4 enemy tanks, 16 projectiles, 3 powerups.
  - Single long-lived Babylon.js scene and AudioContext.
  - Mesh count invariant verified across 20 consecutive desktop-to-mobile resize cycles (407 meshes baseline, 0 mesh leak).

---

## Verification & Acceptance Baseline

- **Automated Test Suites**: 24 comprehensive test suites.
- **Formal Assertions**: Exactly **2,295 passed assertions**, 0 failures.
- **Clean-Room Verification**: Verified in isolated clean-room sibling directory with `npm ci` (0 vulnerabilities, identical `package-lock.json` sha256).
- **Browser Validation Matrix**:
  - Google Chrome 134+ (Desktop & Mobile Emulation): Fully Verified
  - Microsoft Edge 134+ (Desktop): Fully Verified
  - Mozilla Firefox: Not tested (browser unavailable in CI)
  - Apple Safari / WebKit: Not tested (macOS/iOS only)

---

## Known Limitations

- **In-Memory Campaign Persistence**: Game progress is maintained in-memory per session; browser refresh resets to Stage 01 by design.
- **Landscape Mobile Only**: Mobile gameplay is locked to landscape mode; portrait orientations display a rotate-device overlay.
- **Keyboard & Touch Input**: Physical gamepads and joysticks are not natively mapped in this release.
- **Single-Player Experience**: Self-contained client with no multiplayer or network leaderboards.
