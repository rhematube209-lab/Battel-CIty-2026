# BATTLE CITY 2026 — Release Manifest v1.1.0

**Release Tag**: `v1.1.0`  
**Channel**: `RELEASE`  
**Release Date**: `2026-09-11`  
**Target Environment**: Static Web Client (HTML5 / ES Modules / WebGL2 / Web Audio)

---

## 1. Release Deliverables

| Artifact | Size (Bytes) | Size (MiB) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `battle-city-2026-v1.1.0.zip` | 1,186,695 | 1.13 MiB | `d66ba410a47ff2296936a51e0b1e001f50b9dc0a242cb92978fff3bb6390e4c2` |
| `SHA256SUMS_v1.1.0.txt` | 120 | < 0.01 MiB | — |

### Preserved Release Candidate Evidence:
| RC Artifact | Size (Bytes) | Size (MiB) | SHA-256 Checksum |
| :--- | :--- | :--- | :--- |
| `battle-city-2026-v1.1.0-rc.1.zip` | 1,186,684 | 1.13 MiB | `89f45375a154afca9a81594f702828da85d5204bd813f75387fe036df01e7bae` |
| `SHA256SUMS_v1.1.0-rc.1.txt` | 126 | < 0.01 MiB | — |

> **Archive Structure Notice**: The archive contains `index.html` and the `assets/` directory at its root. There is no outer `dist/` wrapper directory, making it directly extractable into any web hosting root.

---

## 2. Build Environment & Dependencies

| Tool / Dependency | Version | Purpose |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 Pro / PowerShell | Build & Execution Host |
| **Node.js** | `v24.13.1` | Execution Runtime |
| **npm** | `11.8.0` | Package Manager |
| **TypeScript** | `5.7.3` | Type Checker & Transpiler |
| **Vite** | `6.2.0` | Production Bundler & Asset Pipeline |
| **@babylonjs/core** | `^7.53.0` (installed: `7.53.0`) | 3D Rendering & Scene Graph Engine |

---

## 3. Production Bundles (`dist/`)

| File | Size (Bytes) | Gzip Estimated | Type |
| :--- | :--- | :--- | :--- |
| `dist/index.html` | 21,032 | ~4.2 kB | Main Entrypoint HTML |
| `dist/assets/index-B1RSng2F.css` | 47,669 | ~8.6 kB | Production Stylesheet |
| `dist/assets/index-BzI1WGP3.js` | 5,295,853 | ~1.17 MB | Production Game Bundle (ES Module) |
| Dynamic Chunks (Texture Loaders / Babylon) | ~300 kB | ~75 kB | Code-Split Engine Modules |

### Build Hygiene Invariants:
- **Sourcemaps**: Zero `.map` files generated.
- **Localhost Strings**: Zero occurrences of `localhost` or internal IP addresses.
- **DevStage Isolation**: Zero references to `devStage` or `#devStageBadge` in bundled code.
- **Global Pollution**: `window.__GAME_INSTANCE__` is completely eliminated via dead-code elimination.
- **Diagnostics**: `window.__BC2026_DIAGNOSTICS__` is sealed with `Object.freeze`.

---

## 4. Quality & Acceptance Metrics

| Verification Category | Status | Details |
| :--- | :--- | :--- |
| **TypeScript Compilation** | **PASS** | `npx tsc --noEmit` exit code 0 |
| **Clean-Room Dependency Install** | **PASS** | `npm ci` completed cleanly; 0 vulnerabilities |
| **Lockfile Invariant** | **PASS** | SHA256 `878de051b4a742c97a05dbbf1497449f21e2ceee5a8e99d5faa3b27353e6acc1` |
| **Automated Test Suites** | **PASS** | 24 test suites executed |
| **Formal Assertions** | **PASS** | Exactly 2,295 passed assertions; 0 failures |
| **Aggregator Verification** | **PASS** | 100% regex match consistency across all suites |
| **Resize Stress Resistance** | **PASS** | 20 cycles desktop <-> mobile; 0 mesh leaks (407 baseline) |
| **Pool Enforcements** | **PASS** | 4 enemies, 16 projectiles, 3 powerups, 1 AudioContext |
| **Four-Stage Campaign Scoring** | **PASS** | 13,200 pts perfect score; 72 enemies (21 Standard, 28 Fast, 23 Armor) |
| **Life & Checkpoint Carry** | **PASS** | Lives carry forward; retry restores stage-entry lives |

---

## 5. Browser Compatibility Matrix

| Browser | Target OS | Validation Status | Notes |
| :--- | :--- | :--- | :--- |
| **Google Chrome 134+** | Windows Desktop | **VERIFIED** | Full 3D rendering, Tactical HUD, Pause, Resize |
| **Google Chrome (Emulated Mobile)** | iOS / Android | **VERIFIED** | iPhone 12/13/14, 15 Pro Max, Galaxy S20 |
| **Microsoft Edge 134+** | Windows Desktop | **VERIFIED** | Full Title Screen & Stage 01 progression |
| **Mozilla Firefox** | Windows Desktop | **NOT TESTED** | Browser unavailable in automated test environment |
| **Apple Safari / WebKit** | macOS / iOS | **NOT TESTED** | Requires native Apple hardware |

---

## 6. Release Heritage & Immutability

- **`battle-city-2026-v1.0.0.zip`**: Size 1,154,657 bytes — strictly immutable and preserved.
- **`RELEASE_NOTES_v1.0.0.md`**: Preserved strictly without modification.
