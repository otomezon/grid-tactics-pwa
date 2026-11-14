import { describe, expect, it } from "vitest";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import { getCampaignUnitBattleRecordsArchive } from "./get-campaign-unit-battle-records-archive";

const record = (
  unitId: string,
  unitName: string,
  values: Partial<Pick<CampaignUnitBattleRecord,
    "attacks" | "damageDealt" | "enemiesDefeated" | "experienceAwarded"
  >>
): CampaignUnitBattleRecord => ({
  unitId,
  unitName,
  attacks: values.attacks ?? 0,
  strikes: 0,
  hits: 0,
  misses: 0,
  criticalHits: 0,
  damageDealt: values.damageDealt ?? 0,
  enemiesDefeated: values.enemiesDefeated ?? 0,
  experienceAwarded: values.experienceAwarded ?? 0,
  levelUps: 0,
  statGains: {
    hp: 0, strength: 0, magic: 0, skill: 0,
    speed: 0, luck: 0, defense: 0, resistance: 0
  }
});

const records = [
  record("unit_001", "主人公", { attacks: 4, damageDealt: 28, enemiesDefeated: 2, experienceAwarded: 70 }),
  record("unit_002", "剣士", { attacks: 3, damageDealt: 40, enemiesDefeated: 1, experienceAwarded: 45 }),
  record("unit_003", "斥候ミナ", { attacks: 2, damageDealt: 12, enemiesDefeated: 0, experienceAwarded: 30 })
];

describe("getCampaignUnitBattleRecordsArchive", () => {
  it("returns the whole campaign roster in a stable damage-descending order by default", () => {
    expect(getCampaignUnitBattleRecordsArchive(records, "", "damageDealt").map((item) => item.unitId))
      .toEqual(["unit_002", "unit_001", "unit_003"]);
  });

  it("supports sorting by confirmed defeats, experience, and attack count", () => {
    expect(getCampaignUnitBattleRecordsArchive(records, "", "enemiesDefeated").map((item) => item.unitId))
      .toEqual(["unit_001", "unit_002", "unit_003"]);
    expect(getCampaignUnitBattleRecordsArchive(records, "", "experienceAwarded").map((item) => item.unitId))
      .toEqual(["unit_001", "unit_002", "unit_003"]);
    expect(getCampaignUnitBattleRecordsArchive(records, "", "attacks").map((item) => item.unitId))
      .toEqual(["unit_001", "unit_002", "unit_003"]);
  });

  it("searches unit names without changing source order or source values", () => {
    const snapshot = structuredClone(records);
    expect(getCampaignUnitBattleRecordsArchive(records, "ミナ", "damageDealt").map((item) => item.unitId))
      .toEqual(["unit_003"]);
    expect(getCampaignUnitBattleRecordsArchive(records, "主人公", "unitName").map((item) => item.unitId))
      .toEqual(["unit_001"]);
    expect(records).toEqual(snapshot);
  });

  it("uses the unit name as a deterministic tie-breaker and handles no matches", () => {
    const tied = [
      record("unit_b", "味方B", { damageDealt: 10 }),
      record("unit_a", "味方A", { damageDealt: 10 })
    ];
    expect(getCampaignUnitBattleRecordsArchive(tied, "", "damageDealt").map((item) => item.unitId))
      .toEqual(["unit_a", "unit_b"]);
    expect(getCampaignUnitBattleRecordsArchive(records, "存在しない", "damageDealt")).toEqual([]);
  });
});
