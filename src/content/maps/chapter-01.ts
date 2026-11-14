import type {
  GameMapDefinition,
  GameStateSnapshot,
  MapEventDefinition,
  GameUnit,
  UnitGrowthRates,
  UnitStats,
  WeaponType
} from "../../domain/models/game";
import { SAVE_VERSION } from "../../domain/models/game";
import { WEAPON_ID_BY_TYPE } from "../weapons";

const terrain = [
  ["plain", "plain", "plain", "forest", "forest", "plain", "plain", "road", "road", "plain"],
  ["plain", "road", "road", "plain", "forest", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "forest", "plain", "plain", "plain", "forest", "plain", "plain", "plain"],
  ["plain", "plain", "mountain", "mountain", "plain", "plain", "plain", "fort", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "forest", "plain", "water", "water", "plain", "plain"],
  ["plain", "forest", "forest", "plain", "forest", "plain", "water", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "road", "road", "road", "plain", "plain", "mountain", "mountain"],
  ["plain", "plain", "plain", "plain", "forest", "plain", "plain", "plain", "plain", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "road", "road", "plain"],
  ["plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain", "plain"]
] as const;

export const MAIN_CHARACTER_UNIT_ID = "unit_001" as const;

export function createMainCharacterDefeatEvent(chapterNumber: number): MapEventDefinition {
  return {
    id: `chapter-${String(chapterNumber).padStart(2, "0")}-main-character-defeat`,
    trigger: { type: "defeat" },
    action: {
      type: "show-message",
      speaker: "作戦メモ",
      text: "主人公が倒されました。作戦失敗です。"
    }
  };
}

export const CHAPTER_01_MAP: GameMapDefinition = {
  id: "chapter_01_map",
  width: 10,
  height: 10,
  terrain,
  playerDeployment: [
    { unitId: "unit_001", x: 1, y: 8 },
    { unitId: "unit_002", x: 3, y: 8 },
    { unitId: "unit_003", x: 5, y: 8 },
    { unitId: "unit_004", x: 8, y: 8 }
  ],
  enemyDeployment: [
    { unitId: "enemy_001", x: 1, y: 2 },
    { unitId: "enemy_002", x: 4, y: 2 },
    { unitId: "enemy_003", x: 7, y: 2 },
    { unitId: "enemy_004", x: 2, y: 4 },
    { unitId: "enemy_005", x: 8, y: 4 }
  ],
  objective: { type: "defeat_boss", targetUnitId: "enemy_005" },
  defeatCondition: { type: "unit_defeated", targetUnitId: MAIN_CHARACTER_UNIT_ID },
  events: [
    {
      id: "chapter-01-opening-briefing",
      trigger: { type: "stage-start" },
      action: {
        type: "show-message",
        speaker: "作戦メモ",
        text: "敵将を撃破すると勝利です。主人公が倒されると敗北です。移動可能範囲と戦闘予測を確認しながら進みましょう。"
      }
    },
    {
      id: "chapter-01-prototype-investigation",
      trigger: {
        type: "unit-interacts",
        x: 9,
        y: 8,
        label: "試作調査地点",
        description: "探索コマンドの動作確認用地点です。"
      },
      action: {
        type: "show-message",
        speaker: "操作確認",
        text: "調査地点を確認しました。調査イベントはこの章で一度だけ実行されます。"
      }
    },
    {
      id: "chapter-01-boss-defeated",
      trigger: { type: "boss-defeated" },
      action: {
        type: "show-message",
        speaker: "作戦メモ",
        text: "敵将を撃破しました。作戦成功です。"
      }
    },
    createMainCharacterDefeatEvent(1)
  ]
};

const baseStats: UnitStats = {
  hp: 20,
  strength: 6,
  magic: 0,
  skill: 7,
  speed: 8,
  luck: 4,
  defense: 5,
  resistance: 1
};

const baseGrowthRates: UnitGrowthRates = {
  hp: 80,
  strength: 35,
  magic: 5,
  skill: 55,
  speed: 60,
  luck: 35,
  defense: 25,
  resistance: 15
};

function createPrototypeUnit(
  id: string,
  name: string,
  faction: "player" | "enemy",
  classId: string,
  x: number,
  y: number,
  move: number,
  movementType: "infantry" | "cavalry",
  usableWeaponTypes: WeaponType[],
  startingItems: string[] = []
): GameUnit {
  return {
    id,
    name,
    faction,
    classId,
    level: 1,
    experience: 0,
    stats: { ...baseStats },
    growthRates: { ...baseGrowthRates },
    currentHp: baseStats.hp,
    movementType,
    move,
    usableWeaponTypes,
    inventory: [
      ...usableWeaponTypes.map((weaponType) => WEAPON_ID_BY_TYPE[weaponType]),
      ...startingItems
    ],
    equippedWeaponId: WEAPON_ID_BY_TYPE[usableWeaponTypes[0]!],
    position: { x, y },
    hasMoved: false,
    hasActed: false
  };
}

// Temporary placeholder content for movement and combat interaction verification only.
export const INITIAL_UNITS: GameUnit[] = [
  createPrototypeUnit("unit_001", "主人公", "player", "swordsman", 1, 8, 5, "infantry", ["sword"]),
  createPrototypeUnit("unit_002", "味方02", "player", "archer", 3, 8, 5, "infantry", ["bow"]),
  createPrototypeUnit("unit_003", "味方03", "player", "soldier", 5, 8, 5, "infantry", ["lance"]),
  createPrototypeUnit("unit_004", "味方04", "player", "cavalry", 8, 8, 6, "cavalry", ["sword", "lance"]),
  createPrototypeUnit("enemy_001", "敵01", "enemy", "fighter", 1, 2, 5, "infantry", ["axe"]),
  createPrototypeUnit("enemy_002", "敵02", "enemy", "archer", 4, 2, 5, "infantry", ["bow"]),
  createPrototypeUnit("enemy_003", "敵03", "enemy", "soldier", 7, 2, 5, "infantry", ["lance"]),
  createPrototypeUnit("enemy_004", "敵04", "enemy", "swordsman", 2, 4, 5, "infantry", ["sword"]),
  createPrototypeUnit("enemy_005", "敵将", "enemy", "cavalry", 8, 4, 6, "cavalry", ["lance"])
];

export const INITIAL_GAME_STATE: GameStateSnapshot = {
  saveVersion: SAVE_VERSION,
  chapterId: CHAPTER_01_MAP.id,
  phase: "player",
  turn: 1,
  rngState: 0x6d2b79f5,
  units: INITIAL_UNITS,
  reserveUnits: [],
  campaignUnitBattleRecords: [],
  firedMapEventIds: [],
  acknowledgedMapEventIds: [],
  mapEventChoices: [],
  campaignChoices: [],
  campaignBattleLog: []
};
