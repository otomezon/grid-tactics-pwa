import { describe, expect, it } from "vitest";
import {
  CLASS_PROMOTION_DEFINITIONS,
  CLASS_PROMOTION_TARGETS,
  getPrototypeStatCaps,
  getClassPromotionDefinition
} from "./classes";
import { PROMOTION_ITEM_ID, INVENTORY_ITEMS_BY_ID } from "./items";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./maps/chapter-01";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { applyClassPromotion } from "../domain/progression/class-change";

describe("class promotion content", () => {
  it("defines runtime promotion data for all seven design paths", () => {
    expect(Object.keys(CLASS_PROMOTION_DEFINITIONS).sort()).toEqual(
      Object.keys(CLASS_PROMOTION_TARGETS).sort()
    );

    for (const [sourceClass, targetClass] of Object.entries(CLASS_PROMOTION_TARGETS)) {
      const definition = getClassPromotionDefinition(sourceClass);
      expect(definition).toBeDefined();
      expect(definition?.fromClassId).toBe(sourceClass);
      expect(definition?.toClassId).toBe(targetClass);
      expect(definition?.requiredItemId).toBe(PROMOTION_ITEM_ID);
      expect(definition?.statBonuses).toBeTruthy();
      expect(definition?.experiencePolicy).toBe("preserve");
      expect(getPrototypeStatCaps(targetClass)).toEqual(definition?.statCaps);
    }
  });


  it("pins the initial-release stat caps and promotion bonus values for all 14 classes", () => {
    expect(Object.fromEntries(
      Object.entries(CLASS_DEFINITIONS).map(([id, definition]) => [id, definition.statCaps])
    )).toEqual({
  "swordsman": {
    "hp": 40,
    "strength": 20,
    "magic": 10,
    "skill": 22,
    "speed": 24,
    "luck": 30,
    "defense": 18,
    "resistance": 16
  },
  "mercenary": {
    "hp": 42,
    "strength": 22,
    "magic": 10,
    "skill": 22,
    "speed": 21,
    "luck": 26,
    "defense": 20,
    "resistance": 16
  },
  "fighter": {
    "hp": 45,
    "strength": 24,
    "magic": 5,
    "skill": 18,
    "speed": 18,
    "luck": 24,
    "defense": 22,
    "resistance": 12
  },
  "soldier": {
    "hp": 42,
    "strength": 21,
    "magic": 8,
    "skill": 20,
    "speed": 18,
    "luck": 26,
    "defense": 23,
    "resistance": 15
  },
  "cavalry": {
    "hp": 42,
    "strength": 21,
    "magic": 8,
    "skill": 20,
    "speed": 21,
    "luck": 24,
    "defense": 20,
    "resistance": 14
  },
  "archer": {
    "hp": 40,
    "strength": 20,
    "magic": 8,
    "skill": 24,
    "speed": 21,
    "luck": 26,
    "defense": 17,
    "resistance": 16
  },
  "mage": {
    "hp": 38,
    "strength": 10,
    "magic": 24,
    "skill": 20,
    "speed": 20,
    "luck": 26,
    "defense": 14,
    "resistance": 22
  },
  "swordmaster": {
    "hp": 60,
    "strength": 25,
    "magic": 10,
    "skill": 30,
    "speed": 30,
    "luck": 30,
    "defense": 22,
    "resistance": 20
  },
  "hero": {
    "hp": 60,
    "strength": 27,
    "magic": 15,
    "skill": 27,
    "speed": 27,
    "luck": 30,
    "defense": 25,
    "resistance": 22
  },
  "warrior": {
    "hp": 65,
    "strength": 30,
    "magic": 8,
    "skill": 24,
    "speed": 24,
    "luck": 28,
    "defense": 27,
    "resistance": 18
  },
  "general": {
    "hp": 65,
    "strength": 27,
    "magic": 12,
    "skill": 26,
    "speed": 23,
    "luck": 28,
    "defense": 30,
    "resistance": 25
  },
  "paladin": {
    "hp": 60,
    "strength": 27,
    "magic": 16,
    "skill": 26,
    "speed": 28,
    "luck": 28,
    "defense": 27,
    "resistance": 24
  },
  "sniper": {
    "hp": 58,
    "strength": 25,
    "magic": 12,
    "skill": 30,
    "speed": 27,
    "luck": 30,
    "defense": 22,
    "resistance": 21
  },
  "sage": {
    "hp": 55,
    "strength": 15,
    "magic": 30,
    "skill": 28,
    "speed": 27,
    "luck": 30,
    "defense": 20,
    "resistance": 30
  }
});
    expect(Object.fromEntries(
      Object.entries(CLASS_PROMOTION_DEFINITIONS).map(([id, definition]) => [id, definition.statBonuses])
    )).toEqual({
  "swordsman": {
    "hp": 5,
    "strength": 2,
    "skill": 3,
    "speed": 3,
    "luck": 1,
    "defense": 1
  },
  "mercenary": {
    "hp": 5,
    "strength": 3,
    "skill": 2,
    "speed": 2,
    "defense": 2
  },
  "fighter": {
    "hp": 6,
    "strength": 3,
    "skill": 2,
    "speed": 1,
    "defense": 2
  },
  "soldier": {
    "hp": 5,
    "strength": 2,
    "skill": 1,
    "speed": 1,
    "defense": 3,
    "resistance": 2
  },
  "cavalry": {
    "hp": 5,
    "strength": 2,
    "skill": 2,
    "speed": 2,
    "defense": 2,
    "resistance": 1
  },
  "archer": {
    "hp": 4,
    "strength": 2,
    "skill": 3,
    "speed": 2,
    "luck": 1,
    "defense": 1
  },
  "mage": {
    "hp": 4,
    "strength": 1,
    "magic": 4,
    "skill": 2,
    "speed": 1,
    "resistance": 2
  }
});
  });

  it("applies each of the seven one-step promotion paths and does not allow re-promotion", () => {
    const baseUnit = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;

    for (const [sourceClass, targetClass] of Object.entries(CLASS_PROMOTION_TARGETS)) {
      const definition = getClassPromotionDefinition(sourceClass)!;
      const unit = {
        ...baseUnit,
        classId: sourceClass,
        level: 10,
        inventory: [PROMOTION_ITEM_ID],
        equippedWeaponId: null,
        hasMoved: false,
        hasActed: false
      };
      const result = applyClassPromotion(unit, definition);

      expect(result.unit.classId).toBe(targetClass);
      expect(result.unit.level).toBe(1);
      expect(result.unit.hasActed).toBe(true);
      expect(result.unit.inventory).toEqual([]);
      expect(getClassPromotionDefinition(targetClass)).toBeUndefined();
    }
  });

  it("defines the promotion item without automatically granting it to the initial party", () => {
    expect(INVENTORY_ITEMS_BY_ID[PROMOTION_ITEM_ID]?.name).toBe("クラスチェンジの証");

    const playerUnits = INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player");
    expect(playerUnits.every((unit) => !unit.inventory.includes(PROMOTION_ITEM_ID))).toBe(true);
    expect(isValidGameStateSnapshot(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe(true);
  });
});
