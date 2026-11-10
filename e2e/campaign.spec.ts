import { expect, test, type Page } from "@playwright/test";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";

async function startBattle(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await page.getByRole("button", { name: deploymentStartButton }).click();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
}

async function readAutoSave(page: Page) {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("grid-tactics-pwa", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
    });

    try {
      const record = await new Promise<{ data?: unknown } | undefined>((resolve, reject) => {
        const transaction = database.transaction("game-saves", "readonly");
        const request = transaction.objectStore("game-saves").get("auto");
        request.onsuccess = () => resolve(request.result as { data?: unknown } | undefined);
        request.onerror = () => reject(request.error ?? new Error("Could not read auto save."));
      });
      return record?.data ?? null;
    } finally {
      database.close();
    }
  });
}

async function updateAutoSaveUnit(
  page: Page,
  unitId: string,
  updates: { level?: number; experience?: number; inventory?: string[]; hasMoved?: boolean; hasActed?: boolean }
): Promise<void> {
  await page.evaluate(async ({ targetUnitId, unitUpdates }) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("grid-tactics-pwa", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
    });

    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction("game-saves", "readwrite");
        const store = transaction.objectStore("game-saves");
        const request = store.get("auto");
        request.onsuccess = () => {
          const record = request.result as {
            slotId: string;
            savedAt: number;
            data: {
              units: Array<Record<string, unknown>>;
            };
          } | undefined;
          if (!record) {
            transaction.abort();
            reject(new Error("Auto save is missing."));
            return;
          }
          const target = record.data.units.find((unit) => unit.id === targetUnitId);
          if (!target) {
            transaction.abort();
            reject(new Error("Target unit is missing from auto save."));
            return;
          }
          store.put({
            ...record,
            savedAt: Date.now(),
            data: {
              ...record.data,
              units: record.data.units.map((unit) =>
                unit.id === targetUnitId ? { ...unit, ...unitUpdates } : unit
              )
            }
          });
        };
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Could not update auto save."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Auto save update was aborted."));
      });
    } finally {
      database.close();
    }
  }, { targetUnitId: unitId, unitUpdates: updates });
}

test.describe("browser campaign flow", () => {
  test("shows candidate details and persists the selected deployment roster", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();

    const firstCandidate = page.locator(".deployment-unit").filter({ hasText: "味方01" });
    await firstCandidate.getByRole("button", { name: "詳細" }).click();

    const detailPanel = page.locator("#deployment-detail-panel");
    await expect(detailPanel.getByRole("heading", { name: "味方01" })).toBeVisible();
    await expect(detailPanel).toContainText("試作の鉄の剣");
    await expect(detailPanel).not.toContainText("クラスチェンジの証");

    const fourthCandidate = page.locator(".deployment-unit").filter({ hasText: "味方04" });
    await fourthCandidate.getByRole("checkbox").uncheck();
    await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");

    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedState = await readAutoSave(page) as {
      units: Array<{ id: string; faction: string }>;
      reserveUnits: Array<{ id: string }>;
    };
    expect(savedState.units.some((unit) => unit.id === "unit_004" && unit.faction === "player")).toBe(false);
    expect(savedState.reserveUnits.map((unit) => unit.id)).toContain("unit_004");

    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.locator(".deployment-panel")).toHaveCount(0);
  });

  test("persists a player action across reload", async ({ page }) => {
    await startBattle(page);

    await page.getByRole("button", { name: /味方01/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("味方01は待機しました。");

    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });

  test("promotion consumes the unit action and persists the promoted state", async ({ page }) => {
    await startBattle(page);
    await expect(page.getByRole("status")).toContainText("出撃配置を確定し、自動保存しました。");
    await updateAutoSaveUnit(page, "unit_001", {
      level: 10,
      experience: 37,
      inventory: ["iron_sword", "promotion_seal"]
    });
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    await page.getByRole("button", { name: /味方01/ }).click();
    const promotionButton = page.getByRole("button", { name: "クラスチェンジを確認" });
    await expect(promotionButton).toBeEnabled();
    await promotionButton.click();
    const confirmation = page.getByRole("group", { name: "クラスチェンジ確認" });
    await expect(confirmation).toContainText("このユニットの行動も消費します");
    await confirmation.getByRole("button", { name: "昇格を確定" }).click();
    await expect(page.getByRole("status")).toContainText("クラスチェンジしました。");

    const savedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        classId: string;
        level: number;
        experience: number;
        hasMoved: boolean;
        hasActed: boolean;
        inventory: string[];
      }>;
    };
    const promotedUnit = savedState.units.find((unit) => unit.id === "unit_001");
    expect(promotedUnit).toMatchObject({
      classId: "swordmaster",
      level: 1,
      experience: 37,
      hasMoved: false,
      hasActed: true
    });
    expect(promotedUnit?.inventory).not.toContain("promotion_seal");

    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
    await expect(page.getByRole("button", { name: "クラスチェンジを確認" })).toBeDisabled();
  });

  test("resolves the enemy phase and restores the next player turn", async ({ page }) => {
    await startBattle(page);

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", {
      timeout: 15_000
    });

    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
  });

  test("keeps deployment details usable at a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();

    const archerCandidate = page.locator(".deployment-unit").filter({ hasText: "味方02" });
    await archerCandidate.getByRole("button", { name: "詳細" }).click();

    const detailPanel = page.locator("#deployment-detail-panel");
    await expect(detailPanel.getByRole("heading", { name: "味方02" })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      panelWidth: document.querySelector("#deployment-detail-panel")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.panelWidth).toBeGreaterThan(0);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  });
});
