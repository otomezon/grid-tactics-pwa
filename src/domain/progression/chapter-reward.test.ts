import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import { CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP } from "../../content/maps/chapter-02";
import { prepareNextChapter } from "../../application/prepare-next-chapter";
import { applyChapterRewards } from "../../application/apply-chapter-rewards";
import type { GameStateSnapshot } from "../models/game";
import type { ChapterRewardDefinition } from "./chapter-reward";

function victoryState(): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
  };
}

describe("applyChapterRewards", () => {
  it("grants configured items to the specified surviving player", () => {
    const state = victoryState();
    const rewards: ChapterRewardDefinition[] = [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 2 }
    ];
    const result = applyChapterRewards(state, CHAPTER_01_MAP, rewards);

    expect(result.nextState.units.find((unit) => unit.id === "unit_002")?.inventory)
      .toEqual(["weapon_bow", "promotion_seal", "promotion_seal"]);
    expect(result.rewardsApplied).toEqual([
      {
        recipientUnitId: "unit_002",
        itemId: "promotion_seal",
        quantity: 2,
        recipientName: "味方02",
        itemName: "クラスチェンジの証"
      }
    ]);
    expect(state.units.find((unit) => unit.id === "unit_002")?.inventory).toEqual(["weapon_bow"]);
  });

  it("returns an unchanged party when a chapter has no configured rewards", () => {
    const state = victoryState();
    const result = applyChapterRewards(state, CHAPTER_01_MAP, []);

    expect(result.nextState).toEqual(state);
    expect(result.rewardsApplied).toEqual([]);
  });

  it("does not grant rewards before victory", () => {
    expect(() => applyChapterRewards(INITIAL_GAME_STATE, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 1 }
    ])).toThrow(/only be granted after a victory/);
  });

  it("rejects defeated or missing recipients", () => {
    const state = victoryState();
    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_999", itemId: "promotion_seal", quantity: 1 }
    ])).toThrow(/surviving player unit/);
  });

  it("rejects undefined items and invalid quantities", () => {
    const state = victoryState();
    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "unknown_item", quantity: 1 }
    ])).toThrow(/not defined/);
    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 0 }
    ])).toThrow(/quantity must be an integer/);
  });

  it("carries chapter-clear rewards into the next chapter snapshot", () => {
    const result = applyChapterRewards(victoryState(), CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 1 }
    ]);
    const nextState = prepareNextChapter({
      previousState: result.nextState,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: CHAPTER_02_INITIAL_STATE,
      nextMap: CHAPTER_02_MAP,
      currentHpPolicy: "preserve"
    });

    expect(nextState.units.find((unit) => unit.id === "unit_002")?.inventory)
      .toEqual(["short_bow", "promotion_seal"]);
  });

  it("rejects a defeated reward recipient", () => {
    const state = victoryState();
    const defeatedRecipient = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === "unit_002" ? { ...unit, currentHp: 0 } : unit
      )
    };

    expect(() => applyChapterRewards(defeatedRecipient, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 1 }
    ])).toThrow(/surviving player unit/);
  });

  it("rejects a reward that would exceed the five-slot inventory limit", () => {
    const state = victoryState();
    const fullInventoryState = {
      ...state,
      units: state.units.map((unit) =>
        unit.id === "unit_002"
          ? { ...unit, inventory: ["short_bow", "promotion_seal", "promotion_seal", "promotion_seal", "promotion_seal"] }
          : unit
      )
    };

    expect(() => applyChapterRewards(fullInventoryState, CHAPTER_01_MAP, [
      { recipientUnitId: "unit_002", itemId: "promotion_seal", quantity: 1 }
    ])).toThrow(/does not have enough free slots/);
  });
});
