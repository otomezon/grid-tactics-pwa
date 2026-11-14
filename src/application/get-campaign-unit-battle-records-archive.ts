import type { CampaignUnitBattleRecord } from "../domain/models/game";

export type CampaignUnitBattleRecordSort =
  | "damageDealt"
  | "enemiesDefeated"
  | "experienceAwarded"
  | "attacks"
  | "unitName";

/**
 * Builds a searchable and sortable view of persisted per-ally campaign totals.
 * The input array and records are never mutated.
 */
export function getCampaignUnitBattleRecordsArchive(
  records: readonly CampaignUnitBattleRecord[],
  query: string,
  sortBy: CampaignUnitBattleRecordSort
): CampaignUnitBattleRecord[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return records
    .filter((record) => normalizedQuery.length === 0
      || record.unitName.toLocaleLowerCase().includes(normalizedQuery))
    .sort((left, right) => {
      if (sortBy === "unitName") {
        return left.unitName.localeCompare(right.unitName) || left.unitId.localeCompare(right.unitId);
      }
      const difference = right[sortBy] - left[sortBy];
      return difference || left.unitName.localeCompare(right.unitName) || left.unitId.localeCompare(right.unitId);
    });
}
