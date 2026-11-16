import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";

export interface CampaignIncomingStrikeSummary {
  unitId: string;
  unitName: string;
  receivedStrikes: number;
  hitsReceived: number;
  missesAvoided: number;
  criticalHitsReceived: number;
  damageReceived: number;
  attackerCount: number;
  lastSequence: number;
}

/**
 * Summarizes only recorded opponent strikes against allied units.
 * Enemy-phase events contribute strikes by the acting enemy; player-attack
 * events contribute only the defender's recorded counterstrike against the ally.
 */
export function getCampaignIncomingStrikeSummary(
  entries: readonly CampaignBattleHistoryEntry[]
): CampaignIncomingStrikeSummary[] {
  const byTarget = new Map<string, {
    unitId: string;
    unitName: string;
    receivedStrikes: number;
    hitsReceived: number;
    missesAvoided: number;
    criticalHitsReceived: number;
    damageReceived: number;
    attackerIds: Set<string>;
    lastSequence: number;
  }>();

  for (const entry of entries) {
    const incomingStrikes = entry.kind === "enemy-action"
      ? entry.strikes.filter((strike) => strike.actorId === entry.enemyId)
      : entry.kind === "player-attack"
        ? entry.strikes.filter((strike) =>
          strike.actorId === entry.defenderId && strike.targetId === entry.attackerId
        )
        : [];

    for (const strike of incomingStrikes) {
      const summary = byTarget.get(strike.targetId) ?? {
        unitId: strike.targetId,
        unitName: strike.targetName,
        receivedStrikes: 0,
        hitsReceived: 0,
        missesAvoided: 0,
        criticalHitsReceived: 0,
        damageReceived: 0,
        attackerIds: new Set<string>(),
        lastSequence: entry.sequence
      };

      summary.receivedStrikes += 1;
      if (strike.outcome === "miss") summary.missesAvoided += 1;
      else summary.hitsReceived += 1;
      if (strike.outcome === "critical") summary.criticalHitsReceived += 1;
      summary.damageReceived += strike.damage;
      summary.attackerIds.add(strike.actorId);
      summary.lastSequence = Math.max(summary.lastSequence, entry.sequence);
      byTarget.set(strike.targetId, summary);
    }
  }

  return [...byTarget.values()]
    .map(({ attackerIds, ...summary }) => ({
      ...summary,
      attackerCount: attackerIds.size
    }))
    .sort((left, right) =>
      right.damageReceived - left.damageReceived
      || right.hitsReceived - left.hitsReceived
      || right.receivedStrikes - left.receivedStrikes
      || left.unitName.localeCompare(right.unitName)
      || left.unitId.localeCompare(right.unitId)
    );
}
