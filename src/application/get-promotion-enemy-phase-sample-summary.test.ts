import { describe, expect, it } from "vitest";
import { getClassPromotionDefinition } from "../content/classes";
import { PROMOTION_ITEM_ID } from "../content/items";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { performClassChange } from "./perform-class-change";
import { getPromotionEnemyPhaseSampleSummary } from "./get-promotion-enemy-phase-sample-summary";

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

describe("promotion enemy-phase sample summary", () => {
  it("pairs control wait and promotion branches across deterministic enemy-phase samples", () => {
    const control = battleReadySnapshot();
    const originalControl = structuredClone(control);
    const definition = getClassPromotionDefinition("swordsman");
    if (!definition) throw new Error("Missing prototype promotion definition.");
    const promotion = performClassChange(control, "unit_001", definition);
    const originalPromotion = structuredClone(promotion.nextState);

    const summary = getPromotionEnemyPhaseSampleSummary(
      control,
      promotion.nextState,
      CHAPTER_01_MAP,
      "unit_001",
      12
    );
    const repeated = getPromotionEnemyPhaseSampleSummary(
      control,
      promotion.nextState,
      CHAPTER_01_MAP,
      "unit_001",
      12
    );

    expect(summary).toEqual(repeated);
    expect(summary.sampleCount).toBe(12);
    expect(summary.firstSeed).not.toBe(0);
    expect(summary.lastSeed).not.toBe(0);
    for (const branch of [summary.control, summary.promotion]) {
      expect(branch.totalEnemyActions).toBeGreaterThan(0);
      expect(branch.enemyAttackActions).toBeGreaterThanOrEqual(0);
      expect(branch.enemyMoveAndAttackActions).toBeGreaterThanOrEqual(0);
      expect(branch.selectedUnitTargetedPhaseRate).toBeGreaterThanOrEqual(0);
      expect(branch.selectedUnitTargetedPhaseRate).toBeLessThanOrEqual(100);
      expect(branch.selectedUnitSurvivalRate).toBeGreaterThanOrEqual(0);
      expect(branch.selectedUnitSurvivalRate).toBeLessThanOrEqual(100);
      expect(branch.partyDefeatRate).toBeGreaterThanOrEqual(0);
      expect(branch.partyDefeatRate).toBeLessThanOrEqual(100);
      expect(branch.playerPhaseAdvanceRate).toBeGreaterThanOrEqual(0);
      expect(branch.playerPhaseAdvanceRate).toBeLessThanOrEqual(100);
      expect(branch.selectedUnitTotalDamage).toBeLessThanOrEqual(17 * 12);
    }

    expect(control).toEqual(originalControl);
    expect(promotion.nextState).toEqual(originalPromotion);
    expect(promotion.nextState.units.find((unit) => unit.id === "unit_001")?.hasActed).toBe(true);
  });

  it("rejects branches that do not share identical enemy and reserve snapshots", () => {
    const control = battleReadySnapshot();
    const definition = getClassPromotionDefinition("swordsman");
    if (!definition) throw new Error("Missing prototype promotion definition.");
    const promotion = performClassChange(control, "unit_001", definition);
    const changedEnemy = {
      ...promotion.nextState,
      units: promotion.nextState.units.map((unit) =>
        unit.id === "enemy_001" ? { ...unit, currentHp: unit.currentHp - 1 } : unit
      )
    };

    expect(() => getPromotionEnemyPhaseSampleSummary(
      control,
      changedEnemy,
      CHAPTER_01_MAP,
      "unit_001",
      5
    )).toThrow("preserve all other units");
  });
});
