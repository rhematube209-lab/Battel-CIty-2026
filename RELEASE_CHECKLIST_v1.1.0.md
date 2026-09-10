# BATTLE CITY 2026 — Release Checklist v1.1.0

**Release Tag**: `v1.1.0`  
**Channel**: `RELEASE`  
**Audit Date**: `2026-09-11`

---

## 1. Version & Configuration
- [x] `src/config/buildInfo.ts` version updated to `1.1.0`
- [x] `src/config/buildInfo.ts` channel updated to `RELEASE`
- [x] `package.json` version updated to `1.1.0`
- [x] `package-lock.json` synchronized (zero dependency alterations)
- [x] `package-lock.json` SHA256 preserved across clean install (`878de051b4a742c97a05dbbf1497449f21e2ceee5a8e99d5faa3b27353e6acc1`)

---

## 2. Compilation & Static Analysis
- [x] `npx tsc --noEmit` passes with exit code 0 and zero diagnostics
- [x] Clean-room environment created in sibling directory `../battel-city-2026-v110-final-clean-room`
- [x] `npm ci` completed cleanly with exit code 0 in clean-room environment
- [x] `npm audit` reports 0 vulnerabilities

---

## 3. Automated Regression & Unit Test Suites
- [x] Exactly 24 test suites registered in `package.json` and executed
- [x] Baseline assertions: exactly 2,295 passed formal assertions (24 suites)
- [x] 0 test failures, 0 skipped assertions
- [x] Aggregator verified with strict regex `/(?:RESULTS|COMPLETE)[:\s]+(\d+)\s+passed/i` with zero regex false positives
- [x] Release validation suite (`test-v110-rc-acceptance.mjs`) passes 110 assertions

---

## 4. Production Build & Static Asset Audit
- [x] `npm run build` completes in < 8.0s without warnings
- [x] `dist/index.html` generated with correct title and viewport meta tags
- [x] `dist/assets/` contains hashed bundles: CSS (~47.7 kB) and JS modules (~5.29 MB)
- [x] Zero `.map` sourcemap files generated in `dist/`
- [x] Zero `localhost` or local IP references in production bundles
- [x] Zero `devStage` or `devStageBadge` strings in production bundles
- [x] `window.__GAME_INSTANCE__` completely eliminated from production bundle
- [x] `applyDevStageBootstrap` tree-shaken out of production bundle

---

## 5. HTTP Serving & Runtime Isolation
- [x] Static HTTP server boots on `http://127.0.0.1:3008` serving `dist/`
- [x] `GET /` returns HTTP 200 OK
- [x] `GET /assets/*.css` returns HTTP 200 OK with `Content-Type: text/css`
- [x] `GET /assets/*.js` returns HTTP 200 OK with `Content-Type: text/javascript`
- [x] `GET /?devStage=stage04` returns HTTP 200 OK; devStage query is ignored in production
- [x] `#devStageBadge` is absent from production DOM
- [x] Title Screen loads cleanly with `"4 STAGE CAMPAIGN"` tag
- [x] `window.__GAME_INSTANCE__` is strictly `undefined`
- [x] `window.__BC2026_DIAGNOSTICS__` is defined and sealed with `Object.freeze`

---

## 6. Browser Verification Matrix
- [x] **Google Chrome (Desktop 1920×1080)**:
  - [x] Title Screen renders and responds to `#startCampaignBtn`
  - [x] Stage 01 initializes into `PLAYING` state
  - [x] Tactical Command HUD visible (340px width) with correct stage title, directive, lives, score, and minimap
  - [x] In-game pause (`#tchPauseBtn`) and resume (`#pauseResumeBtn`) functional
  - [x] 20 resize stress cycles (1920×1080 <-> 844×390) complete with 0 mesh leaks (scene mesh count constant at 407)
- [x] **Google Chrome (Mobile Viewports)**:
  - [x] iPhone 12/13/14 (844×390 DPR 2.0): `maxDpr: 1.5`, `hardwareScaling: 0.6666667`, buffer `1266 × 585`, tactical HUD hidden, compact HUD active, touch controls visible, zero page scroll
  - [x] iPhone 15 Pro Max (932×430 DPR 3.0): buffer `1398 × 645`, zero page scroll
  - [x] Samsung Galaxy S20 (915×412 DPR 2.625): buffer `1372 × 618`, zero page scroll
- [x] **Microsoft Edge (Desktop 1920×1080)**:
  - [x] Title screen renders cleanly
  - [x] Start Campaign transitions to Stage 01 in `PLAYING` state with 407 meshes
- [x] **Non-Installed Browser Audit**:
  - [x] Mozilla Firefox: Formally logged as `NOT TESTED — browser unavailable`
  - [x] Apple Safari / WebKit: Formally logged as `NOT TESTED (macOS/iOS only)`

---

## 7. Performance & Resource Invariants
- [x] AudioContext count: exactly 1 (zero duplicates on retries/stage loads)
- [x] Enemy tank pool: exactly 4 instances
- [x] Projectile pool: exactly 16 instances
- [x] Powerup pool: exactly 3 instances
- [x] Scene mesh count: 407 baseline meshes (no unbounded accumulation)

---

## 8. Campaign Progression & Scoring Invariants
- [x] Stage 01 perfect score: 2,000 pts (12 enemies)
- [x] Stage 02 perfect score: 2,900 pts (16 enemies)
- [x] Stage 03 perfect score: 3,800 pts (20 enemies)
- [x] Stage 04 perfect score: 4,500 pts (24 enemies)
- [x] Total campaign perfect score: **13,200 pts**
- [x] Total campaign enemies: **72 enemies** (21 Standard, 28 Fast, 23 Armor)
- [x] Life carryover across stages (e.g. 3 -> 2 -> 1)
- [x] Retry restores current stage entry checkpoint lives without refilling to 3
- [x] New campaign launch resets to 3 lives, Stage 01, and 0 score
- [x] Campaign complete UI dynamically renders 4 stage rows with safe `textContent`

---

## 9. Release Packaging & Integrity
- [x] Final archive `battle-city-2026-v1.1.0.zip` packaged with root `index.html` and `assets/` (no outer `dist/` directory)
- [x] `SHA256SUMS_v1.1.0.txt` generated with exact byte counts and SHA-256 digests (SHA-256: `d66ba410a47ff2296936a51e0b1e001f50b9dc0a242cb92978fff3bb6390e4c2`)
- [x] Final archive extracted to fresh directory and verified bootable via static HTTP server
- [x] Extracted final archive verified via automated headless Chrome and Microsoft Edge smoke tests
- [x] RC evidence `battle-city-2026-v1.1.0-rc.1.zip` and `SHA256SUMS_v1.1.0-rc.1.txt` strictly preserved
- [x] `RELEASE_NOTES_v1.0.0.md` strictly untouched and preserved
- [x] `battle-city-2026-v1.0.0.zip` strictly untouched and preserved
