import { describe, expect, it } from "vitest";
import { HEALING_POTION_ID, PROMOTION_ITEM_ID } from "../content/items";
import type { GameUnit } from "../domain/models/game";
import { getPlayerInspectionDetails } from "./get-player-inspection-details";

function createPlayer(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: "unit_test", name: "味方テスト", faction: "player", classId: "swordsman",
    level: 4, experience: 37,
    stats: { hp: 28, strength: 9, magic: 3, skill: 8, speed: 10, luck: 5, defense: 6, resistance: 2 },
    growthRates: { hp: 80, strength: 35, magic: 5, skill: 55, speed: 60, luck: 35, defense: 25, resistance: 15 },
    currentHp: 19, movementType: "infantry", move: 5, usableWeaponTypes: ["sword"],
    inventory: ["iron_sword", "short_bow", HEALING_POTION_ID, HEALING_POTION_ID, PROMOTION_ITEM_ID, "unknown_item"],
    equippedWeaponId: "iron_sword", position: { x: 3, y: 2 }, hasMoved: true, hasActed: false,
    ...overrides
  };
}

describe("getPlayerInspectionDetails", () => {
  it("projects stats, action status, weapon suitability, and grouped items", () => {
    const details = getPlayerInspectionDetails(createPlayer());
    expect(details).toMatchObject({
      id: "unit_test", name: "味方テスト", className: "剣士", level: 4, experience: 37,
      currentHp: 19, maxHp: 28, positionLabel: "4列・3行", move: 5,
      movementTypeLabel: "歩兵", actionStatus: "移動済・未行動",
      growthRates: { hp: 80, strength: 35, magic: 5, skill: 55, speed: 60, luck: 35, defense: 25, resistance: 15 }
    });
    expect(details?.stats).toEqual([
      { key: "strength", label: "力", value: 9 },
      { key: "magic", label: "魔力", value: 3 },
      { key: "skill", label: "技", value: 8 },
      { key: "speed", label: "速さ", value: 10 },
      { key: "luck", label: "幸運", value: 5 },
      { key: "defense", label: "守備", value: 6 },
      { key: "resistance", label: "魔防", value: 2 }
    ]);
    expect(details?.weapons).toMatchObject([
      { id: "iron_sword", name: "試作の鉄の剣", isEquipped: true, isUsable: true, attackPower: 14, hit: 90, critical: 0, minRange: 1, maxRange: 1 },
      { id: "short_bow", name: "試作の弓", isEquipped: false, isUsable: false, attackPower: 14, minRange: 2, maxRange: 2 }
    ]);
    expect(details?.items).toEqual([
      { id: HEALING_POTION_ID, name: "回復薬", quantity: 2, description: expect.stringContaining("試作値") },
      { id: PROMOTION_ITEM_ID, name: "クラスチェンジの証", quantity: 1, description: expect.any(String) },
      { id: "unknown_item", name: "unknown_item", quantity: 1, description: null }
    ]);
  });

  it("returns no inspection for enemies or defeated players", () => {
    expect(getPlayerInspectionDetails(createPlayer({ faction: "enemy" }))).toBeNull();
    expect(getPlayerInspectionDetails(createPlayer({ currentHp: 0 }))).toBeNull();
  });

  it("shows no owned weapons when the inventory only contains items", () => {
    const details = getPlayerInspectionDetails(createPlayer({ inventory: [HEALING_POTION_ID], equippedWeaponId: null }));
    expect(details?.weapons).toEqual([]);
    expect(details?.items).toHaveLength(1);
  });

  it("uses magic rather than strength for magical weapon attack power", () => {
    const details = getPlayerInspectionDetails(createPlayer({
      stats: { hp: 20, strength: 12, magic: 9, skill: 5, speed: 5, luck: 0, defense: 2, resistance: 4 },
      usableWeaponTypes: ["magic"], inventory: ["fire_tome"], equippedWeaponId: "fire_tome"
    }));
    expect(details?.weapons[0]).toMatchObject({ damageTypeLabel: "魔法", attackPower: 14, isUsable: true });
  });

  it("reports all three current action states without changing them", () => {
    expect(getPlayerInspectionDetails(createPlayer({ hasMoved: false, hasActed: false }))?.actionStatus).toBe("未移動・未行動");
    expect(getPlayerInspectionDetails(createPlayer({ hasMoved: true, hasActed: false }))?.actionStatus).toBe("移動済・未行動");
    expect(getPlayerInspectionDetails(createPlayer({ hasActed: true }))?.actionStatus).toBe("行動済");
  });
});
