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
