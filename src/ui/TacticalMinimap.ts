import { TileType, GRID_ROWS, GRID_COLS } from '../game/constants';
import { Vector3 } from '@babylonjs/core';

export interface MinimapEntityProvider {
  getPlayerPosition: () => Vector3 | null;
  getEnemyPositions: () => Vector3[];
  isBaseDestroyed: () => boolean;
}

/**
 * Tactical 13x13 Canvas Minimap for Battle City 2026 Desktop Command Console.
 * Visualizes stage topology and active tactical entities with throttled rendering (8-12 Hz)
 * to maintain zero GPU/CPU performance overhead.
 */
export class TacticalMinimap {
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null = null;
  private staticCanvas: HTMLCanvasElement;
  private staticCtx: CanvasRenderingContext2D | null;

  private logicalSize: number = 195; // 13 cells * 15px (Phase 23 Visual Refinement: calibrated display)
  private cellSize: number = 15;
  private dpr: number = 1;

  private entityProvider?: MinimapEntityProvider;
  private lastRenderTime: number = 0;
  private readonly updateIntervalMs: number = 100; // ~10 Hz throttled update rate (Req 20, 82)
  private isPaused: boolean = false;
  private hasStaticLayer: boolean = false;

  constructor(canvasOrId: HTMLCanvasElement | string = 'tacticalMinimap') {
    if (typeof canvasOrId === 'string') {
      this.canvas = document.getElementById(canvasOrId) as HTMLCanvasElement | null;
    } else {
      this.canvas = canvasOrId;
    }

    this.staticCanvas = document.createElement('canvas');
    this.staticCtx = this.staticCanvas.getContext('2d');

    if (this.canvas) {
      this.ctx = this.canvas.getContext('2d');
      this.canvas.setAttribute('aria-label', 'Tactical minimap');
      this.canvas.setAttribute('role', 'img');
      this.setupResolution();
    }
  }

  private setupResolution(): void {
    if (!this.canvas || !this.ctx) return;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

    this.canvas.width = Math.round(this.logicalSize * this.dpr);
    this.canvas.height = Math.round(this.logicalSize * this.dpr);
    this.canvas.style.width = `${this.logicalSize}px`;
    this.canvas.style.height = `${this.logicalSize}px`;

    this.staticCanvas.width = this.canvas.width;
    this.staticCanvas.height = this.canvas.height;

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.staticCtx?.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  public setEntityProvider(provider: MinimapEntityProvider): void {
    this.entityProvider = provider;
  }

  /**
   * Rebuilds static 13x13 stage terrain layer on stage load / stage transition.
   * Uses authoritative LevelDefinition TileType matrix.
   */
  public setStageTopology(tiles: readonly (readonly TileType[])[] | TileType[][]): void {
    if (!this.staticCtx) return;

    this.staticCtx.fillStyle = '#06090e'; // Subdued deep foundation
    this.staticCtx.fillRect(0, 0, this.logicalSize, this.logicalSize);

    // Subtle 13x13 grid lines
    this.staticCtx.strokeStyle = 'rgba(0, 229, 255, 0.06)';
    this.staticCtx.lineWidth = 0.5;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const t = tiles[r]?.[c] ?? TileType.EMPTY;
        const x = c * this.cellSize;
        const y = r * this.cellSize;

        this.staticCtx.fillStyle = this.getTerrainColor(t);
        this.staticCtx.fillRect(x + 0.5, y + 0.5, this.cellSize - 1, this.cellSize - 1);
      }
    }

    // Outer grid border
    this.staticCtx.strokeStyle = 'rgba(0, 229, 255, 0.3)';
    this.staticCtx.lineWidth = 1;
    this.staticCtx.strokeRect(0.5, 0.5, this.logicalSize - 1, this.logicalSize - 1);

    this.hasStaticLayer = true;
    this.renderNow();
  }

  /**
   * Subdued palette for static terrain to ensure dynamic combat blips remain dominant.
   */
  private getTerrainColor(type: TileType): string {
    switch (type) {
      case TileType.BRICK:
        return '#854d0e'; // Subdued Tactical Brick
      case TileType.STEEL:
        return '#475569'; // Subdued Armor Slate
      case TileType.WATER:
        return '#1e3a8a'; // Subdued Coolant Trench
      case TileType.BUSH:
        return '#14532d'; // Subdued Camouflage Screen
      case TileType.CRYO:
        return '#0369a1'; // Subdued Cryo Cooling Plate
      case TileType.CONVEYOR:
        return '#92400e'; // Subdued Mag-drive Conveyor
      case TileType.BASE:
        return '#00e5ff'; // Command Node core
      case TileType.PLAYER_SPAWN:
        return '#0c4a6e';
      case TileType.ENEMY_SPAWN:
        return '#450a0a';
      case TileType.EMPTY:
      default:
        return '#080b12';
    }
  }

  /**
   * Throttled entity render tick (called from game loop at ~60fps, executes at 10 Hz).
   */
  public tick(now: number = performance.now()): void {
    if (this.isPaused || !this.hasStaticLayer) return;
    if (now - this.lastRenderTime < this.updateIntervalMs) {
      return;
    }
    this.lastRenderTime = now;
    this.renderNow();
  }

  /**
   * Immediately draws static terrain cache and current dynamic entity markers.
   */
  public renderNow(): void {
    if (!this.ctx || !this.hasStaticLayer) return;

    // 1. Blit pre-rendered static terrain
    this.ctx.drawImage(
      this.staticCanvas,
      0,
      0,
      this.canvas!.width,
      this.canvas!.height,
      0,
      0,
      this.logicalSize,
      this.logicalSize
    );

    if (!this.entityProvider) return;

    // 2. Render Command Node glyph
    const baseLost = this.entityProvider.isBaseDestroyed();
    const baseCellX = 6 * this.cellSize + this.cellSize / 2;
    const baseCellY = 12 * this.cellSize + this.cellSize / 2;

    this.ctx.save();
    if (baseLost) {
      this.ctx.fillStyle = '#ef4444'; // Red Lost Core
      this.ctx.strokeStyle = '#7f1d1d';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(baseCellX, baseCellY, 5.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    } else {
      this.ctx.fillStyle = '#00e5ff'; // Cyan Secure Core
      this.ctx.shadowColor = '#00e5ff';
      this.ctx.shadowBlur = 8;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      // Enhanced geometric command node glyph
      this.ctx.moveTo(baseCellX, baseCellY - 6.5);
      this.ctx.lineTo(baseCellX + 6.5, baseCellY);
      this.ctx.lineTo(baseCellX, baseCellY + 6.5);
      this.ctx.lineTo(baseCellX - 6.5, baseCellY);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();

    // 3. Render Active Enemies (Vibrant Amber/Red high-contrast markers)
    const enemies = this.entityProvider.getEnemyPositions();
    this.ctx.save();
    this.ctx.fillStyle = '#f97316';
    this.ctx.shadowColor = '#ea580c';
    this.ctx.shadowBlur = 6;
    this.ctx.strokeStyle = '#ffedd5';
    this.ctx.lineWidth = 1.5;

    for (const pos of enemies) {
      const { x, y } = this.worldToMinimap(pos.x, pos.z);
      this.ctx.beginPath();
      this.ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
    }
    this.ctx.restore();

    // 4. Render Player (Bright Cyan marker with high contrast white outline)
    const playerPos = this.entityProvider.getPlayerPosition();
    if (playerPos) {
      const { x, y } = this.worldToMinimap(playerPos.x, playerPos.z);
      this.ctx.save();
      this.ctx.fillStyle = '#00e5ff';
      this.ctx.shadowColor = '#00e5ff';
      this.ctx.shadowBlur = 10;
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = 2;

      this.ctx.beginPath();
      this.ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  /**
   * Converts 3D Babylon world coordinates (x: -12..+12, z: -12..+12)
   * to 2D Minimap canvas pixel coordinates.
   */
  private worldToMinimap(worldX: number, worldZ: number): { x: number; y: number } {
    // Arena spans 26 units (-13 to +13)
    const halfWidth = 13;
    const normX = (worldX + halfWidth) / 26;
    const normZ = (halfWidth - worldZ) / 26; // Z is inverted (North is +Z, South is -Z)

    return {
      x: Math.max(2, Math.min(this.logicalSize - 2, normX * this.logicalSize)),
      y: Math.max(2, Math.min(this.logicalSize - 2, normZ * this.logicalSize)),
    };
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
  }

  public getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  public dispose(): void {
    this.canvas = null;
    this.ctx = null;
    this.staticCtx = null;
    this.entityProvider = undefined;
  }
}
