import { describe, expect, it } from "vitest";
import { getStorageOperationErrorMessage } from "./storage-error";

describe("storage operation error guidance", () => {
  it("explains how to recover from browser storage quota exhaustion", () => {
    const message = getStorageOperationErrorMessage({ name: "QuotaExceededError" });

    expect(message).toContain("保存容量が不足");
    expect(message).toContain("セーブJSONを書き出して保管");
    expect(message).toContain("空き容量を確保");
  });

  it("explains browser storage restrictions without assuming a specific browser", () => {
    const message = getStorageOperationErrorMessage({ name: "SecurityError" });

    expect(message).toContain("ローカル保存を制限");
    expect(message).toContain("プライベートブラウズ");
    expect(message).toContain("通常の閲覧モード");
  });

  it("leaves unrelated errors to the existing generic error handling", () => {
    expect(getStorageOperationErrorMessage(new Error("Unrelated failure."))).toBeUndefined();
    expect(getStorageOperationErrorMessage({ name: "AbortError" })).toBeUndefined();
    expect(getStorageOperationErrorMessage(null)).toBeUndefined();
  });
});
