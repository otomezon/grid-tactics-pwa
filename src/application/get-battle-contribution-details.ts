import type { UnitStats } from "../domain/models/game";
import type { PlayerAttackReport } from "./get-player-attack-report";

export interface BattleContributionEntry {
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

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp",
  "strength",
  "magic",
  "skill",
  "speed",
  "luck",
  "defense",
  "resistance"
];

function createZeroStatGains(): UnitStats {
  return {
    hp: 0,
    strength: 0,
    magic: 0,
    skill: 0,
    speed: 0,
    luck: 0,
    defense: 0,
    resistance: 0
  };
}

/**
 * Aggregates only actual strikes made by the player who initiated each attack.
 * Counterattacks belong to the defending enemy and are excluded from ally damage.
 */
export function getBattleContributionDetails(
  reports: readonly PlayerAttackReport[]
): BattleContributionEntry[] {
  const byUnitId = new Map<string, BattleContributionEntry>();

  for (const report of reports) {
    let entry = byUnitId.get(report.attackerId);
    if (!entry) {
      entry = {
        unitId: report.attackerId,
        unitName: report.attackerName,
        attacks: 0,
        strikes: 0,
        hits: 0,
        misses: 0,
        criticalHits: 0,
        damageDealt: 0,
        enemiesDefeated: 0,
        experienceAwarded: 0,
        levelUps: 0,
        statGains: createZeroStatGains()
      };
      byUnitId.set(report.attackerId, entry);
    }

    entry.attacks += 1;
    entry.enemiesDefeated += report.defenderDefeated ? 1 : 0;
    entry.experienceAwarded += report.experienceAwarded;
    entry.levelUps += report.levelUps.length;

    for (const levelUp of report.levelUps) {
      for (const key of STAT_KEYS) {
        entry.statGains[key] += levelUp.gains[key] ?? 0;
      }
    }

    for (const strike of report.strikes) {
      if (strike.actorId !== report.attackerId) continue;

      entry.strikes += 1;
      if (strike.outcome === "miss") {
        entry.misses += 1;
        continue;
      }

      entry.hits += 1;
      entry.damageDealt += strike.damage;
      if (strike.outcome === "critical") entry.criticalHits += 1;
    }
  }

  return [...byUnitId.values()].sort((left, right) =>
    left.unitId < right.unitId ? -1 : left.unitId > right.unitId ? 1 : 0
  );
}
