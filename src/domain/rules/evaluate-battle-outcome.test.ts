import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import type { GameMapDefinition } from "../models/game";
import { evaluateBattleOutcome } from "./evaluate-battle-outcome";

describe("evaluateBattleOutcome", () => {
  it("continues while both factions have living units", () => {
    expect(evaluateBattleOutcome(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe("playing");
  });

  it("wins when all enemies are defeated for a defeat_all objective", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
    };
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("victory");
  });

  it("loses when all player units are defeated", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "enemy")
    };
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("defeat");
  });

  it("wins when the configured boss is no longer present", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_boss" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: [
        ...INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_boss"),
        {
          ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
          id: "enemy_boss"
        }
      ]
    };
    expect(evaluateBattleOutcome(state, map)).toBe("playing");
    expect(evaluateBattleOutcome(
      { ...state, units: state.units.filter((unit) => unit.id !== "enemy_boss") },
      map
    )).toBe("victory");
  });

  it("treats an empty player roster as defeat even when the objective is met", () => {
    const state = { ...INITIAL_GAME_STATE, units: [] };
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("defeat");
  });
});
