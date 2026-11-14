import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { CampaignChoiceHistoryEntry } from "../application/get-campaign-choice-history";
import { CampaignChoiceHistoryPanel } from "./campaign-choice-history-panel";

const entries: CampaignChoiceHistoryEntry[] = [{
  key: "campaign.route",
  choiceId: "forest",
  chapterId: "chapter_01_map",
  chapterNumber: 1,
  chapterTitle: "第1章・試作マップ",
  sourceEventId: "route-choice",
  speaker: "案内人",
  prompt: "どちらの道へ進みますか？",
  selectedLabel: "森の道"
}];

describe("CampaignChoiceHistoryPanel", () => {
  it("renders chapter, prompt, and the selected choice as a read-only history", () => {
    const html = renderToStaticMarkup(createElement(CampaignChoiceHistoryPanel, {
      entries,
      onClose: vi.fn()
    }));

    expect(html).toContain("キャンペーン選択履歴");
    expect(html).toContain("第1章 · 第1章・試作マップ");
    expect(html).toContain("どちらの道へ進みますか？");
    expect(html).toContain("選択: 森の道");
    expect(html).toContain('data-choice-key="campaign.route"');
  });

  it("renders an ID-only fallback without fabricating removed content", () => {
    const html = renderToStaticMarkup(createElement(CampaignChoiceHistoryPanel, {
      entries: [{
        ...entries[0]!,
        chapterNumber: null,
        chapterTitle: "removed_chapter",
        speaker: null,
        prompt: null,
        selectedLabel: null,
        choiceId: "old-option",
        sourceEventId: "old-event"
      }],
      onClose: vi.fn()
    }));

    expect(html).toContain("選択肢ID old-option");
    expect(html).toContain("元イベントID: old-event");
    expect(html).not.toContain("森の道");
  });

  it("handles an empty history", () => {
    const html = renderToStaticMarkup(createElement(CampaignChoiceHistoryPanel, {
      entries: [],
      onClose: vi.fn()
    }));
    expect(html).toContain("0件");
    expect(html).not.toContain("campaign-choice-history-entry");
  });
});
