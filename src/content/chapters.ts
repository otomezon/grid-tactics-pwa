import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import type { ChapterRewardDefinition } from "../domain/progression/chapter-reward";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "./maps/chapter-01";
import { CHAPTER_02_MAP, CHAPTER_02_INITIAL_STATE } from "./maps/chapter-02";
import { CHAPTER_03_MAP, CHAPTER_03_INITIAL_STATE } from "./maps/chapter-03";

export interface ChapterDefinition {
  id: string;
  number: number;
  title: string;
  summary: string;
  map: GameMapDefinition;
  initialState: GameStateSnapshot;
  /** Explicit rewards only; an empty list means no reward has been configured. */
  clearRewards: readonly ChapterRewardDefinition[];
  /** Marks placeholder map data that still needs design review. */
  isPrototype: boolean;
}

export const CHAPTERS: readonly ChapterDefinition[] = [
  {
    id: CHAPTER_01_MAP.id,
    number: 1,
    title: "第1章・試作マップ",
    summary: "基本操作と戦闘を確認するステージです。",
    map: CHAPTER_01_MAP,
    initialState: INITIAL_GAME_STATE,
    clearRewards: [],
    isPrototype: true
  },
  {
    id: CHAPTER_02_MAP.id,
    number: 2,
    title: "第2章・試作マップ",
    summary: "章間のレベル・能力・所持品引き継ぎを確認するステージです。",
    map: CHAPTER_02_MAP,
    initialState: CHAPTER_02_INITIAL_STATE,
    clearRewards: [],
    isPrototype: true
  },

  {
    id: CHAPTER_03_MAP.id,
    number: 3,
    title: "第3章・試作マップ",
    summary: "森・山・水域の迂回と地形を使った進路選択を確認するステージです。",
    map: CHAPTER_03_MAP,
    initialState: CHAPTER_03_INITIAL_STATE,
    clearRewards: [],
    isPrototype: true
  }
];

export const INITIAL_CHAPTER = CHAPTERS[0]!;

export function getChapterById(chapterId: string): ChapterDefinition | undefined {
  return CHAPTERS.find((chapter) => chapter.id === chapterId);
}

export function getNextChapter(chapterId: string): ChapterDefinition | undefined {
  const index = CHAPTERS.findIndex((chapter) => chapter.id === chapterId);
  return index >= 0 ? CHAPTERS[index + 1] : undefined;
}
