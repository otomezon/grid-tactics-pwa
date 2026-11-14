import { describe, expect, it } from "vitest";
import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import { buildCampaignBattleHistoryCsv, buildCampaignUnitBattleRecordsCsv } from "./export-campaign-archive-csv";

const chapter = { chapterId: "chapter_01_map", chapterNumber: 1, chapterTitle: "第1章・試作マップ", turn: 3 } as const;

describe("buildCampaignBattleHistoryCsv", () => {
  it("exports actual strikes on separate rows alongside player actions and chapter results", () => {
    const entries: CampaignBattleHistoryEntry[] = [
      {
        ...chapter, sequence: 4, kind: "player-attack", attackerId: "unit_001", attackerName: "主人公",
        defenderId: "enemy_001", defenderName: "敵01", defenderRemainingHp: 0, experienceAwarded: 30,
        strikes: [
          { actorId: "unit_001", actorName: "主人公", targetId: "enemy_001", targetName: "敵01", kind: "initial", weaponName: "鉄の剣", outcome: "critical", damage: 20, targetHpBefore: 20, targetHpAfter: 0 },
          { actorId: "enemy_001", actorName: "敵01", targetId: "unit_001", targetName: "主人公", kind: "counter", weaponName: "鉄の斧", outcome: "miss", damage: 0, targetHpBefore: 18, targetHpAfter: 18 }
        ]
      },
      { ...chapter, sequence: 5, kind: "player-action", action: "map-interaction", actorId: "unit_002", actorName: "斥候", detail: "宝箱を調べた" },
      { ...chapter, sequence: 6, kind: "chapter-result", outcome: "victory", objective: "defeat_boss", reason: "objective-cleared", livingPlayerCount: 3, livingEnemyCount: 0 }
    ];
    const csv = buildCampaignBattleHistoryCsv(entries);
    const dataRows = csv.slice(1).split("\r\n").filter(Boolean);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"strike番号"');
    expect(csv).toContain('"必殺"');
    expect(csv).toContain('"反撃"');
    expect(csv).toContain('"宝箱を調べた"');
    expect(csv).toContain('"勝利"');
    expect(csv).toContain('"敵将撃破"');
    expect(dataRows).toHaveLength(5);
    expect(csv).not.toContain("命中率");
    expect(csv).not.toContain("AI");
  });

  it("quotes comma, quote, and newline characters and neutralizes formula-like strings", () => {
    const entry: CampaignBattleHistoryEntry = {
      ...chapter, sequence: 1, kind: "player-action", action: "wait", actorId: "unit_001",
      actorName: '=HYPERLINK("https://example.invalid","name")', detail: 'line 1\nline, "two"'
    };
    const csv = buildCampaignBattleHistoryCsv([entry]);
    expect(csv).toContain('\'=HYPERLINK(""https://example.invalid"",""name"")');
    expect(csv).toContain('"line 1\nline, ""two"""');
  });

  it("returns a header-only CSV for an empty timeline", () => {
    const csv = buildCampaignBattleHistoryCsv([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"連番"');
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(1);
  });
});

describe("buildCampaignUnitBattleRecordsCsv", () => {
  const record: CampaignUnitBattleRecord = {
    unitId: "unit_001", unitName: "主人公", attacks: 4, strikes: 6, hits: 5, misses: 1,
    criticalHits: 1, damageDealt: 28, enemiesDefeated: 2, experienceAwarded: 70, levelUps: 1,
    statGains: { hp: 1, strength: 2, magic: 0, skill: 1, speed: 0, luck: 0, defense: 0, resistance: 0 }
  };

  it("exports all cumulative metrics and preserves the given order", () => {
    const second = { ...record, unitId: "unit_002", unitName: "斥候", damageDealt: 40 };
    const csv = buildCampaignUnitBattleRecordsCsv([second, record]);
    const rows = csv.slice(1).split("\r\n").filter(Boolean);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('"斥候"');
    expect(rows[1]).toContain('"40"');
    expect(rows[2]).toContain('"主人公"');
    expect(rows[2]).toContain('"28"');
    expect(csv).toContain('"HP上昇"');
    expect(csv).toContain('"魔防上昇"');
    expect(csv).toContain('"70"');
  });

  it("does not mutate source records", () => {
    const source = [{ ...record, statGains: { ...record.statGains } }];
    const before = JSON.stringify(source);
    buildCampaignUnitBattleRecordsCsv(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});
