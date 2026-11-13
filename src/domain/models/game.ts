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

export type CampaignUnit = Omit<GameUnit, "faction" | "position" | "hasMoved" | "hasActed">;

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

export type MapEventTrigger =
  | { type: "stage-start" }
  | { type: "turn-start"; turn: number; phase: BattlePhase }
  | { type: "unit-defeated"; unitId: string }
  | { type: "boss-defeated" }
  | { type: "victory" }
  | { type: "defeat" };

export interface MapEventDefinition {
  id: string;
  trigger: MapEventTrigger;
  action: {
    type: "show-message";
    speaker?: string;
    text: string;
  };
}

export interface GameMapDefinition {
  id: string;
  width: number;
  height: number;
  terrain: readonly (readonly TerrainType[])[];
  playerDeployment: readonly MapDeployment[];
  enemyDeployment: readonly MapDeployment[];
  objective: MapObjective;
  /** Optional map-local events. Event execution progress is persisted in the snapshot. */
  events?: readonly MapEventDefinition[];
  /** Optional critical-unit defeat rule. Omit to use the party-wipe rule only. */
  defeatCondition?: MapDefeatCondition;
}

export interface CampaignUnitBattleRecord {
  unitId: string;
  unitName: string;
  attacks: number;
  strikes: number;
  hits: number;
  misses: number;
  criticalHits: number;
  damageDealt: number;
  enemiesDefeated: number;
  experienceAwarded: number;
  levelUps: number;
  statGains: UnitStats;
}

export const SAVE_VERSION = 6 as const;

export interface GameStateSnapshot {
  saveVersion: typeof SAVE_VERSION;
  chapterId: string;
  phase: BattlePhase;
  turn: number;
  /** Xorshift32 state. Must be an unsigned, non-zero 32-bit integer. */
  rngState: number;
  units: GameUnit[];
  /** Living player units kept outside the current battle. */
  reserveUnits: CampaignUnit[];
  /** Persistent per-ally combat totals for this campaign. */
  campaignUnitBattleRecords: CampaignUnitBattleRecord[];
  /** IDs of one-shot map events that have already fired in this chapter. */
  firedMapEventIds: string[];
  /** IDs of fired event messages the player has explicitly acknowledged. */
  acknowledgedMapEventIds: string[];
}
