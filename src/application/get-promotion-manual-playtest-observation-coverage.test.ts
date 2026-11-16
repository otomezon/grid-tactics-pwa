import { describe, expect, it } from "vitest";
import { getPromotionManualPlaytestObservationCoverage } from "./get-promotion-manual-playtest-observation-coverage";

function branch(values: Record<string, string>) {
  return { values };
}

describe("getPromotionManualPlaytestObservationCoverage", () => {
  it("counts pair value states separately from missing branches and metadata mismatches", () => {
    const audit = {
      observationColumns: [
        "actual_damage",
        "observations",
        "manual_session_id",
        "played_at",
        "branch_commit",
        "observed_start_rng_state"
      ],
      cases: [
        {
          caseId: "swordsman:low",
          control: branch({ actual_damage: "8", observations: "control note" }),
          promotion: branch({ actual_damage: "11", observations: "promotion note" }),
          pairFieldMismatches: []
        },
        {
          caseId: "mercenary:low",
          control: branch({ actual_damage: "", observations: "control only" }),
          promotion: branch({ actual_damage: "9", observations: "" }),
          pairFieldMismatches: ["snapshot fingerprint"]
        },
        {
          caseId: "fighter:low",
          control: branch({ actual_damage: "1e308", observations: "" }),
          promotion: branch({ actual_damage: "-1e308", observations: "" }),
          pairFieldMismatches: []
        },
        {
          caseId: "soldier:low",
          control: branch({ actual_damage: "not-a-number", observations: "" }),
          promotion: branch({ actual_damage: "2", observations: "" }),
          pairFieldMismatches: []
        },
        {
          caseId: "cavalry:low",
          control: branch({ actual_damage: "4", observations: "" }),
          promotion: null,
          pairFieldMismatches: []
        }
      ]
    };

    const coverage = getPromotionManualPlaytestObservationCoverage(audit);
    const damage = coverage.find((entry) => entry.field === "actual_damage")!;
    expect(damage).toEqual({
      field: "actual_damage",
      expectedCaseCount: 5,
      pairedCaseCount: 4,
      missingBranchCaseCount: 1,
      bothValuesPresentCaseCount: 3,
      controlOnlyValueCaseCount: 0,
      promotionOnlyValueCaseCount: 1,
      bothValuesEmptyCaseCount: 0,
      numericDeltaAvailablePairCount: 1,
      bothValuesWithoutNumericDeltaPairCount: 2,
      metadataMismatchCaseCount: 1
    });

    const notes = coverage.find((entry) => entry.field === "observations")!;
    expect(notes).toMatchObject({
      expectedCaseCount: 5,
      pairedCaseCount: 4,
      missingBranchCaseCount: 1,
      bothValuesPresentCaseCount: 1,
      controlOnlyValueCaseCount: 1,
      promotionOnlyValueCaseCount: 0,
      bothValuesEmptyCaseCount: 2,
      numericDeltaAvailablePairCount: 0,
      bothValuesWithoutNumericDeltaPairCount: 1,
      metadataMismatchCaseCount: 1
    });
  });

  it("keeps schema field order and excludes execution-context metadata", () => {
    const coverage = getPromotionManualPlaytestObservationCoverage({
      observationColumns: [
        "actual_damage",
        "manual_session_id",
        "played_at",
        "branch_commit",
        "observed_start_rng_state",
        "retest_conditions"
      ],
      cases: [{
        caseId: "swordsman:low",
        control: branch({ actual_damage: "4", retest_conditions: "再試験" }),
        promotion: branch({ actual_damage: "6", retest_conditions: "再試験" }),
        pairFieldMismatches: []
      }]
    });

    expect(coverage.map((entry) => entry.field)).toEqual([
      "actual_damage",
      "retest_conditions"
    ]);
    expect(coverage[0]?.numericDeltaAvailablePairCount).toBe(1);
  });

  it("does not infer numeric comparability from non-finite values or an overflowing delta", () => {
    const coverage = getPromotionManualPlaytestObservationCoverage({
      observationColumns: ["actual_damage"],
      cases: [
        {
          caseId: "swordsman:low",
          control: branch({ actual_damage: "1e999" }),
          promotion: branch({ actual_damage: "2" }),
          pairFieldMismatches: []
        },
        {
          caseId: "mercenary:low",
          control: branch({ actual_damage: "1e308" }),
          promotion: branch({ actual_damage: "-1e308" }),
          pairFieldMismatches: []
        }
      ]
    });

    expect(coverage[0]).toMatchObject({
      bothValuesPresentCaseCount: 2,
      numericDeltaAvailablePairCount: 0,
      bothValuesWithoutNumericDeltaPairCount: 2
    });
  });
});
