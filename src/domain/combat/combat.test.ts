import { describe, expect, it } from "vitest";
import type { GameUnit, TerrainDefinition, WeaponType } from "../models/game";
import {
  buildCombatForecast,
  calculateStrikeForecast,
  canUnitUseWeapon,
  getWeaponTriangleHitModifier,
  isWithinWeaponRange,
  resolveCombat
} from "./combat";
import type { CombatInput, WeaponDefinition } from "./types";

function createUnit(
  id: string,
  faction: "player" | "enemy",
  options: {
    stats?: Partial<GameUnit["stats"]> | undefined;
    weaponTypes?: WeaponType[];
    inventory?: string[];
    classId?: string;
  } = {}
): GameUnit {
  return {
    id,
    name: id,
    faction,
    classId: options.classId ?? "soldier",
    level: 1,
    experience: 0,
    stats: {
      hp: 20,
      strength: 8,
      magic: 5,
      skill: 10,
      speed: 10,
      luck: 6,
      defense: 3,
      resistance: 2,
      ...options.stats
    },
    growthRates: {
      hp: 50,
      strength: 50,
      magic: 50,
      skill: 50,
      speed: 50,
      luck: 50,
      defense: 50,
      resistance: 50
    },
    currentHp: options.stats?.hp ?? 20,
    movementType: "infantry",
    move: 5,
    usableWeaponTypes: options.weaponTypes ?? ["sword"],
    inventory: options.inventory ?? ["iron-sword"],
    position: { x: 0, y: 0 },
    hasMoved: false,
    hasActed: false
  };
}

function createWeapon(options: Partial<WeaponDefinition> = {}): WeaponDefinition {
  return {
    id: "iron-sword",
    name: "Test Sword",
    description: "Test fixture only.",
    weaponType: "sword",
    power: 5,
    hit: 80,
    critical: 20,
    minRange: 1,
    maxRange: 1,
    damageType: "physical",
    ...options
  };
}

function createTerrain(
  defenseBonus = 0,
  avoidanceBonus = 0
): TerrainDefinition {
  return {
    label: "Test terrain",
    symbol: "·",
    movementCost: { infantry: 1, cavalry: 1 },
    defenseBonus,
    avoidanceBonus
  };
}

function createInput(options: {
  attackerStats?: Partial<GameUnit["stats"]>;
  defenderStats?: Partial<GameUnit["stats"]>;
  attackerWeapon?: WeaponDefinition;
  defenderWeapon?: WeaponDefinition | null;
  attackerTerrain?: TerrainDefinition;
  defenderTerrain?: TerrainDefinition;
  distance?: number;
} = {}): CombatInput {
  const attackerWeapon = options.attackerWeapon ?? createWeapon();
  const defenderWeapon = options.defenderWeapon === null ? undefined : (options.defenderWeapon ?? createWeapon({
    id: "iron-lance",
    name: "Test Lance",
    weaponType: "lance",
    power: 4,
    hit: 75,
    critical: 10
  }));

  return {
    attacker: {
      unit: createUnit("attacker", "player", {
        stats: options.attackerStats,
        weaponTypes: [attackerWeapon.weaponType],
        inventory: [attackerWeapon.id]
      }),
      terrain: options.attackerTerrain ?? createTerrain()
    },
    defender: {
      unit: createUnit("defender", "enemy", {
        stats: options.defenderStats,
        weaponTypes: defenderWeapon ? [defenderWeapon.weaponType] : [],
        inventory: defenderWeapon ? [defenderWeapon.id] : []
      }),
      terrain: options.defenderTerrain ?? createTerrain()
    },
    attackerWeapon,
    ...(defenderWeapon ? { defenderWeapon } : {}),
    distance: options.distance ?? 1
  };
}

describe("weapon triangle", () => {
  it("applies the design's sword, lance, and axe relationships", () => {
    expect(getWeaponTriangleHitModifier("sword", "axe")).toBe(20);
    expect(getWeaponTriangleHitModifier("sword", "lance")).toBe(-20);
    expect(getWeaponTriangleHitModifier("lance", "sword")).toBe(20);
    expect(getWeaponTriangleHitModifier("lance", "axe")).toBe(-20);
    expect(getWeaponTriangleHitModifier("axe", "lance")).toBe(20);
    expect(getWeaponTriangleHitModifier("axe", "sword")).toBe(-20);
  });

  it("does not apply triangle bonuses to bows or magic", () => {
    for (const attacker of ["bow", "magic"] as const) {
      for (const defender of ["sword", "lance", "axe", "bow", "magic"] as const) {
        expect(getWeaponTriangleHitModifier(attacker, defender)).toBe(0);
      }
    }
    expect(getWeaponTriangleHitModifier("sword", "bow")).toBe(0);
    expect(getWeaponTriangleHitModifier("axe", "magic")).toBe(0);
    expect(getWeaponTriangleHitModifier("sword")).toBe(0);
  });
});

describe("weapon validation and range", () => {
  it("uses inclusive minimum and maximum weapon range", () => {
    const bow = createWeapon({
      weaponType: "bow",
      minRange: 2,
      maxRange: 3
    });
    expect(isWithinWeaponRange(1, bow)).toBe(false);
    expect(isWithinWeaponRange(2, bow)).toBe(true);
    expect(isWithinWeaponRange(3, bow)).toBe(true);
    expect(isWithinWeaponRange(4, bow)).toBe(false);
    expect(isWithinWeaponRange(1.5, bow)).toBe(false);
  });

  it("requires ownership, supported weapon type, and any class restriction", () => {
    const unit = createUnit("unit", "player", {
      weaponTypes: ["sword"],
      inventory: ["iron-sword"],
      classId: "swordsman"
    });
    expect(canUnitUseWeapon(unit, createWeapon())).toBe(true);
    expect(canUnitUseWeapon(unit, createWeapon({ id: "missing" }))).toBe(false);
    expect(canUnitUseWeapon(unit, createWeapon({ weaponType: "axe" }))).toBe(false);
    expect(canUnitUseWeapon(unit, createWeapon({ usableClassIds: ["archer"] }))).toBe(false);
    expect(canUnitUseWeapon(unit, createWeapon({ usableClassIds: ["swordsman"] }))).toBe(true);
  });

  it("rejects an initiating attack with an invalid distance or unusable weapon", () => {
    expect(() => buildCombatForecast(createInput({ distance: 0 }))).toThrow(RangeError);
    expect(() => buildCombatForecast(createInput({
      attackerWeapon: createWeapon({ usableClassIds: ["archer"] })
    }))).toThrow("cannot use or does not own");
    expect(() => buildCombatForecast(createInput({
      distance: 2,
      attackerWeapon: createWeapon({ maxRange: 1 })
    }))).toThrow("out of range");
  });
});

describe("combat formulas", () => {
  it("applies the design's physical damage, hit, critical, and terrain formulas", () => {
    const input = createInput({
      attackerStats: {
        hp: 20, strength: 8, skill: 10, speed: 10, luck: 6
      },
      defenderStats: {
        hp: 30, strength: 5, skill: 6, speed: 8, luck: 4, defense: 4
      },
      defenderTerrain: createTerrain(1, 20)
    });

    const forecast = calculateStrikeForecast({
      kind: "initial",
      attacker: input.attacker,
      defender: input.defender,
      weapon: input.attackerWeapon,
      ...(input.defenderWeapon ? { opponentWeaponType: input.defenderWeapon.weaponType } : {})
    });

    expect(forecast.attackPower).toBe(13);
    expect(forecast.normalDamage).toBe(8);
    expect(forecast.hitRate).toBe(43);
    expect(forecast.criticalRate).toBe(23);
    expect(forecast.criticalDamage).toBe(24);
    expect(forecast.weaponTriangleHitModifier).toBe(-20);
  });

  it("uses magic and resistance while applying terrain defense to magical damage", () => {
    const input = createInput({
      attackerStats: { magic: 8, skill: 0, luck: 0 },
      defenderStats: { resistance: 2, speed: 0, luck: 0 },
      attackerWeapon: createWeapon({
        id: "fire",
        weaponType: "magic",
        damageType: "magical",
        power: 5,
        hit: 100,
        critical: 0,
        minRange: 1,
        maxRange: 2
      }),
      defenderWeapon: null,
      defenderTerrain: createTerrain(2, 0)
    });

    const forecast = calculateStrikeForecast({
      kind: "initial",
      attacker: input.attacker,
      defender: input.defender,
      weapon: input.attackerWeapon
    });
    expect(forecast.attackPower).toBe(13);
    expect(forecast.normalDamage).toBe(9);
    expect(forecast.weaponTriangleHitModifier).toBe(0);
  });

  it("clamps hit and critical rates to the 0..100 range", () => {
    const input = createInput({
      attackerStats: { skill: 100, luck: 100 },
      defenderStats: { speed: 0, luck: 0 },
      attackerWeapon: createWeapon({ hit: 100, critical: 100 }),
      defenderWeapon: null
    });
    const forecast = calculateStrikeForecast({
      kind: "initial",
      attacker: input.attacker,
      defender: input.defender,
      weapon: input.attackerWeapon
    });
    expect(forecast.hitRate).toBe(100);
    expect(forecast.criticalRate).toBe(100);
  });
});

describe("combat forecast and deterministic resolution", () => {
  it("orders the initiating attack, counter, and one speed-based follow-up", () => {
    const input = createInput({
      attackerStats: { speed: 14 },
      defenderStats: { speed: 8 }
    });
    const forecast = buildCombatForecast(input);
    expect(forecast.counterAvailable).toBe(true);
    expect(forecast.speedDifference).toBe(6);
    expect(forecast.strikes.map((strike) => strike.kind)).toEqual([
      "initial", "counter", "follow-up"
    ]);
  });

  it("does not allow a defender follow-up when the defender cannot counter at this range", () => {
    const input = createInput({
      attackerStats: { speed: 8 },
      defenderStats: { speed: 14 },
      defenderWeapon: createWeapon({
        id: "ranged-lance",
        weaponType: "lance",
        minRange: 2,
        maxRange: 2
      }),
      distance: 1
    });
    const forecast = buildCombatForecast(input);
    expect(forecast.counterAvailable).toBe(false);
    expect(forecast.strikes.map((strike) => strike.kind)).toEqual(["initial"]);
  });

  it("resolves hit, miss, critical, damage, and follow-up in deterministic order", () => {
    const input = createInput({
      attackerStats: { speed: 14 },
      defenderStats: { speed: 8, hp: 30 }
    });
    const result = resolveCombat(input, [
      { hitRoll: 99, criticalRoll: 0 },
      { hitRoll: 0, criticalRoll: 99 },
      { hitRoll: 0, criticalRoll: 0 }
    ]);

    expect(result.events.map((event) => event.kind)).toEqual([
      "initial", "counter", "follow-up"
    ]);
    expect(result.events[0]).toMatchObject({ hit: false, critical: false, damage: 0 });
    expect(result.events[1]).toMatchObject({ hit: true, critical: false, damage: 6 });
    expect(result.events[2]).toMatchObject({ hit: true, critical: true, damage: 24 });
    expect(result.attackerHp).toBe(14);
    expect(result.defenderHp).toBe(6);
    expect(result.consumedRolls).toBe(3);
  });

  it("stops the exchange when the initial attack defeats the defender", () => {
    const input = createInput({
      attackerStats: { strength: 100, speed: 14 },
      defenderStats: { hp: 1, speed: 8 }
    });
    const result = resolveCombat(input, [{ hitRoll: 0, criticalRoll: 99 }]);

    expect(result.events).toHaveLength(1);
    expect(result.defenderHp).toBe(0);
    expect(result.consumedRolls).toBe(1);
  });

  it("stops follow-up attacks when a counter defeats the initiating unit", () => {
    const input = createInput({
      attackerStats: { hp: 5, strength: 0, speed: 8, skill: 0, luck: 0 },
      defenderStats: { strength: 100, speed: 14, skill: 100, luck: 100 }
    });
    const result = resolveCombat(input, [
      { hitRoll: 99, criticalRoll: 99 },
      { hitRoll: 0, criticalRoll: 0 }
    ]);

    expect(result.events.map((event) => event.kind)).toEqual(["initial", "counter"]);
    expect(result.attackerHp).toBe(0);
    expect(result.consumedRolls).toBe(2);
  });

  it("rejects missing or out-of-range deterministic rolls", () => {
    const input = createInput();
    expect(() => resolveCombat(input, [])).toThrow("Not enough deterministic rolls");
    expect(() => resolveCombat(input, [{ hitRoll: 100, criticalRoll: 0 }])).toThrow(RangeError);
  });
});
