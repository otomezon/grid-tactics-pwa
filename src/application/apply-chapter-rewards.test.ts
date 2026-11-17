import { describe, expect, it } from "vitest";
import { PROMOTION_ITEM_ID } from "../content/items";
import { ALL_SURVIVING_PLAYER_UNITS } from "../domain/progression/chapter-reward";
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

  it("grants the promotion seal to all living active and reserve allies and excludes defeated units", () => {
    const state = clearedState();
    const defeated = state.units.find((unit) => unit.id === "unit_002")!;
    const reserved = state.units.find((unit) => unit.id === "unit_004")!;
    const reserveRecord = {
      id: reserved.id,
      name: reserved.name,
      classId: reserved.classId,
      level: reserved.level,
      experience: reserved.experience,
      stats: { ...reserved.stats },
      growthRates: { ...reserved.growthRates },
      currentHp: reserved.currentHp,
      movementType: reserved.movementType,
      move: reserved.move,
      usableWeaponTypes: [...reserved.usableWeaponTypes],
      inventory: [...reserved.inventory],
      equippedWeaponId: reserved.equippedWeaponId
    };
    state.units = state.units
      .filter((unit) => unit.id !== reserved.id)
      .map((unit) => unit.id === defeated.id
        ? { ...unit, currentHp: 0 }
        : unit
      );
    state.reserveUnits = [reserveRecord];
    const original = structuredClone(state);

    const result = applyChapterRewards(state, CHAPTER_01_MAP, [{
      recipientUnitId: ALL_SURVIVING_PLAYER_UNITS,
      itemId: PROMOTION_ITEM_ID,
      quantity: 1
    }]);

    const livingPlayers = state.units.filter((unit) => unit.faction === "player" && unit.currentHp > 0);
    const livingReserves = state.reserveUnits.filter((unit) => unit.currentHp > 0);
    expect(result.rewardsApplied).toHaveLength(livingPlayers.length + livingReserves.length);
    for (const unit of livingPlayers) {
      expect(result.nextState.units.find((candidate) => candidate.id === unit.id)?.inventory)
        .toContain(PROMOTION_ITEM_ID);
    }
    for (const unit of livingReserves) {
      expect(result.nextState.reserveUnits.find((candidate) => candidate.id === unit.id)?.inventory)
        .toContain(PROMOTION_ITEM_ID);
    }
    expect(result.nextState.units.find((unit) => unit.id === defeated.id)?.inventory)
      .not.toContain(PROMOTION_ITEM_ID);
    expect(state).toEqual(original);
  });

  it("rejects a party reward atomically when a reserve ally has a full inventory", () => {
    const state = clearedState();
    const reserved = state.units.find((unit) => unit.id === "unit_004")!;
    state.units = state.units.filter((unit) => unit.id !== reserved.id);
    state.reserveUnits = [{
      id: reserved.id,
      name: reserved.name,
      classId: reserved.classId,
      level: reserved.level,
      experience: reserved.experience,
      stats: { ...reserved.stats },
      growthRates: { ...reserved.growthRates },
      currentHp: reserved.currentHp,
      movementType: reserved.movementType,
      move: reserved.move,
      usableWeaponTypes: [...reserved.usableWeaponTypes],
      inventory: ["iron_sword", "iron_lance", "iron_axe", "short_bow", "fire_tome"],
      equippedWeaponId: reserved.equippedWeaponId
    }];
    const original = structuredClone(state);

    expect(() => applyChapterRewards(state, CHAPTER_01_MAP, [{
      recipientUnitId: ALL_SURVIVING_PLAYER_UNITS,
      itemId: PROMOTION_ITEM_ID,
      quantity: 1
    }])).toThrow(/does not have enough free slots/);
    expect(state).toEqual(original);
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
