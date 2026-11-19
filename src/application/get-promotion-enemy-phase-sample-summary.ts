import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { createPromotionCombatSampleSeeds } from "./get-promotion-combat-sample-summary";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";
import type { EnemyActionKind } from "./resolve-enemy-phase";
import { getWilsonScoreInterval, type WilsonScoreInterval } from "./wilson-score-interval";
import { summarizePairedBinaryOutcomes, type PairedBinaryOutcome, type PairedBinaryOutcomeSummary } from "./paired-binary-outcomes";

export interface PromotionEnemyPhaseMetrics {
  totalEnemyActions: number;
  enemyAttackActions: number;
  enemyMoveAndAttackActions: number;
  enemyMoveActions: number;
  enemyWaitActions: number;
  selectedUnitTargetedPhases: number;
  selectedUnitTargetedPhaseRate: number;
  selectedUnitTargetedPhaseRateInterval95: WilsonScoreInterval;
  selectedUnitSurvivals: number;
  selectedUnitSurvivalRate: number;
  selectedUnitSurvivalRateInterval95: WilsonScoreInterval;
  selectedUnitTotalDamage: number;
  selectedUnitAverageDamagePerPhase: number;
  averageSelectedUnitHpAfterActions: number;
  averageSelectedUnitHpAfterResolution: number;
  playerUnitDefeats: number;
  averagePlayerUnitDefeatsPerPhase: number;
  totalPlayerDamage: number;
  averageTotalPlayerDamagePerPhase: number;
  battleDefeats: number;
  battleDefeatRate: number;
  battleDefeatRateInterval95: WilsonScoreInterval;
  partyWipes: number;
  partyWipeRate: number;
  partyWipeRateInterval95: WilsonScoreInterval;
  playerPhaseAdvances: number;
  playerPhaseAdvanceRate: number;
  playerPhaseAdvanceRateInterval95: WilsonScoreInterval;
}

export interface PromotionEnemyPhaseSampleSummary {
  sampleCount: number;
  firstSeed: number;
  lastSeed: number;
  control: PromotionEnemyPhaseMetrics;
  promotion: PromotionEnemyPhaseMetrics;
  pairedOutcomes: {
    selectedUnitTargeted: PairedBinaryOutcomeSummary;
    selectedUnitSurvived: PairedBinaryOutcomeSummary;
    battleDefeat: PairedBinaryOutcomeSummary;
    partyWipe: PairedBinaryOutcomeSummary;
    playerPhaseAdvanced: PairedBinaryOutcomeSummary;
  };
}

interface MutableMetrics {
  totalEnemyActions: number;
  enemyAttackActions: number;
  enemyMoveAndAttackActions: number;
  enemyMoveActions: number;
  enemyWaitActions: number;
  selectedUnitTargetedPhases: number;
  selectedUnitSurvivals: number;
  selectedUnitTotalDamage: number;
  totalSelectedUnitHpAfterActions: number;
  totalSelectedUnitHpAfterResolution: number;
  playerUnitDefeats: number;
  totalPlayerDamage: number;
  battleDefeats: number;
  partyWipes: number;
  playerPhaseAdvances: number;
}

interface EnemyPhaseBinaryOutcomes {
  selectedUnitTargeted: boolean;
  selectedUnitSurvived: boolean;
  battleDefeat: boolean;
  partyWipe: boolean;
  playerPhaseAdvanced: boolean;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function rate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : roundOne((numerator / denominator) * 100);
}

function createMutableMetrics(): MutableMetrics {
  return {
    totalEnemyActions: 0,
    enemyAttackActions: 0,
    enemyMoveAndAttackActions: 0,
    enemyMoveActions: 0,
    enemyWaitActions: 0,
    selectedUnitTargetedPhases: 0,
    selectedUnitSurvivals: 0,
    selectedUnitTotalDamage: 0,
    totalSelectedUnitHpAfterActions: 0,
    totalSelectedUnitHpAfterResolution: 0,
    playerUnitDefeats: 0,
    totalPlayerDamage: 0,
    battleDefeats: 0,
    partyWipes: 0,
    playerPhaseAdvances: 0
  };
}

function assertComparableEnemyPhaseSnapshots(
  control: GameStateSnapshot,
  promotion: GameStateSnapshot,
  map: GameMapDefinition,
  selectedUnitId: string
): void {
  if (
    map.id !== control.chapterId ||
    map.id !== promotion.chapterId ||
    control.chapterId !== promotion.chapterId ||
    control.saveVersion !== promotion.saveVersion ||
    control.phase !== "player" ||
    promotion.phase !== "player" ||
    control.turn !== promotion.turn ||
    control.rngState !== promotion.rngState
  ) {
    throw new Error("Enemy-phase branches must share the same chapter, player phase, turn, and starting RNG.");
  }

  const controlSelected = control.units.find((unit) => unit.id === selectedUnitId);
  const promotionSelected = promotion.units.find((unit) => unit.id === selectedUnitId);
  if (
    !controlSelected ||
    !promotionSelected ||
    controlSelected.faction !== "player" ||
    promotionSelected.faction !== "player" ||
    controlSelected.currentHp <= 0 ||
    promotionSelected.currentHp <= 0 ||
    controlSelected.hasMoved ||
    promotionSelected.hasMoved ||
    controlSelected.hasActed ||
    !promotionSelected.hasActed ||
    controlSelected.currentHp !== promotionSelected.currentHp ||
    controlSelected.experience !== promotionSelected.experience ||
    controlSelected.position.x !== promotionSelected.position.x ||
    controlSelected.position.y !== promotionSelected.position.y
  ) {
    throw new Error("Enemy-phase branches must preserve the same living, unmoved unit, HP/EXP, and action/position context.");
  }

  const controlOtherUnits = control.units.filter((unit) => unit.id !== selectedUnitId);
  const promotionOtherUnits = promotion.units.filter((unit) => unit.id !== selectedUnitId);
  if (
    JSON.stringify(controlOtherUnits) !== JSON.stringify(promotionOtherUnits) ||
    JSON.stringify(control.reserveUnits) !== JSON.stringify(promotion.reserveUnits)
  ) {
    throw new Error("Enemy-phase branches must preserve all other units and reserve data.");
  }
}

function createControlWaitCopy(
  snapshot: GameStateSnapshot,
  selectedUnitId: string,
  seed: number
): GameStateSnapshot {
  return {
    ...snapshot,
    rngState: seed,
    units: snapshot.units.map((unit) =>
      unit.id === selectedUnitId ? { ...unit, hasActed: true } : unit
    )
  };
}

function createSeededPromotionCopy(
  snapshot: GameStateSnapshot,
  seed: number
): GameStateSnapshot {
  return { ...snapshot, rngState: seed };
}

function addEnemyPhaseToMetrics(
  metrics: MutableMetrics,
  initial: GameStateSnapshot,
  resolved: ReturnType<typeof runEnemyPhase>,
  selectedUnitId: string
): EnemyPhaseBinaryOutcomes {
  metrics.totalEnemyActions += resolved.actions.length;
  const actionKinds: readonly EnemyActionKind[] = ["attacked", "moved-and-attacked", "moved", "waited"];
  for (const kind of actionKinds) {
    const count = resolved.actions.filter((action) => action.kind === kind).length;
    if (kind === "attacked") metrics.enemyAttackActions += count;
    else if (kind === "moved-and-attacked") {
      metrics.enemyMoveAndAttackActions += count;
      metrics.enemyAttackActions += count;
    } else if (kind === "moved") metrics.enemyMoveActions += count;
    else metrics.enemyWaitActions += count;
  }

  const selectedUnitTargeted = resolved.actions.some((action) => action.targetId === selectedUnitId);
  if (selectedUnitTargeted) metrics.selectedUnitTargetedPhases += 1;

  // runEnemyPhase returns recovery applied when the next player phase starts.
  // Subtracting it isolates HP immediately after enemy actions, before that recovery.
  const recoveries = new Map(
    resolved.phaseStartRecoveries.map((entry) => [entry.unitId, entry.recoveredHp])
  );
  const resolvedUnits = new Map(resolved.nextState.units.map((unit) => [unit.id, unit]));
  const initialPlayers = initial.units.filter((unit) => unit.faction === "player" && unit.currentHp > 0);
  let phaseDamage = 0;
  let defeatedPlayers = 0;

  for (const player of initialPlayers) {
    const after = resolvedUnits.get(player.id);
    if (!after || after.currentHp <= 0) {
      defeatedPlayers += 1;
      phaseDamage += player.currentHp;
      continue;
    }
    const hpAfterActions = Math.max(0, after.currentHp - (recoveries.get(player.id) ?? 0));
    phaseDamage += Math.max(0, player.currentHp - hpAfterActions);
  }

  const selectedBefore = initialPlayers.find((unit) => unit.id === selectedUnitId);
  const selectedAfter = resolvedUnits.get(selectedUnitId);
  const selectedDefeated = !selectedAfter || selectedAfter.currentHp <= 0;
  const selectedRecovery = selectedDefeated ? 0 : recoveries.get(selectedUnitId) ?? 0;
  const selectedHpAfterResolution = selectedDefeated ? 0 : selectedAfter.currentHp;
  const selectedHpAfterActions = Math.max(0, selectedHpAfterResolution - selectedRecovery);

  if (selectedBefore && !selectedDefeated) metrics.selectedUnitSurvivals += 1;
  if (selectedBefore) {
    metrics.selectedUnitTotalDamage += Math.max(
      0,
      selectedBefore.currentHp - selectedHpAfterActions
    );
    metrics.totalSelectedUnitHpAfterActions += selectedHpAfterActions;
    metrics.totalSelectedUnitHpAfterResolution += selectedHpAfterResolution;
  }

  metrics.playerUnitDefeats += defeatedPlayers;
  metrics.totalPlayerDamage += phaseDamage;
  const battleDefeat = resolved.outcome === "defeat";
  if (battleDefeat) metrics.battleDefeats += 1;
  const partyWipe = initialPlayers.length > 0 && initialPlayers.every((player) => {
    const after = resolvedUnits.get(player.id);
    return !after || after.currentHp <= 0;
  });
  if (partyWipe) metrics.partyWipes += 1;
  const playerPhaseAdvanced = resolved.nextState.phase === "player" && resolved.nextState.turn === initial.turn + 1;
  if (playerPhaseAdvanced) metrics.playerPhaseAdvances += 1;

  return {
    selectedUnitTargeted,
    selectedUnitSurvived: Boolean(selectedBefore && !selectedDefeated),
    battleDefeat,
    partyWipe,
    playerPhaseAdvanced
  };
}

function finishMetrics(metrics: MutableMetrics, sampleCount: number): PromotionEnemyPhaseMetrics {
  return {
    totalEnemyActions: metrics.totalEnemyActions,
    enemyAttackActions: metrics.enemyAttackActions,
    enemyMoveAndAttackActions: metrics.enemyMoveAndAttackActions,
    enemyMoveActions: metrics.enemyMoveActions,
    enemyWaitActions: metrics.enemyWaitActions,
    selectedUnitTargetedPhases: metrics.selectedUnitTargetedPhases,
    selectedUnitTargetedPhaseRate: rate(metrics.selectedUnitTargetedPhases, sampleCount),
    selectedUnitTargetedPhaseRateInterval95: getWilsonScoreInterval(metrics.selectedUnitTargetedPhases, sampleCount),
    selectedUnitSurvivals: metrics.selectedUnitSurvivals,
    selectedUnitSurvivalRate: rate(metrics.selectedUnitSurvivals, sampleCount),
    selectedUnitSurvivalRateInterval95: getWilsonScoreInterval(metrics.selectedUnitSurvivals, sampleCount),
    selectedUnitTotalDamage: metrics.selectedUnitTotalDamage,
    selectedUnitAverageDamagePerPhase: roundOne(metrics.selectedUnitTotalDamage / sampleCount),
    averageSelectedUnitHpAfterActions: roundOne(metrics.totalSelectedUnitHpAfterActions / sampleCount),
    averageSelectedUnitHpAfterResolution: roundOne(metrics.totalSelectedUnitHpAfterResolution / sampleCount),
    playerUnitDefeats: metrics.playerUnitDefeats,
    averagePlayerUnitDefeatsPerPhase: roundOne(metrics.playerUnitDefeats / sampleCount),
    totalPlayerDamage: metrics.totalPlayerDamage,
    averageTotalPlayerDamagePerPhase: roundOne(metrics.totalPlayerDamage / sampleCount),
    battleDefeats: metrics.battleDefeats,
    battleDefeatRate: rate(metrics.battleDefeats, sampleCount),
    battleDefeatRateInterval95: getWilsonScoreInterval(metrics.battleDefeats, sampleCount),
    partyWipes: metrics.partyWipes,
    partyWipeRate: rate(metrics.partyWipes, sampleCount),
    partyWipeRateInterval95: getWilsonScoreInterval(metrics.partyWipes, sampleCount),
    playerPhaseAdvances: metrics.playerPhaseAdvances,
    playerPhaseAdvanceRate: rate(metrics.playerPhaseAdvances, sampleCount),
    playerPhaseAdvanceRateInterval95: getWilsonScoreInterval(metrics.playerPhaseAdvances, sampleCount)
  };
}

/**
 * Compares the existing deterministic enemy phase after either promoting the
 * selected unit or spending no action in the control branch. Both branches
 * enter the same enemy phase with that unit's action consumed.
 *
 * This reuses the current beginEnemyPhase/runEnemyPhase path, including enemy
 * movement, AI target selection, combat, and fort recovery. Both branches
 * share the same original battle snapshot except for the selected unit's
 * promotion result and consumed action. The control branch spends that action
 * by waiting; it is not a comparison against another player action. It is one
 * enemy phase only and does not simulate a player response or a complete chapter.
 */
export function getPromotionEnemyPhaseSampleSummary(
  controlSnapshot: GameStateSnapshot,
  promotionSnapshot: GameStateSnapshot,
  map: GameMapDefinition,
  selectedUnitId: string,
  sampleCount: number
): PromotionEnemyPhaseSampleSummary {
  assertComparableEnemyPhaseSnapshots(controlSnapshot, promotionSnapshot, map, selectedUnitId);

  const seeds = createPromotionCombatSampleSeeds(controlSnapshot.rngState, sampleCount);
  const controlMetrics = createMutableMetrics();
  const promotionMetrics = createMutableMetrics();
  const pairedOutcomes: {
    selectedUnitTargeted: PairedBinaryOutcome[];
    selectedUnitSurvived: PairedBinaryOutcome[];
    battleDefeat: PairedBinaryOutcome[];
    partyWipe: PairedBinaryOutcome[];
    playerPhaseAdvanced: PairedBinaryOutcome[];
  } = {
    selectedUnitTargeted: [],
    selectedUnitSurvived: [],
    battleDefeat: [],
    partyWipe: [],
    playerPhaseAdvanced: []
  };

  for (const seed of seeds) {
    const seededControl = createControlWaitCopy(controlSnapshot, selectedUnitId, seed);
    const seededPromotion = createSeededPromotionCopy(promotionSnapshot, seed);
    const controlPhase = beginEnemyPhase(seededControl, map);
    const promotionPhase = beginEnemyPhase(seededPromotion, map);
    const controlResult = runEnemyPhase(controlPhase.nextState, map);
    const promotionResult = runEnemyPhase(promotionPhase.nextState, map);

    const controlOutcomes = addEnemyPhaseToMetrics(controlMetrics, seededControl, controlResult, selectedUnitId);
    const promotionOutcomes = addEnemyPhaseToMetrics(promotionMetrics, seededPromotion, promotionResult, selectedUnitId);
    for (const key of Object.keys(pairedOutcomes) as Array<keyof typeof pairedOutcomes>) {
      pairedOutcomes[key].push({
        control: controlOutcomes[key],
        promotion: promotionOutcomes[key]
      });
    }
  }

  return {
    sampleCount,
    firstSeed: seeds[0]!,
    lastSeed: seeds[seeds.length - 1]!,
    control: finishMetrics(controlMetrics, sampleCount),
    promotion: finishMetrics(promotionMetrics, sampleCount),
    pairedOutcomes: {
      selectedUnitTargeted: summarizePairedBinaryOutcomes(pairedOutcomes.selectedUnitTargeted),
      selectedUnitSurvived: summarizePairedBinaryOutcomes(pairedOutcomes.selectedUnitSurvived),
      battleDefeat: summarizePairedBinaryOutcomes(pairedOutcomes.battleDefeat),
      partyWipe: summarizePairedBinaryOutcomes(pairedOutcomes.partyWipe),
      playerPhaseAdvanced: summarizePairedBinaryOutcomes(pairedOutcomes.playerPhaseAdvanced)
    }
  };
}
