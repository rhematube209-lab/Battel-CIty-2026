import {
  Scene,
  Mesh,
  MeshBuilder,
  VertexBuffer,
} from '@babylonjs/core';
import { TankMaterialLibrary, TankMaterials } from './TankMaterialLibrary';

/**
 * Applies uniform RGBA vertex colors to all vertices of a mesh.
 */
function applyMeshColor(mesh: Mesh, r: number, g: number, b: number, a: number = 1.0): void {
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
 * Applies directional vertex colors to a box mesh across all 6 directional face normals:
 * top (+Y), left (-X, lit), front (+Z, lit), right (+X, shaded), back (-Z, shaded), bottom (-Y, shadow).
 */
function applyBoxDirectionalColor6(
  mesh: Mesh,
  topCol: [number, number, number],
  leftCol: [number, number, number],
  frontCol: [number, number, number],
  rightCol: [number, number, number],
  backCol: [number, number, number],
  bottomCol: [number, number, number]
): void {
  const count = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const colors = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const nx = normals ? normals[i * 3] : 0;
    const ny = normals ? normals[i * 3 + 1] : 0;
    const nz = normals ? normals[i * 3 + 2] : 0;

    let col = frontCol;
    if (ny > 0.5) {
      col = topCol;
    } else if (ny < -0.5) {
      col = bottomCol;
    } else if (nx < -0.5) {
      col = leftCol;
    } else if (nx > 0.5) {
      col = rightCol;
    } else if (nz > 0.5) {
      col = frontCol;
    } else if (nz < -0.5) {
      col = backCol;
    }

    colors[i * 4] = col[0];
    colors[i * 4 + 1] = col[1];
    colors[i * 4 + 2] = col[2];
    colors[i * 4 + 3] = 1.0;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/**
 * Applies longitudinal lighting to a cylinder oriented along Z (rotation.x = Math.PI / 2).
 * Normal +Y is top (highlight), -Y is bottom (shadow), -X is left (lit), +X is right (shaded).
 */
function applyCylinderZLight(
  mesh: Mesh,
  topCol: [number, number, number],
  sideCol: [number, number, number],
  bottomCol: [number, number, number],
  capCol: [number, number, number]
): void {
  const count = mesh.getTotalVertices();
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  const colors = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    const ny = normals ? normals[i * 3 + 1] : 0;
    const nz = normals ? normals[i * 3 + 2] : 0;

    let col = sideCol;
    if (Math.abs(nz) > 0.8) {
      col = capCol;
    } else if (ny > 0.25) {
      col = topCol;
    } else if (ny < -0.25) {
      col = bottomCol;
    }

    colors[i * 4] = col[0];
    colors[i * 4 + 1] = col[1];
    colors[i * 4 + 2] = col[2];
    colors[i * 4 + 3] = 1.0;
  }
  mesh.setVerticesData(VertexBuffer.ColorKind, colors);
}

/**
 * TankAssetLibrary: Central singleton creating and caching master geometry templates
 * for hardware-instanced tanks (Player, Standard, Fast, and Armor).
 * Built once per scene; guarantees zero duplicate mesh overhead and zero memory leaks.
 */
export class TankAssetLibrary {
  private static instance: TankAssetLibrary | null = null;

  private scene: Scene;
  private matLib: TankMaterialLibrary;

  // Master templates: PLAYER
  private playerChassisMaster?: Mesh;
  private playerTurretMaster?: Mesh;
  private playerCannonMaster?: Mesh;

  // Master templates: STANDARD
  private standardChassisMaster?: Mesh;
  private standardTurretMaster?: Mesh;
  private standardCannonMaster?: Mesh;

  // Master templates: FAST
  private fastChassisMaster?: Mesh;
  private fastTurretMaster?: Mesh;
  private fastCannonMaster?: Mesh;

  // Master templates: ARMOR
  private armorChassisMaster?: Mesh;
  private armorTurretMaster?: Mesh;
  private armorCannonMaster?: Mesh;

  private isInitialized = false;

  private constructor(scene: Scene, matLib: TankMaterialLibrary) {
    this.scene = scene;
    this.matLib = matLib;
    this.init();
  }

  public static getInstance(scene: Scene): TankAssetLibrary {
    const matLib = TankMaterialLibrary.getInstance(scene);
    if (!TankAssetLibrary.instance || TankAssetLibrary.instance.scene !== scene) {
      if (TankAssetLibrary.instance) {
        TankAssetLibrary.instance.dispose();
      }
      TankAssetLibrary.instance = new TankAssetLibrary(scene, matLib);
    }
    return TankAssetLibrary.instance;
  }

  public static getExistingInstance(): TankAssetLibrary | null {
    return TankAssetLibrary.instance;
  }

  // Getters for master meshes
  public getPlayerChassisMaster(): Mesh { return this.playerChassisMaster!; }
  public getPlayerTurretMaster(): Mesh { return this.playerTurretMaster!; }
  public getPlayerCannonMaster(): Mesh { return this.playerCannonMaster!; }

  public getStandardChassisMaster(): Mesh { return this.standardChassisMaster!; }
  public getStandardTurretMaster(): Mesh { return this.standardTurretMaster!; }
  public getStandardCannonMaster(): Mesh { return this.standardCannonMaster!; }

  public getFastChassisMaster(): Mesh { return this.fastChassisMaster!; }
  public getFastTurretMaster(): Mesh { return this.fastTurretMaster!; }
  public getFastCannonMaster(): Mesh { return this.fastCannonMaster!; }

  public getArmorChassisMaster(): Mesh { return this.armorChassisMaster!; }
  public getArmorTurretMaster(): Mesh { return this.armorTurretMaster!; }
  public getArmorCannonMaster(): Mesh { return this.armorCannonMaster!; }

  private init(): void {
    if (this.isInitialized) return;
    const mats = this.matLib.getMaterials();

    this.buildPlayerMasters(mats);
    this.buildStandardMasters(mats);
    this.buildFastMasters(mats);
    this.buildArmorMasters(mats);

    this.isInitialized = true;
  }

  // =========================================================================
  // 1. PLAYER MASTER FAMILY (Vibrant Cobalt/Cerulean with 3D Bevel Highlights)
  // =========================================================================
  private buildPlayerMasters(mats: TankMaterials): void {
    // --- 1.1 Player Chassis Master ---
    const parts: Mesh[] = [];

    // Core undercarriage structural belly (deep shadow under the hull)
    const under = MeshBuilder.CreateBox('p_under', { width: 0.88, height: 0.20, depth: 1.28 }, this.scene);
    under.position.y = 0.14;
    applyBoxDirectionalColor6(
      under,
      [0.08, 0.16, 0.28], // top (covered by glacis)
      [0.06, 0.12, 0.22], // left lit
      [0.08, 0.15, 0.26], // front
      [0.04, 0.08, 0.16], // right shaded
      [0.03, 0.06, 0.12], // back
      [0.02, 0.03, 0.06]  // bottom shadow
    );
    parts.push(under);

    // Beveled Upper Glacis / Main Armored Hull Plate
    const glacis = MeshBuilder.CreateBox('p_glacis', { width: 0.78, height: 0.13, depth: 0.88 }, this.scene);
    glacis.position.set(0, 0.27, -0.04);
    applyBoxDirectionalColor6(
      glacis,
      [0.08, 0.42, 0.90], // top roof: rich vivid cobalt blue
      [0.72, 0.88, 1.0],  // left side: bright sunlit gleam
      [0.22, 0.54, 0.95], // front: sunlit azure
      [0.05, 0.18, 0.46], // right side: deep shaded royal navy
      [0.02, 0.08, 0.24], // back: shaded rear
      [0.01, 0.03, 0.08]  // bottom
    );
    parts.push(glacis);

    // Slanted Front Nose Wedge with light crease highlight
    const nose = MeshBuilder.CreateBox('p_nose', { width: 0.74, height: 0.11, depth: 0.28 }, this.scene);
    nose.position.set(0, 0.21, 0.50);
    applyBoxDirectionalColor6(
      nose,
      [0.35, 0.68, 0.98],  // top bevel: bright specular transition
      [0.65, 0.85, 1.0],   // left
      [0.55, 0.80, 1.0],   // front slope highlight
      [0.06, 0.22, 0.52],  // right
      [0.03, 0.10, 0.30],  // back
      [0.01, 0.03, 0.08]   // bottom
    );
    parts.push(nose);

    // Left & Right Continuous Track Assemblies & Fenders
    const trackWidth = 0.22;
    const trackH = 0.26;
    const trackLen = 1.34;
    const trackX = 0.48;

    [-trackX, trackX].forEach((xSide, sideIdx) => {
      const isLeft = xSide < 0;

      // Dark caterpillar rubber/steel tread loop
      const trackLoop = MeshBuilder.CreateBox(`p_trk_${sideIdx}`, { width: trackWidth, height: trackH, depth: trackLen }, this.scene);
      trackLoop.position.set(xSide, 0.15, 0);
      applyBoxDirectionalColor6(
        trackLoop,
        [0.10, 0.12, 0.16],
        isLeft ? [0.12, 0.14, 0.18] : [0.08, 0.09, 0.12],
        [0.14, 0.16, 0.20],
        isLeft ? [0.08, 0.09, 0.12] : [0.06, 0.07, 0.09],
        [0.07, 0.08, 0.10],
        [0.02, 0.03, 0.04]
      );
      parts.push(trackLoop);

      // Overhanging Fender Armored Skirt
      const skirt = MeshBuilder.CreateBox(`p_skirt_${sideIdx}`, { width: trackWidth * 1.06, height: 0.06, depth: 1.04 }, this.scene);
      skirt.position.set(xSide, 0.29, 0);
      applyBoxDirectionalColor6(
        skirt,
        [0.08, 0.44, 0.92],
        isLeft ? [0.88, 0.96, 1.0] : [0.08, 0.36, 0.80], // sharp edge highlight on left fender!
        [0.24, 0.56, 0.96],
        isLeft ? [0.08, 0.36, 0.80] : [0.04, 0.14, 0.38],
        [0.03, 0.10, 0.28],
        [0.01, 0.03, 0.08]
      );
      parts.push(skirt);

      // Curved/Sloped Front Fender End Cap (45 deg angle)
      const frontCap = MeshBuilder.CreateBox(`p_fcap_${sideIdx}`, { width: trackWidth * 1.04, height: 0.08, depth: 0.16 }, this.scene);
      frontCap.position.set(xSide, 0.24, 0.58);
      frontCap.rotation.x = -0.45;
      applyBoxDirectionalColor6(
        frontCap,
        [0.70, 0.88, 1.0], // light catching front curved cap!
        isLeft ? [0.85, 0.95, 1.0] : [0.25, 0.48, 0.78],
        [0.60, 0.82, 1.0],
        isLeft ? [0.20, 0.42, 0.72] : [0.08, 0.20, 0.42],
        [0.08, 0.20, 0.44],
        [0.02, 0.04, 0.10]
      );
      parts.push(frontCap);

      // Sloped Rear Fender End Cap
      const rearCap = MeshBuilder.CreateBox(`p_rcap_${sideIdx}`, { width: trackWidth * 1.04, height: 0.08, depth: 0.16 }, this.scene);
      rearCap.position.set(xSide, 0.24, -0.58);
      rearCap.rotation.x = 0.45;
      applyBoxDirectionalColor6(
        rearCap,
        [0.15, 0.38, 0.75],
        isLeft ? [0.55, 0.75, 0.95] : [0.12, 0.28, 0.52],
        [0.14, 0.32, 0.60],
        isLeft ? [0.10, 0.22, 0.45] : [0.04, 0.12, 0.28],
        [0.06, 0.14, 0.32],
        [0.01, 0.03, 0.07]
      );
      parts.push(rearCap);

      // 3 Rectangular Golden/Amber Sensor Brackets / Hardware on side skirt
      [-0.32, 0.0, 0.32].forEach((bz, bIdx) => {
        const bracket = MeshBuilder.CreateBox(`p_brk_${sideIdx}_${bIdx}`, { width: 0.025, height: 0.035, depth: 0.07 }, this.scene);
        bracket.position.set(xSide > 0 ? xSide + 0.125 : xSide - 0.125, 0.28, bz);
        applyMeshColor(bracket, 1.0, 0.80, 0.28); // brilliant golden brass!
        parts.push(bracket);
      });

      // 4 Molded Road Wheels per side with metal hubs and axle caps
      for (let w = 0; w < 4; w++) {
        const wheelZ = -0.46 + w * 0.31;
        const outerX = xSide > 0 ? xSide + 0.10 : xSide - 0.10;

        // Dark outer rubber tire rim
        const tire = MeshBuilder.CreateCylinder(`p_tire_${sideIdx}_${w}`, { diameter: 0.21, height: 0.02, tessellation: 12 }, this.scene);
        tire.rotation.z = Math.PI / 2;
        tire.position.set(outerX, 0.14, wheelZ);
        applyMeshColor(tire, 0.04, 0.06, 0.09);
        parts.push(tire);

        // Recessed Metallic Hub
        const hub = MeshBuilder.CreateCylinder(`p_hub_${sideIdx}_${w}`, { diameter: 0.14, height: 0.03, tessellation: 12 }, this.scene);
        hub.rotation.z = Math.PI / 2;
        hub.position.set(outerX, 0.14, wheelZ);
        applyMeshColor(hub, 0.45, 0.58, 0.72); // machined metal hub
        parts.push(hub);

        const axle = MeshBuilder.CreateCylinder(`p_axle_${sideIdx}_${w}`, { diameter: 0.05, height: 0.045, tessellation: 8 }, this.scene);
        axle.rotation.z = Math.PI / 2;
        axle.position.set(outerX, 0.14, wheelZ);
        applyMeshColor(axle, 0.90, 0.95, 1.0); // specular axle glint
        parts.push(axle);
      }
    });

    // Rear Engine Deck with 6 Metallic Radiator Louver Slats (Matching reference photo!)
    const louverBay = MeshBuilder.CreateBox('p_louverBay', { width: 0.52, height: 0.04, depth: 0.34 }, this.scene);
    louverBay.position.set(0, 0.29, -0.45);
    applyMeshColor(louverBay, 0.01, 0.02, 0.04); // deep black recess well
    parts.push(louverBay);

    // 6 horizontal metallic cooling slats
    for (let s = 0; s < 6; s++) {
      const slatZ = -0.32 - s * 0.048;
      const slat = MeshBuilder.CreateBox(`p_slat_${s}`, { width: 0.48, height: 0.022, depth: 0.028 }, this.scene);
      slat.position.set(0, 0.32, slatZ);
      applyBoxDirectionalColor6(
        slat,
        [0.90, 0.96, 1.0],  // top ridge: brilliant metallic ice-white cooling rib highlight!
        [0.60, 0.80, 0.98], // left
        [0.08, 0.12, 0.22], // front
        [0.18, 0.32, 0.50], // right
        [0.01, 0.02, 0.04], // back recess shadow
        [0.01, 0.02, 0.04]  // bottom
      );
      parts.push(slat);
    }

    // Front Left & Right Radiant Cyan Status Indicator Lamps
    [-0.34, 0.34].forEach((lampX, lampIdx) => {
      const lamp = MeshBuilder.CreateBox(`p_lamp_${lampIdx}`, { width: 0.08, height: 0.04, depth: 0.06 }, this.scene);
      lamp.position.set(lampX, 0.28, 0.60);
      applyMeshColor(lamp, 0.0, 0.92, 1.0);
      parts.push(lamp);
    });

    this.playerChassisMaster = Mesh.MergeMeshes(parts, true, true, undefined, false, false) as Mesh;
    this.playerChassisMaster.material = mats.playerHull;
    this.playerChassisMaster.useVertexColors = true;
    this.playerChassisMaster.name = 'playerChassisMaster';
    this.playerChassisMaster.setEnabled(false);
    this.playerChassisMaster.isPickable = false;

    // --- 1.2 Player Turret Master ---
    const turretParts: Mesh[] = [];

    // Turret Ring Base Collar (dark foundation)
    const tRing = MeshBuilder.CreateCylinder('p_tRing', { diameter: 0.64, height: 0.05, tessellation: 14 }, this.scene);
    tRing.position.y = 0.025;
    applyMeshColor(tRing, 0.08, 0.12, 0.18);
    turretParts.push(tRing);

    // Main Lower Turret Body (faceted base)
    const tBase = MeshBuilder.CreateBox('p_tBase', { width: 0.66, height: 0.11, depth: 0.76 }, this.scene);
    tBase.position.set(0, 0.09, -0.02);
    applyBoxDirectionalColor6(
      tBase,
      [0.08, 0.42, 0.90], // top
      [0.72, 0.88, 1.0],  // left sunlit face: bright specular gleam
      [0.24, 0.56, 0.96], // front
      [0.05, 0.18, 0.46], // right shaded face
      [0.02, 0.08, 0.25], // rear
      [0.01, 0.03, 0.08]  // undercut crease shadow
    );
    turretParts.push(tBase);

    // Beveled Upper Turret Roof Deck (Chamfered silhouette with edge highlights)
    const tRoof = MeshBuilder.CreateBox('p_tRoof', { width: 0.58, height: 0.08, depth: 0.68 }, this.scene);
    tRoof.position.set(0, 0.17, -0.02);
    applyBoxDirectionalColor6(
      tRoof,
      [0.10, 0.48, 0.94], // top surface: vibrant metallic cobalt azure
      [0.92, 0.97, 1.0],  // left edge: signature bright specular rim gleam!
      [0.60, 0.84, 1.0],  // front edge highlight
      [0.06, 0.20, 0.50], // right slope
      [0.03, 0.10, 0.28], // back slope
      [0.01, 0.03, 0.08]  // bottom
    );
    turretParts.push(tRoof);

    // Top Commander's Hatch Cupola (Elevated square cupola matching reference image!)
    const cupolaBase = MeshBuilder.CreateBox('p_cupola', { width: 0.26, height: 0.06, depth: 0.26 }, this.scene);
    cupolaBase.position.set(0, 0.23, -0.04);
    applyBoxDirectionalColor6(
      cupolaBase,
      [0.12, 0.52, 0.96],
      [0.95, 0.98, 1.0], // bright beveled rim gleam!
      [0.75, 0.90, 1.0],
      [0.06, 0.22, 0.52],
      [0.03, 0.10, 0.30],
      [0.01, 0.03, 0.08]
    );
    turretParts.push(cupolaBase);

    // Recessed hatch door inside the cupola
    const hatchDoor = MeshBuilder.CreateBox('p_hatch', { width: 0.18, height: 0.02, depth: 0.18 }, this.scene);
    hatchDoor.position.set(0, 0.26, -0.04);
    applyMeshColor(hatchDoor, 0.02, 0.06, 0.16); // dark navy hatch interior
    turretParts.push(hatchDoor);

    // Armored Front Mantlet Collar
    const tMantlet = MeshBuilder.CreateBox('p_tMantlet', { width: 0.38, height: 0.15, depth: 0.14 }, this.scene);
    tMantlet.position.set(0, 0.13, 0.38);
    applyBoxDirectionalColor6(
      tMantlet,
      [0.85, 0.94, 1.0],  // top highlight ridge
      [0.65, 0.85, 1.0],  // left
      [0.35, 0.65, 0.96], // front
      [0.10, 0.25, 0.52], // right
      [0.02, 0.05, 0.12], // back junction crease
      [0.01, 0.03, 0.08]  // bottom
    );
    turretParts.push(tMantlet);

    // Front Tactical Cyan Vision Visor Slit
    const tVisor = MeshBuilder.CreateBox('p_tVisor', { width: 0.28, height: 0.04, depth: 0.04 }, this.scene);
    tVisor.position.set(0, 0.16, 0.37);
    applyMeshColor(tVisor, 0.0, 0.95, 1.0);
    turretParts.push(tVisor);

    this.playerTurretMaster = Mesh.MergeMeshes(turretParts, true, true, undefined, false, false) as Mesh;
    this.playerTurretMaster.material = mats.playerHull;
    this.playerTurretMaster.useVertexColors = true;
    this.playerTurretMaster.name = 'playerTurretMaster';
    this.playerTurretMaster.setEnabled(false);
    this.playerTurretMaster.isPickable = false;

    // --- 1.3 Player Cannon Master ---
    const cannonParts: Mesh[] = [];

    // Reinforced Barrel Sleeve Collar
    const sleeve = MeshBuilder.CreateCylinder('p_cSleeve', { diameter: 0.14, height: 0.20, tessellation: 10 }, this.scene);
    sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(0, 0.08, 0.36);
    applyCylinderZLight(
      sleeve,
      [0.70, 0.85, 1.0],  // top highlight
      [0.45, 0.60, 0.78], // side
      [0.12, 0.18, 0.28], // bottom shadow
      [0.30, 0.42, 0.58]  // cap
    );
    cannonParts.push(sleeve);

    // Stepped Machined Main Barrel
    const barrel = MeshBuilder.CreateCylinder('p_cBarrel', { diameter: 0.10, height: 0.60, tessellation: 10 }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.58);
    applyCylinderZLight(
      barrel,
      [0.75, 0.88, 1.0],  // top longitudinal highlight band!
      [0.48, 0.62, 0.80], // side
      [0.10, 0.15, 0.22], // bottom shadow
      [0.25, 0.35, 0.50]  // cap
    );
    cannonParts.push(barrel);

    // Dual-Port Flared Muzzle Brake at tip
    const brake = MeshBuilder.CreateBox('p_cBrake', { width: 0.16, height: 0.12, depth: 0.12 }, this.scene);
    brake.position.set(0, 0.08, 0.88);
    applyBoxDirectionalColor6(
      brake,
      [0.72, 0.86, 1.0],  // top highlight
      [0.50, 0.66, 0.85], // left
      [0.40, 0.55, 0.75], // front
      [0.20, 0.30, 0.44], // right
      [0.12, 0.18, 0.26], // back
      [0.08, 0.12, 0.18]  // bottom
    );
    cannonParts.push(brake);

    // Dark Inner Muzzle Bore Opening
    const bore = MeshBuilder.CreateCylinder('p_cBore', { diameter: 0.07, height: 0.02, tessellation: 8 }, this.scene);
    bore.rotation.x = Math.PI / 2;
    bore.position.set(0, 0.08, 0.94);
    applyMeshColor(bore, 0.01, 0.01, 0.02);
    cannonParts.push(bore);

    // Incandescent Warm Thermal Glow Ring at Muzzle Tip (Matching reference image, tip max Z = 0.950)
    const tipRing = MeshBuilder.CreateCylinder('p_cTipRing', { diameter: 0.11, height: 0.02, tessellation: 8 }, this.scene);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.set(0, 0.08, 0.94);
    applyMeshColor(tipRing, 1.0, 0.55, 0.12); // warm incandescent orange glow ring!
    cannonParts.push(tipRing);

    this.playerCannonMaster = Mesh.MergeMeshes(cannonParts, true, true, undefined, false, false) as Mesh;
    this.playerCannonMaster.material = mats.playerMetal;
    this.playerCannonMaster.useVertexColors = true;
    this.playerCannonMaster.name = 'playerCannonMaster';
    this.playerCannonMaster.setEnabled(false);
    this.playerCannonMaster.isPickable = false;
  }

  // =========================================================================
  // 2. STANDARD ENEMY MASTER FAMILY (Military Copper/Bronze Armor)
  // =========================================================================
  private buildStandardMasters(mats: TankMaterials): void {
    // --- 2.1 Standard Chassis Master ---
    const parts: Mesh[] = [];

    const under = MeshBuilder.CreateBox('std_under', { width: 0.86, height: 0.20, depth: 1.24 }, this.scene);
    under.position.y = 0.14;
    applyBoxDirectionalColor6(
      under,
      [0.14, 0.12, 0.10],
      [0.10, 0.08, 0.07],
      [0.12, 0.09, 0.08],
      [0.06, 0.05, 0.04],
      [0.05, 0.04, 0.03],
      [0.02, 0.02, 0.02]
    );
    parts.push(under);

    const glacis = MeshBuilder.CreateBox('std_glacis', { width: 0.76, height: 0.13, depth: 0.86 }, this.scene);
    glacis.position.set(0, 0.27, -0.04);
    applyBoxDirectionalColor6(
      glacis,
      [0.82, 0.44, 0.18], // top: rich military copper
      [0.98, 0.70, 0.42], // left lit highlight
      [0.88, 0.50, 0.20], // front
      [0.34, 0.14, 0.06], // right shaded
      [0.22, 0.09, 0.04], // back
      [0.05, 0.02, 0.01]
    );
    parts.push(glacis);

    const nose = MeshBuilder.CreateBox('std_nose', { width: 0.72, height: 0.11, depth: 0.26 }, this.scene);
    nose.position.set(0, 0.21, 0.48);
    applyBoxDirectionalColor6(
      nose,
      [0.92, 0.60, 0.30],
      [0.98, 0.72, 0.44],
      [0.96, 0.68, 0.38],
      [0.40, 0.18, 0.08],
      [0.25, 0.11, 0.05],
      [0.06, 0.03, 0.01]
    );
    parts.push(nose);

    // Tracks & Fenders
    const trackWidth = 0.22;
    const trackH = 0.26;
    const trackLen = 1.30;
    const trackX = 0.47;

    [-trackX, trackX].forEach((xSide, sIdx) => {
      const isLeft = xSide < 0;

      const loop = MeshBuilder.CreateBox(`std_trk_${sIdx}`, { width: trackWidth, height: trackH, depth: trackLen }, this.scene);
      loop.position.set(xSide, 0.15, 0);
      applyMeshColor(loop, 0.08, 0.08, 0.09);
      parts.push(loop);

      const skirt = MeshBuilder.CreateBox(`std_skirt_${sIdx}`, { width: trackWidth * 1.05, height: 0.06, depth: 1.02 }, this.scene);
      skirt.position.set(xSide, 0.29, 0);
      applyBoxDirectionalColor6(
        skirt,
        [0.80, 0.42, 0.16],
        isLeft ? [0.98, 0.68, 0.38] : [0.45, 0.20, 0.08],
        [0.85, 0.48, 0.20],
        isLeft ? [0.35, 0.15, 0.06] : [0.20, 0.08, 0.03],
        [0.22, 0.10, 0.04],
        [0.04, 0.02, 0.01]
      );
      parts.push(skirt);

      // Sloped front fender cap
      const fCap = MeshBuilder.CreateBox(`std_fcap_${sIdx}`, { width: trackWidth * 1.04, height: 0.08, depth: 0.15 }, this.scene);
      fCap.position.set(xSide, 0.24, 0.56);
      fCap.rotation.x = -0.45;
      applyBoxDirectionalColor6(fCap, [0.96, 0.70, 0.40], [0.98, 0.72, 0.44], [0.90, 0.58, 0.28], [0.40, 0.18, 0.07], [0.25, 0.10, 0.04], [0.05, 0.02, 0.01]);
      parts.push(fCap);

      // Sloped rear fender cap
      const rCap = MeshBuilder.CreateBox(`std_rcap_${sIdx}`, { width: trackWidth * 1.04, height: 0.08, depth: 0.15 }, this.scene);
      rCap.position.set(xSide, 0.24, -0.56);
      rCap.rotation.x = 0.45;
      applyBoxDirectionalColor6(rCap, [0.55, 0.25, 0.10], [0.70, 0.35, 0.15], [0.45, 0.20, 0.08], [0.22, 0.09, 0.03], [0.15, 0.06, 0.02], [0.04, 0.02, 0.01]);
      parts.push(rCap);

      for (let w = 0; w < 4; w++) {
        const wz = -0.44 + w * 0.29;
        const whl = MeshBuilder.CreateCylinder(`std_whl_${sIdx}_${w}`, { diameter: 0.19, height: 0.03, tessellation: 8 }, this.scene);
        whl.rotation.z = Math.PI / 2;
        whl.position.set(xSide > 0 ? xSide + 0.10 : xSide - 0.10, 0.14, wz);
        applyMeshColor(whl, 0.45, 0.38, 0.30);
        parts.push(whl);
      }
    });

    // Rear Radiator Louver Slats (5 slats)
    const louverBay = MeshBuilder.CreateBox('std_louverBay', { width: 0.50, height: 0.04, depth: 0.30 }, this.scene);
    louverBay.position.set(0, 0.29, -0.44);
    applyMeshColor(louverBay, 0.04, 0.03, 0.03);
    parts.push(louverBay);

    for (let s = 0; s < 5; s++) {
      const slatZ = -0.32 - s * 0.05;
      const slat = MeshBuilder.CreateBox(`std_slat_${s}`, { width: 0.46, height: 0.022, depth: 0.028 }, this.scene);
      slat.position.set(0, 0.32, slatZ);
      applyBoxDirectionalColor6(slat, [0.88, 0.58, 0.32], [0.75, 0.46, 0.24], [0.65, 0.38, 0.18], [0.30, 0.14, 0.06], [0.06, 0.03, 0.02], [0.02, 0.01, 0.01]);
      parts.push(slat);
    }

    // Orange Status Indicators
    [-0.32, 0.32].forEach((lX, lIdx) => {
      const l = MeshBuilder.CreateBox(`std_lamp_${lIdx}`, { width: 0.08, height: 0.04, depth: 0.05 }, this.scene);
      l.position.set(lX, 0.28, 0.58);
      applyMeshColor(l, 1.0, 0.55, 0.06);
      parts.push(l);
    });

    this.standardChassisMaster = Mesh.MergeMeshes(parts, true, true, undefined, false, false) as Mesh;
    this.standardChassisMaster.material = mats.enemyHull;
    this.standardChassisMaster.useVertexColors = true;
    this.standardChassisMaster.name = 'standardChassisMaster';
    this.standardChassisMaster.setEnabled(false);
    this.standardChassisMaster.isPickable = false;

    // --- 2.2 Standard Turret Master ---
    const tParts: Mesh[] = [];

    const tRing = MeshBuilder.CreateCylinder('std_tRing', { diameter: 0.60, height: 0.05, tessellation: 12 }, this.scene);
    tRing.position.y = 0.025;
    applyMeshColor(tRing, 0.08, 0.08, 0.09);
    tParts.push(tRing);

    const tBody = MeshBuilder.CreateBox('std_tBody', { width: 0.64, height: 0.11, depth: 0.72 }, this.scene);
    tBody.position.set(0, 0.09, -0.02);
    applyBoxDirectionalColor6(tBody, [0.80, 0.42, 0.16], [0.95, 0.68, 0.38], [0.85, 0.48, 0.20], [0.32, 0.14, 0.06], [0.20, 0.08, 0.04], [0.05, 0.02, 0.01]);
    tParts.push(tBody);

    const tRoof = MeshBuilder.CreateBox('std_tRoof', { width: 0.56, height: 0.08, depth: 0.64 }, this.scene);
    tRoof.position.set(0, 0.17, -0.02);
    applyBoxDirectionalColor6(tRoof, [0.85, 0.46, 0.20], [0.98, 0.75, 0.46], [0.88, 0.52, 0.24], [0.36, 0.16, 0.07], [0.22, 0.10, 0.04], [0.06, 0.03, 0.01]);
    tParts.push(tRoof);

    // Raised commander cupola
    const cupola = MeshBuilder.CreateBox('std_cupola', { width: 0.24, height: 0.05, depth: 0.24 }, this.scene);
    cupola.position.set(0, 0.23, -0.04);
    applyBoxDirectionalColor6(cupola, [0.92, 0.60, 0.32], [0.98, 0.78, 0.50], [0.90, 0.65, 0.36], [0.42, 0.20, 0.09], [0.25, 0.11, 0.05], [0.08, 0.03, 0.02]);
    tParts.push(cupola);

    const mantlet = MeshBuilder.CreateBox('std_mantlet', { width: 0.36, height: 0.14, depth: 0.14 }, this.scene);
    mantlet.position.set(0, 0.13, 0.36);
    applyBoxDirectionalColor6(mantlet, [0.90, 0.65, 0.38], [0.80, 0.50, 0.26], [0.72, 0.42, 0.20], [0.30, 0.14, 0.06], [0.08, 0.04, 0.02], [0.04, 0.02, 0.01]);
    tParts.push(mantlet);

    const visor = MeshBuilder.CreateBox('std_visor', { width: 0.28, height: 0.04, depth: 0.04 }, this.scene);
    visor.position.set(0, 0.16, 0.35);
    applyMeshColor(visor, 1.0, 0.55, 0.04);
    tParts.push(visor);

    this.standardTurretMaster = Mesh.MergeMeshes(tParts, true, true, undefined, false, false) as Mesh;
    this.standardTurretMaster.material = mats.enemyHull;
    this.standardTurretMaster.useVertexColors = true;
    this.standardTurretMaster.name = 'standardTurretMaster';
    this.standardTurretMaster.setEnabled(false);
    this.standardTurretMaster.isPickable = false;

    // --- 2.3 Standard Cannon Master ---
    const cParts: Mesh[] = [];

    const barrel = MeshBuilder.CreateCylinder('std_cBarrel', { diameter: 0.10, height: 0.60, tessellation: 10 }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.58);
    applyCylinderZLight(barrel, [0.68, 0.58, 0.50], [0.42, 0.36, 0.30], [0.12, 0.10, 0.08], [0.26, 0.22, 0.18]);
    cParts.push(barrel);

    const collar = MeshBuilder.CreateCylinder('std_cCollar', { diameter: 0.14, height: 0.18, tessellation: 10 }, this.scene);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.08, 0.36);
    applyCylinderZLight(collar, [0.60, 0.50, 0.42], [0.38, 0.30, 0.24], [0.10, 0.08, 0.06], [0.22, 0.18, 0.14]);
    cParts.push(collar);

    const brake = MeshBuilder.CreateBox('std_cBrake', { width: 0.15, height: 0.12, depth: 0.12 }, this.scene);
    brake.position.set(0, 0.08, 0.88);
    applyBoxDirectionalColor6(brake, [0.65, 0.55, 0.46], [0.48, 0.40, 0.32], [0.38, 0.30, 0.24], [0.20, 0.16, 0.12], [0.10, 0.08, 0.06], [0.06, 0.05, 0.04]);
    cParts.push(brake);

    const tipRing = MeshBuilder.CreateCylinder('std_cTipRing', { diameter: 0.10, height: 0.02, tessellation: 8 }, this.scene);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.set(0, 0.08, 0.94);
    applyMeshColor(tipRing, 1.0, 0.45, 0.08); // warm orange muzzle tip
    cParts.push(tipRing);

    this.standardCannonMaster = Mesh.MergeMeshes(cParts, true, true, undefined, false, false) as Mesh;
    this.standardCannonMaster.material = mats.enemyMetal;
    this.standardCannonMaster.useVertexColors = true;
    this.standardCannonMaster.name = 'standardCannonMaster';
    this.standardCannonMaster.setEnabled(false);
    this.standardCannonMaster.isPickable = false;
  }

  // =========================================================================
  // 3. FAST ENEMY MASTER FAMILY (Streamlined Golden/Citrine Alloy)
  // =========================================================================
  private buildFastMasters(mats: TankMaterials): void {
    // --- 3.1 Fast Chassis Master ---
    const parts: Mesh[] = [];

    const under = MeshBuilder.CreateBox('f_under', { width: 0.74, height: 0.18, depth: 1.20 }, this.scene);
    under.position.y = 0.14;
    applyBoxDirectionalColor6(under, [0.22, 0.18, 0.10], [0.14, 0.11, 0.06], [0.18, 0.14, 0.08], [0.08, 0.06, 0.03], [0.06, 0.04, 0.02], [0.02, 0.01, 0.01]);
    parts.push(under);

    const nose = MeshBuilder.CreateBox('f_nose', { width: 0.68, height: 0.10, depth: 0.52 }, this.scene);
    nose.position.set(0, 0.19, 0.34);
    applyBoxDirectionalColor6(nose, [0.95, 0.72, 0.22], [1.0, 0.88, 0.50], [0.98, 0.80, 0.32], [0.45, 0.30, 0.08], [0.28, 0.18, 0.05], [0.06, 0.04, 0.01]);
    parts.push(nose);

    const deck = MeshBuilder.CreateBox('f_deck', { width: 0.68, height: 0.08, depth: 0.62 }, this.scene);
    deck.position.set(0, 0.24, -0.16);
    applyBoxDirectionalColor6(deck, [0.88, 0.65, 0.18], [0.98, 0.82, 0.40], [0.92, 0.70, 0.24], [0.38, 0.24, 0.06], [0.22, 0.14, 0.04], [0.05, 0.03, 0.01]);
    parts.push(deck);

    // Slim tracks & 3 lightweight road wheels
    const trackWidth = 0.18;
    const trackH = 0.22;
    const trackLen = 1.24;
    const trackX = 0.42;

    [-trackX, trackX].forEach((xSide, sIdx) => {
      const isLeft = xSide < 0;

      const loop = MeshBuilder.CreateBox(`f_trk_${sIdx}`, { width: trackWidth, height: trackH, depth: trackLen }, this.scene);
      loop.position.set(xSide, 0.13, 0);
      applyMeshColor(loop, 0.09, 0.09, 0.10);
      parts.push(loop);

      const skirt = MeshBuilder.CreateBox(`f_skirt_${sIdx}`, { width: trackWidth * 1.05, height: 0.05, depth: 0.96 }, this.scene);
      skirt.position.set(xSide, 0.25, 0);
      applyBoxDirectionalColor6(skirt, [0.85, 0.62, 0.16], isLeft ? [1.0, 0.85, 0.45] : [0.48, 0.32, 0.08], [0.90, 0.68, 0.22], isLeft ? [0.38, 0.24, 0.06] : [0.20, 0.12, 0.03], [0.22, 0.14, 0.04], [0.04, 0.02, 0.01]);
      parts.push(skirt);

      for (let w = 0; w < 3; w++) {
        const wz = -0.38 + w * 0.38;
        const whl = MeshBuilder.CreateCylinder(`f_whl_${sIdx}_${w}`, { diameter: 0.17, height: 0.03, tessellation: 8 }, this.scene);
        whl.rotation.z = Math.PI / 2;
        whl.position.set(xSide > 0 ? xSide + 0.08 : xSide - 0.08, 0.12, wz);
        applyMeshColor(whl, 0.50, 0.44, 0.32);
        parts.push(whl);
      }
    });

    // Raked rear cooling vents
    const louverBay = MeshBuilder.CreateBox('f_louverBay', { width: 0.44, height: 0.03, depth: 0.26 }, this.scene);
    louverBay.position.set(0, 0.26, -0.42);
    applyMeshColor(louverBay, 0.04, 0.03, 0.02);
    parts.push(louverBay);

    for (let s = 0; s < 4; s++) {
      const slatZ = -0.32 - s * 0.05;
      const slat = MeshBuilder.CreateBox(`f_slat_${s}`, { width: 0.40, height: 0.02, depth: 0.025 }, this.scene);
      slat.position.set(0, 0.28, slatZ);
      applyBoxDirectionalColor6(slat, [0.95, 0.78, 0.38], [0.85, 0.65, 0.28], [0.75, 0.55, 0.20], [0.35, 0.22, 0.07], [0.06, 0.04, 0.01], [0.02, 0.01, 0.01]);
      parts.push(slat);
    }

    [-0.28, 0.28].forEach((lx, lIdx) => {
      const l = MeshBuilder.CreateBox(`f_lamp_${lIdx}`, { width: 0.07, height: 0.04, depth: 0.05 }, this.scene);
      l.position.set(lx, 0.24, 0.56);
      applyMeshColor(l, 1.0, 0.85, 0.0);
      parts.push(l);
    });

    this.fastChassisMaster = Mesh.MergeMeshes(parts, true, true, undefined, false, false) as Mesh;
    this.fastChassisMaster.material = mats.enemyHull;
    this.fastChassisMaster.useVertexColors = true;
    this.fastChassisMaster.name = 'fastChassisMaster';
    this.fastChassisMaster.setEnabled(false);
    this.fastChassisMaster.isPickable = false;

    // --- 3.2 Fast Turret Master ---
    const tParts: Mesh[] = [];

    const tRing = MeshBuilder.CreateCylinder('f_tRing', { diameter: 0.52, height: 0.04, tessellation: 10 }, this.scene);
    tRing.position.y = 0.02;
    applyMeshColor(tRing, 0.12, 0.10, 0.06);
    tParts.push(tRing);

    const tBody = MeshBuilder.CreateBox('f_tBody', { width: 0.52, height: 0.11, depth: 0.62 }, this.scene);
    tBody.position.set(0, 0.09, -0.02);
    applyBoxDirectionalColor6(tBody, [0.88, 0.65, 0.18], [0.98, 0.82, 0.40], [0.92, 0.70, 0.24], [0.38, 0.24, 0.06], [0.22, 0.14, 0.04], [0.05, 0.03, 0.01]);
    tParts.push(tBody);

    const tRoof = MeshBuilder.CreateBox('f_tRoof', { width: 0.46, height: 0.07, depth: 0.54 }, this.scene);
    tRoof.position.set(0, 0.16, -0.02);
    applyBoxDirectionalColor6(tRoof, [0.92, 0.70, 0.22], [1.0, 0.88, 0.50], [0.95, 0.75, 0.28], [0.42, 0.28, 0.08], [0.25, 0.16, 0.05], [0.06, 0.04, 0.01]);
    tParts.push(tRoof);

    const mantlet = MeshBuilder.CreateBox('f_mantlet', { width: 0.30, height: 0.12, depth: 0.12 }, this.scene);
    mantlet.position.set(0, 0.12, 0.32);
    applyBoxDirectionalColor6(mantlet, [0.95, 0.78, 0.40], [0.82, 0.62, 0.28], [0.75, 0.52, 0.20], [0.32, 0.20, 0.06], [0.08, 0.05, 0.02], [0.04, 0.02, 0.01]);
    tParts.push(mantlet);

    const visor = MeshBuilder.CreateBox('f_visor', { width: 0.24, height: 0.04, depth: 0.03 }, this.scene);
    visor.position.set(0, 0.14, 0.33);
    applyMeshColor(visor, 1.0, 0.85, 0.0);
    tParts.push(visor);

    this.fastTurretMaster = Mesh.MergeMeshes(tParts, true, true, undefined, false, false) as Mesh;
    this.fastTurretMaster.material = mats.enemyHull;
    this.fastTurretMaster.useVertexColors = true;
    this.fastTurretMaster.name = 'fastTurretMaster';
    this.fastTurretMaster.setEnabled(false);
    this.fastTurretMaster.isPickable = false;

    // --- 3.3 Fast Cannon Master ---
    const cParts: Mesh[] = [];

    const barrel = MeshBuilder.CreateCylinder('f_cBarrel', { diameter: 0.08, height: 0.70, tessellation: 8 }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.08, 0.58);
    applyCylinderZLight(barrel, [0.72, 0.65, 0.50], [0.48, 0.42, 0.32], [0.14, 0.12, 0.08], [0.30, 0.25, 0.18]);
    cParts.push(barrel);

    const muzzle = MeshBuilder.CreateCylinder('f_cMuzzle', { diameter: 0.12, height: 0.10, tessellation: 8 }, this.scene);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.08, 0.88);
    applyCylinderZLight(muzzle, [0.65, 0.55, 0.40], [0.40, 0.32, 0.22], [0.12, 0.09, 0.06], [0.25, 0.20, 0.14]);
    cParts.push(muzzle);

    const tipRing = MeshBuilder.CreateCylinder('f_cTipRing', { diameter: 0.09, height: 0.02, tessellation: 8 }, this.scene);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.set(0, 0.08, 0.94);
    applyMeshColor(tipRing, 1.0, 0.75, 0.10); // golden thermal tip
    cParts.push(tipRing);

    this.fastCannonMaster = Mesh.MergeMeshes(cParts, true, true, undefined, false, false) as Mesh;
    this.fastCannonMaster.material = mats.enemyMetal;
    this.fastCannonMaster.useVertexColors = true;
    this.fastCannonMaster.name = 'fastCannonMaster';
    this.fastCannonMaster.setEnabled(false);
    this.fastCannonMaster.isPickable = false;
  }

  // =========================================================================
  // 4. ARMOR ENEMY MASTER FAMILY (Heavy Crimson/Ruby Siege Fortress)
  // =========================================================================
  private buildArmorMasters(mats: TankMaterials): void {
    // --- 4.1 Armor Chassis Master ---
    const parts: Mesh[] = [];

    const under = MeshBuilder.CreateBox('a_under', { width: 0.98, height: 0.22, depth: 1.34 }, this.scene);
    under.position.y = 0.16;
    applyBoxDirectionalColor6(under, [0.12, 0.08, 0.08], [0.08, 0.05, 0.05], [0.10, 0.06, 0.06], [0.05, 0.03, 0.03], [0.04, 0.02, 0.02], [0.02, 0.01, 0.01]);
    parts.push(under);

    const frontArmor = MeshBuilder.CreateBox('a_front', { width: 0.92, height: 0.18, depth: 0.32 }, this.scene);
    frontArmor.position.set(0, 0.25, 0.52);
    applyBoxDirectionalColor6(frontArmor, [0.72, 0.22, 0.15], [0.88, 0.38, 0.28], [0.82, 0.28, 0.20], [0.28, 0.08, 0.05], [0.18, 0.05, 0.03], [0.04, 0.01, 0.01]);
    parts.push(frontArmor);

    const deck = MeshBuilder.CreateBox('a_deck', { width: 0.88, height: 0.14, depth: 0.86 }, this.scene);
    deck.position.set(0, 0.32, -0.06);
    applyBoxDirectionalColor6(deck, [0.62, 0.18, 0.12], [0.82, 0.32, 0.22], [0.70, 0.22, 0.15], [0.22, 0.05, 0.03], [0.14, 0.03, 0.02], [0.03, 0.01, 0.01]);
    parts.push(deck);

    // Heavy Track Sponsons & Full Skirts
    const trackWidth = 0.26;
    const trackH = 0.30;
    const trackLen = 1.36;
    const trackX = 0.54;

    [-trackX, trackX].forEach((xSide, sIdx) => {
      const isLeft = xSide < 0;

      const loop = MeshBuilder.CreateBox(`a_trk_${sIdx}`, { width: trackWidth, height: trackH, depth: trackLen }, this.scene);
      loop.position.set(xSide, 0.17, 0);
      applyMeshColor(loop, 0.07, 0.06, 0.07);
      parts.push(loop);

      const skirt = MeshBuilder.CreateBox(`a_skirt_${sIdx}`, { width: 0.08, height: 0.26, depth: trackLen * 0.98 }, this.scene);
      skirt.position.set(xSide > 0 ? xSide + 0.12 : xSide - 0.12, 0.20, 0);
      applyBoxDirectionalColor6(skirt, [0.60, 0.16, 0.10], isLeft ? [0.85, 0.35, 0.24] : [0.32, 0.08, 0.05], [0.68, 0.20, 0.14], isLeft ? [0.24, 0.06, 0.04] : [0.12, 0.03, 0.02], [0.15, 0.04, 0.02], [0.03, 0.01, 0.01]);
      parts.push(skirt);

      for (let w = 0; w < 5; w++) {
        const wz = -0.48 + w * 0.24;
        const whl = MeshBuilder.CreateCylinder(`a_whl_${sIdx}_${w}`, { diameter: 0.22, height: 0.04, tessellation: 8 }, this.scene);
        whl.rotation.z = Math.PI / 2;
        whl.position.set(xSide > 0 ? xSide + 0.09 : xSide - 0.09, 0.15, wz);
        applyMeshColor(whl, 0.38, 0.32, 0.30);
        parts.push(whl);
      }
    });

    // Heavy Power Pack Block with thick radiator louvers
    const powerPack = MeshBuilder.CreateBox('a_power', { width: 0.64, height: 0.16, depth: 0.32 }, this.scene);
    powerPack.position.set(0, 0.36, -0.48);
    applyBoxDirectionalColor6(powerPack, [0.45, 0.14, 0.10], [0.65, 0.24, 0.16], [0.52, 0.18, 0.12], [0.20, 0.06, 0.04], [0.12, 0.03, 0.02], [0.03, 0.01, 0.01]);
    parts.push(powerPack);

    // 4 thick radiator slats on power pack
    for (let s = 0; s < 4; s++) {
      const slatZ = -0.38 - s * 0.06;
      const slat = MeshBuilder.CreateBox(`a_slat_${s}`, { width: 0.56, height: 0.03, depth: 0.035 }, this.scene);
      slat.position.set(0, 0.45, slatZ);
      applyBoxDirectionalColor6(slat, [0.75, 0.30, 0.20], [0.65, 0.24, 0.15], [0.55, 0.18, 0.12], [0.22, 0.07, 0.04], [0.05, 0.02, 0.01], [0.02, 0.01, 0.01]);
      parts.push(slat);
    }

    [-0.38, 0.38].forEach((lx, lIdx) => {
      const l = MeshBuilder.CreateBox(`a_lamp_${lIdx}`, { width: 0.09, height: 0.05, depth: 0.06 }, this.scene);
      l.position.set(lx, 0.30, 0.62);
      applyMeshColor(l, 1.0, 0.20, 0.06);
      parts.push(l);
    });

    this.armorChassisMaster = Mesh.MergeMeshes(parts, true, true, undefined, false, false) as Mesh;
    this.armorChassisMaster.material = mats.enemyHull;
    this.armorChassisMaster.useVertexColors = true;
    this.armorChassisMaster.name = 'armorChassisMaster';
    this.armorChassisMaster.setEnabled(false);
    this.armorChassisMaster.isPickable = false;

    // --- 4.2 Armor Turret Master ---
    const tParts: Mesh[] = [];

    const tRing = MeshBuilder.CreateCylinder('a_tRing', { diameter: 0.72, height: 0.06, tessellation: 14 }, this.scene);
    tRing.position.y = 0.03;
    applyMeshColor(tRing, 0.07, 0.06, 0.07);
    tParts.push(tRing);

    const tBody = MeshBuilder.CreateBox('a_tBody', { width: 0.76, height: 0.13, depth: 0.82 }, this.scene);
    tBody.position.set(0, 0.10, -0.04);
    applyBoxDirectionalColor6(tBody, [0.62, 0.18, 0.12], [0.82, 0.32, 0.22], [0.70, 0.22, 0.15], [0.22, 0.05, 0.03], [0.14, 0.03, 0.02], [0.03, 0.01, 0.01]);
    tParts.push(tBody);

    const tRoof = MeshBuilder.CreateBox('a_tRoof', { width: 0.66, height: 0.09, depth: 0.72 }, this.scene);
    tRoof.position.set(0, 0.19, -0.04);
    applyBoxDirectionalColor6(tRoof, [0.68, 0.22, 0.15], [0.90, 0.40, 0.28], [0.78, 0.28, 0.18], [0.26, 0.07, 0.04], [0.16, 0.04, 0.02], [0.04, 0.01, 0.01]);
    tParts.push(tRoof);

    const cupola = MeshBuilder.CreateBox('a_cupola', { width: 0.28, height: 0.06, depth: 0.28 }, this.scene);
    cupola.position.set(-0.16, 0.26, -0.12);
    applyBoxDirectionalColor6(cupola, [0.75, 0.28, 0.20], [0.92, 0.45, 0.32], [0.80, 0.32, 0.22], [0.30, 0.09, 0.06], [0.18, 0.05, 0.03], [0.05, 0.02, 0.01]);
    tParts.push(cupola);

    const mantlet = MeshBuilder.CreateBox('a_mantlet', { width: 0.44, height: 0.18, depth: 0.14 }, this.scene);
    mantlet.position.set(0, 0.13, 0.36);
    applyBoxDirectionalColor6(mantlet, [0.72, 0.38, 0.28], [0.55, 0.26, 0.18], [0.45, 0.20, 0.14], [0.20, 0.07, 0.04], [0.07, 0.03, 0.02], [0.03, 0.01, 0.01]);
    tParts.push(mantlet);

    const visor = MeshBuilder.CreateBox('a_visor', { width: 0.32, height: 0.04, depth: 0.04 }, this.scene);
    visor.position.set(0, 0.17, 0.38);
    applyMeshColor(visor, 1.0, 0.18, 0.18);
    tParts.push(visor);

    this.armorTurretMaster = Mesh.MergeMeshes(tParts, true, true, undefined, false, false) as Mesh;
    this.armorTurretMaster.material = mats.enemyHull;
    this.armorTurretMaster.useVertexColors = true;
    this.armorTurretMaster.name = 'armorTurretMaster';
    this.armorTurretMaster.setEnabled(false);
    this.armorTurretMaster.isPickable = false;

    // --- 4.3 Armor Cannon Master ---
    const cParts: Mesh[] = [];

    const barrel = MeshBuilder.CreateCylinder('a_cBarrel', { diameter: 0.15, height: 0.58, tessellation: 10 }, this.scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.09, 0.52);
    applyCylinderZLight(barrel, [0.60, 0.52, 0.46], [0.40, 0.34, 0.28], [0.12, 0.10, 0.08], [0.26, 0.22, 0.18]);
    cParts.push(barrel);

    const brake = MeshBuilder.CreateBox('a_cBrake', { width: 0.24, height: 0.18, depth: 0.16 }, this.scene);
    brake.position.set(0, 0.09, 0.86);
    applyBoxDirectionalColor6(brake, [0.58, 0.48, 0.40], [0.44, 0.35, 0.28], [0.35, 0.26, 0.20], [0.18, 0.12, 0.08], [0.10, 0.06, 0.04], [0.06, 0.04, 0.03]);
    cParts.push(brake);

    const tipRing = MeshBuilder.CreateCylinder('a_cTipRing', { diameter: 0.14, height: 0.02, tessellation: 8 }, this.scene);
    tipRing.rotation.x = Math.PI / 2;
    tipRing.position.set(0, 0.09, 0.94);
    applyMeshColor(tipRing, 1.0, 0.30, 0.10); // crimson thermal tip
    cParts.push(tipRing);

    this.armorCannonMaster = Mesh.MergeMeshes(cParts, true, true, undefined, false, false) as Mesh;
    this.armorCannonMaster.material = mats.enemyMetal;
    this.armorCannonMaster.useVertexColors = true;
    this.armorCannonMaster.name = 'armorCannonMaster';
    this.armorCannonMaster.setEnabled(false);
    this.armorCannonMaster.isPickable = false;
  }

  public dispose(): void {
    const masters = [
      this.playerChassisMaster,
      this.playerTurretMaster,
      this.playerCannonMaster,
      this.standardChassisMaster,
      this.standardTurretMaster,
      this.standardCannonMaster,
      this.fastChassisMaster,
      this.fastTurretMaster,
      this.fastCannonMaster,
      this.armorChassisMaster,
      this.armorTurretMaster,
      this.armorCannonMaster,
    ];

    masters.forEach((m) => {
      if (m) m.dispose();
    });

    this.playerChassisMaster = undefined;
    this.playerTurretMaster = undefined;
    this.playerCannonMaster = undefined;
    this.standardChassisMaster = undefined;
    this.standardTurretMaster = undefined;
    this.standardCannonMaster = undefined;
    this.fastChassisMaster = undefined;
    this.fastTurretMaster = undefined;
    this.fastCannonMaster = undefined;
    this.armorChassisMaster = undefined;
    this.armorTurretMaster = undefined;
    this.armorCannonMaster = undefined;

    this.isInitialized = false;
    TankAssetLibrary.instance = null;
  }
}
