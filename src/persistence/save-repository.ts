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

export async function loadGameState(
  slotId: string = AUTO_SAVE_SLOT
): Promise<unknown | null> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readonly");
  const completed = transactionCompleted(transaction);
  const request = transaction.objectStore(SAVE_STORE).get(slotId);

  const [record] = await Promise.all([
    new Promise<SaveRecord | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as SaveRecord | undefined);
      request.onerror = () => {
        reject(request.error ?? new Error("Failed to read save data."));
      };
    }),
    completed
  ]);

  if (record === undefined) return null;

  if (
    typeof record !== "object" ||
    record === null ||
    record.slotId !== slotId ||
    typeof record.data !== "object" ||
    record.data === null
  ) {
    throw new Error("The stored save record has an invalid format.");
  }

  return record.data;
}

export async function saveGameState(
  data: GameStateSnapshot,
  slotId: string = AUTO_SAVE_SLOT
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const record: SaveRecord = {
    slotId,
    savedAt: Date.now(),
    data
  };

  transaction.objectStore(SAVE_STORE).put(record);
  await completed;
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
export async function createGameStateBackup(): Promise<SaveBackupRecord> {
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
 * Restores a previously validated snapshot to auto. The selected backup is
 * re-read in the same transaction so a changed/deleted record cannot silently
 * replace the current auto-save.
 */
export async function restoreGameStateBackup(
  expectedBackup: SaveBackupRecord,
  data: GameStateSnapshot
): Promise<void> {
  if (!isBackupSlotId(expectedBackup.slotId)) {
    throw new Error("The requested save backup slot is invalid.");
  }

  const database = await openDatabase();
  const transaction = database.transaction(SAVE_STORE, "readwrite");
  const completed = transactionCompleted(transaction);
  const store = transaction.objectStore(SAVE_STORE);
  const request = store.get(expectedBackup.slotId);
  let operationError: Error | undefined;

  const operation = new Promise<void>((resolve, reject) => {
    request.onsuccess = () => {
      try {
        const current = request.result;
        if (
          !isStoredRecord(current) ||
          current.slotId !== expectedBackup.slotId ||
          current.savedAt !== expectedBackup.savedAt ||
          JSON.stringify(current.data) !== JSON.stringify(expectedBackup.data)
        ) {
          throw new Error("選択したバックアップが変更または削除されています。一覧を更新してから再試行してください。");
        }

        store.put({ slotId: AUTO_SAVE_SLOT, savedAt: Date.now(), data });
        resolve();
      } catch (error) {
        operationError = error instanceof Error ? error : new Error("Failed to restore the selected save backup.");
        try { transaction.abort(); } catch { /* The transaction may already have aborted. */ }
        reject(operationError);
      }
    };

    request.onerror = () => {
      operationError = request.error instanceof Error ? request.error : new Error("Failed to read the selected save backup.");
      reject(operationError);
    };
  });

  try {
    await Promise.all([operation, completed]);
  } catch (error) {
    throw operationError ?? error;
  }
}
