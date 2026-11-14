import type { GameMapDefinition, GameStateSnapshot } from "../../domain/models/game";
import { HEALING_POTION_ID } from "../items";
import { CHAPTER_02_SCOUT_RECRUIT } from "../campaign-recruits";
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
    { id: "chapter-02-prototype-village", kind: "village", eventId: "chapter-02-village-route-choice" },
    { id: "chapter-02-prototype-chest", kind: "treasure-chest", eventId: "chapter-02-prototype-chest-reward" },
    { id: "chapter-02-prototype-door", kind: "door", eventId: "chapter-02-door-inspection-choice" }
  ],
  events: [
    createMainCharacterDefeatEvent(2),
    {
      id: "chapter-02-village-route-choice",
      trigger: {
        type: "unit-interacts",
        x: 9,
        y: 8,
        label: "試作村",
        description: "試作の案内イベントです。選択結果は第3章のメッセージへ引き継がれます。"
      },
      action: {
        type: "show-choice",
        speaker: "村の案内人",
        text: "この先には森を抜ける小道と、東へ続く古い峠道があります。どちらの様子を聞きますか？",
        campaignChoiceKey: "chapter-02.village-route",
        choices: [
          { id: "forest-trail", label: "森の小道について聞く" },
          { id: "eastern-pass", label: "東の峠道について聞く" }
        ]
      }
    },
    {
      id: "chapter-02-village-forest-trail",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-village-route-choice",
        choiceId: "forest-trail"
      },
      action: {
        type: "show-message",
        speaker: "村の案内人",
        text: "森の小道は狭いものの、険しい地形を避けて進めるそうです。"
      }
    },
    {
      id: "chapter-02-village-eastern-pass",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-village-route-choice",
        choiceId: "eastern-pass"
      },
      action: {
        type: "show-message",
        speaker: "村の案内人",
        text: "東の峠道は見通しがよい一方、敵の姿を見かけることがあるそうです。"
      }
    },
    {
      id: "chapter-02-scout-recruitment-choice",
      trigger: {
        type: "unit-interacts",
        x: 5,
        y: 7,
        label: "旅の斥候",
        description: "斥候ミナが同行者を探しています。話を聞いたあと、加入するかどうか選べます。"
      },
      action: {
        type: "show-choice",
        speaker: "斥候ミナ",
        text: "道案内なら手伝えるよ。よかったら一緒に旅をさせてくれないかな？",
        campaignChoiceKey: "chapter-02.scout-recruitment",
        choices: [
          { id: "join-scout", label: "仲間に誘う" },
          { id: "decline-scout", label: "今回は見送る" }
        ]
      }
    },
    {
      id: "chapter-02-scout-recruitment-join",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-scout-recruitment-choice",
        choiceId: "join-scout"
      },
      action: {
        type: "recruit-unit",
        speaker: "斥候ミナ",
        text: "斥候ミナが同行することになりました。今の戦闘には参加せず、第3章の出撃準備で選べます。",
        unit: CHAPTER_02_SCOUT_RECRUIT
      }
    },
    {
      id: "chapter-02-scout-recruitment-decline",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-scout-recruitment-choice",
        choiceId: "decline-scout"
      },
      action: {
        type: "show-message",
        speaker: "斥候ミナ",
        text: "分かった。気が変わったらまた声をかけてね。"
      }
    },
    {
      id: "chapter-02-prototype-chest-reward",
      trigger: {
        type: "unit-interacts",
        x: 7,
        y: 8,
        label: "試作宝箱",
        description: "試作回復薬が1つ入っています。回復量は仮値です。"
      },
      action: {
        type: "grant-item",
        speaker: "宝箱",
        text: "試作回復薬を1つ手に入れました。主人公の所持品に追加されます。",
        recipientUnitId: MAIN_CHARACTER_UNIT_ID,
        itemId: HEALING_POTION_ID,
        quantity: 1
      }
    },
    {
      id: "chapter-02-door-inspection-choice",
      trigger: {
        type: "unit-interacts",
        x: 2,
        y: 8,
        label: "試作扉",
        description: "表面または周囲を調べられます。鍵・開閉・通行効果は未設定です。"
      },
      action: {
        type: "show-choice",
        speaker: "閉ざされた扉",
        text: "扉は閉じたままです。表面と周囲のどちらを調べますか？",
        choices: [
          { id: "door-markings", label: "扉の表面を調べる" },
          { id: "door-surroundings", label: "扉の周囲を調べる" }
        ]
      }
    },
    {
      id: "chapter-02-door-markings",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-door-inspection-choice",
        choiceId: "door-markings"
      },
      action: {
        type: "show-message",
        speaker: "調査メモ",
        text: "表面には古い紋様が刻まれています。意味は分からず、扉は開かないままです。"
      }
    },
    {
      id: "chapter-02-door-surroundings",
      trigger: {
        type: "event-choice",
        eventId: "chapter-02-door-inspection-choice",
        choiceId: "door-surroundings"
      },
      action: {
        type: "show-message",
        speaker: "調査メモ",
        text: "周囲を調べましたが、開閉の手掛かりは見つかりません。鍵や通行条件は未設定のままです。"
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
