import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CampaignBattleHistoryEntry } from "../application/get-campaign-battle-history";
import { CampaignBattleHistoryPanel } from "./campaign-battle-history-panel";

const entries: CampaignBattleHistoryEntry[] = [{
  sequence: 1,
  chapterId: "chapter_01_map",
  chapterNumber: 1,
  chapterTitle: "第1章・試作マップ",
  turn: 2,
  kind: "player-attack",
  attackerId: "unit_001",
  attackerName: "主人公",
  defenderId: "enemy_001",
  defenderName: "敵01",
  defenderRemainingHp: 0,
  experienceAwarded: 30,
  strikes: [{
    actorId: "unit_001",
    actorName: "主人公",
    targetId: "enemy_001",
    targetName: "敵01",
    kind: "initial",
    weaponName: "試作の鉄の剣",
    outcome: "critical",
    damage: 20,
    targetHpBefore: 20,
    targetHpAfter: 0
  }]
}];

describe("CampaignBattleHistoryPanel", () => {
  it("shows actual outcomes and derives killer counts from lethal strikes", () => {
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries,
      unitRecords: [],
      onClose: vi.fn()
    }));
    expect(html).toContain("キャンペーン戦闘記録");
    expect(html).toContain("第1章 · 第1章・試作マップ");
    expect(html).toContain("第2ターン");
    expect(html).toContain("主人公 → 敵01");
    expect(html).toContain("撃破");
    expect(html).toContain("1体撃破");
    expect(html).toContain("20ダメージ");
    expect(html).toContain("最大5,000件");
    expect(html).toContain('aria-label="章で絞り込み"');
    expect(html).toContain('aria-label="記録種別で絞り込み"');
    expect(html).toContain('aria-label="味方ユニットで絞り込み"');
    expect(html).toContain("すべての味方");
    expect(html).toContain("主人公（unit_001）");
    expect(html).toContain('aria-label="履歴内を検索"');
    expect(html).toContain("すべての章");
    expect(html).toContain("味方の行動・攻撃");
    expect(html).toContain("1 / 1件を表示");
    expect(html).toContain("撃破者別記録（絞り込み結果全体）");
    expect(html).toContain("時系列ログ");
    expect(html).toContain("味方別累計");
    expect(html).toContain('aria-label="絞り込み結果をCSV出力"');
    expect(html).toContain('aria-label="保持ログ全件をCSV出力"');
    expect(html).toContain("画面の絞り込みに関係なく保存中の最大5,000件");
    expect(html).toContain("保持件数: 1 / 5,000件");
    expect(html).toContain("連番範囲: 1–1");
    expect(html).toContain("先頭より前の未保持連番: 0件");
    expect(html).toContain("保持範囲内の連番欠番: 0件");
  });

  it("renders only the first 50 chronological entries when the filtered timeline spans multiple pages", () => {
    const manyEntries: CampaignBattleHistoryEntry[] = Array.from({ length: 51 }, (_, index) => ({
      ...entries[0]!,
      sequence: index + 1
    }));
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: manyEntries,
      unitRecords: [],
      onClose: vi.fn()
    }));
    const renderedEntries = html.match(/data-testid="campaign-battle-log-entry"/g) ?? [];

    expect(renderedEntries).toHaveLength(50);
    expect(html).toContain('data-sequence="1"');
    expect(html).toContain('data-sequence="50"');
    expect(html).not.toContain('data-sequence="51"');
    expect(html).toContain("1–50 / 51件を表示");
    expect(html).toContain("ページ 1 / 2");
    expect(html).toContain('aria-label="時系列ログのページ送り"');
    expect(html).toContain('aria-label="次のページ"');
    expect(html).toContain("撃破者別記録（絞り込み結果全体）");
  });

  it("reports sequence gaps in the retained range without reconstructing missing actions", () => {
    const entriesWithGaps: CampaignBattleHistoryEntry[] = [
      { ...entries[0]!, sequence: 10 },
      { ...entries[0]!, sequence: 12 },
      { ...entries[0]!, sequence: 15 }
    ];
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: entriesWithGaps,
      unitRecords: [],
      onClose: vi.fn()
    }));

    expect(html).toContain("連番範囲: 10–15");
    expect(html).toContain("先頭より前の未保持連番: 9件");
    expect(html).toContain("保持範囲内の連番欠番: 3件");
    expect(html).toContain("この集計だけでは、その理由や行動内容を判断できません。");
    expect(html).toContain("欠けた行動内容は推測で補いません。");
  });

  it("warns carefully when the retained timeline reaches its storage cap", () => {
    const cappedEntries: CampaignBattleHistoryEntry[] = Array.from({ length: 5000 }, (_, index) => ({
      ...entries[0]!,
      sequence: index + 101
    }));
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: cappedEntries,
      unitRecords: [],
      onClose: vi.fn()
    }));

    expect(html).toContain("保持件数: 5,000 / 5,000件");
    expect(html).toContain("先頭より前の未保持連番: 100件");
    expect(html).toContain("保存上限の5,000件を保持しています。");
    expect(html).toContain("上限到達だけでは過去記録が削除済みとは断定できません。");
  });

  it("renders an empty defeat summary", () => {
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: [],
      unitRecords: [],
      onClose: vi.fn()
    }));
    expect(html).toContain("0 / 0件を表示");
    expect(html).toContain("絞り込み結果に確定した撃破はありません。");
    expect(html).toContain("条件に一致する戦闘記録はありません。");
    expect(html).toContain("絞り込みを解除");
  });

  it("renders chapter victory and defeat results in the persistent timeline", () => {
    const resultEntries: CampaignBattleHistoryEntry[] = [
      {
        sequence: 2,
        chapterId: "chapter_01_map",
        chapterNumber: 1,
        chapterTitle: "第1章・試作マップ",
        turn: 8,
        kind: "chapter-result",
        outcome: "victory",
        objective: "defeat_boss",
        reason: "objective-cleared",
        livingPlayerCount: 3,
        livingEnemyCount: 0
      },
      {
        sequence: 3,
        chapterId: "chapter_02_map",
        chapterNumber: 2,
        chapterTitle: "第2章・試作マップ",
        turn: 5,
        kind: "chapter-result",
        outcome: "defeat",
        objective: "defeat_all",
        reason: "protected-unit-defeated",
        livingPlayerCount: 2,
        livingEnemyCount: 4
      }
    ];
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: resultEntries,
      unitRecords: [],
      onClose: vi.fn()
    }));
    expect(html).toContain("ステージクリア");
    expect(html).toContain("敵将撃破目標");
    expect(html).toContain("生存味方 3名");
    expect(html).toContain("保護対象の敗北");
    expect(html).toContain("生存敵 4体");
  });

});
