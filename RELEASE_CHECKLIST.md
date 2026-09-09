# BATTLE CITY 2026 — Final Release 1.0.0 QA Checklist

**Version**: `1.0.0` [RELEASE]  
**Channel**: `RELEASE`  
**Target Platform**: Modern Desktop Browsers & Mobile Landscape

---

## Final Release Sign-Off Matrix

- [x] **Clean npm ci**: Verified reproducible installation with package-lock.json.
- [x] **npm test**: All 19 automated test suites passing with 0 failures.
- [x] **TypeScript**: `npx tsc --noEmit` exits with code 0 (0 errors).
- [x] **Build**: `npm run build` produces clean production bundle in `dist/`.
- [x] **npm audit**: 0 vulnerabilities found.
- [x] **Chrome**: Native Google Chrome CDP verification passed (0 uncaught errors).
- [x] **Edge**: Native Microsoft Edge CDP verification passed (0 uncaught errors).
- [x] **Mobile emulation**: 844×390, DPR 2.0, maxDpr 1.5, scale ~0.6667, render ~1266×585, UI fits.
- [x] **Portrait**: 390×844 activates Rotate Device overlay; no gameplay/input leaks.
- [x] **Context loss**: `WEBGL_lose_context` triggers `FatalErrorUI` (`ERR_WEBGL_CONTEXT_LOST`) and reload button.
- [x] **Fatal boot**: Fallback `FatalErrorUI` presents accessible recovery without stack traces.
- [x] **Offline**: Standalone client runs without internet connectivity (0 external network fetches).
- [x] **Artifact checksum**: `battle-city-2026-v1.0.0.zip` SHA-256 computed and verified against extracted test.
- [x] **Version 1.0.0**: Single source of truth `BUILD_INFO` aligned with `package.json` and UI badges (no "RC").

---

## 1. Boot & Initialization
- [x] Application cold loads to Title Screen (`GameState.MAIN_MENU`).
- [x] Version tag `v1.0.0` is visible in Title Screen footer.
- [x] Initial keyboard focus rests on **START CAMPAIGN** button.
- [x] WebGL context validation: if WebGL is unavailable, `FatalErrorUI` replaces canvas with fallback hardware acceleration message and **RELOAD** button.
- [x] If boot failure occurs, gameplay HUD, mobile controls, and all overlays remain strictly hidden.
- [x] Console displays 0 uncaught exceptions.

## 2. Front-End Game Flow & Controls
- [x] Pressing **START CAMPAIGN** or **Enter** begins Stage 01 (`GameState.PLAYING`).
- [x] Desktop keyboard movement: **W, A, S, D** or **Arrow Keys** steer the player tank.
- [x] Primary fire: **Spacebar** fires standard cannon with active projectile limits.
- [x] Mute audio: **M** key or top-right HUD speaker icon toggles audio output.
- [x] Single Enter press starts campaign exactly once without re-triggering hidden handlers.

## 3. In-Game Pause System
- [x] Pressing **ESC** or **P** during gameplay opens Pause Menu (`GameState.PAUSED`).
- [x] Simulation completely freezes (tanks, bullets, and powerup timers frozen).
- [x] Tank tread audio loop stops immediately upon pause (0 per-frame audio side effects).
- [x] Pause menu automatically focuses **RESUME** button.
- [x] **RESTART STAGE** triggers confirmation dialog and defaults focus to **CANCEL**.
- [x] Cancelling confirmation returns focus to **RESUME** button.
- [x] **RETURN TO TITLE** triggers confirmation dialog and safely returns to Title Screen on confirmation.
- [x] Resuming restores gameplay cleanly without camera jump.

## 4. Accessibility & System Settings
- [x] Settings modal accessible from Title Screen and Pause Menu.
- [x] **AUDIO**: Toggles between ON and MUTED (synchronized across settings, HUD, and M key).
- [x] **REDUCED MOTION**: Toggles between SYSTEM and ON.
  - Suppresses camera shake, modal animations, and intense motion cues.
  - Dynamically reflects `prefers-reduced-motion` media query in SYSTEM mode.
- [x] Closing Settings returns focus and view to the calling modal.
- [x] Controls guide accurately documents all desktop and mobile touch controls.

## 5. Multi-Stage Campaign Progression
- [x] **Stage 01: Cyber Outpost**
  - 12 enemies (5 Standard, 4 Fast, 3 Armor).
  - Powerup milestones at 3, 6, 9 kills.
  - Perfect stage score: 2,000 points.
- [x] **Stage 02: Iron Delta**
  - 16 enemies (5 Standard, 6 Fast, 5 Armor).
  - 7 Cryo floor tiles with realistic sliding physics.
  - Powerup milestones at 4, 8, 12 kills.
  - Carried lives preserved from Stage 01.
  - Perfect stage score: 2,900 points.
- [x] **Stage 03: Forge Line**
  - 20 enemies (5 Standard, 8 Fast, 7 Armor).
  - 10 Mag-Drive Conveyor tiles with deterministic directional push (+2.0 u/s).
  - Powerup milestones at 5, 10, 15 kills.
  - Carried lives preserved from Stage 02.
  - Perfect stage score: 3,800 points.
- [x] **Campaign Victory & Result Summary**
  - Perfect total score: 8,700 points.
  - Total enemies destroyed: 48 (15 Standard, 18 Fast, 15 Armor).
  - **NEW CAMPAIGN** button cleanly resets and restarts Stage 01 without page refresh.

## 6. Combat & Entity Life Cycles
- [x] Command Base destruction immediately triggers Game Over.
- [x] Player life loss decrements lives counter and triggers temporary invulnerability on respawn.
- [x] Reaching 0 lives triggers Game Over modal.
- [x] Pressing **R** or **RESTART MISSION** button retries current stage from entry checkpoint lives.
- [x] Intermediate Stage Complete modal advances to next sector only (R key restart gated).

## 7. Mobile & Responsive Layout
- [x] Mobile touch controls layer active in mobile landscape viewports.
- [x] Virtual analog joystick controls cardinal tank heading.
- [x] Big red **FIRE** button supports rapid tap and held continuous firing.
- [x] Camera dynamically scales height upward to preserve field of view on narrow aspect ratios.
- [x] Portrait orientation triggers **ROTATE YOUR DEVICE** barrier; rotating back restores gameplay.

## 8. Build, Network & Resource Stability
- [x] Application operates 100% offline from `dist/` production bundle (0 external CDN dependencies).
- [x] Single `Engine`, `Scene`, and `AudioContext` maintained across 20+ campaign iterations.
- [x] Pre-allocated fixed entity pools: 4 Enemy Tank slots, 3 Powerup drops, 16 Projectiles.
- [x] All 19 automated test suites passing cleanly (0 failures).
- [x] `npx tsc --noEmit` exits cleanly with 0 type errors.
- [x] `npm audit` reports 0 known vulnerabilities.
