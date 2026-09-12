import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  ShadowGenerator
} from '@babylonjs/core';
import {
  GRID_ROWS,
  GRID_COLS,
  TILE_SIZE,
  TileType,
  GridPosition,
  VISUAL_HEIGHTS,
  DEBUG
} from '../game/constants';
import { Direction } from '../game/Direction';
import { Tile, BrickQuadrant, SolidAABB } from './Tile';
import { Base } from './Base';
import { LevelDefinition, validateLevelDefinition } from '../levels/LevelDefinition';
import { StagePresentationConfig } from '../stages/StageDefinition';
import { EnvironmentAssetLibrary } from '../visual/EnvironmentAssetLibrary';

export interface BrickDamageResult {
  destroyed: boolean;
  quadrant: BrickQuadrant | null;
  tileFullyDestroyed: boolean;
}

export class TileMap {
  private scene: Scene;
  private tiles: (Tile | null)[][] = [];
  private initialLevelData: TileType[][];
  private levelDefinition: LevelDefinition | null = null;
  private baseEntity?: Base;

  // Master templates for hardware instancing
  private masterBrickQuadrant?: Mesh;
  private masterSteel?: Mesh;
  private masterBush?: Mesh;
  private masterCryo?: Mesh;
  private masterConveyor?: Mesh;

  // Shared materials
  private sharedMaterials: StandardMaterial[] = [];
  private playerSpawnMat?: StandardMaterial;
  private enemySpawnMat?: StandardMaterial;

  // Spawn and Base caching
  private playerSpawnPos: Vector3 | null = null;
  private enemySpawnPositions: Vector3[] = [];
  private basePos: Vector3 | null = null;

  // Debug visual meshes
  private debugMeshes: Mesh[] = [];

  // Cached shadow generator for stage transitions
  private cachedShadowGenerator?: ShadowGenerator;

  /**
   * Constructs the TileMap.
   * Runtime gameplay strictly requires a typed LevelDefinition.
   * The TileType[][] union overload is retained solely for backward compatibility with legacy test suites.
   */
  constructor(
    scene: Scene,
    levelInput: LevelDefinition | TileType[][],
    presentation?: StagePresentationConfig
  ) {
    this.scene = scene;

    let levelData: TileType[][];
    if ('tiles' in levelInput) {
      validateLevelDefinition(levelInput);
      this.levelDefinition = levelInput;
      levelData = levelInput.tiles.map((row) => [...row]);
    } else {
      this.validateLevel(levelInput);
      levelData = levelInput.map((row) => [...row]);
    }

    this.initialLevelData = levelData.map((row) => [...row]);
    this.initMasterMeshes();
    this.buildMap(levelData);

    if (this.baseEntity && presentation) {
      this.baseEntity.setPresentation(presentation);
    }

    if (DEBUG) {
      this.buildDebugGrid();
    }
  }

  /**
   * Validates level matrix dimensions, spawn requirements, and tile integrity.
   */
  private validateLevel(data: TileType[][]): void {
    if (!data || data.length !== GRID_ROWS) {
      throw new Error(`Level validation error: Expected ${GRID_ROWS} rows, got ${data?.length}`);
    }

    let playerCount = 0;
    let baseCount = 0;
    let enemyCount = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      const row = data[r];
      if (!row || row.length !== GRID_COLS) {
        throw new Error(`Level validation error: Row ${r} must have exactly ${GRID_COLS} columns, got ${row?.length}`);
      }

      for (let c = 0; c < GRID_COLS; c++) {
        const val = row[c];
        if (val < TileType.EMPTY || val > TileType.CONVEYOR) {
          throw new Error(`Level validation error at [${r}, ${c}]: Unknown TileType ${val}`);
        }

        if (val === TileType.PLAYER_SPAWN) playerCount++;
        if (val === TileType.BASE) baseCount++;
        if (val === TileType.ENEMY_SPAWN) enemyCount++;
      }
    }

    if (playerCount !== 1) {
      throw new Error(`Level validation error: Expected exactly 1 PLAYER_SPAWN, found ${playerCount}`);
    }
    if (baseCount !== 1) {
      throw new Error(`Level validation error: Expected exactly 1 BASE, found ${baseCount}`);
    }
    if (enemyCount < 1) {
      throw new Error(`Level validation error: Expected at least 1 ENEMY_SPAWN, found ${enemyCount}`);
    }
  }

  /**
   * Converts grid (row, column) coordinates into 3D world space (Vector3).
   * Row 0 = North (+Z), Row 12 = South (-Z).
   * Col 0 = West (-X), Col 12 = East (+X).
   */
  public gridToWorld(row: number, column: number): Vector3 {
    const x = (column - (GRID_COLS - 1) / 2) * TILE_SIZE;
    const z = ((GRID_ROWS - 1) / 2 - row) * TILE_SIZE;
    return new Vector3(x, 0, z);
  }

  /**
   * Converts 3D world space coordinates back into grid (row, column).
   * Safely returns null if the coordinate is outside the 13x13 grid boundaries.
   */
  public worldToGrid(x: number, z: number): GridPosition | null {
    if (isNaN(x) || isNaN(z)) return null;

    const col = Math.round(x / TILE_SIZE + (GRID_COLS - 1) / 2);
    const row = Math.round((GRID_ROWS - 1) / 2 - z / TILE_SIZE);

    if (this.isInsideGrid(row, col)) {
      return { row, column: col };
    }
    return null;
  }

  /**
   * Checks if a row and column are within the playable 13x13 grid.
   */
  public isInsideGrid(row: number, column: number): boolean {
    return row >= 0 && row < GRID_ROWS && column >= 0 && column < GRID_COLS;
  }

  /**
   * Returns the Tile instance at the given cell, or null if empty or out of bounds.
   */
  public getTile(row: number, column: number): Tile | null {
    if (!this.isInsideGrid(row, column)) return null;
    return this.tiles[row]?.[column] || null;
  }

  /**
   * Returns the TileType at the given cell, or null if out of bounds.
   */
  public getTileType(row: number, column: number): TileType | null {
    const tile = this.getTile(row, column);
    return tile ? tile.type : (this.isInsideGrid(row, column) ? TileType.EMPTY : null);
  }

  /**
   * Returns surface info (TileType and optional Conveyor Direction) at world coordinates.
   * Deterministically applies the Center-Cell Rule via worldToGrid.
   */
  public getSurfaceInfoAtWorldPosition(pos: { x: number; z: number }): {
    tileType: TileType | null;
    conveyorDirection: Direction | null;
  } {
    const grid = this.worldToGrid(pos.x, pos.z);
    if (!grid) return { tileType: null, conveyorDirection: null };
    const tile = this.getTile(grid.row, grid.column);
    if (!tile) {
      return {
        tileType: this.isInsideGrid(grid.row, grid.column) ? TileType.EMPTY : null,
        conveyorDirection: null,
      };
    }
    return {
      tileType: tile.type,
      conveyorDirection: tile.conveyorDirection ?? null,
    };
  }

  /**
   * Evaluates terrain type directly from 3D world coordinates.
   * Deterministically applies the Center-Cell Rule via worldToGrid.
   */
  public getTileTypeAtWorldPosition(pos: { x: number; z: number }): TileType | null {
    const grid = this.worldToGrid(pos.x, pos.z);
    if (!grid) return null;
    return this.getTileType(grid.row, grid.column);
  }

  /**
   * Evaluates if a tile physically blocks tanks.
   */
  public isSolid(row: number, column: number): boolean {
    const tile = this.getTile(row, column);
    if (!tile) return false;
    return tile.isSolid();
  }

  /**
   * Returns solid collision AABBs for the specified cell.
   * For non-brick solid tiles (STEEL, BASE, WATER for tanks): returns full 2x2 tile AABB.
   * For BRICK: returns 1x1 AABBs for each currently active quadrant. Fully destroyed bricks return [].
   * For passable tiles (EMPTY, BUSH, SPAWN, WATER for projectiles): returns [].
   */
  public getSolidBoxesForCell(row: number, column: number, forTank: boolean = true): SolidAABB[] {
    const tile = this.getTile(row, column);
    if (!tile) return [];

    if (tile.type === TileType.BRICK) {
      return tile.getActiveQuadrantAABBs().map((q) => q.bounds);
    }

    if (
      tile.type === TileType.STEEL ||
      tile.type === TileType.BASE ||
      (forTank && tile.type === TileType.WATER)
    ) {
      const tileMinX = 2 * column - 13;
      const tileMaxX = 2 * column - 11;
      const tileMinZ = 11 - 2 * row;
      const tileMaxZ = 13 - 2 * row;
      return [{ minX: tileMinX, maxX: tileMaxX, minZ: tileMinZ, maxZ: tileMaxZ }];
    }

    return [];
  }

  /**
   * Deterministically maps a projectile hit contact point and direction to the struck quadrant.
   * Follows Phase 5 Section 6 and Section 7 specifications.
   */
  public mapHitToQuadrant(
    row: number,
    column: number,
    hitPoint: { x: number; z: number },
    incomingDirection: Direction
  ): BrickQuadrant | null {
    const tile = this.getTile(row, column);
    if (!tile || tile.type !== TileType.BRICK) return null;

    const cx = tile.worldPosition.x;
    const cz = tile.worldPosition.z;

    if (incomingDirection === Direction.NORTH) {
      if (hitPoint.z < cz) {
        const southCandidate: BrickQuadrant = hitPoint.x < cx ? 'bl' : 'br';
        if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
        const northCandidate: BrickQuadrant = hitPoint.x < cx ? 'tl' : 'tr';
        if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
      } else {
        const northCandidate: BrickQuadrant = hitPoint.x < cx ? 'tl' : 'tr';
        if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
      }
    } else if (incomingDirection === Direction.SOUTH) {
      if (hitPoint.z >= cz) {
        const northCandidate: BrickQuadrant = hitPoint.x < cx ? 'tl' : 'tr';
        if (tile.isBrickQuadrantActive(northCandidate)) return northCandidate;
        const southCandidate: BrickQuadrant = hitPoint.x < cx ? 'bl' : 'br';
        if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
      } else {
        const southCandidate: BrickQuadrant = hitPoint.x < cx ? 'bl' : 'br';
        if (tile.isBrickQuadrantActive(southCandidate)) return southCandidate;
      }
    } else if (incomingDirection === Direction.EAST) {
      if (hitPoint.x < cx) {
        const westCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tl' : 'bl';
        if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
        const eastCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tr' : 'br';
        if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
      } else {
        const eastCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tr' : 'br';
        if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
      }
    } else if (incomingDirection === Direction.WEST) {
      if (hitPoint.x >= cx) {
        const eastCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tr' : 'br';
        if (tile.isBrickQuadrantActive(eastCandidate)) return eastCandidate;
        const westCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tl' : 'bl';
        if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
      } else {
        const westCandidate: BrickQuadrant = hitPoint.z >= cz ? 'tl' : 'bl';
        if (tile.isBrickQuadrantActive(westCandidate)) return westCandidate;
      }
    }

    return null;
  }

  /**
   * Applies damage to the appropriate brick quadrant struck by a projectile.
   * Returns damage result with destroyed flag and whether tile is fully open.
   */
  public damageBrick(
    row: number,
    column: number,
    hitPoint: { x: number; z: number },
    incomingDirection: Direction
  ): BrickDamageResult {
    const tile = this.getTile(row, column);
    if (!tile || tile.type !== TileType.BRICK) {
      return { destroyed: false, quadrant: null, tileFullyDestroyed: false };
    }

    const quadrant = this.mapHitToQuadrant(row, column, hitPoint, incomingDirection);
    if (!quadrant) {
      return {
        destroyed: false,
        quadrant: null,
        tileFullyDestroyed: tile.isBrickFullyDestroyed()
      };
    }

    const destroyed = tile.destroyBrickQuadrant(quadrant);
    return {
      destroyed,
      quadrant,
      tileFullyDestroyed: tile.isBrickFullyDestroyed()
    };
  }

  /**
   * Programmatically damages a specific quadrant (useful for tests and scripts).
   */
  public damageBrickQuadrant(
    row: number,
    column: number,
    quadrant: BrickQuadrant
  ): BrickDamageResult {
    const tile = this.getTile(row, column);
    if (!tile || tile.type !== TileType.BRICK) {
      return { destroyed: false, quadrant: null, tileFullyDestroyed: false };
    }

    const destroyed = tile.destroyBrickQuadrant(quadrant);
    return {
      destroyed,
      quadrant,
      tileFullyDestroyed: tile.isBrickFullyDestroyed()
    };
  }

  /**
   * Restores all brick quadrants across the entire map to their intact state.
   * Re-enables all hidden visual meshes. Derived from the original level definition.
   */
  public resetDestruction(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (this.initialLevelData[r][c] === TileType.BRICK) {
          const tile = this.getTile(r, c);
          if (tile) {
            tile.resetBrickQuadrants();
          }
        }
      }
    }
    this.baseEntity?.reset();
  }

  /**
   * Provides access to the Base entity.
   */
  public getBase(): Base {
    if (!this.baseEntity) {
      throw new Error('Fatal: Command Base entity not found');
    }
    return this.baseEntity;
  }

  /**
   * Returns a copy of the original immutable level definition.
   */
  public getInitialLevelData(): TileType[][] {
    return this.initialLevelData.map((row) => [...row]);
  }

  public getLevelDefinition(): LevelDefinition | null {
    return this.levelDefinition;
  }

  public getPlayerSpawn(): Vector3 | null {
    return this.playerSpawnPos ? this.playerSpawnPos.clone() : null;
  }

  public getEnemySpawns(): Vector3[] {
    return this.enemySpawnPositions.map((pos) => pos.clone());
  }

  public getBasePosition(): Vector3 | null {
    return this.basePos ? this.basePos.clone() : null;
  }

  public getMasterSteel(): Mesh | undefined {
    return this.masterSteel;
  }

  public getMasterBrickQuadrant(): Mesh | undefined {
    return this.masterBrickQuadrant;
  }

  /**
   * Registers all solid wall instances (brick quadrants and steel blocks) as shadow casters.
   */
  public registerShadowCasters(shadowGenerator: ShadowGenerator): void {
    this.cachedShadowGenerator = shadowGenerator;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r]?.[c];
        if (!tile) continue;

        if (tile.type === TileType.BRICK && tile.quadrantMeshes) {
          if (tile.quadrantMeshes.tl) shadowGenerator.addShadowCaster(tile.quadrantMeshes.tl);
          if (tile.quadrantMeshes.tr) shadowGenerator.addShadowCaster(tile.quadrantMeshes.tr);
          if (tile.quadrantMeshes.bl) shadowGenerator.addShadowCaster(tile.quadrantMeshes.bl);
          if (tile.quadrantMeshes.br) shadowGenerator.addShadowCaster(tile.quadrantMeshes.br);
        } else if (tile.type === TileType.STEEL && tile.mesh) {
          shadowGenerator.addShadowCaster(tile.mesh);
        }
      }
    }
  }

  /**
   * Seamlessly reconfigures the TileMap for a new stage without recreating master meshes or materials.
   * Disposes previous stage-owned instances and base entity, then constructs new level geometry.
   */
  public loadLevel(levelInput: LevelDefinition, presentation?: StagePresentationConfig): void {
    validateLevelDefinition(levelInput);
    this.levelDefinition = levelInput;
    const levelData = levelInput.tiles.map((row) => [...row]);
    this.initialLevelData = levelData.map((row) => [...row]);

    // 1. Dispose all previous stage tile instances and meshes
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r]?.[c];
        if (tile) tile.dispose();
      }
    }
    this.tiles = [];

    // 2. Dispose previous stage Base entity
    if (this.baseEntity) {
      this.baseEntity.dispose();
      this.baseEntity = undefined;
    }

    // 3. Reset spawn and base position caches
    this.playerSpawnPos = null;
    this.enemySpawnPositions = [];
    this.basePos = null;

    // 4. Rebuild tiles and Base for the new level
    this.buildMap(levelData);

    // 5. Apply stage presentation if base entity was created
    const base = this.baseEntity as Base | undefined;
    if (base && presentation) {
      base.setPresentation(presentation);
    }

    // 6. Re-register shadow casters for the newly created stage instances
    if (this.cachedShadowGenerator) {
      this.registerShadowCasters(this.cachedShadowGenerator);
    }
  }

  /**
   * Prepares shared materials and master geometry templates for hardware instancing.
   */
  private initMasterMeshes(): void {
    // 1. Obtain shared master templates from EnvironmentAssetLibrary (Phase 25)
    const envLib = EnvironmentAssetLibrary.getInstance(this.scene);
    this.masterBrickQuadrant = envLib.getMasterBrickQuadrant();
    this.masterSteel = envLib.getMasterSteel();
    this.masterBush = envLib.getMasterBush();

    // 4. Player Spawn Marker Material
    this.playerSpawnMat = new StandardMaterial('playerSpawnMat', this.scene);
    this.playerSpawnMat.diffuseColor = new Color3(0.0, 0.8, 1.0);
    this.playerSpawnMat.emissiveColor = new Color3(0.0, 0.35, 0.5);
    this.sharedMaterials.push(this.playerSpawnMat);

    // 5. Enemy Spawn Marker Material
    this.enemySpawnMat = new StandardMaterial('enemySpawnMat', this.scene);
    this.enemySpawnMat.diffuseColor = new Color3(1.0, 0.45, 0.0);
    this.enemySpawnMat.emissiveColor = new Color3(0.5, 0.2, 0.0);
    this.sharedMaterials.push(this.enemySpawnMat);

    // 6. Cryo Floor Material (Dark graphite cooling plate + cold crystalline sheen + cyan coolant channels)
    const cryoMat = new StandardMaterial('cryoMat', this.scene);
    cryoMat.diffuseColor = new Color3(0.12, 0.20, 0.28);
    cryoMat.specularColor = new Color3(0.55, 0.85, 1.0); // Cold crystalline sheen
    cryoMat.specularPower = 64;
    cryoMat.emissiveColor = new Color3(0.06, 0.16, 0.26); // Distinct frost blue-white edge
    this.sharedMaterials.push(cryoMat);

    const plateBase = MeshBuilder.CreateBox(
      'cryoBase',
      {
        width: TILE_SIZE * 0.96,
        depth: TILE_SIZE * 0.96,
        height: VISUAL_HEIGHTS.CRYO
      },
      this.scene
    );
    const channel1 = MeshBuilder.CreateBox(
      'cryoChannel1',
      {
        width: TILE_SIZE * 0.88,
        depth: 0.16,
        height: VISUAL_HEIGHTS.CRYO + 0.01
      },
      this.scene
    );
    channel1.position.y = 0.005;
    const channel2 = MeshBuilder.CreateBox(
      'cryoChannel2',
      {
        width: 0.16,
        depth: TILE_SIZE * 0.88,
        height: VISUAL_HEIGHTS.CRYO + 0.01
      },
      this.scene
    );
    channel2.position.y = 0.005;

    // Crystalline cooling plate outer frost rim
    const cryoRimN = MeshBuilder.CreateBox('cryoRimN', { width: TILE_SIZE * 0.94, depth: 0.06, height: VISUAL_HEIGHTS.CRYO + 0.008 }, this.scene);
    cryoRimN.position.set(0, 0.004, (TILE_SIZE * 0.94) / 2);
    const cryoRimS = MeshBuilder.CreateBox('cryoRimS', { width: TILE_SIZE * 0.94, depth: 0.06, height: VISUAL_HEIGHTS.CRYO + 0.008 }, this.scene);
    cryoRimS.position.set(0, 0.004, -(TILE_SIZE * 0.94) / 2);

    this.masterCryo = Mesh.MergeMeshes(
      [plateBase, channel1, channel2, cryoRimN, cryoRimS],
      true,
      true,
      undefined,
      false,
      true
    ) as Mesh;
    this.masterCryo.name = 'masterCryo';
    this.masterCryo.material = cryoMat;
    this.masterCryo.setEnabled(false);

    // 7. Mag-Drive Conveyor Material & Master Mesh (Dark industrial track bed + magnetic rail + high-contrast amber chevrons)
    const conveyorMat = new StandardMaterial('conveyorMat', this.scene);
    conveyorMat.diffuseColor = new Color3(0.16, 0.18, 0.20);
    conveyorMat.specularColor = new Color3(0.85, 0.65, 0.25);
    conveyorMat.specularPower = 48;
    conveyorMat.emissiveColor = new Color3(0.24, 0.14, 0.02); // High-contrast amber glow
    this.sharedMaterials.push(conveyorMat);

    const convBase = MeshBuilder.CreateBox(
      'convBase',
      {
        width: TILE_SIZE * 0.96,
        depth: TILE_SIZE * 0.96,
        height: VISUAL_HEIGHTS.CONVEYOR
      },
      this.scene
    );
    const convRail = MeshBuilder.CreateBox(
      'convRail',
      {
        width: 0.24,
        depth: TILE_SIZE * 0.92,
        height: VISUAL_HEIGHTS.CONVEYOR + 0.01
      },
      this.scene
    );
    convRail.position.y = 0.005;

    // Dual sequential chevron indicators pointing along +Z (North in local space) for unmistakable direction readability
    const chevronL1 = MeshBuilder.CreateBox(
      'convChevronL1',
      { width: 0.08, depth: 0.34, height: VISUAL_HEIGHTS.CONVEYOR + 0.016 },
      this.scene
    );
    chevronL1.rotation.y = Math.PI / 4;
    chevronL1.position.set(-0.25, 0.008, -0.32);

    const chevronR1 = MeshBuilder.CreateBox(
      'convChevronR1',
      { width: 0.08, depth: 0.34, height: VISUAL_HEIGHTS.CONVEYOR + 0.016 },
      this.scene
    );
    chevronR1.rotation.y = -Math.PI / 4;
    chevronR1.position.set(0.25, 0.008, -0.32);

    const chevronL2 = MeshBuilder.CreateBox(
      'convChevronL2',
      { width: 0.08, depth: 0.34, height: VISUAL_HEIGHTS.CONVEYOR + 0.016 },
      this.scene
    );
    chevronL2.rotation.y = Math.PI / 4;
    chevronL2.position.set(-0.25, 0.008, 0.28);

    const chevronR2 = MeshBuilder.CreateBox(
      'convChevronR2',
      { width: 0.08, depth: 0.34, height: VISUAL_HEIGHTS.CONVEYOR + 0.016 },
      this.scene
    );
    chevronR2.rotation.y = -Math.PI / 4;
    chevronR2.position.set(0.25, 0.008, 0.28);

    this.masterConveyor = Mesh.MergeMeshes(
      [convBase, convRail, chevronL1, chevronR1, chevronL2, chevronR2],
      true,
      true,
      undefined,
      false,
      true
    ) as Mesh;
    this.masterConveyor.name = 'masterConveyor';
    this.masterConveyor.material = conveyorMat;
    this.masterConveyor.setEnabled(false);
  }

  /**
   * Instantiates logical tiles and visual meshes from level data matrix.
   */
  private buildMap(levelData: TileType[][]): void {
    this.tiles = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

    const conveyorMetaMap = new Map<string, Direction>();
    if (this.levelDefinition?.terrainMetadata?.conveyors) {
      for (const c of this.levelDefinition.terrainMetadata.conveyors) {
        conveyorMetaMap.set(`${c.row}_${c.column}`, c.direction);
      }
    }

    const playerSpawnMat = this.playerSpawnMat!;
    const enemySpawnMat = this.enemySpawnMat!;

    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const type = levelData[r][c];
        const worldPos = this.gridToWorld(r, c);

        const tile = new Tile(r, c, type, worldPos);
        if (type === TileType.CONVEYOR) {
          tile.conveyorDirection = conveyorMetaMap.get(`${r}_${c}`) ?? Direction.NORTH;
        }
        this.tiles[r][c] = tile;

        switch (type) {
          case TileType.BRICK:
            this.buildBrickTile(tile);
            break;

          case TileType.STEEL:
            this.buildSteelTile(tile);
            break;

          case TileType.BUSH:
            this.buildBushTile(tile);
            break;

          case TileType.BASE:
            this.baseEntity = new Base(`commandBase_${r}_${c}`, this.scene, worldPos);
            this.basePos = worldPos.clone();
            break;

          case TileType.PLAYER_SPAWN:
            this.buildSpawnMarker(tile, playerSpawnMat, 'player_spawn');
            this.playerSpawnPos = worldPos.clone();
            break;

          case TileType.ENEMY_SPAWN:
            this.buildSpawnMarker(tile, enemySpawnMat, `enemy_spawn_${r}_${c}`);
            this.enemySpawnPositions.push(worldPos.clone());
            break;

          case TileType.CRYO:
            this.buildCryoTile(tile);
            break;

          case TileType.CONVEYOR:
            this.buildConveyorTile(tile);
            break;

          case TileType.EMPTY:
          default:
            break;
        }
      }
    }
  }

  /**
   * Instantiates a 4-quadrant destructible brick block using hardware instances.
   * Quadrants are positioned at:
   * TL: (-0.5, +0.5), TR: (+0.5, +0.5)
   * BL: (-0.5, -0.5), BR: (+0.5, -0.5)
   */
  private buildBrickTile(tile: Tile): void {
    if (!this.masterBrickQuadrant || !tile.quadrantMeshes) return;

    const half = TILE_SIZE / 4; // 0.5 world units offset
    const yPos = VISUAL_HEIGHTS.BRICK / 2;

    const r = tile.row;
    const c = tile.column;
    const wp = tile.worldPosition;

    // Top-Left (North-West)
    const tl = this.masterBrickQuadrant.createInstance(`brick_${r}_${c}_tl`);
    tl.position.set(wp.x - half, yPos, wp.z + half);
    tile.quadrantMeshes.tl = tl;

    // Top-Right (North-East)
    const tr = this.masterBrickQuadrant.createInstance(`brick_${r}_${c}_tr`);
    tr.position.set(wp.x + half, yPos, wp.z + half);
    tile.quadrantMeshes.tr = tr;

    // Bottom-Left (South-West)
    const bl = this.masterBrickQuadrant.createInstance(`brick_${r}_${c}_bl`);
    bl.position.set(wp.x - half, yPos, wp.z - half);
    tile.quadrantMeshes.bl = bl;

    // Bottom-Right (South-East)
    const br = this.masterBrickQuadrant.createInstance(`brick_${r}_${c}_br`);
    br.position.set(wp.x + half, yPos, wp.z - half);
    tile.quadrantMeshes.br = br;
  }

  /**
   * Instantiates a steel armor block using hardware instances.
   */
  private buildSteelTile(tile: Tile): void {
    if (!this.masterSteel) return;
    const instance = this.masterSteel.createInstance(`steel_${tile.row}_${tile.column}`);
    instance.position.set(tile.worldPosition.x, VISUAL_HEIGHTS.STEEL / 2, tile.worldPosition.z);
    tile.mesh = instance;
  }

  /**
   * Instantiates a foliage bush cluster using hardware instances.
   */
  private buildBushTile(tile: Tile): void {
    if (!this.masterBush) return;
    const instance = this.masterBush.createInstance(`bush_${tile.row}_${tile.column}`);
    instance.position.set(tile.worldPosition.x, VISUAL_HEIGHTS.BUSH / 2, tile.worldPosition.z);
    tile.mesh = instance;
  }

  /**
   * Instantiates a low-friction Cryo cooling plate using hardware instances.
   */
  private buildCryoTile(tile: Tile): void {
    if (!this.masterCryo) return;
    const instance = this.masterCryo.createInstance(`cryo_${tile.row}_${tile.column}`);
    instance.position.set(tile.worldPosition.x, VISUAL_HEIGHTS.CRYO / 2, tile.worldPosition.z);
    tile.mesh = instance;
  }

  /**
   * Instantiates a Mag-Drive Conveyor plate oriented in its defined cardinal direction.
   */
  private buildConveyorTile(tile: Tile): void {
    if (!this.masterConveyor) return;
    const instance = this.masterConveyor.createInstance(`conveyor_${tile.row}_${tile.column}`);
    instance.position.set(tile.worldPosition.x, VISUAL_HEIGHTS.CONVEYOR / 2, tile.worldPosition.z);

    const dir = tile.conveyorDirection ?? Direction.NORTH;
    let rotY = 0;
    if (dir === Direction.EAST) rotY = Math.PI / 2;
    else if (dir === Direction.SOUTH) rotY = Math.PI;
    else if (dir === Direction.WEST) rotY = -Math.PI / 2;

    instance.rotation.y = rotY;
    tile.mesh = instance;
  }



  /**
   * Subtly visualizes spawn points on the floor with neon tactical frames.
   */
  private buildSpawnMarker(tile: Tile, markerMat: StandardMaterial, name: string): void {
    const wp = tile.worldPosition;
    const marker = MeshBuilder.CreateGround(
      name,
      {
        width: TILE_SIZE * 0.82,
        height: TILE_SIZE * 0.82
      },
      this.scene
    );
    marker.position.set(wp.x, VISUAL_HEIGHTS.SPAWN_MARKER, wp.z);
    marker.material = markerMat;
    marker.receiveShadows = true;
    tile.mesh = marker;
  }

  /**
   * Renders subtle debug grid lines when DEBUG = true.
   */
  private buildDebugGrid(): void {
    const halfWidth = (GRID_COLS * TILE_SIZE) / 2;
    const halfDepth = (GRID_ROWS * TILE_SIZE) / 2;
    const lines: Vector3[][] = [];

    // Horizontal lines
    for (let r = 0; r <= GRID_ROWS; r++) {
      const z = halfDepth - r * TILE_SIZE;
      lines.push([new Vector3(-halfWidth, 0.05, z), new Vector3(halfWidth, 0.05, z)]);
    }

    // Vertical lines
    for (let c = 0; c <= GRID_COLS; c++) {
      const x = -halfWidth + c * TILE_SIZE;
      lines.push([new Vector3(x, 0.05, -halfDepth), new Vector3(x, 0.05, halfDepth)]);
    }

    const gridMesh = MeshBuilder.CreateLineSystem('debugGrid', { lines }, this.scene);
    gridMesh.color = new Color3(0.0, 0.7, 1.0);
    this.debugMeshes.push(gridMesh);
  }

  /**
   * Properly cleans up all tiles, instances, templates, and shared materials.
   */
  public dispose(): void {
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tile = this.tiles[r]?.[c];
        if (tile) tile.dispose();
      }
    }
    this.tiles = [];

    // Master templates (masterBrickQuadrant, masterSteel, masterBush) are managed by EnvironmentAssetLibrary
    this.masterBrickQuadrant = undefined;
    this.masterSteel = undefined;
    this.masterBush = undefined;
    if (this.masterCryo) {
      this.masterCryo.dispose();
      this.masterCryo = undefined;
    }
    if (this.masterConveyor) {
      this.masterConveyor.dispose();
      this.masterConveyor = undefined;
    }

    this.debugMeshes.forEach((mesh) => mesh.dispose());
    this.debugMeshes = [];

    if (this.baseEntity) {
      this.baseEntity.dispose();
      this.baseEntity = undefined;
    }

    this.sharedMaterials.forEach((mat) => mat.dispose());
    this.sharedMaterials = [];
  }
}
