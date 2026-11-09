import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { createAttackPlan, performAttack } from "./perform-attack";

function adjacentBattleState() {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "enemy_001"
        ? { ...unit, position: { x: 1, y: 7 } }
        : unit
    )
  };
}

describe("combat application command", () => {
  it("creates a forecast using the equipped weapons and current terrain", () => {
    const state = adjacentBattleState();
    const plan = createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001");

    expect(plan.input.distance).toBe(1);
    expect(plan.input.attackerWeapon.id).toBe("iron_sword");
    expect(plan.input.defenderWeapon?.id).toBe("iron_axe");
    expect(plan.forecast.strikes.map((strike) => strike.kind)).toEqual(["initial", "counter"]);
    expect(plan.forecast.strikes[0]?.weaponTriangleHitModifier).toBe(20);
  });

  it("rejects targets outside the equipped weapon range", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "enemy_001"
          ? { ...unit, position: { x: 1, y: 6 } }
          : unit
      )
    };
    expect(() => createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001")).toThrow("out of range");
  });

  it("rejects already acted units and friendly targets", () => {
    const actedState = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, hasActed: true } : unit
      )
    };
    expect(() => createAttackPlan(actedState, CHAPTER_01_MAP, "unit_001", "enemy_001")).toThrow("already acted");

    const friendlyState = adjacentBattleState();
    expect(() => createAttackPlan(friendlyState, CHAPTER_01_MAP, "unit_001", "unit_002")).toThrow("target an enemy");
  });

  it("applies HP results, consumes persisted RNG, and marks the attacker acted", () => {
    const state = adjacentBattleState();
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");

    const attacker = execution.nextState.units.find((unit) => unit.id === "unit_001");
    const defender = execution.nextState.units.find((unit) => unit.id === "enemy_001");

    expect(attacker?.hasActed).toBe(true);
    expect(attacker?.currentHp).toBe(execution.result.attackerHp);
    expect(defender?.currentHp).toBe(execution.result.defenderHp);
    expect(execution.nextState.rngState).not.toBe(state.rngState);
    expect(execution.result.events.length).toBeGreaterThan(0);
  });

  it("removes defeated units from the map state", () => {
    const state = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "unit_001"
          ? { ...unit, stats: { ...unit.stats, strength: 100 } }
          : unit
      )
    };
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");
    expect(execution.result.defenderHp).toBe(0);
    expect(execution.nextState.units.some((unit) => unit.id === "enemy_001")).toBe(false);
  });
});
