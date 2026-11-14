import { expect, test, type Page } from "@playwright/test";
import { acknowledgePendingMapEvents } from "./helpers/map-events";

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
        transaction.onabort = () => reject(transaction.error ?? new Error("Auto save transaction was aborted."));
      });
    } finally {
      database.close();
    }
  }, data);
}

async function startWebKitBattle(page: Page): Promise<void> {
  await page.goto("/");
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await page.getByRole("button", { name: "出撃メンバーと配置を確定して戦闘開始" }).tap();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  await acknowledgePendingMapEvents(page, { input: "tap" });
}

test("keeps a pending map-event dialog open until explicit WebKit touch acknowledgement", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");

  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "はじめから" }).tap();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await page.getByRole("button", { name: "出撃メンバーと配置を確定して戦闘開始" }).tap();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  const dialog = page.getByTestId("map-event-dialog");
  const acknowledgement = dialog.getByRole("button", { name: "確認して続ける" });
  await expect(dialog).toBeVisible();
  await expect(acknowledgement).toBeEnabled();
  await expect(acknowledgement).toBeFocused();

  const pendingSave = await readAutoSave(page) as {
    firedMapEventIds: string[];
    acknowledgedMapEventIds: string[];
  };
  expect(pendingSave.firedMapEventIds).toEqual(["chapter-01-opening-briefing"]);
  expect(pendingSave.acknowledgedMapEventIds).toEqual([]);

  // A touch outside the modal and Escape must not dismiss or acknowledge the event.
  await page.getByTestId("map-event-dialog-backdrop").tap({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
  await expect(acknowledgement).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(acknowledgement).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(acknowledgement).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(acknowledgement).toBeFocused();
  expect(await readAutoSave(page)).toEqual(pendingSave);

  await acknowledgement.tap();
  await expect(dialog).toHaveCount(0);
  const mapViewport = page.getByRole("region", {
    name: "戦闘マップ。狭い画面では左右にスクロールできます"
  });
  await expect(mapViewport).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect.poll(async () => {
    const saved = await readAutoSave(page) as {
      firedMapEventIds: string[];
      acknowledgedMapEventIds: string[];
    };
    return saved.acknowledgedMapEventIds;
  }).toEqual(["chapter-01-opening-briefing"]);
});

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

test("scrolls the narrow battle map and selects a right-side unit with WebKit touch", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await startWebKitBattle(page);

  const savedBeforeSelection = await readAutoSave(page);
  const viewport = page.getByRole("region", {
    name: "戦闘マップ。狭い画面では左右にスクロールできます"
  });
  await expect(viewport).toBeVisible();

  const dimensions = await page.evaluate(() => {
    const mapViewport = document.querySelector(".map-viewport");
    const grid = document.querySelector(".map-grid");
    const firstTile = document.querySelector(".map-grid .map-tile");
    if (
      !(mapViewport instanceof HTMLElement) ||
      !(grid instanceof HTMLElement) ||
      !(firstTile instanceof HTMLElement)
    ) {
      throw new Error("The narrow map viewport, grid, or first tile is missing.");
    }

    const tileBounds = firstTile.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      clientWidth: mapViewport.clientWidth,
      scrollWidth: mapViewport.scrollWidth,
      gridWidth: grid.scrollWidth,
      tileWidth: tileBounds.width,
      tileHeight: tileBounds.height
    };
  });

  expect(dimensions.documentWidth).toBeLessThanOrEqual(320);
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.gridWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.tileWidth).toBeGreaterThanOrEqual(40);
  expect(dimensions.tileHeight).toBeGreaterThanOrEqual(40);

  // Move only the map's scroll container, not the page, to expose the last columns.
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  const rightSideUnit = page.locator(".map-grid").getByRole("button", { name: /味方04/ });
  await expect(rightSideUnit).toBeVisible();
  // The map sits below the battle panels on a tall page; bring the selected tile into view vertically.
  await rightSideUnit.scrollIntoViewIfNeeded();
  const [viewportBounds, unitBounds] = await Promise.all([
    viewport.boundingBox(),
    rightSideUnit.boundingBox()
  ]);
  if (!viewportBounds || !unitBounds) {
    throw new Error("The map viewport or right-side unit has no visible bounds.");
  }
  expect(unitBounds.x).toBeGreaterThanOrEqual(viewportBounds.x);
  expect(unitBounds.x + unitBounds.width).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width);
  expect(unitBounds.y).toBeGreaterThanOrEqual(0);
  expect(unitBounds.y + unitBounds.height).toBeLessThanOrEqual(720);

  const tapPoint = {
    x: unitBounds.x + unitBounds.width / 2,
    y: unitBounds.y + unitBounds.height / 2
  };
  const hitTarget = await page.evaluate(({ x, y }) => {
    return document.elementFromPoint(x, y)?.closest("button")?.getAttribute("aria-label") ?? null;
  }, tapPoint);
  expect(hitTarget).toContain("味方04");

  await page.touchscreen.tap(tapPoint.x, tapPoint.y);
  await expect(rightSideUnit).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".unit-heading")).toContainText("味方04");
  expect(await readAutoSave(page)).toEqual(savedBeforeSelection);
});

test("keeps a right-edge movement preview read-only at 320px until the second WebKit touch", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await startWebKitBattle(page);

  const preparedState = await readAutoSave(page) as {
    units: Array<{ id: string; position: { x: number; y: number } }>;
  };
  const protagonist = preparedState.units.find((unit) => unit.id === "unit_001");
  if (!protagonist) throw new Error("The protagonist is missing from the narrow WebKit auto save.");
  protagonist.position = { x: 8, y: 9 };
  await writeAutoSave(page, preparedState);

  await page.reload();
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await title.getByRole("button", { name: "つづきから" }).tap();
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  const viewport = page.getByRole("region", {
    name: "戦闘マップ。狭い画面では左右にスクロールできます"
  });
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth - element.clientWidth;
  });
  await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  const source = page.locator('.map-grid [data-map-position="8,9"]');
  const destination = page.locator('.map-grid [data-map-position="9,9"]');
  await expect(source).toBeVisible();
  await expect(destination).toBeVisible();

  const [viewportBounds, sourceBounds, destinationBounds] = await Promise.all([
    viewport.boundingBox(),
    source.boundingBox(),
    destination.boundingBox()
  ]);
  if (!viewportBounds || !sourceBounds || !destinationBounds) {
    throw new Error("The scrolled map viewport or right-edge movement tiles are not visible.");
  }
  expect(sourceBounds.x).toBeGreaterThanOrEqual(viewportBounds.x);
  expect(destinationBounds.x + destinationBounds.width)
    .toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width);
  expect(destinationBounds.y + destinationBounds.height).toBeLessThanOrEqual(720);

  const savedBeforePreview = await readAutoSave(page);
  await source.tap();
  await destination.tap();

  await expect(destination).toHaveClass(/is-movement-path/);
  await expect(destination).toHaveAttribute("aria-label", /移動経路 2番/);
  await expect(page.getByRole("status")).toContainText("同じマスをもう一度タップすると移動します。");
  expect(await readAutoSave(page)).toEqual(savedBeforePreview);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);

  await destination.tap();
  await expect(page.getByRole("status")).toContainText("主人公が10列・10行へ移動しました。");
  await expect(page.locator(".map-grid .movement-path-step")).toHaveCount(0);
  await expect.poll(async () => {
    const saved = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number }; hasMoved: boolean }>;
    };
    const moved = saved.units.find((unit) => unit.id === "unit_001");
    return moved ? { position: moved.position, hasMoved: moved.hasMoved } : null;
  }).toEqual({ position: { x: 9, y: 9 }, hasMoved: true });
});

