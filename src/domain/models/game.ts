export type Faction = "player" | "enemy";
export type BattlePhase = "player" | "enemy";
export type MovementType = "infantry" | "cavalry";
export type WeaponType = "sword" | "lance" | "axe" | "bow" | "magic";
export type DamageType = "physical" | "magical";

export type TerrainType =
  | "plain"
  | "road"
  | "forest"
  | "mountain"
  | "fort"
  | "wall"
  | "water";

export interface Position {
  x: number;
  y: number;
}

export interface UnitStats {
  hp: number;
  strength: number;
  magic: number;
  skill: number;
  speed: number;
  luck: number;
  defense: number;
  resistance: number;
}

export type UnitGrowthRates = Record<keyof UnitStats, number>;

export interface GameUnit {
  id: string;
  name: string;
  faction: Faction;
  classId: string;
  level: number;
  experience: number;
  stats: UnitStats;
  growthRates: UnitGrowthRates;
  currentHp: number;
  movementType: MovementType;
  move: number;
  usableWeaponTypes: WeaponType[];
  inventory: string[];
  equippedWeaponId: string | null;
  position: Position;
  hasMoved: boolean;
  hasActed: boolean;
}

export interface TerrainDefinition {
  label: string;
  symbol: string;
  movementCost: Record<MovementType, number | null>;
  defenseBonus: number;
  avoidanceBonus: number;
}

export interface MapDeployment {
  unitId: string;
  x: number;
  y: number;
}

export interface MapObjective {
  type: "defeat_boss" | "defeat_all";
  targetUnitId?: string;
}

export interface MapDefeatCondition {
  type: "unit_defeated";
  /** Must identify a player unit in this map's deployment data. */
  targetUnitId: string;
}

export interface GameMapDefinition {
  id: string;
  width: number;
  height: number;
  terrain: readonly (readonly TerrainType[])[];
  playerDeployment: readonly MapDeployment[];
  enemyDeployment: readonly MapDeployment[];
  objective: MapObjective;
  /** Optional critical-unit defeat rule. Omit to use the party-wipe rule only. */
  defeatCondition?: MapDefeatCondition;
}

export const SAVE_VERSION = 2 as const;

export interface GameStateSnapshot {
  saveVersion: typeof SAVE_VERSION;
  chapterId: string;
  phase: BattlePhase;
  turn: number;
  /** Xorshift32 state. Must be an unsigned, non-zero 32-bit integer. */
  rngState: number;
  units: GameUnit[];
}
