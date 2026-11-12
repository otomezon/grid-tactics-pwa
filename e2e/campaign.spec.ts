import { expect, test, type Page } from "@playwright/test";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";

async function startNewCampaign(page: Page): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
  await expect(page.getByRole("button", { name: "はじめから" })).toBeEnabled();
  await page.getByRole("button", { name: "はじめから" }).click();
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
}

async function continueSavedCampaign(page: Page): Promise<void> {
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  const continueButton = title.getByRole("button", { name: "つづきから" });
  if (await continueButton.count()) {
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
  } else {
    await title.getByRole("button", { name: "はじめから" }).click();
  }
}

async function startBattle(page: Page): Promise<void> {
  await startNewCampaign(page);
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

test.describe("campaign title and save hub", () => {
  test("starts a new campaign without writing a save before deployment confirmation", async ({ page }) => {
    await page.goto("/");
    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await expect(title.getByRole("heading", { name: "Grid Tactics" })).toBeVisible();
    await expect(title.getByRole("button", { name: "つづきから" })).toHaveCount(0);
    await expect(title.getByRole("button", { name: "はじめから" })).toBeEnabled();
    expect(await readAutoSave(page)).toBeNull();

    await title.getByRole("button", { name: "はじめから" }).click();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    expect(await readAutoSave(page)).toBeNull();

    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    const saved = await readAutoSave(page) as { chapterId: string; turn: number; phase: string; saveVersion: number };
    expect(saved.saveVersion).toBe(3);
    expect(saved.turn).toBe(1);
    expect(saved.phase).toBe("player");
    expect(saved.chapterId).toBeTruthy();
  });

  test("shows a saved campaign on launch and continues without changing the auto save", async ({ page }) => {
    await startBattle(page);
    const savedBeforeReload = await readAutoSave(page);
    await page.reload();

    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await expect(title.getByTestId("campaign-resume-summary")).toBeVisible();
    await expect(title.getByRole("button", { name: "つづきから" })).toBeEnabled();
    expect(await readAutoSave(page)).toEqual(savedBeforeReload);

    await title.getByRole("button", { name: "つづきから" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    expect(await readAutoSave(page)).toEqual(savedBeforeReload);
  });

  test("keeps the old auto save when a new campaign is cancelled or not yet deployed", async ({ page }) => {
    await startBattle(page);
    const existingSave = await readAutoSave(page);
    await page.reload();

    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await title.getByRole("button", { name: "はじめから" }).click();
    await expect(title.getByRole("heading", { name: "新しいキャンペーンを始めますか？" })).toBeVisible();
    await title.getByRole("button", { name: "キャンセル" }).click();
    expect(await readAutoSave(page)).toEqual(existingSave);

    await title.getByRole("button", { name: "はじめから" }).click();
    await title.getByRole("button", { name: "新しいゲームを開始" }).click();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    expect(await readAutoSave(page)).toEqual(existingSave);

    await page.reload();
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    expect(await readAutoSave(page)).toEqual(existingSave);
  });

  test("keeps the launch and save controls within a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/");
    await expect(page.getByTestId("campaign-title-screen")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      title: document.querySelector("[data-testid=campaign-title-screen]")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.title).toBeGreaterThan(0);
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  });
});

test.describe("browser campaign flow", () => {
  test("provides a responsive step-by-step operation guide without changing the save", async ({ page }) => {
    await startBattle(page);
    const savedBeforeGuide = await readAutoSave(page);
    await page.setViewportSize({ width: 320, height: 720 });

    const toggle = page.getByRole("button", { name: "操作ガイド" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();

    const guide = page.getByRole("region", { name: "操作ガイド" });
    await expect(guide).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    const stepHeading = guide.getByRole("heading", { level: 3 });
    await expect(stepHeading).toHaveText("出撃準備を整える");

    const steps = [
      "味方を選んで移動する",
      "攻撃予測を見てから戦う",
      "アイテムとユニット行動",
      "地形と敵の攻撃範囲を読む",
      "ターンを進めてセーブを管理する"
    ];
    for (const title of steps) {
      await guide.getByRole("button", { name: "次へ" }).click();
      await expect(stepHeading).toHaveText(title);
    }

    await expect(guide).toContainText("自軍フェイズ終了");
    await expect(guide).toContainText("セーブを書き出す");
    await expect(guide.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "6");
    const guideBounds = await guide.boundingBox();
    expect(guideBounds?.width).toBeLessThanOrEqual(320);
    const pageWidths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(pageWidths.document).toBeLessThanOrEqual(pageWidths.viewport);

    await guide.getByRole("button", { name: "最初から" }).click();
    await expect(stepHeading).toHaveText("出撃準備を整える");
    await guide.getByRole("button", { name: "閉じる" }).click();
    await expect(guide).toHaveCount(0);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    expect(await readAutoSave(page)).toEqual(savedBeforeGuide);
    await toggle.click();
    await expect(page.getByRole("region", { name: "操作ガイド" })
      .getByRole("heading", { level: 3 })).toHaveText("出撃準備を整える");
  });

  test("previews deployment positions, swaps assignments, and saves only after confirmation", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startNewCampaign(page);

    const savedBeforePreview = await readAutoSave(page);
    const preview = page.getByTestId("deployment-preview");
    await expect(preview).toBeVisible();
    await expect(preview.getByTestId("deployment-preview-tile")).toHaveCount(100);
    await expect(preview.getByTestId("deployment-preview-count")).toHaveText("4 / 4か所");
    const terrainPanel = preview.getByTestId("deployment-preview-terrain");
    await expect(terrainPanel).toContainText("2列・9行 · 平地");
    await expect(terrainPanel).toContainText("味方01 · 歩兵 · 移動力");
    await expect(terrainPanel).toContainText("このユニットの移動タイプで進入できます");
    await expect(terrainPanel).toContainText("移動コスト 1");
    await expect(preview.getByRole("button", {
      name: "味方01、2列・9行に配置済み。詳細を表示"
    })).toBeVisible();

    await preview.getByRole("button", {
      name: "味方01、2列・9行に配置済み。詳細を表示"
    }).click();
    const detailPanel = page.locator("#deployment-detail-panel");
    await expect(detailPanel.getByRole("heading", { name: "味方01" })).toBeVisible();
    await expect(page.locator("#deployment-detail-toggle-unit_001")).toBeFocused();

    const firstCandidate = page.locator(".deployment-unit").filter({ hasText: "味方01" });
    await firstCandidate.getByRole("combobox", { name: "味方01の出撃位置" }).selectOption("5,8");
    await expect(preview.getByRole("button", {
      name: "味方01、6列・9行に配置済み。詳細を表示"
    })).toBeVisible();
    await expect(preview.getByRole("button", {
      name: "味方03、2列・9行に配置済み。詳細を表示"
    })).toBeVisible();
    await expect(detailPanel).toContainText("6列・9行");

    const fourthCandidate = page.locator(".deployment-unit").filter({ hasText: "味方04" });
    await fourthCandidate.getByRole("checkbox").uncheck();
    await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");
    await expect(preview.getByTestId("deployment-preview-count")).toHaveText("3 / 4か所");
    const emptySlot = preview.getByTestId("deployment-preview-empty-slot");
    await expect(emptySlot).toHaveCount(1);
    await expect(emptySlot).toHaveAttribute(
      "aria-label",
      "空き出撃位置 4、9列・9行の地形を確認"
    );
    await emptySlot.click();
    await expect(terrainPanel).toContainText("9列・9行 · 道");
    await expect(terrainPanel).toContainText("空き出撃マス");
    await expect(terrainPanel).toContainText("歩兵コスト");
    await expect(terrainPanel).toContainText("騎馬コスト");
    await expect(terrainPanel).toContainText("守備補正");
    await expect(terrainPanel).toContainText("回避補正");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);

    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      previewWidth: document.querySelector("[data-testid=deployment-preview]")?.getBoundingClientRect().width ?? 0,
      gridWidth: document.querySelector(".deployment-preview-grid")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.previewWidth).toBeGreaterThan(0);
    expect(dimensions.gridWidth).toBeGreaterThan(0);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.gridWidth).toBeLessThanOrEqual(dimensions.previewWidth);
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);

    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    const committedState = await readAutoSave(page) as {
      units: Array<{ id: string; faction: string; position: { x: number; y: number } }>;
      reserveUnits: Array<{ id: string }>;
    };
    expect(committedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
      faction: "player",
      position: { x: 5, y: 8 }
    });
    expect(committedState.units.find((unit) => unit.id === "unit_003")).toMatchObject({
      faction: "player",
      position: { x: 1, y: 8 }
    });
    expect(committedState.units.some((unit) => unit.id === "unit_004")).toBe(false);
    expect(committedState.reserveUnits.map((unit) => unit.id)).toContain("unit_004");
  });

  test("shows growth rates and EXP progress in deployment candidate details without saving", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startNewCampaign(page);
    expect(await readAutoSave(page)).toBeNull();

    const candidate = page.locator(".deployment-unit").filter({ hasText: "味方01" });
    await candidate.getByRole("button", { name: "詳細" }).click();
    const panel = page.getByTestId("unit-growth-panel");
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("次のレベルまで 100 EXP");
    await expect(panel.locator('[data-testid="unit-growth-rate"]')).toHaveCount(8);
    await expect(panel).toContainText("HP80%");
    await expect(panel).toContainText("力35%");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await readAutoSave(page)).toBeNull();
  });

test("compares active and reserve deployment candidates without changing the save", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await startNewCampaign(page);

  const reserveCandidate = page.locator(".deployment-unit").filter({ hasText: "味方04" });
  await reserveCandidate.getByRole("checkbox").uncheck();
  await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");

  const comparison = page.getByTestId("deployment-comparison");
  await expect(comparison).toBeVisible();
  await comparison.getByLabel("比較する味方A").selectOption("unit_001");
  await comparison.getByLabel("比較する味方B").selectOption("unit_004");

  const table = comparison.getByRole("table", { name: "出撃候補ユニット比較" });
  await expect(table).toBeVisible();
  await expect(table).toContainText("味方01");
  await expect(table).toContainText("味方04");
  await expect(table).toContainText("出撃予定");
  await expect(table).toContainText("控え予定");
  await expect(table).toContainText("能力値");
  await expect(table).toContainText("成長率");
  await expect(table).toContainText("EXP");
  await expect(table).toContainText("武器適性");

  await comparison.getByLabel("比較する味方B").selectOption("unit_001");
  await expect(comparison).toContainText("異なる2人を選択してください。");
  await comparison.getByRole("button", { name: "比較をクリア" }).click();
  await expect(comparison).toContainText("比較する味方を2人選択すると");

  const tableWrap = comparison.getByTestId("deployment-comparison-table-wrap");
  await comparison.getByLabel("比較する味方A").selectOption("unit_001");
  await comparison.getByLabel("比較する味方B").selectOption("unit_004");
  await expect(tableWrap).toBeVisible();
  const dimensions = await tableWrap.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth
  }));
  expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  expect(await readAutoSave(page)).toBeNull();
});

test("shows candidate details and persists the selected deployment roster", async ({ page }) => {
    await startNewCampaign(page);

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
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.locator(".deployment-panel")).toHaveCount(0);
  });

  test("shows ally action status and selects the unit on the map without saving UI state", async ({ page }) => {
    await startBattle(page);
    const savedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        hasMoved: boolean;
        hasActed: boolean;
        position: { x: number; y: number };
      }>;
    };
    const movedUnit = savedState.units.find((unit) => unit.id === "unit_001");
    const actedUnit = savedState.units.find((unit) => unit.id === "unit_002");
    const selectedUnit = savedState.units.find((unit) => unit.id === "unit_003");
    if (!movedUnit || !actedUnit || !selectedUnit) {
      throw new Error("The ally roster fixture is missing a deployed unit.");
    }
    movedUnit.hasMoved = true;
    movedUnit.hasActed = false;
    actedUnit.hasMoved = true;
    actedUnit.hasActed = true;
    await writeAutoSave(page, savedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const roster = page.getByTestId("unit-roster");
    await expect(roster.getByRole("heading", { name: "味方ユニット一覧" })).toBeVisible();
    await expect(page.getByTestId("unit-roster-summary")).toHaveText("未行動 3 / 4人");
    const movedButton = page.getByRole("button", { name: /味方01を選択/ });
    const actedButton = page.getByRole("button", { name: /味方02を選択/ });
    const readyButton = page.getByRole("button", { name: /味方03を選択/ });
    await expect(movedButton).toContainText("移動済・未行動");
    await expect(actedButton).toContainText("行動済");
    await expect(readyButton).toContainText("未移動・未行動");
    await expect(roster.getByRole("progressbar", { name: "味方03のHP" })).toHaveAttribute("value", "20");

    await readyButton.click();
    await expect(page.locator(".unit-heading h3")).toHaveText("味方03");
    await expect(readyButton).toHaveAttribute("aria-pressed", "true");
    const selectedTile = page.locator(
      '.map-grid [data-map-position="' + selectedUnit.position.x + "," + selectedUnit.position.y + '"]'
    );
    await expect(selectedTile).toHaveClass(/is-selected/);
    expect(await readAutoSave(page)).toEqual(savedState);
  });

  test("shows read-only ally stats, weapon suitability, and grouped items without changing the autosave", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);
    const savedState = await readAutoSave(page) as { units: Array<{ id: string; inventory: string[] }> };
    const ally = savedState.units.find((unit) => unit.id === "unit_001");
    if (!ally) throw new Error("The player inspector fixture is missing unit_001.");
    ally.inventory.push("short_bow", "healing_potion", "healing_potion");
    await writeAutoSave(page, savedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    const savedBeforeInspection = await readAutoSave(page);
    await page.getByRole("button", { name: /味方01を選択/ }).click();
    const inspector = page.getByTestId("player-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "味方01" })).toBeVisible();
    await expect(inspector).toContainText("Lv.1 · 剣士");
    await expect(inspector).toContainText("HP 20 / 20");
    await expect(inspector).toContainText("2列・9行");
    await expect(inspector).toContainText("EXP");
    const growthPanel = inspector.getByTestId("unit-growth-panel");
    await expect(growthPanel).toBeVisible();
    await expect(growthPanel).toContainText("次のレベルまで 100 EXP");
    await expect(growthPanel.locator('[data-testid="unit-growth-rate"]')).toHaveCount(8);
    await expect(growthPanel).toContainText("HP80%");
    await expect(growthPanel).toContainText("魔力5%");
    await expect(inspector).toContainText("未移動・未行動");
    await expect(inspector.locator(".enemy-inspector-stat")).toHaveCount(7);
    await expect(inspector.locator('[data-testid="player-inspector-weapon"]')).toHaveCount(2);
    const sword = inspector.locator('[data-testid="player-inspector-weapon"]').filter({ hasText: "試作の鉄の剣" });
    const bow = inspector.locator('[data-testid="player-inspector-weapon"]').filter({ hasText: "試作の弓" });
    await expect(sword).toContainText("使用適性あり");
    await expect(sword).toContainText("装備中");
    await expect(sword).toContainText("攻撃力");
    await expect(bow).toContainText("適性なし");
    await expect(inspector).toContainText("回復薬");
    await expect(inspector).toContainText("所持数：2個");
    await expect(inspector).toContainText("表示専用");
    const inspectorBounds = await inspector.boundingBox();
    if (!inspectorBounds) throw new Error("The player inspector is not laid out on the narrow viewport.");
    expect(inspectorBounds.width).toBeLessThanOrEqual(320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
    await page.getByRole("button", { name: /敵01を確認/ }).click();
    await expect(inspector).toHaveCount(0);
    await expect(page.getByTestId("enemy-inspector")).toBeVisible();
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
  });

  test("shows living enemies and inspects their map tiles without changing the autosave", async ({ page }) => {
    await startBattle(page);
    const savedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        faction: string;
        position: { x: number; y: number };
      }>;
    };
    const enemy = savedState.units.find((unit) => unit.id === "enemy_003");
    if (!enemy) throw new Error("The enemy roster fixture is missing enemy_003.");

    const roster = page.getByTestId("enemy-roster");
    await expect(roster.getByRole("heading", { name: "敵ユニット一覧" })).toBeVisible();
    await expect(page.getByTestId("enemy-roster-summary")).toHaveText("生存 5 / 配置 5体");
    const enemyButton = page.getByRole("button", { name: /敵03を確認/ });
    await expect(enemyButton).toContainText("Lv.1");
    await expect(enemyButton).toContainText("8列・3行");
    await expect(enemyButton).toContainText("試作の鉄の槍");
    await expect(roster.getByRole("progressbar", { name: "敵03のHP" })).toHaveAttribute("value", "20");

    await enemyButton.click();
    await expect(enemyButton).toHaveAttribute("aria-pressed", "true");
    const selectedTile = page.locator(
      '.map-grid [data-map-position="' + enemy.position.x + "," + enemy.position.y + '"]'
    );
    await expect(selectedTile).toHaveClass(/is-inspected/);
    await expect(page.getByTestId("terrain-inspector")).toContainText("敵：敵03");
    await expect(page.getByTestId("combat-forecast")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(savedState);

    await page.locator('.map-grid [data-map-position="4,2"]').click();
    await expect(page.getByRole("button", { name: /敵02を確認/ })).toHaveAttribute("aria-pressed", "true");
    await expect(enemyButton).toHaveAttribute("aria-pressed", "false");
    expect(await readAutoSave(page)).toEqual(savedState);

    const afterDefeat = {
      ...savedState,
      units: savedState.units.filter((unit) => unit.id !== "enemy_001")
    };
    await writeAutoSave(page, afterDefeat);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.getByTestId("enemy-roster-summary")).toHaveText("生存 4 / 配置 5体");
    await expect(page.getByRole("button", { name: /敵01を確認/ })).toHaveCount(0);
  });

  test("shows read-only enemy stats and owned weapon performance from list and map inspection", async ({ page }) => {
    await startBattle(page);

    const savedBeforeInspection = await readAutoSave(page);
    await page.getByRole("button", { name: /敵01を確認/ }).click();

    const inspector = page.getByTestId("enemy-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector.getByRole("heading", { name: "敵01" })).toBeVisible();
    await expect(inspector).toContainText("Lv.1 · 戦士");
    await expect(inspector).toContainText("HP 20 / 20");
    await expect(inspector).toContainText("2列・3行");
    await expect(inspector).toContainText("移動力");
    await expect(inspector).toContainText("歩兵");
    await expect(inspector.locator(".enemy-inspector-stat")).toHaveCount(7);
    await expect(inspector).toContainText("力");
    await expect(inspector).toContainText("魔力");
    await expect(inspector).toContainText("守備");
    await expect(inspector.locator('[data-testid="enemy-inspector-weapon"]')).toHaveCount(1);
    const axe = inspector.locator('[data-testid="enemy-inspector-weapon"]').first();
    await expect(axe).toContainText("試作の鉄の斧");
    await expect(axe).toContainText("装備中");
    await expect(axe).toContainText("攻撃力");
    await expect(axe).toContainText("11");
    await expect(axe).toContainText("命中");
    await expect(axe).toContainText("90%");
    await expect(axe).toContainText("射程");
    await expect(axe).toContainText("1–1");
    await expect(page.getByTestId("combat-forecast")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);

    await page.locator('.map-grid [data-map-position="4,2"]').click();
    await expect(page.getByRole("button", { name: /敵02を確認/ })).toHaveAttribute("aria-pressed", "true");
    await expect(inspector.getByRole("heading", { name: "敵02" })).toBeVisible();
    await expect(inspector).toContainText("アーチャー");
    await expect(inspector).toContainText("試作の弓");
    await expect(inspector).toContainText("2–2");
    await expect(inspector).toContainText("攻撃力");
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
  });

  test("scrolls the narrow battle map to an enemy chosen from the roster", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);

    const savedBeforeInspection = await readAutoSave(page);
    const rosterButton = page.getByRole("button", { name: /敵05を確認/ });
    await rosterButton.click();
    await expect(rosterButton).toHaveAttribute("aria-pressed", "true");
    const inspector = page.getByTestId("enemy-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText("能力値");
    await expect(inspector).toContainText("所持武器");
    const inspectorBounds = await inspector.boundingBox();
    if (!inspectorBounds) throw new Error("The enemy inspector is not laid out on the narrow viewport.");
    expect(inspectorBounds.width).toBeLessThanOrEqual(320);

    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    const tile = page.locator('.map-grid [data-map-position="8,4"]');
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const bounds = await tile.boundingBox();
    const viewportBounds = await viewport.boundingBox();
    if (!bounds || !viewportBounds) throw new Error("The selected enemy tile or map viewport is not visible.");
    expect(bounds.x).toBeGreaterThanOrEqual(viewportBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width + 1);
    await expect(tile).toHaveClass(/is-inspected/);
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(320);
  });

  test("scrolls the narrow battle map to an ally chosen from the roster", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);

    const rosterButton = page.getByRole("button", { name: /味方04を選択/ });
    await rosterButton.click();
    await expect(page.locator(".unit-heading h3")).toHaveText("味方04");

    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    const tile = page.locator('.map-grid [data-map-position="8,8"]');
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
    const bounds = await tile.boundingBox();
    const viewportBounds = await viewport.boundingBox();
    if (!bounds || !viewportBounds) throw new Error("The selected ally tile or map viewport is not visible.");
    expect(bounds.x).toBeGreaterThanOrEqual(viewportBounds.x - 1);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width + 1);
    await expect(tile).toHaveClass(/is-selected/);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(320);
  });

  test("persists a player action across reload", async ({ page }) => {
    await startBattle(page);

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await page.getByRole("button", { name: "待機", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("味方01は待機しました。");
    const historyEntry = page.getByTestId("battle-history").getByTestId("player-action-history");
    await expect(historyEntry).toHaveCount(1);
    await expect(historyEntry).toContainText("味方01");
    await expect(historyEntry).toContainText("待機");
    await expect(historyEntry).toContainText("このフェイズの行動を終了");
    const savedState = await readAutoSave(page) as { [key: string]: unknown };
    expect(savedState).not.toHaveProperty("battleHistory");

    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });

  test("records weapon changes without consuming the unit action", async ({ page }) => {
    await startBattle(page);
    await page.locator(".map-grid").getByRole("button", { name: /味方04/ }).click();
    await page.getByLabel("装備武器").selectOption("iron_lance");
    await expect(page.getByRole("status")).toContainText("味方04は試作の鉄の槍を装備しました。");

    const historyEntry = page.getByTestId("battle-history").getByTestId("player-action-history");
    await expect(historyEntry).toHaveCount(1);
    await expect(historyEntry).toContainText("味方04");
    await expect(historyEntry).toContainText("武器変更");
    await expect(historyEntry).toContainText("試作の鉄の槍を装備");

    const saved = await readAutoSave(page) as {
      units: Array<{ id: string; equippedWeaponId: string | null; hasMoved: boolean; hasActed: boolean }>;
      [key: string]: unknown;
    };
    expect(saved.units.find((unit) => unit.id === "unit_004")).toMatchObject({
      equippedWeaponId: "iron_lance",
      hasMoved: false,
      hasActed: false
    });
    expect(saved).not.toHaveProperty("battleHistory");

    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
  });

  test("previews movement cost and a lowest-cost route without saving until the tile is chosen", async ({ page }) => {
    await startBattle(page);
    const savedBeforePreview = await readAutoSave(page);

    const playerTile = page.locator(".map-grid").getByRole("button", { name: /味方01/ });
    await playerTile.click();
    const destination = page.locator(".map-grid").getByRole("button", { name: /2列・8行/ });
    await destination.hover();

    await expect(destination).toHaveClass(/is-movement-path/);
    await expect(destination).toHaveAttribute("aria-label", /累計移動コスト 1 \/ 移動力 5/);
    await expect(destination.locator(".move-cost-marker")).toHaveText("1");
    const origin = page.locator(".map-grid").getByRole("button", { name: /2列・9行/ });
    await expect(origin.locator(".movement-path-step")).toHaveText("1");
    await expect(destination.locator(".movement-path-step")).toHaveText("2");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);

    await destination.click();
    await expect(page.getByRole("status")).toContainText("味方01が2列・8行へ移動しました。");
    const movementHistory = page.getByTestId("battle-history").getByTestId("player-action-history");
    await expect(movementHistory).toHaveCount(1);
    await expect(movementHistory).toContainText("味方01");
    await expect(movementHistory).toContainText("移動");
    await expect(movementHistory).toContainText("2列・9行 → 2列・8行");
    await expect(page.locator(".map-grid .movement-path-step")).toHaveCount(0);
    const movedState = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number }; hasMoved: boolean }>;
    };
    expect(movedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
      position: { x: 1, y: 7 },
      hasMoved: true
    });
  });

  test("exposes a navigable ARIA grid with a single tab stop and directional keys", async ({ page }) => {
    await startBattle(page);
    const savedBeforeNavigation = await readAutoSave(page);
    const grid = page.getByRole("grid", { name: "10列10行の戦闘マップ" });
    await expect(grid).toHaveAttribute("aria-rowcount", "10");
    await expect(grid).toHaveAttribute("aria-colcount", "10");
    await expect(grid.getByRole("row")).toHaveCount(10);
    await expect(grid.getByRole("row").first().getByRole("gridcell")).toHaveCount(10);
    await expect(grid.locator(".map-tile[tabindex='0']")).toHaveCount(1);
    await expect(page.locator("#map-keyboard-help")).toContainText("矢印キー");
    await expect(grid).toHaveAttribute("aria-describedby", "map-keyboard-help");

    const firstTile = grid.getByRole("button").first();
    await firstTile.focus();
    await page.keyboard.press("ArrowRight");
    const secondColumn = grid.getByRole("button", { name: /2列・1行/ });
    await expect(secondColumn).toBeFocused();
    await expect(grid.locator(".map-tile[tabindex='0']")).toHaveCount(1);

    await page.keyboard.press("ArrowDown");
    const secondRow = grid.getByRole("button", { name: /2列・2行/ });
    await expect(secondRow).toBeFocused();
    await page.keyboard.press("Home");
    const rowStart = grid.getByRole("button", { name: /1列・2行/ });
    await expect(rowStart).toBeFocused();
    await page.keyboard.press("End");
    const rowEnd = grid.getByRole("button", { name: /10列・2行/ });
    await expect(rowEnd).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(rowEnd).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(grid.getByRole("button", { name: /10列・1行/ })).toBeFocused();
    expect(await readAutoSave(page)).toEqual(savedBeforeNavigation);
  });

  test("previews a movement route when a reachable tile receives keyboard focus", async ({ page }) => {
    await startBattle(page);
    const savedState = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const player = savedState.units.find((unit) => unit.id === "unit_001");
    if (!player) throw new Error("The keyboard route-preview unit is missing from the auto save.");
    player.position = { x: 0, y: 0 };
    await writeAutoSave(page, savedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const playerTile = page.locator(".map-grid").getByRole("button", { name: /味方01/ });
    await playerTile.click();
    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    await viewport.focus();
    await page.keyboard.press("Tab");
    await expect(playerTile).toBeFocused();
    await page.keyboard.press("ArrowRight");

    const destination = page.locator(".map-grid").getByRole("button", { name: /2列・1行/ });
    await expect(destination).toBeFocused();
    await expect(destination).toHaveAttribute("aria-label", /移動経路 2番/);
    await expect(page.locator(".map-grid .movement-path-step")).toHaveCount(2);
    expect(await readAutoSave(page)).toEqual(savedState);
  });

  test("shows post-move attack targets when navigating the movement preview by keyboard", async ({ page }) => {
    await startBattle(page);

    const preparedState = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const attacker = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!attacker) throw new Error("The keyboard attack-preview unit is missing from the auto save.");
    attacker.position = { x: 0, y: 4 };
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedBeforePreview = await readAutoSave(page);
    const playerTile = page.locator(".map-grid").getByRole("button", { name: /味方01/ });
    await playerTile.click();
    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    await viewport.focus();
    await page.keyboard.press("Tab");
    await expect(playerTile).toBeFocused();
    await page.keyboard.press("ArrowRight");

    const destination = page.locator(".map-grid").getByRole("button", { name: /2列・5行/ });
    const target = page.locator(".map-grid").getByRole("button", { name: /敵04/ });
    await expect(destination).toBeFocused();
    await expect(destination).toHaveAttribute("aria-label", /移動経路 2番/);
    await expect(target).toHaveClass(/is-attackable-after-move/);
    await expect(target).toHaveAttribute("aria-label", /移動プレビュー先から攻撃可能/);
    await expect(page.locator(".legend-swatch.attack-after-move")).toBeVisible();
    await expect(page.getByTestId("movement-attack-preview-help"))
      .toContainText("橙色の枠は、この移動先から新たに攻撃可能になる敵です");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);
  });

  test("highlights enemies attackable from a movement preview without saving", async ({ page }) => {
    await startBattle(page);

    const preparedState = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const attacker = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!attacker) throw new Error("The attack-preview unit is missing from the auto save.");
    attacker.position = { x: 0, y: 4 };
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedBeforePreview = await readAutoSave(page);
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    const destination = page.locator(".map-grid").getByRole("button", { name: /2列・5行/ });
    const target = page.locator(".map-grid").getByRole("button", { name: /敵04/ });

    await destination.hover();

    await expect(destination).toHaveClass(/is-movement-path/);
    await expect(target).toHaveClass(/is-attackable-after-move/);
    await expect(target).toHaveAttribute("aria-label", /移動プレビュー先から攻撃可能/);
    await expect(page.locator(".legend-swatch.attack-after-move")).toBeVisible();
    await expect(page.getByTestId("movement-attack-preview-help"))
      .toContainText("橙色の枠は、この移動先から新たに攻撃可能になる敵です");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);
  });

  test("does not show a new attack cue for enemies already in range", async ({ page }) => {
    await startBattle(page);

    const preparedState = await readAutoSave(page) as {
      units: Array<{ id: string; position: { x: number; y: number } }>;
    };
    const attacker = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!attacker) throw new Error("The attack-preview unit is missing from the auto save.");
    attacker.position = { x: 1, y: 4 };
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedBeforePreview = await readAutoSave(page);
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    const destination = page.locator(".map-grid").getByRole("button", { name: /3列・6行/ });
    const target = page.locator(".map-grid").getByRole("button", { name: /敵04/ });

    await destination.hover();

    await expect(destination).toHaveClass(/is-movement-path/);
    await expect(target).toHaveClass(/is-attackable/);
    await expect(target).not.toHaveClass(/is-attackable-after-move/);
    await expect(page.locator(".legend-swatch.attack-after-move")).toHaveCount(0);
    await expect(page.getByTestId("movement-attack-preview-help"))
      .toContainText("この移動先から新たに攻撃可能になる敵はいません");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);
  });

  test("previews a movement route on touch before confirming the destination", async ({ page }) => {
    const browser = page.context().browser();
    if (!browser) throw new Error("The Chromium browser is unavailable for the touch test.");
    const touchContext = await browser.newContext({
      baseURL: "http://127.0.0.1:4173",
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true
    });
    const touchPage = await touchContext.newPage();

    try {
      await startBattle(touchPage);
      const preparedState = await readAutoSave(touchPage) as {
        units: Array<{ id: string; position: { x: number; y: number } }>;
      };
      const attacker = preparedState.units.find((unit) => unit.id === "unit_001");
      if (!attacker) throw new Error("The attack-preview unit is missing from the touch auto save.");
      attacker.position = { x: 0, y: 4 };
      await writeAutoSave(touchPage, preparedState);
      await touchPage.reload();
      await continueSavedCampaign(touchPage);
      await expect(touchPage.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

      const savedBeforePreview = await readAutoSave(touchPage);
      const playerTile = touchPage.locator(".map-grid").getByRole("button", { name: /味方01/ });
      await playerTile.tap();
      const destination = touchPage.locator(".map-grid").getByRole("button", { name: /2列・5行/ });
      const target = touchPage.locator(".map-grid").getByRole("button", { name: /敵04/ });
      await destination.tap();

      await expect(destination).toHaveClass(/is-movement-path/);
      await expect(destination).toHaveAttribute("aria-label", /移動経路 2番/);
      await expect(target).toHaveClass(/is-attackable-after-move/);
      await expect(target).toHaveAttribute("aria-label", /移動プレビュー先から攻撃可能/);
      await expect(touchPage.locator(".legend-swatch.attack-after-move")).toBeVisible();
      await expect(touchPage.getByRole("status")).toContainText("同じマスをもう一度タップすると移動します。");
      expect(await readAutoSave(touchPage)).toEqual(savedBeforePreview);

      await destination.tap();
      await expect(touchPage.getByRole("status")).toContainText("味方01が2列・5行へ移動しました。");
      await expect(touchPage.locator(".map-grid .movement-path-step")).toHaveCount(0);
      const movedState = await readAutoSave(touchPage) as {
        units: Array<{ id: string; position: { x: number; y: number }; hasMoved: boolean }>;
      };
      expect(movedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
        position: { x: 1, y: 4 },
        hasMoved: true
      });
      await expect(target).not.toHaveClass(/is-attackable-after-move/);
    } finally {
      await touchContext.close();
    }
  });

  test("shows objective progress and inspects terrain without changing the autosave", async ({ page }) => {
    await startBattle(page);
    const objective = page.getByTestId("battle-objective");
    await expect(objective).toContainText("敵を全滅させる");
    await expect(objective).toContainText("残り 5 / 5体");
    await expect(objective).toContainText("味方全滅");
    await expect(objective).toContainText("生存味方 4体");

    const savedBeforeInspection = await readAutoSave(page);
    const terrain = page.getByTestId("terrain-inspector");
    const forestTile = page.locator(".map-grid").getByRole("button", { name: /4列・1行/ });
    const mapViewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });
    await mapViewport.focus();
    await page.keyboard.press("Tab");
    for (let index = 0; index < 3; index += 1) {
      await page.keyboard.press("ArrowRight");
    }
    await expect(forestTile).toBeFocused();
    await expect(terrain).toContainText("森");
    await expect(terrain).toContainText("歩兵の移動コスト");
    await expect(terrain).toContainText("2");
    await expect(terrain).toContainText("騎馬の移動コスト");
    await expect(terrain).toContainText("3");
    await expect(terrain).toContainText("守備補正");
    await expect(terrain).toContainText("+1");
    await expect(terrain).toContainText("+20");

    const mountainTile = page.locator(".map-grid").getByRole("button", { name: /3列・4行/ });
    await mountainTile.click();
    await expect(terrain).toContainText("山");
    await expect(terrain).toContainText("騎馬の移動コスト");
    await expect(terrain).toContainText("進入不可");
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
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
    player.position = { x: 3, y: 1 }; player.hasMoved = false; player.hasActed = false;
    enemy.position = { x: 4, y: 1 }; enemy.hasMoved = false; enemy.hasActed = false;
    preparedState.units = [player, enemy];
    preparedState.rngState = 0x6d2b79f5;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await page.locator(".map-grid").getByRole("button", { name: /敵01/ }).click();

    const forecast = page.getByTestId("combat-forecast");
    await expect(forecast).toBeVisible();
    await expect(forecast).toContainText("味方01");
    await expect(forecast).toContainText("敵01");
    await expect(forecast).toContainText("HP 20/20");
    await expect(forecast).toContainText("反撃あり");
    await expect(forecast.getByTestId("combat-forecast-strike")).toHaveCount(2);
    const initialForecast = forecast.getByTestId("combat-forecast-strike").first();
    await expect(initialForecast).toContainText("攻撃力");
    await expect(initialForecast).toContainText("必殺時ダメージ");
    await expect(initialForecast).toContainText("武器相性");
    await expect(initialForecast).toContainText("有利（命中 +20）");
    await expect(initialForecast).toContainText("対象地形：森");
    await expect(initialForecast).toContainText("守備補正 +1／回避補正 +20");
    const counterForecast = forecast.getByTestId("combat-forecast-strike").nth(1);
    await expect(counterForecast).toContainText("不利（命中 -20）");
    const saveBeforeForecast = await readAutoSave(page);
    expect(saveBeforeForecast).toMatchObject({ phase: "player", turn: 1 });
    await expect(forecast).toBeVisible();
    expect(await readAutoSave(page)).toEqual(saveBeforeForecast);

    await page.getByRole("button", { name: "攻撃を確定" }).click();

    const report = page.getByTestId("battle-history");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("battle-history-entry")).toHaveCount(1);
    const playerAttack = report.getByTestId("battle-history-entry").first();
    await expect(playerAttack).toContainText("第1ターン");
    await expect(playerAttack).toContainText("味方01 vs 敵01");
    await expect(playerAttack.getByTestId("player-attack-strike")).toHaveCount(2);
    await expect(playerAttack).toContainText("先制攻撃");
    await expect(playerAttack).toContainText("反撃");
    await expect(playerAttack).toContainText("試作の鉄の剣");
    await expect(playerAttack).toContainText("獲得EXP：+10");
    await expect(playerAttack).toContainText(/HP 20 → \d+/);
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      historyWidth: document.querySelector("[data-testid=battle-history]")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.historyWidth).toBeGreaterThan(0);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    await expect(page.getByTestId("phase-end-review")).toHaveCount(0);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    await expect(report.getByTestId("battle-history-entry")).toHaveCount(2);
    const enemyPhase = report.getByTestId("battle-history-entry").nth(1);
    await expect(enemyPhase).toContainText("第1ターン");
    await expect(enemyPhase).toContainText("敵軍フェイズ");
    await expect(enemyPhase.getByTestId("enemy-phase-action")).toHaveCount(1);
    const savedState = await readAutoSave(page);
    expect(savedState).not.toHaveProperty("battleHistory");
    expect(savedState).not.toHaveProperty("lastPlayerAttackReport");
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(savedState);
  });

  test("explains when the defender cannot counter and keeps the forecast view-only", async ({ page }) => {
    await startBattle(page);
    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        position: { x: number; y: number };
        inventory: string[];
        equippedWeaponId: string | null;
        hasMoved: boolean;
        hasActed: boolean;
      }>;
    };
    const player = preparedState.units.find((unit) => unit.id === "unit_001");
    const enemy = preparedState.units.find((unit) => unit.id === "enemy_001");
    if (!player || !enemy) throw new Error("Combat forecast test units are missing from the auto save.");
    player.position = { x: 1, y: 1 };
    player.hasMoved = false;
    player.hasActed = false;
    enemy.position = { x: 2, y: 1 };
    enemy.inventory = [];
    enemy.equippedWeaponId = null;
    enemy.hasMoved = false;
    enemy.hasActed = false;
    preparedState.units = [player, enemy];
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await page.locator(".map-grid").getByRole("button", { name: /敵01/ }).click();

    const saveBeforeForecast = await readAutoSave(page);
    const forecast = page.getByTestId("combat-forecast");
    await expect(forecast).toBeVisible();
    await expect(forecast).toContainText("反撃なし（有効な装備武器なし）");
    await expect(forecast.getByTestId("combat-forecast-strike")).toHaveCount(1);
    await expect(forecast.getByTestId("combat-forecast-strike").first()).toContainText("先制攻撃");
    expect(await readAutoSave(page)).toEqual(saveBeforeForecast);
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

    player.position = { x: 4, y: 1 };    enemy.position = { x: 1, y: 1 };
    enemy.move = 2;
    enemy.hasMoved = false;
    enemy.hasActed = false;
    preparedState.units = [player, enemy];
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    const savedBeforeInspection = await readAutoSave(page);

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

    await page.locator('.map-grid [data-map-position="3,0"]').click();
    const threatInspector = page.getByTestId("enemy-threat-inspector");
    await expect(threatInspector).toBeVisible();
    await expect(threatInspector).toContainText("4列・1行 · 敵 1体");
    await expect(threatInspector.locator('[data-testid="enemy-threat-source"]')).toHaveCount(1);
    const source = threatInspector.locator('[data-testid="enemy-threat-source"]').first();
    await expect(source).toContainText("敵01");
    await expect(source).toContainText("試作の鉄の斧");
    await expect(source).toContainText("射程 1–1");
    await expect(source).toContainText("攻撃可能な起点 2箇所");
    await expect(source).toContainText("2列・2行");
    await expect(source).toContainText("移動後");
    await expect(source.getByTestId("enemy-threat-origin")).toHaveCount(2);
    await expect(source).toContainText("3列・1行");
    await expect(source).toContainText("4列・2行");
    await expect(threatInspector).toContainText("敵AIが実際に選ぶ移動先");
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);

    await safeTile.click();
    await expect(threatInspector).toContainText("このマスを攻撃できる敵はいません。");
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);

    await hideButton.click();
    await expect(showButton).toHaveAttribute("aria-pressed", "false");
    await expect(threatenedTile).not.toHaveClass(/is-enemy-threatened/);

    await showButton.click();
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.getByRole("button", { name: "敵の攻撃範囲を表示" })).toHaveAttribute("aria-pressed", "false");
  });

  test("shows enemy threat sources on a 320px viewport without page overflow", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);

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
    if (!player || !enemy) throw new Error("Threat detail test units are missing from the auto save.");

    player.position = { x: 4, y: 1 };
    enemy.position = { x: 1, y: 1 };
    enemy.move = 2;
    enemy.hasMoved = false;
    enemy.hasActed = false;
    preparedState.units = [player, enemy];
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedBeforeInspection = await readAutoSave(page);
    await page.getByRole("button", { name: "敵の攻撃範囲を表示" }).click();
    await page.locator('.map-grid [data-map-position="3,0"]').click();

    const inspector = page.getByTestId("enemy-threat-inspector");
    await expect(inspector).toBeVisible();
    await expect(inspector).toContainText("敵01");
    await expect(inspector).toContainText("試作の鉄の斧");
    await expect(inspector).toContainText("攻撃可能な起点 2箇所");

    const bounds = await inspector.boundingBox();
    if (!bounds) throw new Error("Enemy threat details are not laid out on the narrow viewport.");
    expect(bounds.width).toBeLessThanOrEqual(320);
    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(320);
    expect(await readAutoSave(page)).toEqual(savedBeforeInspection);
  });

  test("shows per-ally combat contributions after an actual player victory", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 390, height: 844 });

    const preparedState = await readAutoSave(page) as {
      rngState: number;
      units: Array<{
        id: string;
        faction: "player" | "enemy";
        position: { x: number; y: number };
        currentHp: number;
        level: number;
        experience: number;
        hasMoved: boolean;
        hasActed: boolean;
        stats: {
          hp: number; strength: number; magic: number; skill: number;
          speed: number; luck: number; defense: number; resistance: number;
        };
        growthRates: {
          hp: number; strength: number; magic: number; skill: number;
          speed: number; luck: number; defense: number; resistance: number;
        };
      }>;
    };
    const player = preparedState.units.find((unit) => unit.id === "unit_001");
    const enemy = preparedState.units.find((unit) => unit.id === "enemy_001");
    if (!player || !enemy) throw new Error("Battle contribution fixture units are missing.");

    player.position = { x: 3, y: 1 };
    player.currentHp = 20;
    player.level = 1;
    player.experience = 90;
    player.hasMoved = false;
    player.hasActed = false;
    player.stats = {
      hp: 25, strength: 20, magic: 0, skill: 20,
      speed: 8, luck: 4, defense: 5, resistance: 1
    };
    player.growthRates = {
      hp: 100, strength: 100, magic: 100, skill: 100,
      speed: 100, luck: 100, defense: 100, resistance: 100
    };

    enemy.position = { x: 4, y: 1 };
    enemy.currentHp = 1;
    enemy.hasMoved = false;
    enemy.hasActed = false;
    enemy.stats = { ...enemy.stats, defense: 0, speed: 0, luck: 0 };

    preparedState.units = [player, enemy];
    preparedState.rngState = 0x6d2b79f5;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await page.locator(".map-grid").getByRole("button", { name: /敵01/ }).click();
    await page.getByRole("button", { name: "攻撃を確定" }).click();

    await expect(page.locator(".battle-outcome")).toContainText("ステージクリア");
    const contribution = page.getByTestId("battle-contribution-unit_001");
    await expect(contribution).toBeVisible();
    await expect(contribution).toContainText("味方01");
    await expect(contribution).toContainText("攻撃行動 1回");
    await expect(contribution).toContainText("命中（必殺含む）");
    await expect(contribution).toContainText("与ダメージ");
    await expect(contribution).toContainText("撃破");
    await expect(contribution).toContainText("+30");
    await expect(contribution).toContainText("レベルアップ");
    await expect(contribution).toContainText("能力上昇：HP +1");
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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
    await continueSavedCampaign(page);

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
    const contributionPanel = page.getByTestId("battle-contributions");
    await expect(contributionPanel).toBeVisible();
    await expect(contributionPanel).toContainText("集計できる味方の攻撃記録はありません");
    await expect(contributionPanel).toContainText("リロード・セーブ読込・章切替後");


    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".battle-outcome")).toContainText("ステージクリア");
    await expect(page.getByTestId("result-enemy-enemy_001")).toContainText("撃破");
    await expect(page.locator(".result-player-row")).toHaveCount(4);
    await expect(page.getByTestId("battle-contributions")).toContainText("集計できる味方の攻撃記録はありません");
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
    await continueSavedCampaign(page);

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    const promotionPanel = page.locator(".promotion-panel");
    await expect(promotionPanel).toContainText("移動・行動前のみ可能");
    await expect(promotionPanel.getByRole("button", { name: "クラスチェンジを確認" })).toBeDisabled();

    preparedUnit.hasMoved = false;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await promotionPanel.getByRole("button", { name: "クラスチェンジを確認" }).click();
    const confirmation = page.getByRole("group", { name: "クラスチェンジ確認" });
    await expect(confirmation).toContainText("能力ボーナス・クラス上限はすべて試作値です。");
    await expect(confirmation).toContainText("Lv.10 → Lv.1");
    await expect(confirmation).toContainText("EXP 73（保持）");
    await expect(confirmation).toContainText("昇格後は行動済み");

    const statPreview = confirmation.getByRole("table", { name: "昇格後の能力値プレビュー" });
    await expect(statPreview.locator("tbody tr")).toHaveCount(8);
    const expectedStatPreview = [
      { key: "hp", current: "20", next: "22", change: "要求 +2 / 実 +2 / 上限 60" },
      { key: "strength", current: "32", next: "32", change: "要求 +0 / 実 +0 / 上限 30" },
      { key: "magic", current: "0", next: "0", change: "要求 +0 / 実 +0 / 上限 30" },
      { key: "skill", current: "7", next: "8", change: "要求 +1 / 実 +1 / 上限 30" },
      { key: "speed", current: "8", next: "9", change: "要求 +1 / 実 +1 / 上限 30" },
      { key: "luck", current: "4", next: "4", change: "要求 +0 / 実 +0 / 上限 30" },
      { key: "defense", current: "5", next: "5", change: "要求 +0 / 実 +0 / 上限 30" },
      { key: "resistance", current: "1", next: "1", change: "要求 +0 / 実 +0 / 上限 30" }
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
    const promotionHistory = page.getByTestId("battle-history").getByTestId("player-action-history");
    await expect(promotionHistory).toHaveCount(1);
    await expect(promotionHistory).toContainText("味方01");
    await expect(promotionHistory).toContainText("クラスチェンジ");
    await expect(promotionHistory).toContainText("ソードマスターへクラスチェンジ");

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
    await continueSavedCampaign(page);
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
  });


  test("uses and explains the class-based ranged-attacker target priority without changing the save during forecast", async ({ page }) => {
    await startBattle(page);
    const saved = await readAutoSave(page) as {
      units: Array<Record<string, unknown> & {
        id: string;
        faction: string;
        classId: string;
        currentHp: number;
        stats: Record<string, number>;
      }>;
      [key: string]: unknown;
    };
    const units = saved.units.map((unit) => {
      if (unit.id === "unit_001") {
        return {
          ...unit,
          classId: "swordsman",
          position: { x: 4, y: 4 },
          currentHp: 20,
          stats: { ...unit.stats, hp: 20, strength: 6, skill: 7, speed: 8, luck: 4, defense: 5, resistance: 1 },
          usableWeaponTypes: ["sword"],
          inventory: ["iron_sword"],
          equippedWeaponId: "iron_sword",
          hasMoved: false,
          hasActed: false
        };
      }
      if (unit.id === "unit_002") {
        return {
          ...unit,
          classId: "archer",
          position: { x: 5, y: 5 },
          currentHp: 20,
          stats: { ...unit.stats, hp: 20, strength: 6, skill: 7, speed: 8, luck: 4, defense: 5, resistance: 1 },
          usableWeaponTypes: ["sword"],
          inventory: ["iron_sword"],
          equippedWeaponId: "iron_sword",
          hasMoved: false,
          hasActed: false
        };
      }
      if (unit.id === "enemy_001") {
        return { ...unit, position: { x: 4, y: 5 }, hasMoved: false, hasActed: false };
      }
      if (unit.faction === "enemy") {
        return { ...unit, hasMoved: true, hasActed: true };
      }
      return unit;
    });
    const configuredSave = { ...saved, units };
    await writeAutoSave(page, configuredSave);
    await page.reload();
    await continueSavedCampaign(page);

    const savedBeforeForecast = await readAutoSave(page);
    const forecast = page.getByTestId("enemy-phase-forecast");
    await expect(forecast).toBeVisible();
    await forecast.locator(":scope > details > summary").click();

    const actions = forecast.getByTestId("enemy-phase-forecast-action");
    await expect(actions).toHaveCount(1);
    await expect(actions.first()).toContainText("遠距離攻撃役を優先 +35点");
    await expect(actions.first()).toContainText("味方02");
    const forecastEvaluations = actions.first().getByTestId("enemy-target-evaluations");
    await expect(forecastEvaluations).toBeVisible();
    await forecastEvaluations.locator("summary").click();
    const forecastCandidates = forecastEvaluations.getByTestId("enemy-target-evaluation");
    await expect(forecastCandidates).toHaveCount(2);
    await expect(forecastCandidates.nth(0)).toHaveAttribute("data-target-id", "unit_002");
    await expect(forecastCandidates.nth(0)).toContainText("採用対象");
    await expect(forecastCandidates.nth(0)).toContainText("遠距離攻撃役");
    await expect(forecastCandidates.nth(0)).toContainText("+35点");
    await expect(forecastCandidates.nth(1)).toHaveAttribute("data-target-id", "unit_001");
    const candidateScores = await forecastCandidates.evaluateAll((nodes) =>
      nodes.map((node) => Number(node.getAttribute("data-score")))
    );
    expect(candidateScores[0]).toBeGreaterThan(candidateScores[1]!);
    expect(await readAutoSave(page)).toEqual(savedBeforeForecast);

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    const review = page.getByTestId("phase-end-review");
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "未行動の味方を残して敵軍フェイズへ" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const historyAction = page.getByTestId("battle-history").getByTestId("enemy-phase-action").first();
    await expect(historyAction).toContainText("遠距離攻撃役を優先 +35点");
    const historyEvaluations = historyAction.getByTestId("enemy-target-evaluations");
    await expect(historyEvaluations).toBeVisible();
    await historyEvaluations.locator("summary").click();
    await expect(historyEvaluations.getByTestId("enemy-target-evaluation")).toHaveCount(2);
    await expect(historyEvaluations.getByTestId("enemy-target-evaluation").first())
      .toHaveAttribute("data-target-id", "unit_002");
  });

  test("explains enemy approach movement in forecast and actual history without saving the preview", async ({ page }) => {
    await startBattle(page);
    const saved = await readAutoSave(page) as {
      units: Array<Record<string, unknown> & {
        id: string;
        faction: string;
        position: { x: number; y: number };
        move: number;
        hasMoved: boolean;
        hasActed: boolean;
      }>;
      [key: string]: unknown;
    };
    const playerPositions: Record<string, { x: number; y: number }> = {
      unit_001: { x: 1, y: 8 },
      unit_002: { x: 8, y: 8 },
      unit_003: { x: 8, y: 9 },
      unit_004: { x: 9, y: 9 }
    };
    const units = saved.units.map((unit) => {
      if (unit.faction === "player") {
        return { ...unit, position: playerPositions[unit.id] ?? unit.position };
      }
      if (unit.id === "enemy_001") {
        return {
          ...unit,
          position: { x: 1, y: 2 },
          move: 2,
          hasMoved: false,
          hasActed: false
        };
      }
      if (unit.faction === "enemy") return { ...unit, hasMoved: true, hasActed: true };
      return unit;
    });
    await writeAutoSave(page, { ...saved, units });
    await page.reload();
    await continueSavedCampaign(page);

    const savedBeforeForecast = await readAutoSave(page);
    const forecast = page.getByTestId("enemy-phase-forecast");
    await expect(forecast).toBeVisible();
    await forecast.locator(":scope > details > summary").click();
    const actions = forecast.getByTestId("enemy-phase-forecast-action");
    await expect(actions).toHaveCount(1);
    await expect(actions.first()).toContainText("最寄りの味方との距離 6→4");
    await expect(actions.first()).toContainText("同距離候補は地形評価で比較");
    const movementDetails = actions.first().getByTestId("enemy-movement-evaluations");
    await expect(movementDetails).toBeVisible();
    await movementDetails.locator(":scope > summary").click();
    const movementCandidates = movementDetails.getByTestId("enemy-movement-evaluation");
    await expect(movementCandidates).not.toHaveCount(0);
    const chosenPosition = await actions.first().getAttribute("data-destination-position");
    expect(chosenPosition).not.toBeNull();
    await expect(movementCandidates.first()).toHaveAttribute("data-position", chosenPosition!);
    const forecastMovementScores = await movementCandidates.evaluateAll((nodes) =>
      nodes.map((node) => ({
        position: node.getAttribute("data-position"),
        score: Number(node.getAttribute("data-score"))
      }))
    );
    for (let index = 1; index < forecastMovementScores.length; index += 1) {
      expect(forecastMovementScores[index - 1]!.score)
        .toBeGreaterThanOrEqual(forecastMovementScores[index]!.score);
    }
    await expect(movementCandidates.first()).toContainText("距離ペナルティ");
    const forecastMessage = await actions.first().locator(":scope > p").textContent();
    expect(await readAutoSave(page)).toEqual(savedBeforeForecast);

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    const review = page.getByTestId("phase-end-review");
    await expect(review).toBeVisible();
    await review.getByRole("button", { name: "未行動の味方を残して敵軍フェイズへ" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const actualActions = page.getByTestId("battle-history").getByTestId("enemy-phase-action");
    await expect(actualActions).toHaveCount(1);
    await expect(actualActions.first().locator(":scope > p")).toHaveText(forecastMessage ?? "");
    await expect(actualActions.first()).toHaveAttribute("data-destination-position", chosenPosition!);
    const actualMovementDetails = actualActions.first().getByTestId("enemy-movement-evaluations");
    await expect(actualMovementDetails).toBeVisible();
    await actualMovementDetails.locator(":scope > summary").click();
    const actualMovementScores = await actualMovementDetails.getByTestId("enemy-movement-evaluation").evaluateAll((nodes) =>
      nodes.map((node) => ({
        position: node.getAttribute("data-position"),
        score: Number(node.getAttribute("data-score"))
      }))
    );
    expect(actualMovementScores).toEqual(forecastMovementScores);
  });

  test("forecasts each ally's surviving HP and matches the resolved enemy phase without saving the preview", async ({ page }) => {
    await startBattle(page);
    const savedBeforePreview = await readAutoSave(page);
    const forecast = page.getByTestId("enemy-phase-forecast");
    await expect(forecast).toBeVisible();
    const details = forecast.locator(":scope > details");
    await expect(details.locator(":scope > summary")).toHaveText("行動順と予測結果を表示");
    await details.locator(":scope > summary").click();

    const projected = forecast.getByTestId("enemy-phase-forecast-action");
    await expect(projected).toHaveCount(5);
    const messages = await projected.locator("p").allTextContents();
    const projectedUnits = forecast.getByTestId("enemy-phase-forecast-unit");
    const deployedPlayerCount = (savedBeforePreview as {
      units: Array<{ faction: string }>;
    }).units.filter((unit) => unit.faction === "player").length;
    await expect(projectedUnits).toHaveCount(deployedPlayerCount);
    const unitOutcomes = await projectedUnits.evaluateAll((nodes) => nodes.map((node) => ({
      unitId: node.getAttribute("data-unit-id"),
      predictedHp: Number(node.getAttribute("data-predicted-hp")),
      defeated: node.getAttribute("data-defeated") === "true"
    })));
    await expect(forecast).toContainText("予測被ダメージ");
    await expect(forecast).toContainText("砦回復");
    await expect(forecast).toContainText("予測結果：");
    await expect(forecast).toContainText("AIの評価値と距離方式は暫定です");
    expect(await readAutoSave(page)).toEqual(savedBeforePreview);

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    const phaseEndReview = page.getByTestId("phase-end-review");
    await expect(phaseEndReview).toBeVisible();
    await phaseEndReview.getByRole("button", { name: "未行動の味方を残して敵軍フェイズへ" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const actual = page.getByTestId("battle-history").getByTestId("enemy-phase-action");
    await expect(actual).toHaveCount(5);
    expect(await actual.locator("p").allTextContents()).toEqual(messages);

    const savedAfterEnemyPhase = await readAutoSave(page) as {
      units: Array<{ id: string; faction: string; currentHp: number }>;
    };
    for (const outcome of unitOutcomes) {
      const actualUnit = savedAfterEnemyPhase.units.find((unit) => unit.id === outcome.unitId);
      if (outcome.defeated) expect(actualUnit).toBeUndefined();
      else expect(actualUnit?.currentHp).toBe(outcome.predictedHp);
    }
    await expect(forecast).toBeVisible();
  });

  test("records enemy actions in the chronological battle history and clears it on reload", async ({ page }) => {
    await startBattle(page);
    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    const phaseEndReview = page.getByTestId("phase-end-review");
    await expect(phaseEndReview).toBeVisible();
    await phaseEndReview.getByRole("button", { name: "未行動の味方を残して敵軍フェイズへ" }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    const report = page.getByTestId("battle-history");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("battle-history-entry")).toHaveCount(1);
    const enemyPhase = report.getByTestId("battle-history-entry").first();
    await expect(enemyPhase).toContainText("第1ターン");
    await expect(enemyPhase).toContainText("敵軍フェイズ");
    await expect(enemyPhase.getByTestId("enemy-phase-action")).toHaveCount(5);
    for (const enemyName of ["敵01", "敵02", "敵03", "敵04", "敵05"]) await expect(enemyPhase).toContainText(enemyName);
    await expect(enemyPhase).toContainText(/攻撃|移動|待機/);
    await expect(report).toContainText("セーブデータには保存しません");
    const savedState = await readAutoSave(page);
    expect(savedState).not.toHaveProperty("battleHistory");
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(savedState);
  });

  test("rebuilds one chronological enemy-phase entry when resuming a saved enemy phase", async ({ page }) => {
    await startBattle(page);
    const checkpoint = await readAutoSave(page) as {
      phase: "player" | "enemy"; turn: number;
      units: Array<{ id: string; faction: "player" | "enemy"; hasActed: boolean }>;
    };
    checkpoint.phase = "enemy";
    await writeAutoSave(page, checkpoint);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });    const report = page.getByTestId("battle-history");
    await expect(report).toBeVisible();
    await expect(report.getByTestId("battle-history-entry")).toHaveCount(1);
    const enemyPhase = report.getByTestId("battle-history-entry").first();
    await expect(enemyPhase).toContainText("第1ターン");
    await expect(enemyPhase).toContainText("敵軍フェイズ");
    await expect(enemyPhase.getByTestId("enemy-phase-action")).toHaveCount(5);
    const resolvedState = await readAutoSave(page) as { phase: string; turn: number; [key: string]: unknown };
    expect(resolvedState.phase).toBe("player");
    expect(resolvedState.turn).toBe(2);
    expect(resolvedState).not.toHaveProperty("battleHistory");
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ");
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(resolvedState);
  });

  test("keeps map tiles finger-sized and keyboard-scrollable at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await startBattle(page);
    const viewport = page.getByRole("region", {
      name: "戦闘マップ。狭い画面では左右にスクロールできます"
    });    await expect(viewport).toBeVisible();
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

      const unitTile = page.locator(".map-grid").getByRole("button", { name: /味方01/ });
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

  test("uses a healing item after moving, cancels safely, and consumes one item and the action", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startBattle(page);

    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        currentHp: number;
        stats: { hp: number };
        inventory: string[];
        hasMoved: boolean;
        hasActed: boolean;
      }>;
    };
    const preparedUnit = preparedState.units.find((unit) => unit.id === "unit_001");
    if (!preparedUnit) throw new Error("The healing-item test unit is missing from the auto save.");

    preparedUnit.currentHp = preparedUnit.stats.hp - 7;
    preparedUnit.inventory = [...preparedUnit.inventory, "healing_potion", "healing_potion"];
    preparedUnit.hasMoved = true;
    preparedUnit.hasActed = false;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);

    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    const useButtons = page.getByRole("button", { name: "回復薬を使用" });
    const healingPotionRow = page.locator(".inventory-items li").filter({ hasText: "回復薬" });
    await expect(useButtons).toHaveCount(1);
    await expect(healingPotionRow).toContainText("所持数：2個");
    const useButton = useButtons;
    await expect(useButton).toBeEnabled();

    const beforeCancel = await readAutoSave(page);
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("回復量は試作値");
      await dialog.dismiss();
    });
    await useButton.click();
    expect(await readAutoSave(page)).toEqual(beforeCancel);
    await expect(useButton).toBeEnabled();

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain("行動を消費");
      await dialog.accept();
    });
    await useButton.click();
    await expect(useButton).toBeDisabled();
    await expect(page.locator(".unit-details")).toContainText("行動済み");
    const itemHistory = page.getByTestId("battle-history").getByTestId("player-action-history");
    await expect(itemHistory).toHaveCount(1);
    await expect(itemHistory).toContainText("回復薬");
    await expect(itemHistory).toContainText("HP +7");

    await expect.poll(async () => {
      const saved = await readAutoSave(page) as {
        units: Array<{ id: string; currentHp: number }>;
      };
      return saved.units.find((candidate) => candidate.id === "unit_001")?.currentHp;
    }).toBe(preparedUnit.stats.hp);

    const healedState = await readAutoSave(page) as {
      units: Array<{ id: string; currentHp: number; inventory: string[]; hasMoved: boolean; hasActed: boolean }>;
    };
    const healedUnit = healedState.units.find((unit) => unit.id === "unit_001");
    expect(healedUnit).toMatchObject({
      currentHp: preparedUnit.stats.hp,
      hasMoved: true,
      hasActed: true
    });
    expect(healedUnit?.inventory.filter((itemId) => itemId === "healing_potion")).toHaveLength(1);
    await expect(healingPotionRow).toContainText("所持数：1個");

    await page.reload();
    await continueSavedCampaign(page);
    await page.locator(".map-grid").getByRole("button", { name: /味方01/ }).click();
    await expect(page.locator(".unit-details div").first()).toContainText(
      preparedUnit.stats.hp + " / " + preparedUnit.stats.hp
    );
    await expect(page.getByRole("button", { name: "回復薬を使用" })).toBeDisabled();
    await expect(page.locator(".inventory-items li").filter({ hasText: "回復薬" })).toContainText("所持数：1個");
    await expect(page.getByTestId("battle-history")).toHaveCount(0);
  });

  for (const viewportHeight of [568, 720]) {
    test(`scrolls the narrow map viewport and selects the right-side unit at 320x${viewportHeight}px`, async ({ browser }) => {
      const context = await browser.newContext({
        baseURL: "http://127.0.0.1:4173",
        viewport: { width: 320, height: viewportHeight },
        hasTouch: true
      });

      try {
        const page = await context.newPage();
        await startBattle(page);

        const viewport = page.getByRole("region", {
          name: "戦闘マップ。狭い画面では左右にスクロールできます"
        });
        await expect(viewport).toBeVisible();
        await viewport.scrollIntoViewIfNeeded();

        const bounds = await viewport.boundingBox();
        if (!bounds) throw new Error("The map viewport has no visible bounds.");
        const startX = bounds.x + bounds.width * 0.95;
        const endX = bounds.x + bounds.width * 0.05;
        const centerY = bounds.y + bounds.height / 2;
        expect(centerY).toBeGreaterThanOrEqual(0);
        expect(centerY).toBeLessThan(viewportHeight);
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

        const rightSideUnit = page.locator(".map-grid").getByRole("button", { name: /味方04/ });
        await expect(rightSideUnit).toBeVisible();
        // Let the touch scroll settle before measuring the target's final on-screen bounds.
        await page.waitForTimeout(500);
        const [viewportBounds, unitBounds] = await Promise.all([
          viewport.boundingBox(),
          rightSideUnit.boundingBox()
        ]);
        if (!viewportBounds || !unitBounds) throw new Error("The viewport or right-side unit has no visible bounds.");
        expect(unitBounds.x).toBeGreaterThanOrEqual(viewportBounds.x);
        expect(unitBounds.x + unitBounds.width).toBeLessThanOrEqual(viewportBounds.x + viewportBounds.width);
        expect(unitBounds.y).toBeGreaterThanOrEqual(0);
        expect(unitBounds.y + unitBounds.height).toBeLessThanOrEqual(viewportHeight);

        const tapPoint = {
          x: unitBounds.x + unitBounds.width / 2,
          y: unitBounds.y + unitBounds.height / 2
        };
        const hitTarget = await page.evaluate(({ x, y }) => {
          const element = document.elementFromPoint(x, y);
          return element?.closest("button")?.getAttribute("aria-label") ?? null;
        }, tapPoint);
        expect(hitTarget).toContain("味方04");

        await page.touchscreen.tap(tapPoint.x, tapPoint.y);
        await expect(rightSideUnit).toHaveAttribute("aria-pressed", "true");
        await expect(page.locator(".unit-heading")).toContainText("味方04");
      } finally {
        await context.close();
      }
    });
  }

  test("keeps deployment details usable at a narrow mobile viewport", async ({ page }) => {    await page.setViewportSize({ width: 390, height: 844 });
    await startNewCampaign(page);

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

  test("reviews unacted allies and returns to a selected unit without saving UI state", async ({ page }) => {
    await startBattle(page);
    const preparedState = await readAutoSave(page) as {
      units: Array<{
        id: string;
        faction: string;
        name: string;
        hasMoved: boolean;
        hasActed: boolean;
        currentHp: number;
        stats: { hp: number };
        level: number;
        classId: string;
        position: { x: number; y: number };
      }>;
    };
    const allies = preparedState.units.filter((unit) => unit.faction === "player");
    if (allies.length < 2) throw new Error("The phase review fixture requires at least two deployed allies.");
    allies[0]!.hasMoved = true;
    allies[0]!.hasActed = false;
    allies[1]!.hasMoved = true;
    allies[1]!.hasActed = true;
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    const savedBeforeReview = await readAutoSave(page);
    await page.setViewportSize({ width: 320, height: 720 });
    const pendingAllies = allies.filter((unit) => !unit.hasActed);
    const phaseEndButton = page.getByRole("button", { name: "自軍フェイズ終了" });
    await expect(phaseEndButton).toHaveAttribute("aria-expanded", "false");
    await phaseEndButton.click();

    const review = page.getByTestId("phase-end-review");
    await expect(review).toBeVisible();
    await expect(review).toBeFocused();
    await expect(phaseEndButton).toHaveAttribute("aria-expanded", "true");
    await expect(review.getByTestId("phase-end-review-pending-unit")).toHaveCount(pendingAllies.length);
    await expect(review).toContainText("まだ行動していない味方");
    await expect(review).toContainText(allies[0]!.name);
    await expect(review).toContainText("移動済み・未行動");
    await expect(review).toContainText("未移動・未行動");
    await expect(review).toContainText("次の敵軍フェイズ予測");
    await expect(review).toContainText("敵の行動");
    await expect(review).toContainText("被ダメージ見込み");
    await expect(review.getByTestId("phase-end-review-defeated")).toBeVisible();
    const reviewDimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      reviewWidth: document.querySelector("[data-testid=phase-end-review]")?.getBoundingClientRect().width ?? 0
    }));
    expect(reviewDimensions.reviewWidth).toBeGreaterThan(0);
    expect(reviewDimensions.documentWidth).toBeLessThanOrEqual(reviewDimensions.viewportWidth);
    expect(reviewDimensions.reviewWidth).toBeLessThanOrEqual(reviewDimensions.viewportWidth);
    expect(await readAutoSave(page)).toEqual(savedBeforeReview);

    await review.getByRole("button", { name: "戦闘に戻る" }).click();
    await expect(review).toHaveCount(0);
    await expect(phaseEndButton).toBeFocused();
    expect(await readAutoSave(page)).toEqual(savedBeforeReview);

    await phaseEndButton.click();
    await expect(review).toBeVisible();
    const selectedAlly = pendingAllies[0]!;
    const pendingRow = review.locator('[data-unit-id="' + selectedAlly.id + '"]');
    await pendingRow.getByRole("button", { name: selectedAlly.name + "を確認" }).click();
    await expect(review).toHaveCount(0);
    await expect(phaseEndButton).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator(".unit-heading h3")).toHaveText(selectedAlly.name);
    const selectedTile = page.locator(
      '.map-grid [data-map-position="' + selectedAlly.position.x + "," + selectedAlly.position.y + '"]'
    );
    await expect(selectedTile).toHaveClass(/is-selected/);
    await expect(selectedTile).toBeFocused();
    expect(await readAutoSave(page)).toEqual(savedBeforeReview);
  });

  test("explicitly ends the phase after reviewing unused allies", async ({ page }) => {
    await startBattle(page);
    const savedBeforeReview = await readAutoSave(page);
    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();

    const review = page.getByTestId("phase-end-review");
    await expect(review).toBeVisible();
    const pendingCount = await review.getByTestId("phase-end-review-pending-unit").count();
    expect(pendingCount).toBeGreaterThan(0);
    expect(await readAutoSave(page)).toEqual(savedBeforeReview);

    await review.getByRole("button", { name: "未行動の味方を残して敵軍フェイズへ" }).click();
    await expect(review).toHaveCount(0);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
    expect((await readAutoSave(page) as { turn: number; phase: string })).toMatchObject({
      turn: 2,
      phase: "player"
    });
  });

  test("ends the player phase immediately without a review when every ally has acted", async ({ page }) => {
    await startBattle(page);
    const preparedState = await readAutoSave(page) as {
      units: Array<{ faction: string; hasActed: boolean }>;
    };
    for (const unit of preparedState.units) {
      if (unit.faction === "player") unit.hasActed = true;
    }
    await writeAutoSave(page, preparedState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

    await page.getByRole("button", { name: "自軍フェイズ終了" }).click();
    await expect(page.getByTestId("phase-end-review")).toHaveCount(0);
    await expect(page.locator(".phase-badge")).toHaveText("第2ターン · 自軍フェイズ", { timeout: 15_000 });
  });

  test("navigates from a defeat-all objective to the living enemy roster without changing the save", async ({ page }) => {
    await startBattle(page);
    await page.setViewportSize({ width: 320, height: 720 });
    const savedBeforeNavigation = await readAutoSave(page);
    const objective = page.getByTestId("battle-objective");
    const navigationButton = objective.getByRole("button", {
      name: "残りの敵を一覧で確認、5体"
    });
    await expect(navigationButton).toBeVisible();
    await navigationButton.click();

    const enemyRoster = page.locator("#enemy-roster");
    await expect(enemyRoster).toBeFocused();
    await expect(enemyRoster).toContainText("敵ユニット一覧");
    await expect(enemyRoster.getByRole("button", { name: /敵01/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      rosterWidth: document.querySelector("#enemy-roster")?.getBoundingClientRect().width ?? 0
    }));
    expect(dimensions.rosterWidth).toBeGreaterThan(0);
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(dimensions.rosterWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
    expect(await readAutoSave(page)).toEqual(savedBeforeNavigation);
  });


  test("carries active and reserve units through chapter clear, deployment confirmation, and reload", async ({ page }) => {
    await startBattle(page);
    const startedState = await readAutoSave(page) as {
      saveVersion: number;
      chapterId: string;
      rngState: number;
      units: Array<{
        id: string;
        name: string;
        faction: "player" | "enemy";
        classId: string;
        level: number;
        experience: number;
        stats: Record<string, number>;
        growthRates: Record<string, number>;
        currentHp: number;
        movementType: string;
        move: number;
        usableWeaponTypes: string[];
        inventory: string[];
        equippedWeaponId: string | null;
        position: { x: number; y: number };
        hasMoved: boolean;
        hasActed: boolean;
      }>;
      reserveUnits: Array<{
        id: string;
        level: number;
        experience: number;
        stats: Record<string, number>;
        currentHp: number;
        inventory: string[];
      }>;
    };
    const carriedCandidate = startedState.units.find((unit) => unit.id === "unit_001");
    const reserveCandidate = startedState.units.find((unit) => unit.id === "unit_004");
    if (!carriedCandidate || !reserveCandidate) {
      throw new Error("The chapter carry-over fixture is missing an ally.");
    }

    const carriedUnit = {
      ...carriedCandidate,
      level: 7,
      experience: 42,
      stats: { ...carriedCandidate.stats, strength: 11 },
      currentHp: 13,
      inventory: [...carriedCandidate.inventory, "healing_potion"]
    };
    const reserveUnit = {
      id: reserveCandidate.id,
      name: reserveCandidate.name,
      classId: reserveCandidate.classId,
      level: 4,
      experience: 28,
      stats: { ...reserveCandidate.stats, strength: 9 },
      growthRates: { ...reserveCandidate.growthRates },
      currentHp: 14,
      movementType: reserveCandidate.movementType,
      move: reserveCandidate.move,
      usableWeaponTypes: [...reserveCandidate.usableWeaponTypes],
      inventory: [...reserveCandidate.inventory],
      equippedWeaponId: reserveCandidate.equippedWeaponId
    };
    const clearedChapterState = {
      ...startedState,
      rngState: 0x12345678,
      units: startedState.units
        .filter((unit) => unit.faction === "player" && unit.id !== reserveCandidate.id)
        .map((unit) => unit.id === carriedUnit.id ? carriedUnit : unit),
      reserveUnits: [...startedState.reserveUnits, reserveUnit]
    };

    // Model a validated, already-cleared chapter snapshot; the app still runs the real
    // victory presentation, reward gate, next-chapter preparation, and save flow.
    await writeAutoSave(page, clearedChapterState);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();
    await expect(page.locator(".chapter-rewards")).toContainText(
      "この章には追加アイテム報酬が設定されていません"
    );
    const nextChapterButton = page.getByRole("button", { name: "第2章・試作マップを開始" });
    await expect(nextChapterButton).toBeVisible();

    await nextChapterButton.click();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");

    // The next chapter is only a preview until its deployment is confirmed.
    expect(await readAutoSave(page)).toEqual(clearedChapterState);
    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    await expect(page.locator(".deployment-panel")).toHaveCount(0);

    const nextChapterState = await readAutoSave(page) as {
      saveVersion: number;
      chapterId: string;
      phase: string;
      turn: number;
      rngState: number;
      units: Array<{
        id: string;
        faction: string;
        level: number;
        experience: number;
        stats: Record<string, number>;
        currentHp: number;
        inventory: string[];
        hasMoved: boolean;
        hasActed: boolean;
      }>;
      reserveUnits: Array<{
        id: string;
        level: number;
        experience: number;
        stats: Record<string, number>;
        currentHp: number;
        inventory: string[];
      }>;
    };
    expect(nextChapterState).toMatchObject({
      saveVersion: 3,
      chapterId: "chapter_02_map",
      phase: "player",
      turn: 1,
      rngState: 0x12345678
    });
    expect(nextChapterState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
      faction: "player",
      level: 7,
      experience: 42,
      stats: { strength: 11 },
      currentHp: 13,
      inventory: [...carriedUnit.inventory],
      hasMoved: false,
      hasActed: false
    });
    expect(nextChapterState.units.some((unit) => unit.id === "unit_004")).toBe(false);
    expect(nextChapterState.reserveUnits.find((unit) => unit.id === "unit_004")).toMatchObject({
      level: 4,
      experience: 28,
      stats: { strength: 9 },
      currentHp: 14,
      inventory: [...reserveUnit.inventory]
    });
    expect(nextChapterState.units.filter((unit) => unit.faction === "enemy").map((unit) => unit.id))
      .toEqual(["enemy_001", "enemy_002", "enemy_003", "enemy_004", "enemy_005"]);

    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    expect(await readAutoSave(page)).toEqual(nextChapterState);
  });

});

  test("continues the campaign from Chapter 2 into the third registered prototype stage", async ({ page }) => {
    await startBattle(page);
    const chapterOneState = await readAutoSave(page) as {
      saveVersion: number;
      chapterId: string;
      turn: number;
      phase: string;
      rngState: number;
      units: Array<{ id: string; faction: string; position: { x: number; y: number } }>;
      reserveUnits: unknown[];
    };
    const clearedChapterTwo = {
      ...chapterOneState,
      chapterId: "chapter_02_map",
      rngState: 0x1234abcd,
      units: chapterOneState.units.filter((unit) => unit.faction === "player"),
      reserveUnits: []
    };
    await writeAutoSave(page, clearedChapterTwo);
    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

    const nextChapterButton = page.getByRole("button", { name: "第3章・試作マップを開始" });
    await expect(nextChapterButton).toBeVisible();
    await nextChapterButton.click();
    await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
    expect(await readAutoSave(page)).toEqual(clearedChapterTwo);

    await page.getByRole("button", { name: deploymentStartButton }).click();
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    const chapterThreeState = await readAutoSave(page) as {
      saveVersion: number;
      chapterId: string;
      phase: string;
      turn: number;
      units: Array<{ id: string; faction: string }>;
    };
    expect(chapterThreeState).toMatchObject({
      saveVersion: 3,
      chapterId: "chapter_03_map",
      phase: "player",
      turn: 1
    });
    expect(chapterThreeState.units.filter((unit) => unit.faction === "enemy").map((unit) => unit.id))
      .toEqual(["enemy_001", "enemy_002", "enemy_003", "enemy_004", "enemy_005"]);

    await page.reload();
    await continueSavedCampaign(page);
    await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
    expect(await readAutoSave(page)).toEqual(chapterThreeState);
  });

  test("creates a local backup from the launch screen without changing the current campaign", async ({ page }) => {
    await startBattle(page);
    const saved = await readAutoSave(page);
    await page.reload();
    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await title.getByTestId("title-create-save-backup").click();
    await expect(title.getByTestId("title-backup-entry-backup-1")).toBeVisible();
    expect(await readAutoSave(page)).toEqual(saved);
  });

  test("blocks new-campaign overwrite when the stored snapshot cannot be validated", async ({ page }) => {
    await startBattle(page);
    const invalidStoredSnapshot = { saveVersion: 999, chapterId: "chapter_01_map" };
    await writeAutoSave(page, invalidStoredSnapshot);
    await page.reload();

    const title = page.getByTestId("campaign-title-screen");
    await expect(title).toBeVisible();
    await expect(title.getByRole("alert")).toContainText("保存データを保護しています");
    await expect(title.getByRole("button", { name: "はじめから" })).toBeDisabled();
    await expect(title.getByRole("button", { name: "つづきから" })).toHaveCount(0);
    expect(await readAutoSave(page)).toEqual(invalidStoredSnapshot);
  });

test("does not expose the development-only promotion lab in the production preview", async ({ page }) => {
  await page.goto("/?promotion-lab=1");
  await expect(page.getByTestId("promotion-lab")).toHaveCount(0);
});


test("does not expose the real-save promotion snapshot bench in the production preview", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  await expect(page.getByTestId("promotion-snapshot-bench")).toHaveCount(0);
});
