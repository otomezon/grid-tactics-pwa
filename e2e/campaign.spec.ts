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

test.describe("browser campaign flow", () => {
  test("shows candidate details and persists the selected deployment roster", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();

    const firstCandidate = page.locator(".deployment-unit").filter({ hasText: "味方01" });
    await firstCandidate.getByRole("button", { name: "詳細" }).click();

    const detailPanel = page.locator("#deployment-detail-panel");
    await expect(detailPanel.getByRole("heading", { name: "味方01" })).toBeVisible();
    await expect(detailPanel).toContainText("試作の鉄の剣");
    await expect(detailPanel).toContainText("クラスチェンジの証");

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
