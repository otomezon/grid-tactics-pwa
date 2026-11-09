import { describe, expect, it } from "vitest";
import { calculateManhattanDistance } from "./grid-distance";

describe("calculateManhattanDistance", () => {
  it("counts orthogonal steps and does not count a diagonal as one step", () => {
    expect(calculateManhattanDistance({ x: 2, y: 3 }, { x: 5, y: 3 })).toBe(3);
    expect(calculateManhattanDistance({ x: 2, y: 3 }, { x: 3, y: 4 })).toBe(2);
  });

  it("returns zero for the same tile", () => {
    expect(calculateManhattanDistance({ x: 4, y: 4 }, { x: 4, y: 4 })).toBe(0);
  });

  it("rejects non-integer coordinates", () => {
    expect(() => calculateManhattanDistance({ x: 0.5, y: 0 }, { x: 1, y: 1 })).toThrow(RangeError);
  });
});
