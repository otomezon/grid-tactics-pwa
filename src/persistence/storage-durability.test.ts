import { describe, expect, it } from "vitest";
import {
  readStorageDurabilityStatus,
  requestStorageDurability,
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
});
