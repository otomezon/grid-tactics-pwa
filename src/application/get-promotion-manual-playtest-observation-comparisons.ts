import type { PromotionManualPlaytestWorksheetAudit } from "./audit-promotion-manual-playtest-worksheet";

const EXECUTION_CONTEXT_FIELDS = new Set([
  "manual_session_id",
  "played_at",
  "branch_commit",
  "observed_start_rng_state"
]);

const NUMERIC_VALUE_PATTERN = /^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

export interface PromotionManualPlaytestObservationComparison {
  caseId: string;
  field: string;
  controlRowNumber: number;
  promotionRowNumber: number;
  controlValue: string;
  promotionValue: string;
  numericDelta: number | null;
  pairConditionsMatch: boolean;
  pairFieldMismatches: string[];
}

function parseFiniteNumericValue(value: string): number | null {
  if (!NUMERIC_VALUE_PATTERN.test(value)) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

/**
 * Builds a descriptive, row-by-row view of values manually entered in paired
 * control/promotion worksheet rows. Missing cells are never treated as zero.
 * Numeric differences are emitted only when both cells contain finite numbers.
 */
export function getPromotionManualPlaytestObservationComparisons(
  audit: Pick<PromotionManualPlaytestWorksheetAudit, "cases" | "observationColumns">
): PromotionManualPlaytestObservationComparison[] {
  const comparisons: PromotionManualPlaytestObservationComparison[] = [];

  for (const caseAudit of audit.cases) {
    const control = caseAudit.control;
    const promotion = caseAudit.promotion;
    if (!control || !promotion) continue;

    for (const field of audit.observationColumns) {
      if (EXECUTION_CONTEXT_FIELDS.has(field)) continue;

      const controlValue = (control.values[field] ?? "").trim();
      const promotionValue = (promotion.values[field] ?? "").trim();
      if (controlValue.length === 0 && promotionValue.length === 0) continue;

      const controlNumber = parseFiniteNumericValue(controlValue);
      const promotionNumber = parseFiniteNumericValue(promotionValue);
      const difference = controlNumber !== null && promotionNumber !== null
        ? promotionNumber - controlNumber
        : null;

      comparisons.push({
        caseId: caseAudit.caseId,
        field,
        controlRowNumber: control.rowNumber,
        promotionRowNumber: promotion.rowNumber,
        controlValue,
        promotionValue,
        numericDelta: difference !== null && Number.isFinite(difference)
          ? (Object.is(difference, -0) ? 0 : difference)
          : null,
        pairConditionsMatch: caseAudit.pairFieldMismatches.length === 0,
        pairFieldMismatches: [...caseAudit.pairFieldMismatches]
      });
    }
  }

  return comparisons;
}
