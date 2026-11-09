import type { DamageType, GameUnit, TerrainType, TerrainDefinition, WeaponType } from "../models/game";

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  weaponType: WeaponType;
  power: number;
  hit: number;
  critical: number;
  minRange: number;
  maxRange: number;
  damageType: DamageType;
  usableClassIds?: readonly string[];
  iconKey?: string;
}

export interface CombatUnitContext {
  unit: GameUnit;
  terrain: TerrainDefinition;
  terrainType?: TerrainType;
}

export interface CombatInput {
  attacker: CombatUnitContext;
  defender: CombatUnitContext;
  attackerWeapon: WeaponDefinition;
  defenderWeapon?: WeaponDefinition;
  /**
   * Distance in the game's not-yet-finalized range metric.
   * The caller must calculate this; the coordinate-distance convention is
   * intentionally not embedded here until the product rule is decided.
   */
  distance: number;
}

export type CombatStrikeKind = "initial" | "counter" | "follow-up";

export interface StrikeForecast {
  kind: CombatStrikeKind;
  attackerId: string;
  defenderId: string;
  weaponId: string;
  attackPower: number;
  normalDamage: number;
  hitRate: number;
  criticalRate: number;
  criticalDamage: number;
  weaponTriangleHitModifier: number;
}

export interface CombatForecast {
  attackerId: string;
  defenderId: string;
  distance: number;
  counterAvailable: boolean;
  speedDifference: number;
  strikes: StrikeForecast[];
}

export interface StrikeRoll {
  /** Integer in the range 0..99. A hit occurs when this is below hitRate. */
  hitRoll: number;
  /** Integer in the range 0..99. A critical occurs on a hit when below criticalRate. */
  criticalRoll: number;
}

export interface CombatEvent {
  kind: CombatStrikeKind;
  attackerId: string;
  defenderId: string;
  weaponId: string;
  hit: boolean;
  critical: boolean;
  damage: number;
  defenderHpBefore: number;
  defenderHpAfter: number;
  hitRate: number;
  criticalRate: number;
}

export interface CombatResult {
  attackerHp: number;
  defenderHp: number;
  events: CombatEvent[];
  consumedRolls: number;
}
