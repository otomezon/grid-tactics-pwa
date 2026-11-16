export type StorageDurabilityStatus = "granted" | "not-granted" | "unsupported" | "error";

export interface StorageEstimateData {
  usage?: number;
  quota?: number;
}

export interface StoragePersistenceApi {
  persisted?: () => Promise<boolean>;
  persist?: () => Promise<boolean>;
  estimate?: () => Promise<StorageEstimateData>;
}

export type StorageUsageEstimateResult =
  | { status: "available"; usageBytes: number; quotaBytes: number }
  | { status: "unsupported" | "error" };

export function getStoragePersistenceApi(): StoragePersistenceApi | undefined {
  if (typeof navigator === "undefined") return undefined;
  return navigator.storage as unknown as StoragePersistenceApi | undefined;
}

function supportsStoragePersistence(
  api: StoragePersistenceApi | undefined
): api is StoragePersistenceApi & Required<Pick<StoragePersistenceApi, "persisted" | "persist">> {
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

/**
 * Reads the browser's approximate usage and quota for the whole origin.
 * This is informational only and does not request persistent storage.
 */
export async function readStorageUsageEstimate(
  api: StoragePersistenceApi | undefined = getStoragePersistenceApi()
): Promise<StorageUsageEstimateResult> {
  if (typeof api?.estimate !== "function") return { status: "unsupported" };
  try {
    const estimate = await api.estimate();
    if (
      typeof estimate.usage !== "number" ||
      !Number.isFinite(estimate.usage) ||
      estimate.usage < 0 ||
      typeof estimate.quota !== "number" ||
      !Number.isFinite(estimate.quota) ||
      estimate.quota <= 0
    ) {
      return { status: "error" };
    }
    return {
      status: "available",
      usageBytes: estimate.usage,
      quotaBytes: estimate.quota
    };
  } catch {
    return { status: "error" };
  }
}
