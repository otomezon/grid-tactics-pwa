import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import { getPrototypeStatCaps } from "../../content/classes";
import type { GameUnit } from "../models/game";
import { applyExperience } from "./level-up";

function testUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  const base = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
  return {
    ...base,
    growthRates: {
      hp: 100,
      strength: 100,
      magic: 100,
      skill: 100,
      speed: 100,
      luck: 100,
      defense: 100,
      resistance: 100
    },
    ...overrides
  };
}

describe("applyExperience", () => {
  it("stores experience without leveling below 100", () => {
    const result = applyExperience(testUnit({ experience: 20 }), 30, 0x12345678, getPrototypeStatCaps("swordsman"));

    expect(result.unit.experience).toBe(50);
    expect(result.unit.level).toBe(1);
    expect(result.levelUps).toEqual([]);
    expect(result.rngState).toBe(0x12345678);
  });

  it("levels up at 100 EXP and independently applies every successful growth", () => {
    const unit = testUnit({ experience: 90, currentHp: 11 });
    const result = applyExperience(unit, 10, 0x12345678, getPrototypeStatCaps(unit.classId));

    expect(result.unit.level).toBe(2);
    expect(result.unit.experience).toBe(0);
    expect(result.levelUps).toHaveLength(1);
    expect(result.levelUps[0]?.gains).toEqual({
      hp: 1,
      strength: 1,
      magic: 1,
      skill: 1,
      speed: 1,
      luck: 1,
      defense: 1,
      resistance: 1
    });
    expect(result.unit.stats.hp).toBe(unit.stats.hp + 1);
    expect(result.unit.currentHp).toBe(11);
    expect(result.rngState).not.toBe(0x12345678);
  });

  it("does not exceed the supplied class stat caps", () => {
    const caps = { ...getPrototypeStatCaps("swordsman"), strength: 6, hp: 20 };
    const unit = testUnit({
      experience: 99,
      stats: { ...testUnit().stats, strength: 6, hp: 20 }
    });
    const result = applyExperience(unit, 1, 0x12345678, caps);

    expect(result.unit.stats.strength).toBe(6);
    expect(result.unit.stats.hp).toBe(20);
    expect(result.levelUps[0]?.gains).not.toHaveProperty("strength");
    expect(result.levelUps[0]?.gains).not.toHaveProperty("hp");
  });

  it("preserves every existing stat above its class cap and suppresses further growth", () => {
    const unit = testUnit({
      experience: 99,
      stats: {
        hp: 21,
        strength: 6,
        magic: 1,
        skill: 8,
        speed: 9,
        luck: 5,
        defense: 6,
        resistance: 2
      }
    });
    const caps = {
      hp: 20,
      strength: 5,
      magic: 0,
      skill: 7,
      speed: 8,
      luck: 4,
      defense: 5,
      resistance: 1
    };
    const result = applyExperience(unit, 1, 0x12345678, caps);

    expect(result.unit.stats).toEqual(unit.stats);
    expect(result.levelUps[0]?.gains).toEqual({});
    expect(result.rngState).not.toBe(0x12345678);
  });

  it("supports multiple level-ups from a single award", () => {
    const unit = testUnit({ experience: 90 });
    const result = applyExperience(unit, 210, 0x12345678, getPrototypeStatCaps(unit.classId));

    expect(result.unit.level).toBe(4);
    expect(result.unit.experience).toBe(0);
    expect(result.levelUps.map((entry) => entry.newLevel)).toEqual([2, 3, 4]);
  });

  it("keeps zero-growth stats unchanged while consuming deterministic rolls", () => {
    const unit = testUnit({
      growthRates: {
        hp: 0, strength: 0, magic: 0, skill: 0,
        speed: 0, luck: 0, defense: 0, resistance: 0
      },
      experience: 99
    });
    const result = applyExperience(unit, 1, 0x12345678, getPrototypeStatCaps(unit.classId));

    expect(result.unit.stats).toEqual(unit.stats);
    expect(result.levelUps).toEqual([{
      previousLevel: 1,
      newLevel: 2,
      gains: {}
    }]);
    expect(result.rngState).not.toBe(0x12345678);
  });

  it("does not permit invalid experience awards or invalid saved EXP progress", () => {
    expect(() => applyExperience(testUnit(), -1, 0x12345678, getPrototypeStatCaps("swordsman"))).toThrow(RangeError);
    expect(() => applyExperience(testUnit({ experience: 100 }), 1, 0x12345678, getPrototypeStatCaps("swordsman"))).toThrow(RangeError);
  });
});
