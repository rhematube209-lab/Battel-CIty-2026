import {
  Scene,
  Mesh,
  MeshBuilder,
  VertexBuffer,
} from '@babylonjs/core';
import { TILE_SIZE, VISUAL_HEIGHTS, BORDER_HEIGHT, BORDER_THICKNESS } from '../game/constants';
import { EnvironmentMaterials, MaterialLibrary } from './MaterialLibrary';

/**
 * Applies RGBA vertex colors to all vertices of a mesh.
 * Merged meshes preserve vertex color buffers across sub-parts into a single submesh buffer.
 */
function applyMeshVertexColor(mesh: Mesh, r: number, g: number, b: number, a: number = 1.0): void {
  const count = mesh.getTotalVertices();
  const colors = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    colors[i * 4] = r;
    colors[i * 4 + 1] = g;
    colors[i * 4 + 2] = b;
    colors[i * 4 + 3] = a;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/**
 * Applies RGBA vertex colors to all vertices of a mesh based on vertex normals.
 * Distinguishes top (+Y), front (+Z), back (-Z), sides (+/-X), and bottom (-Y) faces.
 */
function applyBoxFaceVertexColors(
  mesh: Mesh,
  topCol: [number, number, number],
  sideCol: [number, number, number],
  frontCol: [number, number, number],
  bottomCol: [number, number, number],
  backCol?: [number, number, number]
): void {
  const count = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const colors = new Float32Array(count * 4);
  const back = backCol || sideCol;

  for (let i = 0; i < count; i++) {
    const ny = normals ? normals[i * 3 + 1] : 0;
    const nz = normals ? normals[i * 3 + 2] : 0;

    let col = sideCol;
    if (ny > 0.5) {
      col = topCol;
    } else if (ny < -0.5) {
      col = bottomCol;
    } else if (nz > 0.5) {
      col = frontCol;
    } else if (nz < -0.5) {
      col = back;
    } else {
      col = sideCol;
    }

    colors[i * 4] = col[0];
    colors[i * 4 + 1] = col[1];
    colors[i * 4 + 2] = col[2];
    colors[i * 4 + 3] = 1.0;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/**
 * EnvironmentAssetLibrary: Central repository of master geometry templates for hardware instancing.
 * Created once per scene, cached, and reused across all stages.
 * Zero duplicate meshes, zero memory leaks.
 */
export class EnvironmentAssetLibrary {
  private static instance: EnvironmentAssetLibrary | null = null;

  private scene: Scene;
  private matLib: MaterialLibrary;

  // Master templates (all disabled, used strictly for createInstance)
  private masterBrickQuadrant?: Mesh;
  private masterSteel?: Mesh;
  private masterBush?: Mesh;
  private masterPerimeterWall?: Mesh;
  private masterPerimeterColumn?: Mesh;
  private masterCornerHousing?: Mesh;

  private isInitialized = false;

  private constructor(scene: Scene, matLib: MaterialLibrary) {
    this.scene = scene;
    this.matLib = matLib;
    this.init();
  }

  public static getInstance(scene: Scene): EnvironmentAssetLibrary {
    const matLib = MaterialLibrary.getInstance(scene);
    if (!EnvironmentAssetLibrary.instance || EnvironmentAssetLibrary.instance.scene !== scene) {
      if (EnvironmentAssetLibrary.instance) {
        EnvironmentAssetLibrary.instance.dispose();
      }
      EnvironmentAssetLibrary.instance = new EnvironmentAssetLibrary(scene, matLib);
    }
    return EnvironmentAssetLibrary.instance;
  }

  public static getExistingInstance(): EnvironmentAssetLibrary | null {
    return EnvironmentAssetLibrary.instance;
  }

  public getMasterBrickQuadrant(): Mesh {
    return this.masterBrickQuadrant!;
  }

  public getMasterSteel(): Mesh {
    return this.masterSteel!;
  }

  public getMasterBush(): Mesh {
    return this.masterBush!;
  }

  public getMasterPerimeterWall(): Mesh {
    return this.masterPerimeterWall!;
  }

  public getMasterPerimeterColumn(): Mesh {
    return this.masterPerimeterColumn!;
  }

  public getMasterCornerHousing(): Mesh {
    return this.masterCornerHousing!;
  }

  private init(): void {
    if (this.isInitialized) return;

    const mats = this.matLib.getMaterials();

    this.buildBrickMaster(mats);
    this.buildSteelMaster(mats);
    this.buildBushMaster(mats);
    this.buildPerimeterMasters(mats);

    this.isInitialized = true;
  }

  /**
   * Builds the master brick quadrant template.
   * Quadrant size: 0.95 x 0.95 x 0.8 world units.
   * Modeled masonry: strictly 3 horizontal layers in running bond,
   * seamless 1.0x1.0 quadrant tiling with zero inter-block gaps,
   * recessed dark slate mortar bed, and beveled top face trims.
   * Baked vertex colors provide bright top/north/west faces and shaded south/east faces
   * matching top-left to bottom-right key illumination in a single draw call.
   */
  private buildBrickMaster(mats: EnvironmentMaterials): void {
    const qSize = TILE_SIZE / 2; // Exactly 1.0 unit (zero gap between blocks, seamless masonry)
    const h = VISUAL_HEIGHTS.BRICK; // 0.8 units

    // Unified seamless masonry block template
    const brickQuadrant = MeshBuilder.CreateBox(
      'masterBrickQuadrantMesh',
      { width: qSize, depth: qSize, height: h },
      this.scene
    );

    // Align top-face UVs so horizontal courses run strictly along X (left-to-right) and stack along Z (depth)
    const uvs = brickQuadrant.getVerticesData(VertexBuffer.UVKind);
    const normals = brickQuadrant.getVerticesData(VertexBuffer.NormalKind);
    const positions = brickQuadrant.getVerticesData(VertexBuffer.PositionKind);
    if (uvs && normals && positions) {
      for (let i = 0; i < brickQuadrant.getTotalVertices(); i++) {
        if (normals[i * 3 + 1] > 0.5) { // Top face (+Y)
          const px = positions[i * 3];     // -0.5 to +0.5
          const pz = positions[i * 3 + 2]; // -0.5 to +0.5
          uvs[i * 2] = px + 0.5;           // U in [0, 1] from left to right across X
          uvs[i * 2 + 1] = 0.5 - pz;       // V in [0, 1] from North (pz=+0.5) to South (pz=-0.5)
        }
      }
      brickQuadrant.setVerticesData(VertexBuffer.UVKind, uvs);
    }

    // Apply face vertex colors matching top-left key illumination
    applyBoxFaceVertexColors(
      brickQuadrant,
      [1.0, 1.0, 1.0],      // Top (+Y): full illumination
      [0.85, 0.82, 0.85],   // Sides (+/-X): balanced ambient
      [0.88, 0.85, 0.88],   // Front (+Z): south facing
      [0.25, 0.25, 0.25],   // Bottom (-Y): floor contact
      [0.80, 0.78, 0.82]    // Back (-Z): north facing
    );

    this.masterBrickQuadrant = brickQuadrant;
    this.masterBrickQuadrant.material = mats.brick;
    this.masterBrickQuadrant.useVertexColors = true;
    this.masterBrickQuadrant.name = 'masterBrickQuadrant';
    this.masterBrickQuadrant.setEnabled(false);
    this.masterBrickQuadrant.isPickable = false;
  }

  /**
   * Builds the master steel block template matching the Battle City 2026 Industrial Floor Atlas:
   * Dark gunmetal foundation + stepped outer frame with warm oxidized copper patina +
   * recessed shadow channel + raised armored access hatch plate + diagonal 'X' cross ribs +
   * center lock hub with socket divot + 4 corner recessed socket collars with metallic bolt studs.
   * Baked vertex colors create rich machined armor hierarchy with dark vertical sides in a single draw call.
   */
  private buildSteelMaster(mats: EnvironmentMaterials): void {
    const size = TILE_SIZE * 0.96; // 1.92 units
    const h = VISUAL_HEIGHTS.STEEL; // 0.8 units

    // 1. Heavy dark gunmetal foundation base with darker vertical side walls
    const steelBase = MeshBuilder.CreateBox(
      'steelBasePlate',
      { width: size, depth: size, height: h * 0.70 },
      this.scene
    );
    applyBoxFaceVertexColors(steelBase, [0.20, 0.22, 0.26], [0.08, 0.09, 0.12], [0.12, 0.14, 0.17], [0.10, 0.11, 0.14]);

    // 2. Stepped outer armored frame with warm oxidized copper edge patina (matching reference)
    const outerFrame = MeshBuilder.CreateBox(
      'steelOuterFrame',
      { width: size * 0.92, depth: size * 0.92, height: h * 0.86 },
      this.scene
    );
    outerFrame.position.y = h * 0.04;
    applyBoxFaceVertexColors(outerFrame, [0.38, 0.34, 0.28], [0.14, 0.16, 0.20], [0.22, 0.24, 0.28], [0.16, 0.18, 0.22]);

    // 3. Recessed channel frame (dark shadow gap)
    const channelFrame = MeshBuilder.CreateBox(
      'steelChannelFrame',
      { width: size * 0.82, depth: size * 0.82, height: h * 0.90 },
      this.scene
    );
    channelFrame.position.y = h * 0.05;
    applyBoxFaceVertexColors(channelFrame, [0.10, 0.11, 0.13], [0.10, 0.11, 0.13], [0.10, 0.11, 0.13], [0.10, 0.11, 0.13]);

    // 4. Raised armored center access hatch plate
    const centerPlate = MeshBuilder.CreateBox(
      'steelCenterPlate',
      { width: size * 0.70, depth: size * 0.70, height: h * 1.02 },
      this.scene
    );
    centerPlate.position.y = h * 0.07;
    applyBoxFaceVertexColors(centerPlate, [0.34, 0.38, 0.44], [0.14, 0.16, 0.20], [0.26, 0.29, 0.34], [0.18, 0.20, 0.24]);

    // 5. Diagonal 'X' reinforcing ribs (matching Access Hatch from reference)
    const diagRibLength = size * 0.76;
    const diagBar1 = MeshBuilder.CreateBox(
      'steelDiagBar1',
      { width: diagRibLength, depth: 0.14, height: h * 1.06 },
      this.scene
    );
    diagBar1.position.y = h * 0.08;
    diagBar1.rotation.y = Math.PI / 4;
    diagBar1.bakeCurrentTransformIntoVertices();
    applyBoxFaceVertexColors(diagBar1, [0.46, 0.50, 0.58], [0.20, 0.22, 0.26], [0.28, 0.32, 0.38], [0.22, 0.25, 0.30]);

    const diagBar2 = MeshBuilder.CreateBox(
      'steelDiagBar2',
      { width: diagRibLength, depth: 0.14, height: h * 1.06 },
      this.scene
    );
    diagBar2.position.y = h * 0.08;
    diagBar2.rotation.y = -Math.PI / 4;
    diagBar2.bakeCurrentTransformIntoVertices();
    applyBoxFaceVertexColors(diagBar2, [0.46, 0.50, 0.58], [0.20, 0.22, 0.26], [0.28, 0.32, 0.38], [0.22, 0.25, 0.30]);

    // 6. Center lock hub with central socket divot
    const centerHub = MeshBuilder.CreateCylinder(
      'steelCenterHub',
      { diameter: 0.36, height: h * 1.10, tessellation: 8 },
      this.scene
    );
    centerHub.position.y = h * 0.09;
    applyMeshVertexColor(centerHub, 0.54, 0.60, 0.68);

    const centerDivot = MeshBuilder.CreateCylinder(
      'steelCenterDivot',
      { diameter: 0.16, height: h * 1.12, tessellation: 6 },
      this.scene
    );
    centerDivot.position.y = h * 0.095;
    applyMeshVertexColor(centerDivot, 0.16, 0.18, 0.22);

    // 7. 4 Heavy corner socket collars & hexagonal bolt studs
    const boltOffset = size * 0.34;
    const socketCollars: Mesh[] = [];
    const bolts: Mesh[] = [];
    const boltPositions = [
      [-boltOffset, -boltOffset],
      [boltOffset, -boltOffset],
      [-boltOffset, boltOffset],
      [boltOffset, boltOffset],
    ];

    boltPositions.forEach(([bx, bz], i) => {
      // Recessed dark socket well
      const collar = MeshBuilder.CreateCylinder(
        `steelSocket_${i}`,
        { diameter: 0.26, height: h * 1.05, tessellation: 8 },
        this.scene
      );
      collar.position.set(bx, h * 0.07, bz);
      applyMeshVertexColor(collar, 0.14, 0.15, 0.18);
      socketCollars.push(collar);

      // Inner metallic bolt pin
      const bolt = MeshBuilder.CreateCylinder(
        `steelBolt_${i}`,
        { diameter: 0.16, height: h * 1.10, tessellation: 6 },
        this.scene
      );
      bolt.position.set(bx, h * 0.085, bz);
      applyMeshVertexColor(bolt, 0.72, 0.78, 0.88);
      bolts.push(bolt);
    });

    this.masterSteel = Mesh.MergeMeshes(
      [
        steelBase,
        outerFrame,
        channelFrame,
        centerPlate,
        diagBar1,
        diagBar2,
        centerHub,
        centerDivot,
        ...socketCollars,
        ...bolts,
      ],
      true,
      true,
      undefined,
      false,
      false
    ) as Mesh;

    this.masterSteel.material = mats.steel;
    this.masterSteel.useVertexColors = true;
    this.masterSteel.name = 'masterSteel';
    this.masterSteel.setEnabled(false);
    this.masterSteel.isPickable = false;
  }

  /**
   * Builds the master vegetation cluster template.
   * Full-coverage foliage canopy covering the entire 2.0x2.0 square footprint with zero exposed floor.
   * Features a dense underlying foliage bed and multi-tiered faceted low-poly clumps that
   * seamlessly interlock across adjacent bush tiles into an unbroken forest canopy.
   * Baked vertex colors distinguish deep understory shadows (0.03, 0.20, 0.09), rich structural mid-green (0.07, 0.44, 0.22),
   * and sun-lit canopy highlights (0.13, 0.62, 0.30) in a single draw call.
   */
  private buildBushMaster(mats: EnvironmentMaterials): void {
    const h = VISUAL_HEIGHTS.BUSH; // 1.1 units
    const clumps: Mesh[] = [];

    // 1. Foundation foliage bed: completely seals the 2.0 x 2.0 tile footprint
    const baseBed = MeshBuilder.CreateBox(
      'bushBaseBed',
      { width: TILE_SIZE * 1.01, depth: TILE_SIZE * 1.01, height: h * 0.52 },
      this.scene
    );
    baseBed.position.set(0, -h * 0.16, 0);
    applyBoxFaceVertexColors(
      baseBed,
      [0.05, 0.32, 0.16], // Top (+Y)
      [0.03, 0.20, 0.10], // Sides (+/-X)
      [0.04, 0.24, 0.12], // Front (+Z)
      [0.02, 0.14, 0.07], // Bottom (-Y)
      [0.03, 0.20, 0.10]  // Back (-Z)
    );
    clumps.push(baseBed);

    // 2. Corner & perimeter canopy domes extending fully to tile boundaries
    const perimeterConfigs = [
      // 4 Corners: radius 0.54, centered at +/-0.58
      { name: 'bush_c_nw', pos: [-0.58, -h * 0.06, 0.58], rx: 0.54, ry: 0.38, rz: 0.54, rotY: 0.40, col: [0.05, 0.36, 0.18] },
      { name: 'bush_c_ne', pos: [0.58, -h * 0.06, 0.58], rx: 0.54, ry: 0.38, rz: 0.54, rotY: 1.30, col: [0.06, 0.38, 0.19] },
      { name: 'bush_c_sw', pos: [-0.58, -h * 0.06, -0.58], rx: 0.54, ry: 0.38, rz: 0.54, rotY: 2.20, col: [0.04, 0.32, 0.16] },
      { name: 'bush_c_se', pos: [0.58, -h * 0.06, -0.58], rx: 0.54, ry: 0.38, rz: 0.54, rotY: 3.10, col: [0.05, 0.34, 0.17] },
      // 4 Cardinal edge bridges: radius 0.50, centered at +/-0.65
      { name: 'bush_e_n', pos: [0.0, -h * 0.04, 0.65], rx: 0.52, ry: 0.36, rz: 0.48, rotY: 0.85, col: [0.06, 0.40, 0.20] },
      { name: 'bush_e_s', pos: [0.0, -h * 0.04, -0.65], rx: 0.52, ry: 0.36, rz: 0.48, rotY: 4.15, col: [0.05, 0.35, 0.18] },
      { name: 'bush_e_w', pos: [-0.65, -h * 0.04, 0.0], rx: 0.48, ry: 0.36, rz: 0.52, rotY: 2.65, col: [0.06, 0.38, 0.19] },
      { name: 'bush_e_e', pos: [0.65, -h * 0.04, 0.0], rx: 0.48, ry: 0.36, rz: 0.52, rotY: 5.40, col: [0.07, 0.42, 0.21] },
    ];

    perimeterConfigs.forEach(cfg => {
      const clump = MeshBuilder.CreateIcoSphere(cfg.name, { radiusX: cfg.rx, radiusY: cfg.ry, radiusZ: cfg.rz, subdivisions: 2, flat: true }, this.scene);
      clump.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      clump.rotation.y = cfg.rotY;
      applyMeshVertexColor(clump, cfg.col[0], cfg.col[1], cfg.col[2]);
      clumps.push(clump);
    });

    // 3. Central & mid-tier canopy mass
    const midConfigs = [
      { name: 'bush_m_c', pos: [0.0, h * 0.12, 0.0], rx: 0.56, ry: 0.40, rz: 0.56, rotY: 0.60, col: [0.08, 0.48, 0.24] },
      { name: 'bush_m_1', pos: [-0.30, h * 0.14, -0.20], rx: 0.46, ry: 0.36, rz: 0.46, rotY: 1.80, col: [0.07, 0.45, 0.22] },
      { name: 'bush_m_2', pos: [0.32, h * 0.15, 0.22], rx: 0.46, ry: 0.36, rz: 0.46, rotY: 3.20, col: [0.08, 0.48, 0.24] },
      { name: 'bush_m_3', pos: [-0.24, h * 0.16, 0.30], rx: 0.44, ry: 0.34, rz: 0.44, rotY: 4.50, col: [0.08, 0.46, 0.23] },
      { name: 'bush_m_4', pos: [0.28, h * 0.14, -0.26], rx: 0.44, ry: 0.34, rz: 0.44, rotY: 5.70, col: [0.07, 0.44, 0.22] },
    ];

    midConfigs.forEach(cfg => {
      const clump = MeshBuilder.CreateIcoSphere(cfg.name, { radiusX: cfg.rx, radiusY: cfg.ry, radiusZ: cfg.rz, subdivisions: 2, flat: true }, this.scene);
      clump.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      clump.rotation.y = cfg.rotY;
      applyMeshVertexColor(clump, cfg.col[0], cfg.col[1], cfg.col[2]);
      clumps.push(clump);
    });

    // 4. Sunlit upper canopy highlights (vibrant natural leaf highlight: 0.13, 0.62, 0.30)
    const upperConfigs = [
      { name: 'bush_u_c', pos: [0.04, h * 0.32, -0.02], rx: 0.42, ry: 0.30, rz: 0.42, rotY: 1.10, col: [0.13, 0.62, 0.30] },
      { name: 'bush_u_1', pos: [-0.20, h * 0.28, 0.16], rx: 0.36, ry: 0.26, rz: 0.36, rotY: 2.70, col: [0.12, 0.58, 0.28] },
      { name: 'bush_u_2', pos: [0.22, h * 0.30, -0.12], rx: 0.36, ry: 0.26, rz: 0.36, rotY: 4.40, col: [0.14, 0.64, 0.32] },
    ];

    upperConfigs.forEach(cfg => {
      const clump = MeshBuilder.CreateIcoSphere(cfg.name, { radiusX: cfg.rx, radiusY: cfg.ry, radiusZ: cfg.rz, subdivisions: 2, flat: true }, this.scene);
      clump.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      clump.rotation.y = cfg.rotY;
      applyMeshVertexColor(clump, cfg.col[0], cfg.col[1], cfg.col[2]);
      clumps.push(clump);
    });

    this.masterBush = Mesh.MergeMeshes(
      clumps,
      true,
      true,
      undefined,
      false,
      false
    ) as Mesh;

    this.masterBush.material = mats.bushLeafA;
    this.masterBush.useVertexColors = true;
    this.masterBush.name = 'masterBush';
    this.masterBush.setEnabled(false);
    this.masterBush.isPickable = false;
  }

  /**
   * Builds modular in-world perimeter hardware templates:
   * - masterPerimeterWall: Armored barrier module with stepped footing, recessed vent trench, top cowl, and status indicator
   * - masterPerimeterColumn: Reinforced octagonal structural buttress pillar with mid collar and beveled cap
   * - masterCornerHousing: Fortified octagonal corner fortress with footing, observation tower, sensor cap, and status indicator
   * Baked vertex colors distinguish perimeter armor plate (0.20, 0.24, 0.30) from dark hardware conduit/trim (0.08, 0.10, 0.14).
   */
  private buildPerimeterMasters(mats: EnvironmentMaterials): void {
    const wallLen = 2.0;
    const wallThick = BORDER_THICKNESS;
    const wallH = BORDER_HEIGHT;

    // --- 1. Master Perimeter Wall Segment (2m) ---
    // Footing foundation
    const wallFoot = MeshBuilder.CreateBox(
      'periWallFoot',
      { width: wallLen * 0.98, depth: wallThick * 1.25, height: wallH * 0.28 },
      this.scene
    );
    wallFoot.position.y = -wallH * 0.36;
    applyMeshVertexColor(wallFoot, 0.08, 0.10, 0.14);

    // Primary armor slab
    const wallBase = MeshBuilder.CreateBox(
      'periWallBase',
      { width: wallLen * 0.96, depth: wallThick * 0.95, height: wallH * 0.88 },
      this.scene
    );
    applyBoxFaceVertexColors(wallBase, [0.26, 0.32, 0.40], [0.16, 0.20, 0.26], [0.22, 0.27, 0.34], [0.08, 0.10, 0.14]);

    // Recessed center vent trench
    const wallVentTrench = MeshBuilder.CreateBox(
      'periWallVentTrench',
      { width: wallLen * 0.84, depth: wallThick * 0.40, height: wallH * 0.32 },
      this.scene
    );
    wallVentTrench.position.set(0, 0, -wallThick * 0.28);
    applyMeshVertexColor(wallVentTrench, 0.07, 0.09, 0.12);

    // Vent louvers (horizontal grille)
    const louver1 = MeshBuilder.CreateBox('periWallLouver1', { width: wallLen * 0.80, depth: 0.08, height: 0.04 }, this.scene);
    louver1.position.set(0, -0.08, -wallThick * 0.44);
    applyMeshVertexColor(louver1, 0.30, 0.35, 0.44);

    const louver2 = MeshBuilder.CreateBox('periWallLouver2', { width: wallLen * 0.80, depth: 0.08, height: 0.04 }, this.scene);
    louver2.position.set(0, 0.08, -wallThick * 0.44);
    applyMeshVertexColor(louver2, 0.30, 0.35, 0.44);

    // Top protective mechanical cowl / cap
    const wallCap = MeshBuilder.CreateBox(
      'periWallCap',
      { width: wallLen * 0.98, depth: wallThick * 1.05, height: 0.18 },
      this.scene
    );
    wallCap.position.y = wallH * 0.48;
    applyBoxFaceVertexColors(wallCap, [0.22, 0.26, 0.34], [0.10, 0.12, 0.16], [0.16, 0.20, 0.26], [0.08, 0.10, 0.14]);

    // Subtle cyan status indicator strip
    const wallIndicator = MeshBuilder.CreateBox(
      'periWallIndicator',
      { width: wallLen * 0.60, depth: 0.06, height: 0.04 },
      this.scene
    );
    wallIndicator.position.set(0, wallH * 0.24, -wallThick * 0.46);
    applyMeshVertexColor(wallIndicator, 0.0, 0.80, 1.0);

    this.masterPerimeterWall = Mesh.MergeMeshes(
      [wallFoot, wallBase, wallVentTrench, louver1, louver2, wallCap, wallIndicator],
      true,
      true,
      undefined,
      false,
      false
    ) as Mesh;
    this.masterPerimeterWall.material = mats.perimeterArmor;
    this.masterPerimeterWall.useVertexColors = true;
    this.masterPerimeterWall.name = 'masterPerimeterWall';
    this.masterPerimeterWall.setEnabled(false);
    this.masterPerimeterWall.isPickable = false;

    // --- 2. Master Perimeter Structural Column ---
    const colBase = MeshBuilder.CreateCylinder(
      'periColBase',
      { diameter: wallThick * 1.5, height: wallH * 1.25, tessellation: 8 },
      this.scene
    );
    applyMeshVertexColor(colBase, 0.09, 0.11, 0.15);

    const colBand = MeshBuilder.CreateCylinder(
      'periColBand',
      { diameter: wallThick * 1.62, height: wallH * 0.35, tessellation: 8 },
      this.scene
    );
    colBand.position.y = wallH * 0.15;
    applyMeshVertexColor(colBand, 0.22, 0.26, 0.34);

    const colCap = MeshBuilder.CreateCylinder(
      'periColCap',
      { diameter: wallThick * 1.45, height: 0.22, tessellation: 8 },
      this.scene
    );
    colCap.position.y = wallH * 0.65;
    applyMeshVertexColor(colCap, 0.24, 0.28, 0.36);

    this.masterPerimeterColumn = Mesh.MergeMeshes(
      [colBase, colBand, colCap],
      true,
      true,
      undefined,
      false,
      false
    ) as Mesh;
    this.masterPerimeterColumn.material = mats.perimeterArmor;
    this.masterPerimeterColumn.useVertexColors = true;
    this.masterPerimeterColumn.name = 'masterPerimeterColumn';
    this.masterPerimeterColumn.setEnabled(false);
    this.masterPerimeterColumn.isPickable = false;

    // --- 3. Master Corner Housing Tower ---
    const cornerSize = wallThick * 1.8;
    const cornerH = wallH * 1.45;

    const towerFoot = MeshBuilder.CreateCylinder(
      'periCornerFoot',
      { diameter: cornerSize * 1.20, height: cornerH * 0.35, tessellation: 8 },
      this.scene
    );
    towerFoot.position.y = -cornerH * 0.32;
    applyMeshVertexColor(towerFoot, 0.07, 0.09, 0.12);

    const towerBase = MeshBuilder.CreateCylinder(
      'periCornerTower',
      { diameter: cornerSize, height: cornerH, tessellation: 8 },
      this.scene
    );
    applyMeshVertexColor(towerBase, 0.18, 0.22, 0.28);

    const towerShield = MeshBuilder.CreateCylinder(
      'periCornerShield',
      { diameter: cornerSize * 1.15, height: cornerH * 0.45, tessellation: 8 },
      this.scene
    );
    towerShield.position.y = -cornerH * 0.05;
    applyMeshVertexColor(towerShield, 0.22, 0.26, 0.32);

    const towerCap = MeshBuilder.CreateCylinder(
      'periCornerCap',
      { diameter: cornerSize * 0.88, height: 0.28, tessellation: 8 },
      this.scene
    );
    towerCap.position.y = cornerH * 0.54;
    applyMeshVertexColor(towerCap, 0.26, 0.30, 0.38);

    // Small status sensor indicator ring
    const sensorRing = MeshBuilder.CreateCylinder(
      'periCornerSensor',
      { diameter: cornerSize * 0.72, height: 0.08, tessellation: 8 },
      this.scene
    );
    sensorRing.position.y = cornerH * 0.66;
    applyMeshVertexColor(sensorRing, 0.0, 0.85, 1.0);

    this.masterCornerHousing = Mesh.MergeMeshes(
      [towerFoot, towerBase, towerShield, towerCap, sensorRing],
      true,
      true,
      undefined,
      false,
      false
    ) as Mesh;
    this.masterCornerHousing.material = mats.perimeterArmor;
    this.masterCornerHousing.useVertexColors = true;
    this.masterCornerHousing.name = 'masterCornerHousing';
    this.masterCornerHousing.setEnabled(false);
    this.masterCornerHousing.isPickable = false;
  }

  public dispose(): void {
    if (this.masterBrickQuadrant) {
      this.masterBrickQuadrant.dispose();
      this.masterBrickQuadrant = undefined;
    }
    if (this.masterSteel) {
      this.masterSteel.dispose();
      this.masterSteel = undefined;
    }
    if (this.masterBush) {
      this.masterBush.dispose();
      this.masterBush = undefined;
    }
    if (this.masterPerimeterWall) {
      this.masterPerimeterWall.dispose();
      this.masterPerimeterWall = undefined;
    }
    if (this.masterPerimeterColumn) {
      this.masterPerimeterColumn.dispose();
      this.masterPerimeterColumn = undefined;
    }
    if (this.masterCornerHousing) {
      this.masterCornerHousing.dispose();
      this.masterCornerHousing = undefined;
    }

    this.isInitialized = false;
    if (EnvironmentAssetLibrary.instance === this) {
      EnvironmentAssetLibrary.instance = null;
    }
  }
}
