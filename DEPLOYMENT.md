# BATTLE CITY 2026 — Production Deployment Guide

**Version**: `1.1.0` [RELEASE]  
**Architecture**: Fully Static Single-Page Client (HTML5 / ES Modules / WebGL2 / Web Audio)

---

## Deployment Instructions (Provider-Neutral)

Battle City 2026 requires **no backend server, no database, no server-side rendering, and no API services**. It can be deployed to any static web hosting platform (e.g., NGINX, Apache, Cloudflare Pages, GitHub Pages, AWS S3 + CloudFront, Vercel, Netlify).

### Step-by-Step Deployment:
1. **Obtain or Build Release Artifact**:
   - Use the pre-built `battle-city-2026-v1.1.0.zip` release package, OR
   - Build cleanly from source:
     ```bash
     npm ci
     npm run build
     ```
     The deployable assets are located in the `dist/` directory.

2. **Extract Archive**:
   If using the release package `battle-city-2026-v1.1.0.zip`, extract its contents directly. The root of the archive contains `index.html` and the `assets/` directory (no outer `dist/` folder):
   ```
   index.html
   assets/
     index-*.js
     index-*.css
     *.js
   ```

3. **Deploy to Web Root**:
   Upload `index.html` and the `assets/` directory to the root of your web server / static bucket.

4. **Serve via HTTPS**:
   HTTPS is strongly recommended for production deployments to ensure modern browser features (such as low-latency Web Audio, fullscreen APIs, and touch pointers) operate without security restrictions.

5. **Ensure Correct MIME Types**:
   Configure the web server to serve modern Web standards MIME types:
   - `.html`: `text/html; charset=utf-8`
   - `.js`: `application/javascript; charset=utf-8`
   - `.css`: `text/css; charset=utf-8`

6. **Navigate to Root URL**:
   Open the application in a modern browser (e.g., Google Chrome or Microsoft Edge).

7. **Execute Post-Deploy Smoke Checklist** (see below).

8. **Execute Rollback if Necessary**:
   If any critical failure occurs, roll back immediately to the previous verified release artifact (`battle-city-2026-v1.0.0.zip`).

---

## Recommended Cache Policy

- **`index.html`**:  
  `Cache-Control: no-cache, no-store, must-revalidate` (or max-age=0).  
  *Rationale*: Ensures clients always fetch the latest entrypoint referencing updated hashed asset bundles.

- **`assets/*` (Hashed JavaScript and CSS)**:  
  `Cache-Control: public, max-age=31536000, immutable`  
  *Rationale*: All JavaScript and CSS assets include cryptographic content hashes in their filenames and can be cached indefinitely without cache invalidation risks.

---

## Post-Deploy Smoke Checklist

After deployment, verify the following items directly in the production environment:

- [ ] **Page Opens**: Root URL loads cleanly without blank screen or 404 assets.
- [ ] **Title Screen Active**: Displays Title, Subtitle, and "4 STAGE CAMPAIGN" badge.
- [ ] **Start Campaign**: Clicking "START CAMPAIGN" transitions into Stage 01 (Cyber Outpost).
- [ ] **Tactical Command HUD**:
  - Desktop: 340px right sidebar displays stage badge, directive, minimap radar, live lives counter, and score.
  - Mobile: Transitions to compact HUD layout.
- [ ] **Pause System**: Clicking `#tchPauseBtn` or pressing `ESC`/`P` pauses game simulation and opens Pause Menu. Resuming unpauses cleanly.
- [ ] **Tank Controls**: Tank navigates via `WASD`/Arrows with cardinal alignment and fires cannon with `Space`.
- [ ] **Terrain Interaction**: Brick blocks degrade under cannon fire; steel blocks deflect bullets.
- [ ] **Audio Lifecycle**: Audio plays on user gesture; mute toggle silences audio effects cleanly.
- [ ] **DevTools Cleanliness**: Browser console is free of uncaught errors, 404 network failures, or unhandled exceptions.
- [ ] **Security & Isolation**: `window.__GAME_INSTANCE__` is `undefined`. No `devStage` parameters trigger test modes.
- [ ] **Rollback Readiness**: `battle-city-2026-v1.0.0.zip` is backed up and immediately deployable if rollback is required.

---

## Rollback Criteria & Procedure

### Criteria for Immediate Rollback:
- Boot failure or unhandled exception during initialization.
- Black or unresponsive canvas with live HUD.
- Missing hashed assets (404 on `.js` or `.css` files).
- Input failure (keyboard or touch controls unresponsive).
- Campaign progression deadlock (enemies fail to spawn or stage clear fails to trigger).
- Severe rendering artifacts or broken shaders.

### Rollback Procedure:
1. Locate the previously verified release package: `battle-city-2026-v1.0.0.zip`.
2. Extract and overwrite the web server web root (`index.html` and `assets/`).
3. Purge edge CDN caches for `index.html`.
4. Re-run the Post-Deploy Smoke Checklist to confirm recovery.
