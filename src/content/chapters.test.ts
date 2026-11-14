import { describe, expect, it } from "vitest";
import { isValidGameMapDefinition } from "../domain/models/validate-game-map";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { CHAPTERS, getChapterById, getNextChapter, INITIAL_CHAPTER, isValidCampaignChoiceLinks } from "./chapters";
import { CHAPTER_01_MAP, MAIN_CHARACTER_UNIT_ID } from "./maps/chapter-01";
import { CHAPTER_02_MAP } from "./maps/chapter-02";
import { CHAPTER_03_MAP } from "./maps/chapter-03";

describe("chapter content registry", () => {
  it("registers unique chapters with valid initial snapshots", () => {
    expect(new Set(CHAPTERS.map((chapter) => chapter.id)).size).toBe(CHAPTERS.length);
    expect(isValidCampaignChoiceLinks()).toBe(true);
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
    expect(CHAPTER_01_MAP.objects).toBeUndefined();
    expect(CHAPTER_02_MAP.objects).toEqual([
      { id: "chapter-02-prototype-village", kind: "village", eventId: "chapter-02-village-route-choice" },
      { id: "chapter-02-prototype-chest", kind: "treasure-chest", eventId: "chapter-02-prototype-chest-reward" },
      { id: "chapter-02-prototype-door", kind: "door", eventId: "chapter-02-door-inspection-choice" }
    ]);
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-village-route-choice")?.action)
      .toMatchObject({
        type: "show-choice",
        campaignChoiceKey: "chapter-02.village-route",
        choices: [
          { id: "forest-trail", label: "森の小道について聞く" },
          { id: "eastern-pass", label: "東の峠道について聞く" }
        ]
      });
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-prototype-chest-reward")?.action)
      .toMatchObject({ type: "grant-item", itemId: "healing_potion", quantity: 1 });
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-door-inspection-choice")?.action)
      .toMatchObject({
        type: "show-choice",
        choices: [
          { id: "door-markings", label: "扉の表面を調べる" },
          { id: "door-surroundings", label: "扉の周囲を調べる" }
        ]
      });
    expect(CHAPTER_02_MAP.events?.filter((event) =>
      event.trigger.type === "event-choice" &&
      ["chapter-02-door-markings", "chapter-02-door-surroundings"].includes(event.id)
    )).toHaveLength(2);
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-scout-recruitment-choice")?.action)
      .toMatchObject({
        type: "show-choice",
        campaignChoiceKey: "chapter-02.scout-recruitment",
        choices: [
          { id: "join-scout", label: "仲間に誘う" },
          { id: "decline-scout", label: "今回は見送る" }
        ]
      });
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-scout-recruitment-join")?.action)
      .toMatchObject({ type: "recruit-unit", unit: { id: "recruit_scout", name: "斥候ミナ", classId: "archer" } });
    expect(CHAPTER_02_MAP.events?.find((event) => event.id === "chapter-02-scout-recruitment-decline")?.action)
      .toMatchObject({ type: "show-message" });
    expect(CHAPTER_03_MAP.playerDeployment.find((deployment) => deployment.unitId === "recruit_scout"))
      .toMatchObject({ x: 7, y: 8, optional: true });
    expect(CHAPTER_03_MAP.events?.find((event) => event.id === "chapter-03-scout-joins-expedition"))
      .toMatchObject({
        condition: { type: "campaign-choice", key: "chapter-02.scout-recruitment", choiceId: "join-scout" },
        action: { type: "show-message" }
      });
    expect(CHAPTER_03_MAP.events?.filter((event) => event.condition?.key === "chapter-02.village-route"))
      .toHaveLength(2);
    expect(CHAPTER_03_MAP.events?.filter((event) => event.condition?.key === "chapter-02.scout-recruitment"))
      .toHaveLength(1);
    expect(isValidCampaignChoiceLinks()).toBe(true);
  });

  it("provides deterministic next-chapter lookup", () => {
    expect(INITIAL_CHAPTER.number).toBe(1);
    expect(getChapterById("chapter_02_map")?.number).toBe(2);
    expect(getNextChapter("chapter_01_map")?.id).toBe("chapter_02_map");
    expect(getNextChapter("chapter_02_map")?.id).toBe("chapter_03_map");
    expect(getNextChapter("chapter_03_map")).toBeUndefined();
    expect(getNextChapter("missing_chapter")).toBeUndefined();
  });
  it("validates persistent campaign choices referenced only by later chapters", () => {
    const first = {
      ...CHAPTERS[0]!,
      map: {
        ...CHAPTERS[0]!.map,
        events: [{
          id: "persistent-route-choice",
          trigger: { type: "stage-start" as const },
          action: {
            type: "show-choice" as const,
            campaignChoiceKey: "chapter-one.route",
            text: "道を選んでください。",
            choices: [
              { id: "forest", label: "森" },
              { id: "road", label: "街道" }
            ]
          }
        }]
      }
    };
    const laterEvent = {
      id: "later-route-outcome",
      trigger: { type: "stage-start" as const },
      condition: { type: "campaign-choice" as const, key: "chapter-one.route", choiceId: "forest" },
      action: { type: "show-message" as const, text: "前章で森を選びました。" }
    };
    const second = {
      ...CHAPTERS[1]!,
      map: { ...CHAPTERS[1]!.map, events: [laterEvent] }
    };

    expect(isValidCampaignChoiceLinks([first, second])).toBe(true);
    expect(isValidCampaignChoiceLinks([
      first,
      { ...second, map: { ...second.map, events: [{ ...laterEvent, condition: { ...laterEvent.condition, choiceId: "missing" } }] } }
    ])).toBe(false);
    expect(isValidCampaignChoiceLinks([
      { ...first, number: 2 },
      { ...second, number: 1 }
    ])).toBe(false);
    expect(isValidCampaignChoiceLinks([
      first,
      { ...second, map: { ...second.map, events: [{ ...laterEvent, condition: { ...laterEvent.condition, key: "unknown" } }] } }
    ])).toBe(false);
  });

});
