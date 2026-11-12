import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { createSaveFileContent, parseSaveFileContent } from "./save-file";

describe("save file export and import format", () => {
  it("round-trips a complete game snapshot in a versioned envelope", () => {
    const exportedAt = new Date("2026-11-10T12:34:56.000Z");
    const content = createSaveFileContent(INITIAL_GAME_STATE, exportedAt);
    const envelope = JSON.parse(content) as Record<string, unknown>;

    expect(envelope).toMatchObject({
      format: "grid-tactics-pwa-save",
      formatVersion: 1,
      exportedAt: "2026-11-10T12:34:56.000Z"
    });
    expect(parseSaveFileContent(content)).toEqual(INITIAL_GAME_STATE);
  });

  it("round-trips cumulative per-unit campaign battle records", () => {
    const snapshot = {
      ...INITIAL_GAME_STATE,
      campaignUnitBattleRecords: [{
        unitId: "unit_001",
        unitName: "味方01",
        attacks: 2,
        strikes: 3,
        hits: 2,
        misses: 1,
        criticalHits: 1,
        damageDealt: 14,
        enemiesDefeated: 1,
        experienceAwarded: 30,
        levelUps: 1,
        statGains: {
          hp: 1, strength: 1, magic: 0, skill: 0,
          speed: 0, luck: 0, defense: 0, resistance: 0
        }
      }]
    };
    const content = createSaveFileContent(snapshot);
    expect(parseSaveFileContent(content)).toEqual(snapshot);
  });

  it("rejects malformed JSON", () => {
    expect(() => parseSaveFileContent("{")).toThrow("JSONとして読み込めません");
  });

  it("rejects an unknown format or version", () => {
    const content = JSON.stringify({
      format: "another-game",
      formatVersion: 1,
      exportedAt: "2026-11-10T12:34:56.000Z",
      data: INITIAL_GAME_STATE
    });
    expect(() => parseSaveFileContent(content)).toThrow("対応するセーブファイル形式");
  });

  it("rejects an invalid export timestamp", () => {
    const content = JSON.stringify({
      format: "grid-tactics-pwa-save",
      formatVersion: 1,
      exportedAt: "not-a-date",
      data: INITIAL_GAME_STATE
    });
    expect(() => parseSaveFileContent(content)).toThrow("対応するセーブファイル形式");
  });

  it("does not assume the enclosed snapshot is valid", () => {
    const content = createSaveFileContent(INITIAL_GAME_STATE);
    const result = parseSaveFileContent(content) as { saveVersion: number };
    expect(result.saveVersion).toBe(4);
  });
});
