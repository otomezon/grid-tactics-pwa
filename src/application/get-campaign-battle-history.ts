import { CHAPTERS, type ChapterDefinition } from "../content/chapters";
import type { CampaignBattleLogEntry } from "../domain/models/game";

export type CampaignBattleHistoryEntry = CampaignBattleLogEntry & {
  chapterNumber: number | null;
  chapterTitle: string;
};

/** Adds only chapter labels to the saved, globally ordered campaign log. */
export function getCampaignBattleHistory(
  entries: readonly CampaignBattleLogEntry[],
  chapters: readonly ChapterDefinition[] = CHAPTERS
): CampaignBattleHistoryEntry[] {
  return entries.map((entry) => {
    const chapter = chapters.find((candidate) => candidate.id === entry.chapterId);
    return {
      ...entry,
      chapterNumber: chapter?.number ?? null,
      chapterTitle: chapter?.title ?? entry.chapterId
    };
  });
}
