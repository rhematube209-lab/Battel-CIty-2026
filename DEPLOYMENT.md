# BATTLE CITY 2026 — Production Deployment Guide

**Version**: `1.0.0` [RELEASE]  
**Architecture**: Fully Static Single-Page Client (HTML5 / ES Modules / WebGL2 / Web Audio)

---

## Deployment Instructions (Provider-Neutral)

Battle City 2026 requires **no backend server, no database, no server-side rendering, and no API services**. It can be deployed to any static web hosting platform (e.g., NGINX, Apache, Cloudflare Pages, GitHub Pages, AWS S3 + CloudFront, Vercel, Netlify).

### Step-by-Step Deployment:
1. **Obtain or Build Release Artifact**:
   - Use the pre-built `battle-city-2026-v1.0.0.zip` release package, OR
   - Build cleanly from source:
     ```bash
     npm ci
     npm run build
     ```
     The deployable assets are located in the `dist/` directory.

2. **Extract Archive**:
   If using the release package `battle-city-2026-v1.0.0.zip`, extract its contents directly. The root will contain:
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
   HTTPS is strongly recommended for production deployments to ensure modern browser features (such as low-latency Web Audio and fullscreen APIs) operate without security restrictions.

5. **Ensure Correct MIME Types**:
   Configure the web server to serve modern Web standards MIME types:
   - `.html`: `text/html; charset=utf-8`
   - `.js`: `application/javascript; charset=utf-8`
   - `.css`: `text/css; charset=utf-8`

6. **Navigate to Root URL**:
   Open the application in a modern browser (e.g., Google Chrome or Microsoft Edge).

7. **Execute Post-Deploy Smoke Checklist** (see below).

8. **Execute Rollback if Necessary**:
   If any critical failure occurs, roll back immediately to the previous verified release artifact (`battle-city-2026-v0.9.0-rc.1.zip`).

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

After deployment, verify the following 13 items directly in the production environment:

- [ ] **Page Opens**: Root URL loads cleanly without blank screen or 404 assets.
- [ ] **Title Badge**: Displays `BATTLE CITY 2026` with version `v1.0.0`.
- [ ] **Canvas Visible**: Babylon WebGL canvas initializes with dark industrial arena.
- [ ] **Start Campaign**: Clicking **START CAMPAIGN** (or pressing Enter) transitions cleanly into Stage 01.
- [ ] **Move & Fire**: Player tank navigates cardinally (WASD/Arrows) and fires cannon (Spacebar).
- [ ] **Audio Unlock**: Sound effects (engine treads, cannon fire, explosions) play after first user interaction.
- [ ] **Mute Control**: Pressing **M** or toggling HUD/Settings audio mutes sound immediately.
- [ ] **Pause & Resume**: Pressing **ESC** or **P** opens Pause Menu, freezes gameplay, and stops movement audio; resuming returns cleanly to action.
- [ ] **Settings Modal**: Opening settings allows toggling Reduced Motion and Audio; closing returns to calling screen.
- [ ] **Stage Loading & Progression**: Destroying all stage enemies triggers Stage Clear and carries lives into the next stage.
- [ ] **TOTAL Score**: Campaign total score increments monotonically without transient duplicates.
- [ ] **Mobile Landscape**: On mobile/touch devices, virtual joystick and fire button function in landscape orientation; portrait mode displays rotation prompt.
- [ ] **Zero Console Errors**: Developer Tools console records 0 uncaught errors or unhandled promise rejections.

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
1. Locate the previously verified release package: `battle-city-2026-v0.9.0-rc.1.zip`.
2. Extract and overwrite the web server web root (`index.html` and `assets/`).
3. Purge edge CDN caches for `index.html`.
4. Re-run the Post-Deploy Smoke Checklist to confirm recovery.
