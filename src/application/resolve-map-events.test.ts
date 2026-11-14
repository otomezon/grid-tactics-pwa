import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { HEALING_POTION_ID } from "../content/items";
import { CHAPTER_02_MAP, CHAPTER_02_INITIAL_STATE } from "../content/maps/chapter-02";
import { CHAPTER_03_MAP, CHAPTER_03_INITIAL_STATE } from "../content/maps/chapter-03";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import type { GameMapDefinition, MapEventTrigger } from "../domain/models/game";
import {
  acknowledgeMapEvent,
  chooseMapEventOption,
  getMapEventMessageHistory,
  getPendingMapEventMessages,
  resolveMapEvents
} from "./resolve-map-events";

const EVENT_MAP: GameMapDefinition = {
  ...CHAPTER_01_MAP,
  events: [
    {
      id: "opening",
      trigger: { type: "stage-start" },
      action: { type: "show-message", speaker: "作戦メモ", text: "敵軍を全滅させましょう。" }
    },
    {
      id: "enemy-phase-two",
      trigger: { type: "turn-start", turn: 2, phase: "enemy" },
      action: { type: "show-message", text: "敵軍フェイズです。" }
    },
    {
      id: "enemy-001-defeated",
      trigger: { type: "unit-defeated", unitId: "enemy_001" },
      action: { type: "show-message", text: "敵01を撃破しました。" }
    },
    {
      id: "boss-defeated",
      trigger: { type: "boss-defeated" },
      action: { type: "show-message", text: "敵将を撃破しました。" }
    },
    {
      id: "victory",
      trigger: { type: "victory" },
      action: { type: "show-message", text: "勝利しました。" }
    },
    {
      id: "defeat",
      trigger: { type: "defeat" },
      action: { type: "show-message", text: "敗北しました。" }
    }
  ]
};

describe("resolveMapEvents", () => {
  it("fires matching events in content order and returns display messages", () => {
    const original = structuredClone(INITIAL_GAME_STATE);
    const trigger: MapEventTrigger = { type: "stage-start" };
    const result = resolveMapEvents(INITIAL_GAME_STATE, EVENT_MAP, trigger);

    expect(result.messages).toEqual([{
      id: "opening",
      speaker: "作戦メモ",
      text: "敵軍を全滅させましょう。"
    }]);
    expect(result.nextState.firedMapEventIds).toEqual(["opening"]);
    expect(INITIAL_GAME_STATE).toEqual(original);
  });

  it("fires each event only once and preserves prior progress", () => {
    const started = resolveMapEvents(INITIAL_GAME_STATE, EVENT_MAP, { type: "stage-start" });
    const repeated = resolveMapEvents(started.nextState, EVENT_MAP, { type: "stage-start" });

    expect(repeated.messages).toEqual([]);
    expect(repeated.nextState).toBe(started.nextState);
    expect(repeated.nextState.firedMapEventIds).toEqual(["opening"]);
  });

  it("keeps global map content order when several triggers are true at once", () => {
    const result = resolveMapEvents(
      INITIAL_GAME_STATE,
      EVENT_MAP,
      [
        { type: "unit-defeated", unitId: "enemy_001" },
        { type: "boss-defeated" }
      ]
    );
    expect(result.nextState.firedMapEventIds).toEqual([
      "enemy-001-defeated",
      "boss-defeated"
    ]);
    expect(result.messages.map((message) => message.id)).toEqual([
      "enemy-001-defeated",
      "boss-defeated"
    ]);
  });

  it("matches turn and phase exactly and ignores unrelated events", () => {
    const result = resolveMapEvents(
      INITIAL_GAME_STATE,
      EVENT_MAP,
      { type: "turn-start", turn: 2, phase: "enemy" }
    );
    const wrongTurn = resolveMapEvents(
      INITIAL_GAME_STATE,
      EVENT_MAP,
      { type: "turn-start", turn: 1, phase: "enemy" }
    );

    expect(result.nextState.firedMapEventIds).toEqual(["enemy-phase-two"]);
    expect(result.messages[0]?.text).toBe("敵軍フェイズです。");
    expect(wrongTurn.nextState).toBe(INITIAL_GAME_STATE);
    expect(wrongTurn.messages).toEqual([]);
  });

  it("does not mutate or clone state when no event matches", () => {
    const result = resolveMapEvents(INITIAL_GAME_STATE, EVENT_MAP, {
      type: "turn-start", turn: 99, phase: "enemy"
    });
    expect(result.nextState).toBe(INITIAL_GAME_STATE);
    expect(result.messages).toEqual([]);
  });

  it("keeps fired messages pending until they are explicitly acknowledged", () => {
    const fired = resolveMapEvents(INITIAL_GAME_STATE, EVENT_MAP, { type: "stage-start" }).nextState;
    expect(getPendingMapEventMessages(fired, EVENT_MAP)).toEqual([{
      id: "opening",
      speaker: "作戦メモ",
      text: "敵軍を全滅させましょう。"
    }]);

    const acknowledged = acknowledgeMapEvent(fired, EVENT_MAP, "opening");
    expect(acknowledged.acknowledgedMapEventIds).toEqual(["opening"]);
    expect(getPendingMapEventMessages(acknowledged, EVENT_MAP)).toEqual([]);
    expect(acknowledgeMapEvent(acknowledged, EVENT_MAP, "opening")).toBe(acknowledged);
    expect(acknowledgeMapEvent(fired, EVENT_MAP, "not-fired")).toBe(fired);
    expect(fired.acknowledgedMapEventIds).toEqual([]);
  });

  it("rebuilds all fired messages in persisted chronology, including acknowledged messages", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      firedMapEventIds: ["enemy-phase-two", "opening", "unknown-id", "enemy-001-defeated"],
      acknowledgedMapEventIds: ["opening"]
    };

    expect(getMapEventMessageHistory(state, EVENT_MAP)).toEqual([
      { id: "enemy-phase-two", speaker: null, text: "敵軍フェイズです。" },
      { id: "opening", speaker: "作戦メモ", text: "敵軍を全滅させましょう。" },
      { id: "enemy-001-defeated", speaker: null, text: "敵01を撃破しました。" }
    ]);
    expect(getPendingMapEventMessages(state, EVENT_MAP).map((event) => event.id))
      .toEqual(["enemy-phase-two", "enemy-001-defeated"]);
    expect(state.acknowledgedMapEventIds).toEqual(["opening"]);
  });

  it("does not include map messages that have not fired", () => {
    expect(getMapEventMessageHistory(INITIAL_GAME_STATE, EVENT_MAP)).toEqual([]);
  });

  it("rejects a history request for another chapter", () => {
    expect(() => getMapEventMessageHistory(
      { ...INITIAL_GAME_STATE, chapterId: "other_chapter" },
      EVENT_MAP
    )).toThrow(/current chapter/);
  });

  it("preserves the order of pending messages as authored in map content", () => {
    const fired = {
      ...INITIAL_GAME_STATE,
      firedMapEventIds: ["opening", "enemy-001-defeated"]
    };
    expect(getPendingMapEventMessages(fired, EVENT_MAP).map((event) => event.id))
      .toEqual(["opening", "enemy-001-defeated"]);
  });

  it("rejects a state from another chapter", () => {
    expect(() => resolveMapEvents(
      { ...INITIAL_GAME_STATE, chapterId: "other_chapter" },
      EVENT_MAP,
      { type: "stage-start" }
    )).toThrow(/current chapter/);
  });
  it("grants a configured item once and reconstructs its event message", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "supply-cache",
        trigger: { type: "stage-start" },
        action: {
          type: "grant-item",
          recipientUnitId: "unit_001",
          itemId: "healing_potion",
          quantity: 1,
          speaker: "補給係",
          text: "回復薬を受け取りました。"
        }
      }]
    };
    const originalInventory = [...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!.inventory];
    const result = resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" });
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")!.inventory)
      .toEqual([...originalInventory, "healing_potion"]);
    expect(result.nextState.firedMapEventIds).toEqual(["supply-cache"]);
    expect(getMapEventMessageHistory(result.nextState, map)).toEqual([{
      id: "supply-cache", speaker: "補給係", text: "回復薬を受け取りました。"
    }]);
    expect(INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!.inventory).toEqual(originalInventory);
    const reloaded = resolveMapEvents(result.nextState, map, { type: "stage-start" });
    expect(reloaded.nextState).toBe(result.nextState);
    expect(reloaded.messages).toEqual([]);
  });

  it("rejects a full inventory atomically without firing the reward event", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "supply-cache",
        trigger: { type: "stage-start" },
        action: {
          type: "grant-item",
          recipientUnitId: "unit_001",
          itemId: "healing_potion",
          quantity: 1,
          text: "回復薬を受け取りました。"
        }
      }]
    };
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) => unit.id === "unit_001"
        ? { ...unit, inventory: ["iron_sword", "healing_potion", "promotion_seal", "iron_sword", "healing_potion"] }
        : unit)
    };
    const original = structuredClone(state);
    expect(() => resolveMapEvents(state, map, { type: "stage-start" }))
      .toThrow(/inventory does not have enough free slots/);
    expect(state).toEqual(original);
  });

  it("spawns a predeclared enemy once and validates the resulting save state", () => {
    const base = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const reinforcement = {
      ...base,
      id: "enemy_reinforcement_01",
      name: "増援01",
      position: { x: 9, y: 7 },
      hasMoved: false,
      hasActed: false
    };
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "reinforcement-wave-1",
        trigger: { type: "turn-start", turn: 2, phase: "enemy" },
        action: {
          type: "spawn-reinforcement",
          unit: reinforcement,
          speaker: "敵軍",
          text: "敵の増援が現れました。"
        }
      }]
    };
    const result = resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "turn-start", turn: 2, phase: "enemy"
    });
    expect(result.nextState.units.find((unit) => unit.id === reinforcement.id)).toMatchObject({
      faction: "enemy", position: { x: 9, y: 7 }, hasMoved: false, hasActed: false
    });
    expect(isValidGameStateSnapshot(result.nextState, map)).toBe(true);
    expect(getPendingMapEventMessages(result.nextState, map).map((message) => message.id))
      .toEqual(["reinforcement-wave-1"]);
    const reloaded = resolveMapEvents(result.nextState, map, {
      type: "turn-start", turn: 2, phase: "enemy"
    });
    expect(reloaded.nextState).toBe(result.nextState);
    expect(reloaded.nextState.units.filter((unit) => unit.id === reinforcement.id)).toHaveLength(1);
  });

  it("rejects a reinforcement on an occupied tile without partially changing state", () => {
    const base = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const reinforcement = {
      ...base,
      id: "enemy_reinforcement_02",
      name: "増援02",
      position: { ...INITIAL_GAME_STATE.units[0]!.position },
      hasMoved: false,
      hasActed: false
    };
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "blocked-reinforcement",
        trigger: { type: "stage-start" },
        action: {
          type: "spawn-reinforcement",
          unit: reinforcement,
          text: "敵の増援が現れました。"
        }
      }]
    };
    const original = structuredClone(INITIAL_GAME_STATE);
    expect(() => resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" }))
      .toThrow(/occupied tile/);
    expect(INITIAL_GAME_STATE).toEqual(original);
  });


  it("matches a unit-interaction event by coordinate and optional actor ID", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "prototype-investigation",
        trigger: {
          type: "unit-interacts",
          x: 9,
          y: 8,
          label: "試作調査地点",
          unitId: "unit_004"
        },
        action: { type: "show-message", text: "調査しました。" }
      }]
    };
    const wrongActor = resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "unit-interacts", x: 9, y: 8, label: "試作調査地点", unitId: "unit_001"
    });
    expect(wrongActor.nextState).toBe(INITIAL_GAME_STATE);
    const correctActor = resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "unit-interacts", x: 9, y: 8, label: "試作調査地点", unitId: "unit_004"
    });
    expect(correctActor.nextState.firedMapEventIds).toEqual(["prototype-investigation"]);
    expect(correctActor.messages.map((message) => message.text)).toEqual(["調査しました。"]);
  });


  it("recruits a predeclared campaign member into reserves exactly once", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const recruit = {
      ...campaignData,
      id: "recruit_from_event",
      name: "加入候補",
      stats: { ...campaignData.stats },
      growthRates: { ...campaignData.growthRates },
      usableWeaponTypes: [...campaignData.usableWeaponTypes],
      inventory: [...campaignData.inventory]
    };
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "unit-recruitment",
        trigger: {
          type: "unit-interacts",
          x: 9,
          y: 8,
          label: "加入地点"
        },
        action: {
          type: "recruit-unit",
          unit: recruit,
          text: "加入候補が控え名簿に加わりました。"
        }
      }]
    };
    const original = structuredClone(INITIAL_GAME_STATE);
    const result = resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "unit-interacts", x: 9, y: 8, label: "加入地点", unitId: "unit_004"
    });
    expect(result.nextState.reserveUnits).toEqual([recruit]);
    expect(result.nextState.units.some((unit) => unit.id === recruit.id)).toBe(false);
    expect(result.nextState.firedMapEventIds).toEqual(["unit-recruitment"]);
    expect(isValidGameStateSnapshot(result.nextState, map)).toBe(true);
    expect(getPendingMapEventMessages(result.nextState, map).map((entry) => entry.text))
      .toEqual(["加入候補が控え名簿に加わりました。"]);
    const repeated = resolveMapEvents(result.nextState, map, {
      type: "unit-interacts", x: 9, y: 8, label: "加入地点", unitId: "unit_004"
    });
    expect(repeated.nextState).toBe(result.nextState);
    expect(repeated.nextState.reserveUnits).toHaveLength(1);
    expect(INITIAL_GAME_STATE).toEqual(original);
  });

  it("rejects a recruited ID already present in the active roster without committing the event", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "duplicate-recruitment",
        trigger: { type: "unit-interacts", x: 9, y: 8, label: "加入地点" },
        action: {
          type: "recruit-unit",
          unit: { ...campaignData, name: "重複候補" },
          text: "加入イベント"
        }
      }]
    };
    const original = structuredClone(INITIAL_GAME_STATE);
    expect(() => resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "unit-interacts", x: 9, y: 8, label: "加入地点", unitId: "unit_004"
    })).toThrow(/already exists in the campaign roster/);
    expect(INITIAL_GAME_STATE).toEqual(original);
    expect(INITIAL_GAME_STATE.firedMapEventIds).toEqual([]);
  });


  it("records a dialogue choice, fires only its matching branch, and rebuilds the selected label", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [
        {
          id: "opening-choice",
          trigger: { type: "stage-start" },
          action: {
            type: "show-choice",
            speaker: "案内人",
            text: "どちらの道へ進みますか？",
            choices: [
              { id: "forest", label: "森の道へ進む" },
              { id: "road", label: "街道を進む" }
            ]
          }
        },
        {
          id: "forest-branch",
          trigger: { type: "event-choice", eventId: "opening-choice", choiceId: "forest" },
          action: { type: "show-message", speaker: "案内人", text: "森の道を選びました。" }
        },
        {
          id: "road-branch",
          trigger: { type: "event-choice", eventId: "opening-choice", choiceId: "road" },
          action: { type: "show-message", speaker: "案内人", text: "街道を選びました。" }
        }
      ]
    };
    const opened = resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" });
    expect(opened.messages[0]).toMatchObject({
      id: "opening-choice",
      choices: [
        { id: "forest", label: "森の道へ進む" },
        { id: "road", label: "街道を進む" }
      ],
      selectedChoiceLabel: null
    });
    expect(getPendingMapEventMessages(opened.nextState, map).map((message) => message.id))
      .toEqual(["opening-choice"]);
    expect(acknowledgeMapEvent(opened.nextState, map, "opening-choice")).toBe(opened.nextState);

    const bypass = resolveMapEvents(opened.nextState, map, {
      type: "event-choice", eventId: "opening-choice", choiceId: "road"
    });
    expect(bypass.nextState).toBe(opened.nextState);
    expect(bypass.messages).toEqual([]);

    const selected = chooseMapEventOption(opened.nextState, map, "opening-choice", "forest");
    expect(selected.selectedChoiceLabel).toBe("森の道へ進む");
    expect(selected.nextState.mapEventChoices).toEqual([
      { eventId: "opening-choice", choiceId: "forest" }
    ]);
    expect(selected.nextState.acknowledgedMapEventIds).toContain("opening-choice");
    expect(selected.nextState.firedMapEventIds).toEqual(["opening-choice", "forest-branch"]);
    expect(selected.messages.map((message) => message.text)).toEqual(["森の道を選びました。"]);
    expect(getPendingMapEventMessages(selected.nextState, map).map((message) => message.id))
      .toEqual(["forest-branch"]);
    expect(getMapEventMessageHistory(selected.nextState, map)[0]?.selectedChoiceLabel)
      .toBe("森の道へ進む");
    expect(isValidGameStateSnapshot(selected.nextState, map)).toBe(true);
    expect(() => chooseMapEventOption(selected.nextState, map, "opening-choice", "road"))
      .toThrow(/not pending/);
    expect(INITIAL_GAME_STATE.firedMapEventIds).toEqual([]);
    expect(INITIAL_GAME_STATE.mapEventChoices).toEqual([]);
  });

  it("does not persist a choice when its selected branch action fails", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [
        {
          id: "inventory-choice",
          trigger: { type: "stage-start" },
          action: {
            type: "show-choice",
            text: "報酬を受け取りますか？",
            choices: [
              { id: "take", label: "受け取る" },
              { id: "leave", label: "受け取らない" }
            ]
          }
        },
        {
          id: "take-reward",
          trigger: { type: "event-choice", eventId: "inventory-choice", choiceId: "take" },
          action: {
            type: "grant-item",
            recipientUnitId: "unit_001",
            itemId: "healing_potion",
            quantity: 1,
            text: "回復薬を受け取りました。"
          }
        }
      ]
    };
    const opened = resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" });
    const fullInventoryState = {
      ...opened.nextState,
      units: opened.nextState.units.map((unit) => unit.id === "unit_001"
        ? { ...unit, inventory: ["iron_sword", "healing_potion", "promotion_seal", "iron_sword", "healing_potion"] }
        : unit)
    };
    const original = structuredClone(fullInventoryState);
    expect(() => chooseMapEventOption(fullInventoryState, map, "inventory-choice", "take"))
      .toThrow(/inventory does not have enough free slots/);
    expect(fullInventoryState).toEqual(original);
    expect(fullInventoryState.mapEventChoices).toEqual([]);
    expect(fullInventoryState.acknowledgedMapEventIds).toEqual([]);
    expect(getPendingMapEventMessages(fullInventoryState, map).map((event) => event.id))
      .toEqual(["inventory-choice"]);
  });

  it("rejects unknown dialogue choice IDs without changing the pending event", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "small-choice",
        trigger: { type: "stage-start" },
        action: {
          type: "show-choice",
          text: "選択してください。",
          choices: [{ id: "left", label: "左" }, { id: "right", label: "右" }]
        }
      }]
    };
    const opened = resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" });
    expect(() => chooseMapEventOption(opened.nextState, map, "small-choice", "unknown"))
      .toThrow(/not available/);
    expect(opened.nextState.mapEventChoices).toEqual([]);
    expect(opened.nextState.acknowledgedMapEventIds).toEqual([]);
  });

  it("records a named dialogue decision once for use by later chapters", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "route-decision",
        trigger: { type: "stage-start" },
        action: {
          type: "show-choice",
          campaignChoiceKey: "chapter-01.route",
          text: "どちらの道へ進みますか？",
          choices: [
            { id: "forest", label: "森の道" },
            { id: "road", label: "街道" }
          ]
        }
      }, {
        id: "local-forest-branch",
        trigger: { type: "event-choice", eventId: "route-decision", choiceId: "forest" },
        action: { type: "show-message", text: "森の道を選びました。" }
      }]
    };
    const opened = resolveMapEvents(INITIAL_GAME_STATE, map, { type: "stage-start" });
    const selected = chooseMapEventOption(opened.nextState, map, "route-decision", "forest");

    expect(selected.nextState.campaignChoices).toEqual([{
      key: "chapter-01.route",
      choiceId: "forest",
      sourceChapterId: CHAPTER_01_MAP.id,
      sourceEventId: "route-decision"
    }]);
    expect(selected.nextState.firedMapEventIds).toEqual(["route-decision", "local-forest-branch"]);
    expect(isValidGameStateSnapshot(selected.nextState, map)).toBe(true);
    expect(INITIAL_GAME_STATE.campaignChoices).toEqual([]);
  });

  it("resolves both door inspection choices without opening the door or changing campaign route", () => {
    const originalTerrain = CHAPTER_02_MAP.terrain.map((row) => [...row]);
    const opened = resolveMapEvents(CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP, {
      type: "unit-interacts",
      x: 2,
      y: 8,
      label: "試作扉",
      unitId: "unit_001"
    });
    expect(opened.messages[0]).toMatchObject({
      id: "chapter-02-door-inspection-choice",
      choices: [
        { id: "door-markings", label: "扉の表面を調べる" },
        { id: "door-surroundings", label: "扉の周囲を調べる" }
      ]
    });

    const markings = chooseMapEventOption(
      opened.nextState,
      CHAPTER_02_MAP,
      "chapter-02-door-inspection-choice",
      "door-markings"
    );
    expect(markings.messages.map((message) => message.id)).toEqual(["chapter-02-door-markings"]);
    expect(markings.messages[0]?.text).toContain("古い紋様");
    expect(markings.nextState.firedMapEventIds).not.toContain("chapter-02-door-surroundings");
    expect(markings.nextState.campaignChoices).toEqual(CHAPTER_02_INITIAL_STATE.campaignChoices);

    const surroundingsOpen = resolveMapEvents(CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP, {
      type: "unit-interacts", x: 2, y: 8, label: "試作扉", unitId: "unit_001"
    });
    const surroundings = chooseMapEventOption(
      surroundingsOpen.nextState,
      CHAPTER_02_MAP,
      "chapter-02-door-inspection-choice",
      "door-surroundings"
    );
    expect(surroundings.messages.map((message) => message.id)).toEqual(["chapter-02-door-surroundings"]);
    expect(surroundings.messages[0]?.text).toContain("通行条件は未設定");
    expect(surroundings.nextState.firedMapEventIds).not.toContain("chapter-02-door-markings");
    expect(CHAPTER_02_MAP.terrain).toEqual(originalTerrain);
  });

  it("uses the Chapter 2 village decision in Chapter 3 and grants the chest potion once", () => {
    const villageOpened = resolveMapEvents(CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP, {
      type: "unit-interacts",
      x: 9,
      y: 8,
      label: "試作村",
      unitId: "unit_003"
    });
    expect(villageOpened.messages[0]).toMatchObject({
      id: "chapter-02-village-route-choice",
      choices: [
        { id: "forest-trail", label: "森の小道について聞く" },
        { id: "eastern-pass", label: "東の峠道について聞く" }
      ]
    });

    const villageChoice = chooseMapEventOption(
      villageOpened.nextState,
      CHAPTER_02_MAP,
      "chapter-02-village-route-choice",
      "forest-trail"
    );
    expect(villageChoice.nextState.campaignChoices).toEqual([{
      key: "chapter-02.village-route",
      choiceId: "forest-trail",
      sourceChapterId: CHAPTER_02_MAP.id,
      sourceEventId: "chapter-02-village-route-choice"
    }]);
    expect(villageChoice.nextState.firedMapEventIds).toContain("chapter-02-village-forest-trail");
    expect(villageChoice.nextState.firedMapEventIds).not.toContain("chapter-02-village-eastern-pass");

    const chapterThree = resolveMapEvents({
      ...CHAPTER_03_INITIAL_STATE,
      campaignChoices: villageChoice.nextState.campaignChoices
    }, CHAPTER_03_MAP, { type: "stage-start" });
    expect(chapterThree.messages.map((message) => message.id)).toEqual([
      "chapter-03-village-forest-trail-follow-up"
    ]);
    expect(chapterThree.messages[0]?.text).toContain("第2章の村で聞いた森の小道");
    expect(chapterThree.nextState.firedMapEventIds).not.toContain("chapter-03-village-eastern-pass-follow-up");

    const easternVillageOpened = resolveMapEvents(CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP, {
      type: "unit-interacts", x: 9, y: 8, label: "試作村", unitId: "unit_003"
    });
    const easternChoice = chooseMapEventOption(
      easternVillageOpened.nextState, CHAPTER_02_MAP, "chapter-02-village-route-choice", "eastern-pass"
    );
    const easternChapterThree = resolveMapEvents({
      ...CHAPTER_03_INITIAL_STATE,
      campaignChoices: easternChoice.nextState.campaignChoices
    }, CHAPTER_03_MAP, { type: "stage-start" });
    expect(easternChapterThree.messages.map((message) => message.id)).toEqual([
      "chapter-03-village-eastern-pass-follow-up"
    ]);
    expect(easternChapterThree.nextState.firedMapEventIds)
      .not.toContain("chapter-03-village-forest-trail-follow-up");

    const beforeChest = [...CHAPTER_02_INITIAL_STATE.units.find((unit) => unit.id === "unit_001")!.inventory];
    const chestOpened = resolveMapEvents(CHAPTER_02_INITIAL_STATE, CHAPTER_02_MAP, {
      type: "unit-interacts",
      x: 7,
      y: 8,
      label: "試作宝箱",
      unitId: "unit_004"
    });
    const afterChest = chestOpened.nextState.units.find((unit) => unit.id === "unit_001")!.inventory;
    expect(afterChest).toEqual([...beforeChest, HEALING_POTION_ID]);
    expect(chestOpened.nextState.firedMapEventIds).toContain("chapter-02-prototype-chest-reward");
    const repeatedChest = resolveMapEvents(chestOpened.nextState, CHAPTER_02_MAP, {
      type: "unit-interacts",
      x: 7,
      y: 8,
      label: "試作宝箱",
      unitId: "unit_004"
    });
    expect(repeatedChest.nextState).toBe(chestOpened.nextState);
    expect(repeatedChest.nextState.units.find((unit) => unit.id === "unit_001")!.inventory)
      .toEqual([...beforeChest, HEALING_POTION_ID]);

    const fullInventoryState = {
      ...CHAPTER_02_INITIAL_STATE,
      units: CHAPTER_02_INITIAL_STATE.units.map((unit) => unit.id === "unit_001"
        ? { ...unit, inventory: ["iron_sword", "healing_potion", "promotion_seal", "iron_sword", "healing_potion"] }
        : unit)
    };
    const unchangedFullInventory = structuredClone(fullInventoryState);
    expect(() => resolveMapEvents(fullInventoryState, CHAPTER_02_MAP, {
      type: "unit-interacts", x: 7, y: 8, label: "試作宝箱", unitId: "unit_004"
    })).toThrow(/inventory does not have enough free slots/);
    expect(fullInventoryState).toEqual(unchangedFullInventory);
    expect(fullInventoryState.firedMapEventIds).not.toContain("chapter-02-prototype-chest-reward");
  });

});
