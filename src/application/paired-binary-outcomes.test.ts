import { describe, expect, it } from "vitest";
import { summarizePairedBinaryOutcomes } from "./paired-binary-outcomes";

describe("summarizePairedBinaryOutcomes", () => {
  it("counts outcomes shared by both branches, neither branch, and discordant pairs", () => {
    const summary = summarizePairedBinaryOutcomes([
      { control: true, promotion: true },
      { control: false, promotion: false },
      { control: true, promotion: false },
      { control: false, promotion: true },
      { control: false, promotion: true }
    ]);

    expect(summary).toEqual({
      sampleCount: 5,
      controlOnlyCount: 1,
      promotionOnlyCount: 2,
      bothCount: 1,
      neitherCount: 1,
      promotionMinusControlPercentagePoints: 20
    });
    expect(
      summary.controlOnlyCount + summary.promotionOnlyCount +
      summary.bothCount + summary.neitherCount
    ).toBe(summary.sampleCount);
  });

  it("keeps the paired delta at zero when every pair agrees", () => {
    const summary = summarizePairedBinaryOutcomes([
      { control: true, promotion: true },
      { control: false, promotion: false }
    ]);

    expect(summary.promotionMinusControlPercentagePoints).toBe(0);
    expect(summary.bothCount).toBe(1);
    expect(summary.neitherCount).toBe(1);
  });

  it("rejects an empty sample and malformed pair values", () => {
    expect(() => summarizePairedBinaryOutcomes([])).toThrow(RangeError);
    expect(() => summarizePairedBinaryOutcomes([
      { control: true, promotion: "yes" as unknown as boolean }
    ])).toThrow(TypeError);
  });
});
