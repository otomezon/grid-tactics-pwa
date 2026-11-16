import { describe, expect, it } from "vitest";
import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import { filterCampaignBattleHistory, getCampaignBattleHistoryUnitOptions } from "./filter-campaign-battle-history";

const entries: CampaignBattleHistoryEntry[] = [
  {
    sequence: 1, chapterId: "chapter_01_map", chapterNumber: 1,
    chapterTitle: "第1章・試作マップ", turn: 2, kind: "player-action",
    action: "item-use", actorId: "unit_001", actorName: "主人公",
    detail: "回復薬を使用 · HP +7"
  },
  {
    sequence: 2, chapterId: "chapter_01_map", chapterNumber: 1,
    chapterTitle: "第1章・試作マップ", turn: 3, kind: "player-attack",
    attackerId: "unit_001", attackerName: "主人公", defenderId: "enemy_001",
    defenderName: "敵兵", defenderRemainingHp: 0, experienceAwarded: 20,
    strikes: [{
      actorId: "unit_001", actorName: "主人公", targetId: "enemy_001",
      targetName: "敵兵", kind: "initial", weaponName: "鉄の剣",
      outcome: "critical", damage: 12, targetHpBefore: 12, targetHpAfter: 0
    }]
  },
  {
    sequence: 3, chapterId: "chapter_02_map", chapterNumber: 2,
    chapterTitle: "第2章・試作マップ", turn: 4, kind: "enemy-action",
    enemyId: "enemy_002", enemyName: "敵兵", actionKind: "moved-and-attacked",
    targetId: "unit_001", targetName: "主人公", destination: { x: 3, y: 4 },
    strikes: [{
      actorId: "enemy_002", actorName: "敵兵", targetId: "unit_001",
      targetName: "主人公", kind: "initial", weaponName: "鉄の弓",
      outcome: "hit", damage: 3, targetHpBefore: 20, targetHpAfter: 17
    }]
  },
  {
    sequence: 4, chapterId: "chapter_02_map", chapterNumber: 2,
    chapterTitle: "第2章・試作マップ", turn: 5, kind: "chapter-result",
    outcome: "victory", objective: "defeat_all", reason: "objective-cleared",
    livingPlayerCount: 4, livingEnemyCount: 0
  }
];

describe("filterCampaignBattleHistory", () => {
  it("returns all entries in chronological order when no filter is active", () => {
    const result = filterCampaignBattleHistory(entries, { chapterId: "all", category: "all", unitId: "all", query: "" });
    expect(result).toEqual(entries);
    expect(result.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4]);
  });

  it("filters by chapter without mixing entries", () => {
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "chapter_02_map", category: "all", unitId: "all", query: ""
    }).map((entry) => entry.sequence)).toEqual([3, 4]);
  });

  it("separates player, enemy, and chapter-result categories", () => {
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "player", unitId: "all", query: ""
    }).map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "enemy", unitId: "all", query: ""
    }).map((entry) => entry.sequence)).toEqual([3]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "result", unitId: "all", query: ""
    }).map((entry) => entry.sequence)).toEqual([4]);
  });

  it("searches action details and nested strike names, weapons, and targets", () => {
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "all", unitId: "all", query: "HP +7"
    }).map((entry) => entry.sequence)).toEqual([1]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "player", unitId: "all", query: "主人公 鉄の剣"
    }).map((entry) => entry.sequence)).toEqual([2]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "chapter_02_map", category: "enemy", unitId: "all", query: "敵兵 鉄の弓"
    }).map((entry) => entry.sequence)).toEqual([3]);
  });

  it("combines every active filter and returns no entries for unmatched terms", () => {
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "chapter_02_map", category: "enemy", unitId: "all", query: "主人公 鉄の弓"
    }).map((entry) => entry.sequence)).toEqual([3]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "chapter_02_map", category: "enemy", unitId: "all", query: "存在しない語"
    })).toEqual([]);
  });

  it("filters recorded ally actions, attacks, and enemy actions targeting that ally", () => {
    const filtered = filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "all", unitId: "unit_001", query: ""
    });
    expect(filtered.map((entry) => entry.sequence)).toEqual([1, 2, 3]);
    expect(filterCampaignBattleHistory(entries, {
      chapterId: "all", category: "all", unitId: "missing-unit", query: ""
    })).toEqual([]);
    expect(getCampaignBattleHistoryUnitOptions(entries)).toEqual([
      { unitId: "unit_001", unitName: "主人公" }
    ]);
  });

  it("does not mutate source entries", () => {
    const snapshot = structuredClone(entries);
    filterCampaignBattleHistory(entries, {
      chapterId: "chapter_01_map", category: "player", unitId: "all", query: "主人公"
    });
    expect(entries).toEqual(snapshot);
  });
});
