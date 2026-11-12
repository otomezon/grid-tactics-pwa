import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot, GameUnit } from "../domain/models/game";
import { performPlayerMove } from "./perform-player-move";

function stateWithUnit(unitId: string, overrides: Partial<GameUnit> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === unitId ? { ...unit, ...overrides } : unit
    )
  };
}

describe("performPlayerMove", () => {
  it("moves to a reachable tile and returns the deterministic route", () => {
    const original = structuredClone(INITIAL_GAME_STATE);
    const result = performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "unit_001", { x: 1, y: 7 });

    expect(result.path.positions).toEqual([{ x: 1, y: 8 }, { x: 1, y: 7 }]);
    expect(result.path.totalCost).toBe(1);
    expect(result.movedUnit).toMatchObject({ position: { x: 1, y: 7 }, hasMoved: true, hasActed: false });
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")).toEqual(result.movedUnit);
    expect(result.nextState.rngState).toBe(INITIAL_GAME_STATE.rngState);
    expect(result.nextState.campaignUnitBattleRecords).toBe(INITIAL_GAME_STATE.campaignUnitBattleRecords);
    expect(INITIAL_GAME_STATE).toEqual(original);
  });

  it("rejects the current tile, occupied tiles, and destinations beyond movement range", () => {
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "unit_001", { x: 1, y: 8 })).toThrow("現在位置と同じ");
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "unit_001", { x: 3, y: 8 })).toThrow("移動できません");
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "unit_001", { x: 9, y: 9 })).toThrow("移動できません");
  });

  it("rejects impassable terrain and malformed destinations", () => {
    const mapWithWall = {
      ...CHAPTER_01_MAP,
      terrain: CHAPTER_01_MAP.terrain.map((row, y) =>
        row.map((terrain, x) => x === 1 && y === 7 ? "wall" as const : terrain)
      )
    };
    expect(() => performPlayerMove(INITIAL_GAME_STATE, mapWithWall, "unit_001", { x: 1, y: 7 })).toThrow("移動できません");
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "unit_001", { x: 1.5, y: 7 })).toThrow("移動できません");
  });

  it("rejects unknown, enemy, defeated, moved, and acted units", () => {
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "missing", { x: 1, y: 7 })).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerMove(INITIAL_GAME_STATE, CHAPTER_01_MAP, "enemy_001", { x: 1, y: 3 })).toThrow("味方ユニットが見つかりません");
    expect(() => performPlayerMove(stateWithUnit("unit_001", { currentHp: 0 }), CHAPTER_01_MAP, "unit_001", { x: 1, y: 7 })).toThrow("撃破");
    expect(() => performPlayerMove(stateWithUnit("unit_001", { hasMoved: true }), CHAPTER_01_MAP, "unit_001", { x: 1, y: 7 })).toThrow("移動済み");
    expect(() => performPlayerMove(stateWithUnit("unit_001", { hasActed: true }), CHAPTER_01_MAP, "unit_001", { x: 1, y: 7 })).toThrow("移動済み");
    expect(() => performPlayerMove({ ...INITIAL_GAME_STATE, phase: "enemy" }, CHAPTER_01_MAP, "unit_001", { x: 1, y: 7 })).toThrow("自軍フェイズ");
  });
});
