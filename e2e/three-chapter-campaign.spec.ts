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
  campaignChoices: {
    key: string;
    choiceId: string;
    sourceChapterId: string;
    sourceEventId: string;
  }[];
  campaignBattleLog: Array<Record<string, unknown>>;
  campaignChoices: {
    key: string;
    choiceId: string;
    sourceChapterId: string;
    sourceEventId: string;
  }[];
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
    reserveUnits: [...initialState.reserveUnits, reserveUnit],
    campaignBattleLog: [
      {
        sequence: 6,
        chapterId: "chapter_01_map",
        turn: 8,
        kind: "player-action",
        action: "wait",
        actorId: "unit_001",
        actorName: "主人公",
        detail: "第1章の記録保持テスト"
      },
      {
        sequence: 7,
        chapterId: "chapter_01_map",
        turn: 8,
        kind: "player-attack",
        attackerId: "unit_001",
        attackerName: "主人公",
        defenderId: "enemy_001",
        defenderName: "敵01",
        defenderRemainingHp: 0,
        experienceAwarded: 30,
        strikes: [{
          actorId: "unit_001",
          actorName: "主人公",
          targetId: "enemy_001",
          targetName: "敵01",
          kind: "initial",
          weaponName: "試作の鉄の剣",
          outcome: "hit",
          damage: 20,
          targetHpBefore: 20,
          targetHpAfter: 0
        }]
      },
      {
        sequence: 8,
        chapterId: "chapter_01_map",
        turn: 8,
        kind: "enemy-action",
        enemyId: "enemy_002",
        enemyName: "敵02",
        actionKind: "attacked",
        targetId: "unit_001",
        targetName: "主人公",
        strikes: [{
          actorId: "enemy_002",
          actorName: "敵02",
          targetId: "unit_001",
          targetName: "主人公",
          kind: "initial",
          weaponName: "試作の鉄の斧",
          outcome: "hit",
          damage: 4,
          targetHpBefore: 18,
          targetHpAfter: 14
        }]
      }
    ]
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
  expect(chapterTwoState.campaignBattleLog).toEqual(clearedChapterOne.campaignBattleLog);
  expect(chapterTwoState).toMatchObject({
    saveVersion: 9,
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
  expect((await readAutoSave(page) as SaveSnapshot).campaignBattleLog).toEqual(clearedChapterOne.campaignBattleLog);

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
  expect(chapterThreeState.campaignBattleLog).toEqual(clearedChapterOne.campaignBattleLog);
  expect(chapterThreeState).toMatchObject({
    saveVersion: 9,
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

  // Exercise the campaign-history UI with a historical source event that is no
  // longer registered. This deliberately uses IDs only and must not invent text.
  const historyState: SaveSnapshot = {
    ...chapterThreeState,
    campaignChoices: [{
      key: "campaign.retired-route",
      choiceId: "retired-option",
      sourceChapterId: "chapter_02_map",
      sourceEventId: "retired-choice-event"
    }]
  };
  await writeAutoSave(page, historyState);
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");

  const historyToggle = page.getByRole("button", { name: "キャンペーン選択履歴 1件" });
  await expect(historyToggle).toBeVisible();
  await expect(historyToggle).toHaveAttribute("aria-expanded", "false");
  await activate(historyToggle, input);
  const historyPanel = page.getByTestId("campaign-choice-history");
  await expect(historyPanel).toBeVisible();
  await expect(historyPanel).toContainText("選択肢ID retired-option");
  await expect(historyPanel).toContainText("元イベントID: retired-choice-event");
  await expect(historyPanel).not.toContainText("どちらの道へ進みますか？");
  await expect(historyToggle).toHaveAttribute("aria-expanded", "true");
  await expectMobileViewport(page, input);
  expect(await readAutoSave(page)).toEqual(historyState);

  await activate(historyPanel.getByRole("button", { name: "閉じる" }), input);
  await expect(historyPanel).toHaveCount(0);
  await expect(historyToggle).toHaveAttribute("aria-expanded", "false");
  await expect(historyToggle).toBeFocused();
  await expectMobileViewport(page, input);
  expect(await readAutoSave(page)).toEqual(historyState);

  const battleHistoryToggle = page.getByRole("button", { name: "キャンペーン戦闘記録 3件" });
  await expect(battleHistoryToggle).toBeVisible();
  await activate(battleHistoryToggle, input);
  const battleHistoryPanel = page.getByTestId("campaign-battle-history");
  await expect(battleHistoryPanel).toBeVisible();
  await expect(battleHistoryPanel.getByTestId("campaign-battle-log-entry")).toHaveCount(3);
  await expect(battleHistoryPanel).toContainText("第1章 · 第1章・試作マップ");
  await expect(battleHistoryPanel).toContainText("第8ターン");
  await expect(battleHistoryPanel).toContainText("主人公 → 敵01");
  await expect(battleHistoryPanel).toContainText("敵02 · 敵軍行動（攻撃）");
  await expect(battleHistoryPanel).toContainText("1体撃破");
  const savedBeforeBattleHistory = await readAutoSave(page);
  await activate(battleHistoryPanel.getByRole("button", { name: "閉じる" }), input);
  await expect(battleHistoryPanel).toHaveCount(0);
  await expect(battleHistoryToggle).toBeFocused();
  expect(await readAutoSave(page)).toEqual(savedBeforeBattleHistory);
});
