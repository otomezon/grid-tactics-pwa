import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition, MapEventTrigger } from "../domain/models/game";
import {
  acknowledgeMapEvent,
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
});
