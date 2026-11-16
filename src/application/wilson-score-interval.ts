/**
 * Percentage bounds for a 95% Wilson score confidence interval.
 *
 * Use this only for one binary outcome per independent sample. Do not apply
 * it to per-strike hit rates: multiple strikes can occur in one sample and
 * are not independent observations.
 */
export interface WilsonScoreInterval {
  lower: number;
  upper: number;
}

const WILSON_95_Z = 1.959963984540054;

export function getWilsonScoreInterval(
  successes: number,
  trials: number
): WilsonScoreInterval {
  if (!Number.isInteger(trials) || trials < 1) {
    throw new RangeError("Wilson interval requires at least one integer trial.");
  }
  if (!Number.isInteger(successes) || successes < 0 || successes > trials) {
    throw new RangeError("Wilson interval successes must be an integer from 0 through trials.");
  }

  const proportion = successes / trials;
  const zSquared = WILSON_95_Z * WILSON_95_Z;
  const denominator = 1 + zSquared / trials;
  const center = (proportion + zSquared / (2 * trials)) / denominator;
  const margin = WILSON_95_Z *
    Math.sqrt(
      (proportion * (1 - proportion)) / trials +
      zSquared / (4 * trials * trials)
    ) /
    denominator;

  return {
    lower: Math.max(0, (center - margin) * 100),
    upper: Math.min(100, (center + margin) * 100)
  };
}
