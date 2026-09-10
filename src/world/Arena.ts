import {
  Scene,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  Mesh,
  LinesMesh
} from '@babylonjs/core';
import {
  ARENA_WIDTH,
  ARENA_DEPTH,
  BORDER_HEIGHT,
  BORDER_THICKNESS
} from '../game/constants';
import { StagePresentationConfig } from '../stages/StageDefinition';

export class Arena {
  private scene: Scene;
  private meshes: Mesh[] = [];
  private materials: StandardMaterial[] = [];
  private keyLight!: DirectionalLight;

  // Tracked materials for dynamic stage presentation styling
  private floorMat!: StandardMaterial;
  private borderMat!: StandardMaterial;
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
   */
  private setupLighting(): void {
    // Ambient hemispheric fill (subtle cool ambient from above)
    const hemiLight = new HemisphericLight(
      'hemiLight',
      new Vector3(0, 1, 0),
      this.scene
    );
    hemiLight.intensity = 0.65;
    hemiLight.diffuse = new Color3(0.85, 0.9, 1.0);
    hemiLight.groundColor = new Color3(0.12, 0.14, 0.18);

    // Primary directional key light casting crisp angles
    this.keyLight = new DirectionalLight(
      'keyLight',
      new Vector3(-0.4, -0.85, 0.35).normalize(),
      this.scene
    );
    this.keyLight.position = new Vector3(15, 30, -15);
    this.keyLight.intensity = 0.85;
    this.keyLight.diffuse = new Color3(1.0, 0.98, 0.92);

    // Subtle blue rim accent light from south (player sector)
    const rimBlue = new DirectionalLight(
      'rimBlue',
      new Vector3(0, -0.4, 1.0).normalize(),
      this.scene
    );
    rimBlue.intensity = 0.35;
    rimBlue.diffuse = new Color3(0.0, 0.75, 1.0);

    // Subtle orange rim accent light from north (enemy sector)
    const rimOrange = new DirectionalLight(
      'rimOrange',
      new Vector3(0, -0.4, -1.0).normalize(),
      this.scene
    );
    rimOrange.intensity = 0.35;
    rimOrange.diffuse = new Color3(1.0, 0.45, 0.0);
  }

  /**
   * Builds the dark graphite arena floor with subtle grid subdivision markings.
   */
  private buildFloor(): void {
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

    const floorMat = new StandardMaterial('arenaFloorMat', this.scene);
    floorMat.diffuseColor = new Color3(0.07, 0.08, 0.11);
    floorMat.specularColor = new Color3(0.15, 0.17, 0.22);
    floorMat.specularPower = 32;

    floor.material = floorMat;
    floor.receiveShadows = true;

    this.floorMat = floorMat;
    this.materials.push(floorMat);
    this.meshes.push(floor);
  }

  /**
   * Builds metallic modular borders bounding the playable combat area.
   */
  private buildBorders(): void {
    const borderMat = new StandardMaterial('borderMat', this.scene);
    borderMat.diffuseColor = new Color3(0.14, 0.17, 0.22);
    borderMat.specularColor = new Color3(0.3, 0.35, 0.42);
    borderMat.specularPower = 64;
    this.borderMat = borderMat;
    this.materials.push(borderMat);

    // Trim accent materials
    const blueTrimMat = new StandardMaterial('blueTrimMat', this.scene);
    blueTrimMat.diffuseColor = new Color3(0.0, 0.8, 1.0);
    blueTrimMat.emissiveColor = new Color3(0.0, 0.4, 0.6);
    this.blueTrimMat = blueTrimMat;
    this.materials.push(blueTrimMat);

    const orangeTrimMat = new StandardMaterial('orangeTrimMat', this.scene);
    orangeTrimMat.diffuseColor = new Color3(1.0, 0.45, 0.0);
    orangeTrimMat.emissiveColor = new Color3(0.5, 0.2, 0.0);
    this.orangeTrimMat = orangeTrimMat;
    this.materials.push(orangeTrimMat);

    const halfW = ARENA_WIDTH / 2;
    const halfD = ARENA_DEPTH / 2;
    const halfT = BORDER_THICKNESS / 2;

    // Outer border specifications: [name, width, depth, posX, posZ, trimMat]
    const borderConfigs = [
      {
        name: 'northBorder',
        w: ARENA_WIDTH + BORDER_THICKNESS * 2,
        d: BORDER_THICKNESS,
        x: 0,
        z: halfD + halfT,
        trim: orangeTrimMat
      },
      {
        name: 'southBorder',
        w: ARENA_WIDTH + BORDER_THICKNESS * 2,
        d: BORDER_THICKNESS,
        x: 0,
        z: -(halfD + halfT),
        trim: blueTrimMat
      },
      {
        name: 'westBorder',
        w: BORDER_THICKNESS,
        d: ARENA_DEPTH,
        x: -(halfW + halfT),
        z: 0,
        trim: borderMat
      },
      {
        name: 'eastBorder',
        w: BORDER_THICKNESS,
        d: ARENA_DEPTH,
        x: halfW + halfT,
        z: 0,
        trim: borderMat
      }
    ];

    borderConfigs.forEach((cfg) => {
      // Main border wall
      const wall = MeshBuilder.CreateBox(
        cfg.name,
        {
          width: cfg.w,
          depth: cfg.d,
          height: BORDER_HEIGHT
        },
        this.scene
      );
      wall.position = new Vector3(cfg.x, BORDER_HEIGHT / 2, cfg.z);
      wall.material = borderMat;
      this.meshes.push(wall);

      // Top glowing indicator strip for futuristic look
      const trim = MeshBuilder.CreateBox(
        `${cfg.name}_trim`,
        {
          width: cfg.w * 0.98,
          depth: cfg.d * 0.35,
          height: 0.1
        },
        this.scene
      );
      trim.position = new Vector3(cfg.x, BORDER_HEIGHT + 0.05, cfg.z);
      trim.material = cfg.trim;
      this.meshes.push(trim);
    });

    // 4 Corner pylons for industrial visual grounding
    const cornerPositions = [
      [-halfW - halfT, halfD + halfT],
      [halfW + halfT, halfD + halfT],
      [-halfW - halfT, -halfD - halfT],
      [halfW + halfT, -halfD - halfT]
    ];

    cornerPositions.forEach(([x, z], idx) => {
      const pylon = MeshBuilder.CreateCylinder(
        `pylon_${idx}`,
        {
          diameter: BORDER_THICKNESS * 1.5,
          height: BORDER_HEIGHT * 1.25,
          tessellation: 8
        },
        this.scene
      );
      pylon.position = new Vector3(x, (BORDER_HEIGHT * 1.25) / 2, z);
      pylon.material = borderMat;
      this.meshes.push(pylon);
    });
  }

  /**
   * Applies data-driven stage presentation configuration.
   * Activates Nexus high-security relay theme or restores baseline presentation.
   */
  public applyPresentation(presentation?: StagePresentationConfig, reducedMotion: boolean = false): void {
    this.currentPresentation = presentation;
    this.pulseTimer = 0;

    if (presentation?.floorTheme === 'NEXUS') {
      // 1. Dark gunmetal / graphite foundation
      this.floorMat.diffuseColor = new Color3(0.045, 0.052, 0.068);
      this.floorMat.specularColor = new Color3(0.12, 0.22, 0.30);
      this.floorMat.specularPower = 48;
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

      this.floorMat.diffuseColor = new Color3(0.07, 0.08, 0.11);
      this.floorMat.specularColor = new Color3(0.15, 0.17, 0.22);
      this.floorMat.specularPower = 32;
      this.floorMat.emissiveColor = new Color3(0.0, 0.0, 0.0);

      this.borderMat.diffuseColor = new Color3(0.14, 0.17, 0.22);
      this.borderMat.specularColor = new Color3(0.3, 0.35, 0.42);

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
