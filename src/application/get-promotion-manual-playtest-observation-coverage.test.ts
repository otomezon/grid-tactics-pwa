import { describe, expect, it } from "vitest";
import type {
  PromotionManualPlaytestBranchAudit,
  PromotionManualPlaytestCaseAudit
} from "./audit-promotion-manual-playtest-worksheet";
import { getPromotionManualPlaytestObservationCoverage } from "./get-promotion-manual-playtest-observation-coverage";

function branch(values: Record<string, string>): PromotionManualPlaytestBranchAudit {
  const observationFilledFields = Object.entries(values)
    .filter(([, value]) => value.trim().length > 0)
    .map(([field]) => field);
  const observationMissingFields = Object.keys(values)
    .filter((field) => !observationFilledFields.includes(field));
  return {
    rowNumber: 2,
    values,
    observationFilledFieldCount: observationFilledFields.length,
    observationFieldCount: Object.keys(values).length,
    observationFilledFields,
    observationMissingFields,
    manualRecordStatus: "記録済み",
    candidateSourceClassification: "未確認",
    classificationIsVerifiedValue: "false"
  };
}

function caseRow(
  caseId: string,
  control: PromotionManualPlaytestBranchAudit | null,
  promotion: PromotionManualPlaytestBranchAudit | null,
  pairFieldMismatches: string[] = []
): PromotionManualPlaytestCaseAudit {
  return { caseId, control, promotion, pairFieldMismatches, duplicateBranchCount: 0 };
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
        caseRow("swordsman:low",
          branch({ actual_damage: "8", observations: "control note" }),
          branch({ actual_damage: "11", observations: "promotion note" })),
        caseRow("mercenary:low",
          branch({ actual_damage: "", observations: "control only" }),
          branch({ actual_damage: "9", observations: "" }),
          ["snapshot fingerprint"]),
        caseRow("fighter:low",
          branch({ actual_damage: "1e308", observations: "" }),
          branch({ actual_damage: "-1e308", observations: "" })),
        caseRow("soldier:low",
          branch({ actual_damage: "not-a-number", observations: "" }),
          branch({ actual_damage: "2", observations: "" })),
        caseRow("cavalry:low",
          branch({ actual_damage: "4", observations: "" }),
          null)
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
      cases: [caseRow(
        "swordsman:low",
        branch({ actual_damage: "4", retest_conditions: "再試験" }),
        branch({ actual_damage: "6", retest_conditions: "再試験" })
      )]
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
        caseRow("swordsman:low", branch({ actual_damage: "1e999" }), branch({ actual_damage: "2" })),
        caseRow("mercenary:low", branch({ actual_damage: "1e308" }), branch({ actual_damage: "-1e308" }))
      ]
    });

    expect(coverage[0]).toMatchObject({
      bothValuesPresentCaseCount: 2,
      numericDeltaAvailablePairCount: 0,
      bothValuesWithoutNumericDeltaPairCount: 2
    });
  });
});
