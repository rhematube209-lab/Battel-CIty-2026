import {
  Scene,
  Vector3,
  MeshBuilder,
  StandardMaterial,
  Color3,
  Mesh,
  TransformNode,
  DynamicTexture,
  Texture
} from '@babylonjs/core';
import { Bullet } from '../entities/Bullet';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyTank } from '../entities/EnemyTank';
import { Direction, directionToVector, directionToRotation } from '../game/Direction';
import {
  PROJECTILE_CONFIG,
  STAGE_CONFIG,
  ProjectileTeam,
  ProjectileHit,
  TileType,
  TILE_SIZE,
  ARENA_WIDTH,
  ARENA_DEPTH,
  COLORS,
  DEBUG
} from '../game/constants';
import { TileMap } from '../world/TileMap';
import { detectQualityProfile } from '../game/QualityProfile';

interface PooledImpact {
  root: TransformNode;
  meshes: Mesh[];
  active: boolean;
  timer: number;
  duration: number;
}

interface PooledMuzzleFlash {
  root: TransformNode;
  hPlane: Mesh;
  vPlane: Mesh;
  coneMesh: Mesh;
  mat: StandardMaterial;
  timer: number;
  duration: number;
  active: boolean;
}

interface DebrisParticle {
  mesh: Mesh;
  vx: number;
  vy: number;
  vz: number;
  rotSpeed: number;
}

interface PooledDebris {
  root: TransformNode;
  particles: DebrisParticle[];
  active: boolean;
  timer: number;
  duration: number;
}

/**
 * ProjectileSystem coordinates player and future enemy projectile firing,
 * pooling, sub-step tunneling prevention, partial-brick quadrant collision, and lightweight VFX.
 */
export class ProjectileSystem {
  private scene: Scene;
  private tileMap: TileMap;

  // Projectile pool
  private pool: Bullet[] = [];
  private sharedPlayerBulletMaterial: StandardMaterial;
  private sharedEnemyBulletMaterial: StandardMaterial;

  // Firing cooldown trackers
  private playerCooldownRemaining: number = 0;
  private enemyCooldownRemaining: number = 0;

  // Half boundaries of the arena
  private readonly arenaHalfWidth: number = ARENA_WIDTH / 2; // 13.0
  private readonly arenaHalfDepth: number = ARENA_DEPTH / 2; // 13.0

  // Procedural Fiery Textures & Muzzle Flash Pool
  private playerBulletTexture: DynamicTexture | null = null;
  private enemyBulletTexture: DynamicTexture | null = null;
  private playerFlashTexture: DynamicTexture | null = null;
  private enemyFlashTexture: DynamicTexture | null = null;
  private muzzleFlashPool: PooledMuzzleFlash[] = [];

  // Impact feedback pool & materials
  private impactPool: PooledImpact[] = [];
  private brickImpactMat: StandardMaterial;
  private steelImpactMat: StandardMaterial;
  private baseImpactMat: StandardMaterial;
  private defaultImpactMat: StandardMaterial;

  // Brick destruction debris pool (Phase 5)
  private debrisPool: PooledDebris[] = [];
  private brickDebrisMat: StandardMaterial;

  // Last hit metadata for Phase 5 and debug analysis
  private lastHit: ProjectileHit | null = null;

  // Combat callbacks (Phase 6, 7, 8 & 10)
  private onBaseHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onPlayerHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onEnemyHitCallback?: (contactPoint: Vector3, dir: Direction, enemy?: EnemyTank) => void;
  private onBrickHitCallback?: (contactPoint: Vector3, dir: Direction, quadrantDestroyed: boolean) => void;
  private onSteelHitCallback?: (contactPoint: Vector3, dir: Direction) => void;
  private onPlayerFireCallback?: () => void;
  private onEnemyFireCallback?: () => void;
  private onAegisShieldHitCallback?: (contactPoint: Vector3, dir: Direction) => void;

  // Combat modifiers provider for Overdrive and Aegis
  private combatModifiersProvider?: {
    getPlayerFireCooldown?: () => number;
    getPlayerBulletLimit?: () => number;
    isAegisShieldActive?: () => boolean;
  };

  // Target provider for dynamic vehicle ray intersection
  private targetProvider?: {
    getPlayer: () => PlayerTank | null;
    getEnemies?: () => EnemyTank[];
    getEnemy?: () => EnemyTank | null;
  };

  constructor(scene: Scene, tileMap: TileMap) {
    this.scene = scene;
    this.tileMap = tileMap;

    // 1. Procedural Fiery Plasma Tracer Textures
    this.playerBulletTexture = this.generateFieryTracerTexture(true);
    this.enemyBulletTexture = this.generateFieryTracerTexture(false);
    this.playerFlashTexture = this.generateMuzzleFlashTexture(true);
    this.enemyFlashTexture = this.generateMuzzleFlashTexture(false);

    // 2. Shared Fiery Projectile Materials
    this.sharedPlayerBulletMaterial = new StandardMaterial('bulletPlayerMat', this.scene);
    this.sharedPlayerBulletMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.sharedPlayerBulletMaterial.emissiveColor = new Color3(1.0, 0.95, 0.90);
    this.sharedPlayerBulletMaterial.disableLighting = true;
    this.sharedPlayerBulletMaterial.backFaceCulling = false;
    this.sharedPlayerBulletMaterial.alphaMode = 1;
    if (this.playerBulletTexture) {
      this.sharedPlayerBulletMaterial.diffuseTexture = this.playerBulletTexture;
      this.sharedPlayerBulletMaterial.emissiveTexture = this.playerBulletTexture;
      this.sharedPlayerBulletMaterial.opacityTexture = this.playerBulletTexture;
    }

    this.sharedEnemyBulletMaterial = new StandardMaterial('bulletEnemyMat', this.scene);
    this.sharedEnemyBulletMaterial.diffuseColor = new Color3(1.0, 1.0, 1.0);
    this.sharedEnemyBulletMaterial.emissiveColor = new Color3(1.0, 0.90, 0.85);
    this.sharedEnemyBulletMaterial.disableLighting = true;
    this.sharedEnemyBulletMaterial.backFaceCulling = false;
    this.sharedEnemyBulletMaterial.alphaMode = 1;
    if (this.enemyBulletTexture) {
      this.sharedEnemyBulletMaterial.diffuseTexture = this.enemyBulletTexture;
      this.sharedEnemyBulletMaterial.emissiveTexture = this.enemyBulletTexture;
      this.sharedEnemyBulletMaterial.opacityTexture = this.enemyBulletTexture;
    }

    // 3. Pre-allocate Bullet Pool (Fixed capacity: 16)
    for (let i = 0; i < PROJECTILE_CONFIG.POOL_SIZE; i++) {
      const bullet = new Bullet(`pooledBullet_${i}`, this.scene, this.sharedPlayerBulletMaterial);
      this.pool.push(bullet);
    }

    // 4. Pre-allocate Starburst Muzzle Flash Pool (6 reusable instances)
    this.initMuzzleFlashPool(6);

    // 4. Impact Materials
    this.brickImpactMat = new StandardMaterial('brickImpactMat', this.scene);
    this.brickImpactMat.diffuseColor = new Color3(0.9, 0.45, 0.2);
    this.brickImpactMat.emissiveColor = new Color3(0.9, 0.4, 0.15);
    this.brickImpactMat.disableLighting = true;

    this.steelImpactMat = new StandardMaterial('steelImpactMat', this.scene);
    this.steelImpactMat.diffuseColor = new Color3(0.7, 0.9, 1.0);
    this.steelImpactMat.emissiveColor = new Color3(0.65, 0.85, 1.0);
    this.steelImpactMat.disableLighting = true;

    this.baseImpactMat = new StandardMaterial('baseImpactMat', this.scene);
    this.baseImpactMat.diffuseColor = new Color3(0.0, 0.9, 1.0);
    this.baseImpactMat.emissiveColor = new Color3(0.0, 0.9, 1.0);
    this.baseImpactMat.disableLighting = true;

    this.defaultImpactMat = new StandardMaterial('defaultImpactMat', this.scene);
    this.defaultImpactMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
    this.defaultImpactMat.emissiveColor = new Color3(0.6, 0.6, 0.6);
    this.defaultImpactMat.disableLighting = true;

    // 5. Pre-allocate Impact FX Pool (6 reusable 4-spark bursts)
    this.initImpactPool(6);

    // 6. Brick Debris Material & Pool (Phase 5)
    this.brickDebrisMat = new StandardMaterial('brickDebrisMat', this.scene);
    this.brickDebrisMat.diffuseColor = Color3.FromHexString(COLORS.BRICK_WARM);
    this.brickDebrisMat.specularColor = new Color3(0.2, 0.15, 0.12);
    this.brickDebrisMat.specularPower = 32;

    this.initDebrisPool(4);
  }

  /**
   * Builds pre-allocated impact effect clusters.
   */
  private initImpactPool(count: number): void {
    for (let i = 0; i < count; i++) {
      const root = new TransformNode(`impactRoot_${i}`, this.scene);
      const meshes: Mesh[] = [];

      const offsets = [
        new Vector3(-0.08, 0.04, -0.08),
        new Vector3(0.08, 0.04, -0.08),
        new Vector3(-0.08, 0.04, 0.08),
        new Vector3(0.08, 0.04, 0.08)
      ];

      for (let j = 0; j < offsets.length; j++) {
        const spark = MeshBuilder.CreateBox(
          `spark_${i}_${j}`,
          { size: 0.09 },
          this.scene
        );
        spark.parent = root;
        spark.position.copyFrom(offsets[j]);
        spark.isPickable = false;
        meshes.push(spark);
      }

      root.setEnabled(false);
      this.impactPool.push({
        root,
        meshes,
        active: false,
        timer: 0,
        duration: 0.12
      });
    }
  }

  /**
   * Builds pre-allocated brick destruction debris clusters.
   * 6 small fragments per cluster with directional flight dynamics.
   */
  private initDebrisPool(count: number): void {
    for (let i = 0; i < count; i++) {
      const root = new TransformNode(`debrisRoot_${i}`, this.scene);
      const particles: DebrisParticle[] = [];

      for (let j = 0; j < 6; j++) {
        const size = 0.09 + (j % 3) * 0.02; // 0.09 - 0.13 unit fragments
        const mesh = MeshBuilder.CreateBox(
          `debrisMesh_${i}_${j}`,
          { width: size, height: size * 0.8, depth: size },
          this.scene
        );
        mesh.material = this.brickDebrisMat;
        mesh.parent = root;
        mesh.isPickable = false;

        particles.push({
          mesh,
          vx: 0,
          vy: 0,
          vz: 0,
          rotSpeed: 0
        });
      }

      root.setEnabled(false);
      this.debrisPool.push({
        root,
        particles,
        active: false,
        timer: 0,
        duration: 0.35
      });
    }
  }

  /**
   * Pre-allocates reusable multi-plane starburst muzzle flash instances.
   */
  private initMuzzleFlashPool(count: number): void {
    for (let i = 0; i < count; i++) {
      const root = new TransformNode(`muzzleFlashRoot_${i}`, this.scene);
      root.setEnabled(false);

      const mat = new StandardMaterial(`muzzleFlashMat_${i}`, this.scene);
      mat.diffuseColor = new Color3(1.0, 1.0, 1.0);
      mat.emissiveColor = new Color3(1.0, 0.95, 0.90);
      mat.disableLighting = true;
      mat.backFaceCulling = false;
      mat.alphaMode = 1; // Additive glow
      if (this.playerFlashTexture) {
        mat.diffuseTexture = this.playerFlashTexture;
        mat.emissiveTexture = this.playerFlashTexture;
        mat.opacityTexture = this.playerFlashTexture;
      }

      // Horizontal starburst plane (XZ) - bold radiant multi-point star
      const hPlane = MeshBuilder.CreatePlane(`mFlash_h_${i}`, { size: 1.40 }, this.scene);
      hPlane.rotation.x = Math.PI / 2;
      hPlane.material = mat;
      hPlane.parent = root;
      hPlane.isPickable = false;

      // Vertical starburst plane (XY facing forward)
      const vPlane = MeshBuilder.CreatePlane(`mFlash_v_${i}`, { size: 1.40 }, this.scene);
      vPlane.material = mat;
      vPlane.parent = root;
      vPlane.isPickable = false;

      // Forward conical blast plume
      const coneMesh = MeshBuilder.CreateCylinder(
        `mFlash_cone_${i}`,
        {
          height: 0.45,
          diameterTop: 0.50,
          diameterBottom: 0.08,
          tessellation: 8
        },
        this.scene
      );
      coneMesh.rotation.x = -Math.PI / 2; // Opens forward along local +Z
      coneMesh.position.z = 0.22; // Project forward from muzzle
      coneMesh.material = mat;
      coneMesh.parent = root;
      coneMesh.isPickable = false;

      this.muzzleFlashPool.push({
        root,
        hPlane,
        vPlane,
        coneMesh,
        mat,
        timer: 0,
        duration: 0.09,
        active: false
      });
    }
  }

  /**
   * Generates a 512x128 procedural supersonic fire tracer texture.
   * U=0 is the leading blast head (+Z), U=1 is the trailing needle tail (-Z).
   */
  private generateFieryTracerTexture(isPlayer: boolean): DynamicTexture | null {
    if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') {
      return null;
    }
    try {
      const w = 512;
      const h = 128;
      const tex = new DynamicTexture(
        isPlayer ? 'tex_fire_tracer_player' : 'tex_fire_tracer_enemy',
        { width: w, height: h },
        this.scene,
        false
      );
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, w, h);

      const cy = h / 2; // 64

      // 1. Broad outer flame envelope: aerodynamic supersonic teardrop lance
      // Nose tip at X=0, rounded blast head widening up to X=70, then tapering smoothly to razor needle at X=500
      const outerGrad = ctx.createLinearGradient(0, 0, w, 0);
      if (isPlayer) {
        outerGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
        outerGrad.addColorStop(0.08, 'rgba(255, 245, 180, 0.98)');
        outerGrad.addColorStop(0.22, 'rgba(255, 190, 35, 0.95)');
        outerGrad.addColorStop(0.48, 'rgba(255, 100, 10, 0.85)');
        outerGrad.addColorStop(0.72, 'rgba(255, 45, 0, 0.60)');
        outerGrad.addColorStop(0.90, 'rgba(200, 20, 0, 0.30)');
        outerGrad.addColorStop(1.00, 'rgba(150, 0, 0, 0.0)');
      } else {
        outerGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
        outerGrad.addColorStop(0.08, 'rgba(255, 235, 160, 0.98)');
        outerGrad.addColorStop(0.22, 'rgba(255, 150, 25, 0.95)');
        outerGrad.addColorStop(0.48, 'rgba(255, 60, 5, 0.85)');
        outerGrad.addColorStop(0.72, 'rgba(210, 25, 0, 0.60)');
        outerGrad.addColorStop(0.90, 'rgba(170, 10, 0, 0.30)');
        outerGrad.addColorStop(1.00, 'rgba(120, 0, 0, 0.0)');
      }

      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      // Aerodynamic parabolic nose curving from (0, cy) -> (70, cy - 44) -> tapering to (500, cy)
      ctx.moveTo(0, cy);
      ctx.bezierCurveTo(5, cy - 25, 30, cy - 44, 70, cy - 44);
      ctx.bezierCurveTo(180, cy - 40, 340, cy - 14, 500, cy);
      ctx.bezierCurveTo(340, cy + 14, 180, cy + 40, 70, cy + 44);
      ctx.bezierCurveTo(30, cy + 44, 5, cy + 25, 0, cy);
      ctx.closePath();
      ctx.fill();

      // 2. Mid-plasma luminous channel (intense golden flame body)
      const midGrad = ctx.createLinearGradient(0, 0, w * 0.82, 0);
      midGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
      midGrad.addColorStop(0.12, 'rgba(255, 250, 200, 0.96)');
      midGrad.addColorStop(0.38, 'rgba(255, 195, 55, 0.90)');
      midGrad.addColorStop(0.70, 'rgba(255, 110, 10, 0.60)');
      midGrad.addColorStop(1.00, 'rgba(255, 50, 0, 0.0)');

      ctx.fillStyle = midGrad;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.bezierCurveTo(5, cy - 16, 25, cy - 26, 60, cy - 26);
      ctx.bezierCurveTo(160, cy - 22, 280, cy - 8, 410, cy);
      ctx.bezierCurveTo(280, cy + 8, 160, cy + 22, 60, cy + 26);
      ctx.bezierCurveTo(25, cy + 26, 5, cy + 16, 0, cy);
      ctx.closePath();
      ctx.fill();

      // 3. Ultra-bright incandescent white core streak along center spine
      const coreGrad = ctx.createLinearGradient(0, 0, w * 0.68, 0);
      coreGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
      coreGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.98)');
      coreGrad.addColorStop(0.70, 'rgba(255, 240, 180, 0.75)');
      coreGrad.addColorStop(1.00, 'rgba(255, 180, 40, 0.0)');

      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.bezierCurveTo(5, cy - 7, 25, cy - 10, 60, cy - 10);
      ctx.lineTo(180, cy - 4);
      ctx.lineTo(330, cy);
      ctx.lineTo(180, cy + 4);
      ctx.bezierCurveTo(25, cy + 10, 5, cy + 7, 0, cy);
      ctx.closePath();
      ctx.fill();

      // 4. Forward incandescent blast shock bloom at front head (X = 0..50)
      const headBloom = ctx.createRadialGradient(20, cy, 0, 20, cy, 48);
      headBloom.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
      headBloom.addColorStop(0.35, 'rgba(255, 245, 200, 0.92)');
      headBloom.addColorStop(0.68, 'rgba(255, 175, 35, 0.55)');
      headBloom.addColorStop(1.00, 'rgba(255, 75, 0, 0.0)');
      ctx.fillStyle = headBloom;
      ctx.beginPath();
      ctx.arc(20, cy, 48, 0, Math.PI * 2);
      ctx.fill();

      tex.hasAlpha = true;
      tex.update(false);
      tex.wrapU = Texture.CLAMP_ADDRESSMODE;
      tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      return tex;
    } catch {
      return null;
    }
  }

  /**
   * Generates a 256x256 procedural starburst muzzle flash texture with sharp radiant rays.
   */
  private generateMuzzleFlashTexture(isPlayer: boolean): DynamicTexture | null {
    if (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined') {
      return null;
    }
    try {
      const size = 256;
      const tex = new DynamicTexture(
        isPlayer ? 'tex_muzzle_flash_player' : 'tex_muzzle_flash_enemy',
        { width: size, height: size },
        this.scene,
        false
      );
      const ctx = tex.getContext() as CanvasRenderingContext2D;
      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;

      // 1. Central radiant bloom gradient
      const radGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx * 0.95);
      radGrad.addColorStop(0.00, 'rgba(255, 255, 255, 1.0)');
      radGrad.addColorStop(0.12, 'rgba(255, 245, 190, 0.98)');
      radGrad.addColorStop(0.28, isPlayer ? 'rgba(255, 195, 45, 0.90)' : 'rgba(255, 150, 25, 0.90)');
      radGrad.addColorStop(0.55, isPlayer ? 'rgba(255, 110, 10, 0.55)' : 'rgba(235, 55, 5, 0.55)');
      radGrad.addColorStop(0.80, 'rgba(210, 30, 0, 0.18)');
      radGrad.addColorStop(1.00, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, size, size);

      // 2. Radiant starburst flare rays with intense golden/amber bodies
      const drawRay = (angle: number, length: number, baseWidth: number, rayColor: string) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        const rayGrad = ctx.createLinearGradient(0, 0, length, 0);
        rayGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
        rayGrad.addColorStop(0.20, rayColor);
        rayGrad.addColorStop(0.65, 'rgba(255, 90, 5, 0.50)');
        rayGrad.addColorStop(1.0, 'rgba(255, 40, 0, 0.0)');
        ctx.fillStyle = rayGrad;
        ctx.beginPath();
        ctx.moveTo(0, -baseWidth / 2);
        ctx.lineTo(length, 0);
        ctx.lineTo(0, baseWidth / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };

      const goldColor = isPlayer ? 'rgba(255, 225, 90, 0.95)' : 'rgba(255, 185, 45, 0.95)';
      const orangeColor = isPlayer ? 'rgba(255, 160, 30, 0.90)' : 'rgba(255, 105, 15, 0.90)';

      // 4 primary cardinal spikes (sharp needle flares)
      drawRay(0, cx * 0.98, 11, goldColor);
      drawRay(Math.PI / 2, cx * 0.90, 9, goldColor);
      drawRay(Math.PI, cx * 0.98, 11, goldColor);
      drawRay(-Math.PI / 2, cx * 0.90, 9, goldColor);

      // 4 diagonal secondary spikes (matching reference backward/forward angled rays)
      drawRay(Math.PI / 4, cx * 0.82, 8, orangeColor);
      drawRay(-Math.PI / 4, cx * 0.82, 8, orangeColor);
      drawRay(3 * Math.PI / 4, cx * 0.82, 8, orangeColor);
      drawRay(-3 * Math.PI / 4, cx * 0.82, 8, orangeColor);

      // 4 tertiary accent micro-spikes for brilliant incandescent twinkle
      drawRay(Math.PI / 8, cx * 0.55, 4.5, 'rgba(255, 240, 150, 0.7)');
      drawRay(-Math.PI / 8, cx * 0.55, 4.5, 'rgba(255, 240, 150, 0.7)');
      drawRay(Math.PI * 5 / 8, cx * 0.55, 4.5, 'rgba(255, 240, 150, 0.7)');
      drawRay(-Math.PI * 5 / 8, cx * 0.55, 4.5, 'rgba(255, 240, 150, 0.7)');

      tex.hasAlpha = true;
      tex.update(false);
      tex.wrapU = Texture.CLAMP_ADDRESSMODE;
      tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      return tex;
    } catch {
      return null;
    }
  }

  /**
   * Spawns a directional brick debris burst responding to impact direction.
   */
  public triggerDebris(position: Vector3, dir: Direction): void {
    const debris = this.debrisPool.find((item) => !item.active);
    if (!debris) return;

    debris.root.position.copyFrom(position);
    debris.root.setEnabled(true);
    debris.active = true;
    debris.timer = 0;
    debris.duration = 0.35;

    const vec = directionToVector(dir);
    const baseSpeed = 2.4;
    const maxParticles = detectQualityProfile().brickFragmentCount;

    for (let i = 0; i < debris.particles.length; i++) {
      const p = debris.particles[i];
      if (i >= maxParticles) {
        p.mesh.setEnabled(false);
        continue;
      }
      p.mesh.setEnabled(true);
      p.mesh.position.set(0, 0, 0);
      p.mesh.scaling.setAll(1.0);
      p.mesh.rotation.set(0, 0, 0);

      const lateral = (i - 2.5) * 0.55; // Spread on perpendicular axis

      if (dir === Direction.NORTH || dir === Direction.SOUTH) {
        p.vx = lateral;
        p.vz = vec.z * (baseSpeed + (i % 3) * 0.5);
      } else {
        p.vx = vec.x * (baseSpeed + (i % 3) * 0.5);
        p.vz = lateral;
      }

      p.vy = 1.8 + (i % 3) * 0.5; // Upward initial arc
      p.rotSpeed = (i % 2 === 0 ? 1 : -1) * (5 + i);
    }
  }

  /**
   * Resets all active debris emitters (useful during map reset).
   */
  public resetDebris(): void {
    for (let i = 0; i < this.debrisPool.length; i++) {
      this.debrisPool[i].active = false;
      this.debrisPool[i].root.setEnabled(false);
    }
  }

  /**
   * Resets all projectile system state: deactivates all bullets, clears cooldowns,
   * hides muzzle flash, clears impacts and debris, resets lastHit.
   */
  public reset(): void {
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].deactivate();
    }
    this.playerCooldownRemaining = 0;
    this.enemyCooldownRemaining = 0;
    for (let i = 0; i < this.muzzleFlashPool.length; i++) {
      this.muzzleFlashPool[i].active = false;
      this.muzzleFlashPool[i].root.setEnabled(false);
    }
    for (let i = 0; i < this.impactPool.length; i++) {
      this.impactPool[i].active = false;
      this.impactPool[i].root.setEnabled(false);
    }
    this.resetDebris();
    this.lastHit = null;
  }

  /**
   * Rebinds the active TileMap reference upon stage transition.
   */
  public setTileMap(tileMap: TileMap): void {
    this.tileMap = tileMap;
  }

  /**
   * Spawns a lightweight impact burst at the given contact position.
   */
  private triggerImpact(position: Vector3, type: TileType | 'BOUNDARY'): void {
    const impact = this.impactPool.find((item) => !item.active);
    if (!impact) return;

    let mat = this.defaultImpactMat;
    if (type === TileType.BRICK) mat = this.brickImpactMat;
    else if (type === TileType.STEEL) mat = this.steelImpactMat;
    else if (type === TileType.BASE) mat = this.baseImpactMat;

    for (let i = 0; i < impact.meshes.length; i++) {
      impact.meshes[i].material = mat;
      impact.meshes[i].scaling.setAll(1.0);
    }

    impact.root.position.copyFrom(position);
    impact.root.setEnabled(true);
    impact.active = true;
    impact.timer = 0;
    impact.duration = 0.12;
  }

  /**
   * Returns the count of currently active player bullets in flight.
   */
  public getActivePlayerBulletCount(): number {
    return this.pool.filter(
      (b) => b.isActive() && b.getTeam() === ProjectileTeam.PLAYER
    ).length;
  }

  /**
   * Returns the count of currently active enemy bullets in flight.
   */
  public getActiveEnemyBulletCount(): number {
    return this.pool.filter(
      (b) => b.isActive() && b.getTeam() === ProjectileTeam.ENEMY
    ).length;
  }

  /**
   * Returns total active bullet count (player + enemies).
   */
  public getActiveBulletCount(): number {
    return this.pool.filter((b) => b.isActive()).length;
  }

  /**
   * Spawns synthetic test projectiles for worst-case load benchmarking.
   */
  public spawnBenchmarkProjectiles(playerCount: number = 3, enemyCount: number = 6): void {
    let pSpawned = 0;
    let eSpawned = 0;
    for (const bullet of this.pool) {
      if (bullet.isActive()) continue;
      if (pSpawned < playerCount) {
        bullet.setMaterial(this.sharedPlayerBulletMaterial);
        bullet.activate(
          new Vector3(-4 + pSpawned * 3, 0.4, -4),
          Direction.NORTH,
          ProjectileTeam.PLAYER,
          7.5,
          10
        );
        pSpawned++;
      } else if (eSpawned < enemyCount) {
        bullet.setMaterial(this.sharedEnemyBulletMaterial);
        bullet.activate(
          new Vector3(-5 + eSpawned * 2, 0.4, 4),
          Direction.SOUTH,
          ProjectileTeam.ENEMY,
          5.0,
          10
        );
        eSpawned++;
      }
    }
  }

  /**
   * Returns the most recent projectile hit record for Phase 5 inspection.
   */
  public getLastHit(): ProjectileHit | null {
    return this.lastHit;
  }

  /**
   * Registers target provider for dynamic vehicle collision queries.
   */
  public setTargetProvider(provider: {
    getPlayer: () => PlayerTank | null;
    getEnemies?: () => EnemyTank[];
    getEnemy?: () => EnemyTank | null;
  }): void {
    this.targetProvider = provider;
  }

  /**
   * Sets callback invoked when any projectile hits the command base (Phase 6).
   */
  public setBaseHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onBaseHitCallback = cb;
  }

  public setPlayerHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onPlayerHitCallback = cb;
  }

  public setEnemyHitCallback(cb: (contactPoint: Vector3, dir: Direction, enemy?: EnemyTank) => void): void {
    this.onEnemyHitCallback = cb;
  }

  public setBrickHitCallback(cb: (contactPoint: Vector3, dir: Direction, quadrantDestroyed: boolean) => void): void {
    this.onBrickHitCallback = cb;
  }

  public setSteelHitCallback(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onSteelHitCallback = cb;
  }

  public setOnPlayerFire(cb: () => void): void {
    this.onPlayerFireCallback = cb;
  }

  public setOnEnemyFire(cb: () => void): void {
    this.onEnemyFireCallback = cb;
  }

  public setOnAegisShieldHit(cb: (contactPoint: Vector3, dir: Direction) => void): void {
    this.onAegisShieldHitCallback = cb;
  }

  public setCombatModifiersProvider(provider: {
    getPlayerFireCooldown?: () => number;
    getPlayerBulletLimit?: () => number;
    isAegisShieldActive?: () => boolean;
  }): void {
    this.combatModifiersProvider = provider;
  }

  /**
   * Attempts to fire a player bullet from the tank's cannon muzzle.
   * Enforces fire cooldown (0.28s) and maximum concurrent bullets (2).
   */
  public tryFirePlayer(playerTank: PlayerTank): boolean {
    if (this.playerCooldownRemaining > 0) {
      return false;
    }

    const maxBullets =
      this.combatModifiersProvider?.getPlayerBulletLimit?.() ??
      PROJECTILE_CONFIG.MAX_ACTIVE_PLAYER_BULLETS;

    if (this.getActivePlayerBulletCount() >= maxBullets) {
      return false;
    }

    const bullet = this.pool.find((b) => !b.isActive());
    if (!bullet) {
      return false;
    }

    const muzzlePos = playerTank.getMuzzlePoint();
    const dir = playerTank.getDirection();

    bullet.setMaterial(this.sharedPlayerBulletMaterial);
    bullet.activate(
      muzzlePos,
      dir,
      ProjectileTeam.PLAYER,
      PROJECTILE_CONFIG.SPEED,
      PROJECTILE_CONFIG.MAX_LIFETIME
    );

    this.triggerMuzzleFlash(muzzlePos, dir, true);
    (playerTank as any).triggerRecoil?.();
    const cooldown =
      this.combatModifiersProvider?.getPlayerFireCooldown?.() ??
      PROJECTILE_CONFIG.PLAYER_FIRE_COOLDOWN;
    this.playerCooldownRemaining = cooldown;
    this.onPlayerFireCallback?.();

    return true;
  }

  /**
   * Attempts to fire an enemy bullet from the enemy tank's cannon muzzle.
   * Enforces fire cooldown (0.85s) and team-wide enemy bullet ceiling (6).
   */
  public tryFireEnemy(enemyTank: EnemyTank): boolean {
    if (this.enemyCooldownRemaining > 0) {
      return false;
    }

    if (this.getActiveEnemyBulletCount() >= STAGE_CONFIG.MAX_ACTIVE_ENEMY_BULLETS_TOTAL) {
      return false;
    }

    const bullet = this.pool.find((b) => !b.isActive());
    if (!bullet) {
      return false;
    }

    const muzzlePos = enemyTank.getMuzzlePoint();
    const dir = enemyTank.getDirection();

    const archetype = enemyTank.getArchetype();

    bullet.setMaterial(this.sharedEnemyBulletMaterial);
    bullet.activate(
      muzzlePos,
      dir,
      ProjectileTeam.ENEMY,
      archetype.bulletSpeed,
      PROJECTILE_CONFIG.MAX_LIFETIME
    );

    this.triggerMuzzleFlash(muzzlePos, dir, false);
    (enemyTank as any).triggerRecoil?.();
    this.enemyCooldownRemaining = archetype.fireCooldown;
    this.onEnemyFireCallback?.();

    return true;
  }

  /**
   * Triggers compact directional starburst muzzle flash flare at cannon tip.
   */
  private triggerMuzzleFlash(position: Vector3, dir: Direction = Direction.NORTH, isPlayer: boolean = true): void {
    let flash = this.muzzleFlashPool.find((f) => !f.active);
    if (!flash) {
      flash = this.muzzleFlashPool.reduce(
        (oldest, cur) => (cur.timer > oldest.timer ? cur : oldest),
        this.muzzleFlashPool[0]
      );
    }
    if (!flash) return;

    flash.root.position.copyFrom(position);
    flash.root.rotation.y = directionToRotation(dir);

    const tex = isPlayer ? this.playerFlashTexture : this.enemyFlashTexture;
    if (tex) {
      flash.mat.diffuseTexture = tex;
      flash.mat.emissiveTexture = tex;
      flash.mat.opacityTexture = tex;
    }
    flash.mat.alpha = 1.0;

    flash.root.scaling.setAll(0.85);
    flash.timer = 0;
    flash.duration = 0.09;
    flash.active = true;
    flash.root.setEnabled(true);
  }

  /**
   * Main per-frame projectile simulation loop.
   * Handles high-speed substep movement and quadrant-accurate partial brick collision.
   */
  public update(deltaTime: number): void {
    // 1. Advance firing cooldowns
    if (this.playerCooldownRemaining > 0) {
      this.playerCooldownRemaining -= deltaTime;
      if (this.playerCooldownRemaining < 0) {
        this.playerCooldownRemaining = 0;
      }
    }
    if (this.enemyCooldownRemaining > 0) {
      this.enemyCooldownRemaining -= deltaTime;
      if (this.enemyCooldownRemaining < 0) {
        this.enemyCooldownRemaining = 0;
      }
    }

    // 2. Update muzzle flash VFX pool
    for (let i = 0; i < this.muzzleFlashPool.length; i++) {
      const flash = this.muzzleFlashPool[i];
      if (flash.active) {
        flash.timer += deltaTime;
        if (flash.timer >= flash.duration) {
          flash.active = false;
          flash.root.setEnabled(false);
        } else {
          const t = flash.timer / flash.duration;
          if (t <= 0.3) {
            const s = 0.85 + (t / 0.3) * 0.55; // Explosive burst from 0.85 to 1.40
            flash.root.scaling.setAll(s);
            flash.mat.alpha = 1.0;
          } else {
            const decay = (t - 0.3) / 0.7;
            const s = 1.40 - decay * 0.85;
            flash.root.scaling.setAll(Math.max(0.2, s));
            flash.mat.alpha = Math.max(0.0, 1.0 - decay);
          }
        }
      }
    }

    // 3. Update active impact feedback effects
    for (let i = 0; i < this.impactPool.length; i++) {
      const impact = this.impactPool[i];
      if (impact.active) {
        impact.timer += deltaTime;
        if (impact.timer >= impact.duration) {
          impact.active = false;
          impact.root.setEnabled(false);
        } else {
          const scale = 1.0 - impact.timer / impact.duration;
          for (let j = 0; j < impact.meshes.length; j++) {
            impact.meshes[j].scaling.setAll(Math.max(0.1, scale));
          }
        }
      }
    }

    // 4. Update active brick debris effects (Phase 5)
    for (let i = 0; i < this.debrisPool.length; i++) {
      const debris = this.debrisPool[i];
      if (debris.active) {
        debris.timer += deltaTime;
        if (debris.timer >= debris.duration) {
          debris.active = false;
          debris.root.setEnabled(false);
        } else {
          const progress = debris.timer / debris.duration;
          const scale = Math.max(0.1, 1.0 - progress);

          for (let j = 0; j < debris.particles.length; j++) {
            const p = debris.particles[j];
            p.vy -= 9.8 * deltaTime; // Gravity pull
            p.mesh.position.x += p.vx * deltaTime;
            p.mesh.position.y += p.vy * deltaTime;
            p.mesh.position.z += p.vz * deltaTime;
            p.mesh.rotation.y += p.rotSpeed * deltaTime;
            p.mesh.scaling.setAll(scale);
          }
        }
      }
    }

    // 5. Simulate active bullets with sub-stepping & partial brick detection
    for (let bIndex = 0; bIndex < this.pool.length; bIndex++) {
      const bullet = this.pool[bIndex];
      if (!bullet.isActive()) continue;

      if (!bullet.updateLifetime(deltaTime)) {
        continue;
      }

      const totalDistance = bullet.getSpeed() * deltaTime;
      const dir = bullet.getDirection();
      const vec = directionToVector(dir);

      const maxSubstep = PROJECTILE_CONFIG.MAX_SUBSTEP;
      const steps = Math.max(1, Math.ceil(totalDistance / maxSubstep));
      const stepDist = totalDistance / steps;

      const half = PROJECTILE_CONFIG.COLLISION_HALF_EXTENT; // 0.10

      for (let s = 0; s < steps; s++) {
        const currPos = bullet.getPosition();
        const nextX = currPos.x + vec.x * stepDist;
        const nextZ = currPos.z + vec.z * stepDist;

        // --- A. Arena Boundary Collision Check ---
        const minX = nextX - half;
        const maxX = nextX + half;
        const minZ = nextZ - half;
        const maxZ = nextZ + half;

        let hitBoundary = false;
        let boundaryHitPos: Vector3 | null = null;

        if (minX < -this.arenaHalfWidth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(-this.arenaHalfWidth, currPos.y, currPos.z);
        } else if (maxX > this.arenaHalfWidth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(this.arenaHalfWidth, currPos.y, currPos.z);
        } else if (minZ < -this.arenaHalfDepth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(currPos.x, currPos.y, -this.arenaHalfDepth);
        } else if (maxZ > this.arenaHalfDepth) {
          hitBoundary = true;
          boundaryHitPos = new Vector3(currPos.x, currPos.y, this.arenaHalfDepth);
        }

        if (hitBoundary && boundaryHitPos) {
          this.lastHit = {
            type: 'BOUNDARY',
            row: -1,
            column: -1,
            worldPoint: { x: boundaryHitPos.x, y: boundaryHitPos.y, z: boundaryHitPos.z },
            incomingDirection: dir
          };
          this.onSteelHitCallback?.(boundaryHitPos, dir);
          this.triggerImpact(boundaryHitPos, 'BOUNDARY');
          bullet.deactivate();
          break;
        }

        // --- B. Substep Collision Check: World Obstacles & Dynamic Tanks ---
        const minCol = Math.max(0, Math.floor((minX + this.arenaHalfWidth) / TILE_SIZE));
        const maxCol = Math.min(12, Math.floor((maxX + this.arenaHalfWidth) / TILE_SIZE));
        const minRow = Math.max(0, Math.floor((this.arenaHalfDepth - maxZ) / TILE_SIZE));
        const maxRow = Math.min(12, Math.floor((this.arenaHalfDepth - minZ) / TILE_SIZE));

        let hitObstacleDetected = false;
        const EPSILON = 0.001;

        // 1. Find Closest World Obstacle Collision (if any)
        interface CandidateHit {
          distanceAlongDir: number;
          type: 'OBSTACLE' | 'TANK';
          contactPoint: Vector3;
          tileType?: TileType;
          row?: number;
          col?: number;
          targetTank?: 'PLAYER' | 'ENEMY';
          hitEnemy?: EnemyTank;
        }

        let closestHit: CandidateHit | null = null;

        for (let r = minRow; r <= maxRow; r++) {
          for (let c = minCol; c <= maxCol; c++) {
            const tileType = this.tileMap.getTileType(r, c);

            // Pass-through tiles for bullets: EMPTY, SPAWNS, BUSH, WATER
            if (
              tileType === TileType.EMPTY ||
              tileType === TileType.PLAYER_SPAWN ||
              tileType === TileType.ENEMY_SPAWN ||
              tileType === TileType.BUSH ||
              tileType === TileType.WATER ||
              tileType === null
            ) {
              continue;
            }

            // Query active solid boxes (for BRICK, returns only intact 1x1 quadrant boxes)
            const solidBoxes = this.tileMap.getSolidBoxesForCell(r, c, false);

            for (let b = 0; b < solidBoxes.length; b++) {
              const box = solidBoxes[b];
              const overlapX = maxX > box.minX + EPSILON && minX < box.maxX - EPSILON;
              const overlapZ = maxZ > box.minZ + EPSILON && minZ < box.maxZ - EPSILON;

              if (overlapX && overlapZ) {
                let contactX = currPos.x;
                let contactZ = currPos.z;
                let entryDist = 0;

                if (dir === Direction.NORTH) {
                  contactZ = box.minZ;
                  entryDist = box.minZ - currPos.z;
                } else if (dir === Direction.SOUTH) {
                  contactZ = box.maxZ;
                  entryDist = currPos.z - box.maxZ;
                } else if (dir === Direction.EAST) {
                  contactX = box.minX;
                  entryDist = box.minX - currPos.x;
                } else if (dir === Direction.WEST) {
                  contactX = box.maxX;
                  entryDist = currPos.x - box.maxX;
                }

                if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                  closestHit = {
                    distanceAlongDir: entryDist,
                    type: 'OBSTACLE',
                    contactPoint: new Vector3(contactX, currPos.y, contactZ),
                    tileType,
                    row: r,
                    col: c
                  };
                }
              }
            }
          }
        }

        // 2. Check Dynamic Vehicle Targets (Player vs Enemy, Enemy vs Player)
        const bulletTeam = bullet.getTeam();

        if (bulletTeam === ProjectileTeam.PLAYER) {
          // Player bullet can strike any active Enemy Tank (if active, not spawning, not destroyed)
          let enemies: EnemyTank[] = [];
          if (this.targetProvider) {
            if (this.targetProvider.getEnemies) {
              enemies = this.targetProvider.getEnemies();
            } else if (this.targetProvider.getEnemy) {
              const single = this.targetProvider.getEnemy();
              if (single) {
                enemies = [single];
              }
            }
          }

          for (let e = 0; e < enemies.length; e++) {
            const enemy = enemies[e];
            if (enemy && enemy.isActive() && !enemy.isDestroyed() && !enemy.isSpawning()) {
              const enemyBox = enemy.getAABB();
              const overlapX = maxX > enemyBox.minX + EPSILON && minX < enemyBox.maxX - EPSILON;
              const overlapZ = maxZ > enemyBox.minZ + EPSILON && minZ < enemyBox.maxZ - EPSILON;

              if (overlapX && overlapZ) {
                let contactX = currPos.x;
                let contactZ = currPos.z;
                let entryDist = 0;

                if (dir === Direction.NORTH) {
                  contactZ = enemyBox.minZ;
                  entryDist = enemyBox.minZ - currPos.z;
                } else if (dir === Direction.SOUTH) {
                  contactZ = enemyBox.maxZ;
                  entryDist = currPos.z - enemyBox.maxZ;
                } else if (dir === Direction.EAST) {
                  contactX = enemyBox.minX;
                  entryDist = enemyBox.minX - currPos.x;
                } else if (dir === Direction.WEST) {
                  contactX = enemyBox.maxX;
                  entryDist = currPos.x - enemyBox.maxX;
                }

                if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                  closestHit = {
                    distanceAlongDir: entryDist,
                    type: 'TANK',
                    contactPoint: new Vector3(contactX, currPos.y, contactZ),
                    targetTank: 'ENEMY',
                    hitEnemy: enemy
                  };
                }
              }
            }
          }
        } else if (bulletTeam === ProjectileTeam.ENEMY) {
          // Enemy bullet can strike Player Tank (if active, not destroyed, and not invulnerable or protected by AEGIS)
          const player = this.targetProvider?.getPlayer();
          const isAegis = this.combatModifiersProvider?.isAegisShieldActive?.() ?? false;
          if (player && !player.isDestroyed() && (!player.isInvulnerable() || isAegis)) {
            const playerBox = player.getAABB();
            const overlapX = maxX > playerBox.minX + EPSILON && minX < playerBox.maxX - EPSILON;
            const overlapZ = maxZ > playerBox.minZ + EPSILON && minZ < playerBox.maxZ - EPSILON;

            if (overlapX && overlapZ) {
              let contactX = currPos.x;
              let contactZ = currPos.z;
              let entryDist = 0;

              if (dir === Direction.NORTH) {
                contactZ = playerBox.minZ;
                entryDist = playerBox.minZ - currPos.z;
              } else if (dir === Direction.SOUTH) {
                contactZ = playerBox.maxZ;
                entryDist = currPos.z - playerBox.maxZ;
              } else if (dir === Direction.EAST) {
                contactX = playerBox.minX;
                entryDist = playerBox.minX - currPos.x;
              } else if (dir === Direction.WEST) {
                contactX = playerBox.maxX;
                entryDist = currPos.x - playerBox.maxX;
              }

              if (!closestHit || entryDist < closestHit.distanceAlongDir) {
                closestHit = {
                  distanceAlongDir: entryDist,
                  type: 'TANK',
                  contactPoint: new Vector3(contactX, currPos.y, contactZ),
                  targetTank: 'PLAYER'
                };
              }
            }
          }
        }

        // 3. Resolve Closest Hit (First Obstacle/Target Along Ray)
        if (closestHit) {
          hitObstacleDetected = true;

          if (closestHit.type === 'TANK') {
            if (closestHit.targetTank === 'ENEMY') {
              this.onEnemyHitCallback?.(closestHit.contactPoint, dir, closestHit.hitEnemy);
            } else if (closestHit.targetTank === 'PLAYER') {
              const isAegis = this.combatModifiersProvider?.isAegisShieldActive?.() ?? false;
              if (isAegis) {
                // Tactical AEGIS absorbs enemy projectile!
                this.onAegisShieldHitCallback?.(closestHit.contactPoint, dir);
              } else {
                this.onPlayerHitCallback?.(closestHit.contactPoint, dir);
              }
            }
            this.triggerImpact(closestHit.contactPoint, TileType.STEEL);
            bullet.deactivate();
            break;
          } else if (closestHit.type === 'OBSTACLE' && closestHit.tileType !== undefined) {
            const tileType = closestHit.tileType;
            const r = closestHit.row!;
            const c = closestHit.col!;
            const contactPoint = closestHit.contactPoint;

            this.lastHit = {
              type: tileType,
              row: r,
              column: c,
              worldPoint: { x: contactPoint.x, y: contactPoint.y, z: contactPoint.z },
              incomingDirection: dir
            };

            // Phase 5 Brick Destruction: Damage the struck quadrant and eject debris (identical for both teams)
            if (tileType === TileType.BRICK) {
              const dmgResult = this.tileMap.damageBrick(
                r,
                c,
                { x: contactPoint.x, z: contactPoint.z },
                dir
              );

              if (DEBUG) {
                console.log(
                  `[BRICK DAMAGE] Cell [${r}, ${c}] Quadrant: ${dmgResult.quadrant} FullyDestroyed: ${dmgResult.tileFullyDestroyed}`
                );
              }

              this.onBrickHitCallback?.(contactPoint, dir, dmgResult.quadrant !== null);
              // Spawn directional brick debris burst
              this.triggerDebris(contactPoint, dir);
            } else if (tileType === TileType.STEEL) {
              this.onSteelHitCallback?.(contactPoint, dir);
            } else if (tileType === TileType.BASE) {
              // Base Vulnerability (both player and enemy bullets destroy base)
              this.onBaseHitCallback?.(contactPoint, dir);
            }

            // Trigger lightweight impact burst
            this.triggerImpact(contactPoint, tileType);

            // Deactivate bullet immediately
            bullet.deactivate();
            break;
          }
        }

        if (hitObstacleDetected) {
          break; // Stop further substeps for this bullet
        }

        // Advance position if no collision occurred in this substep
        bullet.setPosition(nextX, currPos.y, nextZ);
      }

      bullet.update(deltaTime);
    }
  }

  /**
   * Disposes all pooled projectiles, impact meshes, debris meshes, and materials.
   */
  public dispose(): void {
    // Bullets
    for (let i = 0; i < this.pool.length; i++) {
      this.pool[i].dispose();
    }
    this.pool = [];
    this.sharedPlayerBulletMaterial.dispose();
    this.sharedEnemyBulletMaterial.dispose();

    // Muzzle flash pool & textures
    for (let i = 0; i < this.muzzleFlashPool.length; i++) {
      const f = this.muzzleFlashPool[i];
      f.hPlane.dispose();
      f.vPlane.dispose();
      f.coneMesh.dispose();
      f.mat.dispose();
      f.root.dispose();
    }
    this.muzzleFlashPool = [];
    if (this.playerBulletTexture) this.playerBulletTexture.dispose();
    if (this.enemyBulletTexture) this.enemyBulletTexture.dispose();
    if (this.playerFlashTexture) this.playerFlashTexture.dispose();
    if (this.enemyFlashTexture) this.enemyFlashTexture.dispose();

    // Impacts
    for (let i = 0; i < this.impactPool.length; i++) {
      const imp = this.impactPool[i];
      for (let j = 0; j < imp.meshes.length; j++) {
        imp.meshes[j].dispose();
      }
      imp.root.dispose();
    }
    this.impactPool = [];

    // Debris
    for (let i = 0; i < this.debrisPool.length; i++) {
      const d = this.debrisPool[i];
      for (let j = 0; j < d.particles.length; j++) {
        d.particles[j].mesh.dispose();
      }
      d.root.dispose();
    }
    this.debrisPool = [];
    this.brickDebrisMat.dispose();

    this.brickImpactMat.dispose();
    this.steelImpactMat.dispose();
    this.baseImpactMat.dispose();
    this.defaultImpactMat.dispose();
  }
}
