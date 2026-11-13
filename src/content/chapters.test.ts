import { describe, expect, it } from "vitest";
import { isValidGameMapDefinition } from "../domain/models/validate-game-map";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { CHAPTERS, getChapterById, getNextChapter, INITIAL_CHAPTER } from "./chapters";
import { CHAPTER_01_MAP, MAIN_CHARACTER_UNIT_ID } from "./maps/chapter-01";

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

  it("protects the prototype protagonist in all three chapters and uses a boss objective in chapter one", () => {
    for (const chapter of CHAPTERS) {
      expect(chapter.map.defeatCondition).toEqual({
        type: "unit_defeated",
        targetUnitId: MAIN_CHARACTER_UNIT_ID
      });
      expect(chapter.map.playerDeployment.some((deployment) => deployment.unitId === MAIN_CHARACTER_UNIT_ID)).toBe(true);
    }

    expect(MAIN_CHARACTER_UNIT_ID).toBe("unit_001");
    expect(CHAPTER_01_MAP.objective).toEqual({ type: "defeat_boss", targetUnitId: "enemy_005" });
    expect(CHAPTER_01_MAP.enemyDeployment.some((deployment) => deployment.unitId === "enemy_005")).toBe(true);
  });

  it("provides deterministic next-chapter lookup", () => {
    expect(INITIAL_CHAPTER.number).toBe(1);
    expect(getChapterById("chapter_02_map")?.number).toBe(2);
    expect(getNextChapter("chapter_01_map")?.id).toBe("chapter_02_map");
    expect(getNextChapter("chapter_02_map")?.id).toBe("chapter_03_map");
    expect(getNextChapter("chapter_03_map")).toBeUndefined();
    expect(getNextChapter("missing_chapter")).toBeUndefined();
  });
});
