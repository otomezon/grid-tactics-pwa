export interface PairedBinaryOutcome {
  control: boolean;
  promotion: boolean;
}

export interface PairedBinaryOutcomeSummary {
  sampleCount: number;
  controlOnlyCount: number;
  promotionOnlyCount: number;
  bothCount: number;
  neitherCount: number;
  promotionMinusControlPercentagePoints: number;
}

/**
 * Describes the paired result for one binary event across identical seeds.
 * "Only" means the event happened in exactly one branch; it does not imply
 * that the event is desirable (for example, a defeat is an adverse outcome).
 */
export function summarizePairedBinaryOutcomes(
  pairs: readonly PairedBinaryOutcome[]
): PairedBinaryOutcomeSummary {
  if (pairs.length === 0) {
    throw new RangeError("Paired outcomes require at least one sample.");
  }

  let controlOnlyCount = 0;
  let promotionOnlyCount = 0;
  let bothCount = 0;
  let neitherCount = 0;

  for (const pair of pairs) {
    if (typeof pair.control !== "boolean" || typeof pair.promotion !== "boolean") {
      throw new TypeError("Paired outcomes must contain boolean branch results.");
    }

    if (pair.control && pair.promotion) bothCount += 1;
    else if (pair.control) controlOnlyCount += 1;
    else if (pair.promotion) promotionOnlyCount += 1;
    else neitherCount += 1;
  }

  const sampleCount = pairs.length;
  return {
    sampleCount,
    controlOnlyCount,
    promotionOnlyCount,
    bothCount,
    neitherCount,
    promotionMinusControlPercentagePoints:
      Math.round(((promotionOnlyCount - controlOnlyCount) / sampleCount) * 1000) / 10
  };
}
