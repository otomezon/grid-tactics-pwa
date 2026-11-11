import { describe, expect, it } from "vitest";
import type { GameUnit } from "../domain/models/game";
import { getEnemyInspectionDetails } from "./get-enemy-inspection-details";

function createEnemy(overrides: Partial<GameUnit> = {}): GameUnit {
  return {
    id: "enemy_test",
    name: "敵テスト",
    faction: "enemy",
    classId: "fighter",
    level: 3,
    experience: 27,
    stats: {
      hp: 24,
      strength: 8,
      magic: 2,
      skill: 6,
      speed: 7,
      luck: 4,
      defense: 5,
      resistance: 3
    },
    growthRates: {
      hp: 80,
      strength: 35,
      magic: 5,
      skill: 55,
      speed: 60,
      luck: 35,
      defense: 25,
      resistance: 15
    },
    currentHp: 17,
    movementType: "infantry",
    move: 5,
    usableWeaponTypes: ["axe", "bow", "magic"],
    inventory: ["iron_axe", "short_bow", "fire_tome"],
    equippedWeaponId: "iron_axe",
    position: { x: 3, y: 2 },
    hasMoved: false,
    hasActed: false,
    ...overrides
  };
}

describe("getEnemyInspectionDetails", () => {
  it("projects all non-HP stats, location, movement, and owned weapon performance", () => {
    const details = getEnemyInspectionDetails(createEnemy());

    expect(details).toMatchObject({
      id: "enemy_test",
      name: "敵テスト",
      className: "戦士",
      level: 3,
      currentHp: 17,
      maxHp: 24,
      positionLabel: "4列・3行",
      move: 5,
      movementTypeLabel: "歩兵"
    });
    expect(details?.stats).toEqual([
      { key: "strength", label: "力", value: 8 },
      { key: "magic", label: "魔力", value: 2 },
      { key: "skill", label: "技", value: 6 },
      { key: "speed", label: "速さ", value: 7 },
      { key: "luck", label: "幸運", value: 4 },
      { key: "defense", label: "守備", value: 5 },
      { key: "resistance", label: "魔防", value: 3 }
    ]);
    expect(details?.weapons).toEqual([
      {
        id: "iron_axe",
        name: "試作の鉄の斧",
        inventoryIndex: 0,
        isEquipped: true,
        weaponTypeLabel: "斧",
        damageTypeLabel: "物理",
        power: 5,
        attackPower: 13,
        hit: 90,
        critical: 0,
        minRange: 1,
        maxRange: 1
      },
      {
        id: "short_bow",
        name: "試作の弓",
        inventoryIndex: 1,
        isEquipped: false,
        weaponTypeLabel: "弓",
        damageTypeLabel: "物理",
        power: 5,
        attackPower: 13,
        hit: 90,
        critical: 0,
        minRange: 2,
        maxRange: 2
      },
      {
        id: "fire_tome",
        name: "試作の魔道書",
        inventoryIndex: 2,
        isEquipped: false,
        weaponTypeLabel: "魔法",
        damageTypeLabel: "魔法",
        power: 5,
        attackPower: 7,
        hit: 90,
        critical: 0,
        minRange: 1,
        maxRange: 2
      }
    ]);
  });

  it("returns no inspection for player units or defeated enemies", () => {
    expect(getEnemyInspectionDetails(createEnemy({ faction: "player" }))).toBeNull();
    expect(getEnemyInspectionDetails(createEnemy({ currentHp: 0 }))).toBeNull();
  });

  it("shows an empty weapon list when the enemy has no owned weapons", () => {
    const details = getEnemyInspectionDetails(createEnemy({
      inventory: ["promotion_seal"],
      equippedWeaponId: null
    }));

    expect(details?.weapons).toEqual([]);
  });

  it("uses magic rather than strength when deriving a magical weapon's attack power", () => {
    const details = getEnemyInspectionDetails(createEnemy({
      stats: {
        hp: 20,
        strength: 12,
        magic: 9,
        skill: 5,
        speed: 5,
        luck: 0,
        defense: 2,
        resistance: 4
      },
      inventory: ["fire_tome"],
      equippedWeaponId: "fire_tome"
    }));

    expect(details?.weapons[0]).toMatchObject({
      damageTypeLabel: "魔法",
      attackPower: 14
    });
  });
});
