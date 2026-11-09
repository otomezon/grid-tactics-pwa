import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP } from "../../content/maps/chapter-01";
import { CHAPTER_02_MAP } from "../../content/maps/chapter-02";
import type { GameMapDefinition } from "./game";
import { isValidGameMapDefinition } from "./validate-game-map";

describe("isValidGameMapDefinition", () => {
  it("accepts both registered prototype maps", () => {
    expect(isValidGameMapDefinition(CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameMapDefinition(CHAPTER_02_MAP)).toBe(true);
  });

  it("requires a boss objective target to be an enemy deployment", () => {
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_001" }
    };
    const missing = {
      ...valid,
      objective: { type: "defeat_boss", targetUnitId: "missing_boss" }
    };
    const playerTarget = {
      ...valid,
      objective: { type: "defeat_boss", targetUnitId: "unit_001" }
    };

    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition(missing)).toBe(false);
    expect(isValidGameMapDefinition(playerTarget)).toBe(false);
  });

  it("requires a critical defeat target to be a player deployment", () => {
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const missing = {
      ...valid,
      defeatCondition: { type: "unit_defeated", targetUnitId: "missing_unit" }
    };
    const enemyTarget = {
      ...valid,
      defeatCondition: { type: "unit_defeated", targetUnitId: "enemy_001" }
    };

    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition(missing)).toBe(false);
    expect(isValidGameMapDefinition(enemyTarget)).toBe(false);
  });

  it("rejects duplicate deployment IDs, overlapping positions, and invalid coordinates", () => {
    const duplicateId = {
      ...CHAPTER_01_MAP,
      enemyDeployment: CHAPTER_01_MAP.enemyDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, unitId: "unit_001" } : deployment
      )
    };
    const overlap = {
      ...CHAPTER_01_MAP,
      enemyDeployment: CHAPTER_01_MAP.enemyDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, x: 1, y: 8 } : deployment
      )
    };
    const outOfBounds = {
      ...CHAPTER_01_MAP,
      playerDeployment: CHAPTER_01_MAP.playerDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, x: CHAPTER_01_MAP.width, y: 0 } : deployment
      )
    };

    expect(isValidGameMapDefinition(duplicateId)).toBe(false);
    expect(isValidGameMapDefinition(overlap)).toBe(false);
    expect(isValidGameMapDefinition(outOfBounds)).toBe(false);
  });

  it("rejects malformed terrain dimensions and unsupported terrain types", () => {
    const badDimensions = { ...CHAPTER_01_MAP, terrain: CHAPTER_01_MAP.terrain.slice(1) };
    const badTerrain = {
      ...CHAPTER_01_MAP,
      terrain: CHAPTER_01_MAP.terrain.map((row, index) =>
        index === 0 ? row.map((cell, cellIndex) => cellIndex === 0 ? "lava" : cell) : row
      )
    };

    expect(isValidGameMapDefinition(badDimensions)).toBe(false);
    expect(isValidGameMapDefinition(badTerrain)).toBe(false);
  });
});
