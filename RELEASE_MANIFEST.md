# BATTLE CITY 2026 — Release Manifest v1.0.0

## Product Identity
- **Product**: BATTLE CITY 2026
- **Version**: 1.0.0
- **Channel**: RELEASE
- **Release Date**: 2026-09-10
- **Commit Hash**: Not applicable (Workspace is standalone directory without active Git repository)
- **Tag Status**: Prepared as `v1.0.0` (Command: `git tag -a v1.0.0 -m "Battle City 2026 v1.0.0"`)

---

## Build Environment & Toolchain
- **Operating System**: Windows (x64)
- **Node.js**: `v24.13.1`
- **npm**: `11.8.0`
- **TypeScript**: `5.9.3`
- **Vite**: `6.4.3`
- **Babylon.js Core**: `^7.53.0`

---

## Release Artifacts & Cryptographic Hashes

| Artifact File | Description | SHA-256 Checksum |
| :--- | :--- | :--- |
| `battle-city-2026-v1.0.0.zip` | Deployable production static package (`dist/`) | `2b06a876f42b3998e8abfce8281cc48976c8ffb13e2ca4c5455d1a3086436b48` |
| `dist/index.html` | Production entry point | `93b04371be3b0579e707bac88d1c8e9830c866800d7e2e560322a473cfb69692` |
| `dist/assets/index-DbSIrHdX.js` | Main application bundle (5.02 MB) | `635e8643cfb82042dc937592665fd47a94662fcaf6ac93677708a6e5dcb1efdc` |
| `dist/assets/index-D4I9sLDV.css` | Compiled stylesheet bundle (34.9 kB) | `d74a48fea6905b29f89677b8e4711de68d1b5d311c156ea27306c668be402e6f` |

---

## Quality & Test Verification Summary

- **Automated Regression Suites**: 19 test suites (`npm test`).
- **Formal npm-test Assertions**: 1664 passed, 0 failed.
- **Separate Live Browser Matrix**: 70 live CDP checks passed across Chrome (`Chrome/152.0.7977.77`) and Edge (`Edg/152.0.4191.66`).
- **TypeScript Typecheck**: Clean (0 errors via `npx tsc --noEmit`).
- **Security Audit**: 0 vulnerabilities found via `npm audit`.
- **Production Sourcemap Policy**: Disabled (0 `.map` files emitted).
- **Production Globals Policy**: `window.__GAME_INSTANCE__` strictly undefined; `window.__BC2026_DIAGNOSTICS__` frozen and read-only.

---

## Browser Compatibility & Evidence Matrix

- **Google Chrome (Native Chromium)**: PASS (`Chrome/152.0.7977.77` on Windows).
- **Microsoft Edge (Native)**: PASS (`Edg/152.0.4191.66` on Windows).
- **Mozilla Firefox**: NOT TESTED (native Firefox executable unavailable in test environment; no inferred PASS).
- **Apple Safari / WebKit**: NOT TESTED (macOS/iOS runtime unavailable in test environment).
- **Emulated Mobile Landscape**: PASS (844×390, DPR 2.0, maxDpr 1.5, render dimensions 1266×585, touch controls active).
- **Physical Mobile Hardware**: NOT TESTED (emulation conducted via headless SwiftShader).

---

## Known Limitations

1. **Session Scope**: Campaign progress is preserved in-memory; hard page refresh returns to Title screen.
2. **Orientation**: Mobile display is locked to landscape mode (portrait prompt active).
3. **Input Modalities**: Keyboard and touch supported; native gamepads not mapped in v1.0.0.
4. **Standalone Client**: Zero external network dependencies, no multiplayer, no telemetry.
