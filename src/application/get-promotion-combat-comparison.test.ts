import { describe, expect, it } from "vitest";
import { getClassPromotionDefinition } from "../content/classes";
import { PROMOTION_ITEM_ID } from "../content/items";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { performClassChange } from "./perform-class-change";
import { getPromotionCombatComparison } from "./get-promotion-combat-comparison";
import type { GameStateSnapshot } from "../domain/models/game";

function battleReadySnapshot(): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    turn: 4,
    rngState: 0x12345678,
    units: INITIAL_GAME_STATE.units.map((unit) => {
      if (unit.id === "unit_001") {
        return {
          ...unit,
          level: 10,
          experience: 73,
          stats: {
            ...unit.stats,
            hp: 28,
            strength: 9,
            skill: 10,
            speed: 12,
            luck: 7,
            defense: 7
          },
          currentHp: 17,
          inventory: [...unit.inventory, PROMOTION_ITEM_ID]
        };
      }
      if (unit.id === "enemy_001") {
        return {
          ...unit,
          position: { x: 1, y: 7 },
          stats: {
            ...unit.stats,
            hp: 30,
            strength: 6,
            skill: 7,
            speed: 20,
            luck: 20
          },
          currentHp: 30
        };
      }
      return unit;
    })
  };
}

describe("getPromotionCombatComparison", () => {
  it("compares the same target and initial RNG using real combat logic on detached branches", () => {
    const control = battleReadySnapshot();
    const definition = getClassPromotionDefinition("swordsman");
    if (!definition) throw new Error("Missing prototype promotion definition.");
    const promotion = performClassChange(control, "unit_001", definition);

    const comparison = getPromotionCombatComparison(
      control,
      promotion.nextState,
      CHAPTER_01_MAP,
      "unit_001",
      "enemy_001"
    );

    expect(comparison.startingRngState).toBe(0x12345678);
    expect(comparison.control.forecast.strikes[0]?.hitRate).toBe(73);
    expect(comparison.promotion.forecast.strikes[0]?.hitRate).toBe(75);
    expect(comparison.control.result.events.length).toBeGreaterThan(0);
    expect(comparison.promotion.result.events.length).toBeGreaterThan(0);
    expect(comparison.control.finalRngState).toBe(comparison.promotion.finalRngState);
    expect(control.rngState).toBe(0x12345678);
    expect(control.units.find((unit) => unit.id === "unit_001")?.classId).toBe("swordsman");
    expect(promotion.nextState.units.find((unit) => unit.id === "unit_001")?.hasActed).toBe(true);
  });

  it("rejects branches with different starting RNG", () => {
    const control = battleReadySnapshot();
    const definition = getClassPromotionDefinition("swordsman");
    if (!definition) throw new Error("Missing prototype promotion definition.");
    const promotion = performClassChange(control, "unit_001", definition);
    const mismatched = { ...promotion.nextState, rngState: 0x87654321 };

    expect(() => getPromotionCombatComparison(
      control,
      mismatched,
      CHAPTER_01_MAP,
      "unit_001",
      "enemy_001"
    )).toThrow("same chapter, player phase, turn, and starting RNG");
  });
});
