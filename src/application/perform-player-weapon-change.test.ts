import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot, GameUnit } from "../domain/models/game";
import { performPlayerWeaponChange } from "./perform-player-weapon-change";

function stateWithUnit(unitId: string, overrides: Partial<GameUnit> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === unitId ? { ...unit, ...overrides } : unit
    )
  };
}

describe("performPlayerWeaponChange", () => {
  it("changes to an owned, compatible weapon without consuming an action", () => {
    const state = stateWithUnit("unit_004", { hasMoved: true, hasActed: false });
    const original = structuredClone(state);
    const result = performPlayerWeaponChange(state, "unit_004", "iron_lance");

    expect(result).toMatchObject({
      previousWeaponId: "iron_sword",
      equippedWeaponId: "iron_lance",
      equippedWeaponName: "試作の鉄の槍"
    });
    expect(result.updatedUnit).toMatchObject({
      equippedWeaponId: "iron_lance",
      hasMoved: true,
      hasActed: false
    });
    expect(result.updatedUnit.inventory).toEqual(state.units.find((unit) => unit.id === "unit_004")?.inventory);
    expect(result.nextState.rngState).toBe(state.rngState);
    expect(state).toEqual(original);
  });

  it("rejects weapons that are unknown, not owned, or incompatible", () => {
    expect(() => performPlayerWeaponChange(INITIAL_GAME_STATE, "unit_004", "unknown_weapon")).toThrow("装備できません");
    expect(() => performPlayerWeaponChange(INITIAL_GAME_STATE, "unit_004", "iron_axe")).toThrow("装備できません");
    expect(() => performPlayerWeaponChange(INITIAL_GAME_STATE, "unit_001", "short_bow")).toThrow("装備できません");
  });

  it("rejects unknown, enemy, defeated, already-acted units, and the enemy phase", () => {
    expect(() => performPlayerWeaponChange(INITIAL_GAME_STATE, "missing", "iron_lance")).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerWeaponChange(INITIAL_GAME_STATE, "enemy_001", "iron_axe")).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerWeaponChange(stateWithUnit("unit_004", { currentHp: 0 }), "unit_004", "iron_lance")).toThrow("撃破");
    expect(() => performPlayerWeaponChange(stateWithUnit("unit_004", { hasActed: true }), "unit_004", "iron_lance")).toThrow("行動済み");
    expect(() => performPlayerWeaponChange({ ...INITIAL_GAME_STATE, phase: "enemy" }, "unit_004", "iron_lance")).toThrow("自軍フェイズ");
  });
});
