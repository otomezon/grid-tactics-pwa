import { expect, test, type Page } from "@playwright/test";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";
const navigationCountKey = "__pwa_e2e_navigation_count";

async function acknowledgePendingMapEvents(page: Page): Promise<void> {
  const dialog = page.getByTestId("map-event-dialog");
  while (await dialog.count()) {
    await dialog.getByRole("button", { name: /次のイベントへ|確認して続ける/ }).click();
  }
  await expect(dialog).toHaveCount(0);
}

async function enterNewCampaign(page: Page): Promise<void> {
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
}

async function startBattle(page: Page): Promise<void> {
  await page.goto("/");
  await enterNewCampaign(page);
  await page.getByRole("button", { name: deploymentStartButton }).click();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await acknowledgePendingMapEvents(page);
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

async function readBackupRecords(page: Page): Promise<Array<{
  slotId: string;
  savedAt: number;
  data: { turn?: number; saveVersion?: number; chapterId?: string };
}>> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("grid-tactics-pwa", 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
    });

    try {
      return await new Promise<Array<{
        slotId: string;
        savedAt: number;
        data: { turn?: number; saveVersion?: number; chapterId?: string };
      }>>((resolve, reject) => {
        const transaction = database.transaction("game-saves", "readonly");
        const request = transaction.objectStore("game-saves").getAll();
        request.onsuccess = () => resolve(
          (request.result as Array<{
            slotId: string;
            savedAt: number;
            data: { turn?: number; saveVersion?: number; chapterId?: string };
          }>).filter((record) => /^backup-[1-3]$/.test(record.slotId))
        );
        request.onerror = () => reject(request.error ?? new Error("Could not read save backups."));
      });
    } finally {
      database.close();
    }
  });
}

async function setAutoSaveTurn(page: Page, turn: number): Promise<void> {
  await page.evaluate(async (nextTurn) => {
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
          const record = request.result as { slotId: string; savedAt: number; data: { turn: number } } | undefined;
          if (!record) {
            transaction.abort();
            reject(new Error("Auto-save is missing."));
            return;
          }
          store.put({ ...record, data: { ...record.data, turn: nextTurn } });
        };
        request.onerror = () => reject(request.error ?? new Error("Could not read auto-save."));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error ?? new Error("Could not update auto-save."));
        transaction.onabort = () => reject(transaction.error ?? new Error("Auto-save update was aborted."));
      });
    } finally {
      database.close();
    }
  }, turn);
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
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
  });

  test("offers the browser install prompt and reflects successful installation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("pwa-install-help")).toBeVisible();
    await expect(page.getByTestId("pwa-install-button")).toHaveCount(0);

    const promptWasCaptured = await page.evaluate(() => {
      const testWindow = window as Window & { __pwaInstallPromptCalls?: number };
      testWindow.__pwaInstallPromptCalls = 0;
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
      };
      event.prompt = async () => {
        testWindow.__pwaInstallPromptCalls = (testWindow.__pwaInstallPromptCalls ?? 0) + 1;
      };
      event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(promptWasCaptured).toBe(true);

    const installButton = page.getByTestId("pwa-install-button");
    await expect(installButton).toBeVisible();
    await installButton.click();
    await expect.poll(() => page.evaluate(
      () => (window as Window & { __pwaInstallPromptCalls?: number }).__pwaInstallPromptCalls ?? 0
    )).toBe(1);
    await expect(page.getByRole("status")).toContainText("インストールを開始しました。");
    await expect(installButton).toHaveCount(0);

    await page.evaluate(() => window.dispatchEvent(new Event("appinstalled")));
    await expect(page.getByTestId("pwa-installed-status")).toBeVisible();
    await expect(page.getByTestId("pwa-install-help")).toHaveCount(0);
  });

  test("keeps manual install guidance when the browser prompt is dismissed", async ({ page }) => {
    await page.goto("/");
    const promptWasCaptured = await page.evaluate(() => {
      const event = new Event("beforeinstallprompt", { cancelable: true }) as Event & {
        prompt: () => Promise<void>;
        userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
      };
      event.prompt = async () => undefined;
      event.userChoice = Promise.resolve({ outcome: "dismissed", platform: "web" });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(promptWasCaptured).toBe(true);

    await page.getByTestId("pwa-install-button").click();
    await expect(page.getByRole("status")).toContainText("インストールはキャンセルされました。");
    await expect(page.getByTestId("pwa-install-button")).toHaveCount(0);
    await expect(page.getByTestId("pwa-install-help")).toBeVisible();
  });

  test("reopens the cached application shell after going offline", async ({ page, context }) => {
    await page.goto("/");
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();

    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? ""
    )).toContain("/sw.js");
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();

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
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grid Tactics" })).toBeVisible();
  });


  test("exports a battle save and restores it in a fresh browser context", async ({ page, browser }) => {
    await startBattle(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("主人公は待機しました。");

    await expect.poll(async () => {
      const savedState = await readAutoSave(page) as {
        units?: Array<{ faction?: string; hasActed?: boolean }>;
      } | null;
      return savedState?.units?.some((unit) => unit.faction === "player" && unit.hasActed) ?? false;
    }).toBe(true);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "セーブを書き出す" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^grid-tactics-chapter-01-.*\.json$/);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const freshContext = await browser.newContext({ baseURL: "http://127.0.0.1:4173" });
    try {
      const importPage = await freshContext.newPage();
      await importPage.goto("/");
      await enterNewCampaign(importPage);
      importPage.on("dialog", (dialog) => dialog.accept());

      await importPage.locator('[data-testid="save-import-input"]').setInputFiles(filePath!);
      await expect(importPage.getByRole("status")).toContainText("セーブファイルからゲーム状態を復元しました。");
      await expect(importPage.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
      await importPage.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
      await expect(importPage.locator(".unit-details")).toContainText("行動済み");

      const importedState = await readAutoSave(importPage) as {
        units: Array<{ faction: string; hasActed: boolean }>;
      };
      expect(importedState.units.some((unit) => unit.faction === "player" && unit.hasActed)).toBe(true);
    } finally {
      await freshContext.close();
    }
  });

  test("rejects an invalid save file without overwriting the current autosave", async ({ page }) => {
    await startBattle(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("主人公は待機しました。");

    const originalSave = await readAutoSave(page);
    expect(originalSave).not.toBeNull();

    const invalidFile = {
      name: "invalid-grid-tactics-save.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        format: "grid-tactics-pwa-save",
        formatVersion: 1,
        exportedAt: "2026-11-10T12:00:00.000Z",
        data: { saveVersion: 99, chapterId: "chapter_01_map" }
      }))
    };
    await page.locator('[data-testid="save-import-input"]').setInputFiles(invalidFile);
    await expect(page.getByRole("status")).toContainText("現在の章マップまたは保存形式と一致しません。");
    expect(await readAutoSave(page)).toEqual(originalSave);

    const invalidTerrainSnapshot = JSON.parse(JSON.stringify(originalSave)) as {
      units: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const cavalry = invalidTerrainSnapshot.units.find((unit) => unit.id === "unit_004");
    if (!cavalry) throw new Error("Expected cavalry unit is missing from the autosave.");
    cavalry.position = { x: 8, y: 6 };

    const invalidTerrainFile = {
      name: "invalid-terrain-grid-tactics-save.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        format: "grid-tactics-pwa-save",
        formatVersion: 1,
        exportedAt: "2026-11-10T12:00:00.000Z",
        data: invalidTerrainSnapshot
      }))
    };
    await page.locator('[data-testid="save-import-input"]').setInputFiles(invalidTerrainFile);
    await expect(page.getByRole("status")).toContainText("現在の章マップまたは保存形式と一致しません。");
    expect(await readAutoSave(page)).toEqual(originalSave);

    const invalidReferenceSnapshot = JSON.parse(JSON.stringify(originalSave)) as {
      units: Array<{ id: string; classId: string; inventory: string[] }>;
    };
    const swordsman = invalidReferenceSnapshot.units.find((unit) => unit.id === "unit_001");
    if (!swordsman) throw new Error("Expected swordsman is missing from the autosave.");
    swordsman.classId = "unregistered_class";

    const invalidReferenceFile = {
      name: "invalid-reference-grid-tactics-save.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        format: "grid-tactics-pwa-save",
        formatVersion: 1,
        exportedAt: "2026-11-10T12:00:00.000Z",
        data: invalidReferenceSnapshot
      }))
    };
    await page.locator('[data-testid="save-import-input"]').setInputFiles(invalidReferenceFile);
    await expect(page.getByRole("status")).toContainText("現在の章マップまたは保存形式と一致しません。");
    expect(await readAutoSave(page)).toEqual(originalSave);
  });

  test("reloads for a service-worker update without losing the autosaved battle state", async ({ page, context }) => {
    await page.addInitScript((key) => {
      const currentCount = Number(sessionStorage.getItem(key) ?? "0");
      sessionStorage.setItem(key, String(currentCount + 1));
    }, navigationCountKey);

    await page.goto("/");
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect.poll(() => page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? ""
    )).toContain("/sw.js");
    await enterNewCampaign(page);
    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await acknowledgePendingMapEvents(page);
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("主人公は待機しました。");

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

    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    await page.getByRole("button", { name: "つづきから" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    await page.getByRole("button", { name: "つづきから" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /主人公/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });
  test("creates three backup generations, rotates the oldest, and validates confirmed restores", async ({ page }) => {
    await startBattle(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const initialAutoSave = await readAutoSave(page);
    expect(initialAutoSave).not.toBeNull();
    await page.getByTestId("create-save-backup").click();
    await expect(page.getByRole("status")).toContainText("バックアップを作成しました。");
    expect(await readAutoSave(page)).toEqual(initialAutoSave);

    for (const turn of [2, 3, 4]) {
      await setAutoSaveTurn(page, turn);
      const autoSaveBeforeBackup = await readAutoSave(page);
      await page.getByTestId("create-save-backup").click();
      await expect(page.getByRole("status")).toContainText("バックアップを作成しました。");
      expect(await readAutoSave(page)).toEqual(autoSaveBeforeBackup);
    }

    const backups = await readBackupRecords(page);
    expect(backups).toHaveLength(3);
    expect(backups.map((backup) => backup.slotId)).toEqual(["backup-1", "backup-2", "backup-3"]);
    expect(backups.map((backup) => backup.data.turn)).toEqual([4, 3, 2]);
    expect(backups.every((backup) => backup.data.chapterId === "chapter_01_map")).toBe(true);
    expect((await readAutoSave(page) as { turn: number }).turn).toBe(4);
    await expect(page.getByTestId("save-backup-entry-backup-1")).toContainText("chapter_01_map");

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("現在の自動セーブを置き換えます");
      expect(dialog.message()).toContain("現在の進行状態は失われます");
      await dialog.accept();
    });
    await page.getByTestId("restore-backup-3").click();
    await expect(page.getByRole("status")).toContainText("バックアップからゲーム状態を復元しました。");
    expect((await readAutoSave(page) as { turn: number }).turn).toBe(2);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");

    const beforeCancel = await readAutoSave(page);
    const messageBeforeCancel = await page.getByRole("status").textContent();
    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByTestId("restore-backup-2").click();
    expect(await readAutoSave(page)).toEqual(beforeCancel);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
    expect(await page.getByRole("status").textContent()).toBe(messageBeforeCancel);

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("grid-tactics-pwa", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("game-saves", "readwrite");
          const store = transaction.objectStore("game-saves");
          const request = store.get("backup-1");
          request.onsuccess = () => {
            const record = request.result as { slotId: string; savedAt: number; data: Record<string, unknown> };
            const legacyData: Record<string, unknown> = { ...record.data, saveVersion: 2 };
            delete legacyData.reserveUnits;
            store.put({ ...record, data: legacyData });
          };
          request.onerror = () => reject(request.error ?? new Error("Could not read backup for migration test."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Could not prepare legacy backup."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Legacy backup update was aborted."));
        });
      } finally {
        database.close();
      }
    });

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("現在の自動セーブを置き換えます");
      await dialog.accept();
    });
    await page.getByTestId("restore-backup-1").click();
    await expect(page.getByRole("status")).toContainText("旧形式のバックアップを変換して復元しました。");
    const migratedAutoSave = await readAutoSave(page) as {
      turn: number;
      saveVersion: number;
      reserveUnits: unknown[];
      firedMapEventIds: string[];
      acknowledgedMapEventIds: string[];
    };
    expect(migratedAutoSave.turn).toBe(4);
    expect(migratedAutoSave.saveVersion).toBe(6);
    expect(migratedAutoSave.reserveUnits).toEqual([]);
    expect(migratedAutoSave.firedMapEventIds).toEqual([]);
    expect(migratedAutoSave.acknowledgedMapEventIds).toEqual([]);
    await expect(page.locator(".phase-badge")).toHaveText("第4ターン · 自軍フェイズ");

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("grid-tactics-pwa", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("game-saves", "readwrite");
          const store = transaction.objectStore("game-saves");
          const request = store.get("backup-1");
          request.onsuccess = () => {
            const record = request.result as { slotId: string; savedAt: number; data: Record<string, unknown> };
            store.put({ ...record, data: { ...record.data, saveVersion: 99 } });
          };
          request.onerror = () => reject(request.error ?? new Error("Could not read backup to corrupt."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Could not corrupt backup."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Backup corruption was aborted."));
        });
      } finally {
        database.close();
      }
    });

    const autoSaveBeforeInvalidRestore = await readAutoSave(page);
    await page.getByTestId("restore-backup-1").click();
    await expect(page.getByRole("status")).toContainText("バックアップを復元できません。");
    expect(await readAutoSave(page)).toEqual(autoSaveBeforeInvalidRestore);

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("grid-tactics-pwa", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("game-saves", "readwrite");
          const store = transaction.objectStore("game-saves");
          const request = store.getAll();
          request.onsuccess = () => {
            const records = request.result as Array<{
              slotId: string;
              savedAt: number;
              data: Record<string, unknown>;
            }>;
            const invalidSnapshot = records.find((record) => record.slotId === "backup-2");
            const unknownChapter = records.find((record) => record.slotId === "backup-3");
            if (!invalidSnapshot || !unknownChapter) {
              transaction.abort();
              reject(new Error("Expected backup generations are missing."));
              return;
            }
            store.put({ ...invalidSnapshot, data: { ...invalidSnapshot.data, turn: 0 } });
            store.put({ ...unknownChapter, data: { ...unknownChapter.data, chapterId: "unknown_chapter" } });
          };
          request.onerror = () => reject(request.error ?? new Error("Could not read backups to validate."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Could not prepare invalid backups."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Invalid backup update was aborted."));
        });
      } finally {
        database.close();
      }
    });

    await page.getByTestId("restore-backup-2").click();
    await expect(page.getByRole("status")).toContainText("バックアップを復元できません。");
    expect(await readAutoSave(page)).toEqual(autoSaveBeforeInvalidRestore);

    await page.getByTestId("restore-backup-3").click();
    await expect(page.getByRole("status")).toContainText("バックアップを復元できません。");
    expect(await readAutoSave(page)).toEqual(autoSaveBeforeInvalidRestore);

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("grid-tactics-pwa", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("game-saves", "readwrite");
          const store = transaction.objectStore("game-saves");
          const request = store.get("backup-3");
          request.onsuccess = () => {
            const record = request.result as {
              slotId: string;
              savedAt: number;
              data: Record<string, unknown>;
            } | undefined;
            const units = record?.data.units;
            if (!record || !Array.isArray(units)) {
              transaction.abort();
              reject(new Error("Expected backup-3 units are missing."));
              return;
            }
            const invalidUnits = units.map((candidate) => {
              if (!candidate || typeof candidate !== "object") return candidate;
              const unit = candidate as { id?: string };
              return unit.id === "unit_004"
                ? { ...candidate, position: { x: 8, y: 6 } }
                : candidate;
            });
            store.put({
              ...record,
              data: { ...record.data, chapterId: "chapter_01_map", units: invalidUnits }
            });
          };
          request.onerror = () => reject(request.error ?? new Error("Could not read backup for terrain validation."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Could not prepare impassable backup."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Impassable backup update was aborted."));
        });
      } finally {
        database.close();
      }
    });

    await page.getByTestId("restore-backup-3").click();
    await expect(page.getByRole("status")).toContainText("バックアップを復元できません。");
    expect(await readAutoSave(page)).toEqual(autoSaveBeforeInvalidRestore);

    await page.evaluate(async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open("grid-tactics-pwa", 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open save database."));
      });
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = database.transaction("game-saves", "readwrite");
          const store = transaction.objectStore("game-saves");
          const request = store.get("backup-3");
          request.onsuccess = () => {
            const record = request.result as {
              slotId: string;
              savedAt: number;
              data: Record<string, unknown>;
            } | undefined;
            const units = record?.data.units;
            if (!record || !Array.isArray(units)) {
              transaction.abort();
              reject(new Error("Expected backup-3 units are missing."));
              return;
            }
            const invalidUnits = units.map((candidate) => {
              if (!candidate || typeof candidate !== "object") return candidate;
              const unit = candidate as { id?: string };
              return unit.id === "unit_004"
                ? {
                    ...candidate,
                    position: { x: 8, y: 8 },
                    inventory: [...(candidate as { inventory: string[] }).inventory, "unregistered_item"]
                  }
                : candidate;
            });
            store.put({
              ...record,
              data: { ...record.data, chapterId: "chapter_01_map", units: invalidUnits }
            });
          };
          request.onerror = () => reject(request.error ?? new Error("Could not read backup for reference validation."));
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error ?? new Error("Could not prepare invalid reference backup."));
          transaction.onabort = () => reject(transaction.error ?? new Error("Invalid reference backup update was aborted."));
        });
      } finally {
        database.close();
      }
    });

    await page.getByTestId("restore-backup-3").click();
    await expect(page.getByRole("status")).toContainText("バックアップを復元できません。");
    expect(await readAutoSave(page)).toEqual(autoSaveBeforeInvalidRestore);
    await expect(page.locator(".phase-badge")).toHaveText("第4ターン · 自軍フェイズ");
  });

});
