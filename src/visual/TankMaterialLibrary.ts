import { Scene, PBRMaterial, Color3 } from '@babylonjs/core';

export interface TankMaterials {
  playerHull: PBRMaterial;
  playerDark: PBRMaterial;
  playerMetal: PBRMaterial;
  playerAccent: PBRMaterial;
  enemyHull: PBRMaterial;
  enemyDark: PBRMaterial;
  enemyMetal: PBRMaterial;
  enemyAccentStd: PBRMaterial;
  enemyAccentFast: PBRMaterial;
  enemyAccentArmor: PBRMaterial;
  tracks: PBRMaterial;
}

/**
 * TankMaterialLibrary: Central singleton managing physically-based rendering (PBR)
 * materials for combat vehicles in Battle City 2026.
 * Minimizes draw-call and state thrashing by providing shared, highly-tuned PBR materials.
 */
export class TankMaterialLibrary {
  private static instance: TankMaterialLibrary | null = null;

  private scene: Scene;
  private materials?: TankMaterials;
  private isInitialized = false;

  private constructor(scene: Scene) {
    this.scene = scene;
    this.init();
  }

  public static getInstance(scene: Scene): TankMaterialLibrary {
    if (!TankMaterialLibrary.instance || TankMaterialLibrary.instance.scene !== scene) {
      if (TankMaterialLibrary.instance) {
        TankMaterialLibrary.instance.dispose();
      }
      TankMaterialLibrary.instance = new TankMaterialLibrary(scene);
    }
    return TankMaterialLibrary.instance;
  }

  public static getExistingInstance(): TankMaterialLibrary | null {
    return TankMaterialLibrary.instance;
  }

  private init(): void {
    if (this.isInitialized) return;

    // 1. Shared Heavy Track Metal
    const tracks = new PBRMaterial('mat_pbr_tankTracks', this.scene);
    tracks.albedoColor = Color3.FromHexString('#141820');
    tracks.metallic = 0.62;
    tracks.roughness = 0.72;
    tracks.directIntensity = 1.20;
    tracks.environmentIntensity = 0.40;

    // 2. Player Materials
    // Primary Hull: Vibrant armor composite supporting full dynamic range baked vertex colors & specular highlights
    const playerHull = new PBRMaterial('mat_pbr_tankPlayerHull', this.scene);
    playerHull.albedoColor = new Color3(1.0, 1.0, 1.0); // Modulated cleanly by baked vertex colors
    playerHull.metallic = 0.22;
    playerHull.roughness = 0.28;
    playerHull.directIntensity = 1.85;
    playerHull.environmentIntensity = 0.70;

    // Player Dark: Undercarriage, rear engine louvers, mechanical structural core
    const playerDark = new PBRMaterial('mat_pbr_tankPlayerDark', this.scene);
    playerDark.albedoColor = Color3.FromHexString('#12171f');
    playerDark.metallic = 0.72;
    playerDark.roughness = 0.38;
    playerDark.directIntensity = 1.25;
    playerDark.environmentIntensity = 0.45;

    // Player Metal: Cool brushed alloy mantlet, barrel sleeve, beveled armor trims
    const playerMetal = new PBRMaterial('mat_pbr_tankPlayerMetal', this.scene);
    playerMetal.albedoColor = Color3.FromHexString('#788d9e');
    playerMetal.metallic = 0.78;
    playerMetal.roughness = 0.32;
    playerMetal.directIntensity = 1.40;
    playerMetal.environmentIntensity = 0.60;

    // Player Accent: Restrained tactical cyan status lamps and vision visor
    const playerAccent = new PBRMaterial('mat_pbr_tankPlayerAccent', this.scene);
    playerAccent.albedoColor = Color3.FromHexString('#00f0ff');
    playerAccent.emissiveColor = Color3.FromHexString('#00b4d8');
    playerAccent.metallic = 0.15;
    playerAccent.roughness = 0.25;
    playerAccent.directIntensity = 1.60;
    playerAccent.environmentIntensity = 0.80;

    // 3. Enemy Materials
    // Enemy Hull: Base hull alloy for enemy units supporting baked archetype vertex colors
    const enemyHull = new PBRMaterial('mat_pbr_tankEnemyHull', this.scene);
    enemyHull.albedoColor = new Color3(1.0, 1.0, 1.0);
    enemyHull.metallic = 0.24;
    enemyHull.roughness = 0.30;
    enemyHull.directIntensity = 1.80;
    enemyHull.environmentIntensity = 0.65;

    // Enemy Dark: Undercarriage, engine exhaust deck (deep charcoal gunmetal)
    const enemyDark = new PBRMaterial('mat_pbr_tankEnemyDark', this.scene);
    enemyDark.albedoColor = Color3.FromHexString('#0e0d0c');
    enemyDark.metallic = 0.70;
    enemyDark.roughness = 0.42;
    enemyDark.directIntensity = 1.20;
    enemyDark.environmentIntensity = 0.40;

    // Enemy Metal: Machined gunmetal mantlets and cannon barrels
    const enemyMetal = new PBRMaterial('mat_pbr_tankEnemyMetal', this.scene);
    enemyMetal.albedoColor = Color3.FromHexString('#5c5650');
    enemyMetal.metallic = 0.76;
    enemyMetal.roughness = 0.36;
    enemyMetal.directIntensity = 1.35;
    enemyMetal.environmentIntensity = 0.55;

    // Enemy Accents: Archetype-specific sensor / visor identification
    const enemyAccentStd = new PBRMaterial('mat_pbr_tankEnemyAccentStd', this.scene);
    enemyAccentStd.albedoColor = Color3.FromHexString('#ff7700');
    enemyAccentStd.emissiveColor = new Color3(0.95, 0.40, 0.0);
    enemyAccentStd.metallic = 0.20;
    enemyAccentStd.roughness = 0.35;

    const enemyAccentFast = new PBRMaterial('mat_pbr_tankEnemyAccentFast', this.scene);
    enemyAccentFast.albedoColor = Color3.FromHexString('#ffaa00');
    enemyAccentFast.emissiveColor = new Color3(0.90, 0.55, 0.0);
    enemyAccentFast.metallic = 0.20;
    enemyAccentFast.roughness = 0.35;

    const enemyAccentArmor = new PBRMaterial('mat_pbr_tankEnemyAccentArmor', this.scene);
    enemyAccentArmor.albedoColor = Color3.FromHexString('#e03510');
    enemyAccentArmor.emissiveColor = new Color3(0.85, 0.20, 0.06);
    enemyAccentArmor.metallic = 0.25;
    enemyAccentArmor.roughness = 0.40;

    this.materials = {
      playerHull,
      playerDark,
      playerMetal,
      playerAccent,
      enemyHull,
      enemyDark,
      enemyMetal,
      enemyAccentStd,
      enemyAccentFast,
      enemyAccentArmor,
      tracks,
    };

    this.isInitialized = true;
  }

  public getMaterials(): TankMaterials {
    if (!this.materials) {
      this.init();
    }
    return this.materials!;
  }

  public dispose(): void {
    if (this.materials) {
      Object.values(this.materials).forEach((mat) => {
        mat.dispose(true, true);
      });
      this.materials = undefined;
    }
    this.isInitialized = false;
    TankMaterialLibrary.instance = null;
  }
}
