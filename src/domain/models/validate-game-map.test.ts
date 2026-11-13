import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import { CHAPTER_02_MAP } from "../../content/maps/chapter-02";
import type { GameMapDefinition } from "./game";
import { isValidGameMapDefinition } from "./validate-game-map";

describe("isValidGameMapDefinition", () => {
  it("accepts both registered prototype maps", () => {
    expect(isValidGameMapDefinition(CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameMapDefinition(CHAPTER_02_MAP)).toBe(true);
  });

  it("requires a boss objective target to be an enemy deployment", () => {
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      objective: { type: "defeat_boss", targetUnitId: "enemy_001" }
    };
    const missing = {
      ...valid,
      objective: { type: "defeat_boss", targetUnitId: "missing_boss" }
    };
    const playerTarget = {
      ...valid,
      objective: { type: "defeat_boss", targetUnitId: "unit_001" }
    };

    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition(missing)).toBe(false);
    expect(isValidGameMapDefinition(playerTarget)).toBe(false);
  });

  it("requires a critical defeat target to be a player deployment", () => {
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      defeatCondition: { type: "unit_defeated", targetUnitId: "unit_001" }
    };
    const missing = {
      ...valid,
      defeatCondition: { type: "unit_defeated", targetUnitId: "missing_unit" }
    };
    const enemyTarget = {
      ...valid,
      defeatCondition: { type: "unit_defeated", targetUnitId: "enemy_001" }
    };

    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition(missing)).toBe(false);
    expect(isValidGameMapDefinition(enemyTarget)).toBe(false);
  });

  it("validates map-local one-shot event triggers and message actions", () => {
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "opening",
        trigger: { type: "stage-start" },
        action: { type: "show-message", speaker: "作戦メモ", text: "敵軍を全滅させましょう。" }
      }, {
        id: "enemy-turn-two",
        trigger: { type: "turn-start", turn: 2, phase: "enemy" },
        action: { type: "show-message", text: "敵軍フェイズです。" }
      }, {
        id: "enemy-one-defeated",
        trigger: { type: "unit-defeated", unitId: "enemy_001" },
        action: { type: "show-message", text: "敵を撃破しました。" }
      }]
    };
    expect(isValidGameMapDefinition(valid)).toBe(true);

    expect(isValidGameMapDefinition({
      ...valid,
      events: [...valid.events!, valid.events![0]!]
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: [{ ...valid.events![0]!, trigger: { type: "unknown" } }]
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: [{
        ...valid.events![0]!,
        trigger: { type: "unit-defeated", unitId: "not-deployed" }
      }]
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: [{
        ...valid.events![0]!,
        action: { type: "show-message", text: "" }
      }]
    })).toBe(false);
  });

  it("rejects duplicate deployment IDs, overlapping positions, and invalid coordinates", () => {
    const duplicateId = {
      ...CHAPTER_01_MAP,
      enemyDeployment: CHAPTER_01_MAP.enemyDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, unitId: "unit_001" } : deployment
      )
    };
    const overlap = {
      ...CHAPTER_01_MAP,
      enemyDeployment: CHAPTER_01_MAP.enemyDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, x: 1, y: 8 } : deployment
      )
    };
    const outOfBounds = {
      ...CHAPTER_01_MAP,
      playerDeployment: CHAPTER_01_MAP.playerDeployment.map((deployment, index) =>
        index === 0 ? { ...deployment, x: CHAPTER_01_MAP.width, y: 0 } : deployment
      )
    };

    expect(isValidGameMapDefinition(duplicateId)).toBe(false);
    expect(isValidGameMapDefinition(overlap)).toBe(false);
    expect(isValidGameMapDefinition(outOfBounds)).toBe(false);
  });

  it("rejects malformed terrain dimensions and unsupported terrain types", () => {
    const badDimensions = { ...CHAPTER_01_MAP, terrain: CHAPTER_01_MAP.terrain.slice(1) };
    const badTerrain = {
      ...CHAPTER_01_MAP,
      terrain: CHAPTER_01_MAP.terrain.map((row, index) =>
        index === 0 ? row.map((cell, cellIndex) => cellIndex === 0 ? "lava" : cell) : row
      )
    };

    expect(isValidGameMapDefinition(badDimensions)).toBe(false);
    expect(isValidGameMapDefinition(badTerrain)).toBe(false);
  });
  it("validates item rewards and predeclared enemy reinforcement actions", () => {
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const reinforcement = {
      ...enemy,
      id: "enemy_reinforcement_01",
      name: "増援01",
      position: { x: 9, y: 7 },
      hasMoved: false,
      hasActed: false
    };
    const valid: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "village-supply",
        trigger: { type: "stage-start" },
        action: {
          type: "grant-item",
          recipientUnitId: "unit_001",
          itemId: "healing_potion",
          quantity: 1,
          text: "補給品を受け取りました。"
        }
      }, {
        id: "enemy-reinforcement",
        trigger: { type: "turn-start", turn: 2, phase: "enemy" },
        action: {
          type: "spawn-reinforcement",
          unit: reinforcement,
          text: "敵の増援が現れました。"
        }
      }, {
        id: "reinforcement-defeated",
        trigger: { type: "unit-defeated", unitId: reinforcement.id },
        action: { type: "show-message", text: "増援を撃破しました。" }
      }]
    };
    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition({
      ...valid,
      events: valid.events!.map((event, index) => index === 0
        ? { ...event, action: { ...event.action, itemId: "unknown_item" } }
        : event)
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: valid.events!.map((event, index) => index === 0
        ? { ...event, action: { ...event.action, recipientUnitId: "enemy_001" } }
        : event)
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: valid.events!.map((event, index) => index === 1
        ? { ...event, action: { ...event.action, unit: { ...reinforcement, faction: "player" } } }
        : event)
    })).toBe(false);
  });


  it("validates reachable one-shot unit-interaction locations and unit restrictions", () => {
    const interaction: GameMapDefinition = {
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
          text: "調査イベントを確認しました。"
        }
      }]
    };
    expect(isValidGameMapDefinition(interaction)).toBe(true);
    expect(isValidGameMapDefinition({
      ...interaction,
      events: interaction.events!.map((event) => ({
        ...event,
        trigger: { ...event.trigger, x: CHAPTER_01_MAP.width }
      }))
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...interaction,
      events: interaction.events!.map((event) => ({
        ...event,
        trigger: { ...event.trigger, label: "" }
      }))
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...interaction,
      events: interaction.events!.map((event) => ({
        ...event,
        trigger: { ...event.trigger, unitId: "enemy_001" }
      }))
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...interaction,
      events: [...interaction.events!, { ...interaction.events![0]!, id: "duplicate-location" }]
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...interaction,
      events: interaction.events!.map((event) => ({
        ...event,
        trigger: { ...event.trigger, x: 8, y: 8 }
      }))
    })).toBe(false);
  });


  it("accepts a valid interaction-driven recruitment event and rejects invalid variants", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const recruit = {
      ...campaignData,
      id: "recruit_from_event",
      name: "加入候補"
    };
    const valid: GameMapDefinition = {
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
          text: "加入候補が仲間になりました。"
        }
      }]
    };
    expect(isValidGameMapDefinition(valid)).toBe(true);
    expect(isValidGameMapDefinition({
      ...valid,
      events: valid.events!.map((event) => ({
        ...event,
        trigger: { type: "stage-start" }
      }))
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: valid.events!.map((event) => ({
        ...event,
        action: { ...event.action, unit: { ...recruit, classId: "missing-class" } }
      }))
    })).toBe(false);
    expect(isValidGameMapDefinition({
      ...valid,
      events: [...valid.events!, { ...valid.events![0]!, id: "duplicate-recruit" }]
    })).toBe(false);
  });

});
