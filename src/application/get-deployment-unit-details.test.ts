import { describe, expect, it } from "vitest";
import { getDeploymentUnitDetails } from "./get-deployment-unit-details";

describe("getDeploymentUnitDetails", () => {
  it("separates owned weapons from items, marks equipment, and reports suitability", () => {
    const details = getDeploymentUnitDetails({
      classId: "swordsman",
      usableWeaponTypes: ["sword"],
      inventory: ["iron_sword", "promotion_seal", "short_bow"],
      equippedWeaponId: "iron_sword"
    });

    expect(details.weapons.map(({ id, isEquipped, isUsable }) => ({ id, isEquipped, isUsable }))).toEqual([
      { id: "iron_sword", isEquipped: true, isUsable: true },
      { id: "short_bow", isEquipped: false, isUsable: false }
    ]);
    expect(details.equippedWeapon?.id).toBe("iron_sword");
    expect(details.items).toEqual([{
      id: "promotion_seal",
      inventoryIndex: 1,
      name: "クラスチェンジの証",
      description: "基本職Lv.10以上の味方が昇格するために使う試作アイテム。"
    }]);
  });

  it("keeps unknown item IDs visible instead of dropping them", () => {
    const details = getDeploymentUnitDetails({
      classId: "swordsman",
      usableWeaponTypes: ["sword"],
      inventory: ["unknown_relic"],
      equippedWeaponId: "missing_weapon"
    });

    expect(details.items).toEqual([{
      id: "unknown_relic",
      inventoryIndex: 0,
      name: "unknown_relic",
      description: null
    }]);
    expect(details.equippedWeapon).toBeNull();
  });

  it("preserves repeated inventory entries with distinct display keys", () => {
    const details = getDeploymentUnitDetails({
      classId: "cavalry",
      usableWeaponTypes: ["sword", "lance"],
      inventory: ["iron_sword", "iron_sword", "iron_lance", "promotion_seal", "promotion_seal"],
      equippedWeaponId: "iron_sword"
    });

    expect(details.weapons.map(({ inventoryIndex }) => inventoryIndex)).toEqual([0, 1, 2]);
    expect(details.weapons.every(({ isUsable }) => isUsable)).toBe(true);
    expect(details.items.map(({ inventoryIndex }) => inventoryIndex)).toEqual([3, 4]);
  });

  it("returns empty collections and no equipped weapon for an empty inventory", () => {
    const details = getDeploymentUnitDetails({
      classId: "swordsman",
      usableWeaponTypes: ["sword"],
      inventory: [],
      equippedWeaponId: null
    });

    expect(details).toEqual({ weapons: [], items: [], equippedWeapon: null });
  });
});
