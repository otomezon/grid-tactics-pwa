import { describe, expect, it } from "vitest";
import { CHAPTERS } from "../content/chapters";
import type { CampaignBattleLogEntry } from "../domain/models/game";
import { getCampaignBattleHistory } from "./get-campaign-battle-history";

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
