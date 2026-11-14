import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../content/chapters";
import type { CampaignChoiceSelection } from "../domain/models/game";
import { getCampaignChoiceHistory } from "./get-campaign-choice-history";

describe("getCampaignChoiceHistory", () => {
  it("reconstructs the selected option from its source chapter and preserves ledger order", () => {
    const firstChapter = {
      ...CHAPTERS[0]!,
      map: {
        ...CHAPTERS[0]!.map,
        events: [{
          id: "route-choice",
          trigger: { type: "stage-start" as const },
          action: {
            type: "show-choice" as const,
            campaignChoiceKey: "campaign.route",
            speaker: "案内人",
            text: "どちらの道へ進みますか？",
            choices: [
              { id: "forest", label: "森の道" },
              { id: "road", label: "街道" }
            ]
          }
        }]
      }
    };
    const secondChapter = {
      ...CHAPTERS[1]!,
      map: {
        ...CHAPTERS[1]!.map,
        events: [{
          id: "supply-choice",
          trigger: { type: "stage-start" as const },
          action: {
            type: "show-choice" as const,
            campaignChoiceKey: "campaign.supplies",
            text: "物資を選んでください。",
            choices: [
              { id: "medicine", label: "回復薬" },
              { id: "weapon", label: "武器" }
            ]
          }
        }]
      }
    };
    const selections: CampaignChoiceSelection[] = [
      {
        key: "campaign.route",
        choiceId: "forest",
        sourceChapterId: firstChapter.id,
        sourceEventId: "route-choice"
      },
      {
        key: "campaign.supplies",
        choiceId: "weapon",
        sourceChapterId: secondChapter.id,
        sourceEventId: "supply-choice"
      }
    ];

    expect(getCampaignChoiceHistory(selections, [firstChapter, secondChapter])).toEqual([
      {
        key: "campaign.route",
        choiceId: "forest",
        chapterId: firstChapter.id,
        chapterNumber: 1,
        chapterTitle: firstChapter.title,
        sourceEventId: "route-choice",
        speaker: "案内人",
        prompt: "どちらの道へ進みますか？",
        selectedLabel: "森の道"
      },
      {
        key: "campaign.supplies",
        choiceId: "weapon",
        chapterId: secondChapter.id,
        chapterNumber: 2,
        chapterTitle: secondChapter.title,
        sourceEventId: "supply-choice",
        speaker: null,
        prompt: "物資を選んでください。",
        selectedLabel: "武器"
      }
    ]);
    expect(selections).toHaveLength(2);
  });

  it("does not invent labels when historical chapter content is no longer registered", () => {
    const selections: CampaignChoiceSelection[] = [{
      key: "campaign.removed",
      choiceId: "option-old",
      sourceChapterId: "removed_chapter",
      sourceEventId: "removed_event"
    }];

    expect(getCampaignChoiceHistory(selections)).toEqual([{
      key: "campaign.removed",
      choiceId: "option-old",
      chapterId: "removed_chapter",
      chapterNumber: null,
      chapterTitle: "removed_chapter",
      sourceEventId: "removed_event",
      speaker: null,
      prompt: null,
      selectedLabel: null
    }]);
  });

  it("does not invent a choice label when the source event still exists but the option was removed", () => {
    const chapter = {
      ...CHAPTERS[0]!,
      map: {
        ...CHAPTERS[0]!.map,
        events: [{
          id: "route-choice",
          trigger: { type: "stage-start" as const },
          action: {
            type: "show-choice" as const,
            text: "どちらの道へ進みますか？",
            choices: [{ id: "road", label: "街道" }]
          }
        }]
      }
    };
    const selections: CampaignChoiceSelection[] = [{
      key: "campaign.route",
      choiceId: "removed-option",
      sourceChapterId: chapter.id,
      sourceEventId: "route-choice"
    }];

    expect(getCampaignChoiceHistory(selections, [chapter])[0]).toMatchObject({
      chapterTitle: chapter.title,
      prompt: "どちらの道へ進みますか？",
      selectedLabel: null,
      choiceId: "removed-option"
    });
  });
});
