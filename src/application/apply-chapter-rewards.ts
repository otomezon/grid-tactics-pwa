import { INVENTORY_ITEMS_BY_ID } from "../content/items";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import type {
  ChapterRewardDefinition,
  ChapterRewardRecord
} from "../domain/progression/chapter-reward";

const MAX_INVENTORY_SIZE = 5;

export interface ApplyChapterRewardsResult {
  nextState: GameStateSnapshot;
  rewardsApplied: ChapterRewardRecord[];
}

/**
 * Adds explicitly configured chapter-clear items to surviving player units.
 * The command deliberately accepts reward data rather than inventing amounts,
 * recipients, or item pools. Items are not granted before a confirmed victory.
 */
export function applyChapterRewards(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  rewards: readonly ChapterRewardDefinition[]
): ApplyChapterRewardsResult {
  if (!isValidGameStateSnapshot(state, map)) {
    throw new Error("The chapter state is invalid.");
  }
  if (evaluateBattleOutcome(state, map) !== "victory") {
    throw new Error("Chapter rewards can only be granted after a victory.");
  }

  let units = state.units;
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
      throw new Error(`Chapter reward item "${reward.itemId}" is not defined.`);
    }

    const recipient = units.find((unit) => unit.id === reward.recipientUnitId);
    if (!recipient || recipient.faction !== "player" || recipient.currentHp <= 0) {
      throw new Error(`Chapter reward recipient "${reward.recipientUnitId}" is not a surviving player unit.`);
    }

    if (recipient.inventory.length + reward.quantity > MAX_INVENTORY_SIZE) {
      throw new Error(`${recipient.name}'s inventory does not have enough free slots for the chapter reward.`);
    }

    units = units.map((unit) =>
      unit.id === recipient.id
        ? {
            ...unit,
            inventory: [
              ...unit.inventory,
              ...Array.from({ length: reward.quantity }, () => reward.itemId)
            ]
          }
        : unit
    );

    applied.push({
      ...reward,
      recipientName: recipient.name,
      itemName: item.name
    });
  }

  const nextState = { ...state, units };
  if (!isValidGameStateSnapshot(nextState, map)) {
    throw new Error("The game state after applying chapter rewards is invalid.");
  }

  return { nextState, rewardsApplied: applied };
}
