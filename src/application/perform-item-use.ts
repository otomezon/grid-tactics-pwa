import type { GameUnit, GameStateSnapshot } from "../domain/models/game";
import { INVENTORY_ITEMS_BY_ID } from "../content/items";

export interface ItemUseExecution {
  nextState: GameStateSnapshot;
  updatedUnit: GameUnit;
  usedItemId: string;
  healedHp: number;
}

/**
 * Uses one registered consumable on its owner. The item definition is resolved
 * from its ID so callers cannot supply an unregistered or altered effect.
 * An already-moved unit may still use an item, but this consumes its action.
 */
export function performItemUse(
  state: GameStateSnapshot,
  unitId: string,
  itemId: string
): ItemUseExecution {
  if (state.phase !== "player") {
    throw new Error("Items can only be used during the player phase.");
  }
  const item = INVENTORY_ITEMS_BY_ID[itemId];
  if (!item || item.category !== "consumable" || item.effect?.type !== "heal") {
    throw new Error("The requested inventory item is not a configured usable consumable.");
  }
  if (!Number.isInteger(item.effect.amount) || item.effect.amount <= 0) {
    throw new Error("The item effect amount must be a positive integer.");
  }

  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit) {
    throw new Error("The selected unit does not exist.");
  }
  if (unit.faction !== "player" || unit.currentHp <= 0) {
    throw new Error("Only living player units can use inventory items.");
  }
  if (unit.hasActed) {
    throw new Error("The selected unit has already acted.");
  }

  const itemIndex = unit.inventory.indexOf(itemId);
  if (itemIndex < 0) {
    throw new Error("The selected unit does not have this item.");
  }

  const missingHp = unit.stats.hp - unit.currentHp;
  if (missingHp <= 0) {
    throw new Error("The selected unit is already at full HP.");
  }

  const healedHp = Math.min(item.effect.amount, missingHp);
  const inventory = [...unit.inventory];
  inventory.splice(itemIndex, 1);
  const updatedUnit: GameUnit = {
    ...unit,
    currentHp: unit.currentHp + healedHp,
    inventory,
    hasActed: true
  };
  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === unitId ? updatedUnit : candidate
    )
  };

  return {
    nextState,
    updatedUnit,
    usedItemId: itemId,
    healedHp
  };
}
