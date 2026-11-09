import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import type { GameMapDefinition, GameStateSnapshot, GameUnit } from "../models/game";
import { applyFortRecovery } from "./apply-fort-recovery";

function fortMap(): GameMapDefinition {
  const terrain = Array.from({ length: CHAPTER_01_MAP.height }, () =>
    Array.from({ length: CHAPTER_01_MAP.width }, () => "plain" as const)
  );
  terrain[4]![4] = "fort";
  return { ...CHAPTER_01_MAP, terrain };
}

function stateWithUnits(units: GameUnit[]): GameStateSnapshot {
  return { ...INITIAL_GAME_STATE, units };
}

describe("applyFortRecovery", () => {
  it("restores 10% of max HP, rounding fractional HP down", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 4 },
      stats: { ...INITIAL_GAME_STATE.units[0]!.stats, hp: 25 },
      currentHp: 10
    };
    const result = applyFortRecovery(stateWithUnits([player]), fortMap(), "player");

    expect(result.nextState.units[0]?.currentHp).toBe(12);
    expect(result.recoveries).toEqual([
      { unitId: player.id, unitName: player.name, recoveredHp: 2 }
    ]);
  });

  it("does not exceed max HP", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 4 },
      currentHp: 19
    };
    const result = applyFortRecovery(stateWithUnits([player]), fortMap(), "player");

    expect(result.nextState.units[0]?.currentHp).toBe(player.stats.hp);
    expect(result.recoveries[0]?.recoveredHp).toBe(1);
  });

  it("heals only living units of the specified faction on forts", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 4 },
      currentHp: 10
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 4, y: 4 },
      currentHp: 10
    };
    const deadPlayer = { ...player, id: "dead_player", currentHp: 0 };
    const elsewhere = { ...player, id: "elsewhere", position: { x: 3, y: 4 } };
    const state = stateWithUnits([player, enemy, deadPlayer, elsewhere]);

    const result = applyFortRecovery(state, fortMap(), "player");

    expect(result.nextState.units.map((unit) => unit.currentHp)).toEqual([12, 10, 0, 10]);
    expect(result.recoveries.map((recovery) => recovery.unitId)).toEqual([player.id]);
  });

  it("does not award fractional recovery below 10 max HP under the provisional floor rule", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 4 },
      stats: { ...INITIAL_GAME_STATE.units[0]!.stats, hp: 9 },
      currentHp: 5
    };
    const result = applyFortRecovery(stateWithUnits([player]), fortMap(), "player");

    expect(result.nextState.units[0]?.currentHp).toBe(5);
    expect(result.recoveries).toHaveLength(0);
  });

  it("leaves non-fort terrain and other game state unchanged", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 3, y: 4 },
      currentHp: 10
    };
    const state = stateWithUnits([player]);
    const result = applyFortRecovery(state, fortMap(), "player");

    expect(result.nextState.units[0]).toBe(player);
    expect(result.nextState.phase).toBe(state.phase);
    expect(result.nextState.turn).toBe(state.turn);
    expect(result.recoveries).toHaveLength(0);
  });
});
