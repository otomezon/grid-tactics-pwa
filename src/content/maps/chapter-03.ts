import type { GameMapDefinition, GameStateSnapshot } from "../../domain/models/game";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./chapter-01";

const terrain = CHAPTER_01_MAP.terrain.map((row) => [...row]);
terrain[1]![2] = "forest";
terrain[1]![3] = "forest";
terrain[2]![2] = "forest";
terrain[2]![7] = "forest";
terrain[3]![3] = "mountain";
terrain[3]![4] = "mountain";
terrain[3]![6] = "fort";
terrain[4]![3] = "mountain";
terrain[4]![6] = "water";
terrain[4]![7] = "water";
terrain[5]![6] = "water";
terrain[5]![7] = "water";
terrain[6]![6] = "forest";
terrain[6]![7] = "forest";
terrain[7]![4] = "forest";
terrain[7]![5] = "road";

export const CHAPTER_03_MAP: GameMapDefinition = {
  ...CHAPTER_01_MAP,
  id: "chapter_03_map",
  terrain,
  playerDeployment: [
    { unitId: "unit_001", x: 1, y: 8 },
    { unitId: "unit_002", x: 3, y: 8 },
    { unitId: "unit_003", x: 5, y: 8 },
    { unitId: "unit_004", x: 8, y: 8 }
  ],
  enemyDeployment: [
    { unitId: "enemy_001", x: 1, y: 1 },
    { unitId: "enemy_002", x: 4, y: 1 },
    { unitId: "enemy_003", x: 8, y: 1 },
    { unitId: "enemy_004", x: 2, y: 5 },
    { unitId: "enemy_005", x: 8, y: 5 }
  ],
  objective: { type: "defeat_all" }
};

// Prototype layout only: reuses the existing cast and rules without defining story or rewards.
export const CHAPTER_03_INITIAL_STATE: GameStateSnapshot = {
  ...INITIAL_GAME_STATE,
  chapterId: CHAPTER_03_MAP.id,
  rngState: 0x3c6ef372,
  units: INITIAL_GAME_STATE.units.map((unit) => {
    const deployment = (unit.faction === "player"
      ? CHAPTER_03_MAP.playerDeployment
      : CHAPTER_03_MAP.enemyDeployment
    ).find((candidate) => candidate.unitId === unit.id);
    if (!deployment) throw new Error("Chapter 3 is missing a deployment for " + unit.id + ".");
    return {
      ...unit,
      stats: { ...unit.stats },
      growthRates: { ...unit.growthRates },
      inventory: [...unit.inventory],
      usableWeaponTypes: [...unit.usableWeaponTypes],
      position: { x: deployment.x, y: deployment.y }
    };
  }),
  reserveUnits: []
};
