# BATTLE CITY 2026 — Release Notes v1.0.0

**Release Tag**: `v1.0.0`  
**Channel**: `RELEASE`  
**Release Date**: `2026-09-10`

---

## Executive Summary

Battle City 2026 v1.0.0 is the official production release of the 3D tactical arcade tank combat game built with Babylon.js and TypeScript. It features a complete three-stage campaign, distinct enemy archetypes, temporal tactical powerups, dynamic environmental terrain hazards, robust lifecycle audio and pause menus, responsive mobile controls, accessibility accommodations, and a fully standalone, offline-ready deployment architecture.

---

## Key Features

### 1. Three-Stage Tactical Campaign
- **Stage 01: Cyber Outpost**: 12 enemies, baseline tactical brick/steel labyrinth, Command Base defense, 2,000 pt perfect score.
- **Stage 02: Iron Delta**: 16 enemies, introduces Cryo Ice terrain, 2,900 pt perfect score.
- **Stage 03: Forge Line**: 20 enemies, introduces Mag-Drive Conveyor belts, 3,800 pt perfect score.
- **Full Campaign**: 48 total enemies, 8,700 pt perfect campaign score, seamless stage transitions with life carryover.

### 2. Specialized Enemy Archetypes
- **Standard Patrol**: Baseline armor (1 HP), balanced speed (3.4 u/s), standard cannon fire.
- **Fast Interceptor**: Agile scouting tank (4.6 u/s), fast fire cooldown, 1 HP.
- **Heavy Armor**: High-durability brawler (3 HP), heavy tread speed (2.8 u/s), visual damage degradation states.

### 3. Tactical Powerup System
- **Overdrive Core**: Doubles cannon fire rate (0.14s cooldown) and permits 3 active projectiles in flight.
- **Aegis Shield**: Deploys an impenetrable hexagonal forcefield absorbing all enemy fire for 10 seconds.
- **Stasis Pulse**: Freezes all active enemy movement, firing routines, and tread animations for 8 seconds.

### 4. Interactive Terrain & Environmental Hazards
- **Destructible Brick**: Per-quadrant sub-tile collision and destruction with directional particle debris.
- **Impenetrable Steel**: Bullet-deflecting armor plating protecting choke points.
- **Cryo Ice**: 7 frictionless surface tiles with momentum slip and steering drift physics.
- **Mag-Drive Conveyors**: 10 automated conveyor tiles applying continuous directional thrust (+2.0 u/s).
- **Command Base**: Vulnerable core unit requiring tactical defense; destruction triggers instant mission failure.

### 5. Release UX & System Controls
- **Title Screen**: Clean launch flow with keyboard and mouse focus navigation.
- **In-Game Pause System**: Fully freezes simulation, stops continuous audio loops, and provides confirmation dialogs for stage retries and return-to-title navigation.
- **Accessibility & Settings**: Audio mute toggle and Reduced Motion mode (suppressing screen shake, vibration vignettes, and modal transitions).
- **Mobile Landscape Controls**: Virtual directional joystick and dedicated cannon fire button with automatic portrait orientation gating.

### 6. Architecture & Reliability
- **Zero Memory Leaks**: Pre-allocated pools for projectiles (16), enemy tanks (4), and powerups (3); single long-lived Babylon scene and audio context.
- **WebGL Resilience**: Managed context loss handling displaying `FatalErrorUI` (`ERR_WEBGL_CONTEXT_LOST`) with clean reload recovery.
- **100% Offline Static Client**: Provider-neutral static deployment bundle requiring zero backend APIs or runtime CDN dependencies.

---

## Known Limitations

- **No Refresh Persistence**: Campaign progression is managed in-memory per session; hard page reload resets to Stage 01.
- **Landscape Mobile Only**: Portrait mode is gated with an orientation prompt to preserve tactical field-of-view.
- **Keyboard & Touch Input**: Gamepads and controllers are not natively mapped in this release.
- **Single-Player Experience**: Completely self-contained client with no multiplayer or network leaderboards.
- **Browser Validation Matrix**: Validated on Google Chrome and Microsoft Edge on Windows. Firefox and Safari/WebKit remain unverified in the automated CI pipeline.
- **Physical Mobile Performance**: Emulated mobile profiles verified via headless Chrome SwiftShader; physical device thermal profiles may differ.
