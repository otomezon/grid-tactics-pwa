import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";
import { getEnemyPhaseForecast } from "./get-enemy-phase-forecast";

describe("getEnemyPhaseForecast", () => {
  it("matches the real enemy-phase actions, unit HP, and outcome without changing the input snapshot", () => {
    const before = structuredClone(INITIAL_GAME_STATE);
    const phaseStart = beginEnemyPhase(INITIAL_GAME_STATE, CHAPTER_01_MAP);
    const execution = runEnemyPhase(phaseStart.nextState, CHAPTER_01_MAP);
    const forecast = getEnemyPhaseForecast(INITIAL_GAME_STATE, CHAPTER_01_MAP);

    expect(forecast).toEqual({
      actions: execution.actions,
      outcome: execution.outcome,
      phaseStartRecoveries: phaseStart.fortRecoveries,
      playerUnitOutcomes: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player").map((unit) => {
        const resolved = execution.nextState.units.find((candidate) => candidate.id === unit.id);
        const defeated = !resolved || resolved.currentHp <= 0;
        const fortRecovery = defeated
          ? 0
          : execution.phaseStartRecoveries.find((recovery) => recovery.unitId === unit.id)?.recoveredHp ?? 0;
        const hpAfterResolution = defeated ? 0 : resolved.currentHp;
        const hpAfterEnemyActions = defeated ? 0 : hpAfterResolution - fortRecovery;
        return {
          unitId: unit.id,
          unitName: unit.name,
          currentHp: unit.currentHp,
          hpAfterEnemyActions,
          hpAfterResolution,
          maxHp: unit.stats.hp,
          incomingDamage: Math.max(0, unit.currentHp - hpAfterEnemyActions),
          fortRecovery,
          defeated
        };
      })
    });
    expect(INITIAL_GAME_STATE).toEqual(before);
  });

  it("includes actual fort recovery in the projected post-resolution HP", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 0, y: 0 },
      currentHp: 10
    };
    const enemies = INITIAL_GAME_STATE.units
      .filter((unit) => unit.faction === "enemy")
      .map((unit) => ({ ...unit, hasActed: true }));
    const terrain = CHAPTER_01_MAP.terrain.map((row) => [...row]);
    terrain[0]![0] = "fort";
    const map: GameMapDefinition = { ...CHAPTER_01_MAP, terrain };
    const state: GameStateSnapshot = { ...INITIAL_GAME_STATE, units: [player, ...enemies] };

    const forecast = getEnemyPhaseForecast(state, map);

    expect(forecast?.playerUnitOutcomes).toEqual([{
      unitId: player.id,
      unitName: player.name,
      currentHp: 10,
      hpAfterEnemyActions: 10,
      hpAfterResolution: 12,
      maxHp: player.stats.hp,
      incomingDamage: 0,
      fortRecovery: 2,
      defeated: false
    }]);
  });

  it("marks an ally as defeated when the actual enemy phase removes that unit", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 8 },
      currentHp: 1
    };
    const enemies = INITIAL_GAME_STATE.units
      .filter((unit) => unit.faction === "enemy")
      .map((unit) => unit.id === "enemy_001"
        ? {
            ...unit,
            position: { x: 1, y: 7 },
            hasActed: false,
            stats: { ...unit.stats, strength: 100, skill: 100 }
          }
        : { ...unit, hasActed: true });
    const state: GameStateSnapshot = { ...INITIAL_GAME_STATE, units: [player, ...enemies] };

    const forecast = getEnemyPhaseForecast(state, CHAPTER_01_MAP);

    expect(forecast?.outcome).toBe("defeat");
    expect(forecast?.playerUnitOutcomes).toEqual([expect.objectContaining({
      unitId: player.id,
      currentHp: 1,
      hpAfterEnemyActions: 0,
      hpAfterResolution: 0,
      incomingDamage: 1,
      fortRecovery: 0,
      defeated: true
    })]);
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
