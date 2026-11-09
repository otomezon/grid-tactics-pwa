import { describe, expect, it } from "vitest";
import { isValidGameMapDefinition } from "../domain/models/validate-game-map";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { CHAPTERS, getChapterById, getNextChapter, INITIAL_CHAPTER } from "./chapters";

describe("chapter content registry", () => {
  it("registers unique chapters with valid initial snapshots", () => {
    expect(new Set(CHAPTERS.map((chapter) => chapter.id)).size).toBe(CHAPTERS.length);
    for (const chapter of CHAPTERS) {
      expect(isValidGameMapDefinition(chapter.map)).toBe(true);
      expect(chapter.initialState.chapterId).toBe(chapter.map.id);
      expect(isValidGameStateSnapshot(chapter.initialState, chapter.map)).toBe(true);
      expect(chapter.initialState.phase).toBe("player");
      expect(chapter.initialState.turn).toBe(1);
    }
  });

  it("provides deterministic next-chapter lookup", () => {
    expect(INITIAL_CHAPTER.number).toBe(1);
    expect(getChapterById("chapter_02_map")?.number).toBe(2);
    expect(getNextChapter("chapter_01_map")?.id).toBe("chapter_02_map");
    expect(getNextChapter("chapter_02_map")).toBeUndefined();
    expect(getNextChapter("missing_chapter")).toBeUndefined();
  });
});
