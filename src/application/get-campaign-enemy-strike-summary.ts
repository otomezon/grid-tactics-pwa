import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";

export interface CampaignEnemyStrikeSummary {
  chapterId: string;
  chapterNumber: number | null;
  chapterTitle: string;
  enemyId: string;
  enemyName: string;
  attackStrikes: number;
  hits: number;
  misses: number;
  criticalHits: number;
  damageDealt: number;
  targetCount: number;
  alliesDefeated: number;
  lastSequence: number;
}

/**
 * Summarizes only actual strikes made by enemies in the retained campaign log.
 * Enemy-phase attacks and enemy counterstrikes are included; allied opening
 * strikes and follow-ups, forecasts, and missing historical actions are not.
 * Enemy IDs are scoped to a chapter so reused IDs are never merged.
 */
export function getCampaignEnemyStrikeSummary(
  entries: readonly CampaignBattleHistoryEntry[]
): CampaignEnemyStrikeSummary[] {
  const byChapterAndEnemy = new Map<string, {
    chapterId: string;
    chapterNumber: number | null;
    chapterTitle: string;
    enemyId: string;
    enemyName: string;
    attackStrikes: number;
    hits: number;
    misses: number;
    criticalHits: number;
    damageDealt: number;
    targetIds: Set<string>;
    alliesDefeated: number;
    lastSequence: number;
  }>();

  for (const entry of entries) {
    const enemyStrikes = entry.kind === "enemy-action"
      ? entry.strikes.filter((strike) => strike.actorId === entry.enemyId)
      : entry.kind === "player-attack"
        ? entry.strikes.filter((strike) =>
          strike.actorId === entry.defenderId && strike.targetId === entry.attackerId
        )
        : [];

    for (const strike of enemyStrikes) {
      const key = `${entry.chapterId}\u0000${strike.actorId}`;
      const summary = byChapterAndEnemy.get(key) ?? {
        chapterId: entry.chapterId,
        chapterNumber: entry.chapterNumber,
        chapterTitle: entry.chapterTitle,
        enemyId: strike.actorId,
        enemyName: strike.actorName,
        attackStrikes: 0,
        hits: 0,
        misses: 0,
        criticalHits: 0,
        damageDealt: 0,
        targetIds: new Set<string>(),
        alliesDefeated: 0,
        lastSequence: entry.sequence
      };

      summary.attackStrikes += 1;
      if (strike.outcome === "miss") summary.misses += 1;
      else summary.hits += 1;
      if (strike.outcome === "critical") summary.criticalHits += 1;
      summary.damageDealt += strike.damage;
      summary.targetIds.add(strike.targetId);
      if (strike.targetHpBefore > 0 && strike.targetHpAfter === 0) summary.alliesDefeated += 1;
      summary.lastSequence = Math.max(summary.lastSequence, entry.sequence);
      byChapterAndEnemy.set(key, summary);
    }
  }

  return [...byChapterAndEnemy.values()]
    .map(({ targetIds, ...summary }) => ({
      ...summary,
      targetCount: targetIds.size
    }))
    .sort((left, right) =>
      right.damageDealt - left.damageDealt
      || right.hits - left.hits
      || right.attackStrikes - left.attackStrikes
      || (left.chapterNumber ?? Number.MAX_SAFE_INTEGER) - (right.chapterNumber ?? Number.MAX_SAFE_INTEGER)
      || left.chapterTitle.localeCompare(right.chapterTitle)
      || left.enemyName.localeCompare(right.enemyName)
      || left.enemyId.localeCompare(right.enemyId)
      || left.chapterId.localeCompare(right.chapterId)
    );
}
