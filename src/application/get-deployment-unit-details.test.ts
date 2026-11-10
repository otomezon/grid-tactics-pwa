import { describe, expect, it } from "vitest";
import { getDeploymentUnitDetails } from "./get-deployment-unit-details";

describe("getDeploymentUnitDetails", () => {
  it("separates owned weapons from items and marks the equipped weapon", () => {
    const details = getDeploymentUnitDetails({
      inventory: ["iron_sword", "promotion_seal", "short_bow"],
      equippedWeaponId: "iron_sword"
    });

    expect(details.weapons.map(({ id, isEquipped }) => ({ id, isEquipped }))).toEqual([
      { id: "iron_sword", isEquipped: true },
      { id: "short_bow", isEquipped: false }
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
      inventory: ["iron_sword", "iron_sword", "promotion_seal", "promotion_seal"],
      equippedWeaponId: "iron_sword"
    });

    expect(details.weapons.map(({ inventoryIndex }) => inventoryIndex)).toEqual([0, 1]);
    expect(details.weapons.every(({ isEquipped }) => isEquipped)).toBe(true);
    expect(details.items.map(({ inventoryIndex }) => inventoryIndex)).toEqual([2, 3]);
  });

  it("returns empty collections and no equipped weapon for an empty inventory", () => {
    const details = getDeploymentUnitDetails({
      inventory: [],
      equippedWeaponId: null
    });

    expect(details).toEqual({ weapons: [], items: [], equippedWeapon: null });
  });
});
