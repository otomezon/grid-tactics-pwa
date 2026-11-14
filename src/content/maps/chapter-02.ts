import type { GameMapDefinition, GameStateSnapshot } from "../../domain/models/game";
import { CHAPTER_01_MAP, createMainCharacterDefeatEvent, INITIAL_GAME_STATE, MAIN_CHARACTER_UNIT_ID } from "./chapter-01";

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
  objective: { type: "defeat_all" },
  defeatCondition: { type: "unit_defeated", targetUnitId: MAIN_CHARACTER_UNIT_ID },
  objects: [
    { id: "chapter-02-prototype-village", kind: "village", eventId: "chapter-02-prototype-village-visit" },
    { id: "chapter-02-prototype-chest", kind: "treasure-chest", eventId: "chapter-02-prototype-chest-open" },
    { id: "chapter-02-prototype-door", kind: "door", eventId: "chapter-02-prototype-door-inspect" }
  ],
  events: [
    createMainCharacterDefeatEvent(2),
    {
      id: "chapter-02-prototype-village-visit",
      trigger: {
        type: "unit-interacts",
        x: 9,
        y: 8,
        label: "試作村",
        description: "村オブジェクトの操作確認用です。正式な村人・会話・報酬はありません。"
      },
      action: {
        type: "show-message",
        speaker: "操作確認",
        text: "村イベントの動作確認です。正式な村人・会話・報酬は未設定です。"
      }
    },
    {
      id: "chapter-02-prototype-chest-open",
      trigger: {
        type: "unit-interacts",
        x: 7,
        y: 8,
        label: "試作宝箱",
        description: "宝箱オブジェクトの操作確認用です。報酬内容は未設定です。"
      },
      action: {
        type: "show-message",
        speaker: "操作確認",
        text: "宝箱を開けました。正式な報酬は未設定です。"
      }
    },
    {
      id: "chapter-02-prototype-door-inspect",
      trigger: {
        type: "unit-interacts",
        x: 9,
        y: 7,
        label: "試作扉",
        description: "扉オブジェクトの操作確認用です。鍵・通行効果は未設定です。"
      },
      action: {
        type: "show-message",
        speaker: "操作確認",
        text: "扉を調べました。通行可否はマップの地形定義のままです。"
      }
    }
  ]
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
