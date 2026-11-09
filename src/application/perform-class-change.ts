import { getPromotionTargetClassId } from "../content/classes";
import type { GameStateSnapshot, GameUnit, UnitStats } from "../domain/models/game";
import {
  applyClassPromotion,
  type ClassPromotionDefinition
} from "../domain/progression/class-change";

export interface ClassChangeExecution {
  nextState: GameStateSnapshot;
  promotedUnit: GameUnit;
  consumedItemId: string;
  appliedBonuses: Partial<UnitStats>;
}

/**
 * Applies one configured player-unit promotion and returns an immutable state.
 * Item grants, UI, and final promotion balance are intentionally owned by later
 * content work; this command requires every unresolved value explicitly.
 */
export function performClassChange(
  state: GameStateSnapshot,
  unitId: string,
  definition: ClassPromotionDefinition
): ClassChangeExecution {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    throw new Error("The selected unit does not exist.");
  }

  const expectedTarget = getPromotionTargetClassId(unit.classId);
  if (!expectedTarget || definition.toClassId !== expectedTarget) {
    throw new Error("The configured target is not the promotion class for this unit.");
  }

  const promotion = applyClassPromotion(unit, definition);
  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === unitId ? promotion.unit : candidate
    )
  };

  return {
    nextState,
    promotedUnit: promotion.unit,
    consumedItemId: promotion.consumedItemId,
    appliedBonuses: promotion.appliedBonuses
  };
}
