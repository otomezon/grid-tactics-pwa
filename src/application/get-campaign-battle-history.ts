import { CHAPTERS, type ChapterDefinition } from "../content/chapters";
import { MAX_CAMPAIGN_BATTLE_LOG_ENTRIES, type CampaignBattleLogEntry } from "../domain/models/game";

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


export interface CampaignBattleLogCoverage {
  retainedCount: number;
  retentionLimit: number;
  firstSequence: number | null;
  lastSequence: number | null;
  missingSequenceCount: number;
  reachedRetentionLimit: boolean;
}

/**
 * Describes only the retained log's internal sequence range.
 * A full retention limit does not prove that earlier records were dropped,
 * and missing sequence values do not reveal the actions that may be absent.
 */
export function getCampaignBattleLogCoverage(
  entries: readonly Pick<CampaignBattleLogEntry, "sequence">[]
): CampaignBattleLogCoverage {
  const sequences = entries.map((entry) => entry.sequence).sort((left, right) => left - right);
  let missingSequenceCount = 0;

  for (let index = 1; index < sequences.length; index += 1) {
    missingSequenceCount += Math.max(0, sequences[index]! - sequences[index - 1]! - 1);
  }

  return {
    retainedCount: entries.length,
    retentionLimit: MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
    firstSequence: sequences[0] ?? null,
    lastSequence: sequences.at(-1) ?? null,
    missingSequenceCount,
    reachedRetentionLimit: entries.length >= MAX_CAMPAIGN_BATTLE_LOG_ENTRIES
  };
}
