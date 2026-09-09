import { Direction } from '../game/Direction';
import { InputSystem } from '../systems/InputSystem';

/**
 * Normalized joystick dead-zone threshold.
 * Displacements below this fraction of the radius resolve to no movement.
 */
export const JOYSTICK_DEAD_ZONE = 0.18;

/**
 * Maximum physical displacement for the visual joystick knob in pixels.
 */
export const JOYSTICK_MAX_RADIUS = 48;

/**
 * Pure helper function to calculate the cardinal direction from screen-space delta.
 * Screen coordinates: X increases right, Y increases down.
 * World coordinates: North is +Z (up on screen), South is -Z (down on screen),
 * East is +X (right on screen), West is -X (left on screen).
 *
 * @param dx Horizontal displacement in pixels
 * @param dy Vertical displacement in pixels
 * @param maxRadius Max joystick travel in pixels
 * @param deadZone Normalized dead-zone threshold [0..1]
 * @returns Direction (NORTH, SOUTH, EAST, WEST) or null if inside dead-zone
 */
export function resolveCardinalDirection(
  dx: number,
  dy: number,
  maxRadius: number = JOYSTICK_MAX_RADIUS,
  deadZone: number = JOYSTICK_DEAD_ZONE
): Direction | null {
  const dist = Math.hypot(dx, dy);
  const normalizedDist = dist / maxRadius;

  if (normalizedDist < deadZone) {
    return null;
  }

  // Snap to strongest axis: Strictly cardinal, never diagonal
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Direction.EAST : Direction.WEST;
  } else {
    // Screen Y decreases upwards towards the top of the display (World NORTH)
    return dy < 0 ? Direction.NORTH : Direction.SOUTH;
  }
}

/**
 * MobileControls manages on-screen touch interfaces:
 * - Left Digital Arcade Joystick with clamped knob and cardinal snapping
 * - Right Large FIRE Button with continuous hold support
 * - Independent multi-touch pointer tracking (pointerdown, pointermove, pointerup, pointercancel)
 * - Orientation detection and "ROTATE YOUR DEVICE" gating
 */
export class MobileControls {
  private inputSystem: InputSystem;
  private container: HTMLElement;
  private joystickBase: HTMLElement;
  private joystickKnob: HTMLElement;
  private fireButton: HTMLElement;
  private rotateOverlay: HTMLElement;

  // Independent pointer tracking for true simultaneous multitouch
  private joystickPointerId: number | null = null;
  private firePointerId: number | null = null;

  // Cached base center for responsive joystick tracking
  private baseCenter: { x: number; y: number } = { x: 0, y: 0 };

  private onOrientationChangeHandler: () => void;
  private onBlurHandler: () => void;

  constructor(inputSystem: InputSystem) {
    this.inputSystem = inputSystem;

    // Resolve or generate DOM elements
    this.container = this.resolveElement('mobileControls', () => this.createControlsDOM());
    this.joystickBase = this.container.querySelector('#joystickBase') as HTMLElement;
    this.joystickKnob = this.container.querySelector('#joystickKnob') as HTMLElement;
    this.fireButton = this.container.querySelector('#mobileFireBtn') as HTMLElement;
    this.rotateOverlay = this.resolveElement('rotateDeviceOverlay', () => this.createRotateOverlayDOM());

    this.bindPointerEvents();

    this.onOrientationChangeHandler = () => this.handleOrientationChange();
    this.onBlurHandler = () => this.handleBlur();

    window.addEventListener('resize', this.onOrientationChangeHandler);
    window.addEventListener('orientationchange', this.onOrientationChangeHandler);
    window.addEventListener('blur', this.onBlurHandler);
    document.addEventListener('visibilitychange', this.onBlurHandler);

    // Initial orientation check
    this.handleOrientationChange();
  }

  private resolveElement(id: string, createFn: () => HTMLElement): HTMLElement {
    const existing = document.getElementById(id);
    if (existing) return existing;
    const el = createFn();
    document.body.appendChild(el);
    return el;
  }

  private createControlsDOM(): HTMLElement {
    const container = document.createElement('div');
    container.id = 'mobileControls';
    container.className = 'mobile-controls';
    container.innerHTML = `
      <div id="joystickContainer" class="joystick-container">
        <div id="joystickBase" class="joystick-base">
          <div class="joystick-marker marker-north">▲</div>
          <div class="joystick-marker marker-east">▶</div>
          <div class="joystick-marker marker-south">▼</div>
          <div class="joystick-marker marker-west">◀</div>
          <div id="joystickKnob" class="joystick-knob">
            <div class="knob-pip"></div>
          </div>
        </div>
      </div>
      <div id="fireBtnContainer" class="fire-btn-container">
        <button id="mobileFireBtn" class="mobile-fire-btn" type="button" aria-label="Fire Cannon">
          <span class="fire-btn-rim"></span>
          <span class="fire-btn-text">FIRE</span>
        </button>
      </div>
    `;
    return container;
  }

  private createRotateOverlayDOM(): HTMLElement {
    const overlay = document.createElement('div');
    overlay.id = 'rotateDeviceOverlay';
    overlay.className = 'rotate-device-overlay hidden';
    overlay.innerHTML = `
      <div class="rotate-device-content">
        <div class="rotate-icon-wrapper">
          <svg class="rotate-phone-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect>
            <path d="M12 18h.01"></path>
          </svg>
          <div class="rotate-arrow">↻</div>
        </div>
        <h2 class="rotate-title">ROTATE YOUR DEVICE</h2>
        <p class="rotate-subtitle">BATTLE CITY 2026 IS DESIGNED FOR LANDSCAPE PLAY</p>
      </div>
    `;
    return overlay;
  }

  private bindPointerEvents(): void {
    // -------------------------------------------------------------
    // Left Virtual Joystick: Pointer down, move, up, cancel
    // -------------------------------------------------------------
    this.joystickBase.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.joystickPointerId !== null) return; // Already tracking joystick

      this.joystickPointerId = e.pointerId;
      try {
        this.joystickBase.setPointerCapture(e.pointerId);
      } catch {
        // Fallback for browsers with partial pointer capture support
      }

      this.updateBaseCenter();
      this.joystickBase.classList.add('active');
      this.processJoystickMove(e.clientX, e.clientY);
    });

    this.joystickBase.addEventListener('pointermove', (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();
      this.processJoystickMove(e.clientX, e.clientY);
    });

    const releaseJoystick = (e: PointerEvent) => {
      if (e.pointerId !== this.joystickPointerId) return;
      e.preventDefault();
      this.joystickPointerId = null;
      try {
        this.joystickBase.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      this.resetJoystickVisuals();
      this.inputSystem.setTouchDirection(null);
    };

    this.joystickBase.addEventListener('pointerup', releaseJoystick);
    this.joystickBase.addEventListener('pointercancel', releaseJoystick);

    // -------------------------------------------------------------
    // Right Virtual Fire Button: Pointer down, up, cancel
    // -------------------------------------------------------------
    this.fireButton.addEventListener('pointerdown', (e: PointerEvent) => {
      e.preventDefault();
      if (this.firePointerId !== null) return;

      this.firePointerId = e.pointerId;
      try {
        this.fireButton.setPointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }

      this.fireButton.classList.add('pressed');
      this.inputSystem.setTouchFire(true);
    });

    const releaseFire = (e: PointerEvent) => {
      if (e.pointerId !== this.firePointerId) return;
      e.preventDefault();
      this.firePointerId = null;
      try {
        this.fireButton.releasePointerCapture(e.pointerId);
      } catch {
        // Safe ignore
      }
      this.fireButton.classList.remove('pressed');
      this.inputSystem.setTouchFire(false);
    };

    this.fireButton.addEventListener('pointerup', releaseFire);
    this.fireButton.addEventListener('pointercancel', releaseFire);
  }

  /**
   * Recalculates center coordinates of joystick base.
   */
  private updateBaseCenter(): void {
    const rect = this.joystickBase.getBoundingClientRect();
    this.baseCenter = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }

  /**
   * Updates joystick knob displacement and sets logical cardinal direction.
   */
  private processJoystickMove(clientX: number, clientY: number): void {
    const dx = clientX - this.baseCenter.x;
    const dy = clientY - this.baseCenter.y;
    const dist = Math.hypot(dx, dy);

    // Visual knob clamping
    let kx = dx;
    let ky = dy;
    if (dist > JOYSTICK_MAX_RADIUS && dist > 0) {
      const ratio = JOYSTICK_MAX_RADIUS / dist;
      kx = dx * ratio;
      ky = dy * ratio;
    }

    this.joystickKnob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;

    // Resolve cardinal direction with axis dominance and dead zone
    const dir = resolveCardinalDirection(dx, dy, JOYSTICK_MAX_RADIUS, JOYSTICK_DEAD_ZONE);
    this.inputSystem.setTouchDirection(dir);

    // Update marker highlights
    this.updateMarkerHighlights(dir);
  }

  private updateMarkerHighlights(activeDir: Direction | null): void {
    const markers = this.joystickBase.querySelectorAll('.joystick-marker');
    markers.forEach((m) => m.classList.remove('active'));

    if (activeDir === Direction.NORTH) {
      this.joystickBase.querySelector('.marker-north')?.classList.add('active');
    } else if (activeDir === Direction.EAST) {
      this.joystickBase.querySelector('.marker-east')?.classList.add('active');
    } else if (activeDir === Direction.SOUTH) {
      this.joystickBase.querySelector('.marker-south')?.classList.add('active');
    } else if (activeDir === Direction.WEST) {
      this.joystickBase.querySelector('.marker-west')?.classList.add('active');
    }
  }

  private resetJoystickVisuals(): void {
    this.joystickKnob.style.transform = 'translate3d(0, 0, 0)';
    this.joystickBase.classList.remove('active');
    this.updateMarkerHighlights(null);
  }

  /**
   * Inspects viewport aspect ratio. Displays rotation modal and gates gameplay if portrait.
   */
  private handleOrientationChange(): void {
    const isPortrait = window.innerHeight > window.innerWidth;

    if (isPortrait) {
      this.rotateOverlay.classList.remove('hidden');
      this.rotateOverlay.classList.add('visible');
      // Gate all gameplay input while rotated to prevent runaway tanks
      this.clearAllPointers();
      this.inputSystem.clearInput();
    } else {
      this.rotateOverlay.classList.remove('visible');
      this.rotateOverlay.classList.add('hidden');
      this.clearAllPointers();
      this.inputSystem.clearInput();
      this.updateBaseCenter();
    }
  }

  /**
   * Releases all active touches on window blur or visibility loss.
   */
  private handleBlur(): void {
    this.clearAllPointers();
    this.inputSystem.clearInput();
  }

  public clearAllPointers(): void {
    this.joystickPointerId = null;
    this.firePointerId = null;
    this.resetJoystickVisuals();
    this.fireButton.classList.remove('pressed');
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'block' : 'none';
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onOrientationChangeHandler);
    window.removeEventListener('orientationchange', this.onOrientationChangeHandler);
    window.removeEventListener('blur', this.onBlurHandler);
    document.removeEventListener('visibilitychange', this.onBlurHandler);
    this.clearAllPointers();
  }
}
