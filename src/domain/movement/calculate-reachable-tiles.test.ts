import { describe, expect, it } from "vitest";
import type { TerrainType } from "../models/game";
import { calculateMovementPath, calculateReachableTiles } from "./calculate-reachable-tiles";

describe("calculateReachableTiles", () => {
  it("allows orthogonal movement and excludes diagonal tiles", () => {
    const terrain: TerrainType[][] = [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"]
    ];

    const reachable = calculateReachableTiles({
      terrain,
      start: { x: 1, y: 1 },
      movementPoints: 1,
      movementType: "infantry",
      occupiedPositions: []
    });

    expect(reachable.map(({ x, y }) => [x, y])).toEqual([
      [1, 0], [0, 1], [2, 1], [1, 2]
    ]);
  });

  it("applies the infantry forest movement cost", () => {
    const terrain: TerrainType[][] = [["plain", "forest"]];

    expect(calculateReachableTiles({
      terrain, start: { x: 0, y: 0 }, movementPoints: 1,
      movementType: "infantry", occupiedPositions: []
    })).toEqual([]);

    expect(calculateReachableTiles({
      terrain, start: { x: 0, y: 0 }, movementPoints: 2,
      movementType: "infantry", occupiedPositions: []
    })).toEqual([{ x: 1, y: 0, cost: 2 }]);
  });

  it("does not enter or pass through an occupied tile", () => {
    const terrain: TerrainType[][] = [["plain", "plain", "plain"]];
    expect(calculateReachableTiles({
      terrain, start: { x: 0, y: 0 }, movementPoints: 3,
      movementType: "infantry", occupiedPositions: [{ x: 1, y: 0 }]
    })).toEqual([]);
  });

  it("does not pass through impassable terrain", () => {
    const terrain: TerrainType[][] = [["plain", "water", "plain"]];
    expect(calculateReachableTiles({
      terrain, start: { x: 0, y: 0 }, movementPoints: 5,
      movementType: "infantry", occupiedPositions: []
    })).toEqual([]);
  });

  it("rejects malformed and out-of-bounds map input", () => {
    expect(calculateReachableTiles({
      terrain: [["plain", "plain"], ["plain"]],
      start: { x: 0, y: 0 }, movementPoints: 3,
      movementType: "infantry", occupiedPositions: []
    })).toEqual([]);

    expect(calculateReachableTiles({
      terrain: [["plain"]],
      start: { x: 1, y: 0 }, movementPoints: 3,
      movementType: "infantry", occupiedPositions: []
    })).toEqual([]);
  });

  it("applies the cavalry forest movement cost", () => {
    const terrain: TerrainType[][] = [["plain", "forest"]];
    expect(calculateReachableTiles({
      terrain, start: { x: 0, y: 0 }, movementPoints: 2,
      movementType: "cavalry", occupiedPositions: []
    })).toEqual([]);
  });

  it("reconstructs the lowest-cost path around expensive terrain", () => {
    const terrain: TerrainType[][] = [
      ["plain", "plain", "plain", "plain", "plain"],
      ["plain", "forest", "forest", "forest", "plain"],
      ["plain", "plain", "plain", "plain", "plain"]
    ];
    const input = {
      terrain,
      start: { x: 0, y: 1 },
      movementPoints: 6,
      movementType: "infantry" as const,
      occupiedPositions: []
    };

    expect(calculateMovementPath(input, { x: 4, y: 1 })).toEqual({
      positions: [
        { x: 0, y: 1 },
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 1 }
      ],
      totalCost: 6
    });
  });

  it("uses a deterministic first-discovered route for equal-cost paths", () => {
    const terrain: TerrainType[][] = [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"]
    ];

    expect(calculateMovementPath({
      terrain,
      start: { x: 1, y: 1 },
      movementPoints: 2,
      movementType: "infantry",
      occupiedPositions: []
    }, { x: 0, y: 0 })).toEqual({
      positions: [{ x: 1, y: 1 }, { x: 1, y: 0 }, { x: 0, y: 0 }],
      totalCost: 2
    });
  });

  it("does not construct a path through occupied or impassable tiles", () => {
    const blockedByUnit = calculateMovementPath({
      terrain: [["plain", "plain", "plain"]],
      start: { x: 0, y: 0 },
      movementPoints: 3,
      movementType: "infantry",
      occupiedPositions: [{ x: 1, y: 0 }]
    }, { x: 2, y: 0 });
    const blockedByWater = calculateMovementPath({
      terrain: [["plain", "water", "plain"]],
      start: { x: 0, y: 0 },
      movementPoints: 3,
      movementType: "infantry",
      occupiedPositions: []
    }, { x: 2, y: 0 });

    expect(blockedByUnit).toBeNull();
    expect(blockedByWater).toBeNull();
  });

  it("returns null when the destination is outside movement range or outside the map", () => {
    const input = {
      terrain: [["plain", "plain", "plain"]] as TerrainType[][],
      start: { x: 0, y: 0 },
      movementPoints: 1,
      movementType: "infantry" as const,
      occupiedPositions: []
    };

    expect(calculateMovementPath(input, { x: 2, y: 0 })).toBeNull();
    expect(calculateMovementPath(input, { x: 3, y: 0 })).toBeNull();
  });

});
