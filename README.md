# BATTLE CITY 2026

Modern 3D tactical arcade tank combat game powered by Babylon.js and TypeScript.

**Version**: `1.1.0` [RELEASE]  
**Channel**: `RELEASE`  
**License**: MIT / Open Software

---

## Overview

Battle City 2026 is an original 3D tactical armored arcade game inspired by classic vehicular combat. It features deterministic cardinal physics, directional bullet reflections, destructible brick quadrant maps, temporal powerups, ice and conveyor environmental hazards, dynamic enemy AI archetypes, a responsive Tactical Command HUD with live minimap radar, and an authoritative 4-stage campaign progression with cumulative score and life carryover.

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
Executes all 24 automated regression, architecture, and release verification test suites (2,295 passed assertions).

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

### Tactical Command HUD (Desktop)
- **Live Status**: Current stage, subtitle, and primary objective directive.
- **Mission Telemetry**: Active player lives (`× N`), enemy reserve quota, current stage score, and cumulative campaign total.
- **Radar Minimap**: Real-time 2D arena radar tracking player, enemies, and Command Node.
- **System Actions**: In-HUD Audio FX mute toggle, Music toggle, and Pause button.

### Mobile Touch (Landscape)
| Control | Action |
| :--- | :--- |
| **Left Virtual Joystick** | Cardinal Tank Movement |
| **Right Red Button** | Cannon Fire (Tap or Continuous Hold) |
| **HUD Pause Button (Top-Right)** | Pause Game |
| **HUD Mute Button (Top-Right)** | Toggle Mute Sound |

> **Mobile Landscape Note**: Mobile gameplay is specifically designed and locked to landscape mode. Portrait viewports activate a responsive "Please Rotate Device" overlay preventing input leaks and letterboxing. Mobile devices operate with adaptive quality scaling (`maxDpr: 1.5`).

---

## Campaign Content

The 1.1.0 release features the complete 4-stage tactical campaign with score carryover and checkpoint life preservation:

1. **Stage 01: Cyber Outpost**
   - 12 enemies (6 Standard, 4 Fast, 2 Armor)
   - Baseline tactical brick and steel maze with defensive bunker protecting the Command Base
   - Powerup drops at 3, 6, and 9 enemies destroyed
   - Perfect clear score: **2,000 pts**

2. **Stage 02: Iron Delta**
   - 16 enemies (4 Standard, 6 Fast, 6 Armor)
   - Introduces **Cryo Ice Terrain** (7 Cryo tiles) with reduced traction and drift physics
   - Powerup drops at 4, 8, and 12 enemies destroyed
   - Perfect clear score: **2,900 pts**

3. **Stage 03: Forge Line**
   - 20 enemies (5 Standard, 8 Fast, 7 Armor)
   - Introduces **Mag-Drive Conveyors** (10 Conveyor tiles) with continuous directional push (+2.0 u/s)
   - Powerup drops at 5, 10, and 15 enemies destroyed
   - Perfect clear score: **3,800 pts**

4. **Stage 04: Nexus Siege (Climactic Finale)**
   - 24 enemies (6 Standard, 10 Fast, 8 Armor)
   - Combined **Cryo Ice** (8 tiles) + **Mag-Drive Conveyors** (12 tiles) with transition momentum physics
   - Powerup drops at 6, 12, and 18 enemies destroyed
   - Perfect clear score: **4,500 pts**

**Full Campaign Victory**:
- Total enemies destroyed: **72** (21 Standard, 28 Fast, 23 Armor)
- Perfect cumulative campaign score: **13,200 pts**
- Remaining player lives carry across stages; retrying a stage restores checkpoint lives without refilling to 3.

---

## Release Documentation

- [Release Notes v1.1.0](file:///RELEASE_NOTES_v1.1.0.md)
- [Release Checklist v1.1.0](file:///RELEASE_CHECKLIST_v1.1.0.md)
- [Release Manifest v1.1.0](file:///RELEASE_MANIFEST_v1.1.0.md)
- [Production Deployment Guide](file:///DEPLOYMENT.md)
- [Release Notes v1.0.0 (Legacy)](file:///RELEASE_NOTES_v1.0.0.md)

---

## Known Limitations

- **In-Memory Session Persistence**: Game progress and campaign session data are held in memory during the active session. Hard page refreshes reset the campaign to Stage 01 by design.
- **Landscape Mobile Only**: Mobile layout requires landscape orientation; portrait mode displays a rotation prompt.
- **Keyboard and Touch Only**: Gamepads and controllers are not natively supported in this release.
- **Single-Player Local Client**: Standalone local client with no multiplayer, backend servers, or cloud dependencies.
- **Browser Validation Matrix**: Verified on Google Chrome and Microsoft Edge on Windows. Firefox, Safari/WebKit, and physical mobile hardware remain unverified in the current automated pipeline.
