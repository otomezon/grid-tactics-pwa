import { describe, expect, it } from "vitest";
import {
  PROTOTYPE_GROWTH_PROFILES,
  PROTOTYPE_PROMOTION_SCENARIOS
} from "./class-promotion-balance-scenarios";
import {
  CLASS_PROMOTION_DEFINITIONS,
  CLASS_PROMOTION_TARGETS
} from "../content/classes";
import { getClassPromotionStatPreview } from "../domain/progression/class-change";

describe("synthetic class-promotion balance scenarios", () => {
  it("selects deterministic 10th, 50th, and 90th percentile growth profiles", () => {
    expect(PROTOTYPE_GROWTH_PROFILES).toMatchObject([
      {
        id: "low",
        percentile: 10,
        seed: 735,
        level: 10,
        experience: 0,
        totalStatGains: 23,
        stats: {
          hp: 28,
          strength: 9,
          magic: 0,
          skill: 10,
          speed: 12,
          luck: 7,
          defense: 7,
          resistance: 1
        }
      },
      {
        id: "median",
        percentile: 50,
        seed: 429,
        level: 10,
        experience: 0,
        totalStatGains: 28,
        stats: {
          hp: 26,
          strength: 9,
          magic: 1,
          skill: 12,
          speed: 13,
          luck: 7,
          defense: 7,
          resistance: 4
        }
      },
      {
        id: "high",
        percentile: 90,
        seed: 973,
        level: 10,
        experience: 0,
        totalStatGains: 32,
        stats: {
          hp: 29,
          strength: 9,
          magic: 0,
          skill: 12,
          speed: 15,
          luck: 9,
          defense: 7,
          resistance: 2
        }
      }
    ]);
  });

  it("creates 21 path/profile combinations from the seven provisional definitions", () => {
    expect(PROTOTYPE_PROMOTION_SCENARIOS).toHaveLength(21);

    const paths = Object.keys(CLASS_PROMOTION_TARGETS);
    const profiles = ["low", "median", "high"];

    for (const sourceClassId of paths) {
      const scenarios = PROTOTYPE_PROMOTION_SCENARIOS.filter(
        (scenario) => scenario.sourceClassId === sourceClassId
      );
      expect(scenarios.map((scenario) => scenario.profileId)).toEqual(profiles);

      for (const scenario of scenarios) {
        const definition = CLASS_PROMOTION_DEFINITIONS[sourceClassId]!;
        const expected = getClassPromotionStatPreview(scenario.startingStats, definition);

        expect(scenario.targetClassId).toBe(definition.toClassId);
        expect(scenario.previewStats).toEqual(expected.stats);
        expect(scenario.appliedBonuses).toEqual(expected.appliedBonuses);
        expect(scenario.changes).toEqual(expected.changes);
      }
    }
  });

  it("does not mutate the synthetic starting profiles when calculating promotion previews", () => {
    const before = PROTOTYPE_GROWTH_PROFILES.map((profile) => ({ ...profile.stats }));

    for (const profile of PROTOTYPE_GROWTH_PROFILES) {
      const firstScenario = PROTOTYPE_PROMOTION_SCENARIOS.find(
        (scenario) => scenario.profileId === profile.id
      );
      expect(firstScenario?.startingStats).toEqual(profile.stats);
    }

    expect(PROTOTYPE_GROWTH_PROFILES.map((profile) => profile.stats)).toEqual(before);
  });
});
