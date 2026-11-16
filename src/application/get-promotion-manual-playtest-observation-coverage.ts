import type { PromotionManualPlaytestWorksheetAudit } from "./audit-promotion-manual-playtest-worksheet";
import { getPromotionManualPlaytestObservationComparisons } from "./get-promotion-manual-playtest-observation-comparisons";

const EXECUTION_CONTEXT_FIELDS = new Set([
  "manual_session_id",
  "played_at",
  "branch_commit",
  "observed_start_rng_state"
]);

export interface PromotionManualPlaytestObservationCoverage {
  field: string;
  expectedCaseCount: number;
  pairedCaseCount: number;
  missingBranchCaseCount: number;
  bothValuesPresentCaseCount: number;
  controlOnlyValueCaseCount: number;
  promotionOnlyValueCaseCount: number;
  bothValuesEmptyCaseCount: number;
  numericDeltaAvailablePairCount: number;
  bothValuesWithoutNumericDeltaPairCount: number;
  metadataMismatchCaseCount: number;
}

type CoverageBranch = { values: Readonly<Record<string, string>> };
type CoverageCase = {
  caseId: string;
  control: CoverageBranch | null;
  promotion: CoverageBranch | null;
  pairFieldMismatches: readonly string[];
};

type CoverageAudit = Pick<PromotionManualPlaytestWorksheetAudit, "cases" | "observationColumns">;

/**
 * Summarizes manual observation presence per expected case without combining
 * values across cases. Missing branches are kept separate from blank cells.
 * Metadata mismatches are an independent overlay and may overlap any value state.
 */
export function getPromotionManualPlaytestObservationCoverage(
  audit: CoverageAudit
): PromotionManualPlaytestObservationCoverage[] {
  const comparisons = getPromotionManualPlaytestObservationComparisons(audit);
  const comparisonsByCaseAndField = new Map(
    comparisons.map((comparison) => [
      comparison.caseId + "\u0000" + comparison.field,
      comparison
    ])
  );

  return audit.observationColumns
    .filter((field) => !EXECUTION_CONTEXT_FIELDS.has(field))
    .map((field) => {
      const summary: PromotionManualPlaytestObservationCoverage = {
        field,
        expectedCaseCount: audit.cases.length,
        pairedCaseCount: 0,
        missingBranchCaseCount: 0,
        bothValuesPresentCaseCount: 0,
        controlOnlyValueCaseCount: 0,
        promotionOnlyValueCaseCount: 0,
        bothValuesEmptyCaseCount: 0,
        numericDeltaAvailablePairCount: 0,
        bothValuesWithoutNumericDeltaPairCount: 0,
        metadataMismatchCaseCount: 0
      };

      for (const entry of audit.cases) {
        if (!entry.control || !entry.promotion) {
          summary.missingBranchCaseCount += 1;
          continue;
        }

        summary.pairedCaseCount += 1;
        if (entry.pairFieldMismatches.length > 0) {
          summary.metadataMismatchCaseCount += 1;
        }

        const controlValue = (entry.control.values[field] ?? "").trim();
        const promotionValue = (entry.promotion.values[field] ?? "").trim();
        const controlHasValue = controlValue.length > 0;
        const promotionHasValue = promotionValue.length > 0;

        if (controlHasValue && promotionHasValue) {
          summary.bothValuesPresentCaseCount += 1;
          const comparison = comparisonsByCaseAndField.get(entry.caseId + "\u0000" + field);
          if (comparison?.numericDelta !== null && comparison?.numericDelta !== undefined) {
            summary.numericDeltaAvailablePairCount += 1;
          } else {
            summary.bothValuesWithoutNumericDeltaPairCount += 1;
          }
        } else if (controlHasValue) {
          summary.controlOnlyValueCaseCount += 1;
        } else if (promotionHasValue) {
          summary.promotionOnlyValueCaseCount += 1;
        } else {
          summary.bothValuesEmptyCaseCount += 1;
        }
      }

      return summary;
    });
}
