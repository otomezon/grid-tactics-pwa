import { expect, test, type Page } from "@playwright/test";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";
const navigationCountKey = "__pwa_e2e_navigation_count";

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

test.describe("production PWA shell", () => {
  test("publishes a valid installable manifest and active service worker", async ({ page }) => {
    await page.goto("/");

    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(manifestHref).toBeTruthy();

    const manifest = await page.evaluate(async (href) => {
      const response = await fetch(href!);
      if (!response.ok) throw new Error("Web app manifest could not be fetched.");
      return response.json() as Promise<{
        name: string;
        short_name: string;
        display: string;
        start_url: string;
        scope: string;
        icons: Array<{ src: string; sizes: string; type: string; purpose?: string }>;
      }>;
    }, manifestHref);

    expect(manifest.name).toBe("Grid Tactics PWA");
    expect(manifest.short_name).toBe("Grid Tactics");
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ src: "/icons/pwa-192.svg", sizes: "192x192" }),
      expect.objectContaining({ src: "/icons/pwa-512.svg", sizes: "512x512", purpose: "maskable" })
    ]));

    const registration = await page.evaluate(async () => {
      const activeRegistration = await navigator.serviceWorker.ready;
      return {
        scope: activeRegistration.scope,
        activeScript: activeRegistration.active?.scriptURL ?? null
      };
    });

    expect(registration.scope).toBe(new URL("/", page.url()).href);
    expect(registration.activeScript).toContain("/sw.js");

    await page.reload();
    await expect.poll(() => page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? ""
    )).toContain("/sw.js");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  });

  test("reopens the cached application shell after going offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? ""
    )).toContain("/sw.js");
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();

    const precacheEntries = await page.evaluate(async () => {
      const cacheNames = await caches.keys();
      const precacheName = cacheNames.find((name) => name.includes("precache"));
      if (!precacheName) return [];
      const cache = await caches.open(precacheName);
      return (await cache.keys()).map((request) => new URL(request.url).pathname);
    });
    expect(precacheEntries.some((path) => path.endsWith("/index.html"))).toBe(true);
    expect(precacheEntries.some((path) => path.endsWith(".js"))).toBe(true);
    expect(precacheEntries.some((path) => path.endsWith(".css"))).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grid Tactics" })).toBeVisible();
  });

  test("reloads for a service-worker update without losing the autosaved battle state", async ({ page, context }) => {
    await page.addInitScript((key) => {
      const currentCount = Number(sessionStorage.getItem(key) ?? "0");
      sessionStorage.setItem(key, String(currentCount + 1));
    }, navigationCountKey);

    await page.goto("/");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? ""
    )).toContain("/sw.js");

    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.getByRole("button", { name: /味方01/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("味方01は待機しました。");

    await expect.poll(async () => {
      const savedState = await readAutoSave(page) as {
        units?: Array<{ faction?: string; hasActed?: boolean }>;
      } | null;
      return savedState?.units?.some((unit) => unit.faction === "player" && unit.hasActed) ?? false;
    }).toBe(true);

    const navigationCountBeforeUpdate = await page.evaluate(
      (key) => Number(sessionStorage.getItem(key) ?? "0"),
      navigationCountKey
    );

    await page.evaluate(async () => {
      const response = await fetch("/__test/force-sw-update", { method: "POST" });
      if (!response.ok) throw new Error("Could not prepare a service-worker update.");

      const registration = await navigator.serviceWorker.ready;
      void registration.update().catch(() => undefined);
    });

    await expect.poll(
      () => page.evaluate((key) => Number(sessionStorage.getItem(key) ?? "0"), navigationCountKey),
      { timeout: 30_000 }
    ).toBeGreaterThan(navigationCountBeforeUpdate);

    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });
});
