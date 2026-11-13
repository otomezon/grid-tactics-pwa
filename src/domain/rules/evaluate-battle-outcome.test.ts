import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE, MAIN_CHARACTER_UNIT_ID } from "../../content/maps/chapter-01";
import type { GameMapDefinition } from "../models/game";
import { evaluateBattleOutcome } from "./evaluate-battle-outcome";

describe("evaluateBattleOutcome", () => {
  it("continues while both factions have living units", () => {
    expect(evaluateBattleOutcome(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe("playing");
  });

  it("wins when all enemies are defeated for a defeat_all objective", () => {
    const map: GameMapDefinition = { ...CHAPTER_01_MAP, objective: { type: "defeat_all" } };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
    };
    expect(evaluateBattleOutcome(state, map)).toBe("victory");
  });

  it("wins when the chapter-one boss is defeated even if other enemies remain", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_005")
    };
    expect(state.units.some((unit) => unit.faction === "enemy")).toBe(true);
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("victory");
  });

  it("loses when the prototype protagonist falls while other allies remain", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== MAIN_CHARACTER_UNIT_ID)
    };
    expect(state.units.some((unit) => unit.faction === "player")).toBe(true);
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("defeat");
  });

  it("loses when all player units are defeated", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "enemy")
    };
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("defeat");
  });

  it("loses when a configured critical player unit is defeated while allies remain", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "unit_001")
    };

    expect(state.units.some((unit) => unit.faction === "player")).toBe(true);
    expect(evaluateBattleOutcome(state, map)).toBe("defeat");
  });

  it("continues while the configured critical player unit is alive", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "unit_002")
    };

    expect(evaluateBattleOutcome(state, map)).toBe("playing");
  });

  it("gives a critical-unit defeat precedence over a completed victory objective", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter(
        (unit) => unit.faction === "player" && unit.id !== "unit_001"
      )
    };

    expect(evaluateBattleOutcome(state, map)).toBe("defeat");
  });

  it("wins when the configured boss is no longer present", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      enemyDeployment: CHAPTER_01_MAP.enemyDeployment.map((deployment) =>
        deployment.unitId === "enemy_001" ? { ...deployment, unitId: "enemy_boss" } : deployment
      ),
      objective: { type: "defeat_boss", targetUnitId: "enemy_boss" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: [
        ...INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_001" && unit.id !== "enemy_boss"),
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

  it("rejects a map whose critical defeat target is not deployed", () => {
    const invalidMap: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "missing_unit" }
    };

    expect(() => evaluateBattleOutcome(INITIAL_GAME_STATE, invalidMap)).toThrow(
      "The battle map definition is invalid."
    );
  });

  it("treats an empty player roster as defeat even when the objective is met", () => {
    const state = { ...INITIAL_GAME_STATE, units: [] };
    expect(evaluateBattleOutcome(state, CHAPTER_01_MAP)).toBe("defeat");
  });
});
