import { Direction } from '../game/Direction';

/**
 * Handles keyboard and touch input for arcade tank navigation.
 * Implements "Most Recently Pressed Direction Wins" policy across both input methods.
 * Serves as the single unified source of truth for gameplay actions.
 */
export class InputSystem {
  // Stack of currently held keyboard directions (top of stack is active)
  private heldDirections: Direction[] = [];

  // Track physical keys held to manage direction lifecycle accurately
  private activeKeys = new Set<string>();

  // Logical keyboard fire state
  private isFireHeld: boolean = false;

  // Touch virtual joystick direction and fire state
  private touchDirection: Direction | null = null;
  private isTouchFire: boolean = false;

  // Arbitration: Most recently activated input source takes priority
  private lastDirectionSource: 'KEYBOARD' | 'TOUCH' = 'KEYBOARD';

  // Restart callback (Phase 6)
  private onRestartCallback?: () => void;

  private onKeyDownHandler: (e: KeyboardEvent) => void;
  private onKeyUpHandler: (e: KeyboardEvent) => void;
  private onBlurHandler: () => void;
  private onVisibilityChangeHandler: () => void;

  constructor() {
    this.onKeyDownHandler = (e: KeyboardEvent) => this.handleKeyDown(e);
    this.onKeyUpHandler = (e: KeyboardEvent) => this.handleKeyUp(e);
    this.onBlurHandler = () => this.clearInput();
    this.onVisibilityChangeHandler = () => {
      if (document.hidden) this.clearInput();
    };

    window.addEventListener('keydown', this.onKeyDownHandler);
    window.addEventListener('keyup', this.onKeyUpHandler);
    window.addEventListener('blur', this.onBlurHandler);
    document.addEventListener('visibilitychange', this.onVisibilityChangeHandler);
  }

  /**
   * Sets the active directional input from virtual touch controls.
   * Passing null indicates touch release / dead-zone.
   */
  public setTouchDirection(direction: Direction | null): void {
    this.touchDirection = direction;
    if (direction !== null) {
      this.lastDirectionSource = 'TOUCH';
    }
  }

  /**
   * Sets the active fire state from virtual touch controls.
   */
  public setTouchFire(active: boolean): void {
    this.isTouchFire = active;
  }

  /**
   * Returns currently active movement direction, or null if stopped.
   * Priority: most recently activated input source wins.
   * Releasing touch immediately returns control to any held keyboard key.
   */
  public getMovementDirection(): Direction | null {
    if (this.lastDirectionSource === 'TOUCH' && this.touchDirection !== null) {
      return this.touchDirection;
    }
    if (this.heldDirections.length > 0) {
      return this.heldDirections[this.heldDirections.length - 1];
    }
    return this.touchDirection;
  }

  /**
   * Returns true if fire action is currently held/requested via keyboard Space or touch FIRE.
   */
  public isFireActive(): boolean {
    return this.isFireHeld || this.isTouchFire;
  }

  /**
   * Returns current active input source for telemetry/debugging.
   */
  public getLastInputSource(): 'KEYBOARD' | 'TOUCH' {
    return this.lastDirectionSource;
  }

  /**
   * Returns raw touch direction for telemetry/debugging.
   */
  public getTouchDirection(): Direction | null {
    return this.touchDirection;
  }

  /**
   * Returns raw touch fire state for telemetry/debugging.
   */
  public isTouchFireActive(): boolean {
    return this.isTouchFire;
  }

  /**
   * Maps a keyboard event code or key to a cardinal Direction.
   */
  private keyToDirection(code: string, key: string): Direction | null {
    switch (code) {
      case 'KeyW':
      case 'ArrowUp':
        return Direction.NORTH;
      case 'KeyS':
      case 'ArrowDown':
        return Direction.SOUTH;
      case 'KeyA':
      case 'ArrowLeft':
        return Direction.WEST;
      case 'KeyD':
      case 'ArrowRight':
        return Direction.EAST;
    }

    // Fallback on key character for international keyboards
    const k = key.toLowerCase();
    if (k === 'w') return Direction.NORTH;
    if (k === 's') return Direction.SOUTH;
    if (k === 'a') return Direction.WEST;
    if (k === 'd') return Direction.EAST;

    return null;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Do not capture keys if user is typing inside an input or textarea
    if (
      e.target instanceof HTMLElement &&
      (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)
    ) {
      return;
    }

    // Prevent arrow keys and space from scrolling the viewport
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }

    if (e.code === 'Space') {
      this.isFireHeld = true;
    }

    if (e.code === 'KeyR') {
      this.onRestartCallback?.();
    }

    if (e.repeat) return; // Ignore automatic OS key-repeat events for directional stack

    const dir = this.keyToDirection(e.code, e.key);
    if (dir === null) return;

    this.activeKeys.add(e.code);
    this.lastDirectionSource = 'KEYBOARD';

    // Push to top of direction stack: Most recently pressed direction wins
    this.heldDirections = this.heldDirections.filter((d) => d !== dir);
    this.heldDirections.push(dir);
  }

  private handleKeyUp(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      this.isFireHeld = false;
    }

    const dir = this.keyToDirection(e.code, e.key);
    this.activeKeys.delete(e.code);

    if (dir === null) return;

    // Remove direction only if no other key mapped to this direction is still held
    const isOtherKeyHeldForDir = Array.from(this.activeKeys).some(
      (k) => this.keyToDirection(k, k) === dir
    );

    if (!isOtherKeyHeldForDir) {
      this.heldDirections = this.heldDirections.filter((d) => d !== dir);
    }
  }

  /**
   * Registers a callback invoked when restart is requested.
   */
  public setRestartCallback(cb: () => void): void {
    this.onRestartCallback = cb;
  }

  /**
   * Alias for setRestartCallback to match UI naming conventions.
   */
  public setOnRestart(cb: () => void): void {
    this.setRestartCallback(cb);
  }

  /**
   * Programmatically triggers a stage restart.
   */
  public triggerRestart(): void {
    this.onRestartCallback?.();
  }

  /**
   * Resets all held input immediately (on window blur / tab switch / restart / orientation change).
   */
  public clearInput(): void {
    this.heldDirections = [];
    this.activeKeys.clear();
    this.isFireHeld = false;
    this.touchDirection = null;
    this.isTouchFire = false;
    this.lastDirectionSource = 'KEYBOARD';
  }

  /**
   * Alias for clearInput() to meet lifecycle reset expectations.
   */
  public reset(): void {
    this.clearInput();
  }

  /**
   * Cleans up all event listeners.
   */
  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownHandler);
    window.removeEventListener('keyup', this.onKeyUpHandler);
    window.removeEventListener('blur', this.onBlurHandler);
    document.removeEventListener('visibilitychange', this.onVisibilityChangeHandler);
    this.clearInput();
  }
}

