import { expect, test, type Locator, type Page } from "@playwright/test";
import { acknowledgePendingMapEvents } from "./helpers/map-events";

const deploymentStartButton = "出撃メンバーと配置を確定して戦闘開始";
type InteractionInput = "click" | "tap";

async function activate(locator: Locator, input: InteractionInput): Promise<void> {
  if (input === "tap") await locator.tap();
  else await locator.click();
}

async function expectMobileViewport(page: Page, input: InteractionInput): Promise<void> {
  if (input !== "tap") return;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
}

type SavedUnit = {
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
};

type ReserveUnit = Omit<SavedUnit, "faction" | "position" | "hasMoved" | "hasActed">;

type SaveSnapshot = {
  saveVersion: number;
  chapterId: string;
  turn: number;
  phase: "player" | "enemy";
  rngState: number;
  units: SavedUnit[];
  reserveUnits: ReserveUnit[];
};

async function startCampaign(page: Page, input: InteractionInput): Promise<void> {
  await page.goto("/");
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await activate(title.getByRole("button", { name: "はじめから" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await expectMobileViewport(page, input);
  await acknowledgePendingMapEvents(page, { input });
}

async function continueCampaign(page: Page, input: InteractionInput): Promise<void> {
  const title = page.getByTestId("campaign-title-screen");
  await expect(title).toBeVisible();
  await expect(title.getByRole("button", { name: "つづきから" })).toBeEnabled();
  await activate(title.getByRole("button", { name: "つづきから" }), input);
  await expectMobileViewport(page, input);
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

async function writeAutoSave(page: Page, data: SaveSnapshot): Promise<void> {
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

test("carries one campaign through all three chapters with desktop clicks and mobile WebKit touch", async ({ page }, testInfo) => {
  const input: InteractionInput = testInfo.project.name === "webkit-mobile" ? "tap" : "click";
  if (input === "tap") await page.setViewportSize({ width: 320, height: 720 });
  await startCampaign(page, input);
  const initialState = await readAutoSave(page) as SaveSnapshot;
  const carriedCandidate = initialState.units.find((unit) => unit.id === "unit_001" && unit.faction === "player");
  const reserveCandidate = initialState.units.find((unit) => unit.id === "unit_004" && unit.faction === "player");
  if (!carriedCandidate || !reserveCandidate) {
    throw new Error("The three-chapter fixture is missing an expected player unit.");
  }

  const carriedUnit = {
    ...carriedCandidate,
    level: 7,
    experience: 42,
    stats: { ...carriedCandidate.stats, strength: 11 },
    currentHp: 13,
    inventory: [...carriedCandidate.inventory, "healing_potion"]
  };
  const reserveUnit: ReserveUnit = {
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

  // Use a prepared cleared snapshot so the test exercises real victory, transition,
  // deployment-confirmation, IndexedDB persistence, and resume flows without
  // claiming to simulate a manual battle or balance-test playthrough.
  const clearedChapterOne: SaveSnapshot = {
    ...initialState,
    rngState: 0x12345678,
    units: initialState.units
      .filter((unit) => unit.faction === "player" && unit.id !== reserveCandidate.id)
      .map((unit) => unit.id === carriedUnit.id ? carriedUnit : unit),
    reserveUnits: [...initialState.reserveUnits, reserveUnit]
  };
  await writeAutoSave(page, clearedChapterOne);
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

  await activate(page.getByRole("button", { name: "第2章・試作マップを開始" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");
  expect(await readAutoSave(page)).toEqual(clearedChapterOne);

  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await expectMobileViewport(page, input);
  await acknowledgePendingMapEvents(page, { input });
  const chapterTwoState = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoState).toMatchObject({
    saveVersion: 7,
    chapterId: "chapter_02_map",
    phase: "player",
    turn: 1,
    rngState: 0x12345678
  });
  expect(chapterTwoState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
    faction: "player",
    level: 7,
    experience: 42,
    stats: { strength: 11 },
    currentHp: 13,
    inventory: carriedUnit.inventory,
    hasMoved: false,
    hasActed: false
  });
  expect(chapterTwoState.units.some((unit) => unit.id === "unit_004")).toBe(false);
  expect(chapterTwoState.reserveUnits.find((unit) => unit.id === "unit_004")).toMatchObject({
    level: 4,
    experience: 28,
    stats: { strength: 9 },
    currentHp: 14,
    inventory: reserveUnit.inventory
  });

  await page.reload();
  await continueCampaign(page, input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  expect(await readAutoSave(page)).toEqual(chapterTwoState);

  const clearedChapterTwo: SaveSnapshot = {
    ...chapterTwoState,
    rngState: 0x23456789,
    units: chapterTwoState.units.filter((unit) => unit.faction === "player")
  };
  await writeAutoSave(page, clearedChapterTwo);
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

  await activate(page.getByRole("button", { name: "第3章・試作マップを開始" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");
  expect(await readAutoSave(page)).toEqual(clearedChapterTwo);

  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await expectMobileViewport(page, input);
  await acknowledgePendingMapEvents(page, { input });
  const chapterThreeState = await readAutoSave(page) as SaveSnapshot;
  expect(chapterThreeState).toMatchObject({
    saveVersion: 7,
    chapterId: "chapter_03_map",
    phase: "player",
    turn: 1,
    rngState: 0x23456789
  });
  expect(chapterThreeState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
    faction: "player",
    level: 7,
    experience: 42,
    stats: { strength: 11 },
    currentHp: 13,
    inventory: carriedUnit.inventory,
    hasMoved: false,
    hasActed: false
  });
  expect(chapterThreeState.units.some((unit) => unit.id === "unit_004")).toBe(false);
  expect(chapterThreeState.reserveUnits.find((unit) => unit.id === "unit_004")).toMatchObject({
    level: 4,
    experience: 28,
    stats: { strength: 9 },
    currentHp: 14,
    inventory: reserveUnit.inventory
  });
  expect(chapterThreeState.units.filter((unit) => unit.faction === "enemy").map((unit) => unit.id))
    .toEqual(["enemy_001", "enemy_002", "enemy_003", "enemy_004", "enemy_005"]);

  await page.reload();
  await continueCampaign(page, input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  expect(await readAutoSave(page)).toEqual(chapterThreeState);
});
