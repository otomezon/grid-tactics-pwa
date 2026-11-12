import { expect, test, type Page } from "@playwright/test";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";

async function startNewCampaign(page: Page): Promise<void> {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
}

async function readAutoSave(page: Page): Promise<unknown> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("grid-tactics-pwa", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
    });

    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = database.transaction("game-saves", "readonly");
        const request = transaction.objectStore("game-saves").get("auto");
        request.onsuccess = () => resolve((request.result as { data?: unknown } | undefined)?.data ?? null);
        request.onerror = () => reject(request.error ?? new Error("Could not read auto save."));
      });
    } finally {
      database.close();
    }
  });
}

test("edits active and reserve weapon loadouts before committing deployment", async ({ page }) => {
  await startNewCampaign(page);
  expect(await readAutoSave(page)).toBeNull();

  const fourthCandidate = page.locator(".deployment-unit").filter({ hasText: "味方04" });
  await fourthCandidate.getByRole("button", { name: "詳細" }).click();
  const fourthLoadout = page.getByRole("combobox", { name: "味方04の装備武器" });
  await expect(fourthLoadout).toHaveValue("iron_sword");
  await fourthLoadout.selectOption("iron_lance");
  await expect(page.locator("#deployment-detail-panel .deployment-detail-overview"))
    .toContainText("試作の鉄の槍");

  const firstCandidate = page.locator(".deployment-unit").filter({ hasText: "味方01" });
  await firstCandidate.getByRole("button", { name: "詳細" }).click();
  const firstLoadout = page.getByRole("combobox", { name: "味方01の装備武器" });
  await expect(firstLoadout).toHaveValue("iron_sword");
  await firstLoadout.selectOption("");
  await expect(page.locator("#deployment-detail-panel .deployment-detail-overview"))
    .toContainText("未装備");
  await firstCandidate.getByRole("checkbox").uncheck();
  await expect(page.locator("#deployment-detail-panel .deployment-detail-heading"))
    .toContainText("控え予定");
  expect(await readAutoSave(page)).toBeNull();

  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  await page.getByRole("button", { name: deploymentStartButton }).click();

  const saved = await readAutoSave(page) as {
    saveVersion: number;
    units: Array<{ id: string; faction: string; equippedWeaponId: string | null }>;
    reserveUnits: Array<{ id: string; equippedWeaponId: string | null }>;
  };
  expect(saved.saveVersion).toBe(3);
  expect(saved.units.find((unit) => unit.id === "unit_004")).toMatchObject({
    faction: "player",
    equippedWeaponId: "iron_lance"
  });
  expect(saved.units.some((unit) => unit.id === "unit_001")).toBe(false);
  expect(saved.reserveUnits.find((unit) => unit.id === "unit_001")?.equippedWeaponId).toBeNull();

  await page.reload();
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "つづきから" }).click();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  expect(await readAutoSave(page)).toEqual(saved);
});
