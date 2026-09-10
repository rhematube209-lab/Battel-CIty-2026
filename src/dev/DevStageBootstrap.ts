import { StageDefinition, StageResult } from '../stages/StageDefinition';
import { stageRegistry, StageRegistry } from '../stages/stageRegistry';
import { EnemyArchetypeId, ENEMY_ARCHETYPES } from '../config/enemyArchetypes';
import type { Game } from '../game/Game';

export const DEV_BADGE_ID = 'devStageBadge';

/**
 * Calculates synthetic StageResult dynamically from a StageDefinition's enemySequence
 * and the authoritative ENEMY_ARCHETYPES scoring values.
 * Strictly avoids hardcoding stage scores or tallies.
 */
export function deriveStageResult(stageDef: StageDefinition, livesRemaining: number): StageResult {
  const archetypeKills: Record<EnemyArchetypeId, number> = {
    [EnemyArchetypeId.STANDARD]: 0,
    [EnemyArchetypeId.FAST]: 0,
    [EnemyArchetypeId.ARMOR]: 0,
  };

  let finalScore = 0;
  for (const archetype of stageDef.enemySequence) {
    archetypeKills[archetype] = (archetypeKills[archetype] ?? 0) + 1;
    finalScore += ENEMY_ARCHETYPES[archetype]?.scoreValue ?? 0;
  }

  return {
    stageId: stageDef.id,
    stageNumber: stageDef.stageNumber,
    finalScore,
    enemiesDestroyed: stageDef.enemySequence.length,
    archetypeKills,
    livesRemaining: Math.max(1, livesRemaining),
  };
}

/**
 * Traverses campaign progression links in stageRegistry starting from 'stage01'
 * to collect all stages preceding targetStageId in order.
 */
export function getPrecedingStages(
  targetStageId: string,
  registry: StageRegistry = stageRegistry
): StageDefinition[] {
  if (targetStageId === 'stage01') {
    return [];
  }

  const result: StageDefinition[] = [];
  let current: StageDefinition | null = registry.getStageDefinition('stage01');

  while (current && current.id !== targetStageId) {
    result.push(current);
    if (!current.nextStageId) break;
    current = registry.getStageDefinition(current.nextStageId);
  }

  // If targetStageId was not reached along the progression chain, return empty
  if (!current || current.id !== targetStageId) {
    return [];
  }

  return result;
}

/**
 * Parses and clamps optional dev lives query parameter.
 * Default: 3, clamped between 1 and 99.
 */
export function parseDevLives(val: string | null | undefined, defaultLives: number = 3): number {
  if (!val) return defaultLives;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) return defaultLives;
  return Math.min(Math.max(parsed, 1), 99);
}

/**
 * Injects an unobtrusive DEV indicator badge into the DOM.
 */
export function attachDevBadge(stageDisplayName: string): void {
  removeDevBadge();
  if (typeof document === 'undefined') return;

  const badge = document.createElement('div');
  badge.id = DEV_BADGE_ID;
  badge.textContent = `DEV — DIRECT ${stageDisplayName.toUpperCase()}`;
  badge.setAttribute('data-testid', 'dev-stage-badge');
  badge.style.cssText = `
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    font-family: 'Courier New', monospace;
    font-size: 11px;
    font-weight: 700;
    color: #00e5ff;
    background: rgba(10, 15, 25, 0.88);
    border: 1px solid rgba(0, 229, 255, 0.5);
    border-radius: 4px;
    padding: 3px 10px;
    letter-spacing: 1.5px;
    pointer-events: none;
    z-index: 10000;
    box-shadow: 0 0 10px rgba(0, 229, 255, 0.25);
    text-shadow: 0 0 4px rgba(0, 229, 255, 0.8);
  `;
  document.body.appendChild(badge);
}

/**
 * Removes the DEV indicator badge from the DOM if present.
 */
export function removeDevBadge(): void {
  if (typeof document === 'undefined') return;
  const existing = document.getElementById(DEV_BADGE_ID);
  if (existing) {
    existing.remove();
  }
}

/**
 * Authoritative DEV bootstrap utility.
 * Configures CampaignSession with synthetic completed results for all stages
 * preceding targetStageId, checkpoints entry lives, and starts the target stage directly.
 */
export function applyDevStageBootstrap(
  game: Game,
  stageId: string,
  rawDevLives?: string | null
): boolean {
  const stageDef = stageRegistry.getStageDefinition(stageId);
  if (!stageDef) {
    console.warn(`[DevStageBootstrap] Stage '${stageId}' not found in registry. Ignoring devStage.`);
    return false;
  }

  const devLives = parseDevLives(rawDevLives, stageDef.startingLives);
  const precedingStages = getPrecedingStages(stageId);

  const session = game.getCampaignSession();
  session.start(devLives);

  // Pre-seed all preceding stages with synthetic completed results
  for (const priorDef of precedingStages) {
    const syntheticResult = deriveStageResult(priorDef, devLives);
    session.recordStageResult(syntheticResult, false);
  }

  // Checkpoint entry state for the requested stage
  session.beginStage(stageDef.id, devLives);

  // Start target stage directly in the engine
  game.startStageDirectly(stageDef.id, devLives);

  // Mount visual DEV badge
  attachDevBadge(stageDef.displayName);

  console.info(
    `[DevStageBootstrap] Direct stage active: ${stageDef.displayName} (${stageDef.id}) | ` +
    `Seeded Prior Stages: ${precedingStages.length} | ` +
    `Completed Score: ${session.getCompletedScore()} | ` +
    `Lives: ${devLives}`
  );

  return true;
}
