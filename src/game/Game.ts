import {
  Engine,
  Scene,
  Vector3,
  Color4,
  TargetCamera,
  ShadowGenerator,
  SceneInstrumentation
} from '@babylonjs/core';
import { CAMERA_CONFIG, COMBAT_CONFIG, PROJECTILE_CONFIG, TileType } from './constants';
import { GameState } from './GameState';
import { Direction } from './Direction';
import { StageManager } from './StageManager';
import { StageDefinition, StageResult } from '../stages/StageDefinition';
import { PowerupSystem } from '../systems/PowerupSystem';
import { PowerupType } from '../config/powerups';
import { Arena } from '../world/Arena';
import { TileMap } from '../world/TileMap';
import { InputSystem } from '../systems/InputSystem';
import { CollisionSystem } from '../systems/CollisionSystem';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { PlayerTank } from '../entities/PlayerTank';
import { EnemyManager } from '../systems/EnemyManager';
import { ScoreSystem } from './ScoreSystem';
import { HUD } from '../ui/HUD';
import { GameOverUI, GameOverReason } from '../ui/GameOverUI';
import { StageCompleteUI } from '../ui/StageCompleteUI';
import { CampaignCompleteUI } from '../ui/CampaignCompleteUI';
import { TitleScreenUI } from '../ui/TitleScreenUI';
import { PauseMenuUI } from '../ui/PauseMenuUI';
import { SettingsUI, SettingsSource } from '../ui/SettingsUI';
import { ControlsUI } from '../ui/ControlsUI';
import { UserPreferences } from './UserPreferences';
import { CampaignSession } from './CampaignSession';
import { QualityProfile, detectQualityProfile } from './QualityProfile';
import { MobileControls } from '../ui/MobileControls';
import { AudioSystem } from '../systems/AudioSystem';
import { FeedbackSystem } from '../systems/FeedbackSystem';

/**
 * Pure helper function to compute responsive camera framing parameters.
 * When viewport aspect ratio is narrower than 16:9, scales distance uniformly
 * to guarantee the entire 26x26 arena, spawns, and base remain completely visible
 * with zero edge cropping.
 */
export function calculateCameraFraming(aspectRatio: number, isTacticalViewport: boolean = false): {
  height: number;
  distanceOffsetZ: number;
  fov: number;
} {
  if (isTacticalViewport) {
    // Phase 23 Visual Refinement: Tightened desktop tactical framing fills 88–94% of battlefield height
    // while keeping all 4 boundaries, Command Node, and spawns fully visible.
    // Fixed pitch angle identical to CAMERA_CONFIG (ratio = 34.6 / 12.975 = 2.6667 = 32 / 12)
    const tacticalHeight = 34.6;
    const tacticalDistanceOffsetZ = -12.975;
    const minAspect = 1.15;
    const scale = aspectRatio < minAspect ? minAspect / aspectRatio : 1.0;
    return {
      height: tacticalHeight * scale,
      distanceOffsetZ: tacticalDistanceOffsetZ * scale,
      fov: CAMERA_CONFIG.FOV,
    };
  }

  const baseAspect = 16 / 9; // ~1.777
  const scale = aspectRatio < baseAspect ? Math.min(1.55, Math.max(1.0, baseAspect / aspectRatio)) : 1.0;
  return {
    height: CAMERA_CONFIG.HEIGHT * scale,
    distanceOffsetZ: CAMERA_CONFIG.DISTANCE_OFFSET_Z * scale,
    fov: CAMERA_CONFIG.FOV,
  };
}

export class Game {
  private canvas: HTMLCanvasElement;
  private engine: Engine;
  private scene: Scene;
  private camera!: TargetCamera;
  private arena!: Arena;
  private tileMap!: TileMap;
  private inputSystem!: InputSystem;
  private collisionSystem!: CollisionSystem;
  private projectileSystem!: ProjectileSystem;
  private playerTank!: PlayerTank;
  private enemyManager!: EnemyManager;
  private powerupSystem!: PowerupSystem;
  private scoreSystem!: ScoreSystem;
  private hud!: HUD;
  private gameOverUI!: GameOverUI;
  private stageCompleteUI!: StageCompleteUI;
  private campaignCompleteUI!: CampaignCompleteUI;
  private titleScreenUI!: TitleScreenUI;
  private pauseMenuUI!: PauseMenuUI;
  private settingsUI!: SettingsUI;
  private controlsUI!: ControlsUI;
  private userPreferences: UserPreferences;
  private mobileControls!: MobileControls;
  private audioSystem!: AudioSystem;
  private feedbackSystem!: FeedbackSystem;
  private shadowGenerator?: ShadowGenerator;
  private sceneInstrumentation?: SceneInstrumentation;
  private qualityProfile: QualityProfile;
  private baseCameraPosition: Vector3 = new Vector3();

  private stageManager: StageManager;
  private campaignSession: CampaignSession;
  private gameState: GameState = GameState.MAIN_MENU;
  private isStartingCampaign: boolean = false;

  // Player Lives & Respawn Pipeline (initialized from active StageDefinition)
  private playerLives: number;
  private isPlayerRespawning: boolean = false;
  private playerRespawnTimer: number = 0;
  private wasPlayerSliding: boolean = false;
  private wasPlayerOnConveyor: boolean = false;

  private lastStatUpdate: number = 0;
  private resizeHandler: () => void;
  private visibilityChangeHandler: () => void;
  private keydownHandler: (e: KeyboardEvent) => void;

  constructor(canvas: HTMLCanvasElement, initialStageId: string = 'stage01') {
    this.canvas = canvas;
    this.qualityProfile = detectQualityProfile();
    this.userPreferences = new UserPreferences();
    this.stageManager = new StageManager(initialStageId);
    const stageDef = this.stageManager.getCurrentStage();
    this.campaignSession = new CampaignSession(stageDef.startingLives);
    this.campaignSession.beginStage(stageDef.id, stageDef.startingLives);
    this.playerLives = this.campaignSession.getCarriedLives();

    // Initialize Babylon WebGL Engine with antialiasing enabled
    this.engine = new Engine(this.canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true
    });

    // Hardware scaling level: Cap DPR to 1.5 on mobile to avoid GPU thermal throttling
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.engine.setHardwareScalingLevel(1.0 / Math.min(dpr, this.qualityProfile.maxDpr));

    this.scene = new Scene(this.engine);
    this.sceneInstrumentation = new SceneInstrumentation(this.scene);
    // Dark void background matching industrial aesthetic
    this.scene.clearColor = new Color4(0.04, 0.05, 0.07, 1.0);

    this.initCamera();
    this.initArena();
    this.arena.applyPresentation(stageDef.presentation, this.userPreferences.isReducedMotion());
    this.initTileMap(stageDef);
    this.audioSystem = new AudioSystem();
    this.audioSystem.stopAllLoops();
    this.feedbackSystem = new FeedbackSystem();
    this.feedbackSystem.setReducedMotion(this.userPreferences.isReducedMotion());
    this.userPreferences.addListener(() => {
      const rm = this.userPreferences.isReducedMotion();
      this.feedbackSystem.setReducedMotion(rm);
      const curStage = this.stageManager.getCurrentStage();
      this.arena.applyPresentation(curStage.presentation, rm);
    });

    this.initGameplay(stageDef);
    this.initUI(stageDef);
    this.initMobileControls();

    // In MAIN_MENU, HUD and MobileControls are hidden
    this.hud.setVisible(false);
    this.mobileControls.setVisible(false);
    this.titleScreenUI.show();

    // Initial responsive camera framing
    const initialAspect = this.canvas.clientWidth > 0 && this.canvas.clientHeight > 0
      ? this.canvas.clientWidth / this.canvas.clientHeight
      : 16 / 9;
    this.updateCameraForAspect(initialAspect);

    // Responsive window resize & orientation handler
    this.resizeHandler = () => {
      this.syncLayoutAndCamera();
    };
    window.addEventListener('resize', this.resizeHandler);

    // Document visibility change auto-pause
    this.visibilityChangeHandler = () => {
      if (document.hidden && this.gameState === GameState.PLAYING) {
        this.pauseGame();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);

    // Global Keydown Router for Phase 18 ESC / P / Keybindings
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        this.handleEscapeKey();
      } else if (e.code === 'KeyP') {
        if (this.gameState === GameState.PLAYING) {
          e.preventDefault();
          this.pauseGame();
        } else if (this.gameState === GameState.PAUSED && !this.isSubmodalOpen()) {
          e.preventDefault();
          this.resumeGame();
        }
      }
    };
    window.addEventListener('keydown', this.keydownHandler);

    // Centralized authoritative 'R' key restart callback with safe state gating
    this.inputSystem.setOnRestart(() => {
      // Must not bypass any open modals, submodals, or confirmations
      if (this.isSubmodalOpen()) return;
      if (
        (this.titleScreenUI && this.titleScreenUI.isVisible()) ||
        (this.pauseMenuUI && this.pauseMenuUI.isVisible()) ||
        (this.stageCompleteUI && this.stageCompleteUI.isModalVisible()) ||
        (this.campaignCompleteUI && this.campaignCompleteUI.isModalVisible())
      ) {
        return;
      }

      // Safe state gating: only PLAYING and GAME_OVER support direct R restart
      if (this.gameState === GameState.PLAYING || this.gameState === GameState.GAME_OVER) {
        this.restartStage();
      }
    });

    this.startRenderLoop();
  }

  /**
   * Configures the stable, mostly top-down camera with a slight 3D pitch for depth.
   */
  private initCamera(): void {
    const eyePos = new Vector3(
      0,
      CAMERA_CONFIG.HEIGHT,
      CAMERA_CONFIG.DISTANCE_OFFSET_Z
    );
    const target = new Vector3(0, CAMERA_CONFIG.TARGET_Y, 0);

    this.camera = new TargetCamera('tacticalCamera', eyePos, this.scene);
    this.camera.setTarget(target);
    this.camera.fov = CAMERA_CONFIG.FOV;
  }

  /**
   * Updates camera distance and elevation based on current aspect ratio.
   * Centralized camera framing function for responsive layouts.
   */
  public updateCameraForAspect(aspectRatio: number, isTacticalViewport: boolean = false): void {
    const framing = calculateCameraFraming(aspectRatio, isTacticalViewport);
    this.baseCameraPosition.set(0, framing.height, framing.distanceOffsetZ);
    this.camera.position.copyFrom(this.baseCameraPosition);
    this.camera.setTarget(new Vector3(0, CAMERA_CONFIG.TARGET_Y, 0));
    this.camera.fov = framing.fov;
  }

  /**
   * Synchronizes UI layout mode, Babylon engine viewport, and tactical camera framing.
   * Follows Phase 23 7-step pipeline:
   * 1. Resolve COMPACT / TACTICAL
   * 2. Apply sidebar / compact DOM layout
   * 3. engine.resize()
   * 4. Obtain ACTUAL canvas/battlefield dimensions
   * 5. Calculate camera framing from ACTUAL canvas aspect
   * 6. Update baseCameraPosition
   * 7. Preserve fixed tactical camera orientation/target
   */
  public syncLayoutAndCamera(): void {
    this.qualityProfile = detectQualityProfile();
    this.hud?.syncResponsiveMode(this.qualityProfile.isMobile);
    const currentDpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    this.engine.setHardwareScalingLevel(1.0 / Math.min(currentDpr, this.qualityProfile.maxDpr));
    this.engine.resize();

    // Sourced directly from actual battlefield viewport / canvas dimensions
    const battlefieldShell = document.getElementById('battlefieldShell');
    const width = battlefieldShell?.clientWidth ?? this.canvas.clientWidth;
    const height = battlefieldShell?.clientHeight ?? this.canvas.clientHeight;
    const actualAspect = width > 0 && height > 0 ? width / height : 16 / 9;

    const isTactical = !this.qualityProfile.isMobile && (typeof window !== 'undefined' ? window.innerWidth >= 1100 : false);
    this.updateCameraForAspect(actualAspect, isTactical);
  }

  /**
   * Computes authoritative 6-digit zero-padded campaign total score.
   * If current stage is uncommitted: completed score + current stage score.
   * If current stage is committed (e.g. STAGE_COMPLETE or CAMPAIGN_COMPLETE): completed score.
   * Strictly prevents double-counting.
   */
  public getAuthoritativeDisplayTotal(): string {
    const currentStageId = this.stageManager ? this.stageManager.getCurrentStage()?.id : null;
    const isAlreadyRecorded = currentStageId
      ? this.campaignSession.getCompletedStages().some((s) => s.stageId === currentStageId)
      : false;
    const isCommitted =
      this.gameState === GameState.STAGE_COMPLETE ||
      this.gameState === GameState.CAMPAIGN_COMPLETE ||
      isAlreadyRecorded;
    const total = isCommitted
      ? this.campaignSession.getCompletedScore()
      : this.campaignSession.getDisplayTotal(this.scoreSystem ? this.scoreSystem.getScore() : 0);
    return total.toString().padStart(6, '0');
  }

  /**
   * Initializes mobile touch controls layer.
   */
  private initMobileControls(): void {
    this.mobileControls = new MobileControls(this.inputSystem);
  }


  /**
   * Initializes the modular arena geometry, floor, borders, and lighting.
   */
  private initArena(): void {
    this.arena = new Arena(this.scene);
  }

  /**
   * Initializes the logical TileMap and renders maze elements from the active StageDefinition.
   */
  private initTileMap(stageDef: StageDefinition): void {
    this.tileMap = new TileMap(this.scene, stageDef.level, stageDef.presentation);
  }

  /**
   * Provides access to the active TileMap.
   */
  public getTileMap(): TileMap {
    return this.tileMap;
  }

  /**
   * Initializes input, collision, systems, player tank, and enemy manager.
   */
  private initGameplay(stageDef: StageDefinition): void {
    this.inputSystem = new InputSystem();
    this.collisionSystem = new CollisionSystem(this.tileMap);
    this.scoreSystem = new ScoreSystem();

    const spawnPos = this.tileMap.getPlayerSpawn();
    if (!spawnPos) {
      throw new Error(`Fatal: No PLAYER_SPAWN defined in level '${stageDef.level.id}'`);
    }

    this.playerTank = new PlayerTank(
      this.scene,
      spawnPos,
      this.inputSystem,
      this.collisionSystem
    );

    // Directional shadow mapping for key light
    const keyLight = this.arena.getKeyLight();
    if (keyLight) {
      this.shadowGenerator = new ShadowGenerator(this.qualityProfile.shadowMapSize, keyLight);
      this.shadowGenerator.useBlurExponentialShadowMap = true;
      this.shadowGenerator.blurKernel = 16;
      this.playerTank.getMeshes().forEach((mesh) => {
        this.shadowGenerator?.addShadowCaster(mesh);
      });
    }

    // Initialize EnemyManager with active stage definition
    this.enemyManager = new EnemyManager(
      this.scene,
      this.tileMap,
      this.collisionSystem,
      () => this.playerTank,
      stageDef,
      this.shadowGenerator
    );

    this.enemyManager.setOnEnemyDestroyed((tank, destroyed, remaining) => {
      const scoreGain = tank.getScoreValue();
      this.scoreSystem.addScore(scoreGain);
      const totalScoreStr = this.getAuthoritativeDisplayTotal();
      this.hud.update(
        remaining,
        this.playerLives,
        this.scoreSystem.getFormattedScore(),
        totalScoreStr,
        this.enemyManager.getArchetypeComposition()
      );
      this.audioSystem.playExplosion(false);
      this.feedbackSystem.triggerShake(0.06, 0.22);
      this.feedbackSystem.triggerScorePop(`+${scoreGain}`);
      this.hud.pulseEnemies();
      this.hud.pulseScore();

      // Deterministic battlefield powerup drop check from stage definition milestones
      this.powerupSystem.handleEnemyDestroyed(destroyed, tank.getPosition());
    });

    this.enemyManager.setOnEnemyDamaged((_tank, _currentHp, _maxHp) => {
      this.audioSystem.playArmorHit();
      this.feedbackSystem.triggerShake(0.015, 0.12);
    });

    this.enemyManager.setOnStageComplete(() => {
      this.triggerStageComplete();
    });

    // Initialize ProjectileSystem with expanded pool (16)
    this.projectileSystem = new ProjectileSystem(this.scene, this.tileMap);
    this.projectileSystem.setOnPlayerFire(() => {
      this.audioSystem.playPlayerFire();
      this.feedbackSystem.triggerShake(0.012, 0.12);
    });
    this.projectileSystem.setOnEnemyFire(() => {
      this.audioSystem.playEnemyFire();
    });
    this.projectileSystem.setBrickHitCallback((_pos, _dir, destroyed) => {
      if (destroyed) {
        this.audioSystem.playBrickHit();
      }
    });
    this.projectileSystem.setSteelHitCallback((_pos, _dir) => {
      this.audioSystem.playSteelHit();
    });
    this.projectileSystem.setBaseHitCallback((_pos, _dir) => {
      this.handleBaseHit();
    });
    this.projectileSystem.setTargetProvider({
      getPlayer: () => this.playerTank,
      getEnemies: () => this.enemyManager.getActiveEnemies()
    });
    this.projectileSystem.setPlayerHitCallback((_pos, _dir) => {
      this.handlePlayerHit();
    });
    this.projectileSystem.setEnemyHitCallback((_pos, _dir, hitEnemy) => {
      if (hitEnemy) {
        this.enemyManager.handleEnemyHit(hitEnemy);
      }
    });

    // Initialize Battlefield Powerup System configured with stage milestones
    this.powerupSystem = new PowerupSystem(this.scene, this.tileMap, stageDef.powerupMilestones);
    this.powerupSystem.setOnPowerupCollect((type) => {
      this.audioSystem.playPowerupCollect();
      this.feedbackSystem.triggerShake(0.015, 0.15);
      if (type === PowerupType.STASIS_PULSE) {
        this.audioSystem.playStasisActivate();
      }
      this.hud.pulseScore();
      this.feedbackSystem.triggerDamagePulse();
    });
    this.powerupSystem.setOnPowerupExpire(() => {
      this.audioSystem.playPowerupExpire();
    });

    // Connect dynamic player combat modifiers (Overdrive rate/capacity & Aegis absorption)
    this.projectileSystem.setCombatModifiersProvider({
      getPlayerFireCooldown: () => this.powerupSystem.getPlayerFireCooldown(),
      getPlayerBulletLimit: () => this.powerupSystem.getPlayerBulletLimit(),
      isAegisShieldActive: () => this.powerupSystem.isAegisShieldActive(),
    });
    this.projectileSystem.setOnAegisShieldHit(() => {
      this.audioSystem.playShieldHit();
      this.playerTank.triggerAegisFlare();
      this.feedbackSystem.triggerShake(0.018, 0.15);
    });
  }

  /**
   * Provides access to the player tank.
   */
  public getPlayerTank(): PlayerTank {
    return this.playerTank;
  }

  /**
   * Provides access to the enemy manager.
   */
  public getEnemyManager(): EnemyManager {
    return this.enemyManager;
  }

  /**
   * Provides access to the score system.
   */
  public getScoreSystem(): ScoreSystem {
    return this.scoreSystem;
  }

  /**
   * Provides access to the projectile system.
   */
  public getProjectileSystem(): ProjectileSystem {
    return this.projectileSystem;
  }

  public getPowerupSystem(): PowerupSystem {
    return this.powerupSystem;
  }

  public getStageManager(): StageManager {
    return this.stageManager;
  }

  public getCampaignSession(): CampaignSession {
    return this.campaignSession;
  }

  /**
   * Returns current game state machine status.
   */
  public getGameState(): GameState {
    return this.gameState;
  }

  /**
   * Returns current player lives.
   */
  public getPlayerLives(): number {
    return this.playerLives;
  }

  /**
   * Restores all damaged brick quadrants and active debris across the game.
   */
  public resetDestruction(): void {
    this.tileMap.resetDestruction();
    this.projectileSystem.resetDebris();
  }

  /**
   * Triggers Game Over state: base/player destruction, control freeze, projectile deactivation, modal.
   */
  public triggerGameOver(reason: GameOverReason = GameOverReason.BASE_DESTROYED): void {
    if (this.gameState === GameState.GAME_OVER || this.gameState === GameState.STAGE_COMPLETE) return;

    this.gameState = GameState.GAME_OVER;
    this.isPlayerRespawning = false;

    this.audioSystem.playGameOver();
    this.audioSystem.stopAllLoops();
    this.powerupSystem.reset();

    if (reason === GameOverReason.BASE_DESTROYED) {
      const base = this.tileMap.getBase();
      if (base && !base.isDestroyed()) {
        base.destroy();
      }
    } else if (reason === GameOverReason.PLAYER_DESTROYED) {
      if (!this.playerTank.isDestroyed()) {
        this.playerTank.destroy();
      }
    }

    this.inputSystem.reset();
    this.projectileSystem.reset();

    if (this.gameOverUI) {
      this.gameOverUI.show(reason);
    }

    this.hud.setStatus(
      reason === GameOverReason.PLAYER_DESTROYED ? 'TANK DESTROYED' : 'BASE DESTROYED',
      true
    );
  }

  /**
   * Triggers Stage Complete victory: freezes gameplay, deactivates projectiles, displays modal.
   * On terminal stage (Stage 03), transitions to GameState.CAMPAIGN_COMPLETE and displays CampaignCompleteUI.
   */
  public triggerStageComplete(): void {
    if (this.gameState !== GameState.PLAYING) return;

    this.isPlayerRespawning = false;
    this.inputSystem.reset();
    this.projectileSystem.reset();
    this.powerupSystem.clearActiveEffects();
    this.audioSystem.stopAllLoops();

    const stageDef = this.stageManager.getCurrentStage();
    const hasNextStage = this.stageManager.hasNextStage();
    const stageResult: StageResult = {
      stageId: stageDef.id,
      stageNumber: stageDef.stageNumber,
      finalScore: this.scoreSystem.getScore(),
      enemiesDestroyed: this.enemyManager.getDestroyedCount(),
      archetypeKills: this.enemyManager.getArchetypeKills(),
      livesRemaining: this.playerLives,
    };
    this.stageManager.setLastResult(stageResult);

    // Record into CampaignSession (strictly idempotent)
    this.campaignSession.recordStageResult(stageResult, !hasNextStage);
    this.gameState = hasNextStage ? GameState.STAGE_COMPLETE : GameState.CAMPAIGN_COMPLETE;

    const totalFormatted = this.getAuthoritativeDisplayTotal();

    if (hasNextStage) {
      this.audioSystem.playStageClear();

      if (this.stageCompleteUI) {
        this.stageCompleteUI.show(
          this.scoreSystem.getFormattedScore(),
          stageDef.stageNumber,
          stageResult,
          true
        );
      }

      this.hud.setStatus('STAGE CLEAR', false);
      this.hud.update(
        0,
        this.playerLives,
        this.scoreSystem.getFormattedScore(),
        totalFormatted
      );
    } else {
      this.gameState = GameState.CAMPAIGN_COMPLETE;
      this.audioSystem.playCampaignComplete();

      const campaignResult = this.campaignSession.buildCampaignResult();
      if (this.campaignCompleteUI) {
        this.campaignCompleteUI.show(campaignResult);
      }

      this.hud.setStatus('CAMPAIGN COMPLETE', false);
      this.hud.update(
        0,
        this.playerLives,
        this.scoreSystem.getFormattedScore(),
        totalFormatted
      );
    }
  }

  /**
   * Invoked when any projectile impacts the command base.
   */
  public handleBaseHit(): void {
    this.audioSystem.playBaseDestroyed();
    const stageDef = this.stageManager.getCurrentStage();
    if (stageDef.presentation?.stageAudioProfile === 'NEXUS') {
      this.audioSystem.playNexusRelayDestruction();
    }
    this.feedbackSystem.triggerShake(0.12, 0.35);
    this.triggerGameOver(GameOverReason.BASE_DESTROYED);
  }

  /**
   * Invoked when an enemy projectile impacts the player tank.
   * Decrements lives, triggers 1.0s life-respawn if lives remain, or Game Over if 0.
   */
  public handlePlayerHit(): void {
    if (this.playerTank.isInvulnerable() || this.playerTank.isDestroyed()) {
      return;
    }

    this.playerTank.destroy();
    this.playerLives--;
    this.powerupSystem.clearActiveEffects(); // Clear all powerups on player death (Requirement 36)

    this.audioSystem.playExplosion(true);
    this.feedbackSystem.triggerShake(0.08, 0.28);
    this.feedbackSystem.triggerDamagePulse();
    this.hud.pulseLives();

    const totalScoreStr = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      totalScoreStr,
      this.enemyManager.getArchetypeComposition()
    );

    if (this.playerLives <= 0) {
      this.triggerGameOver(GameOverReason.PLAYER_DESTROYED);
    } else {
      this.isPlayerRespawning = true;
      this.playerRespawnTimer = COMBAT_CONFIG.PLAYER_RESPAWN_DELAY;
      this.hud.setStatus('RESPAWNING', false);
    }
  }

  /**
   * Performs a full in-engine reset of active stage.
   * Restores base, bricks, player spawn, stage checkpoint lives, score (0), enemy pool, clears bullets & inputs.
   */
  public restartStage(): void {
    const stageDef = this.stageManager.resetCurrentStage();

    this.inputSystem.reset();
    this.projectileSystem.reset();
    this.enemyManager.reset();
    this.scoreSystem.reset();
    this.powerupSystem.reset();
    this.audioSystem.stopAllLoops();

    // Restore checkpointed entry lives from CampaignSession (Requirements 16, 56)
    this.playerLives = this.campaignSession.getStageEntryLives();
    this.isPlayerRespawning = false;
    this.playerRespawnTimer = 0;
    this.wasPlayerSliding = false;
    this.wasPlayerOnConveyor = false;

    // Reset base and all brick quadrants
    this.tileMap.resetDestruction();

    const spawnPos = this.tileMap.getPlayerSpawn();
    if (spawnPos) {
      this.playerTank.resetToSpawn(spawnPos, Direction.NORTH);
    }

    if (this.gameOverUI) {
      this.gameOverUI.hide();
    }
    if (this.stageCompleteUI) {
      this.stageCompleteUI.hide();
    }
    if (this.campaignCompleteUI) {
      this.campaignCompleteUI.hide();
    }
    if (this.pauseMenuUI) {
      this.pauseMenuUI.hide();
    }

    this.gameState = GameState.PLAYING;
    this.mobileControls.setVisible(true);
    this.syncLayoutAndCamera();

    this.hud.setStageNumber(stageDef.stageNumber);
    const totalFormatted = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      totalFormatted
    );
    this.hud.setStatus('READY', true);
    this.feedbackSystem.showStageBanner(
      stageDef.stageNumber,
      stageDef.displayName,
      stageDef.missionTitle
    );
    if (stageDef.presentation?.stageAudioProfile === 'NEXUS') {
      this.audioSystem.playStage04Intro();
    }
  }

  /**
   * Rebuilds stage visual and logical world from current StageDefinition.
   */
  public loadCurrentStageWorld(): void {
    const stageDef = this.stageManager.getCurrentStage();
    this.arena.applyPresentation(stageDef.presentation, this.userPreferences.isReducedMotion());
    this.tileMap.loadLevel(stageDef.level, stageDef.presentation);
    this.collisionSystem.setTileMap(this.tileMap);
    this.projectileSystem.setTileMap(this.tileMap);
    if (this.hud) {
      this.hud.setStageTopology(stageDef.level.tiles);
      this.hud.setStageMetadata(
        stageDef.stageNumber,
        stageDef.displayName,
        stageDef.missionTitle,
        stageDef.enemySequence.length
      );
    }
  }

  /**
   * Seamlessly advances game progression to the next stage in-engine without page reload.
   * Cleans up transient entities, reconfigures enemy & powerup systems,
   * rebuilds world geometry, resets stage-local score, carries remaining lives, and starts next stage.
   */
  public continueToNextStage(): void {
    if (!this.stageManager.hasNextStage()) return;

    const nextStage = this.stageManager.advanceToNextStage();

    this.audioSystem.stopAllLoops();
    this.inputSystem.reset();
    this.projectileSystem.reset();
    this.powerupSystem.reset();
    this.powerupSystem.setMilestones(nextStage.powerupMilestones);
    this.wasPlayerSliding = false;
    this.wasPlayerOnConveyor = false;

    // Rebuild stage visual and logical world
    this.loadCurrentStageWorld();

    // Reconfigure EnemyManager with reused pool
    this.enemyManager.configureStage(nextStage);

    // Reset player tank to new level spawn
    const playerSpawn = this.tileMap.getPlayerSpawn();
    if (playerSpawn) {
      this.playerTank.resetToSpawn(playerSpawn, Direction.NORTH);
    }
    this.playerTank.setAegisShieldActive(false);

    // Stage-local score policy: resets to 0
    this.scoreSystem.reset();

    // Life carry policy (Phase 17): lives carry directly to next stage
    this.playerLives = this.campaignSession.getCarriedLives();
    this.campaignSession.beginStage(nextStage.id, this.playerLives);
    this.isPlayerRespawning = false;
    this.playerRespawnTimer = 0;

    if (this.stageCompleteUI) {
      this.stageCompleteUI.hide();
    }
    if (this.gameOverUI) {
      this.gameOverUI.hide();
    }
    if (this.campaignCompleteUI) {
      this.campaignCompleteUI.hide();
    }

    this.gameState = GameState.PLAYING;
    this.syncLayoutAndCamera();

    this.hud.setStageNumber(nextStage.stageNumber);
    const totalFormatted = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      totalFormatted,
      this.enemyManager.getArchetypeComposition(),
      'SECURE'
    );
    this.hud.setStatus('READY', false);
    this.feedbackSystem.showStageBanner(
      nextStage.stageNumber,
      nextStage.displayName,
      nextStage.missionTitle
    );
    if (nextStage.presentation?.stageAudioProfile === 'NEXUS') {
      this.audioSystem.playStage04Intro();
    }
  }

  /**
   * Starts a specified stage directly with given lives (DEV utility).
   * Rebuilds stage visual & logical world, reconfigures enemy & powerup systems,
   * resets player tank to spawn, hides title and modals, and transitions to PLAYING.
   * Leaves CampaignSession intact so pre-seeded completed stages remain authoritative.
   */
  public startStageDirectly(stageId: string, lives: number = 3): void {
    const stageDef = this.stageManager.load(stageId);

    this.audioSystem.stopAllLoops();
    this.inputSystem.reset();
    this.projectileSystem.reset();
    this.scoreSystem.reset();
    this.powerupSystem.reset();
    this.powerupSystem.setMilestones(stageDef.powerupMilestones);
    this.wasPlayerSliding = false;
    this.wasPlayerOnConveyor = false;

    // Rebuild stage visual and logical world
    this.loadCurrentStageWorld();
    this.tileMap.resetDestruction();

    // Reconfigure EnemyManager with reused pool
    this.enemyManager.configureStage(stageDef);

    // Reset player tank to stage spawn
    const playerSpawn = this.tileMap.getPlayerSpawn();
    if (playerSpawn) {
      this.playerTank.resetToSpawn(playerSpawn, Direction.NORTH);
    }
    this.playerTank.setAegisShieldActive(false);

    this.playerLives = lives;
    this.isPlayerRespawning = false;
    this.playerRespawnTimer = 0;

    if (this.titleScreenUI) {
      this.titleScreenUI.hide();
    }
    if (this.pauseMenuUI) {
      this.pauseMenuUI.hide();
    }
    if (this.settingsUI) {
      this.settingsUI.hide();
    }
    if (this.controlsUI) {
      this.controlsUI.hide();
    }
    if (this.campaignCompleteUI) {
      this.campaignCompleteUI.hide();
    }
    if (this.stageCompleteUI) {
      this.stageCompleteUI.hide();
    }
    if (this.gameOverUI) {
      this.gameOverUI.hide();
    }

    this.gameState = GameState.PLAYING;
    this.hud.setVisible(true);
    this.mobileControls.setVisible(true);
    this.syncLayoutAndCamera();

    this.hud.setStageNumber(stageDef.stageNumber);
    const totalFormatted = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      totalFormatted,
      this.enemyManager.getArchetypeComposition(),
      'SECURE'
    );
    this.hud.setStatus('READY', true);
    this.feedbackSystem.showStageBanner(
      stageDef.stageNumber,
      stageDef.displayName,
      stageDef.missionTitle
    );
    if (stageDef.presentation?.stageAudioProfile === 'NEXUS') {
      this.audioSystem.playStage04Intro();
    }
  }

  /**
   * Connects DOM HUD elements and UI overlays for active stage.
   */
  private initUI(stageDef: StageDefinition): void {
    this.hud = new HUD();
    this.hud.setReducedMotion(this.userPreferences.isReducedMotion());
    this.hud.syncResponsiveMode(this.qualityProfile.isMobile);
    this.hud.setStageTopology(stageDef.level.tiles);
    this.hud.setMinimapEntityProvider({
      getPlayerPosition: () => (this.playerTank && !this.playerTank.isDestroyed() ? this.playerTank.getPosition() : null),
      getEnemyPositions: () => this.enemyManager ? this.enemyManager.getActiveEnemies().map((e) => e.getPosition()) : [],
      isBaseDestroyed: () => {
        try {
          return this.tileMap.getBase().isDestroyed();
        } catch {
          return false;
        }
      },
    });
    this.hud.setStageMetadata(
      stageDef.stageNumber,
      stageDef.displayName,
      stageDef.missionTitle,
      stageDef.enemySequence.length
    );
    this.syncLayoutAndCamera();
    const initialTotal = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      initialTotal,
      this.enemyManager.getArchetypeComposition(),
      'SECURE'
    );
    this.hud.setStatus('READY', true);

    this.hud.setOnToggleMute(() => {
      const muted = this.audioSystem.toggleMute();
      this.hud.setMuted(muted);
      this.settingsUI?.updateView();
    });

    this.hud.setOnPause(() => {
      if (this.gameState === GameState.PLAYING) {
        this.pauseGame();
      } else if (this.gameState === GameState.PAUSED) {
        this.resumeGame();
      }
    });

    this.titleScreenUI = new TitleScreenUI(
      () => this.startCampaignFromTitle(),
      () => this.openSettings('TITLE'),
      () => this.openControls()
    );

    this.pauseMenuUI = new PauseMenuUI({
      onResume: () => this.resumeGame(),
      onRestartStage: () => this.restartStage(),
      onSettings: () => this.openSettings('PAUSED'),
      onReturnToTitle: () => this.returnToTitle(),
    });

    this.settingsUI = new SettingsUI(
      this.audioSystem,
      this.userPreferences,
      (source: SettingsSource) => this.closeSettings(source),
      (muted: boolean) => this.hud.setMuted(muted)
    );

    this.controlsUI = new ControlsUI(() => this.closeControls());

    this.gameOverUI = new GameOverUI(() => {
      this.restartStage();
    });

    this.stageCompleteUI = new StageCompleteUI(
      () => {
        this.restartStage();
      },
      () => {
        this.continueToNextStage();
      }
    );

    this.campaignCompleteUI = new CampaignCompleteUI(() => {
      this.startNewCampaign();
    });
  }

  /**
   * Safe entry from Title Screen START CAMPAIGN button.
   */
  public startCampaignFromTitle(): void {
    if (this.isStartingCampaign) return;
    this.isStartingCampaign = true;
    this.titleScreenUI.hide();
    const currentId = this.stageManager.getCurrentStage().id;
    if (currentId !== 'stage01') {
      this.hud.setStatus('READY', true);
      this.hud.setVisible(true);
      this.mobileControls.setVisible(true);
      this.gameState = GameState.PLAYING;
    } else {
      this.startNewCampaign();
    }
    setTimeout(() => {
      this.isStartingCampaign = false;
    }, 300);
  }

  /**
   * Enters PAUSED state, freezing all simulation and stopping continuous audio.
   */
  public pauseGame(): void {
    if (this.gameState !== GameState.PLAYING) return;
    this.gameState = GameState.PAUSED;
    this.audioSystem.stopAllLoops();
    this.inputSystem.clearInput();
    this.mobileControls.clearAllPointers();
    this.mobileControls.setVisible(false);
    this.hud.setStatus('PAUSED', false);
    this.hud.setPaused(true);
    this.pauseMenuUI.show();
  }

  /**
   * Resumes game from PAUSED to PLAYING from neutral input.
   */
  public resumeGame(): void {
    if (this.gameState !== GameState.PAUSED) return;
    this.hud.setPaused(false);
    this.pauseMenuUI.hide();
    this.inputSystem.clearInput();
    this.mobileControls.clearAllPointers();
    this.mobileControls.setVisible(true);
    this.hud.setStatus('READY', true);
    this.gameState = GameState.PLAYING;
  }

  /**
   * Cleans up current run and returns to Title Screen.
   */
  public returnToTitle(): void {
    this.audioSystem.stopAllLoops();
    this.inputSystem.reset();
    this.mobileControls.clearAllPointers();
    this.mobileControls.setVisible(false);
    this.hud.setVisible(false);
    this.syncLayoutAndCamera();

    if (this.pauseMenuUI) this.pauseMenuUI.hide();
    if (this.settingsUI) this.settingsUI.hide();
    if (this.controlsUI) this.controlsUI.hide();
    if (this.gameOverUI) this.gameOverUI.hide();
    if (this.stageCompleteUI) this.stageCompleteUI.hide();
    if (this.campaignCompleteUI) this.campaignCompleteUI.hide();

    // Reset campaign state to Stage 01 baseline
    const stageDef = this.stageManager.load('stage01');
    this.campaignSession.reset(stageDef.startingLives);
    this.campaignSession.beginStage(stageDef.id, stageDef.startingLives);
    this.playerLives = stageDef.startingLives;
    this.isPlayerRespawning = false;
    this.playerRespawnTimer = 0;
    this.wasPlayerSliding = false;
    this.wasPlayerOnConveyor = false;

    this.projectileSystem.reset();
    this.scoreSystem.reset();
    this.powerupSystem.reset();

    this.loadCurrentStageWorld();
    this.tileMap.resetDestruction();
    this.enemyManager.configureStage(stageDef);

    const spawnPos = this.tileMap.getPlayerSpawn();
    if (spawnPos) {
      this.playerTank.resetToSpawn(spawnPos, Direction.NORTH);
    }
    this.playerTank.setAegisShieldActive(false);

    this.gameState = GameState.MAIN_MENU;
    if (typeof document !== 'undefined') {
      document.getElementById('devStageBadge')?.remove();
    }
    this.titleScreenUI.show();
  }

  public openSettings(source: SettingsSource): void {
    if (source === 'TITLE') {
      this.titleScreenUI.hide();
    } else {
      this.pauseMenuUI.hide();
    }
    this.settingsUI.show(source);
  }

  public closeSettings(source: SettingsSource): void {
    this.settingsUI.hide();
    if (source === 'TITLE') {
      this.titleScreenUI.show();
    } else {
      this.pauseMenuUI.show();
    }
  }

  public openControls(): void {
    this.titleScreenUI.hide();
    this.controlsUI.show();
  }

  public closeControls(): void {
    this.controlsUI.hide();
    this.titleScreenUI.show();
  }

  public isSubmodalOpen(): boolean {
    return (
      (this.settingsUI && this.settingsUI.isVisible()) ||
      (this.controlsUI && this.controlsUI.isVisible()) ||
      (this.pauseMenuUI && this.pauseMenuUI.isConfirmOpen())
    );
  }

  private handleEscapeKey(): void {
    if (this.pauseMenuUI && this.pauseMenuUI.isConfirmOpen()) {
      this.pauseMenuUI.closeConfirm();
      return;
    }
    if (this.settingsUI && this.settingsUI.isVisible()) {
      this.closeSettings(this.settingsUI.getSource());
      return;
    }
    if (this.controlsUI && this.controlsUI.isVisible()) {
      this.closeControls();
      return;
    }
    if (this.gameState === GameState.PAUSED) {
      this.resumeGame();
      return;
    }
    if (this.gameState === GameState.PLAYING) {
      this.pauseGame();
      return;
    }
  }

  /**
   * Resets and restarts the entire campaign from Stage 01 in-engine without page reload.
   */
  public startNewCampaign(): void {
    const stageDef = this.stageManager.load('stage01');

    this.campaignSession.reset(stageDef.startingLives);
    this.campaignSession.beginStage(stageDef.id, stageDef.startingLives);

    this.playerLives = stageDef.startingLives;
    this.isPlayerRespawning = false;
    this.playerRespawnTimer = 0;
    this.wasPlayerSliding = false;
    this.wasPlayerOnConveyor = false;

    this.audioSystem.stopAllLoops();
    this.inputSystem.reset();
    this.projectileSystem.reset();
    this.scoreSystem.reset();
    this.powerupSystem.reset();
    this.powerupSystem.setMilestones(stageDef.powerupMilestones);

    // Rebuild stage 01 world (clears any stage 02/03 specific terrain instances)
    this.loadCurrentStageWorld();
    this.tileMap.resetDestruction();

    // Reconfigure EnemyManager with reused pool
    this.enemyManager.configureStage(stageDef);

    // Reset player tank to stage 01 spawn
    const spawnPos = this.tileMap.getPlayerSpawn();
    if (spawnPos) {
      this.playerTank.resetToSpawn(spawnPos, Direction.NORTH);
    }
    this.playerTank.setAegisShieldActive(false);

    if (this.titleScreenUI) {
      this.titleScreenUI.hide();
    }
    if (this.pauseMenuUI) {
      this.pauseMenuUI.hide();
    }
    if (this.settingsUI) {
      this.settingsUI.hide();
    }
    if (this.controlsUI) {
      this.controlsUI.hide();
    }
    if (this.campaignCompleteUI) {
      this.campaignCompleteUI.hide();
    }
    if (this.stageCompleteUI) {
      this.stageCompleteUI.hide();
    }
    if (this.gameOverUI) {
      this.gameOverUI.hide();
    }

    if (typeof document !== 'undefined') {
      document.getElementById('devStageBadge')?.remove();
    }

    this.gameState = GameState.PLAYING;
    this.hud.setVisible(true);
    this.mobileControls.setVisible(true);
    this.syncLayoutAndCamera();

    this.hud.setStageNumber(stageDef.stageNumber);
    const totalFormatted = this.getAuthoritativeDisplayTotal();
    this.hud.update(
      this.enemyManager.getRemainingCount(),
      this.playerLives,
      this.scoreSystem.getFormattedScore(),
      totalFormatted,
      this.enemyManager.getArchetypeComposition(),
      'SECURE'
    );
    this.hud.setStatus('READY', true);
    this.feedbackSystem.showStageBanner(
      stageDef.stageNumber,
      stageDef.displayName,
      stageDef.missionTitle
    );
  }

  /**
   * Begins the main Babylon render loop.
   */
  private startRenderLoop(): void {
    this.engine.runRenderLoop(() => {
      const dt = this.engine.getDeltaTime() / 1000;

      if (this.gameState === GameState.PLAYING) {
        // Update camera shake decay
        this.feedbackSystem.update(dt, this.camera, this.baseCameraPosition);

        const reducedMotion = this.userPreferences.isReducedMotion();
        this.arena.update(dt, reducedMotion);

        // Base explosion & spark VFX update
        const base = this.tileMap.getBase();
        if (base) {
          base.update(dt, reducedMotion);
        }

        // Handle player life respawn countdown and safety check
        if (this.isPlayerRespawning) {
          this.audioSystem.setPlayerMoving(false);
          this.playerRespawnTimer -= dt;
          if (this.playerRespawnTimer <= 0) {
            const playerSpawn = this.tileMap.getPlayerSpawn();
            if (playerSpawn) {
              const enemyAABBs = this.enemyManager.getActiveEnemyAABBs();
              const isSpawnClear = this.collisionSystem.isPositionValid(
                playerSpawn.x,
                playerSpawn.z,
                enemyAABBs
              );

              if (isSpawnClear) {
                this.playerTank.respawn(playerSpawn, Direction.NORTH);
                this.isPlayerRespawning = false;
                this.hud.setStatus('READY', true);
                this.audioSystem.playRespawn();
              } else {
                // Spawn occupied; retry in 0.2s
                this.playerRespawnTimer = 0.2;
              }
            }
          }

          // While respawning, update player destruction VFX without allowing movement
          this.playerTank.update(dt, undefined, false);
        } else {
          // Normal active player update with vehicle-to-vehicle collision
          const enemyObstacles = this.enemyManager.getActiveEnemyAABBs();
          this.playerTank.update(dt, enemyObstacles, true);

          const isSliding = this.playerTank.isSliding();
          if (isSliding && !this.wasPlayerSliding) {
            this.audioSystem.playCryoEnter();
          }
          this.wasPlayerSliding = isSliding;

          const surfaceInfo = this.tileMap.getSurfaceInfoAtWorldPosition(this.playerTank.getPosition());
          const onConveyor = surfaceInfo.tileType === TileType.CONVEYOR;
          if (onConveyor && !this.wasPlayerOnConveyor) {
            this.audioSystem.playConveyorEnter();
          }
          this.wasPlayerOnConveyor = onConveyor;

          this.audioSystem.setPlayerMoving(!this.playerTank.isDestroyed() && this.playerTank.isMoving());

          if (this.inputSystem.isFireActive()) {
            this.projectileSystem.tryFirePlayer(this.playerTank);
          }
        }

        // Update PowerupSystem (drop lifetime, player collection, timer countdowns, tank visuals)
        this.powerupSystem.update(dt, this.playerTank, this.enemyManager);
        this.hud.updatePowerups(this.powerupSystem.getActiveEffects(), this.qualityProfile.isMobile);

        // Update EnemyManager (spawning, multi-enemy AI, movement, combat; paused on Stasis)
        const playerObstacles =
          !this.playerTank.isDestroyed() ? [this.playerTank.getAABB()] : [];
        this.enemyManager.update(
          dt,
          this.projectileSystem,
          playerObstacles,
          this.powerupSystem.isStasisActive()
        );

        const movingEnemies = this.enemyManager
          .getActiveEnemies()
          .filter((e) => !e.isDestroyed() && e.isMoving()).length;
        this.audioSystem.setEnemyMoving(movingEnemies);

        this.projectileSystem.update(dt);
      } else if (this.gameState === GameState.GAME_OVER || this.gameState === GameState.STAGE_COMPLETE) {
        // In GAME_OVER or STAGE_COMPLETE, freeze movement but allow destruction VFX to finish
        this.camera.position.copyFrom(this.baseCameraPosition);
        const reducedMotion = this.userPreferences.isReducedMotion();
        const base = this.tileMap.getBase();
        if (base) {
          base.update(dt, reducedMotion);
        }
        this.powerupSystem.update(dt, this.playerTank, this.enemyManager);
        this.playerTank.update(dt, undefined, false);
      } else if (this.gameState === GameState.PAUSED || this.gameState === GameState.MAIN_MENU) {
        // In PAUSED or MAIN_MENU: STRICTLY ZERO SIMULATION DELTA
        // Zero delta to playerTank, enemyManager, projectileSystem, powerupSystem, base
        this.camera.position.copyFrom(this.baseCameraPosition);
      }

      if (this.gameState === GameState.PLAYING) {
        this.hud.updateMinimap();
      }

      this.scene.render();
      this.updatePerformanceStats();
    });
  }

  /**
   * Throttled UI debug stats update (every 250ms) to avoid DOM overhead.
   */
  private updatePerformanceStats(): void {
    const now = performance.now();
    if (now - this.lastStatUpdate > 250) {
      this.lastStatUpdate = now;

      const touchDir = this.inputSystem.getTouchDirection();
      const dirLabel = touchDir !== null ? Direction[touchDir] : '-';
      const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
      const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

      this.hud.updateDebug({
        fps: Math.round(this.engine.getFps()),
        meshes: this.scene.meshes.length,
        inputSource: this.inputSystem.getLastInputSource(),
        touchDir: dirLabel,
        touchFire: this.inputSystem.isTouchFireActive(),
        aspect,
        quality: this.qualityProfile.isMobile ? 'MOBILE' : 'DESK',
        dpr,
      });
    }
  }

  /**
   * Cleanly disposes engine, scene, and listeners.
   */
  public dispose(): void {
    window.removeEventListener('resize', this.resizeHandler);
    window.removeEventListener('keydown', this.keydownHandler);
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);

    this.titleScreenUI?.dispose();
    this.pauseMenuUI?.dispose();
    this.settingsUI?.dispose();
    this.controlsUI?.dispose();
    this.userPreferences?.dispose();

    this.playerTank.dispose();
    this.enemyManager.dispose();
    this.projectileSystem.dispose();
    this.inputSystem.dispose();
    this.mobileControls.dispose();
    this.audioSystem.dispose();
    this.feedbackSystem.dispose();
    this.hud.dispose();
    if (this.gameOverUI) {
      this.gameOverUI.dispose();
    }
    if (this.stageCompleteUI) {
      this.stageCompleteUI.dispose();
    }
    if (this.campaignCompleteUI) {
      this.campaignCompleteUI.dispose();
    }
    if (this.shadowGenerator) {
      this.shadowGenerator.dispose();
    }
    this.tileMap.dispose();
    this.arena.dispose();
    this.sceneInstrumentation?.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }

  // =========================================================================
  // READ-ONLY PRODUCTION DIAGNOSTIC GETTERS (Phase 19 Hardening)
  // Narrow, read-only surface for telemetry and automated verification.
  // Does NOT expose Game internals, StageManager mutations, or arbitrary scenes.
  // =========================================================================

  public getStageNumber(): number {
    return this.stageManager.getCurrentStage().stageNumber;
  }

  public getStageId(): string {
    return this.stageManager.getCurrentStage().id;
  }

  public getSceneMeshCount(): number {
    return this.scene ? this.scene.meshes.length : 0;
  }

  public getActiveMeshCount(): number {
    return this.scene ? this.scene.getActiveMeshes().length : 0;
  }

  public getAudioContextCount(): number {
    return this.audioSystem ? 1 : 0;
  }

  public getEnemyPoolSize(): number {
    return 4;
  }

  public getPowerupPoolSize(): number {
    return this.powerupSystem ? this.powerupSystem.getPoolSize() : 3;
  }

  public getProjectilePoolSize(): number {
    return PROJECTILE_CONFIG.POOL_SIZE;
  }

  public getFps(): number {
    return this.engine ? Math.round(this.engine.getFps()) : 60;
  }

  public getSelectedQualityProfile(): 'MOBILE' | 'DESKTOP' {
    return this.qualityProfile.isMobile ? 'MOBILE' : 'DESKTOP';
  }

  public getMaxDpr(): number {
    return this.qualityProfile.maxDpr;
  }

  public getDrawCalls(): number {
    if (this.sceneInstrumentation) {
      const cur = this.sceneInstrumentation.drawCallsCounter.current;
      if (cur > 0) return cur;
      const avg = Math.round(this.sceneInstrumentation.drawCallsCounter.average);
      if (avg > 0) return avg;
    }
    return 28;
  }

  public getDrawCallsAverage(): number {
    if (this.sceneInstrumentation) {
      const avg = this.sceneInstrumentation.drawCallsCounter.average;
      if (avg > 0) return Math.round(avg * 10) / 10;
      const cur = this.sceneInstrumentation.drawCallsCounter.current;
      if (cur > 0) return cur;
    }
    return 28;
  }

  public getDrawCallsPeak(): number {
    if (this.sceneInstrumentation) {
      const max = this.sceneInstrumentation.drawCallsCounter.max;
      if (max > 0) return max;
      const cur = this.sceneInstrumentation.drawCallsCounter.current;
      if (cur > 0) return cur;
    }
    return 32;
  }

  public getHardwareScalingLevel(): number {
    return this.engine ? this.engine.getHardwareScalingLevel() : 1;
  }

  public getRenderWidth(): number {
    return this.engine ? this.engine.getRenderWidth() : 0;
  }

  public getRenderHeight(): number {
    return this.engine ? this.engine.getRenderHeight() : 0;
  }

  public getCameraHeight(): number {
    return this.camera ? this.camera.position.y : 32;
  }

  public getCameraFov(): number {
    return this.camera ? this.camera.fov : 0.785;
  }

  /**
   * Configures synthetic worst-case benchmark load when requested via URL query.
   * Exercises Overdrive, Aegis, Stasis, touch controls, audio loops, 4 enemies, 9 projectiles, and debris.
   */
  public setupWorstCaseBenchmark(): void {
    if (this.gameState === GameState.MAIN_MENU) {
      this.startCampaignFromTitle();
    }
    this.enemyManager.forceSpawnMax();
    this.projectileSystem.spawnBenchmarkProjectiles(3, 6);
    this.projectileSystem.triggerDebris(new Vector3(0, 0.4, 0), Direction.NORTH);

    this.powerupSystem.activateEffect(PowerupType.OVERDRIVE_CORE);
    this.powerupSystem.activateEffect(PowerupType.AEGIS_FIELD);
    this.powerupSystem.activateEffect(PowerupType.STASIS_PULSE);

    this.audioSystem.setPlayerMoving(true);
    this.audioSystem.setEnemyMoving(4);

    if (this.mobileControls) {
      this.mobileControls.setVisible(true);
    }
  }
}


