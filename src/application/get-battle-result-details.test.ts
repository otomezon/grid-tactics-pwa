import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { getBattleResultDetails } from "./get-battle-result-details";

describe("getBattleResultDetails", () => {
  it("lists every enemy as alive or defeated using the map deployment roster", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) =>
        unit.faction === "player" || unit.id !== "enemy_001"
      )
    };

    const details = getBattleResultDetails(state, CHAPTER_01_MAP, INITIAL_GAME_STATE);

    expect(details.enemies).toHaveLength(CHAPTER_01_MAP.enemyDeployment.length);
    expect(details.enemies.find((unit) => unit.id === "enemy_001")).toEqual({
      id: "enemy_001",
      name: "敵01",
      classId: "fighter",
      status: "defeated",
      currentHp: null,
      maxHp: null
    });
    expect(details.enemies.find((unit) => unit.id === "enemy_002")).toMatchObject({
      id: "enemy_002",
      name: "敵02",
      status: "alive",
      currentHp: 20,
      maxHp: 20
    });
  });

  it("shows only living deployed players with their current progression and HP", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "unit_002")
    };

    const details = getBattleResultDetails(state, CHAPTER_01_MAP, INITIAL_GAME_STATE);

    expect(details.survivingPlayers.map((unit) => unit.id)).toEqual([
      "unit_001",
      "unit_003",
      "unit_004"
    ]);
    expect(details.survivingPlayers[0]).toMatchObject({
      name: "味方01",
      classId: "swordsman",
      level: 1,
      experience: 0,
      currentHp: 20,
      maxHp: 20
    });
  });

  it("uses the chapter roster for defeated enemies and remains deterministic", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
    };

    const first = getBattleResultDetails(state, CHAPTER_01_MAP, INITIAL_GAME_STATE);
    const second = getBattleResultDetails(state, CHAPTER_01_MAP, INITIAL_GAME_STATE);

    expect(first).toEqual(second);
    expect(first.enemies.every((enemy) => enemy.status === "defeated")).toBe(true);
    expect(first.enemies.map((enemy) => enemy.id)).toEqual([
      "enemy_001",
      "enemy_002",
      "enemy_003",
      "enemy_004",
      "enemy_005"
    ]);
  });

  it("falls back to the deployment ID when no enemy reference is available", () => {
    const map = {
      ...CHAPTER_01_MAP,
      enemyDeployment: [{ unitId: "unknown_enemy", x: 0, y: 0 }]
    };
    const details = getBattleResultDetails(
      INITIAL_GAME_STATE,
      map,
      { ...INITIAL_GAME_STATE, units: [] }
    );

    expect(details.enemies).toEqual([{
      id: "unknown_enemy",
      name: "unknown_enemy",
      classId: "unknown",
      status: "defeated",
      currentHp: null,
      maxHp: null
    }]);
  });
});
