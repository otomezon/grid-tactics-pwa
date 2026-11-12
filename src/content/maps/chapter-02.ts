import type { GameMapDefinition, GameStateSnapshot } from "../../domain/models/game";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./chapter-01";

const terrain = CHAPTER_01_MAP.terrain.map((row) => [...row]);
terrain[3]![5] = "forest";
terrain[4]![4] = "fort";
terrain[5]![4] = "forest";
terrain[6]![5] = "road";

export const CHAPTER_02_MAP: GameMapDefinition = {
  ...CHAPTER_01_MAP,
  id: "chapter_02_map",
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
    { unitId: "enemy_003", x: 7, y: 1 },
    { unitId: "enemy_004", x: 2, y: 4 },
    { unitId: "enemy_005", x: 8, y: 4 }
  ],
  objective: { type: "defeat_all" }
};

// Placeholder chapter data exists to exercise chapter carry-over and save restoration.
// It is not a finalized map, enemy composition, or campaign reward specification.
export const CHAPTER_02_INITIAL_STATE: GameStateSnapshot = {
  ...INITIAL_GAME_STATE,
  chapterId: CHAPTER_02_MAP.id,
  units: INITIAL_GAME_STATE.units.map((unit) => ({
    ...unit,
    stats: { ...unit.stats },
    growthRates: { ...unit.growthRates },
    inventory: [...unit.inventory],
    usableWeaponTypes: [...unit.usableWeaponTypes],
    position: { ...unit.position }
  }))
};
