import { describe, expect, it } from "vitest";
import { PROMOTION_ITEM_ID } from "./items";
import {
  BASIC_CLASS_IDS,
  CLASS_DEFINITIONS,
  PROMOTED_CLASS_IDS,
  getClassDefinition,
  isRegisteredClassId
} from "./class-definitions";
import {
  CLASS_PROMOTION_DEFINITIONS,
  CLASS_PROMOTION_TARGETS,
  CLASS_DISPLAY_NAMES,
  PROTOTYPE_CLASS_STAT_CAPS,
  getClassPromotionDefinition,
  getClassTierLabel,
  getPrototypeStatCaps,
  getPromotionTargetClassId
} from "./classes";

describe("typed class definition registry", () => {
  it("registers exactly the seven adopted basic classes and seven promoted classes", () => {
    expect(BASIC_CLASS_IDS).toEqual([
      "swordsman", "mercenary", "fighter", "soldier", "cavalry", "archer", "mage"
    ]);
    expect(PROMOTED_CLASS_IDS).toEqual([
      "swordmaster", "hero", "warrior", "general", "paladin", "sniper", "sage"
    ]);
    expect(Object.keys(CLASS_DEFINITIONS).sort()).toEqual(
      [...BASIC_CLASS_IDS, ...PROMOTED_CLASS_IDS].sort()
    );

    for (const [classId, definition] of Object.entries(CLASS_DEFINITIONS)) {
      expect(definition.id).toBe(classId);
      expect(definition.displayName.trim()).not.toBe("");
      expect(Object.values(definition.prototypeStatCaps)).toEqual([60, 30, 30, 30, 30, 30, 30, 30]);
      expect(Object.isFrozen(definition.prototypeStatCaps)).toBe(true);
    }
  });

  it("defines one explicit promotion path for each basic class and none for promoted classes", () => {
    const expectedPaths = {
      swordsman: "swordmaster",
      mercenary: "hero",
      fighter: "warrior",
      soldier: "general",
      cavalry: "paladin",
      archer: "sniper",
      mage: "sage"
    };
    expect(CLASS_PROMOTION_TARGETS).toEqual(expectedPaths);
    expect(Object.keys(CLASS_PROMOTION_DEFINITIONS).sort()).toEqual(
      [...BASIC_CLASS_IDS].sort()
    );

    for (const [sourceClassId, targetClassId] of Object.entries(expectedPaths)) {
      const source = getClassDefinition(sourceClassId)!;
      const target = getClassDefinition(targetClassId)!;
      expect(source.tier).toBe("basic");
      expect(target.tier).toBe("promoted");
      expect(source.tier === "basic" ? source.promotion.targetClassId : null).toBe(targetClassId);
      expect(target.tier === "promoted" ? target.promotion : "invalid").toBeNull();
      expect(getClassPromotionDefinition(sourceClassId)).toMatchObject({
        fromClassId: sourceClassId,
        toClassId: targetClassId,
        requiredItemId: PROMOTION_ITEM_ID,
        experiencePolicy: "preserve"
      });
      expect(getPromotionTargetClassId(sourceClassId)).toBe(targetClassId);
      expect(getPromotionTargetClassId(targetClassId)).toBeUndefined();
    }
  });

  it("derives all legacy projections from the registry without sharing mutable caps", () => {
    expect(Object.keys(CLASS_DISPLAY_NAMES).sort()).toEqual(
      [...BASIC_CLASS_IDS, ...PROMOTED_CLASS_IDS].sort()
    );
    expect(Object.keys(PROTOTYPE_CLASS_STAT_CAPS).sort()).toEqual(
      [...BASIC_CLASS_IDS, ...PROMOTED_CLASS_IDS].sort()
    );

    const returnedCaps = getPrototypeStatCaps("swordsman");
    returnedCaps.hp = 1;
    expect(getPrototypeStatCaps("swordsman").hp).toBe(60);

    const firstPromotion = getClassPromotionDefinition("swordsman")!;
    firstPromotion.statBonuses.hp = 99;
    firstPromotion.statCaps.hp = 1;
    const secondPromotion = getClassPromotionDefinition("swordsman")!;
    expect(secondPromotion.statBonuses.hp).toBe(2);
    expect(secondPromotion.statCaps.hp).toBe(60);
  });

  it("keeps exported class compatibility projections deeply immutable", () => {
    for (const definition of Object.values(CLASS_PROMOTION_DEFINITIONS)) {
      expect(Object.isFrozen(definition)).toBe(true);
      expect(Object.isFrozen(definition.statBonuses)).toBe(true);
      expect(Object.isFrozen(definition.statCaps)).toBe(true);
    }

    for (const caps of Object.values(PROTOTYPE_CLASS_STAT_CAPS)) {
      expect(Object.isFrozen(caps)).toBe(true);
    }

    const promotion = CLASS_PROMOTION_DEFINITIONS.swordsman;
    expect(Reflect.set(promotion.statBonuses, "hp", 99)).toBe(false);
    expect(Reflect.set(promotion.statCaps, "hp", 1)).toBe(false);
    expect(promotion.statBonuses.hp).toBe(2);
    expect(promotion.statCaps.hp).toBe(60);

    const caps = PROTOTYPE_CLASS_STAT_CAPS.swordsman;
    expect(Reflect.set(caps, "hp", 1)).toBe(false);
    expect(caps.hp).toBe(60);
  });

  it("rejects unknown class IDs and labels registered class tiers", () => {
    expect(isRegisteredClassId("swordsman")).toBe(true);
    expect(isRegisteredClassId("swordmaster")).toBe(true);
    expect(isRegisteredClassId("unknown")).toBe(false);
    expect(isRegisteredClassId(null)).toBe(false);
    expect(getClassDefinition("unknown")).toBeUndefined();
    expect(getClassTierLabel("swordsman")).toBe("基本職");
    expect(getClassTierLabel("swordmaster")).toBe("昇格職");
    expect(getClassTierLabel("unknown")).toBe("未登録職");
    expect(() => getPrototypeStatCaps("unknown")).toThrow(/No prototype stat caps/);
  });
});
