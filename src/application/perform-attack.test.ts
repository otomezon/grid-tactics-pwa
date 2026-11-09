import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { createAttackPlan, performAttack, performEnemyAttack } from "./perform-attack";

function adjacentBattleState() {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "enemy_001"
        ? { ...unit, position: { x: 1, y: 7 } }
        : unit
    )
  };
}

describe("combat application command", () => {
  it("creates a forecast using the equipped weapons and current terrain", () => {
    const state = adjacentBattleState();
    const plan = createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001");

    expect(plan.input.distance).toBe(1);
    expect(plan.input.attackerWeapon.id).toBe("iron_sword");
    expect(plan.input.defenderWeapon?.id).toBe("iron_axe");
    expect(plan.forecast.strikes.map((strike) => strike.kind)).toEqual(["initial", "counter"]);
    expect(plan.forecast.strikes[0]?.weaponTriangleHitModifier).toBe(20);
  });

  it("rejects targets outside the equipped weapon range", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "enemy_001"
          ? { ...unit, position: { x: 1, y: 6 } }
          : unit
      )
    };
    expect(() => createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001")).toThrow("out of range");
  });

  it("rejects already acted units and friendly targets", () => {
    const actedState = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, hasActed: true } : unit
      )
    };
    expect(() => createAttackPlan(actedState, CHAPTER_01_MAP, "unit_001", "enemy_001")).toThrow("already acted");

    const friendlyState = adjacentBattleState();
    expect(() => createAttackPlan(friendlyState, CHAPTER_01_MAP, "unit_001", "unit_002")).toThrow("target an enemy");
  });

  it("applies HP results, consumes persisted RNG, and marks the attacker acted", () => {
    const state = adjacentBattleState();
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");

    const attacker = execution.nextState.units.find((unit) => unit.id === "unit_001");
    const defender = execution.nextState.units.find((unit) => unit.id === "enemy_001");

    expect(attacker?.hasActed).toBe(true);
    expect(attacker?.currentHp).toBe(execution.result.attackerHp);
    expect(defender?.currentHp).toBe(execution.result.defenderHp);
    expect(execution.nextState.rngState).not.toBe(state.rngState);
    expect(execution.result.events.length).toBeGreaterThan(0);
  });

  it("removes defeated units from the map state", () => {
    const state = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "unit_001"
          ? { ...unit, stats: { ...unit.stats, strength: 100 } }
          : unit
      )
    };
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");
    expect(execution.result.defenderHp).toBe(0);
    expect(execution.nextState.units.some((unit) => unit.id === "enemy_001")).toBe(false);
  });
  it("awards 10 EXP for each damaging player strike", () => {
    const state = adjacentBattleState();
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");
    const attacker = execution.nextState.units.find((unit) => unit.id === "unit_001");

    expect(execution.result.events[0]?.damage).toBeGreaterThan(0);
    expect(execution.experienceAwarded).toBe(10);
    expect(attacker?.experience).toBe(10);
  });

  it("adds the defeat bonus when a player attack defeats an enemy", () => {
    const state = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "enemy_001" ? { ...unit, currentHp: 1 } : unit
      )
    };
    const execution = performAttack(state, CHAPTER_01_MAP, "unit_001", "enemy_001");

    expect(execution.result.defenderHp).toBe(0);
    expect(execution.experienceAwarded).toBe(30);
    expect(execution.nextState.units.find((unit) => unit.id === "unit_001")?.experience).toBe(30);
  });

  it("adds the boss defeat bonus only for the configured boss objective", () => {
    const state = {
      ...adjacentBattleState(),
      units: adjacentBattleState().units.map((unit) =>
        unit.id === "enemy_001" ? { ...unit, currentHp: 1 } : unit
      )
    };
    const bossMap = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss" as const, targetUnitId: "enemy_001" }
    };
    const execution = performAttack(state, bossMap, "unit_001", "enemy_001");

    expect(execution.experienceAwarded).toBe(40);
  });

  it("performs level-up growth after reaching 100 EXP and preserves current HP", () => {
    const initial = adjacentBattleState();
    const state = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === "unit_001"
          ? {
              ...unit,
              experience: 90,
              currentHp: 12,
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
    const attacker = execution.nextState.units.find((unit) => unit.id === "unit_001");

    expect(execution.experienceAwarded).toBe(30);
    expect(execution.levelUps).toHaveLength(1);
    expect(attacker?.level).toBe(2);
    expect(attacker?.experience).toBe(20);
    expect(attacker?.stats.hp).toBe(21);
    expect(attacker?.currentHp).toBe(12);
  });

  it("does not award player experience for a miss or an enemy-initiated attack", () => {
    const initial = adjacentBattleState();
    const missState = {
      ...initial,
      units: initial.units.map((unit) =>
        unit.id === "enemy_001"
          ? { ...unit, stats: { ...unit.stats, speed: 100, luck: 100 } }
          : unit
      )
    };
    const miss = performAttack(missState, CHAPTER_01_MAP, "unit_001", "enemy_001");
    expect(miss.result.events[0]?.hit).toBe(false);
    expect(miss.experienceAwarded).toBe(0);

    const enemyState = {
      ...initial,
      phase: "enemy" as const,
      units: initial.units.map((unit) =>
        unit.id === "enemy_001"
          ? { ...unit, position: { x: 1, y: 7 } }
          : unit
      )
    };
    const enemyAttack = performEnemyAttack(enemyState, CHAPTER_01_MAP, "enemy_001", "unit_001");
    expect(enemyAttack.experienceAwarded).toBe(0);
    expect(enemyAttack.nextState.units.find((unit) => unit.id === "enemy_001")?.experience).toBe(0);
  });

});
