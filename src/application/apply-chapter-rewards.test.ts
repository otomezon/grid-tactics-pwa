import { describe, expect, it } from "vitest";
import { PROMOTION_ITEM_ID } from "../content/items";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { applyChapterRewards } from "./apply-chapter-rewards";

function clearedState(): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
  };
}

describe("applyChapterRewards with the class-promotion item", () => {
  it("grants the promotion seal only when an explicit chapter reward is supplied", () => {
    const state = clearedState();
    const initialRecipient = state.units.find((unit) => unit.id === "unit_001")!;
    expect(initialRecipient.inventory).not.toContain(PROMOTION_ITEM_ID);

    const withoutConfiguredReward = applyChapterRewards(state, CHAPTER_01_MAP, []);
    expect(withoutConfiguredReward.rewardsApplied).toEqual([]);
    expect(withoutConfiguredReward.nextState.units.find((unit) => unit.id === "unit_001")?.inventory)
      .not.toContain(PROMOTION_ITEM_ID);

    const withConfiguredReward = applyChapterRewards(state, CHAPTER_01_MAP, [{
      recipientUnitId: "unit_001",
      itemId: PROMOTION_ITEM_ID,
      quantity: 1
    }]);

    expect(withConfiguredReward.nextState.units.find((unit) => unit.id === "unit_001")?.inventory)
      .toContain(PROMOTION_ITEM_ID);
    expect(withConfiguredReward.rewardsApplied).toMatchObject([{
      recipientUnitId: "unit_001",
      recipientName: "主人公",
      itemId: PROMOTION_ITEM_ID,
      itemName: "クラスチェンジの証",
      quantity: 1
    }]);
    expect(initialRecipient.inventory).not.toContain(PROMOTION_ITEM_ID);
  });

  it("does not grant a promotion seal before a chapter victory", () => {
    expect(() => applyChapterRewards(INITIAL_GAME_STATE, CHAPTER_01_MAP, [{
      recipientUnitId: "unit_001",
      itemId: PROMOTION_ITEM_ID,
      quantity: 1
    }])).toThrow(/only be granted after a victory/);
  });

  it("rejects an explicit promotion reward when the recipient inventory is full without mutating the state", () => {
    const state = clearedState();
    state.units = state.units.map((unit) =>
      unit.id === "unit_001"
        ? {
            ...unit,
            inventory: ["iron_sword", "healing_potion", "promotion_seal", "iron_lance", "iron_axe"]
          }
        : unit
    );
    const originalInventory = [...state.units.find((unit) => unit.id === "unit_001")!.inventory];

    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [{
      recipientUnitId: "unit_001",
      itemId: PROMOTION_ITEM_ID,
      quantity: 1
    }])).toThrow(/does not have enough free slots/);

    expect(state.units.find((unit) => unit.id === "unit_001")?.inventory).toEqual(originalInventory);
    expect(state.units.find((unit) => unit.id === "unit_001")?.inventory)
      .toEqual(originalInventory);
  });
  it("does not partially apply earlier rewards when a later reward in the same batch is rejected", () => {
    const state = clearedState();
    state.units = state.units.map((unit) =>
      unit.id === "unit_001"
        ? {
            ...unit,
            inventory: ["iron_sword", "healing_potion", "promotion_seal", "iron_lance"]
          }
        : unit
    );
    const originalState = structuredClone(state);

    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [
      {
        recipientUnitId: "unit_001",
        itemId: PROMOTION_ITEM_ID,
        quantity: 1
      },
      {
        recipientUnitId: "unit_001",
        itemId: PROMOTION_ITEM_ID,
        quantity: 1
      }
    ])).toThrow(/does not have enough free slots/);

    expect(state).toEqual(originalState);
  });

});
