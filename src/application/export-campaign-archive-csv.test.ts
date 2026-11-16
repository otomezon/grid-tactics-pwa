import { describe, expect, it } from "vitest";
import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import { buildCampaignBattleHistoryCsv, buildCampaignEnemyStrikeSummaryCsv, buildCampaignIncomingStrikeSummaryCsv, buildCampaignUnitBattleRecordsCsv } from "./export-campaign-archive-csv";
import { getCampaignBattleLogCoverage } from "./get-campaign-battle-history";
import type { CampaignIncomingStrikeSummary } from "./get-campaign-incoming-strike-summary";
import type { CampaignEnemyStrikeSummary } from "./get-campaign-enemy-strike-summary";

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

  it("records export scope and full retained-log coverage, not filtered coverage", () => {
    const retained: CampaignBattleHistoryEntry[] = [
      { ...chapter, sequence: 10, kind: "player-action", action: "wait", actorId: "unit_001", actorName: "主人公", detail: "待機" },
      { ...chapter, sequence: 12, kind: "player-action", action: "wait", actorId: "unit_002", actorName: "味方02", detail: "待機" },
      { ...chapter, sequence: 15, kind: "player-action", action: "wait", actorId: "unit_003", actorName: "味方03", detail: "待機" }
    ];
    const context = { scope: "filtered" as const, retainedEntries: retained, filters: { chapterId: "chapter_01_map", category: "player" as const, unitId: "all", query: "主人公" } };
    const filteredCsv = buildCampaignBattleHistoryCsv([retained[0]!], context);
    expect(filteredCsv).toContain('"出力範囲"');
    expect(filteredCsv).toContain('"出力記録件数"');
    expect(filteredCsv).toContain('"絞り込み結果","1","3","5000","10","15","9","3","いいえ","chapter_01_map","player","all","主人公"');
    const allCsv = buildCampaignBattleHistoryCsv(retained, { ...context, scope: "all-retained" });
    expect(allCsv).toContain('"保持ログ全件","3","3","5000","10","15","9","3","いいえ","chapter_01_map","player","all","主人公"');
    expect(allCsv).toContain('"味方02"');
    expect(allCsv).toContain('"味方03"');
  });

  it("retains export metadata for an empty filtered result", () => {
    const retained: CampaignBattleHistoryEntry[] = [{ ...chapter, sequence: 1, kind: "player-action", action: "wait", actorId: "unit_001", actorName: "主人公", detail: "待機" }];
    const csv = buildCampaignBattleHistoryCsv([], { scope: "filtered", retainedEntries: retained, filters: { chapterId: "all", category: "all", unitId: "all", query: "一致なし" } });
    expect(csv).toContain('"エクスポート情報"');
    expect(csv).toContain('"絞り込み結果","0","1","5000","1","1","0","0","いいえ","all","all","all","一致なし"');
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

  it("exports either the searched subset or every ally and records the active sort", () => {
    const second = { ...record, unitId: "unit_002", unitName: "斥候", damageDealt: 40 };
    const filtered = buildCampaignUnitBattleRecordsCsv([record], {
      scope: "filtered",
      totalRecordCount: 2,
      query: "主人公",
      sortBy: "enemiesDefeated"
    });
    expect(filtered).toContain('"検索結果","1","2","主人公","撃破数順"');
    expect(filtered).toContain('"CSV行種別"');
    expect(filtered).toContain('"味方累計"');
    expect(filtered).not.toContain('"斥候"');
    const all = buildCampaignUnitBattleRecordsCsv([second, record], {
      scope: "all-records",
      totalRecordCount: 2,
      query: "主人公",
      sortBy: "enemiesDefeated"
    });
    expect(all).toContain('"累計全員","2","2","主人公","撃破数順"');
    expect(all).toContain('"斥候"');
    expect(all).toContain('"主人公"');
  });

  it("retains export metadata when a name search returns no records", () => {
    const csv = buildCampaignUnitBattleRecordsCsv([], {
      scope: "filtered",
      totalRecordCount: 1,
      query: "一致なし",
      sortBy: "damageDealt"
    });
    expect(csv).toContain('"エクスポート情報"');
    expect(csv).toContain('"検索結果","0","1","一致なし","与ダメージ順"');
  });

  it("does not mutate source records", () => {
    const source = [{ ...record, statGains: { ...record.statGains } }];
    const before = JSON.stringify(source);
    buildCampaignUnitBattleRecordsCsv(source);
    expect(JSON.stringify(source)).toBe(before);
  });
});


describe("buildCampaignIncomingStrikeSummaryCsv", () => {
  const summaries: CampaignIncomingStrikeSummary[] = [{
    unitId: "unit_001", unitName: "=主人公", receivedStrikes: 3,
    hitsReceived: 2, missesAvoided: 1, criticalHitsReceived: 1,
    damageReceived: 11, attackerCount: 2, lastSequence: 12
  }];

  it("exports retained-log coverage and formula-safe incoming-strike metrics", () => {
    const coverage = getCampaignBattleLogCoverage([{ sequence: 10 }, { sequence: 12 }]);
    const csv = buildCampaignIncomingStrikeSummaryCsv(summaries, coverage);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"被攻撃strike数"');
    expect(csv).toContain("'=主人公");
    expect(csv).toContain('"被攻撃集計","unit_001"');
    expect(csv).toContain('"3","2","1","1","11","2","12","2","5000","10","12","9","1","いいえ"');
  });

  it("keeps coverage metadata for an empty summary", () => {
    const coverage = getCampaignBattleLogCoverage([{ sequence: 1 }]);
    const csv = buildCampaignIncomingStrikeSummaryCsv([], coverage);
    expect(csv).toContain('"エクスポート情報"');
    expect(csv).toContain('"1","5000","1","1","0","0","いいえ"');
  });
});


describe("buildCampaignEnemyStrikeSummaryCsv", () => {
  const summaries: CampaignEnemyStrikeSummary[] = [{
    chapterId: "chapter_01_map", chapterNumber: 1, chapterTitle: "第1章・試作マップ",
    enemyId: "enemy_001", enemyName: "=敵01", attackStrikes: 3, hits: 2, misses: 1,
    criticalHits: 1, damageDealt: 11, targetCount: 2, alliesDefeated: 1, lastSequence: 12
  }];

  it("exports chapter-scoped enemy metrics, coverage, and formula-safe text", () => {
    const coverage = getCampaignBattleLogCoverage([{ sequence: 10 }, { sequence: 12 }]);
    const csv = buildCampaignEnemyStrikeSummaryCsv(summaries, coverage);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"章ID"');
    expect(csv).toContain('"攻撃strike数"');
    expect(csv).toContain("'=敵01");
    expect(csv).toContain('"敵攻撃集計","chapter_01_map","1","第1章・試作マップ","enemy_001"');
    expect(csv).toContain('"3","2","1","1","11","2","1","12","2","5000","10","12","9","1","いいえ"');
  });

  it("keeps retained-log coverage metadata when there are no enemy attacks", () => {
    const coverage = getCampaignBattleLogCoverage([{ sequence: 1 }]);
    const csv = buildCampaignEnemyStrikeSummaryCsv([], coverage);
    expect(csv).toContain('"エクスポート情報"');
    expect(csv).toContain('"1","5000","1","1","0","0","いいえ"');
  });
});
