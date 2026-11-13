import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition } from "../domain/models/game";
import { getBattleObjectiveDetails, getTerrainInspectionDetails } from "./get-battle-map-details";

describe("getBattleObjectiveDetails", () => {
  it("shows the remaining enemy count for a defeat-all objective", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_all" },
      defeatCondition: undefined
    };
    expect(getBattleObjectiveDetails(INITIAL_GAME_STATE, map, INITIAL_GAME_STATE)).toMatchObject({
      victoryLabel: "敵を全滅させる",
      victoryStatus: "残り 5 / 5体",
      defeatLabel: "味方全滅",
      defeatStatus: "生存味方 4体"
    });
  });

  it("updates the defeat-all count as enemies leave the battle state", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_001")
    };
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_all" },
      defeatCondition: undefined
    };
    expect(getBattleObjectiveDetails(state, map, INITIAL_GAME_STATE).victoryStatus)
      .toBe("残り 4 / 5体");
  });

  it("shows a living boss HP value and a defeated status after the boss is removed", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_001" }
    };
    expect(getBattleObjectiveDetails(INITIAL_GAME_STATE, map, INITIAL_GAME_STATE).victoryStatus)
      .toBe("敵01 · HP 20 / 20");

    const defeated = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_001")
    };
    expect(getBattleObjectiveDetails(defeated, map, INITIAL_GAME_STATE).victoryStatus)
      .toBe("敵01 · 撃破済み");
  });

  it("shows the configured critical defeat target status", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    expect(getBattleObjectiveDetails(INITIAL_GAME_STATE, map, INITIAL_GAME_STATE).defeatStatus)
      .toBe("主人公 · HP 20 / 20");

    const defeated = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "unit_001")
    };
    expect(getBattleObjectiveDetails(defeated, map, INITIAL_GAME_STATE).defeatStatus)
      .toBe("主人公 · 撃破済み");
  });

  it("reports an empty player roster for a defeat-all map without a protected unit", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_all" },
      defeatCondition: undefined
    };
    const defeated = { ...INITIAL_GAME_STATE, units: [] };
    expect(getBattleObjectiveDetails(defeated, map, INITIAL_GAME_STATE).defeatStatus)
      .toBe("味方ユニットが残っていません");
  });

  it("uses the prototype boss and protagonist labels for the actual first chapter", () => {
    expect(getBattleObjectiveDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, INITIAL_GAME_STATE)).toMatchObject({
      victoryLabel: "ボスを撃破する",
      victoryStatus: "敵将 · HP 20 / 20",
      defeatLabel: "主人公を撃破させない",
      defeatStatus: "主人公 · HP 20 / 20"
    });
  });
});

describe("getTerrainInspectionDetails", () => {
  it("returns terrain movement costs and combat modifiers for a forest tile", () => {
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 3, y: 0 })).toMatchObject({
      coordinate: "4列・1行",
      terrainName: "森",
      infantryMovementCost: 2,
      cavalryMovementCost: 3,
      defenseBonus: 1,
      avoidanceBonus: 20
    });
  });

  it("reports inaccessible movement types for a mountain tile", () => {
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 2, y: 3 })).toMatchObject({
      terrainName: "山",
      infantryMovementCost: 2,
      cavalryMovementCost: null,
      defenseBonus: 1,
      avoidanceBonus: 20
    });
  });

  it("describes a fort and identifies its occupant", () => {
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 7, y: 3 })).toMatchObject({
      terrainName: "砦",
      occupantLabel: null,
      specialEffect: expect.stringContaining("最大HPの10%")
    });
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 1, y: 8 })?.occupantLabel)
      .toBe("味方：主人公");
  });

  it("returns null for an absent or out-of-map selection", () => {
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, null)).toBeNull();
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 10, y: 0 })).toBeNull();
    expect(getTerrainInspectionDetails(INITIAL_GAME_STATE, CHAPTER_01_MAP, { x: 0, y: -1 })).toBeNull();
  });
});
