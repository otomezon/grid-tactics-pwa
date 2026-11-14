import { describe, expect, it } from "vitest";
import type { SaveBackupRecord } from "./save-repository";
import {
  getBackupRecordsToPreserveAfterReplacement,
  getBackupRecordsToPreserveAfterRestore
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
