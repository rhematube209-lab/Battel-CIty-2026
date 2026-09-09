import { Vector3 } from '@babylonjs/core';
import { Direction } from '../game/Direction';
import { ENEMY_CONFIG, TileType, CONVEYOR_PUSH_SPEED } from '../game/constants';
import { EnemyTank } from '../entities/EnemyTank';
import { PlayerTank } from '../entities/PlayerTank';
import { TileMap } from '../world/TileMap';
import { CollisionSystem, BoxBounds } from './CollisionSystem';
import { ProjectileSystem } from './ProjectileSystem';

export enum EnemyState {
  SPAWNING = 'SPAWNING',
  PATROLLING = 'PATROLLING',
  ATTACKING = 'ATTACKING',
  REPOSITIONING = 'REPOSITIONING',
  DESTROYED = 'DESTROYED'
}

/**
 * EnemyAISystem orchestrates the autonomous FSM behavior for the enemy tank:
 * Spawning, cardinal path selection, base bias, obstacle avoidance,
 * target alignment (Base > Player), and combat firing.
 */
export class EnemyAISystem {
  private enemyTank: EnemyTank;
  private tileMap: TileMap;
  private collisionSystem: CollisionSystem;
  private getPlayerTank: () => PlayerTank | null;

  // FSM State
  private state: EnemyState = EnemyState.SPAWNING;

  // Timers
  private spawnTimer: number = ENEMY_CONFIG.SPAWN_DELAY;
  private decisionTimer: number = ENEMY_CONFIG.AI_DECISION_INTERVAL;
  private decisionInterval: number = ENEMY_CONFIG.AI_DECISION_INTERVAL;
  private stuckThreshold: number = ENEMY_CONFIG.STUCK_THRESHOLD;
  private baseBias: number = 0.60;
  private stuckTimer: number = 0;
  private lastPosition: Vector3 = new Vector3();

  // Attack timer to prevent infinite attack lock
  private attackCooldown: number = 0;

  // Phase 15 Cryo Floor Sliding State
  private isCryoSliding: boolean = false;
  private cryoSlideDirection: Direction | null = null;

  // Deterministic Seeded PRNG
  private initialSeed: number;
  private seed: number;

  constructor(
    enemyTank: EnemyTank,
    tileMap: TileMap,
    collisionSystem: CollisionSystem,
    getPlayerTank: () => PlayerTank | null,
    seed: number = ENEMY_CONFIG.AI_SEED
  ) {
    this.enemyTank = enemyTank;
    this.tileMap = tileMap;
    this.collisionSystem = collisionSystem;
    this.getPlayerTank = getPlayerTank;
    this.initialSeed = seed;
    this.seed = seed;

    this.lastPosition.copyFrom(this.enemyTank.getPosition());
  }

  /**
   * Configures AI parameters according to enemy archetype profile.
   */
  public configure(aiProfile: { decisionInterval: number; stuckThreshold: number; baseBias: number }): void {
    this.decisionInterval = aiProfile.decisionInterval;
    this.stuckThreshold = aiProfile.stuckThreshold;
    this.baseBias = aiProfile.baseBias;
    this.decisionTimer = this.decisionInterval;
  }

  /**
   * Returns a pseudo-random number in [0, 1) using seeded Linear Congruential Generator.
   */
  private nextRandom(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  public getState(): EnemyState {
    return this.state;
  }

  /**
   * Phase 15: Returns whether the enemy AI is currently in an active Cryo slide.
   */
  public isSliding(): boolean {
    return this.isCryoSliding;
  }

  /**
   * Phase 15: Returns current committed Cryo slide direction, or null if not sliding.
   */
  public getSlideDirection(): Direction | null {
    return this.cryoSlideDirection;
  }

  /**
   * Resets AI state and timers upon stage restart or slot respawn.
   */
  public reset(): void {
    this.state = EnemyState.SPAWNING;
    this.spawnTimer = ENEMY_CONFIG.SPAWN_DELAY;
    this.decisionTimer = this.decisionInterval;
    this.stuckTimer = 0;
    this.attackCooldown = 0;
    this.isCryoSliding = false;
    this.cryoSlideDirection = null;
    this.seed = this.initialSeed;
    this.lastPosition.copyFrom(this.enemyTank.getPosition());
    this.enemyTank.setSpawning(true);
  }

  /**
   * Main per-frame AI simulation step.
   */
  public update(
    deltaTime: number,
    projectileSystem: ProjectileSystem,
    extraAABBs?: BoxBounds[]
  ): void {
    if (this.enemyTank.isDestroyed()) {
      this.state = EnemyState.DESTROYED;
      return;
    }

    if (this.attackCooldown > 0) {
      this.attackCooldown -= deltaTime;
    }

    switch (this.state) {
      case EnemyState.SPAWNING:
        this.updateSpawning(deltaTime);
        break;

      case EnemyState.PATROLLING:
        this.updatePatrolling(deltaTime, projectileSystem, extraAABBs);
        break;

      case EnemyState.ATTACKING:
        this.updateAttacking(deltaTime, projectileSystem, extraAABBs);
        break;

      case EnemyState.REPOSITIONING:
        this.updateRepositioning(deltaTime, extraAABBs);
        break;

      case EnemyState.DESTROYED:
      default:
        break;
    }
  }

  /**
   * Spawning delay handling.
   */
  private updateSpawning(deltaTime: number): void {
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.state = EnemyState.PATROLLING;
      this.enemyTank.setSpawning(false);
      this.lastPosition.copyFrom(this.enemyTank.getPosition());
      this.decisionTimer = this.decisionInterval;
    }
  }

  /**
   * Patrol movement, target alignment checking, and stuck detection.
   */
  private updatePatrolling(
    deltaTime: number,
    projectileSystem: ProjectileSystem,
    extraAABBs?: BoxBounds[]
  ): void {
    const currentPos = this.enemyTank.getPosition();
    const surfaceInfo = this.tileMap.getSurfaceInfoAtWorldPosition(currentPos);
    const currentSurface = surfaceInfo.tileType;

    // If center left Cryo, clear active slide
    if (this.isCryoSliding && currentSurface !== TileType.CRYO) {
      this.isCryoSliding = false;
      this.cryoSlideDirection = null;
    }

    // Determine active direction
    let moveDir: Direction;
    if (this.isCryoSliding) {
      moveDir = this.cryoSlideDirection!;
    } else {
      moveDir = this.enemyTank.getDirection();
      if (currentSurface === TileType.CRYO) {
        this.isCryoSliding = true;
        this.cryoSlideDirection = moveDir;
      }
    }

    // 1. Check Target Alignment (Base > Player)
    // While sliding: turning is restricted. Can only fire if already aligned in slide direction!
    if (!this.isCryoSliding) {
      const alignedAttack = this.checkTargetAlignment();
      if (alignedAttack !== null && this.attackCooldown <= 0) {
        this.state = EnemyState.ATTACKING;
        this.enemyTank.setDirection(alignedAttack);
        this.tryFire(projectileSystem);
        this.attackCooldown = 0.4;
        return;
      }
    } else {
      const alignedAttack = this.checkTargetAlignment();
      if (alignedAttack === moveDir && this.attackCooldown <= 0) {
        this.tryFire(projectileSystem);
        this.attackCooldown = 0.4;
      }
    }

    // 2. Advance Movement in Current/Slide Direction (using archetype speed)
    const cmdSpeed = this.enemyTank.getSpeed();
    const cmdDist = cmdSpeed * deltaTime;
    const onConveyor = (currentSurface === TileType.CONVEYOR && surfaceInfo.conveyorDirection !== null);
    const convDir = surfaceInfo.conveyorDirection;
    const convDist = CONVEYOR_PUSH_SPEED * deltaTime;

    let cmdMoved = false;
    let finalX = currentPos.x;
    let finalZ = currentPos.z;

    if (!onConveyor) {
      const moveResult = this.collisionSystem.resolveMovement(
        currentPos.x,
        currentPos.z,
        moveDir,
        cmdDist,
        deltaTime,
        extraAABBs
      );
      finalX = moveResult.x;
      finalZ = moveResult.z;
      cmdMoved = moveResult.moved;

      this.enemyTank.applyMovement(finalX, finalZ, moveDir, cmdMoved, deltaTime);

      // Handle Cryo sliding exit/block
      if (this.isCryoSliding) {
        if (!moveResult.moved) {
          // Blocked on Cryo: cancel slide and reposition
          this.isCryoSliding = false;
          this.cryoSlideDirection = null;
          this.state = EnemyState.REPOSITIONING;
          return;
        } else {
          const newSurface = this.tileMap.getTileTypeAtWorldPosition(this.enemyTank.getPosition());
          if (newSurface !== TileType.CRYO) {
            this.isCryoSliding = false;
            this.cryoSlideDirection = null;
          }
        }
      } else {
        // Normal movement: check if entered Cryo
        if (moveResult.moved) {
          const newSurface = this.tileMap.getTileTypeAtWorldPosition(this.enemyTank.getPosition());
          if (newSurface === TileType.CRYO) {
            this.isCryoSliding = true;
            this.cryoSlideDirection = moveDir;
          }
        }
      }
    } else {
      // Enemy on Conveyor
      const isCollinear =
        (moveDir === convDir) ||
        (moveDir === Direction.NORTH && convDir === Direction.SOUTH) ||
        (moveDir === Direction.SOUTH && convDir === Direction.NORTH) ||
        (moveDir === Direction.EAST && convDir === Direction.WEST) ||
        (moveDir === Direction.WEST && convDir === Direction.EAST);

      if (isCollinear) {
        const netDist = (moveDir === convDir) ? (cmdDist + convDist) : (cmdDist - convDist);
        const resolveDir = netDist >= 0 ? moveDir : convDir!;
        const resolveDist = Math.abs(netDist);

        const moveResult = this.collisionSystem.resolveMovement(
          currentPos.x,
          currentPos.z,
          resolveDir,
          resolveDist,
          deltaTime,
          extraAABBs
        );
        finalX = moveResult.x;
        finalZ = moveResult.z;
        cmdMoved = moveResult.moved && (resolveDir === moveDir);

        this.enemyTank.applyMovement(finalX, finalZ, moveDir, moveResult.moved, deltaTime);

        if (moveResult.moved) {
          const newSurface = this.tileMap.getTileTypeAtWorldPosition(this.enemyTank.getPosition());
          if (newSurface === TileType.CRYO) {
            this.isCryoSliding = true;
            this.cryoSlideDirection = moveDir;
          }
        }
      } else {
        // Perpendicular: commanded along moveDir, then conveyor along convDir
        const res1 = this.collisionSystem.resolveMovement(
          currentPos.x,
          currentPos.z,
          moveDir,
          cmdDist,
          deltaTime,
          extraAABBs
        );
        cmdMoved = res1.moved;

        const res2 = this.collisionSystem.resolveMovement(
          res1.x,
          res1.z,
          convDir!,
          convDist,
          deltaTime,
          extraAABBs
        );
        finalX = res2.x;
        finalZ = res2.z;

        this.enemyTank.applyMovement(finalX, finalZ, moveDir, res1.moved || res2.moved, deltaTime);

        if (res1.moved || res2.moved) {
          const newSurface = this.tileMap.getTileTypeAtWorldPosition(this.enemyTank.getPosition());
          if (newSurface === TileType.CRYO) {
            this.isCryoSliding = true;
            this.cryoSlideDirection = moveDir;
          }
        }
      }
    }

    // 3. Stuck Detection (Req 25: Commanded movement blocked MUST trigger stuck even if conveyor drifts)
    const displacement = Vector3.Distance(currentPos, this.lastPosition);
    this.lastPosition.copyFrom(this.enemyTank.getPosition());

    if (!cmdMoved || (!onConveyor && displacement < 0.02)) {
      this.stuckTimer += deltaTime;
      if (this.stuckTimer >= this.stuckThreshold) {
        this.isCryoSliding = false;
        this.cryoSlideDirection = null;
        this.state = EnemyState.REPOSITIONING;
        return;
      }
    } else {
      this.stuckTimer = Math.max(0, this.stuckTimer - deltaTime * 0.5);
    }

    // 4. Periodic Direction Reconsideration (Paused while sliding)
    if (!this.isCryoSliding) {
      this.decisionTimer -= deltaTime;
      if (this.decisionTimer <= 0 || !cmdMoved) {
        this.chooseNewDirection(moveDir, extraAABBs);
        this.decisionTimer = this.decisionInterval;
      }
    }
  }

  /**
   * Attacking state: fired shot, face target, briefly pause or transition back.
   */
  private updateAttacking(
    _deltaTime: number,
    projectileSystem: ProjectileSystem,
    _extraAABBs?: BoxBounds[]
  ): void {
    // Attempt fire if ready
    this.tryFire(projectileSystem);

    // Transition back to PATROLLING after attacking
    this.state = EnemyState.PATROLLING;
    this.decisionTimer = this.decisionInterval;
  }

  /**
   * Repositioning state: picks a new valid direction excluding blocked path.
   */
  private updateRepositioning(_deltaTime: number, extraAABBs?: BoxBounds[]): void {
    const currentDir = this.enemyTank.getDirection();
    const newDir = this.pickRepositionDirection(currentDir, extraAABBs);

    this.enemyTank.setDirection(newDir);
    this.stuckTimer = 0;
    this.state = EnemyState.PATROLLING;
    this.decisionTimer = this.decisionInterval;
  }

  /**
   * Fires an enemy bullet through the projectile system.
   */
  private tryFire(projectileSystem: ProjectileSystem): boolean {
    return projectileSystem.tryFireEnemy(this.enemyTank);
  }

  /**
   * Inspects alignment with Command Base and PlayerTank.
   * Priority: Base > Player.
   * Returns firing direction or null.
   */
  public checkTargetAlignment(): Direction | null {
    const enemyPos = this.enemyTank.getPosition();
    const tol = ENEMY_CONFIG.AIM_TOLERANCE;

    // 1. High Priority: Base Alignment
    const base = this.tileMap.getBase();
    const basePos = this.tileMap.getBasePosition();
    if (base && !base.isDestroyed() && basePos) {
      // Column alignment (Same X)
      if (Math.abs(enemyPos.x - basePos.x) <= tol) {
        if (enemyPos.z > basePos.z) {
          return Direction.SOUTH;
        }
      }
      // Row alignment (Same Z)
      if (Math.abs(enemyPos.z - basePos.z) <= tol) {
        if (enemyPos.x < basePos.x) return Direction.EAST;
        if (enemyPos.x > basePos.x) return Direction.WEST;
      }
    }

    // 2. Secondary Priority: Player Alignment
    const player = this.getPlayerTank();
    if (player && !player.isDestroyed()) {
      const playerPos = player.getPosition();
      // Column alignment (Same X)
      if (Math.abs(enemyPos.x - playerPos.x) <= tol) {
        if (enemyPos.z > playerPos.z) return Direction.SOUTH;
        if (enemyPos.z < playerPos.z) return Direction.NORTH;
      }
      // Row alignment (Same Z)
      if (Math.abs(enemyPos.z - playerPos.z) <= tol) {
        if (enemyPos.x < playerPos.x) return Direction.EAST;
        if (enemyPos.x > playerPos.x) return Direction.WEST;
      }
    }

    return null;
  }

  /**
   * Evaluates available cardinal directions with base pressure bias and seeded selection.
   */
  private chooseNewDirection(currentDir: Direction, extraAABBs?: BoxBounds[]): void {
    const candidateDirs = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST];
    const validDirs: { dir: Direction; score: number }[] = [];

    const currentPos = this.enemyTank.getPosition();
    const testDistance = 0.4;

    for (let i = 0; i < candidateDirs.length; i++) {
      const dir = candidateDirs[i];
      let testX = currentPos.x;
      let testZ = currentPos.z;

      if (dir === Direction.NORTH) testZ += testDistance;
      else if (dir === Direction.SOUTH) testZ -= testDistance;
      else if (dir === Direction.EAST) testX += testDistance;
      else if (dir === Direction.WEST) testX -= testDistance;

      if (this.collisionSystem.isPositionValid(testX, testZ, extraAABBs)) {
        let score = 10;

        // Base pressure bias: Moving SOUTH toward base receives priority scaled by archetype bias
        if (dir === Direction.SOUTH) {
          score += Math.round(this.baseBias * 12);
        }

        // Slight preference to maintain current direction if clear
        if (dir === currentDir) {
          score += 3;
        }

        // Disfavor immediate 180° reverse unless forced
        if (this.isOppositeDirection(dir, currentDir)) {
          score -= 4;
        }

        validDirs.push({ dir, score });
      }
    }

    if (validDirs.length === 0) {
      // All candidate directions blocked, reverse as fallback
      this.enemyTank.setDirection(this.getOppositeDirection(currentDir));
      return;
    }

    // Sort by score descending
    validDirs.sort((a, b) => b.score - a.score);

    // Filter to top candidate scores
    const topScore = validDirs[0].score;
    const topCandidates = validDirs.filter((d) => d.score >= topScore - 2);

    // Pick using seeded PRNG
    const choiceIndex = Math.floor(this.nextRandom() * topCandidates.length);
    this.enemyTank.setDirection(topCandidates[choiceIndex].dir);
  }

  /**
   * Selects an escape direction during REPOSITIONING.
   */
  private pickRepositionDirection(failedDir: Direction, extraAABBs?: BoxBounds[]): Direction {
    const candidateDirs = [Direction.NORTH, Direction.EAST, Direction.SOUTH, Direction.WEST];
    const validDirs: Direction[] = [];

    const currentPos = this.enemyTank.getPosition();
    const testDist = 0.4;

    for (let i = 0; i < candidateDirs.length; i++) {
      const dir = candidateDirs[i];
      if (dir === failedDir) continue; // Exclude the direction where tank got stuck

      let testX = currentPos.x;
      let testZ = currentPos.z;
      if (dir === Direction.NORTH) testZ += testDist;
      else if (dir === Direction.SOUTH) testZ -= testDist;
      else if (dir === Direction.EAST) testX += testDist;
      else if (dir === Direction.WEST) testX -= testDist;

      if (this.collisionSystem.isPositionValid(testX, testZ, extraAABBs)) {
        validDirs.push(dir);
      }
    }

    if (validDirs.length > 0) {
      // Avoid 180° reverse if perpendicular options exist
      const nonReverse = validDirs.filter((d) => !this.isOppositeDirection(d, failedDir));
      const pool = nonReverse.length > 0 ? nonReverse : validDirs;
      const index = Math.floor(this.nextRandom() * pool.length);
      return pool[index];
    }

    // Default reverse if everything else is blocked
    return this.getOppositeDirection(failedDir);
  }

  private isOppositeDirection(a: Direction, b: Direction): boolean {
    if (a === Direction.NORTH && b === Direction.SOUTH) return true;
    if (a === Direction.SOUTH && b === Direction.NORTH) return true;
    if (a === Direction.EAST && b === Direction.WEST) return true;
    if (a === Direction.WEST && b === Direction.EAST) return true;
    return false;
  }

  private getOppositeDirection(dir: Direction): Direction {
    switch (dir) {
      case Direction.NORTH: return Direction.SOUTH;
      case Direction.SOUTH: return Direction.NORTH;
      case Direction.EAST:  return Direction.WEST;
      case Direction.WEST:  return Direction.EAST;
    }
  }
}
