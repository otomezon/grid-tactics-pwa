import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import type { GameUnit, UnitStats } from "../models/game";
import {
  applyClassPromotion,
  type ClassPromotionDefinition
} from "./class-change";

const caps: UnitStats = {
  hp: 60,
  strength: 30,
  magic: 30,
  skill: 30,
  speed: 30,
  luck: 30,
  defense: 30,
  resistance: 30
};

function eligibleUnit(overrides: Partial<GameUnit> = {}): GameUnit {
  const base = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
  return {
    ...base,
    level: 10,
    experience: 45,
    currentHp: 12,
    inventory: ["iron_sword", "promotion_seal", "promotion_seal"],
    ...overrides
  };
}

function definition(overrides: Partial<ClassPromotionDefinition> = {}): ClassPromotionDefinition {
  return {
    fromClassId: "swordsman",
    toClassId: "swordmaster",
    requiredItemId: "promotion_seal",
    statBonuses: { hp: 3, strength: 2, speed: 1 },
    statCaps: caps,
    experiencePolicy: "reset",
    ...overrides
  };
}

describe("applyClassPromotion", () => {
  it("promotes a level-10 player, consumes one item, and applies configured bonuses", () => {
    const unit = eligibleUnit();
    const result = applyClassPromotion(unit, definition());

    expect(result.unit).toMatchObject({
      classId: "swordmaster",
      level: 1,
      experience: 0,
      stats: {
        hp: unit.stats.hp + 3,
        strength: unit.stats.strength + 2,
        speed: unit.stats.speed + 1
      },
      currentHp: 12,
      inventory: ["iron_sword", "promotion_seal"],
      equippedWeaponId: "iron_sword"
    });
    expect(result.consumedItemId).toBe("promotion_seal");
    expect(result.appliedBonuses).toEqual({ hp: 3, strength: 2, speed: 1 });
    expect(unit.inventory).toHaveLength(3);
  });

  it("preserves partial experience when the promotion definition requests it", () => {
    const unit = eligibleUnit({ experience: 73 });
    const result = applyClassPromotion(
      unit,
      definition({ experiencePolicy: "preserve" })
    );

    expect(result.unit.level).toBe(1);
    expect(result.unit.experience).toBe(73);
  });

  it("caps bonus gains without reducing an existing stat above the new cap", () => {
    const unit = eligibleUnit({
      stats: { ...eligibleUnit().stats, strength: 32, speed: 29 }
    });
    const result = applyClassPromotion(
      unit,
      definition({
        statBonuses: { strength: 3, speed: 5 },
        statCaps: { ...caps, strength: 30, speed: 30 }
      })
    );

    expect(result.unit.stats.strength).toBe(32);
    expect(result.unit.stats.speed).toBe(30);
    expect(result.appliedBonuses).toEqual({ speed: 1 });
  });

  it("does not heal current HP when maximum HP receives a promotion bonus", () => {
    const unit = eligibleUnit({ currentHp: 4 });
    const result = applyClassPromotion(unit, definition({ statBonuses: { hp: 5 } }));

    expect(result.unit.stats.hp).toBe(unit.stats.hp + 5);
    expect(result.unit.currentHp).toBe(4);
  });

  it("rejects units below level 10, enemy units, and mismatched source classes", () => {
    expect(() => applyClassPromotion(eligibleUnit({ level: 9 }), definition())).toThrow(/level 10/);
    expect(() => applyClassPromotion(eligibleUnit({ faction: "enemy" }), definition())).toThrow(/player units/);
    expect(() => applyClassPromotion(eligibleUnit({ classId: "archer" }), definition())).toThrow(/current class/);
  });

  it("requires the class-change item and does not consume an equipped weapon", () => {
    expect(() =>
      applyClassPromotion(
        eligibleUnit({ inventory: ["iron_sword"] }),
        definition()
      )
    ).toThrow(/required class-change item/);

    expect(() =>
      applyClassPromotion(
        eligibleUnit({ equippedWeaponId: "promotion_seal" }),
        definition()
      )
    ).toThrow(/cannot be equipped/);
  });

  it("requires explicit promotion bonuses, caps, and experience policy", () => {
    expect(() =>
      applyClassPromotion(eligibleUnit(), definition({ statBonuses: {} }))
    ).toThrow(/at least one positive stat bonus/);

    expect(() =>
      applyClassPromotion(eligibleUnit(), definition({ statBonuses: { hp: 0 } }))
    ).toThrow(/at least one positive stat bonus/);

    expect(() =>
      applyClassPromotion(
        eligibleUnit(),
        definition({ experiencePolicy: "unknown" as "preserve" })
      )
    ).toThrow(/experience/);
  });
});
