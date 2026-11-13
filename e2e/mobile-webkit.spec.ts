import { expect, test } from "@playwright/test";

test("opens deployment details with iPhone-sized WebKit touch input without horizontal overflow", async ({ page }) => {
  await page.goto("/");

  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();

  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  const archerCandidate = page.locator(".deployment-unit").filter({ hasText: "味方02" });
  await archerCandidate.getByRole("button", { name: "詳細" }).tap();

  const detailPanel = page.locator("#deployment-detail-panel");
  await expect(detailPanel.getByRole("heading", { name: "味方02" })).toBeVisible();

  // Check the normal iPhone 13 CSS viewport and a narrower portrait viewport.
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 320, height: 568 }
  ]) {
    await page.setViewportSize(viewport);
    const dimensions = await page.evaluate(() => {
      const panel = document.querySelector("#deployment-detail-panel");
      if (!(panel instanceof HTMLElement)) {
        throw new Error("The deployment detail panel is missing.");
      }
      const rect = panel.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        panelLeft: rect.left,
        panelRight: rect.right,
        panelWidth: rect.width
      };
    });

    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.panelWidth).toBeGreaterThan(0);
    expect(dimensions.panelLeft).toBeGreaterThanOrEqual(-1);
    expect(dimensions.panelRight).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
    await expect(detailPanel.getByRole("heading", { name: "味方02" })).toBeVisible();
  }
});


async function readAutoSave(page: import("@playwright/test").Page): Promise<unknown | null> {
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

async function writeAutoSave(page: import("@playwright/test").Page, data: unknown): Promise<void> {
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
        transaction.onabort = () => reject(transaction.error ?? new Error("Auto save transaction was aborted."));
      });
    } finally {
      database.close();
    }
  }, data);
}

async function startWebKitBattle(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/");
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await page.getByRole("button", { name: "出撃メンバーと配置を確定して戦闘開始" }).tap();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  const dialog = page.getByTestId("map-event-dialog");
  while (await dialog.count()) {
    const eventId = await dialog.getAttribute("data-event-id");
    if (!eventId) throw new Error("A pending map event is missing its event ID.");
    if (await dialog.getByTestId("map-event-choice").count()) {
      throw new Error(`Map event "${eventId}" requires an explicit dialogue choice.`);
    }
    const acknowledge = dialog.getByRole("button", { name: /次のイベントへ|確認して続ける/ });
    await expect(acknowledge).toBeVisible();
    await expect(acknowledge).toBeEnabled();
    await acknowledge.tap();
    await expect.poll(async () => {
      if (!(await dialog.count())) return null;
      return dialog.getAttribute("data-event-id");
    }).not.toBe(eventId);
  }
  await expect(dialog).toHaveCount(0);
}

test("keeps movement preview read-only until the second tap confirms on WebKit touch", async ({ page }) => {
  await startWebKitBattle(page);

  const preparedState = await readAutoSave(page) as {
    units: Array<{ id: string; position: { x: number; y: number } }>;
  };
  const protagonist = preparedState.units.find((unit) => unit.id === "unit_001");
  if (!protagonist) throw new Error("The protagonist is missing from the WebKit auto save.");
  protagonist.position = { x: 0, y: 4 };
  await writeAutoSave(page, preparedState);

  await page.reload();
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "つづきから" }).tap();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  const savedBeforePreview = await readAutoSave(page);
  const playerTile = page.locator(".map-grid").getByRole("button", { name: /主人公/ });
  const destination = page.locator(".map-grid").getByRole("button", { name: /2列・5行/ });
  await playerTile.tap();
  await destination.tap();

  await expect(destination).toHaveClass(/is-movement-path/);
  await expect(destination).toHaveAttribute("aria-label", /移動経路 2番/);
  await expect(page.getByRole("status")).toContainText("同じマスをもう一度タップすると移動します。");
  expect(await readAutoSave(page)).toEqual(savedBeforePreview);

  await destination.tap();
  await expect(page.getByRole("status")).toContainText("主人公が2列・5行へ移動しました。");
  await expect(page.locator(".map-grid .movement-path-step")).toHaveCount(0);
  await expect.poll(async () => {
    const saved = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number }; hasMoved: boolean }>;
    };
    const moved = saved.units.find((unit) => unit.id === "unit_001");
    return moved ? { position: moved.position, hasMoved: moved.hasMoved } : null;
  }).toEqual({ position: { x: 1, y: 4 }, hasMoved: true });
});
