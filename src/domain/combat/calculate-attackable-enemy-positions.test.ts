import { describe, expect, it } from "vitest";
import { WEAPONS_BY_ID } from "../../content/weapons";
import type { GameUnit, Faction, Position } from "../models/game";
import { calculateAttackableEnemyPositions } from "./calculate-attackable-enemy-positions";

function createUnit(
  id: string,
  faction: Faction,
  position: Position,
  overrides: Partial<GameUnit> = {}
): GameUnit {
  return {
    id,
    name: id,
    faction,
    classId: faction === "player" ? "swordsman" : "fighter",
    level: 1,
    experience: 0,
    stats: {
      hp: 20,
      strength: 6,
      magic: 0,
      skill: 7,
      speed: 8,
      luck: 4,
      defense: 5,
      resistance: 1
    },
    growthRates: {
      hp: 0,
      strength: 0,
      magic: 0,
      skill: 0,
      speed: 0,
      luck: 0,
      defense: 0,
      resistance: 0
    },
    currentHp: 20,
    movementType: "infantry",
    move: 5,
    usableWeaponTypes: ["sword"],
    inventory: ["iron_sword"],
    equippedWeaponId: "iron_sword",
    position,
    hasMoved: false,
    hasActed: false,
    ...overrides
  };
}

describe("calculateAttackableEnemyPositions", () => {
  const sword = WEAPONS_BY_ID.iron_sword!;

  it("calculates targets from an explicit movement-preview origin", () => {
    const attacker = createUnit("ally", "player", { x: 0, y: 0 });
    const enemy = createUnit("enemy", "enemy", { x: 2, y: 1 });

    expect(calculateAttackableEnemyPositions(attacker, [enemy], sword)).toEqual([]);
    expect(calculateAttackableEnemyPositions(attacker, [enemy], sword, { x: 1, y: 1 }))
      .toEqual([{ x: 2, y: 1 }]);
  });

  it("includes only living enemies and preserves their supplied order", () => {
    const attacker = createUnit("ally", "player", { x: 0, y: 0 });
    const firstEnemy = createUnit("enemy-1", "enemy", { x: 1, y: 0 });
    const defeatedEnemy = createUnit("enemy-2", "enemy", { x: 0, y: 1 }, { currentHp: 0 });
    const ally = createUnit("ally-2", "player", { x: 1, y: 1 });
    const secondEnemy = createUnit("enemy-3", "enemy", { x: 0, y: 2 });

    expect(calculateAttackableEnemyPositions(
      attacker,
      [firstEnemy, defeatedEnemy, ally, secondEnemy],
      sword
    )).toEqual([{ x: 1, y: 0 }]);
  });

  it("allows a unit that has moved but has not acted to attack from its current position", () => {
    const attacker = createUnit("ally", "player", { x: 0, y: 0 }, { hasMoved: true });
    const enemy = createUnit("enemy", "enemy", { x: 1, y: 0 });

    expect(calculateAttackableEnemyPositions(attacker, [enemy], sword))
      .toEqual([{ x: 1, y: 0 }]);
  });

  it("returns no targets when the attacker is invalid, acted, or cannot use the weapon", () => {
    const enemy = createUnit("enemy", "enemy", { x: 1, y: 0 });
    const attacker = createUnit("ally", "player", { x: 0, y: 0 });

    expect(calculateAttackableEnemyPositions(null, [enemy], sword)).toEqual([]);
    expect(calculateAttackableEnemyPositions(
      createUnit("acted", "player", { x: 0, y: 0 }, { hasActed: true }),
      [enemy],
      sword
    )).toEqual([]);
    expect(calculateAttackableEnemyPositions(
      createUnit("unarmed", "player", { x: 0, y: 0 }, {
        inventory: [],
        equippedWeaponId: null
      }),
      [enemy],
      sword
    )).toEqual([]);
    expect(calculateAttackableEnemyPositions(attacker, [enemy], null)).toEqual([]);
  });

  it("does not use a weapon that is owned but not currently equipped", () => {
    const attacker = createUnit("ally", "player", { x: 0, y: 0 }, {
      equippedWeaponId: null
    });
    const enemy = createUnit("enemy", "enemy", { x: 1, y: 0 });

    expect(calculateAttackableEnemyPositions(attacker, [enemy], sword)).toEqual([]);
  });

  it("does not include targets outside the equipped weapon's range", () => {
    const attacker = createUnit("ally", "player", { x: 0, y: 0 });
    const enemy = createUnit("enemy", "enemy", { x: 2, y: 0 });

    expect(calculateAttackableEnemyPositions(attacker, [enemy], sword)).toEqual([]);
  });
});
