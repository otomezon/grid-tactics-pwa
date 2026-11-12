import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import type { AttackExecution } from "./perform-attack";
import { performAttack } from "./perform-attack";

export interface PromotionCombatBranch {
  forecast: AttackExecution["plan"]["forecast"];
  result: AttackExecution["result"];
  experienceAwarded: number;
  levelUps: AttackExecution["levelUps"];
  finalRngState: number;
}

export interface PromotionCombatComparison {
  startingRngState: number;
  control: PromotionCombatBranch;
  promotion: PromotionCombatBranch;
}

function getUnit(snapshot: GameStateSnapshot, unitId: string) {
  return snapshot.units.find((unit) => unit.id === unitId);
}

function getAttackReadyCopy(snapshot: GameStateSnapshot, attackerId: string): GameStateSnapshot {
  return {
    ...snapshot,
    units: snapshot.units.map((unit) =>
      unit.id === attackerId ? { ...unit, hasActed: false } : unit
    )
  };
}

function toBranch(execution: AttackExecution): PromotionCombatBranch {
  return {
    forecast: execution.plan.forecast,
    result: execution.result,
    experienceAwarded: execution.experienceAwarded,
    levelUps: execution.levelUps,
    finalRngState: execution.nextState.rngState
  };
}

/**
 * Runs one deterministic, isolated attack sample for both branches.
 * Promotion has already consumed the current turn's action. This helper
 * re-enables the attacker only on detached copies to model its next player
 * action opportunity; it does not simulate the intervening enemy phase.
 */
export function getPromotionCombatComparison(
  controlSnapshot: GameStateSnapshot,
  promotionSnapshot: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): PromotionCombatComparison {
  if (
    map.id !== controlSnapshot.chapterId ||
    map.id !== promotionSnapshot.chapterId ||
    controlSnapshot.chapterId !== promotionSnapshot.chapterId ||
    controlSnapshot.phase !== "player" ||
    promotionSnapshot.phase !== "player" ||
    controlSnapshot.turn !== promotionSnapshot.turn ||
    controlSnapshot.rngState !== promotionSnapshot.rngState
  ) {
    throw new Error("Combat branches must use the same chapter, player phase, turn, and starting RNG.");
  }

  const controlAttacker = getUnit(controlSnapshot, attackerId);
  const promotedAttacker = getUnit(promotionSnapshot, attackerId);
  const controlDefender = getUnit(controlSnapshot, defenderId);
  const promotedDefender = getUnit(promotionSnapshot, defenderId);
  if (!controlAttacker || !promotedAttacker || !controlDefender || !promotedDefender) {
    throw new Error("Both combat branches must contain the selected attacker and defender.");
  }

  const sameAttackPosition = (left: typeof controlAttacker, right: typeof promotedAttacker) =>
    left.id === right.id &&
    left.faction === right.faction &&
    left.currentHp === right.currentHp &&
    left.position.x === right.position.x &&
    left.position.y === right.position.y &&
    left.movementType === right.movementType &&
    left.move === right.move &&
    left.equippedWeaponId === right.equippedWeaponId &&
    JSON.stringify(left.usableWeaponTypes) === JSON.stringify(right.usableWeaponTypes);

  if (
    controlAttacker.faction !== "player" ||
    promotedAttacker.faction !== "player" ||
    controlAttacker.hasMoved ||
    promotedAttacker.hasMoved ||
    controlAttacker.hasActed ||
    !promotedAttacker.hasActed ||
    !sameAttackPosition(controlAttacker, promotedAttacker) ||
    controlDefender.faction !== "enemy" ||
    JSON.stringify(controlDefender) !== JSON.stringify(promotedDefender)
  ) {
    throw new Error("Combat branches must preserve the same ready attacker position, weapon access, and unchanged enemy.");
  }

  // performAttack uses the normal application/domain combat path. The copies
  // below are private values; neither imported snapshot is modified or saved.
  const controlExecution = performAttack(
    getAttackReadyCopy(controlSnapshot, attackerId),
    map,
    attackerId,
    defenderId
  );
  const promotionExecution = performAttack(
    getAttackReadyCopy(promotionSnapshot, attackerId),
    map,
    attackerId,
    defenderId
  );

  return {
    startingRngState: controlSnapshot.rngState,
    control: toBranch(controlExecution),
    promotion: toBranch(promotionExecution)
  };
}
