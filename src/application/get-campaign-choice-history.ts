import { CHAPTERS, type ChapterDefinition } from "../content/chapters";
import type { CampaignChoiceSelection } from "../domain/models/game";

export interface CampaignChoiceHistoryEntry {
  key: string;
  choiceId: string;
  chapterId: string;
  chapterNumber: number | null;
  chapterTitle: string;
  sourceEventId: string;
  speaker: string | null;
  prompt: string | null;
  selectedLabel: string | null;
}

/**
 * Reconstructs a read-only campaign decision history from the saved choice
 * ledger and current chapter content. The saved ledger contains IDs only.
 */
export function getCampaignChoiceHistory(
  selections: readonly CampaignChoiceSelection[],
  chapters: readonly ChapterDefinition[] = CHAPTERS
): CampaignChoiceHistoryEntry[] {
  return selections.map((selection) => {
    const chapter = chapters.find((candidate) => candidate.id === selection.sourceChapterId);
    const event = chapter?.map.events?.find((candidate) => candidate.id === selection.sourceEventId);
    const action = event?.action.type === "show-choice" ? event.action : null;
    const choice = action?.choices.find((candidate) => candidate.id === selection.choiceId);

    return {
      key: selection.key,
      choiceId: selection.choiceId,
      chapterId: selection.sourceChapterId,
      chapterNumber: chapter?.number ?? null,
      chapterTitle: chapter?.title ?? selection.sourceChapterId,
      sourceEventId: selection.sourceEventId,
      speaker: action?.speaker ?? null,
      prompt: action?.text ?? null,
      selectedLabel: choice?.label ?? null
    };
  });
}
