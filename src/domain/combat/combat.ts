import type { GameUnit, WeaponType } from "../models/game";
import type {
  CombatForecast,
  CombatInput,
  CombatResult,
  CombatStrikeKind,
  CombatUnitContext,
  StrikeForecast,
  StrikeRoll,
  WeaponDefinition
} from "./types";

export const WEAPON_TRIANGLE_HIT_BONUS = 20;
export const FOLLOW_UP_SPEED_THRESHOLD = 4;
export const CRITICAL_DAMAGE_MULTIPLIER = 3;

export interface StrikeForecastInput {
  kind: CombatStrikeKind;
  attacker: CombatUnitContext;
  defender: CombatUnitContext;
  weapon: WeaponDefinition;
  opponentWeaponType?: WeaponType;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function assertWeaponDefinition(weapon: WeaponDefinition): void {
  const valid =
    weapon.id.trim().length > 0 &&
    weapon.name.trim().length > 0 &&
    Number.isInteger(weapon.power) &&
    weapon.power >= 0 &&
    Number.isInteger(weapon.hit) &&
    weapon.hit >= 0 &&
    Number.isInteger(weapon.critical) &&
    weapon.critical >= 0 &&
    weapon.critical <= 100 &&
    Number.isInteger(weapon.minRange) &&
    weapon.minRange >= 1 &&
    Number.isInteger(weapon.maxRange) &&
    weapon.maxRange >= weapon.minRange &&
    (weapon.damageType === "physical" || weapon.damageType === "magical");

  if (!valid) {
    throw new Error("Weapon definition contains invalid values.");
  }
}

function assertCombatInput(input: CombatInput): void {
  if (!Number.isInteger(input.distance) || input.distance < 1) {
    throw new RangeError("Combat distance must be a positive integer.");
  }
  if (input.attacker.unit.faction === input.defender.unit.faction) {
    throw new Error("Combat requires units from opposing factions.");
  }
  if (input.attacker.unit.currentHp <= 0 || input.defender.unit.currentHp <= 0) {
    throw new Error("Combat participants must be alive.");
  }

  assertWeaponDefinition(input.attackerWeapon);
  if (!canUnitUseWeapon(input.attacker.unit, input.attackerWeapon)) {
    throw new Error("The initiating unit cannot use or does not own this weapon.");
  }
  if (!isWithinWeaponRange(input.distance, input.attackerWeapon)) {
    throw new RangeError("The initiating weapon is out of range.");
  }

  if (input.defenderWeapon) {
    assertWeaponDefinition(input.defenderWeapon);
    if (!canUnitUseWeapon(input.defender.unit, input.defenderWeapon)) {
      throw new Error("The defending unit cannot use or does not own its weapon.");
    }
  }
}

/** Returns +20, -20, or 0 hit points according to the proposed weapon triangle. */
export function getWeaponTriangleHitModifier(
  attackerType: WeaponType,
  defenderType?: WeaponType
): number {
  if (!defenderType) return 0;

  const advantages: Partial<Record<WeaponType, WeaponType>> = {
    sword: "axe",
    lance: "sword",
    axe: "lance"
  };
  const disadvantages: Partial<Record<WeaponType, WeaponType>> = {
    sword: "lance",
    lance: "axe",
    axe: "sword"
  };

  if (advantages[attackerType] === defenderType) return WEAPON_TRIANGLE_HIT_BONUS;
  if (disadvantages[attackerType] === defenderType) return -WEAPON_TRIANGLE_HIT_BONUS;
  return 0;
}

/** Checks a precomputed grid distance against a weapon's inclusive range. */
export function isWithinWeaponRange(distance: number, weapon: WeaponDefinition): boolean {
  assertWeaponDefinition(weapon);
  return Number.isInteger(distance) &&
    distance >= weapon.minRange &&
    distance <= weapon.maxRange;
}

/** A unit must own the weapon, support its weapon type, and meet any class restriction. */
export function canUnitUseWeapon(
  unit: Pick<GameUnit, "inventory" | "usableWeaponTypes" | "classId">,
  weapon: WeaponDefinition
): boolean {
  return (
    unit.inventory.includes(weapon.id) &&
    unit.usableWeaponTypes.includes(weapon.weaponType) &&
    (weapon.usableClassIds === undefined || weapon.usableClassIds.includes(unit.classId))
  );
}

/**
 * Applies the initial design's combat formulas. Terrain defense is applied to
 * both physical and magical damage; terrain avoidance contributes to evasion.
 */
export function calculateStrikeForecast(input: StrikeForecastInput): StrikeForecast {
  assertWeaponDefinition(input.weapon);

  const attackerStats = input.attacker.unit.stats;
  const defenderStats = input.defender.unit.stats;
  const attackPower =
    (input.weapon.damageType === "physical" ? attackerStats.strength : attackerStats.magic) +
    input.weapon.power;
  const defenseStat =
    input.weapon.damageType === "physical" ? defenderStats.defense : defenderStats.resistance;
  const normalDamage = Math.max(
    0,
    attackPower - defenseStat - input.defender.terrain.defenseBonus
  );
  const evasion =
    defenderStats.speed * 2 +
    defenderStats.luck +
    input.defender.terrain.avoidanceBonus;
  const triangleModifier = getWeaponTriangleHitModifier(
    input.weapon.weaponType,
    input.opponentWeaponType
  );
  const hitRate = clamp(
    input.weapon.hit +
      attackerStats.skill * 2 +
      Math.floor(attackerStats.luck / 2) +
      triangleModifier -
      evasion,
    0,
    100
  );
  const criticalRate = clamp(
    input.weapon.critical +
      Math.floor(attackerStats.skill / 2) -
      Math.floor(defenderStats.luck / 2),
    0,
    100
  );

  return {
    kind: input.kind,
    attackerId: input.attacker.unit.id,
    defenderId: input.defender.unit.id,
    weaponId: input.weapon.id,
    attackPower,
    normalDamage,
    hitRate,
    criticalRate,
    criticalDamage: normalDamage * CRITICAL_DAMAGE_MULTIPLIER,
    weaponTriangleHitModifier: triangleModifier
  };
}

/**
 * Builds the theoretical attack exchange. Follow-up strikes are conditional:
 * the resolver cancels them if either participant has already reached 0 HP.
 */
export function buildCombatForecast(input: CombatInput): CombatForecast {
  assertCombatInput(input);

  const defenderWeapon = input.defenderWeapon;
  const counterAvailable =
    defenderWeapon !== undefined &&
    isWithinWeaponRange(input.distance, defenderWeapon);

  const speedDifference = input.attacker.unit.stats.speed - input.defender.unit.stats.speed;
  const strikes: StrikeForecast[] = [
    calculateStrikeForecast({
      kind: "initial",
      attacker: input.attacker,
      defender: input.defender,
      weapon: input.attackerWeapon,
      ...(defenderWeapon ? { opponentWeaponType: defenderWeapon.weaponType } : {})
    })
  ];

  if (counterAvailable && defenderWeapon) {
    strikes.push(
      calculateStrikeForecast({
        kind: "counter",
        attacker: input.defender,
        defender: input.attacker,
        weapon: defenderWeapon,
        opponentWeaponType: input.attackerWeapon.weaponType
      })
    );
  }

  if (speedDifference >= FOLLOW_UP_SPEED_THRESHOLD) {
    strikes.push(
      calculateStrikeForecast({
        kind: "follow-up",
        attacker: input.attacker,
        defender: input.defender,
        weapon: input.attackerWeapon,
        ...(defenderWeapon ? { opponentWeaponType: defenderWeapon.weaponType } : {})
      })
    );
  } else if (speedDifference <= -FOLLOW_UP_SPEED_THRESHOLD && counterAvailable && defenderWeapon) {
    strikes.push(
      calculateStrikeForecast({
        kind: "follow-up",
        attacker: input.defender,
        defender: input.attacker,
        weapon: defenderWeapon,
        opponentWeaponType: input.attackerWeapon.weaponType
      })
    );
  }

  return {
    attackerId: input.attacker.unit.id,
    defenderId: input.defender.unit.id,
    distance: input.distance,
    counterAvailable,
    speedDifference,
    strikes
  };
}

function validateRoll(roll: StrikeRoll): void {
  if (
    !Number.isInteger(roll.hitRoll) ||
    roll.hitRoll < 0 ||
    roll.hitRoll > 99 ||
    !Number.isInteger(roll.criticalRoll) ||
    roll.criticalRoll < 0 ||
    roll.criticalRoll > 99
  ) {
    throw new RangeError("Combat rolls must be integers from 0 through 99.");
  }
}

/**
 * Resolves an exchange using caller-supplied rolls.
 * The engine does not create or persist RNG state; the application layer must
 * provide deterministic rolls and persist its seed/state in the game save.
 */
export function resolveCombat(input: CombatInput, rolls: readonly StrikeRoll[]): CombatResult {
  const forecast = buildCombatForecast(input);
  let attackerHp = input.attacker.unit.currentHp;
  let defenderHp = input.defender.unit.currentHp;
  let consumedRolls = 0;
  const events: CombatResult["events"] = [];

  function performStrike(kind: CombatStrikeKind, actorSide: "attacker" | "defender"): void {
    const actor = actorSide === "attacker" ? input.attacker : input.defender;
    const target = actorSide === "attacker" ? input.defender : input.attacker;
    const actorWeapon = actorSide === "attacker" ? input.attackerWeapon : input.defenderWeapon;

    if (!actorWeapon) {
      throw new Error("A follow-up or counter requires a weapon.");
    }

    const actorHp = actorSide === "attacker" ? attackerHp : defenderHp;
    const targetHp = actorSide === "attacker" ? defenderHp : attackerHp;
    if (actorHp <= 0 || targetHp <= 0) return;

    const strike = calculateStrikeForecast({
      kind,
      attacker: actor,
      defender: target,
      weapon: actorWeapon,
      ...(actorSide === "attacker"
        ? (input.defenderWeapon ? { opponentWeaponType: input.defenderWeapon.weaponType } : {})
        : { opponentWeaponType: input.attackerWeapon.weaponType })
    });

    const roll = rolls[consumedRolls];
    if (!roll) {
      throw new RangeError("Not enough deterministic rolls were provided for this combat.");
    }
    validateRoll(roll);
    consumedRolls += 1;

    const hit = roll.hitRoll < strike.hitRate;
    const critical = hit && roll.criticalRoll < strike.criticalRate;
    const damage = hit ? (critical ? strike.criticalDamage : strike.normalDamage) : 0;
    const targetHpAfter = Math.max(0, targetHp - damage);

    events.push({
      kind,
      attackerId: actor.unit.id,
      defenderId: target.unit.id,
      weaponId: actorWeapon.id,
      hit,
      critical,
      damage,
      defenderHpBefore: targetHp,
      defenderHpAfter: targetHpAfter,
      hitRate: strike.hitRate,
      criticalRate: strike.criticalRate
    });

    if (actorSide === "attacker") {
      defenderHp = targetHpAfter;
    } else {
      attackerHp = targetHpAfter;
    }
  }

  performStrike("initial", "attacker");

  if (defenderHp > 0 && forecast.counterAvailable) {
    performStrike("counter", "defender");
  }

  if (attackerHp > 0 && defenderHp > 0) {
    if (forecast.speedDifference >= FOLLOW_UP_SPEED_THRESHOLD) {
      performStrike("follow-up", "attacker");
    } else if (
      forecast.speedDifference <= -FOLLOW_UP_SPEED_THRESHOLD &&
      forecast.counterAvailable
    ) {
      performStrike("follow-up", "defender");
    }
  }

  return {
    attackerHp,
    defenderHp,
    events,
    consumedRolls
  };
}
