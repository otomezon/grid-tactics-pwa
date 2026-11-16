import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../content/chapters";
import type { CampaignBattleLogEntry } from "../domain/models/game";
import { getCampaignBattleHistory, getCampaignBattleLogCoverage } from "./get-campaign-battle-history";

const entry: CampaignBattleLogEntry = {
  sequence: 12,
  chapterId: CHAPTERS[0]!.id,
  turn: 3,
  kind: "player-action",
  action: "movement",
  actorId: "unit_001",
  actorName: "主人公",
  detail: "2列・9行 → 2列・8行"
};

describe("getCampaignBattleHistory", () => {
  it("preserves saved order and reconstructs chapter labels", () => {
    const result = getCampaignBattleHistory([entry, { ...entry, sequence: 13, turn: 4 }]);
    expect(result.map((item) => item.sequence)).toEqual([12, 13]);
    expect(result[0]).toMatchObject({
      chapterNumber: 1,
      chapterTitle: "第1章・試作マップ",
      turn: 3
    });
  });

  it("falls back to the saved chapter ID when old content is unavailable", () => {
    const result = getCampaignBattleHistory([{ ...entry, chapterId: "removed_chapter" }]);
    expect(result[0]).toMatchObject({
      chapterId: "removed_chapter",
      chapterNumber: null,
      chapterTitle: "removed_chapter"
    });
  });
});


describe("getCampaignBattleLogCoverage", () => {
  it("returns an empty range for a campaign with no retained timeline entries", () => {
    expect(getCampaignBattleLogCoverage([])).toEqual({
      retainedCount: 0,
      retentionLimit: 5000,
      firstSequence: null,
      lastSequence: null,
      missingSequenceCount: 0,
      unretainedLeadingSequenceCount: 0,
      reachedRetentionLimit: false
    });
  });

  it("sorts a copy to describe the retained sequence range without changing input order", () => {
    const input = [{ sequence: 12 }, { sequence: 10 }, { sequence: 11 }];
    expect(getCampaignBattleLogCoverage(input)).toMatchObject({
      retainedCount: 3,
      firstSequence: 10,
      lastSequence: 12,
      missingSequenceCount: 0,
      unretainedLeadingSequenceCount: 9,
      reachedRetentionLimit: false
    });
    expect(input.map((entry) => entry.sequence)).toEqual([12, 10, 11]);
  });

  it("counts only missing sequence values within the retained first-to-last range", () => {
    expect(getCampaignBattleLogCoverage([
      { sequence: 15 },
      { sequence: 10 },
      { sequence: 12 }
    ])).toMatchObject({
      retainedCount: 3,
      firstSequence: 10,
      lastSequence: 15,
      missingSequenceCount: 3,
      unretainedLeadingSequenceCount: 9,
      reachedRetentionLimit: false
    });
  });

  it("marks a full retention limit without claiming earlier history was deleted", () => {
    const entries = Array.from({ length: 5000 }, (_, index) => ({ sequence: index + 101 }));
    expect(getCampaignBattleLogCoverage(entries)).toMatchObject({
      retainedCount: 5000,
      retentionLimit: 5000,
      firstSequence: 101,
      lastSequence: 5100,
      missingSequenceCount: 0,
      unretainedLeadingSequenceCount: 100,
      reachedRetentionLimit: true
    });
  });
});
