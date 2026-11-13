import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition } from "../domain/models/game";
import { resolveMapEvents } from "./resolve-map-events";
import { resolveMapEventTransition } from "./resolve-map-event-transition";

const EVENT_MAP: GameMapDefinition = {
  ...CHAPTER_01_MAP,
  objective: { type: "defeat_boss", targetUnitId: "enemy_001" },
  events: [
    {
      id: "enemy-turn",
      trigger: { type: "turn-start", turn: 1, phase: "enemy" },
      action: { type: "show-message", text: "敵軍フェイズ開始。" }
    },
    {
      id: "boss",
      trigger: { type: "boss-defeated" },
      action: { type: "show-message", speaker: "案内", text: "敵将を撃破。" }
    },
    {
      id: "unit",
      trigger: { type: "unit-defeated", unitId: "enemy_001" },
      action: { type: "show-message", text: "敵01撃破。" }
    },
    {
      id: "win",
      trigger: { type: "victory" },
      action: { type: "show-message", text: "勝利。" }
    },
    {
      id: "lose",
      trigger: { type: "defeat" },
      action: { type: "show-message", text: "敗北。" }
    }
  ]
};

describe("resolveMapEventTransition", () => {
  it("fires a turn-start event when the committed phase changes", () => {
    const next = { ...INITIAL_GAME_STATE, phase: "enemy" as const };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP);
    expect(result.nextState.firedMapEventIds).toEqual(["enemy-turn"]);
    expect(result.messages.map((message) => message.text)).toEqual(["敵軍フェイズ開始。"]);
  });

  it("fires unit-defeated and boss-defeated events for the same defeated boss", () => {
    const next = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "enemy_001" ? { ...unit, currentHp: 0 } : unit
      )
    };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP);
    expect(result.nextState.firedMapEventIds).toEqual(["boss", "unit", "win"]);
    expect(result.messages.map((message) => message.text)).toEqual(["敵将を撃破。", "敵01撃破。", "勝利。"]);
  });

  it("fires victory when the boss is defeated and all remaining enemies have already been removed", () => {
    const next = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) =>
        unit.faction === "player" || unit.id === "enemy_001"
      ).map((unit) => unit.id === "enemy_001" ? { ...unit, currentHp: 0 } : unit)
    };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP);
    expect(result.nextState.firedMapEventIds).toEqual(["boss", "unit", "win"]);
    expect(result.messages.map((message) => message.text)).toEqual(["敵将を撃破。", "敵01撃破。", "勝利。"]);
  });

  it("fires defeat when the player roster is wiped", () => {
    const next = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "enemy")
    };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP);
    expect(result.nextState.firedMapEventIds).toContain("lose");
    expect(result.messages.at(-1)?.text).toBe("敗北。");
  });

  it("does not refire an outcome event after it has been persisted", () => {
    const previous = { ...INITIAL_GAME_STATE, firedMapEventIds: ["win"] };
    const next = {
      ...previous,
      units: previous.units.filter((unit) =>
        unit.faction === "player" || unit.id === "enemy_001"
      ).map((unit) => unit.id === "enemy_001" ? { ...unit, currentHp: 0 } : unit)
    };
    const result = resolveMapEventTransition(previous, next, EVENT_MAP);
    expect(result.messages.some((message) => message.id === "win")).toBe(false);
  });

  it("fires the configured chapter-one boss message when the boss is defeated", () => {
    const next = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "enemy_005")
    };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, CHAPTER_01_MAP);

    expect(next.units.some((unit) => unit.faction === "enemy")).toBe(true);
    expect(result.nextState.firedMapEventIds).toContain("chapter-01-boss-defeated");
    expect(result.messages.map((message) => message.text)).toContain("敵将を撃破しました。作戦成功です。");
  });

  it("fires the prototype protagonist defeat message when allies remain", () => {
    const next = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, currentHp: 0 } : unit
      )
    };
    const result = resolveMapEventTransition(INITIAL_GAME_STATE, next, CHAPTER_01_MAP);

    expect(next.units.filter((unit) => unit.faction === "player" && unit.currentHp > 0)).toHaveLength(3);
    expect(result.nextState.firedMapEventIds).toContain("chapter-01-main-character-defeat");
    expect(result.messages.map((message) => message.text)).toContain("主人公が倒されました。作戦失敗です。");
  });

  it("rejects transitions crossing chapter boundaries", () => {
    const next = { ...INITIAL_GAME_STATE, chapterId: "other_chapter" };
    expect(() => resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP))
      .toThrow(/active chapter/);
  });
  it("fires unit-defeated events after a registered reinforcement is defeated", () => {
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const reinforcement = {
      ...enemy,
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
        action: { type: "spawn-reinforcement", unit: reinforcement, text: "増援が現れました。" }
      }, {
        id: "reinforcement-defeated",
        trigger: { type: "unit-defeated", unitId: reinforcement.id },
        action: { type: "show-message", text: "増援を撃破しました。" }
      }]
    };
    const spawned = resolveMapEvents(INITIAL_GAME_STATE, map, {
      type: "turn-start", turn: 2, phase: "enemy"
    }).nextState;
    const defeated = {
      ...spawned,
      units: spawned.units.filter((unit) => unit.id !== reinforcement.id)
    };
    const result = resolveMapEventTransition(spawned, defeated, map);
    expect(result.nextState.firedMapEventIds).toContain("reinforcement-defeated");
    expect(result.messages.map((message) => message.text)).toContain("増援を撃破しました。");
  });

});
