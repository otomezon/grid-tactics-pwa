import type { GameMapDefinition, GameStateSnapshot } from "../../domain/models/game";
import { CHAPTER_01_MAP, createMainCharacterDefeatEvent, INITIAL_GAME_STATE, MAIN_CHARACTER_UNIT_ID } from "./chapter-01";
import { CHAPTER_02_SCOUT_RECRUIT } from "../campaign-recruits";

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
    { unitId: "unit_004", x: 8, y: 8 },
    { unitId: CHAPTER_02_SCOUT_RECRUIT.id, x: 7, y: 8, optional: true }
  ],
  enemyDeployment: [
    { unitId: "enemy_001", x: 1, y: 1 },
    { unitId: "enemy_002", x: 4, y: 1 },
    { unitId: "enemy_003", x: 8, y: 1 },
    { unitId: "enemy_004", x: 2, y: 5 },
    { unitId: "enemy_005", x: 8, y: 5 }
  ],
  objective: { type: "defeat_all" },
  defeatCondition: { type: "unit_defeated", targetUnitId: MAIN_CHARACTER_UNIT_ID },
  events: [
    createMainCharacterDefeatEvent(3),
    {
      id: "chapter-03-village-forest-trail-follow-up",
      trigger: { type: "stage-start" },
      condition: {
        type: "campaign-choice",
        key: "chapter-02.village-route",
        choiceId: "forest-trail"
      },
      action: {
        type: "show-message",
        speaker: "旅の記録",
        text: "第2章の村で聞いた森の小道を思い出した。険しい地形を避けるときに役立ちそうだ。"
      }
    },
    {
      id: "chapter-03-scout-joins-expedition",
      trigger: { type: "stage-start" },
      condition: {
        type: "campaign-choice",
        key: "chapter-02.scout-recruitment",
        choiceId: "join-scout"
      },
      action: {
        type: "show-message",
        speaker: "斥候ミナ",
        text: "同行を認めてくれてありがとう。出撃準備で選んでもらえれば、前衛の支援に回るよ。"
      }
    },
    {
      id: "chapter-03-village-eastern-pass-follow-up",
      trigger: { type: "stage-start" },
      condition: {
        type: "campaign-choice",
        key: "chapter-02.village-route",
        choiceId: "eastern-pass"
      },
      action: {
        type: "show-message",
        speaker: "旅の記録",
        text: "第2章の村で聞いた東の峠道の話を思い出した。進む前に周囲を警戒しよう。"
      }
    }
  ]
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
