import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { acknowledgePendingMapEvents } from "./helpers/map-events";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";

async function waitForControlledServiceWorker(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) {
      throw new Error("The production service worker is not active.");
    }
  });
  await page.reload();
  await expect.poll(() => page.evaluate(
    () => navigator.serviceWorker.controller?.scriptURL ?? ""
  )).toContain("/sw.js");
}

async function startNewCampaign(page: Page): Promise<void> {
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
}

async function readAutoSave(page: Page): Promise<unknown | null> {
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

async function setOffline(context: BrowserContext): Promise<void> {
  await context.setOffline(true);
}

test.describe("WebKit mobile PWA lifecycle", () => {
  test("opens the cached application shell offline at a 320px touch viewport", async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await waitForControlledServiceWorker(page);
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();

    const cachedPaths = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const precacheName = cacheNames.find((name) => name.includes("precache"));
      if (!precacheName) return [];
      const cache = await caches.open(precacheName);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(cachedPaths.some((path) => path.endsWith("/index.html"))).toBe(true);
    expect(cachedPaths.some((path) => path.endsWith(".js"))).toBe(true);
    expect(cachedPaths.some((path) => path.endsWith(".css"))).toBe(true);

    await setOffline(context);
    await page.reload();

    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grid Tactics" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });

  test("resumes a committed battle save after an offline WebKit reload using touch input", async ({ page, context }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await waitForControlledServiceWorker(page);
    await startNewCampaign(page);

    await page.getByRole("button", { name: deploymentStartButton }).tap();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await acknowledgePendingMapEvents(page, { input: "tap" });

    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).tap();
    await page.getByRole("button", { name: "待機", exact: true }).tap();
    await expect(page.getByRole("status")).toContainText("主人公は待機しました。");

    await expect.poll(async () => {
      const saved = await readAutoSave(page) as {
        units?: Array<{ id?: string; faction?: string; hasActed?: boolean }>;
      } | null;
      return saved?.units?.some((unit) => unit.id === "unit_001" && unit.faction === "player" && unit.hasActed) ?? false;
    }).toBe(true);

    const committedSave = await readAutoSave(page);
    expect(committedSave).not.toBeNull();

    await setOffline(context);
    await page.reload();
    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await title.getByRole("button", { name: "つづきから" }).tap();

    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).tap();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
    expect(await readAutoSave(page)).toEqual(committedSave);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  });
});
