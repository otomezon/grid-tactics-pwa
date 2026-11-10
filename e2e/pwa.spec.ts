import { expect, test } from "@playwright/test";

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
});
