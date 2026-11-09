import { describe, expect, it } from "vitest";
import { CLASS_PROMOTION_TARGETS } from "../content/classes";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot, UnitStats } from "../domain/models/game";
import type { ClassPromotionDefinition } from "../domain/progression/class-change";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { performClassChange } from "./perform-class-change";

const caps: UnitStats = {
  hp: 60,
  strength: 30,
  magic: 30,
  skill: 30,
  speed: 30,
  luck: 30,
  defense: 30,
  resistance: 30
};

function eligibleState(): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "unit_001"
        ? {
            ...unit,
            level: 10,
            experience: 35
          }
        : unit
    )
  };
}

function definition(overrides: Partial<ClassPromotionDefinition> = {}): ClassPromotionDefinition {
  return {
    fromClassId: "swordsman",
    toClassId: "swordmaster",
    requiredItemId: "promotion_seal",
    statBonuses: { hp: 2, strength: 1 },
    statCaps: caps,
    experiencePolicy: "preserve",
    ...overrides
  };
}

describe("performClassChange", () => {
  it("updates only the selected unit and returns the consumed item and applied bonuses", () => {
    const state = eligibleState();
    const otherUnit = state.units.find((unit) => unit.id === "unit_002");
    const result = performClassChange(state, "unit_001", definition());

    expect(CLASS_PROMOTION_TARGETS).toEqual({
      swordsman: "swordmaster",
      mercenary: "hero",
      fighter: "warrior",
      soldier: "general",
      cavalry: "paladin",
      archer: "sniper",
      mage: "sage"
    });
    expect(result.promotedUnit.classId).toBe("swordmaster");
    expect(result.promotedUnit.level).toBe(1);
    expect(result.promotedUnit.experience).toBe(35);
    expect(result.promotedUnit.inventory).not.toContain("promotion_seal");
    expect(result.consumedItemId).toBe("promotion_seal");
    expect(result.appliedBonuses).toEqual({ hp: 2, strength: 1 });
    expect(result.nextState.saveVersion).toBe(INITIAL_GAME_STATE.saveVersion);
    expect(isValidGameStateSnapshot(result.nextState, CHAPTER_01_MAP)).toBe(true);
    expect(result.nextState.units.find((unit) => unit.id === "unit_002")).toEqual(otherUnit);
    expect(state.units.find((unit) => unit.id === "unit_001")?.classId).toBe("swordsman");
  });

  it("rejects class changes outside the player phase", () => {
    const enemyPhase = { ...eligibleState(), phase: "enemy" as const };
    expect(() =>
      performClassChange(enemyPhase, "unit_001", definition())
    ).toThrow(/player phase/);
  });

  it("rejects an unknown unit or a target outside the configured promotion path", () => {
    expect(() =>
      performClassChange(eligibleState(), "missing", definition())
    ).toThrow(/does not exist/);

    expect(() =>
      performClassChange(
        eligibleState(),
        "unit_001",
        definition({ toClassId: "hero" })
      )
    ).toThrow(/promotion class/);
  });
});
