import { describe, expect, it } from "vitest";
import { createCombatRollSequence, nextRandomUint32 } from "./xorshift32";

describe("Xorshift32 combat RNG", () => {
  it("produces the same roll sequence and final state for the same seed", () => {
    const first = createCombatRollSequence(0x12345678, 4);
    const second = createCombatRollSequence(0x12345678, 4);

    expect(first).toEqual(second);
    expect(first.rolls).toHaveLength(4);
    expect(first.statesAfterEachStrike).toHaveLength(4);
  });

  it("returns integer rolls in the 0..99 range", () => {
    const sequence = createCombatRollSequence(0x6d2b79f5, 100);
    for (const roll of sequence.rolls) {
      expect(Number.isInteger(roll.hitRoll)).toBe(true);
      expect(roll.hitRoll).toBeGreaterThanOrEqual(0);
      expect(roll.hitRoll).toBeLessThan(100);
      expect(Number.isInteger(roll.criticalRoll)).toBe(true);
      expect(roll.criticalRoll).toBeGreaterThanOrEqual(0);
      expect(roll.criticalRoll).toBeLessThan(100);
    }
  });

  it("advances one non-zero uint32 state per generated roll pair", () => {
    const sequence = createCombatRollSequence(0x12345678, 3);
    expect(sequence.statesAfterEachStrike[0]).not.toBe(0x12345678);
    expect(sequence.statesAfterEachStrike[1]).not.toBe(sequence.statesAfterEachStrike[0]);
    expect(sequence.statesAfterEachStrike.every((state) => state > 0 && state <= 0xffffffff)).toBe(true);
  });

  it("rejects zero, invalid RNG states, and negative strike counts", () => {
    expect(() => nextRandomUint32(0)).toThrow(RangeError);
    expect(() => nextRandomUint32(-1)).toThrow(RangeError);
    expect(() => createCombatRollSequence(123, -1)).toThrow(RangeError);
  });
});
