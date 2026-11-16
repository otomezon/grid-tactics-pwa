import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { importPromotionPlaytestSaveContent } from "./import-promotion-playtest-save";

const EXPORTED_AT = "2026-11-15T00:00:00.000Z";

function createEnvelope(data: unknown, exportedAt = EXPORTED_AT): string {
  return JSON.stringify({
    format: "grid-tactics-pwa-save",
    formatVersion: 1,
    exportedAt,
    data
  });
}

function createVersionOneSnapshot() {
  const {
    saveVersion: _saveVersion,
    rngState: _rngState,
    reserveUnits: _reserveUnits,
    campaignUnitBattleRecords: _campaignUnitBattleRecords,
    firedMapEventIds: _firedMapEventIds,
    acknowledgedMapEventIds: _acknowledgedMapEventIds,
    mapEventChoices: _mapEventChoices,
    campaignChoices: _campaignChoices,
    campaignBattleLog: _campaignBattleLog,
    ...legacy
  } = INITIAL_GAME_STATE;

  return {
    ...legacy,
    saveVersion: 1,
    units: legacy.units.map(({ equippedWeaponId: _equippedWeaponId, ...unit }) => ({
      ...unit,
      inventory: ["prototype_weapon"]
    }))
  };
}

describe("importPromotionPlaytestSaveContent", () => {
  it("accepts a current v10 save without migration and keeps envelope provenance", () => {
    const result = importPromotionPlaytestSaveContent(createEnvelope(INITIAL_GAME_STATE));

    expect(result.snapshot).toEqual(INITIAL_GAME_STATE);
    expect(result).toMatchObject({
      exportedAt: EXPORTED_AT,
      sourceSaveVersion: 10,
      normalizedSaveVersion: 10,
      migrated: false
    });
  });

  it("migrates a v9 save to v10 while preserving its campaign battle log", () => {
    const legacyLog = [{
      sequence: 1,
      chapterId: CHAPTER_01_MAP.id,
      turn: 3,
      kind: "player-action" as const,
      action: "wait" as const,
      actorId: "unit_001",
      actorName: "主人公",
      detail: "v9由来の記録"
    }];
    const legacy = {
      ...INITIAL_GAME_STATE,
      saveVersion: 9,
      campaignBattleLog: legacyLog
    };

    const result = importPromotionPlaytestSaveContent(createEnvelope(legacy));

    expect(result).toMatchObject({
      sourceSaveVersion: 9,
      normalizedSaveVersion: 10,
      migrated: true,
      exportedAt: EXPORTED_AT
    });
    expect(result.snapshot.campaignBattleLog).toEqual(legacyLog);
    expect(result.snapshot.saveVersion).toBe(10);
  });

  it("migrates a v1 save and preserves its units without inventing campaign history", () => {
    const result = importPromotionPlaytestSaveContent(createEnvelope(createVersionOneSnapshot()));

    expect(result).toMatchObject({
      sourceSaveVersion: 1,
      normalizedSaveVersion: 10,
      migrated: true,
      exportedAt: EXPORTED_AT
    });
    expect(result.snapshot.rngState).toBeGreaterThan(0);
    expect(result.snapshot.units[0]?.inventory).toEqual(["iron_sword"]);
    expect(result.snapshot.campaignBattleLog).toEqual([]);
    expect(result.snapshot.campaignUnitBattleRecords).toEqual([]);
    expect(result.snapshot.saveVersion).toBe(10);
  });

  it("rejects an unsupported save version, unknown chapter, and invalid map snapshot", () => {
    expect(() => importPromotionPlaytestSaveContent(createEnvelope({
      ...INITIAL_GAME_STATE,
      saveVersion: 99
    }))).toThrow("saveVersion 99");

    expect(() => importPromotionPlaytestSaveContent(createEnvelope({
      ...INITIAL_GAME_STATE,
      chapterId: "unregistered-chapter"
    }))).toThrow("未登録の章ID");

    const invalid = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit, index) =>
        index === 0 ? { ...unit, position: { x: CHAPTER_01_MAP.width, y: 0 } } : unit
      )
    };
    expect(() => importPromotionPlaytestSaveContent(createEnvelope(invalid)))
      .toThrow("章マップ整合性");
  });

  it("rejects a non-versioned or malformed JSON file before migration", () => {
    expect(() => importPromotionPlaytestSaveContent("{")).toThrow("JSONとして読み込めません");
    expect(() => importPromotionPlaytestSaveContent(JSON.stringify({
      format: "other",
      formatVersion: 1,
      exportedAt: EXPORTED_AT,
      data: INITIAL_GAME_STATE
    }))).toThrow("対応するセーブファイル形式");
  });
});
