import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import { isValidGameStateSnapshot } from "./validate-game-state";

describe("isValidGameStateSnapshot", () => {
  it("accepts the initial prototype state", () => {
    expect(isValidGameStateSnapshot(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe(true);
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

  it("rejects unsupported save versions and invalid coordinates", () => {
    expect(isValidGameStateSnapshot(
      { ...INITIAL_GAME_STATE, saveVersion: 99 },
      CHAPTER_01_MAP
    )).toBe(false);

    const first = INITIAL_GAME_STATE.units[0]!;
    const invalid = {
      ...INITIAL_GAME_STATE,
      units: [
        { ...first, position: { x: CHAPTER_01_MAP.width, y: 0 } },
        ...INITIAL_GAME_STATE.units.slice(1)
      ]
    };
    expect(isValidGameStateSnapshot(invalid, CHAPTER_01_MAP)).toBe(false);
  });

  it("rejects invalid HP and inventory overflow", () => {
    const first = INITIAL_GAME_STATE.units[0]!;
    const invalidHp = {
      ...INITIAL_GAME_STATE,
      units: [
        { ...first, currentHp: first.stats.hp + 1 },
        ...INITIAL_GAME_STATE.units.slice(1)
      ]
    };
    expect(isValidGameStateSnapshot(invalidHp, CHAPTER_01_MAP)).toBe(false);

    const invalidInventory = {
      ...INITIAL_GAME_STATE,
      units: [
        { ...first, inventory: ["a", "b", "c", "d", "e", "f"] },
        ...INITIAL_GAME_STATE.units.slice(1)
      ]
    };
    expect(isValidGameStateSnapshot(invalidInventory, CHAPTER_01_MAP)).toBe(false);
  });
  it("rejects invalid RNG state and an equipped weapon not in inventory", () => {
    expect(isValidGameStateSnapshot(
      { ...INITIAL_GAME_STATE, rngState: 0 },
      CHAPTER_01_MAP
    )).toBe(false);

    const first = INITIAL_GAME_STATE.units[0]!;
    const invalidEquipment = {
      ...INITIAL_GAME_STATE,
      units: [
        { ...first, equippedWeaponId: "missing-weapon" },
        ...INITIAL_GAME_STATE.units.slice(1)
      ]
    };
    expect(isValidGameStateSnapshot(invalidEquipment, CHAPTER_01_MAP)).toBe(false);
  });

});
