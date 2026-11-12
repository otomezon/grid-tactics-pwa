import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { nextRandomUint32 } from "../domain/random/xorshift32";
import { getPromotionCombatComparison } from "./get-promotion-combat-comparison";

export interface PromotionCombatSampleMetrics {
  attackAttempts: number;
  attackHits: number;
  attackHitRate: number;
  criticalHits: number;
  criticalRateOnHit: number;
  totalAttackDamage: number;
  averageAttackDamagePerBattle: number;
  averageAttackDamagePerHit: number;
  enemyDefeats: number;
  enemyDefeatRate: number;
  counterAttempts: number;
  counterHits: number;
  counterHitRate: number;
  totalCounterDamage: number;
  averageCounterDamagePerBattle: number;
  attackerSurvivals: number;
  attackerSurvivalRate: number;
  averageAttackerHpRemaining: number;
  averageDefenderHpRemaining: number;
}

export interface PromotionCombatSampleSummary {
  sampleCount: number;
  firstSeed: number;
  lastSeed: number;
  control: PromotionCombatSampleMetrics;
  promotion: PromotionCombatSampleMetrics;
}

interface MutableMetrics {
  attackAttempts: number;
  attackHits: number;
  criticalHits: number;
  totalAttackDamage: number;
  enemyDefeats: number;
  counterAttempts: number;
  counterHits: number;
  totalCounterDamage: number;
  attackerSurvivals: number;
  totalAttackerHpRemaining: number;
  totalDefenderHpRemaining: number;
}

const SAMPLE_SEED_SALT = 0xa5a5a5a5;
const FALLBACK_SEED = 0x6d2b79f5;

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : roundOne((numerator / denominator) * 100);
}

/**
 * Creates a reproducible xorshift32 seed stream separate from the battle RNG
 * stream. Both branches receive the exact same seed for each paired sample.
 */
export function createPromotionCombatSampleSeeds(
  initialSeed: number,
  sampleCount: number
): number[] {
  if (!Number.isInteger(initialSeed) || initialSeed <= 0 || initialSeed > 0xffffffff) {
    throw new RangeError("Initial sample seed must be a non-zero unsigned 32-bit integer.");
  }
  if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 1000) {
    throw new RangeError("Sample count must be an integer from 1 through 1000.");
  }

  let state = (initialSeed ^ SAMPLE_SEED_SALT) >>> 0;
  if (state === 0) state = FALLBACK_SEED;

  const seeds: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    state = nextRandomUint32(state).state;
    seeds.push(state);
  }
  return seeds;
}

function createMutableMetrics(): MutableMetrics {
  return {
    attackAttempts: 0,
    attackHits: 0,
    criticalHits: 0,
    totalAttackDamage: 0,
    enemyDefeats: 0,
    counterAttempts: 0,
    counterHits: 0,
    totalCounterDamage: 0,
    attackerSurvivals: 0,
    totalAttackerHpRemaining: 0,
    totalDefenderHpRemaining: 0
  };
}

function addBattleToMetrics(
  metrics: MutableMetrics,
  events: ReturnType<typeof getPromotionCombatComparison>["control"]["result"]["events"],
  attackerId: string,
  defenderId: string,
  attackerHp: number,
  defenderHp: number
): void {
  for (const event of events) {
    if (event.attackerId === attackerId && event.defenderId === defenderId) {
      metrics.attackAttempts += 1;
      if (event.hit) {
        metrics.attackHits += 1;
        if (event.critical) metrics.criticalHits += 1;
      }
      metrics.totalAttackDamage += Math.max(0, event.defenderHpBefore - event.defenderHpAfter);
    } else if (event.attackerId === defenderId && event.defenderId === attackerId) {
      metrics.counterAttempts += 1;
      if (event.hit) metrics.counterHits += 1;
      metrics.totalCounterDamage += Math.max(0, event.defenderHpBefore - event.defenderHpAfter);
    }
  }

  if (defenderHp <= 0) metrics.enemyDefeats += 1;
  if (attackerHp > 0) metrics.attackerSurvivals += 1;
  metrics.totalAttackerHpRemaining += attackerHp;
  metrics.totalDefenderHpRemaining += defenderHp;
}

function finishMetrics(metrics: MutableMetrics, sampleCount: number): PromotionCombatSampleMetrics {
  return {
    attackAttempts: metrics.attackAttempts,
    attackHits: metrics.attackHits,
    attackHitRate: rate(metrics.attackHits, metrics.attackAttempts),
    criticalHits: metrics.criticalHits,
    criticalRateOnHit: rate(metrics.criticalHits, metrics.attackHits),
    totalAttackDamage: metrics.totalAttackDamage,
    averageAttackDamagePerBattle: roundOne(metrics.totalAttackDamage / sampleCount),
    averageAttackDamagePerHit: metrics.attackHits === 0
      ? 0
      : roundOne(metrics.totalAttackDamage / metrics.attackHits),
    enemyDefeats: metrics.enemyDefeats,
    enemyDefeatRate: rate(metrics.enemyDefeats, sampleCount),
    counterAttempts: metrics.counterAttempts,
    counterHits: metrics.counterHits,
    counterHitRate: rate(metrics.counterHits, metrics.counterAttempts),
    totalCounterDamage: metrics.totalCounterDamage,
    averageCounterDamagePerBattle: roundOne(metrics.totalCounterDamage / sampleCount),
    attackerSurvivals: metrics.attackerSurvivals,
    attackerSurvivalRate: rate(metrics.attackerSurvivals, sampleCount),
    averageAttackerHpRemaining: roundOne(metrics.totalAttackerHpRemaining / sampleCount),
    averageDefenderHpRemaining: roundOne(metrics.totalDefenderHpRemaining / sampleCount)
  };
}

/**
 * Repeats one isolated combat exchange from the same imported snapshots.
 * HP, EXP, defeated units, and other results never carry over between samples.
 * This is not a multi-turn battle or campaign win-rate simulation.
 */
export function getPromotionCombatSampleSummary(
  controlSnapshot: GameStateSnapshot,
  promotionSnapshot: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string,
  sampleCount: number
): PromotionCombatSampleSummary {
  if (controlSnapshot.rngState !== promotionSnapshot.rngState) {
    throw new Error("Control and promotion snapshots must share the initial RNG state.");
  }

  const seeds = createPromotionCombatSampleSeeds(controlSnapshot.rngState, sampleCount);
  const controlMetrics = createMutableMetrics();
  const promotionMetrics = createMutableMetrics();

  for (const seed of seeds) {
    const seededControl: GameStateSnapshot = { ...controlSnapshot, rngState: seed };
    const seededPromotion: GameStateSnapshot = { ...promotionSnapshot, rngState: seed };
    const comparison = getPromotionCombatComparison(
      seededControl,
      seededPromotion,
      map,
      attackerId,
      defenderId
    );

    addBattleToMetrics(
      controlMetrics,
      comparison.control.result.events,
      attackerId,
      defenderId,
      comparison.control.result.attackerHp,
      comparison.control.result.defenderHp
    );
    addBattleToMetrics(
      promotionMetrics,
      comparison.promotion.result.events,
      attackerId,
      defenderId,
      comparison.promotion.result.attackerHp,
      comparison.promotion.result.defenderHp
    );
  }

  return {
    sampleCount,
    firstSeed: seeds[0]!,
    lastSeed: seeds[seeds.length - 1]!,
    control: finishMetrics(controlMetrics, sampleCount),
    promotion: finishMetrics(promotionMetrics, sampleCount)
  };
}
