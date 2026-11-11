import { WEAPONS_BY_ID } from "../content/weapons";
import type { CombatStrikeKind } from "../domain/combat/types";
import type { AttackPlan } from "./perform-attack";

export type CounterAvailability = "available" | "no-weapon" | "out-of-range";

export interface CombatForecastParticipantDetails {
  name: string;
  currentHp: number;
  maxHp: number;
}

export interface CombatForecastStrikeDetails {
  kind: CombatStrikeKind;
  kindLabel: string;
  actorName: string;
  targetName: string;
  weaponName: string;
  weaponTypeLabel: string;
  damageTypeLabel: string;
  attackPower: number;
  normalDamage: number;
  criticalDamage: number;
  hitRate: number;
  criticalRate: number;
  weaponTriangleModifier: number;
  targetTerrainName: string;
  targetTerrainDefenseBonus: number;
  targetTerrainAvoidanceBonus: number;
}

export interface CombatForecastDetails {
  attacker: CombatForecastParticipantDetails;
  defender: CombatForecastParticipantDetails;
  distance: number;
  speedDifference: number;
  counterAvailability: CounterAvailability;
  strikes: CombatForecastStrikeDetails[];
}

const WEAPON_TYPE_LABELS: Record<string, string> = {
  sword: "剣",
  lance: "槍",
  axe: "斧",
  bow: "弓",
  magic: "魔法"
};

function getStrikeKindLabel(kind: CombatStrikeKind): string {
  if (kind === "initial") return "先制攻撃";
  if (kind === "counter") return "反撃";
  return "追撃";
}

/**
 * Projects the existing deterministic combat forecast into UI-ready details.
 * This function does not recalculate combat formulas or change battle rules.
 */
export function getCombatForecastDetails(plan: AttackPlan): CombatForecastDetails {
  const { input, forecast } = plan;
  const attackerContext = input.attacker;
  const defenderContext = input.defender;
  const counterAvailability: CounterAvailability = forecast.counterAvailable
    ? "available"
    : input.defenderWeapon
      ? "out-of-range"
      : "no-weapon";

  const strikes = forecast.strikes.map((strike): CombatForecastStrikeDetails => {
    const actorContext = strike.attackerId === attackerContext.unit.id
      ? attackerContext
      : defenderContext;
    const targetContext = strike.defenderId === attackerContext.unit.id
      ? attackerContext
      : defenderContext;
    const weapon = WEAPONS_BY_ID[strike.weaponId] ??
      (input.attackerWeapon.id === strike.weaponId
        ? input.attackerWeapon
        : input.defenderWeapon);
    if (!weapon) {
      throw new Error("The combat forecast references an unknown weapon.");
    }

    return {
      kind: strike.kind,
      kindLabel: getStrikeKindLabel(strike.kind),
      actorName: actorContext.unit.name,
      targetName: targetContext.unit.name,
      weaponName: weapon.name,
      weaponTypeLabel: WEAPON_TYPE_LABELS[weapon.weaponType] ?? weapon.weaponType,
      damageTypeLabel: weapon.damageType === "physical" ? "物理" : "魔法",
      attackPower: strike.attackPower,
      normalDamage: strike.normalDamage,
      criticalDamage: strike.criticalDamage,
      hitRate: strike.hitRate,
      criticalRate: strike.criticalRate,
      weaponTriangleModifier: strike.weaponTriangleHitModifier,
      targetTerrainName: targetContext.terrain.label,
      targetTerrainDefenseBonus: targetContext.terrain.defenseBonus,
      targetTerrainAvoidanceBonus: targetContext.terrain.avoidanceBonus
    };
  });

  return {
    attacker: {
      name: attackerContext.unit.name,
      currentHp: attackerContext.unit.currentHp,
      maxHp: attackerContext.unit.stats.hp
    },
    defender: {
      name: defenderContext.unit.name,
      currentHp: defenderContext.unit.currentHp,
      maxHp: defenderContext.unit.stats.hp
    },
    distance: forecast.distance,
    speedDifference: forecast.speedDifference,
    counterAvailability,
    strikes
  };
}
