import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { migrateGameStateSnapshot } from "./migrations";

describe("migrateGameStateSnapshot", () => {
  function createLegacySnapshot() {
    return {
      saveVersion: 1,
      chapterId: INITIAL_GAME_STATE.chapterId,
      phase: INITIAL_GAME_STATE.phase,
      turn: INITIAL_GAME_STATE.turn,
      units: INITIAL_GAME_STATE.units.map(({ equippedWeaponId: _equippedWeaponId, ...unit }) => ({
        ...unit,
        inventory: ["prototype_weapon"]
      }))
    };
  }
  function createVersionTwoSnapshot() {
    const { reserveUnits: _reserveUnits, saveVersion: _saveVersion, ...legacy } = INITIAL_GAME_STATE;
    return { ...legacy, saveVersion: 2 };
  }

  it("migrates a version 1 save through v3 and maps prototype weapons", () => {
    const result = migrateGameStateSnapshot(createLegacySnapshot(), CHAPTER_01_MAP);
    expect(result?.migrated).toBe(true);
    expect(result?.snapshot.saveVersion).toBe(3);
    expect(result?.snapshot.reserveUnits).toEqual([]);
    expect(result?.snapshot.rngState).toBeGreaterThan(0);
    expect(result?.snapshot.units[0]?.inventory).toEqual(["iron_sword"]);
    expect(result?.snapshot.units[0]?.equippedWeaponId).toBe("iron_sword");
    expect(result?.snapshot.units[1]?.equippedWeaponId).toBe("short_bow");
    expect(result?.snapshot.units[2]?.equippedWeaponId).toBe("iron_lance");
    expect(result?.snapshot.units[4]?.equippedWeaponId).toBe("iron_axe");
  });

  it("adds an empty reserve list when migrating a valid version 2 save", () => {
    const result = migrateGameStateSnapshot(createVersionTwoSnapshot(), CHAPTER_01_MAP);
    expect(result?.migrated).toBe(true);
    expect(result?.snapshot.saveVersion).toBe(3);
    expect(result?.snapshot.reserveUnits).toEqual([]);
    expect(result?.snapshot.units).toEqual(INITIAL_GAME_STATE.units);
  });

  it("preserves HP, position, phase, and turn when migrating", () => {
    const legacy = createLegacySnapshot();
    legacy.units[0]!.currentHp = 7;
    legacy.units[0]!.position = { x: 2, y: 7 };
    legacy.turn = 4;
    legacy.phase = "enemy";
    const result = migrateGameStateSnapshot(legacy, CHAPTER_01_MAP);
    expect(result?.snapshot.turn).toBe(4);
    expect(result?.snapshot.phase).toBe("enemy");
    expect(result?.snapshot.units[0]).toMatchObject({ currentHp: 7, position: { x: 2, y: 7 } });
  });

  it("produces a stable non-zero RNG state for the same legacy save", () => {
    const legacy = createLegacySnapshot();
    const first = migrateGameStateSnapshot(legacy, CHAPTER_01_MAP);
    const second = migrateGameStateSnapshot(legacy, CHAPTER_01_MAP);
    expect(first?.snapshot.rngState).toBe(second?.snapshot.rngState);
    expect(first?.snapshot.rngState).not.toBe(0);
  });

  it("does not rewrite a valid version 3 save", () => {
    expect(migrateGameStateSnapshot(INITIAL_GAME_STATE, CHAPTER_01_MAP))
      .toEqual({ snapshot: INITIAL_GAME_STATE, migrated: false });
  });

  it("rejects unsupported versions and invalid legacy snapshots", () => {
    expect(migrateGameStateSnapshot({ ...createLegacySnapshot(), saveVersion: 99 }, CHAPTER_01_MAP))
      .toBeNull();
    const invalid = createLegacySnapshot();
    invalid.units[0]!.position = { x: CHAPTER_01_MAP.width, y: 0 };
    expect(migrateGameStateSnapshot(invalid, CHAPTER_01_MAP)).toBeNull();
  });
});
