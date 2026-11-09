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
