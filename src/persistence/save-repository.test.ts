import { describe, expect, it } from "vitest";
import type { SaveBackupRecord } from "./save-repository";
import {
  getBackupRecordsToPreserveAfterReplacement,
  getBackupRecordsToPreserveAfterRestore,
  assertAutoSaveRevisionMatches,
  getNextAutoSaveTimestamp,
  SaveConflictError
} from "./save-repository";

function createBackups(): SaveBackupRecord[] {
  return [1, 2, 3].map((generation) => ({
    slotId: "backup-" + generation,
    savedAt: 1_000 - generation * 100,
    data: { generation }
  }));
}

describe("getBackupRecordsToPreserveAfterRestore", () => {
  it.each([
    ["backup-1", ["backup-1", "backup-2"]],
    ["backup-2", ["backup-1", "backup-2"]],
    ["backup-3", ["backup-1", "backup-3"]]
  ] as const)("preserves the selected backup and newest other generation when restoring %s", (selected, expected) => {
    const backups = createBackups();
    const preserved = getBackupRecordsToPreserveAfterRestore(backups, selected);
    expect(preserved.map((backup) => backup.slotId)).toEqual(expected);
  });

  it("keeps the selected backup when it is the only saved generation", () => {
    const onlyBackup = createBackups().slice(2);
    expect(getBackupRecordsToPreserveAfterRestore(onlyBackup, "backup-3")).toEqual(onlyBackup);
  });

  it("rejects a selected slot that is no longer present", () => {
    expect(() => getBackupRecordsToPreserveAfterRestore(createBackups(), "backup-4"))
      .toThrow("selected backup is no longer available");
  });

  it("does not mutate the supplied backup list or records", () => {
    const backups = createBackups();
    const before = JSON.stringify(backups);
    getBackupRecordsToPreserveAfterRestore(backups, "backup-2");
    expect(JSON.stringify(backups)).toBe(before);
  });
});

describe("getBackupRecordsToPreserveAfterReplacement", () => {
  it("keeps the newest two backup generations in their existing order", () => {
    const backups = createBackups();
    expect(getBackupRecordsToPreserveAfterReplacement(backups).map((backup) => backup.slotId))
      .toEqual(["backup-1", "backup-2"]);
  });

  it("keeps all available generations when fewer than two exist", () => {
    const backups = createBackups().slice(2);
    expect(getBackupRecordsToPreserveAfterReplacement(backups)).toEqual(backups);
    expect(getBackupRecordsToPreserveAfterReplacement([])).toEqual([]);
  });

  it("ignores records outside the three backup slots", () => {
    const backups = [
      ...createBackups(),
      { slotId: "auto", savedAt: 2_000, data: { generation: 0 } },
      { slotId: "backup-4", savedAt: 1_500, data: { generation: 4 } }
    ];
    expect(getBackupRecordsToPreserveAfterReplacement(backups).map((backup) => backup.slotId))
      .toEqual(["backup-1", "backup-2"]);
  });

  it("does not mutate the source collection", () => {
    const backups = createBackups();
    const before = JSON.stringify(backups);
    getBackupRecordsToPreserveAfterReplacement(backups);
    expect(JSON.stringify(backups)).toBe(before);
  });
});


describe("auto-save concurrency revision", () => {
  it("accepts the revision that was actually loaded, including an empty slot", () => {
    expect(() => assertAutoSaveRevisionMatches(null, null)).not.toThrow();
    expect(() => assertAutoSaveRevisionMatches(1_000, 1_000)).not.toThrow();
  });

  it("rejects a stale tab when another tab has already saved", () => {
    expect(() => assertAutoSaveRevisionMatches(1_000, 1_001)).toThrow(SaveConflictError);
    expect(() => assertAutoSaveRevisionMatches(null, 1_000)).toThrow(SaveConflictError);
    expect(() => assertAutoSaveRevisionMatches(1_000, null)).toThrow(SaveConflictError);
  });

  it("keeps the existing savedAt field strictly increasing within one millisecond", () => {
    expect(getNextAutoSaveTimestamp(5_000, null)).toBe(5_000);
    expect(getNextAutoSaveTimestamp(5_000, 4_999)).toBe(5_000);
    expect(getNextAutoSaveTimestamp(5_000, 5_000)).toBe(5_001);
    expect(getNextAutoSaveTimestamp(4_000, 5_000)).toBe(5_001);
  });
});
