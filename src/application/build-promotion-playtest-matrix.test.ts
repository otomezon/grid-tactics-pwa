import { describe, expect, it } from "vitest";
import { CLASS_PROMOTION_TARGETS } from "../content/classes";
import type { UnitStats } from "../domain/models/game";
import {
  buildPromotionPlaytestMatrix,
  getAverageClassStatPercentile
} from "./build-promotion-playtest-matrix";

function makeCandidate(
  key: string,
  classId: string,
  stat: number,
  unitSnapshotIdentity = key,
  eligible = true
) {
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
    unitSnapshotIdentity,
    eligible,
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
  it("does not treat renamed copies of one snapshot as three distinct samples", () => {
    const candidates = [
      makeCandidate("copy-a", "swordsman", 10, "same-snapshot"),
      makeCandidate("copy-b", "swordsman", 20, "same-snapshot"),
      makeCandidate("copy-c", "swordsman", 30, "same-snapshot")
    ];

    const slots = buildPromotionPlaytestMatrix(candidates).filter((slot) => slot.classId === "swordsman");

    expect(slots.every((slot) => slot.candidateCount === 3)).toBe(true);
    expect(slots.every((slot) => slot.eligibleCandidateCount === 3)).toBe(true);
    expect(slots.every((slot) => slot.distinctUnitSnapshotCount === 1)).toBe(true);
    expect(slots.every((slot) => slot.eligibleDistinctUnitSnapshotCount === 1)).toBe(true);
    expect(slots.every((slot) => slot.suggestedCandidate === null)).toBe(true);
  });

  it("allows different candidate unit IDs from one save as separate unit snapshots", () => {
    const candidates = [
      makeCandidate("unit-a", "swordsman", 10, "same-save:unit-a"),
      makeCandidate("unit-b", "swordsman", 20, "same-save:unit-b"),
      makeCandidate("unit-c", "swordsman", 30, "same-save:unit-c")
    ];

    const slots = buildPromotionPlaytestMatrix(candidates).filter((slot) => slot.classId === "swordsman");
    expect(slots.every((slot) => slot.distinctUnitSnapshotCount === 3)).toBe(true);
    expect(slots.every((slot) => slot.eligibleDistinctUnitSnapshotCount === 3)).toBe(true);
    expect(new Set(slots.map((slot) => slot.suggestedCandidate?.unitSnapshotIdentity)).size).toBe(3);
  });

  it("suggests only eligible candidates from three distinct snapshot contents", () => {
    const candidates = [
      makeCandidate("ineligible", "swordsman", 5, "save-0", false),
      makeCandidate("low", "swordsman", 10, "save-1"),
      makeCandidate("median", "swordsman", 20, "save-2"),
      makeCandidate("upper", "swordsman", 30, "save-3")
    ];

    const slots = buildPromotionPlaytestMatrix(candidates).filter((slot) => slot.classId === "swordsman");
    const selected = slots.map((slot) => slot.suggestedCandidate);

    expect(slots.every((slot) => slot.candidateCount === 4)).toBe(true);
    expect(slots.every((slot) => slot.eligibleCandidateCount === 3)).toBe(true);
    expect(slots.every((slot) => slot.distinctUnitSnapshotCount === 4)).toBe(true);
    expect(slots.every((slot) => slot.eligibleDistinctUnitSnapshotCount === 3)).toBe(true);
    expect(selected.every((candidate) => candidate !== null && candidate.eligible)).toBe(true);
    expect(new Set(selected.map((candidate) => candidate?.unitSnapshotIdentity)).size).toBe(3);
  });

});
