import { WEAPONS_BY_ID } from "../content/weapons";
import {
  MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
  type CampaignBattleLogEntry,
  type CampaignBattleStrikeRecord,
  type GameStateSnapshot,
  type GameUnit
} from "../domain/models/game";
import type { EnemyActionLog } from "./resolve-enemy-phase";
import type { PlayerAttackReport } from "./get-player-attack-report";

type CampaignBattleLogEntryDraft =
  CampaignBattleLogEntry extends infer Entry
    ? Entry extends { sequence: number; chapterId: string; turn: number }
      ? Omit<Entry, "sequence" | "chapterId" | "turn">
      : never
    : never;

function toCampaignStrike(
  strike: PlayerAttackReport["strikes"][number]
): CampaignBattleStrikeRecord {
  return {
    actorId: strike.actorId,
    actorName: strike.actorName,
    targetId: strike.targetId,
    targetName: strike.targetName,
    kind: strike.kind,
    weaponName: strike.weaponName,
    outcome: strike.outcome,
    damage: strike.damage,
    targetHpBefore: strike.targetHpBefore,
    targetHpAfter: strike.targetHpAfter
  };
}

/** Converts a committed player attack report to facts suitable for durable storage. */
export function createPlayerAttackBattleLogEntry(
  report: PlayerAttackReport
): CampaignBattleLogEntryDraft {
  return {
    kind: "player-attack",
    attackerId: report.attackerId,
    attackerName: report.attackerName,
    defenderId: report.defenderId,
    defenderName: report.defenderName,
    defenderRemainingHp: report.defenderRemainingHp,
    experienceAwarded: report.experienceAwarded,
    strikes: report.strikes.map(toCampaignStrike)
  };
}

/**
 * Keeps only the resolved enemy action and actual combat events. AI scores,
 * candidate evaluations, forecasts, and explanatory prediction text are omitted.
 */
export function createEnemyBattleLogEntries(
  actions: readonly EnemyActionLog[],
  sourceUnits: readonly GameUnit[]
): CampaignBattleLogEntryDraft[] {
  return actions.map((action) => ({
    kind: "enemy-action",
    enemyId: action.enemyId,
    enemyName: action.enemyName,
    actionKind: action.kind,
    ...(action.targetId ? { targetId: action.targetId } : {}),
    ...(action.targetName ? { targetName: action.targetName } : {}),
    ...(action.destination ? { destination: { ...action.destination } } : {}),
    strikes: (action.attackEvents ?? []).map((event): CampaignBattleStrikeRecord => ({
      actorId: event.attackerId,
      actorName: sourceUnits.find((unit) => unit.id === event.attackerId)?.name ?? event.attackerId,
      targetId: event.defenderId,
      targetName: sourceUnits.find((unit) => unit.id === event.defenderId)?.name ?? event.defenderId,
      kind: event.kind,
      weaponName: WEAPONS_BY_ID[event.weaponId]?.name ?? event.weaponId,
      outcome: !event.hit ? "miss" : event.critical ? "critical" : "hit",
      damage: event.damage,
      targetHpBefore: event.defenderHpBefore,
      targetHpAfter: event.defenderHpAfter
    }))
  }));
}

/** Appends confirmed entries in a global campaign order and bounds retained history. */
export function appendCampaignBattleLogEntries(
  state: GameStateSnapshot,
  entries: readonly CampaignBattleLogEntryDraft[],
  chapterId: string = state.chapterId,
  turn: number = state.turn
): GameStateSnapshot {
  if (entries.length === 0) return state;
  let sequence = state.campaignBattleLog.length > 0
    ? state.campaignBattleLog[state.campaignBattleLog.length - 1]!.sequence
    : 0;
  const appended = entries.map((entry) => ({
    ...entry,
    sequence: ++sequence,
    chapterId,
    turn
  })) as CampaignBattleLogEntry[];

  return {
    ...state,
    campaignBattleLog: [...state.campaignBattleLog, ...appended].slice(-MAX_CAMPAIGN_BATTLE_LOG_ENTRIES)
  };
}
