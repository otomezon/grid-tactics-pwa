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
  | {
      type: "unit-interacts";
      x: number;
      y: number;
      label: string;
      description?: string;
      unitId?: string;
    }
  | { type: "boss-defeated" }
  | { type: "victory" }
  | { type: "defeat" }
  | { type: "event-choice"; eventId: string; choiceId: string };

export interface MapEventChoiceDefinition {
  id: string;
  label: string;
}

export interface MapEventChoiceSelection {
  eventId: string;
  choiceId: string;
}

/** A one-time dialogue decision retained across chapter transitions. */
export interface CampaignChoiceSelection {
  key: string;
  choiceId: string;
  sourceChapterId: string;
  sourceEventId: string;
}

/** A content condition that gates an event on an earlier campaign decision. */
export interface MapEventCondition {
  type: "campaign-choice";
  key: string;
  choiceId: string;
}

export type MapEventAction =
  | { type: "show-message"; speaker?: string; text: string }
  | { type: "show-choice"; speaker?: string; text: string; choices: MapEventChoiceDefinition[]; campaignChoiceKey?: string }
  | {
      type: "grant-item";
      speaker?: string;
      text: string;
      recipientUnitId: string;
      itemId: string;
      quantity: number;
    }
  | { type: "spawn-reinforcement"; speaker?: string; text: string; unit: GameUnit }
  | { type: "recruit-unit"; speaker?: string; text: string; unit: CampaignUnit };

export interface MapEventDefinition {
  id: string;
  trigger: MapEventTrigger;
  /** Optional cross-chapter condition; evaluated when the event's normal trigger occurs. */
  condition?: MapEventCondition;
  action: MapEventAction;
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

export type CampaignPlayerActionKind =
  | "movement" | "weapon-change" | "item-use" | "class-change" | "map-interaction" | "wait";

export interface CampaignBattleStrikeRecord {
  actorId: string;
  actorName: string;
  targetId: string;
  targetName: string;
  kind: "initial" | "counter" | "follow-up";
  weaponName: string;
  outcome: "miss" | "hit" | "critical";
  damage: number;
  targetHpBefore: number;
  targetHpAfter: number;
}

interface CampaignBattleLogBase {
  sequence: number;
  chapterId: string;
  turn: number;
}

export type CampaignChapterResultReason =
  | "objective-cleared"
  | "party-wiped"
  | "protected-unit-defeated";

export type CampaignBattleLogEntry =
  | (CampaignBattleLogBase & {
      kind: "chapter-result";
      outcome: "victory" | "defeat";
      objective: "defeat_all" | "defeat_boss";
      reason: CampaignChapterResultReason;
      livingPlayerCount: number;
      livingEnemyCount: number;
    })
  | (CampaignBattleLogBase & {
      kind: "player-action";
      action: CampaignPlayerActionKind;
      actorId: string;
      actorName: string;
      detail: string;
    })
  | (CampaignBattleLogBase & {
      kind: "player-attack";
      attackerId: string;
      attackerName: string;
      defenderId: string;
      defenderName: string;
      defenderRemainingHp: number;
      experienceAwarded: number;
      strikes: CampaignBattleStrikeRecord[];
    })
  | (CampaignBattleLogBase & {
      kind: "enemy-action";
      enemyId: string;
      enemyName: string;
      actionKind: "attacked" | "moved-and-attacked" | "moved" | "waited";
      targetId?: string;
      targetName?: string;
      destination?: Position;
      strikes: CampaignBattleStrikeRecord[];
    });

export const MAX_CAMPAIGN_BATTLE_LOG_ENTRIES = 5000 as const;
export const SAVE_VERSION = 10 as const;

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
  /** Selected dialogue options for the current chapter, keyed by source event ID. */
  mapEventChoices: MapEventChoiceSelection[];
  /** One-time named choices retained by the whole campaign across chapter transitions. */
  campaignChoices: CampaignChoiceSelection[];
  /** Confirmed battle actions and actual strike outcomes, retained across chapters. */
  campaignBattleLog: CampaignBattleLogEntry[];
}
