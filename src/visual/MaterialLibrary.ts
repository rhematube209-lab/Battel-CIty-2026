import {
  Scene,
  PBRMaterial,
  Color3,
  DynamicTexture,
  Texture,
} from '@babylonjs/core';

export interface EnvironmentMaterials {
  brick: PBRMaterial;
  steel: PBRMaterial;
  floor: PBRMaterial;
  floorInset: PBRMaterial;
  perimeterArmor: PBRMaterial;
  bushLeafA: PBRMaterial;
  commandHousing: PBRMaterial;
  commandTrim: PBRMaterial;
  commandCore: PBRMaterial;
}

/**
 * MaterialLibrary: Centralized repository for all environmental PBR materials.
 * Resources are created once per scene, cached, and reused across all stages.
 * Guaranteed PBR black-metal safety under standard direct/ambient lighting.
 */
export class MaterialLibrary {
  private static instance: MaterialLibrary | null = null;

  private scene: Scene;
  private materials!: EnvironmentMaterials;
  private floorTexture: DynamicTexture | null = null;
  private brickTexture: DynamicTexture | null = null;
  private steelTexture: DynamicTexture | null = null;
  private isInitialized = false;

  private constructor(scene: Scene) {
    this.scene = scene;
    this.init();
  }

  public static getInstance(scene: Scene): MaterialLibrary {
    if (!MaterialLibrary.instance || MaterialLibrary.instance.scene !== scene) {
      if (MaterialLibrary.instance) {
        MaterialLibrary.instance.dispose();
      }
      MaterialLibrary.instance = new MaterialLibrary(scene);
    }
    return MaterialLibrary.instance;
  }

  public static getExistingInstance(): MaterialLibrary | null {
    return MaterialLibrary.instance;
  }

  public getMaterials(): EnvironmentMaterials {
    return this.materials;
  }

  public getMaterial<K extends keyof EnvironmentMaterials>(name: K): EnvironmentMaterials[K] {
    return this.materials[name];
  }

  private init(): void {
    if (this.isInitialized) return;

    // 1. Generate procedural textures (floor, brick, steel) if canvas environment is available
    if (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined') {
      try {
        this.floorTexture = this.generateProceduralFloorTexture();
      } catch {
        this.floorTexture = null;
      }
      try {
        this.brickTexture = this.generateProceduralBrickTexture();
      } catch {
        this.brickTexture = null;
      }
      try {
        this.steelTexture = this.generateProceduralSteelTexture();
      } catch {
        this.steelTexture = null;
      }
    }

    // 2. Create PBR Materials with tuned black-metal safety parameters
    const brick = new PBRMaterial('mat_pbr_brick', this.scene);
    brick.albedoColor = new Color3(1.0, 1.0, 1.0); // Baked vertex colors modulate terracotta tones
    brick.metallic = 0.0;
    brick.roughness = 0.84;
    brick.directIntensity = 1.35;
    brick.environmentIntensity = 0.55;
    if (this.brickTexture) {
      brick.albedoTexture = this.brickTexture;
    }

    const steel = new PBRMaterial('mat_pbr_steel', this.scene);
    steel.albedoColor = new Color3(1.0, 1.0, 1.0); // Baked vertex colors provide armored plate vs dark frame
    steel.metallic = 0.85; // Machined industrial alloy response matching reference
    steel.roughness = 0.42; // Brushed sheen catching directional specular glints without wash
    steel.directIntensity = 1.30;
    steel.environmentIntensity = 0.55;
    steel.specularIntensity = 1.0;
    if (this.steelTexture) {
      steel.albedoTexture = this.steelTexture;
    }

    const floor = new PBRMaterial('mat_pbr_floor', this.scene);
    floor.albedoColor = new Color3(1.0, 1.0, 1.0); // Preserves procedural floor texture slab contrast & seams
    floor.metallic = 0.22;
    floor.roughness = 0.68;
    floor.directIntensity = 1.35;
    floor.environmentIntensity = 0.35;
    if (this.floorTexture) {
      floor.albedoTexture = this.floorTexture;
    }

    const floorInset = new PBRMaterial('mat_pbr_floorInset', this.scene);
    floorInset.albedoColor = new Color3(0.045, 0.05, 0.07); // Seam channel
    floorInset.metallic = 0.25;
    floorInset.roughness = 0.80;
    floorInset.directIntensity = 1.1;

    const perimeterArmor = new PBRMaterial('mat_pbr_perimeterArmor', this.scene);
    perimeterArmor.albedoColor = new Color3(1.0, 1.0, 1.0); // Baked vertex colors provide armor plate vs dark conduit/trim
    perimeterArmor.metallic = 0.62;
    perimeterArmor.roughness = 0.40;
    perimeterArmor.directIntensity = 1.45;
    perimeterArmor.environmentIntensity = 0.65;

    const bushLeafA = new PBRMaterial('mat_pbr_bushLeafA', this.scene);
    bushLeafA.albedoColor = new Color3(1.0, 1.0, 1.0); // Baked vertex colors provide emerald canopy vs shadow foliage
    bushLeafA.metallic = 0.0;
    bushLeafA.roughness = 0.72;
    bushLeafA.directIntensity = 1.30;

    const commandHousing = new PBRMaterial('mat_pbr_commandHousing', this.scene);
    commandHousing.albedoColor = new Color3(0.15, 0.19, 0.25); // Dark gunmetal housing
    commandHousing.metallic = 0.78;
    commandHousing.roughness = 0.34;
    commandHousing.directIntensity = 1.6;
    commandHousing.environmentIntensity = 0.8;

    const commandTrim = new PBRMaterial('mat_pbr_commandTrim', this.scene);
    commandTrim.albedoColor = new Color3(0.0, 0.85, 1.0); // Stage trim
    commandTrim.emissiveColor = new Color3(0.0, 0.60, 0.85);
    commandTrim.metallic = 0.35;
    commandTrim.roughness = 0.40;

    const commandCore = new PBRMaterial('mat_pbr_commandCore', this.scene);
    commandCore.albedoColor = new Color3(0.0, 0.90, 1.0); // Cyan energy core
    commandCore.emissiveColor = new Color3(0.10, 0.70, 0.95);
    commandCore.metallic = 0.10;
    commandCore.roughness = 0.25;
    commandCore.directIntensity = 1.6;

    this.materials = {
      brick,
      steel,
      floor,
      floorInset,
      perimeterArmor,
      bushLeafA,
      commandHousing,
      commandTrim,
      commandCore,
    };

    this.isInitialized = true;
  }

  /**
   * Generates a 512x512 procedural tile seam and micro-wear texture ONCE.
   * Maps 13x13 modular industrial deck slabs (1 slab per tile cell) with 3px recessed seams,
   * 2px highlight bevels, subtle panel tone variations, and corner rivet plates that survive camera minification.
   */
  private generateProceduralFloorTexture(): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture('tex_procedural_floor', { width: size, height: size }, this.scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;

    // 1. Base dark graphite
    ctx.fillStyle = '#10131a';
    ctx.fillRect(0, 0, size, size);

    // 2. 13x13 modular industrial deck slabs (each slab exactly maps 1 tile cell: ~39.38px)
    const slabs = 13;
    const step = size / slabs;

    const slabTones = [
      '#202634', // Tone 0: rich graphite deck
      '#283142', // Tone 1: cold steel panel
      '#242b3a', // Tone 2: dark slate plate
      '#2c3648', // Tone 3: reinforced iron panel
    ];

    for (let r = 0; r < slabs; r++) {
      for (let c = 0; c < slabs; c++) {
        const x = Math.round(c * step);
        const y = Math.round(r * step);
        const nextX = Math.round((c + 1) * step);
        const nextY = Math.round((r + 1) * step);
        const w = nextX - x;
        const h = nextY - y;
        const toneIdx = (r * 3 + c * 7) % slabTones.length;

        // Slab body
        ctx.fillStyle = slabTones[toneIdx];
        ctx.fillRect(x, y, w, h);

        // Subtle inner vignette / edge darkening (2px rim)
        ctx.fillStyle = 'rgba(6, 8, 12, 0.45)';
        ctx.fillRect(x, y, w, 2);
        ctx.fillRect(x, y, 2, h);
        ctx.fillRect(x, y + h - 2, w, 2);
        ctx.fillRect(x + w - 2, y, 2, h);

        // Inner metallic bevel edge highlight along top and left (catching direct key light)
        ctx.fillStyle = 'rgba(80, 100, 130, 0.60)';
        ctx.fillRect(x + 2, y + 2, w - 4, 1.5);
        ctx.fillRect(x + 2, y + 2, 1.5, h - 4);
      }
    }

    // 3. Broad recessed seam channels between slabs (3px dark channel)
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#080a10';
    for (let i = 0; i <= slabs; i++) {
      const pos = Math.round(i * step);
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, size);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, pos);
      ctx.lineTo(size, pos);
      ctx.stroke();
    }

    // 4. Heavy corner anchor plates with bright rivet studs at slab intersections
    for (let r = 0; r <= slabs; r++) {
      for (let c = 0; c <= slabs; c++) {
        const px = Math.round(c * step);
        const py = Math.round(r * step);

        // Outer dark fastener plate (6x6)
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(px - 3, py - 3, 6, 6);

        // Center bright rivet head (2x2)
        ctx.fillStyle = '#627898';
        ctx.fillRect(px - 1, py - 1, 2, 2);
      }
    }

    // 5. Deterministic micro-wear / surface grain overlay
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let p = 0; p < data.length; p += 4) {
      const noise = ((p * 137) % 17) - 8;
      data[p] = Math.min(255, Math.max(0, data[p] + noise));
      data[p + 1] = Math.min(255, Math.max(0, data[p + 1] + noise));
      data[p + 2] = Math.min(255, Math.max(0, data[p + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    tex.update(false);
    tex.wrapU = Texture.CLAMP_ADDRESSMODE;
    tex.wrapV = Texture.CLAMP_ADDRESSMODE;

    return tex;
  }

  /**
   * Generates a 512x512 procedural brick albedo & micro-wear texture matching the official
   * Battle City 2026 Brick Terrain Material reference sheet.
   * Features dark slate gray mortar joints, 3-tier terracotta variation, edge distress,
   * subtle lime/efflorescence streaks, and granular clay tooth.
   */
  private generateProceduralBrickTexture(): DynamicTexture | null {
    const size = 512;
    const tex = new DynamicTexture('tex_proc_brick', size, this.scene, true);
    const ctx = tex.getContext();
    if (!ctx) return null;

    // 1. Base Mortar: Pale Warm Cement (#ede8e1) matching the user reference image
    ctx.fillStyle = '#ede8e1';
    ctx.fillRect(0, 0, size, size);

    // Fine cement grit on mortar
    ctx.fillStyle = 'rgba(160, 150, 140, 0.35)';
    for (let i = 0; i < 600; i++) {
      const rx = (i * 179) % size;
      const ry = (i * 311) % size;
      ctx.fillRect(rx, ry, 2, 2);
    }

    // 2. Running bond brick courses (strictly 5 horizontal layers per block, seamless masonry)
    // 4px outer mortar margins on boundaries so adjacent blocks combine to 8px mortar joints
    const rows = [
      { y: 4, h: 94 },    // Course 0 (layer 1)
      { y: 106, h: 94 },  // Course 1 (layer 2)
      { y: 208, h: 94 },  // Course 2 (layer 3)
      { y: 310, h: 94 },  // Course 3 (layer 4)
      { y: 412, h: 96 },  // Course 4 (layer 5)
    ];

    // Curated warm terracotta clay palette matching reference
    const tones = [
      { light: '#ee773c', mid: '#e1642c', dark: '#be4618' }, // Sunlit warm terracotta
      { light: '#e86e34', mid: '#d55722', dark: '#b43d12' }, // Mid terracotta
      { light: '#f28448', mid: '#ea7338', dark: '#c8501e' }, // Radiant golden clay
      { light: '#df6328', mid: '#cb4e1a', dark: '#a8350e' }, // Deep kiln-baked clay
      { light: '#ea7035', mid: '#db5c24', dark: '#b84214' }, // Rich standard brick
      { light: '#f07d40', mid: '#e3682e', dark: '#c24818' }, // Warm bright clay
    ];

    rows.forEach((row, rowIdx) => {
      const y = row.y;
      const h = row.h;

      if (rowIdx % 2 === 0) {
        // Even row: 2 equal bricks across X (seam at center x = 256, 8px mortar joint)
        const bricksInRow = [
          { x: 4, w: 248 },
          { x: 260, w: 248 }
        ];

        bricksInRow.forEach((b, colIdx) => {
          const tone = tones[(rowIdx * 3 + colIdx * 5) % tones.length];
          drawBrick(ctx, b.x, y, b.w, h, tone, rowIdx, colIdx);
        });
      } else {
        // Odd row: running bond stagger (left half-brick 120px, center full brick 248px, right half-brick 120px)
        // When adjacent blocks touch, 120px + 8px joint + 120px = 248px continuous full brick!
        const bricksInRow = [
          { x: 4, w: 120 },
          { x: 132, w: 248 },
          { x: 388, w: 120 }
        ];

        bricksInRow.forEach((b, colIdx) => {
          const tone = tones[(rowIdx * 3 + colIdx * 7) % tones.length];
          drawBrick(ctx, b.x, y, b.w, h, tone, rowIdx, colIdx);
        });
      }
    });

    // 3. Render subtle depth & overhang shadows in horizontal brick mortar channels (4 joints)
    const mortarJointCenters = [102, 204, 306, 408];
    mortarJointCenters.forEach((center) => {
      const shadowGrad = ctx.createLinearGradient(0, center - 4, 0, center + 3);
      shadowGrad.addColorStop(0.0, 'rgba(25, 10, 5, 0.72)');
      shadowGrad.addColorStop(0.4, 'rgba(50, 22, 12, 0.38)');
      shadowGrad.addColorStop(1.0, 'rgba(90, 45, 25, 0.05)');
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, center - 4, size, 7);

      // Center crease line
      ctx.strokeStyle = 'rgba(35, 15, 8, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, center);
      ctx.lineTo(size, center);
      ctx.stroke();

      // Lower light reflection
      ctx.strokeStyle = 'rgba(215, 205, 195, 0.50)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(0, center + 3);
      ctx.lineTo(size, center + 3);
      ctx.stroke();
    });

    // Bottom boundary mortar joint (y = 508..512, cascades across tile boundary)
    const shadowGradBottom = ctx.createLinearGradient(0, 508, 0, 512);
    shadowGradBottom.addColorStop(0.0, 'rgba(25, 10, 5, 0.72)');
    shadowGradBottom.addColorStop(1.0, 'rgba(50, 22, 12, 0.38)');
    ctx.fillStyle = shadowGradBottom;
    ctx.fillRect(0, 508, size, 4);

    // Vertical mortar crease lines
    ctx.strokeStyle = 'rgba(50, 25, 15, 0.40)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    // Vertical grooves in Course 0, 2, 4 (center x = 256)
    ctx.moveTo(256, 4);
    ctx.lineTo(256, 98);
    ctx.moveTo(256, 208);
    ctx.lineTo(256, 302);
    ctx.moveTo(256, 412);
    ctx.lineTo(256, 508);
    // Vertical grooves in Course 1, 3 (x = 128 and x = 384)
    ctx.moveTo(128, 106);
    ctx.lineTo(128, 200);
    ctx.moveTo(384, 106);
    ctx.lineTo(384, 200);
    ctx.moveTo(128, 310);
    ctx.lineTo(128, 404);
    ctx.moveTo(384, 310);
    ctx.lineTo(384, 404);
    ctx.stroke();

    function drawBrick(
      context: any,
      x: number,
      y: number,
      w: number,
      h: number,
      tone: { light: string; mid: string; dark: string },
      r: number,
      c: number
    ) {
      // Linear gradient across brick body from top-left (light) to bottom-right (dark)
      const grad = context.createLinearGradient(x, y, x + w, y + h);
      grad.addColorStop(0.0, tone.light);
      grad.addColorStop(0.5, tone.mid);
      grad.addColorStop(1.0, tone.dark);

      context.fillStyle = grad;
      context.beginPath();
      // Soft rounded pillowy corners
      const cr = 3;
      context.moveTo(x + cr, y);
      context.lineTo(x + w - cr, y);
      context.quadraticCurveTo(x + w, y, x + w, y + cr);
      context.lineTo(x + w, y + h - cr);
      context.quadraticCurveTo(x + w, y + h, x + w - cr, y + h);
      context.lineTo(x + cr, y + h);
      context.quadraticCurveTo(x, y + h, x, y + h - cr);
      context.lineTo(x, y + cr);
      context.quadraticCurveTo(x, y, x + cr, y);
      context.closePath();
      context.fill();

      // Outer contact shadow groove into mortar along bottom and right (light from top-left)
      context.fillStyle = 'rgba(70, 20, 8, 0.50)';
      context.fillRect(x + 2, y + h - 3, w - 4, 3);
      context.fillRect(x + w - 3, y + 2, 3, h - 4);

      // Top and left sunlit ivory-clay bevel highlight (catching top-left key light)
      context.fillStyle = 'rgba(255, 240, 225, 0.75)';
      context.fillRect(x + 2, y + 2, w - 4, 2.5);
      context.fillRect(x + 2, y + 2, 2.5, h - 4);

      // Subtle curved surface gleam across upper third
      context.fillStyle = 'rgba(255, 250, 245, 0.18)';
      context.fillRect(x + 4, y + 5, w - 8, Math.round(h * 0.28));

      // Subtle clay micro-pits and porous fissures
      context.fillStyle = 'rgba(50, 20, 12, 0.40)';
      for (let p = 0; p < 5; p++) {
        const px = x + 8 + ((p * 53) % Math.max(1, w - 16));
        const py = y + 8 + ((p * 37) % Math.max(1, h - 16));
        context.fillRect(px, py, 2, 2);
      }

      // Subtle pale lime / efflorescence dusting
      if ((r + c) % 3 === 0) {
        context.fillStyle = 'rgba(255, 255, 250, 0.14)';
        const streakX = x + Math.round(w * 0.40);
        context.fillRect(streakX, y + 4, Math.round(w * 0.18), h - 8);
      }
    }

    // 4. Subtle overall organic clay tooth noise
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let p = 0; p < data.length; p += 4) {
      const noise = ((p * 113) % 11) - 5;
      data[p] = Math.min(255, Math.max(0, data[p] + noise));
      data[p + 1] = Math.min(255, Math.max(0, data[p + 1] + noise));
      data[p + 2] = Math.min(255, Math.max(0, data[p + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    tex.update(false);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = 1.0;
    tex.vScale = 1.0;

    return tex;
  }

  /**
   * Generates a 512x512 procedural industrial steel albedo texture matching
   * the Battle City 2026 Industrial Floor Texture Atlas reference sheet:
   * - Cold dark cast gunmetal base (#26272e to #30323c)
   * - Stepped outer frame with warm oxidized copper/rust edge distress (#70543e to #8c6c4c)
   * - Recessed dark perimeter shadow channel (#141418)
   * - Embossed diagonal 'X' access hatch reinforcement ribs with light/shadow relief
   * - 4 corner recessed circular socket bolts with center pins and specular rims
   * - Center hub disc with circular recess
   * - Micro-scratches and brushed directional metal tooth
   */
  private generateProceduralSteelTexture(): DynamicTexture {
    const size = 512;
    const tex = new DynamicTexture('tex_procedural_steel', { width: size, height: size }, this.scene, false);
    const ctx = tex.getContext() as CanvasRenderingContext2D;

    // 1. Base dark cast gunmetal
    ctx.fillStyle = '#26272e';
    ctx.fillRect(0, 0, size, size);

    // Subtle brushed metal directional sweep across entire plate
    ctx.fillStyle = 'rgba(54, 56, 66, 0.22)';
    for (let y = 0; y < size; y += 4) {
      ctx.fillRect(0, y, size, 2);
    }

    // 2. Stepped outer armored rim (0 to 36px margin)
    // Dark outer edge contact shadow
    ctx.fillStyle = '#18181e';
    ctx.fillRect(0, 0, size, 6);
    ctx.fillRect(0, 0, 6, size);
    ctx.fillRect(0, size - 6, size, 6);
    ctx.fillRect(size - 6, 0, 6, size);

    // Warm oxidized copper/rust patina along outer beveled rim (matching reference)
    ctx.fillStyle = 'rgba(112, 84, 62, 0.50)';
    ctx.fillRect(6, 6, size - 12, 8);
    ctx.fillRect(6, 6, 8, size - 12);
    ctx.fillRect(6, size - 14, size - 12, 8);
    ctx.fillRect(size - 14, 6, 8, size - 12);

    // Outer corner chamfer wear patches (warm bronze/copper oxidation)
    const cornerWearSize = 44;
    ctx.fillStyle = 'rgba(138, 104, 72, 0.45)';
    // Top-left
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(cornerWearSize, 6);
    ctx.lineTo(6, cornerWearSize);
    ctx.fill();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(size - 6, 6);
    ctx.lineTo(size - cornerWearSize, 6);
    ctx.lineTo(size - 6, cornerWearSize);
    ctx.fill();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(6, size - 6);
    ctx.lineTo(cornerWearSize, size - 6);
    ctx.lineTo(6, size - cornerWearSize);
    ctx.fill();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(size - 6, size - 6);
    ctx.lineTo(size - cornerWearSize, size - 6);
    ctx.lineTo(size - 6, size - cornerWearSize);
    ctx.fill();

    // Top-left direct metallic specular edge highlight
    ctx.fillStyle = 'rgba(145, 160, 185, 0.65)';
    ctx.fillRect(8, 8, size - 16, 2.5);
    ctx.fillRect(8, 8, 2.5, size - 16);

    // 3. Recessed perimeter shadow channel (36px to 48px from border)
    const chX = 36;
    const chW = size - chX * 2;
    ctx.fillStyle = '#141418';
    ctx.fillRect(chX, chX, chW, 12);
    ctx.fillRect(chX, chX, 12, chW);
    ctx.fillRect(chX, chX + chW - 12, chW, 12);
    ctx.fillRect(chX + chW - 12, chX, 12, chW);

    // 4. Inner Access Hatch Plate (48px to size - 48px)
    const pX = 48;
    const pW = size - pX * 2;
    ctx.fillStyle = '#30323c';
    ctx.fillRect(pX, pX, pW, pW);

    // Inner plate bevel edge highlights & contact shadows
    ctx.fillStyle = 'rgba(130, 145, 170, 0.55)';
    ctx.fillRect(pX, pX, pW, 2.5);
    ctx.fillRect(pX, pX, 2.5, pW);
    ctx.fillStyle = 'rgba(16, 17, 22, 0.70)';
    ctx.fillRect(pX, pX + pW - 3, pW, 3);
    ctx.fillRect(pX + pW - 3, pX, 3, pW);

    // Subtle warm oxidation around inner plate perimeter
    ctx.fillStyle = 'rgba(105, 78, 56, 0.35)';
    ctx.fillRect(pX + 3, pX + 3, pW - 6, 4);
    ctx.fillRect(pX + 3, pX + 3, 4, pW - 6);
    ctx.fillRect(pX + 3, pX + pW - 7, pW - 6, 4);
    ctx.fillRect(pX + pW - 7, pX + 3, 4, pW - 6);

    // 5. Embossed Diagonal 'X' Access Hatch Reinforcing Ribs
    ctx.save();
    // Shadow pass for diagonal ribs (offset slightly +Y/+X)
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(14, 15, 18, 0.80)';
    ctx.beginPath();
    ctx.moveTo(pX + 8, pX + 10);
    ctx.lineTo(pX + pW - 8, pX + pW - 6);
    ctx.moveTo(pX + pW - 8, pX + 10);
    ctx.lineTo(pX + 8, pX + pW - 6);
    ctx.stroke();

    // Main rib body (machined alloy tone)
    ctx.lineWidth = 12;
    ctx.strokeStyle = '#3a3d48';
    ctx.beginPath();
    ctx.moveTo(pX + 8, pX + 8);
    ctx.lineTo(pX + pW - 8, pX + pW - 8);
    ctx.moveTo(pX + pW - 8, pX + 8);
    ctx.lineTo(pX + 8, pX + pW - 8);
    ctx.stroke();

    // Specular highlight edge on upper side of diagonal ribs
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(150, 168, 195, 0.65)';
    ctx.beginPath();
    ctx.moveTo(pX + 12, pX + 6);
    ctx.lineTo(pX + pW - 6, pX + pW - 12);
    ctx.moveTo(pX + pW - 12, pX + 6);
    ctx.lineTo(pX + 6, pX + pW - 12);
    ctx.stroke();
    ctx.restore();

    // 6. Center Lock Hub
    const cx = size / 2;
    const cy = size / 2;

    // Dark outer shadow ring
    ctx.fillStyle = '#141418';
    ctx.beginPath();
    ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.fill();

    // Oxidized warm rim
    ctx.fillStyle = 'rgba(125, 92, 65, 0.60)';
    ctx.beginPath();
    ctx.arc(cx, cy, 27, 0, Math.PI * 2);
    ctx.fill();

    // Center machined alloy disc
    ctx.fillStyle = '#464a58';
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fill();

    // Specular crescent
    ctx.fillStyle = 'rgba(175, 192, 218, 0.75)';
    ctx.beginPath();
    ctx.arc(cx - 3, cy - 3, 22, Math.PI * 0.8, Math.PI * 1.8);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(175, 192, 218, 0.75)';
    ctx.stroke();

    // Center socket depression
    ctx.fillStyle = '#181920';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
    // Inner socket pin
    ctx.fillStyle = '#5a6272';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    // 7. 4 Heavy Corner Socket Bolts (matching reference close-up)
    const boltMargin = 22;
    const boltCoords = [
      [boltMargin, boltMargin],
      [size - boltMargin, boltMargin],
      [boltMargin, size - boltMargin],
      [size - boltMargin, size - boltMargin],
    ];

    boltCoords.forEach(([bx, by]) => {
      // Recessed dark socket collar
      ctx.fillStyle = '#121318';
      ctx.beginPath();
      ctx.arc(bx, by, 14, 0, Math.PI * 2);
      ctx.fill();

      // Subtle warm oxidation around fastener hole
      ctx.fillStyle = 'rgba(130, 95, 68, 0.50)';
      ctx.beginPath();
      ctx.arc(bx, by, 12, 0, Math.PI * 2);
      ctx.fill();

      // Metallic hex / domed bolt head
      ctx.fillStyle = '#525a6a';
      ctx.beginPath();
      ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fill();

      // Central socket indention / hex divot
      ctx.fillStyle = '#1a1b22';
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Top-left specular glint
      ctx.fillStyle = '#c5d4ea';
      ctx.beginPath();
      ctx.arc(bx - 3, by - 3, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // 8. Surface Micro-Scratches & Machined Tooth
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(135, 150, 175, 0.30)';
    for (let s = 0; s < 18; s++) {
      const sx = 55 + ((s * 73) % (pW - 40));
      const sy = 55 + ((s * 97) % (pW - 40));
      const len = 12 + ((s * 19) % 28);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + len, sy + len * 0.4);
      ctx.stroke();
    }

    // 9. Deterministic stippled micro-noise overlay
    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let p = 0; p < data.length; p += 4) {
      const pixelIdx = p / 4;
      const noise = ((pixelIdx * 9301 + 49297) % 233280) / 233280 * 16 - 8;
      data[p] = Math.min(255, Math.max(0, data[p] + noise));
      data[p + 1] = Math.min(255, Math.max(0, data[p + 1] + noise));
      data[p + 2] = Math.min(255, Math.max(0, data[p + 2] + noise));
    }
    ctx.putImageData(imgData, 0, 0);

    tex.update(false);
    tex.wrapU = Texture.WRAP_ADDRESSMODE;
    tex.wrapV = Texture.WRAP_ADDRESSMODE;
    tex.uScale = 1.0;
    tex.vScale = 1.0;

    return tex;
  }

  public dispose(): void {
    if (this.materials) {
      Object.values(this.materials).forEach((mat) => mat.dispose());
    }
    if (this.floorTexture) {
      this.floorTexture.dispose();
      this.floorTexture = null;
    }
    if (this.brickTexture) {
      this.brickTexture.dispose();
      this.brickTexture = null;
    }
    if (this.steelTexture) {
      this.steelTexture.dispose();
      this.steelTexture = null;
    }
    this.isInitialized = false;
    if (MaterialLibrary.instance === this) {
      MaterialLibrary.instance = null;
    }
  }
}
