import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition } from "../domain/models/game";
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
    expect(result.nextState.firedMapEventIds).toEqual(["boss", "unit"]);
    expect(result.messages.map((message) => message.text)).toEqual(["敵将を撃破。", "敵01撃破。"]);
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

  it("rejects transitions crossing chapter boundaries", () => {
    const next = { ...INITIAL_GAME_STATE, chapterId: "other_chapter" };
    expect(() => resolveMapEventTransition(INITIAL_GAME_STATE, next, EVENT_MAP))
      .toThrow(/active chapter/);
  });
});
