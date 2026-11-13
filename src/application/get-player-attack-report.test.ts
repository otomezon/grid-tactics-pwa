import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { getPlayerAttackReport } from "./get-player-attack-report";
import { performAttack } from "./perform-attack";

function adjacentBattleState() {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "enemy_001" ? { ...unit, position: { x: 1, y: 7 } } : unit
    )
  };
}

describe("player attack report projection", () => {
  it("projects resolved strike order, participants, weapon, HP changes, and rates", () => {
    const state = adjacentBattleState();
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");
    const report = getPlayerAttackReport(execution);

    expect(report).toMatchObject({
      attackerName: "主人公",
      defenderName: "敵01",
      defenderDefeated: false,
      defenderRemainingHp: execution.result.defenderHp,
      experienceAwarded: execution.experienceAwarded
    });
    expect(report).toMatchObject({
      attackerId: "unit_001",
      defenderId: "enemy_001"
    });
    expect(report.strikes).toHaveLength(execution.result.events.length);
    expect(report.strikes[0]).toMatchObject({ actorId: "unit_001", targetId: "enemy_001" });
    expect(report.strikes[1]).toMatchObject({ actorId: "enemy_001", targetId: "unit_001" });
    expect(report.strikes.map((strike) => strike.kind)).toEqual(
      execution.result.events.map((event) => event.kind)
    );
    expect(report.strikes[0]).toMatchObject({
      kindLabel: "先制攻撃",
      actorName: "主人公",
      targetName: "敵01",
      weaponName: "試作の鉄の剣",
      outcome: "hit",
      damage: execution.result.events[0]?.damage,
      targetHpBefore: 20,
      targetHpAfter: execution.result.events[0]?.defenderHpAfter,
      hitRate: 100
    });
    expect(report.strikes[1]).toMatchObject({
      kindLabel: "反撃",
      actorName: "敵01",
      targetName: "主人公",
      weaponName: "試作の鉄の斧"
    });
  });

  it("retains a miss as a zero-damage strike without changing target HP", () => {
    const initial = adjacentBattleState();
    const missState = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === "enemy_001"
          ? { ...unit, stats: { ...unit.stats, speed: 100, luck: 100 } }
          : unit
      )
    };
    const execution = performAttack(missState, CHAPTER_01_MAP, "unit_001", "enemy_001");
    const report = getPlayerAttackReport(execution);

    expect(report.strikes[0]).toMatchObject({
      outcome: "miss",
      damage: 0,
      targetHpBefore: 20,
      targetHpAfter: 20
    });
  });

  it("reports defeat, awarded EXP, and level-up details from the execution", () => {
    const initial = adjacentBattleState();
    const state = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === "unit_001"
          ? {
              ...unit,
              experience: 90,
              growthRates: {
                hp: 100, strength: 100, magic: 100, skill: 100,
                speed: 100, luck: 100, defense: 100, resistance: 100
              }
            }
          : unit.id === "enemy_001"
            ? { ...unit, currentHp: 1 }
            : unit
      )
    };
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");
    const report = getPlayerAttackReport(execution);

    expect(report.defenderDefeated).toBe(true);
    expect(report.defenderRemainingHp).toBe(0);
    expect(report.experienceAwarded).toBe(30);
    expect(report.levelUps).toEqual(execution.levelUps);
    expect(report.levelUps[0]?.newLevel).toBe(2);
  });
});
