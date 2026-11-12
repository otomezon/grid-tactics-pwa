import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition } from "../domain/models/game";
import { getBattleObjectiveNavigationTargets } from "./get-battle-objective-navigation-targets";

describe("getBattleObjectiveNavigationTargets", () => {
  it("counts living enemies for a defeat-all objective without inventing a single target", () => {
    expect(getBattleObjectiveNavigationTargets(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toEqual({
      victoryTarget: null,
      defeatTarget: null,
      remainingEnemyCount: 5
    });
  });

  it("exposes a living boss and a living protected ally for direct inspection", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_001" },
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const result = getBattleObjectiveNavigationTargets(INITIAL_GAME_STATE, map);
    expect(result.victoryTarget).toMatchObject({ id: "enemy_001", faction: "enemy", currentHp: 20 });
    expect(result.defeatTarget).toMatchObject({ id: "unit_001", faction: "player", currentHp: 20 });
    expect(result.remainingEnemyCount).toBe(0);
  });

  it("does not offer navigation to missing or defeated objective units", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_001" },
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_001" && unit.id !== "unit_001")
    };
    expect(getBattleObjectiveNavigationTargets(state, map)).toEqual({
      victoryTarget: null,
      defeatTarget: null,
      remainingEnemyCount: 0
    });
  });

  it("rejects objective references that point to the wrong faction", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "unit_001" },
      defeatCondition: { type: "unit_defeated", targetUnitId: "enemy_001" }
    };
    expect(getBattleObjectiveNavigationTargets(INITIAL_GAME_STATE, map)).toEqual({
      victoryTarget: null,
      defeatTarget: null,
      remainingEnemyCount: 0
    });
  });

  it("updates the defeat-all count as enemies are defeated", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_001" && unit.id !== "enemy_003")
    };
    expect(getBattleObjectiveNavigationTargets(state, CHAPTER_01_MAP).remainingEnemyCount).toBe(3);
  });
});
