import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";
import { getEnemyPhaseForecast } from "./get-enemy-phase-forecast";

describe("getEnemyPhaseForecast", () => {
  it("matches the real enemy-phase actions and outcome without changing the input snapshot", () => {
    const before = structuredClone(INITIAL_GAME_STATE);
    const phaseStart = beginEnemyPhase(INITIAL_GAME_STATE, CHAPTER_01_MAP);
    const execution = runEnemyPhase(phaseStart.nextState, CHAPTER_01_MAP);
    const forecast = getEnemyPhaseForecast(INITIAL_GAME_STATE, CHAPTER_01_MAP);

    expect(forecast).toEqual({
      actions: execution.actions,
      outcome: execution.outcome,
      phaseStartRecoveries: phaseStart.fortRecoveries
    });
    expect(INITIAL_GAME_STATE).toEqual(before);
  });

  it("returns null outside a live player phase", () => {
    const enemyPhaseState: GameStateSnapshot = { ...INITIAL_GAME_STATE, phase: "enemy" };
    const completedState: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
    };
    expect(getEnemyPhaseForecast(enemyPhaseState, CHAPTER_01_MAP)).toBeNull();
    expect(getEnemyPhaseForecast(completedState, CHAPTER_01_MAP)).toBeNull();
  });

  it("is deterministic for an unchanged snapshot", () => {
    expect(getEnemyPhaseForecast(INITIAL_GAME_STATE, CHAPTER_01_MAP))
      .toEqual(getEnemyPhaseForecast(INITIAL_GAME_STATE, CHAPTER_01_MAP));
  });
});
