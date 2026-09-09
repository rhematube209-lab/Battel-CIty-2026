# BATTLE CITY 2026

Modern 3D tactical arcade tank combat game powered by Babylon.js and TypeScript.

**Version**: `1.0.0` [RELEASE]  
**Channel**: `RELEASE`  
**License**: MIT / Open Software

---

## Overview

Battle City 2026 is an original 3D tactical armored arcade game inspired by classic vehicular combat. It features deterministic cardinal physics, directional bullet reflections, destructible brick quadrant maps, temporal powerups, ice and conveyor environmental hazards, dynamic enemy AI archetypes, and an authoritative 3-stage campaign progression with cumulative score and life carryover.

---

## Requirements

- **Node.js**: `v18.0.0` or higher (tested with `v20.x` / `v22.x`)
- **Package Manager**: `npm` `v9.0.0` or higher
- **Web Browser**: Modern Chromium-based desktop browser (Google Chrome 110+, Microsoft Edge 110+) or mobile browser with WebGL2 support.

---

## Quick Start

### 1. Installation
```bash
npm install
# or for strict reproducible installation:
npm ci
```

### 2. Development Server
```bash
npm run dev
```
Starts the local development server at `http://localhost:3000/` (or next available port).

### 3. Automated Tests
```bash
npm test
```
Executes all 19 automated regression, architecture, and release verification test suites.

### 4. Type Check
```bash
npx tsc --noEmit
```

### 5. Production Build
```bash
npm run build
```
Compiles TypeScript and bundles production assets into the `dist/` directory.

### 6. Serving Production Dist
```bash
npm run preview
```
Serves the bundled production build locally at `http://localhost:4173/`.  
Alternatively, serve `dist/` with any standard static HTTP server (e.g. `npx serve dist` or Python's `python -m http.server 8080 -d dist`).

---

## Controls

### Desktop Keyboard
| Key | Action |
| :--- | :--- |
| **W, A, S, D** / **Arrow Keys** | Move Tank (Cardinal Navigation) |
| **Spacebar** | Fire Cannon |
| **ESC** / **P** | Pause / Resume Game |
| **M** | Toggle Mute Sound Effects |
| **R** | Restart Mission (Active during Playing & Game Over) |
| **Enter** | Start Campaign / Advance Dialog |

### Mobile Touch (Landscape)
| Control | Action |
| :--- | :--- |
| **Left Virtual Joystick** | Cardinal Tank Movement |
| **Right Red Button** | Cannon Fire (Tap or Continuous Hold) |
| **HUD Pause Button (Top-Right)** | Pause Game |
| **HUD Mute Button (Top-Right)** | Toggle Mute Sound |

> **Mobile Landscape Note**: Mobile gameplay is specifically designed and locked to landscape mode. Portrait viewports activate a responsive "Please Rotate Device" overlay preventing input leaks and letterboxing.

---

## Campaign Content

The 1.0.0 release includes the complete three-stage campaign with score carryover and life preservation:

1. **Stage 01: Cyber Outpost**
   - 12 enemies (5 Standard, 4 Fast, 3 Armor)
   - Baseline tactical brick and steel maze with defensive bunker protecting the Command Base
   - Powerup drops at 3, 6, and 9 enemies destroyed
   - Perfect clear score: **2,000 pts**

2. **Stage 02: Iron Delta**
   - 16 enemies (5 Standard, 6 Fast, 5 Armor)
   - Introduces **Cryo Ice Terrain** (7 Cryo tiles) with reduced traction and drift physics
   - Powerup drops at 4, 8, and 12 enemies destroyed
   - Perfect clear score: **2,900 pts**

3. **Stage 03: Forge Line**
   - 20 enemies (5 Standard, 8 Fast, 7 Armor)
   - Introduces **Mag-Drive Conveyors** (10 Conveyor tiles) with continuous directional push (+2.0 u/s)
   - Powerup drops at 5, 10, and 15 enemies destroyed
   - Perfect clear score: **3,800 pts**

**Full Campaign Victory**:
- Total enemies destroyed: **48** (15 Standard, 18 Fast, 15 Armor)
- Perfect cumulative campaign score: **8,700 pts**

---

## Known Limitations

- **In-Memory Session Persistence**: Game progress and campaign session data are held in memory during the active session. Hard page refreshes reset the campaign to Stage 01 by design.
- **Landscape Mobile Only**: Mobile layout requires landscape orientation; portrait mode displays a rotation prompt.
- **Keyboard and Touch Only**: Gamepads and controllers are not natively supported in v1.0.0.
- **Single-Player Local Client**: Standalone local client with no multiplayer, backend servers, or cloud dependencies.
- **Browser Validation Matrix**: Verified on Google Chrome and Microsoft Edge on Windows. Firefox, Safari/WebKit, and physical mobile hardware remain unverified in the current automated pipeline.
