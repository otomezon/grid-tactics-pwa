import type { GameStateSnapshot } from "../domain/models/game";

const DATABASE_NAME = "grid-tactics-pwa";
const DATABASE_VERSION = 1;
const SAVE_STORE = "game-saves";
const AUTO_SAVE_SLOT = "auto";

interface SaveRecord {
  slotId: string;
  savedAt: number;
  data: GameStateSnapshot;
}

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SAVE_STORE)) {
        database.createObjectStore(SAVE_STORE, { keyPath: "slotId" });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = undefined;
      };
      resolve(database);
    };

    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("Failed to open the save database."));
    };

    request.onblocked = () => {
      databasePromise = undefined;
      reject(new Error("Opening the save database was blocked."));
    };
  });

  return databasePromise;
}

function transactionCompleted(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("Save transaction failed."));
    };
    transaction.onabort = () => {
      reject(transaction.error ?? new Error("Save transaction aborted."));
    };
  });
}

export interface LoadedGameStateRecord {
  savedAt: number;
  data: unknown;
}

/** Reads save data and its existing savedAt revision for optimistic concurrency. */
export async function loadGameStateRecord(
  slotId: string = AUTO_SAVE_SLOT
): Promise<LoadedGameStateRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readonly");
  const completed = transactionCompleted(transaction);
  const request = transaction.objectStore(SAVE_STORE).get(slotId);

  const [record] = await Promise.all([
    new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to read save data."));
    }),
    completed
  ]);

  if (record === undefined) return null;
  if (
    !isStoredRecord(record) ||
    record.slotId !== slotId ||
    typeof record.savedAt !== "number" ||
    !Number.isFinite(record.savedAt) ||
    typeof record.data !== "object" ||
    record.data === null
  ) {
    throw new Error("The stored save record has an invalid format.");
  }
  return { savedAt: record.savedAt, data: record.data };
}

export async function loadGameState(
  slotId: string = AUTO_SAVE_SLOT
): Promise<unknown | null> {
  const record = await loadGameStateRecord(slotId);
  return record?.data ?? null;
}

export class SaveConflictError extends Error {
  readonly expectedSavedAt: number | null;
  readonly actualSavedAt: number | null;

  constructor(expectedSavedAt: number | null, actualSavedAt: number | null) {
    super("Another tab saved a newer campaign state.");
    this.name = "SaveConflictError";
    this.expectedSavedAt = expectedSavedAt;
    this.actualSavedAt = actualSavedAt;
  }
}

/** Compare a tab's last-loaded revision with the current record in its write transaction. */
export function assertAutoSaveRevisionMatches(
  expectedSavedAt: number | null,
  actualSavedAt: number | null
): void {
  if (expectedSavedAt !== actualSavedAt) {
    throw new SaveConflictError(expectedSavedAt, actualSavedAt);
  }
}

/** Uses the existing savedAt field as a strictly increasing revision. */
export function getNextAutoSaveTimestamp(now: number, previousSavedAt: number | null): number {
  return previousSavedAt === null ? now : Math.max(now, previousSavedAt + 1);
}

/** Read, compare, and write are serialized by one IndexedDB readwrite transaction. */
export async function saveGameState(
  data: GameStateSnapshot,
  expectedSavedAt: number | null
): Promise<number> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const store = transaction.objectStore(SAVE_STORE);
  const request = store.get(AUTO_SAVE_SLOT);
  let operationError: Error | undefined;

  const operation = new Promise<number>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const current = request.result as unknown;
        let actualSavedAt: number | null = null;
        if (current !== undefined) {
          if (
            !isStoredRecord(current) ||
            current.slotId !== AUTO_SAVE_SLOT ||
            typeof current.savedAt !== "number" ||
            !Number.isFinite(current.savedAt) ||
            typeof current.data !== "object" ||
            current.data === null
          ) {
            throw new Error("The stored auto-save record has an invalid format.");
          }
          actualSavedAt = current.savedAt;
        }

        assertAutoSaveRevisionMatches(expectedSavedAt, actualSavedAt);
        const savedAt = getNextAutoSaveTimestamp(Date.now(), actualSavedAt);
        store.put({ slotId: AUTO_SAVE_SLOT, savedAt, data } satisfies SaveRecord);
        resolve(savedAt);
      } catch (error) {
        operationError = error instanceof Error ? error : new Error("Failed to save campaign state.");
        try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(operationError);
      }
    };
    request.onerror = () => {
      operationError = request.error instanceof Error
        ? request.error
        : new Error("Failed to read the current auto-save revision.");
      reject(operationError);
    };
  });

  try {
    const [savedAt] = await Promise.all([operation, completed]);
    return savedAt;
  } catch (error) {
    throw operationError ?? error;
  }
}


const BACKUP_SLOT_PREFIX = "backup-";
const BACKUP_GENERATION_COUNT = 3;

export interface SaveBackupRecord {
  slotId: string;
  savedAt: number;
  data: unknown;
}

function isBackupSlotId(slotId: string): boolean {
  return /^backup-[1-3]$/.test(slotId);
}

/**
 * Keeps the selected restore source and the newest other generation.
 * The current auto-save will occupy generation 1 after a safe restore.
 */
export function getBackupRecordsToPreserveAfterRestore(
  backups: readonly SaveBackupRecord[],
  selectedSlotId: string
): SaveBackupRecord[] {
  const selected = backups.find((backup) => backup.slotId === selectedSlotId);
  if (!selected) {
    throw new Error("The selected backup is no longer available.");
  }

  const newestOther = backups
    .filter((backup) => backup.slotId !== selectedSlotId)
    .slice()
    .sort((left, right) =>
      Number(left.slotId.slice(BACKUP_SLOT_PREFIX.length)) -
      Number(right.slotId.slice(BACKUP_SLOT_PREFIX.length))
    )[0];

  return [selected, ...(newestOther ? [newestOther] : [])]
    .sort((left, right) =>
      Number(left.slotId.slice(BACKUP_SLOT_PREFIX.length)) -
      Number(right.slotId.slice(BACKUP_SLOT_PREFIX.length))
    );
}

/** Keeps the two newest stored generations when an operation replaces the auto-save. */
export function getBackupRecordsToPreserveAfterReplacement(
  backups: readonly SaveBackupRecord[]
): SaveBackupRecord[] {
  return backups
    .filter((backup) => isBackupSlotId(backup.slotId))
    .slice()
    .sort((left, right) =>
      Number(left.slotId.slice(BACKUP_SLOT_PREFIX.length)) -
      Number(right.slotId.slice(BACKUP_SLOT_PREFIX.length))
    )
    .slice(0, BACKUP_GENERATION_COUNT - 1);
}

function isStoredRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Lists the newest-to-oldest backup generations stored beside the auto-save. */
export async function loadGameStateBackups(): Promise<SaveBackupRecord[]> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readonly");
  const completed = transactionCompleted(transaction);
  const request = transaction.objectStore(SAVE_STORE).getAll();
  const [records] = await Promise.all([
    new Promise<unknown[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as unknown[]);
      request.onerror = () => reject(request.error ?? new Error("Failed to read save backups."));
    }),
    completed
  ]);

  return records
    .filter((record): record is Record<string, unknown> =>
      isStoredRecord(record) &&
      typeof record.slotId === "string" &&
      isBackupSlotId(record.slotId) &&
      typeof record.savedAt === "number" &&
      Number.isFinite(record.savedAt)
    )
    .map((record) => ({
      slotId: record.slotId as string,
      savedAt: record.savedAt as number,
      data: record.data
    }))
    .sort((left, right) => {
      const leftGeneration = Number(left.slotId.slice(BACKUP_SLOT_PREFIX.length));
      const rightGeneration = Number(right.slotId.slice(BACKUP_SLOT_PREFIX.length));
      return leftGeneration - rightGeneration;
    });
}

/** Loads one raw backup record; its game snapshot must be migrated and validated by the caller. */
export async function loadGameStateBackup(slotId: string): Promise<SaveBackupRecord | null> {
  if (!isBackupSlotId(slotId)) {
    throw new Error("The requested save backup slot is invalid.");
  }

  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readonly");
  const completed = transactionCompleted(transaction);
  const request = transaction.objectStore(SAVE_STORE).get(slotId);
  const [record] = await Promise.all([
    new Promise<unknown>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Failed to read the selected save backup."));
    }),
    completed
  ]);

  if (record === undefined) return null;
  if (
    !isStoredRecord(record) ||
    record.slotId !== slotId ||
    typeof record.savedAt !== "number" ||
    !Number.isFinite(record.savedAt)
  ) {
    throw new Error("The selected save backup record is invalid.");
  }

  return { slotId, savedAt: record.savedAt, data: record.data };
}

/**
 * Copies the current auto-save into generation 1 and rotates older generations
 * in one readwrite transaction. The auto-save record is never modified.
 */
export async function createGameStateBackup(expectedSnapshot: GameStateSnapshot): Promise<SaveBackupRecord> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const store = transaction.objectStore(SAVE_STORE);
  const request = store.getAll();
  let operationError: Error | undefined;

  const operation = new Promise<SaveBackupRecord>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const records = request.result as unknown[];
        const autoSave = records.find((record) =>
          isStoredRecord(record) && record.slotId === AUTO_SAVE_SLOT
        );
        if (!isStoredRecord(autoSave) || !isStoredRecord(autoSave.data)) {
          throw new Error("有効な自動セーブがないため、バックアップを作成できません。");
        }
        if (JSON.stringify(autoSave.data) !== JSON.stringify(expectedSnapshot)) {
          throw new Error("バックアップ作成中に自動セーブが更新されました。状態を確認してから再試行してください。");
        }

        const existingBackups = records
          .filter((record): record is Record<string, unknown> =>
            isStoredRecord(record) &&
            typeof record.slotId === "string" &&
            isBackupSlotId(record.slotId) &&
            typeof record.savedAt === "number" &&
            Number.isFinite(record.savedAt)
          )
          .sort((left, right) =>
            Number(String(left.slotId).slice(BACKUP_SLOT_PREFIX.length)) -
            Number(String(right.slotId).slice(BACKUP_SLOT_PREFIX.length))
          );

        const created: SaveBackupRecord = {
          slotId: BACKUP_SLOT_PREFIX + "1",
          savedAt: Date.now(),
          data: autoSave.data
        };

        for (let generation = 1; generation <= BACKUP_GENERATION_COUNT; generation += 1) {
          store.delete(BACKUP_SLOT_PREFIX + String(generation));
        }
        store.put(created);
        existingBackups.slice(0, BACKUP_GENERATION_COUNT - 1).forEach((backup, index) => {
          store.put({
            slotId: BACKUP_SLOT_PREFIX + String(index + 2),
            savedAt: backup.savedAt as number,
            data: backup.data
          });
        });
        resolve(created);
      } catch (error) {
        operationError = error instanceof Error ? error : new Error("Failed to rotate save backups.");
        try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(operationError);
      }
    };

    request.onerror = () => {
      operationError = request.error instanceof Error ? request.error : new Error("Failed to read save records for backup rotation.");
      reject(operationError);
    };
  });

  try {
    const [created] = await Promise.all([operation, completed]);
    return created;
  } catch (error) {
    throw operationError ?? error;
  }
}

/**
 * Atomically preserves the current auto-save, then restores a validated backup.
 * The selected restore source and newest other generation remain within the 3-slot limit.
 * Both records are read and written in the same IndexedDB readwrite transaction.
 */
export async function restoreGameStateBackup(
  expectedBackup: SaveBackupRecord,
  data: GameStateSnapshot
): Promise<SaveBackupRecord | null> {
  if (!isBackupSlotId(expectedBackup.slotId)) {
    throw new Error("The requested save backup slot is invalid.");
  }

  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const store = transaction.objectStore(SAVE_STORE);
  const request = store.getAll();
  let operationError: Error | undefined;

  const operation = new Promise<SaveBackupRecord | null>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const records = request.result as unknown[];
        const currentBackup = records.find((record) =>
          isStoredRecord(record) && record.slotId === expectedBackup.slotId
        );
        if (
          !isStoredRecord(currentBackup) ||
          currentBackup.slotId !== expectedBackup.slotId ||
          currentBackup.savedAt !== expectedBackup.savedAt ||
          JSON.stringify(currentBackup.data) !== JSON.stringify(expectedBackup.data)
        ) {
          throw new Error("選択したバックアップが変更または削除されています。一覧を更新してから再試行してください。");
        }

        const currentAutoSave = records.find((record) =>
          isStoredRecord(record) && record.slotId === AUTO_SAVE_SLOT
        );
        let safetyBackup: SaveBackupRecord | null = null;

        if (isStoredRecord(currentAutoSave) && Object.hasOwn(currentAutoSave, "data")) {
          const existingBackups = records
            .filter((record): record is Record<string, unknown> =>
              isStoredRecord(record) &&
              typeof record.slotId === "string" &&
              isBackupSlotId(record.slotId) &&
              typeof record.savedAt === "number" &&
              Number.isFinite(record.savedAt)
            )
            .map((record) => ({
              slotId: record.slotId as string,
              savedAt: record.savedAt as number,
              data: record.data
            }));
          const preservedBackups = getBackupRecordsToPreserveAfterRestore(
            existingBackups,
            expectedBackup.slotId
          );

          safetyBackup = {
            slotId: BACKUP_SLOT_PREFIX + "1",
            savedAt: Date.now(),
            data: currentAutoSave.data
          };

          for (let generation = 1; generation <= BACKUP_GENERATION_COUNT; generation += 1) {
            store.delete(BACKUP_SLOT_PREFIX + String(generation));
          }
          store.put(safetyBackup);
          preservedBackups.forEach((backup, index) => {
            store.put({
              slotId: BACKUP_SLOT_PREFIX + String(index + 2),
              savedAt: backup.savedAt,
              data: backup.data
            });
          });
        }

        store.put({ slotId: AUTO_SAVE_SLOT, savedAt: Date.now(), data });
        resolve(safetyBackup);
      } catch (error) {
        operationError = error instanceof Error ? error : new Error("Failed to restore the selected save backup.");
        try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(operationError);
      }
    };

    request.onerror = () => {
      operationError = request.error instanceof Error ? request.error : new Error("Failed to read save records for restore.");
      reject(operationError);
    };
  });

  try {
    const [safetyBackup] = await Promise.all([operation, completed]);
    return safetyBackup;
  } catch (error) {
    throw operationError ?? error;
  }
}

/**
 * Atomically keeps the current auto-save as backup-1 before importing a new snapshot.
 * Existing backup generations shift back by one slot; the oldest is discarded.
 */
export async function replaceGameStateWithBackup(
  data: GameStateSnapshot
): Promise<SaveBackupRecord | null> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const store = transaction.objectStore(SAVE_STORE);
  const request = store.getAll();
  let operationError: Error | undefined;

  const operation = new Promise<SaveBackupRecord | null>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const records = request.result as unknown[];
        const currentAutoSave = records.find((record) =>
          isStoredRecord(record) && record.slotId === AUTO_SAVE_SLOT
        );
        let safetyBackup: SaveBackupRecord | null = null;

        if (isStoredRecord(currentAutoSave) && Object.hasOwn(currentAutoSave, "data")) {
          const existingBackups = records
            .filter((record): record is Record<string, unknown> =>
              isStoredRecord(record) &&
              typeof record.slotId === "string" &&
              isBackupSlotId(record.slotId) &&
              typeof record.savedAt === "number" &&
              Number.isFinite(record.savedAt)
            )
            .map((record) => ({
              slotId: record.slotId as string,
              savedAt: record.savedAt as number,
              data: record.data
            }));
          const preservedBackups = getBackupRecordsToPreserveAfterReplacement(existingBackups);

          safetyBackup = {
            slotId: BACKUP_SLOT_PREFIX + "1",
            savedAt: Date.now(),
            data: currentAutoSave.data
          };

          for (let generation = 1; generation <= BACKUP_GENERATION_COUNT; generation += 1) {
            store.delete(BACKUP_SLOT_PREFIX + String(generation));
          }
          store.put(safetyBackup);
          preservedBackups.forEach((backup, index) => {
            store.put({
              slotId: BACKUP_SLOT_PREFIX + String(index + 2),
              savedAt: backup.savedAt,
              data: backup.data
            });
          });
        }

        store.put({ slotId: AUTO_SAVE_SLOT, savedAt: Date.now(), data });
        resolve(safetyBackup);
      } catch (error) {
        operationError = error instanceof Error
          ? error
          : new Error("Failed to preserve the auto-save before importing.");
        try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(operationError);
      }
    };

    request.onerror = () => {
      operationError = request.error instanceof Error
        ? request.error
        : new Error("Failed to read save records before importing.");
      reject(operationError);
    };
  });

  try {
    const [safetyBackup] = await Promise.all([operation, completed]);
    return safetyBackup;
  } catch (error) {
    throw operationError ?? error;
  }
}
