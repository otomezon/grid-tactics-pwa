import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { CampaignUnit, GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import {
  getAvailableMapInteraction,
  getMapInteractionPoints,
  performMapInteraction
} from "./perform-map-interaction";

const INTERACTION_MAP: GameMapDefinition = {
  ...CHAPTER_01_MAP,
  events: [{
    id: "prototype-investigation",
    trigger: {
      type: "unit-interacts",
      x: 9,
      y: 8,
      label: "試作調査地点",
      description: "操作確認用の地点です。"
    },
    action: {
      type: "show-message",
      speaker: "操作確認",
      text: "調査地点を確認しました。"
    }
  }]
};

function movedInvestigator(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  const baseUnits = INITIAL_GAME_STATE.units.map((unit) => unit.id === "unit_004"
    ? { ...unit, position: { x: 9, y: 8 }, hasMoved: true }
    : unit);
  return {
    ...INITIAL_GAME_STATE,
    ...overrides,
    units: overrides.units ?? baseUnits
  };
}

describe("map interactions", () => {
  it("projects only untriggered points and identifies a unit standing on one", () => {
    const state = movedInvestigator();
    expect(getMapInteractionPoints(state, INTERACTION_MAP)).toEqual([{
      id: "prototype-investigation",
      label: "試作調査地点",
      description: "操作確認用の地点です。",
      position: { x: 9, y: 8 },
      unitId: null,
      recruitName: null
    }]);
    expect(getAvailableMapInteraction(state, INTERACTION_MAP, "unit_004")?.id)
      .toBe("prototype-investigation");
    expect(getAvailableMapInteraction(state, INTERACTION_MAP, "unit_001")).toBeNull();
  });

  it("allows investigation after movement, fires the event once, and consumes the action", () => {
    const state = movedInvestigator();
    const original = structuredClone(state);
    const result = performMapInteraction(state, INTERACTION_MAP, "unit_004");
    const actor = result.nextState.units.find((unit) => unit.id === "unit_004")!;

    expect(result.interaction.label).toBe("試作調査地点");
    expect(result.actorName).toBe("味方04");
    expect(actor).toMatchObject({
      position: { x: 9, y: 8 },
      hasMoved: true,
      hasActed: true
    });
    expect(result.nextState.firedMapEventIds).toEqual(["prototype-investigation"]);
    expect(result.nextState.saveVersion).toBe(INITIAL_GAME_STATE.saveVersion);
    expect(state).toEqual(original);

    expect(getMapInteractionPoints(result.nextState, INTERACTION_MAP)).toEqual([]);
    expect(getAvailableMapInteraction(result.nextState, INTERACTION_MAP, "unit_004")).toBeNull();
    expect(() => performMapInteraction(result.nextState, INTERACTION_MAP, "unit_004"))
      .toThrow(/cannot interact/);
  });

  it("does not allow an ally that has already acted to investigate", () => {
    const state = movedInvestigator({
      units: INITIAL_GAME_STATE.units.map((unit) => unit.id === "unit_004"
        ? { ...unit, position: { x: 9, y: 8 }, hasMoved: true, hasActed: true }
        : unit)
    });
    expect(getAvailableMapInteraction(state, INTERACTION_MAP, "unit_004")).toBeNull();
    expect(() => performMapInteraction(state, INTERACTION_MAP, "unit_004")).toThrow(/cannot interact/);
  });

  it("does not allow enemy-phase, enemies, defeated allies, or units away from the interaction tile", () => {
    const state = movedInvestigator();
    expect(getAvailableMapInteraction({ ...state, phase: "enemy" }, INTERACTION_MAP, "unit_004")).toBeNull();
    expect(getAvailableMapInteraction(state, INTERACTION_MAP, "enemy_001")).toBeNull();
    const defeated = {
      ...state,
      units: state.units.map((unit) => unit.id === "unit_004" ? { ...unit, currentHp: 0 } : unit)
    };
    expect(getAvailableMapInteraction(defeated, INTERACTION_MAP, "unit_004")).toBeNull();
    expect(() => getMapInteractionPoints({ ...state, chapterId: "other" }, INTERACTION_MAP))
      .toThrow(/current chapter/);
  });

  it("restricts a location to its configured player unit", () => {
    const map: GameMapDefinition = {
      ...INTERACTION_MAP,
      events: INTERACTION_MAP.events!.map((event) => ({
        ...event,
        trigger: { ...event.trigger, unitId: "unit_004" }
      }))
    };
    expect(getAvailableMapInteraction(movedInvestigator(), map, "unit_004")).not.toBeNull();
    const otherUnitAtPoint = {
      ...movedInvestigator(),
      units: movedInvestigator().units.map((unit) => unit.id === "unit_001"
        ? { ...unit, position: { x: 9, y: 8 } }
        : unit).filter((unit) => unit.id !== "unit_004")
    };
    expect(getAvailableMapInteraction(otherUnitAtPoint, map, "unit_001")).toBeNull();
  });

  it("does not consume the action or fire the event when its item reward cannot fit", () => {
    const map: GameMapDefinition = {
      ...INTERACTION_MAP,
      events: [{
        ...INTERACTION_MAP.events![0]!,
        action: {
          type: "grant-item",
          recipientUnitId: "unit_004",
          itemId: "healing_potion",
          quantity: 1,
          text: "回復薬を受け取りました。"
        }
      }]
    };
    const state = movedInvestigator({
      units: INITIAL_GAME_STATE.units.map((unit) => unit.id === "unit_004"
        ? {
            ...unit,
            position: { x: 9, y: 8 },
            hasMoved: true,
            inventory: ["iron_sword", "iron_lance", "healing_potion", "healing_potion", "healing_potion"]
          }
        : unit)
    });
    const original = structuredClone(state);
    expect(() => performMapInteraction(state, map, "unit_004"))
      .toThrow(/inventory does not have enough free slots/);
    expect(state).toEqual(original);
    expect(state.firedMapEventIds).toEqual([]);
    expect(state.units.find((unit) => unit.id === "unit_004")?.hasActed).toBe(false);
  });

  it("adds a map-authored recruit to reserves and consumes the investigator's action", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const recruit: CampaignUnit = {
      ...campaignData,
      id: "recruit_001",
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
          label: "加入地点",
          description: "加入処理のテスト地点です。"
        },
        action: {
          type: "recruit-unit",
          unit: recruit,
          speaker: "加入候補",
          text: "加入候補が控えに加わりました。"
        }
      }]
    };
    const result = performMapInteraction(movedInvestigator(), map, "unit_004");
    expect(result.interaction.recruitName).toBe("加入候補");
    expect(result.nextState.reserveUnits).toEqual([recruit]);
    expect(result.nextState.units.find((unit) => unit.id === "unit_004")?.hasActed).toBe(true);
    expect(result.nextState.firedMapEventIds).toContain("unit-recruitment");
    expect(isValidGameStateSnapshot(result.nextState, map)).toBe(true);
  });

});
