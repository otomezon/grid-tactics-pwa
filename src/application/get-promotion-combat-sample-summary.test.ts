import { describe, expect, it } from "vitest";
import { getClassPromotionDefinition } from "../content/classes";
import { PROMOTION_ITEM_ID } from "../content/items";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { performClassChange } from "./perform-class-change";
import type { GameStateSnapshot } from "../domain/models/game";
import {
  createPromotionCombatSampleSeeds,
  getPromotionCombatSampleSummary
} from "./get-promotion-combat-sample-summary";

function battleReadySnapshot(): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    turn: 4,
    rngState: 0x12345678,
    units: INITIAL_GAME_STATE.units.map((unit) => {
      if (unit.id === "unit_001") {
        return {
          ...unit,
          level: 10,
          experience: 73,
          stats: {
            ...unit.stats,
            hp: 28,
            strength: 9,
            skill: 10,
            speed: 12,
            luck: 7,
            defense: 7
          },
          currentHp: 17,
          inventory: [...unit.inventory, PROMOTION_ITEM_ID]
        };
      }
      if (unit.id === "enemy_001") {
        return {
          ...unit,
          position: { x: 1, y: 7 },
          stats: {
            ...unit.stats,
            hp: 30,
            strength: 6,
            skill: 7,
            speed: 20,
            luck: 20
          },
          currentHp: 30
        };
      }
      return unit;
    })
  };
}

describe("promotion combat sample summary", () => {
  it("creates a deterministic non-zero seed stream within the supported sample count", () => {
    const first = createPromotionCombatSampleSeeds(0x12345678, 25);
    const second = createPromotionCombatSampleSeeds(0x12345678, 25);

    expect(first).toEqual(second);
    expect(new Set(first).size).toBe(25);
    expect(first.every((seed) => Number.isInteger(seed) && seed > 0 && seed <= 0xffffffff)).toBe(true);
    expect(() => createPromotionCombatSampleSeeds(0x12345678, 0)).toThrow("1 through 1000");
    expect(() => createPromotionCombatSampleSeeds(0, 5)).toThrow("non-zero");
  });

  it("pairs both branches with the same seeds and summarizes independent isolated battles", () => {
    const control = battleReadySnapshot();
    const original = structuredClone(control);
    const definition = getClassPromotionDefinition("swordsman");
    if (!definition) throw new Error("Missing prototype promotion definition.");
    const promotion = performClassChange(control, "unit_001", definition);

    const summary = getPromotionCombatSampleSummary(
      control,
      promotion.nextState,
      CHAPTER_01_MAP,
      "unit_001",
      "enemy_001",
      25
    );
    const repeated = getPromotionCombatSampleSummary(
      control,
      promotion.nextState,
      CHAPTER_01_MAP,
      "unit_001",
      "enemy_001",
      25
    );

    expect(summary).toEqual(repeated);
    expect(summary.sampleCount).toBe(25);
    expect(summary.firstSeed).not.toBe(0);
    expect(summary.lastSeed).not.toBe(0);
    expect(summary.control.attackAttempts).toBeGreaterThanOrEqual(25);
    expect(summary.promotion.attackAttempts).toBeGreaterThanOrEqual(25);
    expect(summary.control.attackHitRate).toBeGreaterThanOrEqual(0);
    expect(summary.control.attackHitRate).toBeLessThanOrEqual(100);
    expect(summary.promotion.enemyDefeatRate).toBeGreaterThanOrEqual(0);
    expect(summary.promotion.enemyDefeatRate).toBeLessThanOrEqual(100);
    expect(summary.control.attackerSurvivalRate).toBeGreaterThanOrEqual(0);
    expect(summary.control.attackerSurvivalRate).toBeLessThanOrEqual(100);
    expect(control).toEqual(original);
    expect(promotion.nextState.units.find((unit) => unit.id === "unit_001")?.hasActed).toBe(true);
  });
});
