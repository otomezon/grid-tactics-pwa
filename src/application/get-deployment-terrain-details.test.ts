import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP } from "../content/maps/chapter-01";
import { getDeploymentTerrainDetails } from "./get-deployment-terrain-details";

describe("getDeploymentTerrainDetails", () => {
  it("returns the terrain and common movement data for an occupied deployment slot", () => {
    expect(getDeploymentTerrainDetails(CHAPTER_01_MAP, { x: 1, y: 8 }, "infantry")).toEqual({
      coordinate: "2列・9行",
      terrainName: "平地",
      infantryMovementCost: 1,
      cavalryMovementCost: 1,
      defenseBonus: 0,
      avoidanceBonus: 0,
      unitMovementType: "infantry",
      unitMovementCost: 1,
      specialEffect: null
    });
  });

  it("shows the actual passability and costs for a selected movement type", () => {
    const mountainSlotMap = {
      ...CHAPTER_01_MAP,
      playerDeployment: [{ unitId: "unit_004", x: 2, y: 3 }]
    };
    expect(getDeploymentTerrainDetails(mountainSlotMap, { x: 2, y: 3 }, "cavalry")).toMatchObject({
      terrainName: "山",
      infantryMovementCost: 2,
      cavalryMovementCost: null,
      unitMovementType: "cavalry",
      unitMovementCost: null,
      defenseBonus: 1,
      avoidanceBonus: 20
    });
    expect(getDeploymentTerrainDetails(mountainSlotMap, { x: 2, y: 3 }, "infantry")?.unitMovementCost).toBe(2);
  });

  it("includes the existing provisional fort effect without inventing new values", () => {
    const fortSlotMap = {
      ...CHAPTER_01_MAP,
      playerDeployment: [{ unitId: "unit_001", x: 7, y: 3 }]
    };
    expect(getDeploymentTerrainDetails(fortSlotMap, { x: 7, y: 3 })?.specialEffect)
      .toContain("最大HPの10%");
  });

  it("rejects out-of-bounds and non-deployment tiles", () => {
    expect(getDeploymentTerrainDetails(CHAPTER_01_MAP, { x: -1, y: 8 })).toBeNull();
    expect(getDeploymentTerrainDetails(CHAPTER_01_MAP, { x: 0, y: 0 })).toBeNull();
    expect(getDeploymentTerrainDetails(CHAPTER_01_MAP, { x: 10, y: 8 })).toBeNull();
  });
});
