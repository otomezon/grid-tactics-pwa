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


async function writeAutoSave(page: Page, data: unknown): Promise<void> {
  await page.evaluate(async (nextData) => {
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
            data: unknown;
          } | undefined;
          if (!record) {
            transaction.abort();
            reject(new Error("Auto save record does not exist."));
            return;
          }
          store.put({ ...record, savedAt: Date.now(), data: nextData });
        };
        request.onerror = () => reject(request.error ?? new Error("Could not read auto save."));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Could not write auto save."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Auto save transaction aborted."));
      });
    } finally {
      database.close();
    }
  }, data);
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

  test("allows promotion only before movement and consumes the unit action", async ({ page }) => {
    await startBattle(page);

    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        level: number;
        inventory: string[];
        hasMoved: boolean;
        hasActed: boolean;
        classId: string;
      }>;
    };
    const preparedUnit = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!preparedUnit) throw new Error("Promotion test unit is missing from the auto save.");

    preparedUnit.level = 10;
    preparedUnit.inventory = [...preparedUnit.inventory, "promotion_seal"];
    preparedUnit.hasMoved = true;
    preparedUnit.hasActed = false;
    await writeAutoSave(page, preparedState);
    await page.reload();

    await page.getByRole("button", { name: /味方01/ }).click();
    const promotionPanel = page.locator(".promotion-panel");
    await expect(promotionPanel).toContainText("移動・行動前のみ可能");
    await expect(promotionPanel.getByRole("button", { name: "クラスチェンジを確認" })).toBeDisabled();

    preparedUnit.hasMoved = false;
    await writeAutoSave(page, preparedState);
    await page.reload();

    await page.getByRole("button", { name: /味方01/ }).click();
    await promotionPanel.getByRole("button", { name: "クラスチェンジを確認" }).click();
    const confirmation = page.getByRole("group", { name: "クラスチェンジ確認" });
    await expect(confirmation).toContainText("昇格後は行動済みになります");

    const beforeCancel = await readAutoSave(page);
    await confirmation.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("group", { name: "クラスチェンジ確認" })).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(beforeCancel);

    await promotionPanel.getByRole("button", { name: "クラスチェンジを確認" }).click();
    const confirmedAgain = page.getByRole("group", { name: "クラスチェンジ確認" });
    await expect(confirmedAgain).toContainText("昇格後は行動済みになります");
    await confirmedAgain.getByRole("button", { name: "昇格を確定" }).click();
    await expect(page.getByRole("status")).toContainText("このフェイズの行動を消費しました");

    const promotedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        classId: string;
        level: number;
        hasMoved: boolean;
        hasActed: boolean;
        inventory: string[];
      }>;
    };
    expect(promotedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
      classId: "swordmaster",
      level: 1,
      hasMoved: false,
      hasActed: true
    });
    expect(promotedState.units.find((unit) => unit.id === "unit_001")?.inventory).not.toContain("promotion_seal");

    await page.reload();
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
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
