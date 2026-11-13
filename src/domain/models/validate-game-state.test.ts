import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import type { GameMapDefinition } from "./game";
import { isValidGameStateSnapshot } from "./validate-game-state";

describe("isValidGameStateSnapshot", () => {
  it("accepts valid campaign battle records and rejects malformed or duplicate entries", () => {
    const record = {
      unitId: "unit_001",
      unitName: "味方01",
      attacks: 2,
      strikes: 3,
      hits: 2,
      misses: 1,
      criticalHits: 1,
      damageDealt: 14,
      enemiesDefeated: 1,
      experienceAwarded: 30,
      levelUps: 1,
      statGains: {
        hp: 1, strength: 1, magic: 0, skill: 0,
        speed: 0, luck: 0, defense: 0, resistance: 0
      }
    };
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [record]
    }, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [record, record]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [{ ...record, unitId: "" }]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [{ ...record, strikes: 4 }]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [{ ...record, statGains: { ...record.statGains, hp: -1 } }]
    }, CHAPTER_01_MAP)).toBe(false);
  });

  it("validates persisted one-shot map event IDs", () => {
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: ["opening", "enemy-one-defeated"]
    }, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: ["opening", "opening"]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: [""]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: Array.from({ length: 1001 }, (_, index) => "event-" + index)
    }, CHAPTER_01_MAP)).toBe(false);
  });

  it("requires acknowledged event IDs to be unique members of the fired event list", () => {
    const fired = ["opening", "enemy-defeated"];
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: fired,
      acknowledgedMapEventIds: ["opening"]
    }, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: fired,
      acknowledgedMapEventIds: ["unknown"]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: fired,
      acknowledgedMapEventIds: ["opening", "opening"]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...INITIAL_GAME_STATE,
      firedMapEventIds: [],
      acknowledgedMapEventIds: ["opening"]
    }, CHAPTER_01_MAP)).toBe(false);
  });

  it("accepts the initial prototype state", () => {
    expect(isValidGameStateSnapshot(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe(true);
  });

  it("accepts a valid reserve member and rejects invalid or duplicate reserves", () => {
    const unit = INITIAL_GAME_STATE.units.find((candidate) => candidate.id === "unit_002")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...reserve } = unit;
    const withReserve = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((candidate) => candidate.id !== unit.id),
      reserveUnits: [reserve]
    };
    expect(isValidGameStateSnapshot(withReserve, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot({
      ...withReserve,
      units: INITIAL_GAME_STATE.units,
      reserveUnits: [reserve]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...withReserve,
      reserveUnits: [{ ...reserve, currentHp: 0 }]
    }, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...withReserve,
      reserveUnits: [{ ...reserve, id: "not-on-this-map" }]
    }, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects duplicate IDs and occupied positions", () => {
    const duplicateId = {
      ...INITIAL_GAME_STATE,
      units: [...INITIAL_GAME_STATE.units, INITIAL_GAME_STATE.units[0]!]
    };
    expect(isValidGameStateSnapshot(duplicateId, CHAPTER_01_MAP)).toBe(false);
    const first = INITIAL_GAME_STATE.units[0]!;
    const overlap = { ...first, id: "overlap", position: { ...first.position } };
    const duplicatePosition = {
      ...INITIAL_GAME_STATE,
      units: [...INITIAL_GAME_STATE.units, overlap]
    };
    expect(isValidGameStateSnapshot(duplicatePosition, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects units that are not part of the map deployment roster", () => {
    const unexpectedUnit = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, id: "undeployed_unit" } : unit
      )
    };
    expect(isValidGameStateSnapshot(unexpectedUnit, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects a deployed unit whose saved faction differs from its deployment faction", () => {
    const changedFaction = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, faction: "enemy" as const } : unit
      )
    };
    expect(isValidGameStateSnapshot(changedFaction, CHAPTER_01_MAP)).toBe(false);
  });

  it("accepts a surviving roster after defeated deployed units have been removed", () => {
    const defeatedEnemiesRemoved = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) =>
        unit.faction === "player" || unit.id !== "enemy_001"
      )
    };
    const defeatedAllyRemoved = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.id !== "unit_002")
    };
    expect(isValidGameStateSnapshot(defeatedEnemiesRemoved, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot(defeatedAllyRemoved, CHAPTER_01_MAP)).toBe(true);
  });

  it("rejects units placed on terrain their movement type cannot enter", () => {
    const cavalryOnMountain = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_004" ? { ...unit, position: { x: 8, y: 6 } } : unit
      )
    };
    const infantryOnWater = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, position: { x: 6, y: 4 } } : unit
      )
    };
    const infantryOnMountain = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, position: { x: 2, y: 3 } } : unit
      )
    };

    expect(isValidGameStateSnapshot(cavalryOnMountain, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot(infantryOnWater, CHAPTER_01_MAP)).toBe(false);
    // A non-null movement cost is traversable; no movement-range requirement is imposed here.
    expect(isValidGameStateSnapshot(infantryOnMountain, CHAPTER_01_MAP)).toBe(true);
  });

  it("rejects unsupported save versions and invalid coordinates", () => {
    expect(isValidGameStateSnapshot({ ...INITIAL_GAME_STATE, saveVersion: 99 }, CHAPTER_01_MAP)).toBe(false);
    const first = INITIAL_GAME_STATE.units[0]!;
    const invalid = {
      ...INITIAL_GAME_STATE,
      units: [{ ...first, position: { x: CHAPTER_01_MAP.width, y: 0 } }, ...INITIAL_GAME_STATE.units.slice(1)]
    };
    expect(isValidGameStateSnapshot(invalid, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects invalid HP and inventory overflow", () => {
    const first = INITIAL_GAME_STATE.units[0]!;
    const invalidHp = {
      ...INITIAL_GAME_STATE,
      units: [{ ...first, currentHp: first.stats.hp + 1 }, ...INITIAL_GAME_STATE.units.slice(1)]
    };
    expect(isValidGameStateSnapshot(invalidHp, CHAPTER_01_MAP)).toBe(false);
    const invalidInventory = {
      ...INITIAL_GAME_STATE,
      units: [{
        ...first,
        inventory: ["iron_sword", "iron_sword", "iron_sword", "healing_potion", "promotion_seal", "iron_sword"]
      }, ...INITIAL_GAME_STATE.units.slice(1)]
    };
    expect(isValidGameStateSnapshot(invalidInventory, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects invalid RNG state and an equipped weapon not in inventory", () => {
    expect(isValidGameStateSnapshot({ ...INITIAL_GAME_STATE, rngState: 0 }, CHAPTER_01_MAP)).toBe(false);
    const first = INITIAL_GAME_STATE.units[0]!;
    const invalidEquipment = {
      ...INITIAL_GAME_STATE,
      units: [{ ...first, equippedWeaponId: "missing-weapon" }, ...INITIAL_GAME_STATE.units.slice(1)]
    };
    expect(isValidGameStateSnapshot(invalidEquipment, CHAPTER_01_MAP)).toBe(false);
  });

  it("accepts registered weapons and inventory items, including unequipped consumables", () => {
    const withRegisteredItems = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001"
          ? { ...unit, inventory: [...unit.inventory, "healing_potion", "promotion_seal"] }
          : unit
      )
    };
    const promotedClass = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, classId: "swordmaster" } : unit
      )
    };

    expect(isValidGameStateSnapshot(withRegisteredItems, CHAPTER_01_MAP)).toBe(true);
    expect(isValidGameStateSnapshot(promotedClass, CHAPTER_01_MAP)).toBe(true);
  });

  it("rejects unknown classes and unregistered inventory item IDs", () => {
    const unknownClass = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, classId: "unregistered_class" } : unit
      )
    };
    const unknownItem = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, inventory: [...unit.inventory, "unregistered_item"] } : unit
      )
    };

    expect(isValidGameStateSnapshot(unknownClass, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot(unknownItem, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects equipped items that are not registered usable weapons", () => {
    const itemEquippedAsWeapon = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0
          ? { ...unit, inventory: [...unit.inventory, "healing_potion"], equippedWeaponId: "healing_potion" }
          : unit
      )
    };
    const incompatibleWeapon = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0
          ? { ...unit, inventory: [...unit.inventory, "short_bow"], equippedWeaponId: "short_bow" }
          : unit
      )
    };

    expect(isValidGameStateSnapshot(itemEquippedAsWeapon, CHAPTER_01_MAP)).toBe(false);
    expect(isValidGameStateSnapshot(incompatibleWeapon, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects defeated units retained in the active battle roster", () => {
    const defeatedUnitRetained = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, currentHp: 0 } : unit
      )
    };

    expect(isValidGameStateSnapshot(defeatedUnitRetained, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects saved experience at or above the level-up threshold", () => {
    const first = INITIAL_GAME_STATE.units[0]!;
    const invalid = {
      ...INITIAL_GAME_STATE,
      units: [{ ...first, experience: 100 }, ...INITIAL_GAME_STATE.units.slice(1)]
    };
    expect(isValidGameStateSnapshot(invalid, CHAPTER_01_MAP)).toBe(false);
  });
  it("accepts a spawned reinforcement only after its corresponding event has fired", () => {
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
        action: {
          type: "spawn-reinforcement",
          unit: reinforcement,
          text: "敵の増援が現れました。"
        }
      }]
    };
    const spawned = {
      ...INITIAL_GAME_STATE,
      units: [...INITIAL_GAME_STATE.units, reinforcement],
      firedMapEventIds: ["reinforcement-wave-1"]
    };

    expect(isValidGameStateSnapshot(spawned, map)).toBe(true);
    expect(isValidGameStateSnapshot({ ...spawned, firedMapEventIds: [] }, map)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...spawned,
      units: [...INITIAL_GAME_STATE.units, { ...reinforcement, id: "unregistered_enemy" }]
    }, map)).toBe(false);
  });


  it("accepts recruited reserve members only after their recruitment event has fired", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const recruit = {
      ...campaignData,
      id: "recruit_from_event",
      name: "加入候補"
    };
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "unit-recruitment",
        trigger: { type: "unit-interacts", x: 9, y: 8, label: "加入地点" },
        action: { type: "recruit-unit", unit: recruit, text: "加入しました。" }
      }]
    };
    const stateWithRecruit = {
      ...INITIAL_GAME_STATE,
      reserveUnits: [recruit],
      firedMapEventIds: ["unit-recruitment"]
    };
    expect(isValidGameStateSnapshot(stateWithRecruit, map)).toBe(true);
    expect(isValidGameStateSnapshot({
      ...stateWithRecruit,
      firedMapEventIds: []
    }, map)).toBe(false);
  });


  it("accepts only fired and acknowledged dialogue choices that exist in the map", () => {
    const map: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "dialogue",
        trigger: { type: "stage-start" },
        action: {
          type: "show-choice",
          text: "どちらへ進みますか？",
          choices: [{ id: "left", label: "左へ進む" }, { id: "right", label: "右へ進む" }]
        }
      }]
    };
    const selected = {
      ...INITIAL_GAME_STATE,
      firedMapEventIds: ["dialogue"],
      acknowledgedMapEventIds: ["dialogue"],
      mapEventChoices: [{ eventId: "dialogue", choiceId: "left" }]
    };
    expect(isValidGameStateSnapshot(selected, map)).toBe(true);
    expect(isValidGameStateSnapshot({ ...selected, acknowledgedMapEventIds: [] }, map)).toBe(false);
    expect(isValidGameStateSnapshot({ ...selected, firedMapEventIds: [] }, map)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...selected,
      mapEventChoices: [{ eventId: "dialogue", choiceId: "unknown" }]
    }, map)).toBe(false);
    expect(isValidGameStateSnapshot({
      ...selected,
      mapEventChoices: [
        { eventId: "dialogue", choiceId: "left" },
        { eventId: "dialogue", choiceId: "right" }
      ]
    }, map)).toBe(false);
    expect(isValidGameStateSnapshot({ ...selected, mapEventChoices: [] }, map)).toBe(false);
  });

});
