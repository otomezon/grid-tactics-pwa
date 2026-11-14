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
  });

  it("renders an empty defeat summary", () => {
    const html = renderToStaticMarkup(createElement(CampaignBattleHistoryPanel, {
      entries: [],
      onClose: vi.fn()
    }));
    expect(html).toContain("0件");
    expect(html).toContain("確定した撃破記録はまだありません。");
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
      onClose: vi.fn()
    }));
    expect(html).toContain("ステージクリア");
    expect(html).toContain("敵将撃破目標");
    expect(html).toContain("生存味方 3名");
    expect(html).toContain("保護対象の敗北");
    expect(html).toContain("生存敵 4体");
  });

});
