import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot, GameUnit } from "../domain/models/game";
import { performPlayerWait } from "./perform-player-wait";

function stateWithUnit(unitId: string, overrides: Partial<GameUnit> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === unitId ? { ...unit, ...overrides } : unit
    )
  };
}

describe("performPlayerWait", () => {
  it("consumes the action while preserving movement state and all other data", () => {
    const state = stateWithUnit("unit_001", { hasMoved: true, hasActed: false });
    const original = structuredClone(state);
    const result = performPlayerWait(state, "unit_001");

    expect(result.waitedUnit).toMatchObject({ hasMoved: true, hasActed: true });
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")).toEqual(result.waitedUnit);
    expect(result.nextState.rngState).toBe(state.rngState);
    expect(result.nextState.campaignUnitBattleRecords).toBe(state.campaignUnitBattleRecords);
    expect(state).toEqual(original);
  });

  it("allows waiting without movement", () => {
    const result = performPlayerWait(INITIAL_GAME_STATE, "unit_001");
    expect(result.waitedUnit).toMatchObject({ hasMoved: false, hasActed: true });
  });

  it("rejects unknown, enemy, defeated, already-acted units, and the enemy phase", () => {
    expect(() => performPlayerWait(INITIAL_GAME_STATE, "missing")).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerWait(INITIAL_GAME_STATE, "enemy_001")).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerWait(stateWithUnit("unit_001", { currentHp: 0 }), "unit_001")).toThrow("撃破");
    expect(() => performPlayerWait(stateWithUnit("unit_001", { hasActed: true }), "unit_001")).toThrow("行動済み");
    expect(() => performPlayerWait({ ...INITIAL_GAME_STATE, phase: "enemy" }, "unit_001")).toThrow("自軍フェイズ");
  });
});
