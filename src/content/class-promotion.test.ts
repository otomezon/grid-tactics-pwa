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

  it("defines the promotion item without granting it to a new campaign automatically", () => {
    expect(INVENTORY_ITEMS_BY_ID[PROMOTION_ITEM_ID]?.name).toBe("クラスチェンジの証");

    const swordUnit = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001");
    expect(swordUnit?.inventory).toEqual(["iron_sword"]);
    expect(swordUnit?.inventory).not.toContain(PROMOTION_ITEM_ID);
    expect(isValidGameStateSnapshot(INITIAL_GAME_STATE, CHAPTER_01_MAP)).toBe(true);
  });
});
