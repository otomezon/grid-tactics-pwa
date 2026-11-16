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
  unretainedLeadingSequenceCount: number;
  reachedRetentionLimit: boolean;
}

/**
 * Describes only sequence numbers absent from the retained log.
 * Sequences start at 1, so numbers before the first retained entry are counted
 * separately from gaps inside the retained range. Neither count identifies a
 * cause or reveals the contents of any action that is not present.
 */
export function getCampaignBattleLogCoverage(
  entries: readonly Pick<CampaignBattleLogEntry, "sequence">[]
): CampaignBattleLogCoverage {
  const sequences = entries.map((entry) => entry.sequence).sort((left, right) => left - right);
  const firstSequence = sequences[0] ?? null;
  let missingSequenceCount = 0;

  for (let index = 1; index < sequences.length; index += 1) {
    missingSequenceCount += Math.max(0, sequences[index]! - sequences[index - 1]! - 1);
  }

  return {
    retainedCount: entries.length,
    retentionLimit: MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
    firstSequence,
    lastSequence: sequences.at(-1) ?? null,
    missingSequenceCount,
    unretainedLeadingSequenceCount: firstSequence === null ? 0 : firstSequence - 1,
    reachedRetentionLimit: entries.length >= MAX_CAMPAIGN_BATTLE_LOG_ENTRIES
  };
}
