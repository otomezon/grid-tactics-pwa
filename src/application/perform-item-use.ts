import type { GameUnit, GameStateSnapshot } from "../domain/models/game";
import type { InventoryItemDefinition } from "../content/items";

export interface ItemUseExecution {
  nextState: GameStateSnapshot;
  updatedUnit: GameUnit;
  usedItemId: string;
  healedHp: number;
}

/**
 * Uses one configured consumable on its owner. Healing amount is content data;
 * the application command enforces phase/action/inventory rules immutably.
 * An already-moved unit may still use an item, but this consumes its action.
 */
export function performItemUse(
  state: GameStateSnapshot,
  unitId: string,
  item: InventoryItemDefinition
): ItemUseExecution {
  if (state.phase !== "player") {
    throw new Error("Items can only be used during the player phase.");
  }
  if (item.category !== "consumable" || item.effect?.type !== "heal") {
    throw new Error("The requested inventory item is not a usable consumable.");
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

  const itemIndex = unit.inventory.indexOf(item.id);
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
    usedItemId: item.id,
    healedHp
  };
}
