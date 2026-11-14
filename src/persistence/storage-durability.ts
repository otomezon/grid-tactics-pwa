export type StorageDurabilityStatus = "granted" | "not-granted" | "unsupported" | "error";

export interface StoragePersistenceApi {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
}

export function getStoragePersistenceApi(): StoragePersistenceApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage as unknown as StoragePersistenceApi | undefined;
}

function supportsStoragePersistence(
  api: StoragePersistenceApi | undefined
): api is Required<StoragePersistenceApi> {
  return typeof api?.persisted === "function" && typeof api.persist === "function";
}

/** Reads the browser's current persistent-storage permission without requesting it. */
export async function readStorageDurabilityStatus(
  api: StoragePersistenceApi | undefined = getStoragePersistenceApi()
): Promise<StorageDurabilityStatus> {
  if (!supportsStoragePersistence(api)) return "unsupported";
  try {
    return await api.persisted() ? "granted" : "not-granted";
  } catch {
    return "error";
  }
}

/** Requests persistent storage. Call only in direct response to an explicit user action. */
export async function requestStorageDurability(
  api: StoragePersistenceApi | undefined = getStoragePersistenceApi()
): Promise<StorageDurabilityStatus> {
  if (!supportsStoragePersistence(api)) return "unsupported";
  try {
    return await api.persist() ? "granted" : "not-granted";
  } catch {
    return "error";
  }
}
