import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  PBRMaterial,
  Color3,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Mesh,
  InstancedMesh,
  LinesMesh
} from '@babylonjs/core';
import {
  ARENA_WIDTH,
  ARENA_DEPTH,
  BORDER_HEIGHT,
  BORDER_THICKNESS
} from '../game/constants';
import { StagePresentationConfig } from '../stages/StageDefinition';
import { MaterialLibrary } from '../visual/MaterialLibrary';
import { EnvironmentAssetLibrary } from '../visual/EnvironmentAssetLibrary';

export class Arena {
  private scene: Scene;
  private meshes: (Mesh | InstancedMesh)[] = [];
  private materials: (StandardMaterial | PBRMaterial)[] = [];
  private keyLight!: DirectionalLight;

  // Tracked materials for dynamic stage presentation styling
  private floorMat!: PBRMaterial;
  private borderMat!: PBRMaterial;
  private blueTrimMat!: StandardMaterial;
  private orangeTrimMat!: StandardMaterial;

  // Single shared LineSystem mesh for decorative relay energy lines (0 collision, 1 draw call)
  private nexusRelayLines: LinesMesh | null = null;
  private currentPresentation?: StagePresentationConfig;
  private pulseTimer: number = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupLighting();
    this.buildFloor();
    this.buildBorders();
  }

  public getKeyLight(): DirectionalLight {
    return this.keyLight;
  }

  /**
   * Sets up balanced ambient and directional lights with subtle blue/orange rim accents.
   * Calibrated for PBR materials ensuring non-black metallic response without HDR maps.
   */
  private setupLighting(): void {
    // Ambient hemispheric fill (balanced cool ambient preventing black-metal artifacts)
    const hemiLight = new HemisphericLight(
      'hemiLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 0.28;
    hemiLight.diffuse = new Color3(0.85, 0.90, 1.0);
    hemiLight.groundColor = new Color3(0.06, 0.07, 0.10);

    // Primary directional key light: angled from top-left (-X, +Z) shining towards bottom-right (+X, -Z)
    this.keyLight = new DirectionalLight(
      'keyLight',
      new Vector3(0.55, -0.80, -0.45).normalize(),
      this.scene
    );
    this.keyLight.position = new Vector3(-20, 35, 20);
    this.keyLight.intensity = 1.75;
    this.keyLight.diffuse = new Color3(1.0, 0.98, 0.95);

    // Stable orthographic shadow bounds covering the entire arena with directional drop shadows
    this.keyLight.autoUpdateExtends = false;
    this.keyLight.autoCalcShadowZBounds = false;
    this.keyLight.orthoLeft = -22;
    this.keyLight.orthoRight = 22;
    this.keyLight.orthoTop = 22;
    this.keyLight.orthoBottom = -22;
    this.keyLight.shadowMinZ = 1;
    this.keyLight.shadowMaxZ = 85;

    // Subtle blue rim accent light from south (player sector)
    const rimBlue = new DirectionalLight(
      'rimBlue',
      new Vector3(0, -0.4, 1.0).normalize(),
      this.scene
    );
    rimBlue.intensity = 0.18;
    rimBlue.diffuse = new Color3(0.0, 0.75, 1.0);

    // Subtle orange rim accent light from north (enemy sector)
    const rimOrange = new DirectionalLight(
      'rimOrange',
      new Vector3(0, -0.4, -1.0).normalize(),
      this.scene
    );
    rimOrange.intensity = 0.18;
    rimOrange.diffuse = new Color3(1.0, 0.45, 0.0);
  }

  /**
   * Builds the industrial PBR arena floor with procedural panel divisions and seam channels.
   */
  private buildFloor(): void {
    const matLib = MaterialLibrary.getInstance(this.scene);
    this.floorMat = matLib.getMaterial('floor');

    const floor = MeshBuilder.CreateGround(
      'arenaFloor',
      {
        width: ARENA_WIDTH,
        height: ARENA_DEPTH,
        subdivisions: 2
      },
      this.scene
    );
    floor.position = new Vector3(0, 0, 0);
    floor.material = this.floorMat;
    floor.receiveShadows = true;

    this.meshes.push(floor);

    // Subtle dark inset perimeter channel framing the playable field at y = -0.005 (zero z-fighting)
    const floorChannel = MeshBuilder.CreateGround(
      'arenaFloorChannel',
      {
        width: ARENA_WIDTH + 0.4,
        height: ARENA_DEPTH + 0.4,
        subdivisions: 1,
      },
      this.scene
    );
    floorChannel.position = new Vector3(0, -0.005, 0);
    floorChannel.material = matLib.getMaterial('floorInset');
    floorChannel.isPickable = false;
    this.meshes.push(floorChannel);
  }

  /**
   * Builds modular in-world perimeter hardware bounding the playable combat area.
   * Utilizes hardware-instanced master wall segments, structural columns, and corner towers.
   */
  private buildBorders(): void {
    const matLib = MaterialLibrary.getInstance(this.scene);
    const envLib = EnvironmentAssetLibrary.getInstance(this.scene);
    this.borderMat = matLib.getMaterial('perimeterArmor');

    // Trim accent materials for team sector lighting
    this.blueTrimMat = new StandardMaterial('blueTrimMat', this.scene);
    this.blueTrimMat.diffuseColor = new Color3(0.0, 0.8, 1.0);
    this.blueTrimMat.emissiveColor = new Color3(0.0, 0.4, 0.6);
    this.materials.push(this.blueTrimMat);

    const orangeTrimMat = new StandardMaterial('orangeTrimMat', this.scene);
    orangeTrimMat.diffuseColor = new Color3(1.0, 0.45, 0.0);
    orangeTrimMat.emissiveColor = new Color3(0.5, 0.2, 0.0);
    this.orangeTrimMat = orangeTrimMat;
    this.materials.push(orangeTrimMat);

    const halfW = ARENA_WIDTH / 2; // 13
    const halfD = ARENA_DEPTH / 2; // 13
    const halfT = BORDER_THICKNESS / 2; // 1
    const wallZ = halfD + halfT; // 14
    const wallX = halfW + halfT; // 14

    const masterWall = envLib.getMasterPerimeterWall();
    const masterCol = envLib.getMasterPerimeterColumn();
    const masterCorner = envLib.getMasterCornerHousing();

    // 1. North & South perimeter walls (along X axis, offset 2m segments from x = -12 to +12)
    const wallCoords = [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12];
    wallCoords.forEach((x) => {
      // North segment
      const nInst = masterWall.createInstance(`periWall_n_${x}`);
      nInst.position.set(x, BORDER_HEIGHT / 2, wallZ);
      nInst.isPickable = false;
      this.meshes.push(nInst);

      // South segment
      const sInst = masterWall.createInstance(`periWall_s_${x}`);
      sInst.position.set(x, BORDER_HEIGHT / 2, -wallZ);
      sInst.rotation.y = Math.PI;
      sInst.isPickable = false;
      this.meshes.push(sInst);
    });

    // 2. East & West perimeter walls (along Z axis)
    wallCoords.forEach((z) => {
      // East segment
      const eInst = masterWall.createInstance(`periWall_e_${z}`);
      eInst.position.set(wallX, BORDER_HEIGHT / 2, z);
      eInst.rotation.y = -Math.PI / 2;
      eInst.isPickable = false;
      this.meshes.push(eInst);

      // West segment
      const wInst = masterWall.createInstance(`periWall_w_${z}`);
      wInst.position.set(-wallX, BORDER_HEIGHT / 2, z);
      wInst.rotation.y = Math.PI / 2;
      wInst.isPickable = false;
      this.meshes.push(wInst);
    });

    // 3. Structural joint columns (reinforcing midpoints)
    const colCoords = [-6, 6];
    colCoords.forEach((c) => {
      const colN = masterCol.createInstance(`periCol_n_${c}`);
      colN.position.set(c, BORDER_HEIGHT / 2, wallZ);
      colN.isPickable = false;
      this.meshes.push(colN);

      const colS = masterCol.createInstance(`periCol_s_${c}`);
      colS.position.set(c, BORDER_HEIGHT / 2, -wallZ);
      colS.isPickable = false;
      this.meshes.push(colS);

      const colE = masterCol.createInstance(`periCol_e_${c}`);
      colE.position.set(wallX, BORDER_HEIGHT / 2, c);
      colE.isPickable = false;
      this.meshes.push(colE);

      const colW = masterCol.createInstance(`periCol_w_${c}`);
      colW.position.set(-wallX, BORDER_HEIGHT / 2, c);
      colW.isPickable = false;
      this.meshes.push(colW);
    });

    // 4. Four corner fortification towers
    const cornerPositions = [
      [-wallX, wallZ],
      [wallX, wallZ],
      [-wallX, -wallZ],
      [wallX, -wallZ]
    ];
    cornerPositions.forEach(([cx, cz], idx) => {
      const corner = masterCorner.createInstance(`periCorner_${idx}`);
      corner.position.set(cx, (BORDER_HEIGHT * 1.35) / 2, cz);
      corner.isPickable = false;
      this.meshes.push(corner);
    });

    // 5. Glowing indicator trims (North = Orange/Enemy sector, South = Blue/Player sector)
    const northTrim = MeshBuilder.CreateBox(
      'northBorder_trim',
      { width: (ARENA_WIDTH + BORDER_THICKNESS * 2) * 0.98, depth: BORDER_THICKNESS * 0.35, height: 0.1 },
      this.scene
    );
    northTrim.position = new Vector3(0, BORDER_HEIGHT + 0.05, wallZ);
    northTrim.material = this.orangeTrimMat;
    northTrim.isPickable = false;
    this.meshes.push(northTrim);

    const southTrim = MeshBuilder.CreateBox(
      'southBorder_trim',
      { width: (ARENA_WIDTH + BORDER_THICKNESS * 2) * 0.98, depth: BORDER_THICKNESS * 0.35, height: 0.1 },
      this.scene
    );
    southTrim.position = new Vector3(0, BORDER_HEIGHT + 0.05, -wallZ);
    southTrim.material = this.blueTrimMat;
    southTrim.isPickable = false;
    this.meshes.push(southTrim);
  }

  /**
   * Applies data-driven stage presentation configuration.
   * Activates Nexus high-security relay theme or restores baseline presentation.
   */
  public applyPresentation(presentation?: StagePresentationConfig, reducedMotion: boolean = false): void {
    this.currentPresentation = presentation;
    this.pulseTimer = 0;

    if (presentation?.floorTheme === 'NEXUS') {
      // 1. Dark gunmetal / graphite foundation with subtle blue emissive sheen
      this.floorMat.albedoColor = new Color3(0.045, 0.052, 0.068);
      this.floorMat.emissiveColor = new Color3(0.015, 0.025, 0.04);

      // 2. High-contrast futuristic cyber border trims
      // Player / South sector: Cold cyan
      this.blueTrimMat.diffuseColor = new Color3(0.0, 0.85, 1.0);
      this.blueTrimMat.emissiveColor = new Color3(0.0, 0.45, 0.65);

      // Enemy / North sector: Electric violet / amber hazard
      this.orangeTrimMat.diffuseColor = new Color3(0.48, 0.17, 0.75);
      this.orangeTrimMat.emissiveColor = new Color3(0.28, 0.08, 0.45);

      if (reducedMotion) {
        this.blueTrimMat.emissiveColor.set(0.0, 0.40, 0.60);
        this.orangeTrimMat.emissiveColor.set(0.28, 0.08, 0.45);
      }

      // 3. Build single-mesh decorative relay energy lines if not already built
      if (!this.nexusRelayLines) {
        const lines: Vector3[][] = [
          // Outer perimeter conduit loop
          [
            new Vector3(-12.2, 0.02, -12.2),
            new Vector3(12.2, 0.02, -12.2),
            new Vector3(12.2, 0.02, 12.2),
            new Vector3(-12.2, 0.02, 12.2),
            new Vector3(-12.2, 0.02, -12.2),
          ],
          // Sub-relay perimeter trace
          [
            new Vector3(-10.8, 0.02, -10.8),
            new Vector3(10.8, 0.02, -10.8),
            new Vector3(10.8, 0.02, 10.8),
            new Vector3(-10.8, 0.02, 10.8),
            new Vector3(-10.8, 0.02, -10.8),
          ],
          // Perimeter feed-in segments
          [new Vector3(-12.2, 0.02, 0), new Vector3(-10.8, 0.02, 0)],
          [new Vector3(10.8, 0.02, 0), new Vector3(12.2, 0.02, 0)],
          [new Vector3(0, 0.02, -12.2), new Vector3(0, 0.02, -10.8)],
          [new Vector3(0, 0.02, 10.8), new Vector3(0, 0.02, 12.2)],
          // Sector corner diagonal brackets
          [new Vector3(-11.5, 0.02, -12.2), new Vector3(-12.2, 0.02, -11.5)],
          [new Vector3(11.5, 0.02, -12.2), new Vector3(12.2, 0.02, -11.5)],
          [new Vector3(-11.5, 0.02, 12.2), new Vector3(-12.2, 0.02, 11.5)],
          [new Vector3(11.5, 0.02, 12.2), new Vector3(12.2, 0.02, 11.5)],
        ];

        this.nexusRelayLines = MeshBuilder.CreateLineSystem('nexusRelayLines', { lines }, this.scene);
        this.nexusRelayLines.color = new Color3(0.0, 0.90, 1.0);
        this.nexusRelayLines.isPickable = false;
        this.meshes.push(this.nexusRelayLines);
      }
    } else {
      // Restore baseline presentation (Stages 01–03, or New Campaign reset)
      if (this.nexusRelayLines) {
        const idx = this.meshes.indexOf(this.nexusRelayLines);
        if (idx !== -1) {
          this.meshes.splice(idx, 1);
        }
        this.nexusRelayLines.dispose();
        this.nexusRelayLines = null;
      }

      this.floorMat.albedoColor.set(1.0, 1.0, 1.0);
      this.floorMat.emissiveColor.set(0.0, 0.0, 0.0);

      this.borderMat.albedoColor.set(0.18, 0.22, 0.28);

      this.blueTrimMat.diffuseColor = new Color3(0.0, 0.8, 1.0);
      this.blueTrimMat.emissiveColor = new Color3(0.0, 0.4, 0.6);

      this.orangeTrimMat.diffuseColor = new Color3(1.0, 0.45, 0.0);
      this.orangeTrimMat.emissiveColor = new Color3(0.5, 0.2, 0.0);
    }
  }

  /**
   * Per-frame presentation update. Modulates ambient relay pulse softly.
   * Zero allocations: updates only scalar fields on existing Color3 instances.
   */
  public update(deltaTime: number, reducedMotion: boolean = false): void {
    if (!this.currentPresentation?.pulseEnabled) return;

    if (reducedMotion) {
      // Clamped static resting intensity in reduced-motion mode
      this.blueTrimMat.emissiveColor.set(0.0, 0.40, 0.60);
      this.orangeTrimMat.emissiveColor.set(0.28, 0.08, 0.45);
      return;
    }

    this.pulseTimer += deltaTime;
    const rate = this.currentPresentation.pulseRate ?? 2.2;
    const pulse = 0.5 + 0.5 * Math.sin((this.pulseTimer * 2 * Math.PI) / rate);

    // Subtle sinusoidal modulation (no aggressive flashing)
    this.blueTrimMat.emissiveColor.set(0.0, 0.35 + 0.18 * pulse, 0.55 + 0.25 * pulse);
    this.orangeTrimMat.emissiveColor.set(0.24 + 0.12 * pulse, 0.06 + 0.04 * pulse, 0.38 + 0.18 * pulse);
  }

  /**
   * Cleans up all Babylon meshes and materials created for the arena.
   */
  public dispose(): void {
    if (this.nexusRelayLines) {
      this.nexusRelayLines.dispose();
      this.nexusRelayLines = null;
    }
    this.meshes.forEach((mesh) => mesh.dispose());
    this.materials.forEach((mat) => mat.dispose());
    this.meshes = [];
    this.materials = [];
  }
}
