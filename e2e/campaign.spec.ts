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

  test("shows the resolved player attack strikes and keeps the report transient", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 390, height: 844 });
    const preparedState = await readAutoSave(page) as {
      rngState: number;
      units: Array<{ id: string; faction: string; position: { x: number; y: number }; hasMoved: boolean; hasActed: boolean }>;
    };
    const player = preparedState.units.find((unit) => unit.id === "unit_001");
    const enemy = preparedState.units.find((unit) => unit.id === "enemy_001");
    if (!player || !enemy) throw new Error("Combat report test units are missing from the auto save.");
    player.position = { x: 1, y: 1 }; player.hasMoved = false; player.hasActed = false;
    enemy.position = { x: 1, y: 2 }; enemy.hasMoved = false; enemy.hasActed = false;
    preparedState.units = [player, enemy];
    preparedState.rngState = 0x6d2b79f5;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await page.locator(".map-grid").getByRole("button", { name: /敵01/ }).click();
    await page.getByRole("button", { name: "攻撃を確定" }).click();

    const report = page.getByTestId("player-attack-report");
    await expect(report).toBeVisible();
    await expect(report).toContainText("味方01 vs 敵01");
    await expect(report.getByTestId("player-attack-strike")).toHaveCount(2);
    await expect(report).toContainText("先制攻撃");
    await expect(report).toContainText("反撃");
    await expect(report).toContainText("試作の鉄の剣");
    await expect(report).toContainText("獲得EXP：+10");
    await expect(report).toContainText(/HP 20 → \d+/);
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      reportWidth: document.querySelector("[data-testid=player-attack-report]")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.reportWidth).toBeGreaterThan(0);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    const savedState = await readAutoSave(page);
    expect(savedState).not.toHaveProperty("lastPlayerAttackReport");
    await page.reload();
    await expect(page.getByTestId("player-attack-report")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(savedState);
  });

  test("toggles the enemy threat range before the enemy phase", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        position: { x: number; y: number };
        move: number;
        hasMoved: boolean;
        hasActed: boolean;
      }>;
    };
    const player = preparedState.units.find((unit) => unit.id === "unit_001");
    const enemy = preparedState.units.find((unit) => unit.id === "enemy_001");
    if (!player || !enemy) throw new Error("Threat-range test units are missing from the auto save.");

    player.position = { x: 4, y: 1 };
    enemy.position = { x: 1, y: 1 };
    enemy.move = 2;
    enemy.hasMoved = false;
    enemy.hasActed = false;
    preparedState.units = [player, enemy];
    await writeAutoSave(page, preparedState);
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const showButton = page.getByRole("button", { name: "敵の攻撃範囲を表示" });
    await expect(showButton).toBeVisible();
    await expect(showButton).toHaveAttribute("aria-pressed", "false");

    const threatenedTile = page.locator(".map-tile").nth(14);
    const safeTile = page.locator(".map-tile").nth(15);
    await expect(threatenedTile).not.toHaveAttribute("aria-label", /敵攻撃範囲/);

    await showButton.click();
    const hideButton = page.getByRole("button", { name: "敵の攻撃範囲を隠す" });
    await expect(hideButton).toHaveAttribute("aria-pressed", "true");
    await expect(threatenedTile).toHaveAttribute("aria-label", /敵攻撃範囲（移動後を含む予測）/);
    await expect(threatenedTile).toHaveClass(/is-enemy-threatened/);
    await expect(safeTile).not.toHaveAttribute("aria-label", /敵攻撃範囲/);
    await expect(page.locator(".map-legend")).toContainText("敵攻撃範囲（予測）");
    await expect(page.getByText(/実際の移動先や攻撃対象を確定する予告ではありません/)).toBeVisible();

    await hideButton.click();
    await expect(showButton).toHaveAttribute("aria-pressed", "false");
    await expect(threatenedTile).not.toHaveClass(/is-enemy-threatened/);

    await showButton.click();
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.getByRole("button", { name: "敵の攻撃範囲を表示" })).toHaveAttribute("aria-pressed", "false");
  });

  test("shows the defeated enemy roster and surviving allies in battle results", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        faction: "player" | "enemy";
      }>;
    };
    const clearedState = {
      ...preparedState,
      units: preparedState.units.filter((unit) => unit.faction === "player")
    };
    await writeAutoSave(page, clearedState);
    await page.reload();

    await expect(page.locator(".battle-outcome")).toContainText("ステージクリア");
    const enemyRoster = page.getByTestId("result-enemy-roster");
    await expect(enemyRoster.locator(".result-enemy-row")).toHaveCount(5);
    await expect(page.getByTestId("result-enemy-enemy_001")).toContainText("敵01");
    await expect(page.getByTestId("result-enemy-enemy_001")).toContainText("撃破");
    await expect(page.getByTestId("result-enemy-enemy_001")).toContainText("HP —");
    await expect(enemyRoster).toContainText("敵05");
    await expect(enemyRoster).toContainText("撃破済み敵ユニットの最終HPはセーブデータに残らない");

    const survivingPlayers = page.locator(".result-player-row");
    await expect(survivingPlayers).toHaveCount(4);
    await expect(page.getByTestId("result-player-unit_001")).toContainText("味方01");
    await expect(page.getByTestId("result-player-unit_001")).toContainText("Lv.1");
    await expect(page.getByTestId("result-player-unit_001")).toContainText("EXP 0/100");
    await expect(page.getByTestId("result-player-unit_001")).toContainText("HP 20/20");
    await expect(page.locator(".battle-outcome")).toContainText("撃破者別の戦闘記録は保存していない");

    await page.reload();
    await expect(page.locator(".battle-outcome")).toContainText("ステージクリア");
    await expect(page.getByTestId("result-enemy-enemy_001")).toContainText("撃破");
    await expect(page.locator(".result-player-row")).toHaveCount(4);
  });

  test("allows promotion only before movement and consumes the unit action", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        level: number;
        experience: number;
        stats: { strength: number };
        inventory: string[];
        hasMoved: boolean;
        hasActed: boolean;
        classId: string;
      }>;
    };
    const preparedUnit = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!preparedUnit) throw new Error("Promotion test unit is missing from the auto save.");

    preparedUnit.level = 10;
    preparedUnit.experience = 73;
    preparedUnit.stats.strength = 32;
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
    await expect(confirmation).toContainText("能力ボーナス・クラス上限はすべて試作値です。");
    await expect(confirmation).toContainText("Lv.10 → Lv.1");
    await expect(confirmation).toContainText("EXP 73（保持）");
    await expect(confirmation).toContainText("昇格後は行動済み");

    const statPreview = confirmation.getByRole("table", { name: "昇格後の能力値プレビュー" });
    await expect(statPreview.locator("tbody tr")).toHaveCount(8);
    const expectedStatPreview = [
      { key: "hp", current: "20", next: "22", change: "+2 / 60" },
      { key: "strength", current: "32", next: "32", change: "+0 / 30" },
      { key: "magic", current: "0", next: "0", change: "+0 / 30" },
      { key: "skill", current: "7", next: "8", change: "+1 / 30" },
      { key: "speed", current: "8", next: "9", change: "+1 / 30" },
      { key: "luck", current: "4", next: "4", change: "+0 / 30" },
      { key: "defense", current: "5", next: "5", change: "+0 / 30" },
      { key: "resistance", current: "1", next: "1", change: "+0 / 30" }
    ] as const;
    for (const expected of expectedStatPreview) {
      const cells = page.getByTestId(`promotion-stat-${expected.key}`).locator("td");
      await expect(cells).toHaveCount(3);
      await expect(cells.nth(0)).toHaveText(expected.current);
      await expect(cells.nth(1)).toHaveText(expected.next);
      await expect(cells.nth(2)).toContainText(expected.change);
    }
    await expect(page.getByTestId("promotion-stat-strength")).toContainText("既存値を維持");
    await expect(confirmation).toContainText("20 → 20（回復なし）");
    await expect(confirmation).toContainText("歩兵・5（維持）");
    await expect(confirmation).toContainText("剣（維持）");
    await expect(confirmation).toContainText("試作の鉄の剣（維持）");
    await expect(confirmation).toContainText("1 → 0個（1個消費）");

    const beforeCancel = await readAutoSave(page);
    await confirmation.getByRole("button", { name: "キャンセル" }).click();
    await expect(page.getByRole("group", { name: "クラスチェンジ確認" })).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(beforeCancel);

    await promotionPanel.getByRole("button", { name: "クラスチェンジを確認" }).click();
    const confirmedAgain = page.getByRole("group", { name: "クラスチェンジ確認" });
    await expect(confirmedAgain).toContainText("能力ボーナス・クラス上限はすべて試作値です。");
    await expect(confirmedAgain.getByRole("table", { name: "昇格後の能力値プレビュー" }).locator("tbody tr")).toHaveCount(8);
    await expect(confirmedAgain).toContainText("Lv.10 → Lv.1");
    await expect(confirmedAgain).toContainText("EXP 73（保持）");
    await expect(confirmedAgain).toContainText("昇格後は行動済み");
    await confirmedAgain.getByRole("button", { name: "昇格を確定" }).click();
    await expect(page.getByRole("status")).toContainText("このフェイズの行動を消費しました");

    const promotedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        classId: string;
        level: number;
        experience: number;
        stats: { strength: number };
        hasMoved: boolean;
        hasActed: boolean;
        inventory: string[];
      }>;
    };
    expect(promotedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
      classId: "swordmaster",
      level: 1,
      experience: 73,
      stats: { strength: 32 },
      hasMoved: false,
      hasActed: true
    });
    expect(promotedState.units.find((unit) => unit.id === "unit_001")?.inventory).not.toContain("promotion_seal");

    await page.reload();
    await page.getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });

  test("resolves the enemy phase and shows its action report", async ({ page }) => {
    await startBattle(page);
    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const report = page.getByTestId("enemy-phase-report");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("enemy-phase-action")).toHaveCount(5);
    for (const enemyName of ["敵01", "敵02", "敵03", "敵04", "敵05"]) await expect(report).toContainText(enemyName);
    await expect(report).toContainText(/攻撃|移動|待機/);
    await expect(report).toContainText("セーブデータには含まれません");
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
    await expect(page.getByTestId("enemy-phase-report")).toHaveCount(0);
  });

  test("resumes a saved enemy phase once and rebuilds its action report", async ({ page }) => {
    await startBattle(page);
    const checkpoint = await readAutoSave(page) as {
      phase: "player" | "enemy"; turn: number;
      units: Array<{ id: string; faction: "player" | "enemy"; hasActed: boolean }>;
    };
    checkpoint.phase = "enemy";
    await writeAutoSave(page, checkpoint);
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const report = page.getByTestId("enemy-phase-report");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("enemy-phase-action")).toHaveCount(5);
    const resolvedState = await readAutoSave(page) as { phase: string; turn: number; [key: string]: unknown };
    expect(resolvedState.phase).toBe("player");
    expect(resolvedState.turn).toBe(2);
    await page.reload();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
    await expect(page.getByTestId("enemy-phase-report")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(resolvedState);
  });

  test("keeps map tiles finger-sized and keyboard-scrollable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);
    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    await expect(viewport).toBeVisible();
    const dimensions = await page.evaluate(() => {
      const viewport = document.querySelector(".map-viewport");
      const grid = document.querySelector(".map-grid");
      const tile = document.querySelector(".map-grid .map-tile");
      if (!(viewport instanceof HTMLElement) || !(grid instanceof HTMLElement) || !(tile instanceof HTMLElement)) {
        throw new Error("The map viewport, grid, or first tile is missing.");
      }
      const tileRect = tile.getBoundingClientRect();
      return {
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        viewportClientWidth: viewport.clientWidth,
        viewportScrollWidth: viewport.scrollWidth,
        gridScrollWidth: grid.scrollWidth,
        tileWidth: tileRect.width,
        tileHeight: tileRect.height
      };
    });
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.viewportScrollWidth).toBeGreaterThan(dimensions.viewportClientWidth);
    expect(dimensions.gridScrollWidth).toBeGreaterThan(dimensions.viewportClientWidth);
    expect(dimensions.tileWidth).toBeGreaterThanOrEqual(40);
    expect(dimensions.tileHeight).toBeGreaterThanOrEqual(40);
    await viewport.focus();
    await viewport.press("ArrowRight");
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });

  test("selects a unit with touch input on the narrow map viewport", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
      viewport: { width: 320, height: 720 },
      hasTouch: true
    });

    try {
      const page = await context.newPage();
      await startBattle(page);

      const unitTile = page.getByRole("button", { name: /味方01/ });
      await expect(unitTile).toBeVisible();
      await unitTile.scrollIntoViewIfNeeded();

      const bounds = await unitTile.boundingBox();
      if (!bounds) throw new Error("The player unit tile has no visible bounds.");

      await page.touchscreen.tap(
        bounds.x + bounds.width / 2,
        bounds.y + bounds.height / 2
      );
      await expect(page.locator(".unit-heading")).toContainText("味方01");
    } finally {
      await context.close();
    }
  });

  test("scrolls the narrow map viewport with a horizontal touch gesture at 320px", async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
      viewport: { width: 320, height: 720 },
      hasTouch: true
    });

    try {
      const page = await context.newPage();
      await startBattle(page);

      const viewport = page.getByRole("region", {
        name: "戦闘マップ。狭い画面では左右にスクロールできます"
      });
      await expect(viewport).toBeVisible();

      const bounds = await viewport.boundingBox();
      if (!bounds) throw new Error("The map viewport has no visible bounds.");
      const startX = bounds.x + bounds.width * 0.82;
      const endX = bounds.x + bounds.width * 0.22;
      const centerY = bounds.y + bounds.height / 2;
      const client = await context.newCDPSession(page);

      try {
        await client.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x: startX, y: centerY, radiusX: 4, radiusY: 4, force: 1 }]
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: startX - 35, y: centerY, radiusX: 4, radiusY: 4, force: 1 }]
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: endX, y: centerY, radiusX: 4, radiusY: 4, force: 1 }]
        });
        await client.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: []
        });
      } finally {
        await client.detach();
      }

      await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
      const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(documentWidth).toBeLessThanOrEqual(320);

      const rightSideUnit = page.getByRole("button", { name: /味方04/ });
      await expect(rightSideUnit).toBeVisible();
      const unitBounds = await rightSideUnit.boundingBox();
      if (!unitBounds) throw new Error("The unit near the right edge has no visible bounds.");

      await page.touchscreen.tap(
        unitBounds.x + unitBounds.width / 2,
        unitBounds.y + unitBounds.height / 2
      );
      await expect(page.locator(".unit-heading")).toContainText("味方04");
    } finally {
      await context.close();
    }
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
