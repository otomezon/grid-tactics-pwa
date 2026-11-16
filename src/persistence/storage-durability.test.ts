import { describe, expect, it } from "vitest";
import {
  readStorageDurabilityStatus,
  requestStorageDurability,
  readStorageUsageEstimate,
  type StoragePersistenceApi
} from "./storage-durability";

function createStorageApi(options: {
  persisted?: boolean;
  persistResult?: boolean;
  readThrows?: boolean;
  requestThrows?: boolean;
} = {}): StoragePersistenceApi {
  return {
    persisted: async () => {
      if (options.readThrows) throw new Error("Permission state unavailable.");
      return options.persisted ?? false;
    },
    persist: async () => {
      if (options.requestThrows) throw new Error("Permission request failed.");
      return options.persistResult ?? false;
    }
  };
}

describe("browser storage durability", () => {
  it("reports granted when the browser already persists the origin", async () => {
    await expect(readStorageDurabilityStatus(createStorageApi({ persisted: true }))).resolves.toBe("granted");
  });

  it("reports not-granted without requesting permission", async () => {
    let requests = 0;
    const api = createStorageApi({ persisted: false });
    api.persist = async () => {
      requests += 1;
      return true;
    };
    await expect(readStorageDurabilityStatus(api)).resolves.toBe("not-granted");
    expect(requests).toBe(0);
  });

  it("reports unsupported when either persistence method is missing", async () => {
    await expect(readStorageDurabilityStatus(undefined)).resolves.toBe("unsupported");
    await expect(requestStorageDurability({ persisted: async () => false })).resolves.toBe("unsupported");
    await expect(requestStorageDurability({ persist: async () => true })).resolves.toBe("unsupported");
  });

  it("reports errors while reading permission without throwing", async () => {
    await expect(readStorageDurabilityStatus(createStorageApi({ readThrows: true }))).resolves.toBe("error");
  });

  it("reports a granted explicit request", async () => {
    await expect(requestStorageDurability(createStorageApi({ persistResult: true }))).resolves.toBe("granted");
  });

  it("reports a denied explicit request", async () => {
    await expect(requestStorageDurability(createStorageApi({ persistResult: false }))).resolves.toBe("not-granted");
  });

  it("reports request errors without throwing", async () => {
    await expect(requestStorageDurability(createStorageApi({ requestThrows: true }))).resolves.toBe("error");
  });

  it("reads the origin usage and quota estimate without requesting persistence", async () => {
    let persistCalls = 0;
    const api: StoragePersistenceApi = {
      persisted: async () => false,
      persist: async () => {
        persistCalls += 1;
        return true;
      },
      estimate: async () => ({ usage: 12_345, quota: 98_765 })
    };

    await expect(readStorageUsageEstimate(api)).resolves.toEqual({
      status: "available",
      usageBytes: 12_345,
      quotaBytes: 98_765
    });
    expect(persistCalls).toBe(0);
  });

  it("reports unsupported when the estimate method is unavailable", async () => {
    await expect(readStorageUsageEstimate(undefined)).resolves.toEqual({ status: "unsupported" });
    await expect(readStorageUsageEstimate({ persisted: async () => false })).resolves.toEqual({ status: "unsupported" });
  });

  it("reports estimate failures without throwing", async () => {
    await expect(readStorageUsageEstimate({
      estimate: async () => { throw new Error("Estimate unavailable."); }
    })).resolves.toEqual({ status: "error" });
  });

  it("rejects incomplete or invalid estimates", async () => {
    const invalidEstimates = [
      { usage: Number.NaN, quota: 100 },
      { usage: -1, quota: 100 },
      { usage: 10, quota: Number.POSITIVE_INFINITY },
      { usage: 10, quota: 0 },
      { usage: 10 }
    ];
    for (const estimate of invalidEstimates) {
      await expect(readStorageUsageEstimate({
        estimate: async () => estimate
      })).resolves.toEqual({ status: "error" });
    }
  });
});
