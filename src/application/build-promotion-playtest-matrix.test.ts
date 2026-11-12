import { describe, expect, it } from "vitest";
import { CLASS_PROMOTION_TARGETS } from "../content/classes";
import type { UnitStats } from "../domain/models/game";
import {
  buildPromotionPlaytestMatrix,
  getAverageClassStatPercentile
} from "./build-promotion-playtest-matrix";

const STAT_KEYS = [
  "hp",
  "strength",
  "magic",
  "skill",
  "speed",
  "luck",
  "defense",
  "resistance"
] as const;

function makeCandidate(key: string, classId: string, stat: number) {
  const stats: UnitStats = {
    hp: stat,
    strength: stat,
    magic: stat,
    skill: stat,
    speed: stat,
    luck: stat,
    defense: stat,
    resistance: stat
  };
  return {
    key,
    unit: {
      classId,
      stats
    }
  };
}

describe("buildPromotionPlaytestMatrix", () => {
  it("creates 21 distinct suggested profile slots from three candidates per basic class", () => {
    const candidates = Object.keys(CLASS_PROMOTION_TARGETS).flatMap((classId) => [
      makeCandidate(classId + "-low", classId, 10),
      makeCandidate(classId + "-median", classId, 20),
      makeCandidate(classId + "-upper", classId, 30)
    ]);

    const matrix = buildPromotionPlaytestMatrix(candidates);

    expect(matrix).toHaveLength(21);
    for (const classId of Object.keys(CLASS_PROMOTION_TARGETS)) {
      const classSlots = matrix.filter((slot) => slot.classId === classId);
      expect(classSlots).toHaveLength(3);
      expect(classSlots.every((slot) => slot.candidateCount === 3)).toBe(true);
      expect(classSlots.every((slot) => slot.suggestedCandidate !== null)).toBe(true);
      expect(new Set(classSlots.map((slot) => slot.suggestedCandidate?.key)).size).toBe(3);
      expect(classSlots.find((slot) => slot.profile === "low")?.suggestedPercentile).toBe(0);
      expect(classSlots.find((slot) => slot.profile === "median")?.suggestedPercentile).toBe(50);
      expect(classSlots.find((slot) => slot.profile === "upper")?.suggestedPercentile).toBe(100);
    }
  });

  it("leaves all profile suggestions empty when a class has fewer than three candidates", () => {
    const candidates = [
      makeCandidate("one", "swordsman", 10),
      makeCandidate("two", "swordsman", 20),
      makeCandidate("three", "archer", 30)
    ];

    const matrix = buildPromotionPlaytestMatrix(candidates);
    const swordsmanSlots = matrix.filter((slot) => slot.classId === "swordsman");
    const archerSlots = matrix.filter((slot) => slot.classId === "archer");

    expect(swordsmanSlots.every((slot) => slot.candidateCount === 2)).toBe(true);
    expect(swordsmanSlots.every((slot) => slot.suggestedCandidate === null)).toBe(true);
    expect(archerSlots.every((slot) => slot.candidateCount === 1)).toBe(true);
    expect(archerSlots.every((slot) => slot.suggestedPercentile === null)).toBe(true);
    expect(matrix.filter((slot) => slot.classId === "mage").every((slot) => slot.candidateCount === 0)).toBe(true);
  });

  it("does not present low, median, or upper profiles as measured below three samples", () => {
    const candidates = [
      makeCandidate("one", "swordsman", 10),
      makeCandidate("two", "swordsman", 20)
    ];

    expect(getAverageClassStatPercentile(candidates[0]!, candidates)).toBeNull();
    expect(getAverageClassStatPercentile(candidates[1]!, candidates)).toBeNull();
  });
});
