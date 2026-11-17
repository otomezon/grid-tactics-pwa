import { INVENTORY_ITEMS_BY_ID } from "../content/items";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import {
  ALL_SURVIVING_PLAYER_UNITS,
  type ChapterRewardDefinition,
  type ChapterRewardRecord
} from "../domain/progression/chapter-reward";

const MAX_INVENTORY_SIZE = 5;

export interface ApplyChapterRewardsResult {
  nextState: GameStateSnapshot;
  rewardsApplied: ChapterRewardRecord[];
}

/**
 * Adds explicitly configured chapter-clear items to living player units.
 * The group selector includes active and reserve party members. The whole
 * batch is returned only when every recipient has room for every item.
 */
export function applyChapterRewards(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  rewards: readonly ChapterRewardDefinition[]
): ApplyChapterRewardsResult {
  const stateForValidation: GameStateSnapshot = {
    ...state,
    units: state.units.filter((unit) => unit.currentHp > 0)
  };
  if (!isValidGameStateSnapshot(stateForValidation, map)) {
    throw new Error("The chapter state is invalid.");
  }
  if (evaluateBattleOutcome(state, map) !== "victory") {
    throw new Error("Chapter rewards can only be granted after a victory.");
  }

  let units = state.units;
  let reserveUnits = state.reserveUnits;
  const applied: ChapterRewardRecord[] = [];

  for (const reward of rewards) {
    if (
      !Number.isInteger(reward.quantity) ||
      reward.quantity < 1 ||
      reward.quantity > MAX_INVENTORY_SIZE
    ) {
      throw new Error("A chapter reward quantity must be an integer from 1 to 5.");
    }

    const item = INVENTORY_ITEMS_BY_ID[reward.itemId];
    if (!item) {
      throw new Error("Chapter reward item \"" + reward.itemId + "\" is not defined.");
    }

    const recipients = reward.recipientUnitId === ALL_SURVIVING_PLAYER_UNITS
      ? [
          ...units
            .filter((unit) => unit.faction === "player" && unit.currentHp > 0)
            .map((unit) => ({ unit, isReserve: false as const })),
          ...reserveUnits
            .filter((unit) => unit.currentHp > 0)
            .map((unit) => ({ unit, isReserve: true as const }))
        ]
      : [
          ...units
            .filter((unit) =>
              unit.id === reward.recipientUnitId &&
              unit.faction === "player" &&
              unit.currentHp > 0
            )
            .map((unit) => ({ unit, isReserve: false as const })),
          ...reserveUnits
            .filter((unit) =>
              unit.id === reward.recipientUnitId &&
              unit.currentHp > 0
            )
            .map((unit) => ({ unit, isReserve: true as const }))
        ];

    if (recipients.length === 0) {
      throw new Error(
        reward.recipientUnitId === ALL_SURVIVING_PLAYER_UNITS
          ? "There are no surviving player units to receive the chapter reward."
          : "Chapter reward recipient \"" + reward.recipientUnitId + "\" is not a surviving player unit."
      );
    }

    for (const recipientEntry of recipients) {
      const recipient = recipientEntry.unit;
      if (recipient.inventory.length + reward.quantity > MAX_INVENTORY_SIZE) {
        throw new Error(
          recipient.name + "'s inventory does not have enough free slots for the chapter reward."
        );
      }

      const nextInventory = [
        ...recipient.inventory,
        ...Array.from({ length: reward.quantity }, () => reward.itemId)
      ];
      if (recipientEntry.isReserve) {
        reserveUnits = reserveUnits.map((unit) =>
          unit.id === recipient.id
            ? { ...unit, inventory: nextInventory }
            : unit
        );
      } else {
        units = units.map((unit) =>
          unit.id === recipient.id
            ? { ...unit, inventory: nextInventory }
            : unit
        );
      }

      applied.push({
        recipientUnitId: recipient.id,
        itemId: reward.itemId,
        quantity: reward.quantity,
        recipientName: recipient.name,
        itemName: item.name
      });
    }
  }

  const nextState = { ...state, units, reserveUnits };
  if (!isValidGameStateSnapshot(nextState, map)) {
    throw new Error("The game state after applying chapter rewards is invalid.");
  }

  return { nextState, rewardsApplied: applied };
}
