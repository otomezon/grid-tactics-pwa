import { MAX_CAMPAIGN_BATTLE_LOG_ENTRIES, type CampaignUnitBattleRecord, type GameStateSnapshot } from "../domain/models/game";

export interface PromotionPlaytestEvidence {
  /** campaignBattleLog was introduced in saveVersion 9. */
  campaignLogTrackingAvailable: boolean;
  /** campaignUnitBattleRecords was introduced in saveVersion 3. */
  unitBattleTotalsTrackingAvailable: boolean;
  campaignLogEntries: number;
  campaignLogRetentionLimit: number;
  campaignLogAtRetentionLimit: boolean;
  campaignLogFirstSequence: number | null;
  campaignLogLastSequence: number | null;
  campaignLogSequenceGapCount: number;
  campaignChapterCount: number;
  playerActionEntries: number;
  playerAttackEntries: number;
  enemyActionEntries: number;
  chapterResultEntries: number;
  selectedUnitActionEntries: number;
  selectedUnitAttackEntries: number;
  selectedUnitTargetedEnemyActionEntries: number;
  selectedUnitAttackStrikes: number;
  selectedUnitBattleTotals: Pick<
    CampaignUnitBattleRecord,
    "attacks" | "strikes" | "hits" | "damageDealt" | "enemiesDefeated" | "experienceAwarded"
  > | null;
}

/**
 * Summarizes only evidence already present in an imported campaign snapshot.
 * This is a record-coverage summary, not an authenticity or real-play detector.
 */
export function getPromotionPlaytestEvidence(
  snapshot: GameStateSnapshot,
  unitId: string,
  sourceSaveVersion: number
): PromotionPlaytestEvidence {
  const entries = snapshot.campaignBattleLog ?? [];
  let previousSequence = 0;
  let campaignLogSequenceGapCount = 0;
  for (const entry of entries) {
    campaignLogSequenceGapCount += Math.max(0, entry.sequence - previousSequence - 1);
    previousSequence = entry.sequence;
  }
  const playerActions = entries.filter((entry) => entry.kind === "player-action");
  const playerAttacks = entries.filter((entry) => entry.kind === "player-attack");
  const enemyActions = entries.filter((entry) => entry.kind === "enemy-action");
  const chapterResults = entries.filter((entry) => entry.kind === "chapter-result");
  const selectedUnitActions = playerActions.filter((entry) => entry.actorId === unitId);
  const selectedUnitAttacks = playerAttacks.filter((entry) => entry.attackerId === unitId);
  const selectedUnitTargetedActions = enemyActions.filter((entry) => entry.targetId === unitId);
  const selectedUnitRecord = (snapshot.campaignUnitBattleRecords ?? [])
    .find((record) => record.unitId === unitId);

  return {
    campaignLogTrackingAvailable: sourceSaveVersion >= 9,
    unitBattleTotalsTrackingAvailable: sourceSaveVersion >= 3,
    campaignLogEntries: entries.length,
    campaignLogRetentionLimit: MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
    campaignLogAtRetentionLimit: entries.length >= MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
    campaignLogFirstSequence: entries[0]?.sequence ?? null,
    campaignLogLastSequence: entries[entries.length - 1]?.sequence ?? null,
    campaignLogSequenceGapCount,
    campaignChapterCount: new Set(entries.map((entry) => entry.chapterId)).size,
    playerActionEntries: playerActions.length,
    playerAttackEntries: playerAttacks.length,
    enemyActionEntries: enemyActions.length,
    chapterResultEntries: chapterResults.length,
    selectedUnitActionEntries: selectedUnitActions.length,
    selectedUnitAttackEntries: selectedUnitAttacks.length,
    selectedUnitTargetedEnemyActionEntries: selectedUnitTargetedActions.length,
    selectedUnitAttackStrikes: selectedUnitAttacks.reduce(
      (total, entry) => total + entry.strikes.filter((strike) => strike.actorId === unitId).length,
      0
    ),
    selectedUnitBattleTotals: selectedUnitRecord
      ? {
          attacks: selectedUnitRecord.attacks,
          strikes: selectedUnitRecord.strikes,
          hits: selectedUnitRecord.hits,
          damageDealt: selectedUnitRecord.damageDealt,
          enemiesDefeated: selectedUnitRecord.enemiesDefeated,
          experienceAwarded: selectedUnitRecord.experienceAwarded
        }
      : null
  };
}
