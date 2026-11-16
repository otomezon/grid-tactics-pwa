import { describe, expect, it } from "vitest";
import { getWilsonScoreInterval } from "./wilson-score-interval";

describe("getWilsonScoreInterval", () => {
  it("returns a wide interval for a small sample with no successes", () => {
    const interval = getWilsonScoreInterval(0, 20);

    expect(interval.lower).toBe(0);
    expect(interval.upper).toBeGreaterThan(0);
    expect(interval.upper).toBeLessThan(30);
  });

  it("is centered around a balanced observed proportion", () => {
    const interval = getWilsonScoreInterval(50, 100);

    expect(interval.lower).toBeCloseTo(40.4, 1);
    expect(interval.upper).toBeCloseTo(59.6, 1);
    expect(interval.lower).toBeLessThan(50);
    expect(interval.upper).toBeGreaterThan(50);
  });

  it("does not collapse to certainty when every trial succeeds", () => {
    const interval = getWilsonScoreInterval(20, 20);

    expect(interval.lower).toBeGreaterThan(70);
    expect(interval.upper).toBe(100);
  });

  it.each([
    [-1, 10],
    [11, 10],
    [1.5, 10],
    [0, 0],
    [0, -1],
    [0, 1.5]
  ])("rejects invalid success/trial counts (%s, %s)", (successes, trials) => {
    expect(() => getWilsonScoreInterval(successes, trials)).toThrow(RangeError);
  });
});
