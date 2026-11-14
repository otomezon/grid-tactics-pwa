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
  firedMapEventIds: string[];
  acknowledgedMapEventIds: string[];
  campaignBattleLog: Array<Record<string, unknown>>;
};

type TerminalVictorySnapshot = {
  chapterId: string;
  turn: number;
  units: Array<{ faction: string; currentHp: number }>;
  campaignBattleLog: Array<Record<string, unknown>>;
};

function withTerminalVictoryResult<T extends TerminalVictorySnapshot>(
  snapshot: T,
  objective: "defeat_all" | "defeat_boss"
): T {
  if (snapshot.campaignBattleLog.some((entry) =>
    entry.kind === "chapter-result" && entry.chapterId === snapshot.chapterId
  )) return snapshot;
  const previousSequence = snapshot.campaignBattleLog.reduce((maximum, entry) =>
    typeof entry.sequence === "number" ? Math.max(maximum, entry.sequence) : maximum
  , 0);
  return {
    ...snapshot,
    campaignBattleLog: [
      ...snapshot.campaignBattleLog,
      {
        sequence: previousSequence + 1,
        chapterId: snapshot.chapterId,
        turn: snapshot.turn,
        kind: "chapter-result",
        outcome: "victory",
        objective,
        reason: "objective-cleared",
        livingPlayerCount: snapshot.units.filter((unit) => unit.faction === "player" && unit.currentHp > 0).length,
        livingEnemyCount: snapshot.units.filter((unit) => unit.faction === "enemy" && unit.currentHp > 0).length
      }
    ]
  };
}

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
  // This end-to-end flow now exercises all three Chapter 2 objects plus save/reload on WebKit touch.
  test.setTimeout(90_000);
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
  const clearedChapterOneWithResult = withTerminalVictoryResult(clearedChapterOne, "defeat_boss");
  expect(await readAutoSave(page)).toEqual(clearedChapterOneWithResult);

  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await expectMobileViewport(page, input);
  await acknowledgePendingMapEvents(page, { input });
  const chapterTwoState = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoState.campaignBattleLog.slice(0, clearedChapterOne.campaignBattleLog.length)).toEqual(clearedChapterOne.campaignBattleLog);
  expect(chapterTwoState.campaignBattleLog.at(-1)).toMatchObject({
    sequence: 9,
    chapterId: "chapter_01_map",
    kind: "chapter-result",
    outcome: "victory",
    reason: "objective-cleared"
  });
  expect(chapterTwoState).toMatchObject({
    saveVersion: 10,
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

  await activate(page.locator('[data-map-position="5,8"]'), input);
  const villageTile = page.locator('[data-map-position="9,8"]');
  await activate(villageTile, input);
  if (input === "tap") await activate(villageTile, input);
  // Chapter 2 has three map objects plus the event-only scout interaction point.
  await expect(page.locator('[data-testid="map-object-marker"]')).toHaveCount(4);
  await expect(page.locator('[data-testid="map-object-marker"][data-object-kind="location"]')).toHaveCount(1);
  const scoutMarker = page.locator('[data-map-position="5,7"]').getByTestId("map-object-marker");
  await expect(scoutMarker).toHaveAttribute("data-object-kind", "location");
  await expect(scoutMarker).toHaveText("調");
  const villageMarker = page.locator('[data-map-position="9,8"]').getByTestId("map-object-marker");
  await expect(villageMarker).toHaveAttribute("data-object-kind", "village");
  await expect(villageMarker).toHaveText("村");
  await expect(page.locator('[data-testid="map-object-marker"][data-object-kind="treasure-chest"]')).toHaveText("宝");
  await expect(page.locator('[data-testid="map-object-marker"][data-object-kind="door"]')).toHaveText("扉");
  const objectPanel = page.getByTestId("map-interaction-panel");
  await expect(objectPanel).toContainText("試作村");
  await activate(objectPanel.getByRole("button", { name: "村を訪問する" }), input);
  const villageDialog = page.getByTestId("map-event-dialog");
  await expect(villageDialog).toHaveAttribute("data-event-id", "chapter-02-village-route-choice");
  await expect(villageDialog).toContainText("森を抜ける小道と、東へ続く古い峠道");
  await expect(villageDialog.getByTestId("map-event-choice")).toHaveCount(2);
  await activate(villageDialog.getByTestId("map-event-choice").filter({ hasText: "森の小道について聞く" }), input);
  await expect(villageDialog).toHaveAttribute("data-event-id", "chapter-02-village-forest-trail");
  await expect(villageDialog).toContainText("森の小道は狭いものの");
  await acknowledgePendingMapEvents(page, { input });
  await expect(page.locator('[data-object-kind="village"]')).toHaveCount(0);
  const chapterTwoAfterVillageChoice = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoAfterVillageChoice.firedMapEventIds).toContain("chapter-02-village-route-choice");
  expect(chapterTwoAfterVillageChoice.firedMapEventIds).toContain("chapter-02-village-forest-trail");
  expect(chapterTwoAfterVillageChoice.campaignChoices).toContainEqual({
    key: "chapter-02.village-route",
    choiceId: "forest-trail",
    sourceChapterId: "chapter_02_map",
    sourceEventId: "chapter-02-village-route-choice"
  });
  expect(chapterTwoAfterVillageChoice.units.find((unit) => unit.id === "unit_003")).toMatchObject({
    position: { x: 9, y: 8 }, hasMoved: true, hasActed: true
  });
  expect(chapterTwoAfterVillageChoice.campaignBattleLog.slice(0, chapterTwoState.campaignBattleLog.length))
    .toEqual(chapterTwoState.campaignBattleLog);
  expect(chapterTwoAfterVillageChoice.campaignBattleLog.slice(chapterTwoState.campaignBattleLog.length)).toMatchObject([
    { kind: "player-action", action: "movement", actorId: "unit_003" },
    { kind: "player-action", action: "map-interaction", actorId: "unit_003", detail: "試作村" }
  ]);

  await page.reload();
  await continueCampaign(page, input);
  expect(await readAutoSave(page)).toEqual(chapterTwoAfterVillageChoice);

  await activate(page.locator('[data-map-position="3,8"]'), input);
  const chestTile = page.locator('[data-map-position="7,8"]');
  await activate(chestTile, input);
  if (input === "tap") await activate(chestTile, input);
  const chestPanel = page.getByTestId("map-interaction-panel");
  await expect(chestPanel).toContainText("試作宝箱");
  await activate(chestPanel.getByRole("button", { name: "宝箱を開ける" }), input);
  const chestDialog = page.getByTestId("map-event-dialog");
  await expect(chestDialog).toHaveAttribute("data-event-id", "chapter-02-prototype-chest-reward");
  await expect(chestDialog).toContainText("試作回復薬を1つ手に入れました。");
  await acknowledgePendingMapEvents(page, { input });
  await expect(page.locator('[data-object-kind="treasure-chest"]')).toHaveCount(0);
  const chapterTwoAfterChest = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoAfterChest.firedMapEventIds).toContain("chapter-02-prototype-chest-reward");
  expect(chapterTwoAfterChest.campaignChoices).toEqual(chapterTwoAfterVillageChoice.campaignChoices);
  expect(chapterTwoAfterChest.units.find((unit) => unit.id === "unit_002")).toMatchObject({
    position: { x: 7, y: 8 }, hasMoved: true, hasActed: true
  });
  expect(chapterTwoAfterChest.reserveUnits.find((unit) => unit.id === "unit_004")).toMatchObject({
    id: "unit_004",
    inventory: reserveUnit.inventory
  });
  expect(chapterTwoAfterChest.units.find((unit) => unit.id === "unit_001")?.inventory)
    .toEqual([...carriedUnit.inventory, "healing_potion"]);
  const chestBattleLog = chapterTwoAfterChest.campaignBattleLog;
  expect(chestBattleLog.slice(0, chapterTwoAfterVillageChoice.campaignBattleLog.length))
    .toEqual(chapterTwoAfterVillageChoice.campaignBattleLog);
  expect(chestBattleLog.slice(chapterTwoAfterVillageChoice.campaignBattleLog.length)).toMatchObject([
    { kind: "player-action", action: "movement", actorId: "unit_002" },
    { kind: "player-action", action: "map-interaction", actorId: "unit_002", detail: "試作宝箱" }
  ]);

  await page.reload();
  await continueCampaign(page, input);
  expect(await readAutoSave(page)).toEqual(chapterTwoAfterChest);

  await activate(page.locator('[data-map-position="1,8"]'), input);
  const doorTile = page.locator('[data-map-position="2,8"]');
  await activate(doorTile, input);
  if (input === "tap") await activate(doorTile, input);
  const doorPanel = page.getByTestId("map-interaction-panel");
  await expect(doorPanel).toContainText("試作扉");
  await activate(doorPanel.getByRole("button", { name: "扉を調べる" }), input);
  const doorDialog = page.getByTestId("map-event-dialog");
  await expect(doorDialog).toHaveAttribute("data-event-id", "chapter-02-door-inspection-choice");
  await expect(doorDialog).toContainText("表面と周囲のどちらを調べますか？");
  await expect(doorDialog.getByTestId("map-event-choice")).toHaveCount(2);
  await activate(doorDialog.getByTestId("map-event-choice").filter({ hasText: "扉の表面を調べる" }), input);
  await expect(doorDialog).toHaveAttribute("data-event-id", "chapter-02-door-markings");
  await expect(doorDialog).toContainText("古い紋様が刻まれています");
  await acknowledgePendingMapEvents(page, { input });
  await expect(page.locator('[data-object-kind="door"]')).toHaveCount(0);
  const chapterTwoAfterObjectInteraction = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoAfterObjectInteraction.firedMapEventIds).toContain("chapter-02-door-inspection-choice");
  expect(chapterTwoAfterObjectInteraction.firedMapEventIds).toContain("chapter-02-door-markings");
  expect(chapterTwoAfterObjectInteraction.campaignChoices).toEqual(chapterTwoAfterChest.campaignChoices);
  expect(chapterTwoAfterObjectInteraction.units.find((unit) => unit.id === "unit_001")).toMatchObject({
    position: { x: 2, y: 8 }, hasMoved: true, hasActed: true
  });
  expect(chapterTwoAfterObjectInteraction.units.find((unit) => unit.id === "unit_001")?.inventory)
    .toEqual([...carriedUnit.inventory, "healing_potion"]);
  const doorBattleLog = chapterTwoAfterObjectInteraction.campaignBattleLog;
  expect(doorBattleLog.slice(0, chapterTwoAfterChest.campaignBattleLog.length))
    .toEqual(chapterTwoAfterChest.campaignBattleLog);
  expect(doorBattleLog.slice(chapterTwoAfterChest.campaignBattleLog.length)).toMatchObject([
    { kind: "player-action", action: "movement", actorId: "unit_001" },
    { kind: "player-action", action: "map-interaction", actorId: "unit_001", detail: "試作扉" }
  ]);

  await page.reload();
  await continueCampaign(page, input);
  expect(await readAutoSave(page)).toEqual(chapterTwoAfterObjectInteraction);

  const clearedChapterTwo: SaveSnapshot = {
    ...chapterTwoAfterObjectInteraction,
    rngState: 0x23456789,
    units: chapterTwoAfterObjectInteraction.units.filter((unit) => unit.faction === "player")
  };
  await writeAutoSave(page, clearedChapterTwo);
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

  await activate(page.getByRole("button", { name: "第3章・試作マップを開始" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator(".deployment-heading")).toContainText("3人出撃 / 1人控え");
  const clearedChapterTwoWithResult = withTerminalVictoryResult(clearedChapterTwo, "defeat_all");
  expect(await readAutoSave(page)).toEqual(clearedChapterTwoWithResult);

  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await expectMobileViewport(page, input);
  const chapterThreeFollowUp = page.getByTestId("map-event-dialog");
  await expect(chapterThreeFollowUp).toHaveAttribute("data-event-id", "chapter-03-village-forest-trail-follow-up");
  await expect(chapterThreeFollowUp).toContainText("第2章の村で聞いた森の小道");
  await acknowledgePendingMapEvents(page, { input });
  const chapterThreeState = await readAutoSave(page) as SaveSnapshot;
  expect(chapterThreeState.campaignBattleLog.slice(0, chapterTwoState.campaignBattleLog.length)).toEqual(chapterTwoState.campaignBattleLog);
  const lastChapterTwoBattleLogEntry = chapterTwoAfterObjectInteraction.campaignBattleLog.at(-1);
  const nextCampaignBattleSequence = (
    typeof lastChapterTwoBattleLogEntry?.sequence === "number"
      ? lastChapterTwoBattleLogEntry.sequence
      : 0
  ) + 1;
  expect(chapterThreeState.campaignBattleLog.at(-1)).toMatchObject({
    sequence: nextCampaignBattleSequence,
    chapterId: "chapter_02_map",
    kind: "chapter-result",
    outcome: "victory",
    reason: "objective-cleared"
  });
  expect(chapterThreeState).toMatchObject({
    saveVersion: 10,
    chapterId: "chapter_03_map",
    phase: "player",
    turn: 1,
    rngState: 0x23456789
  });
  expect(chapterThreeState.campaignChoices).toContainEqual({
    key: "chapter-02.village-route",
    choiceId: "forest-trail",
    sourceChapterId: "chapter_02_map",
    sourceEventId: "chapter-02-village-route-choice"
  });
  expect(chapterThreeState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
    faction: "player",
    level: 7,
    experience: 42,
    stats: { strength: 11 },
    currentHp: 13,
    inventory: [...carriedUnit.inventory, "healing_potion"],
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

  // The Chapter 2 chest reward must remain a usable inventory item after the
  // Chapter 3 transition, not merely survive as an opaque inventory ID.
  await activate(page.locator(".map-grid").getByRole("button", { name: /主人公/ }), input);
  const healingPotionRow = page.locator(".inventory-items li").filter({ hasText: "回復薬" });
  const useHealingPotion = page.getByRole("button", { name: "回復薬を使用" });
  await expect(healingPotionRow).toContainText("所持数：2個");
  await expect(useHealingPotion).toBeEnabled();
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("HPを7回復");
    expect(dialog.message()).toContain("行動を消費");
    await dialog.accept();
  });
  await activate(useHealingPotion, input);
  await expect(useHealingPotion).toBeDisabled();
  await expect(page.locator(".unit-details")).toContainText("行動済み");
  await expect(page.locator(".unit-details")).toContainText("20 / 20");
  await expect(healingPotionRow).toContainText("所持数：1個");

  const healedChapterThreeState = await readAutoSave(page) as SaveSnapshot;
  const healedProtagonist = healedChapterThreeState.units.find((unit) => unit.id === "unit_001");
  expect(healedProtagonist).toMatchObject({
    currentHp: 20,
    hasMoved: false,
    hasActed: true,
    inventory: carriedUnit.inventory
  });
  expect(healedChapterThreeState.campaignBattleLog.slice(0, chapterThreeState.campaignBattleLog.length))
    .toEqual(chapterThreeState.campaignBattleLog);
  expect(healedChapterThreeState.campaignBattleLog.at(-1)).toMatchObject({
    kind: "player-action",
    action: "item-use",
    actorId: "unit_001",
    actorName: carriedUnit.name
  });
  expect(healedChapterThreeState.campaignBattleLog.at(-1)?.detail).toContain("HP +7");

  await page.reload();
  await continueCampaign(page, input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  expect(await readAutoSave(page)).toEqual(healedChapterThreeState);
  await activate(page.locator(".map-grid").getByRole("button", { name: /主人公/ }), input);
  await expect(page.getByRole("button", { name: "回復薬を使用" })).toBeDisabled();
  await expect(page.locator(".inventory-items li").filter({ hasText: "回復薬" }))
    .toContainText("所持数：1個");

  // Exercise the campaign-history UI with a historical source event that is no
  // longer registered. This deliberately uses IDs only and must not invent text.
  const archivedHero = healedChapterThreeState.units.find((unit) => unit.id === "unit_001");
  const archivedAlly = healedChapterThreeState.units.find((unit) => unit.id === "unit_003");
  if (!archivedHero || !archivedAlly) {
    throw new Error("The campaign archive fixture is missing an expected player unit.");
  }
  const zeroStatGains = {
    hp: 0, strength: 0, magic: 0, skill: 0,
    speed: 0, luck: 0, defense: 0, resistance: 0
  };
  const historyState: SaveSnapshot = {
    ...healedChapterThreeState,
    campaignUnitBattleRecords: [
      {
        unitId: archivedHero.id,
        unitName: archivedHero.name,
        attacks: 4,
        strikes: 6,
        hits: 5,
        misses: 1,
        criticalHits: 1,
        damageDealt: 28,
        enemiesDefeated: 2,
        experienceAwarded: 70,
        levelUps: 1,
        statGains: { ...zeroStatGains, strength: 1 }
      },
      {
        unitId: archivedAlly.id,
        unitName: archivedAlly.name,
        attacks: 3,
        strikes: 4,
        hits: 4,
        misses: 0,
        criticalHits: 0,
        damageDealt: 40,
        enemiesDefeated: 1,
        experienceAwarded: 50,
        levelUps: 0,
        statGains: { ...zeroStatGains }
      }
    ],
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

  const battleHistoryToggle = page.getByRole("button", { name: "キャンペーン戦闘記録 12件" });
  await expect(battleHistoryToggle).toBeVisible();
  await activate(battleHistoryToggle, input);
  const battleHistoryPanel = page.getByTestId("campaign-battle-history");
  await expect(battleHistoryPanel).toBeVisible();
  const battleLogEntries = battleHistoryPanel.getByTestId("campaign-battle-log-entry");
  await expect(battleLogEntries).toHaveCount(12);
  await expect(battleHistoryPanel).toContainText("第1章 · 第1章・試作マップ");
  await expect(battleHistoryPanel).toContainText("第8ターン");
  await expect(battleHistoryPanel).toContainText("主人公 → 敵01");
  await expect(battleHistoryPanel).toContainText("敵02 · 敵軍行動（攻撃）");
  await expect(battleHistoryPanel).toContainText("1体撃破");
  await expect(battleHistoryPanel).toContainText("ステージクリア · 勝利条件達成");
  await expect(battleHistoryPanel).toContainText("第2章 · 第2章・試作マップ");
  await expect(battleHistoryPanel).toContainText("マップ調査");
  await expect(battleHistoryPanel).toContainText("試作村");
  await expect(battleHistoryPanel).toContainText("試作宝箱");
  await expect(battleHistoryPanel).toContainText("試作扉");
  await expect(battleHistoryPanel).toContainText("回復薬");
  await expect(battleHistoryPanel).toContainText("HP +7");
  const savedBeforeBattleHistory = await readAutoSave(page);

  const allyTotalsTab = battleHistoryPanel.getByRole("button", { name: "味方別累計" });
  await activate(allyTotalsTab, input);
  const allyArchive = battleHistoryPanel.getByTestId("campaign-unit-battle-records-archive");
  await expect(allyArchive).toBeVisible();
  const allyRecords = allyArchive.getByTestId("campaign-unit-record-entry");
  await expect(allyRecords).toHaveCount(2);
  await expect(allyRecords.first()).toHaveAttribute("data-unit-id", "unit_003");
  const careerSort = allyArchive.getByRole("combobox", { name: "累計戦績の並べ替え" });
  await careerSort.selectOption("enemiesDefeated");
  await expect(allyRecords.first()).toHaveAttribute("data-unit-id", "unit_001");
  const careerSearch = allyArchive.getByRole("searchbox", { name: "味方戦績を名前で検索" });
  await careerSearch.fill(archivedHero.name);
  await expect(allyRecords).toHaveCount(1);
  await expect(allyRecords.first()).toHaveAttribute("data-unit-id", "unit_001");
  await expect(allyArchive).toContainText("1 / 2名を表示");
  await allyArchive.getByRole("button", { name: "検索を解除" }).click();
  await expect(allyRecords).toHaveCount(2);
  await expectMobileViewport(page, input);
  expect(await readAutoSave(page)).toEqual(savedBeforeBattleHistory);

  await activate(battleHistoryPanel.getByRole("button", { name: "時系列ログ" }), input);
  await expect(battleLogEntries).toHaveCount(12);

  const chapterFilter = battleHistoryPanel.getByRole("combobox", { name: "章で絞り込み" });
  const categoryFilter = battleHistoryPanel.getByRole("combobox", { name: "記録種別で絞り込み" });
  const historySearch = battleHistoryPanel.getByRole("searchbox", { name: "履歴内を検索" });

  await chapterFilter.selectOption("chapter_02_map");
  const chapterTwoText = await battleLogEntries.allTextContents();
  expect(chapterTwoText.length).toBeGreaterThan(0);
  expect(chapterTwoText.every((entry) => entry.includes("第2章 · 第2章・試作マップ"))).toBe(true);

  await chapterFilter.selectOption("all");
  await categoryFilter.selectOption("enemy");
  await expect(battleLogEntries.first()).toContainText("敵軍行動");
  expect(await battleLogEntries.count()).toBeGreaterThan(0);

  await categoryFilter.selectOption("all");
  await historySearch.fill("HP +7");
  await expect(battleLogEntries).toHaveCount(1);
  await expect(battleLogEntries.first()).toContainText("HP +7");
  await expect(battleHistoryPanel).toContainText("1 / 12件を表示");

  await battleHistoryPanel.getByRole("button", { name: "絞り込みを解除" }).click();
  await expect(battleLogEntries).toHaveCount(12);
  await expect(battleHistoryPanel.getByRole("button", { name: "絞り込みを解除" })).toBeDisabled();
  await expectMobileViewport(page, input);
  expect(await readAutoSave(page)).toEqual(savedBeforeBattleHistory);

  await activate(battleHistoryPanel.getByRole("button", { name: "閉じる" }), input);
  await expect(battleHistoryPanel).toHaveCount(0);
  await expect(battleHistoryToggle).toBeFocused();
  expect(await readAutoSave(page)).toEqual(savedBeforeBattleHistory);
});

test("recruits the optional Chapter 2 scout and deploys her in Chapter 3", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const input: InteractionInput = testInfo.project.name === "webkit-mobile" ? "tap" : "click";
  if (input === "tap") await page.setViewportSize({ width: 320, height: 720 });

  await startCampaign(page, input);
  const initialChapterOne = await readAutoSave(page) as SaveSnapshot;
  const clearedChapterOne: SaveSnapshot = {
    ...initialChapterOne,
    units: initialChapterOne.units.filter((unit) => unit.faction === "player")
  };
  await writeAutoSave(page, withTerminalVictoryResult(clearedChapterOne, "defeat_boss"));
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

  await activate(page.getByRole("button", { name: "第2章・試作マップを開始" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator(".deployment-heading")).toContainText("4人出撃 / 0人控え");
  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  await acknowledgePendingMapEvents(page, { input });

  await activate(page.locator('[data-map-position="5,8"]'), input);
  const scoutTile = page.locator('[data-map-position="5,7"]');
  await activate(scoutTile, input);
  if (input === "tap") await activate(scoutTile, input);
  const scoutPanel = page.getByTestId("map-interaction-panel");
  await expect(scoutPanel).toContainText("旅の斥候");
  await activate(scoutPanel.getByRole("button", { name: "調べる" }), input);

  const scoutDialogue = page.getByTestId("map-event-dialog");
  await expect(scoutDialogue).toHaveAttribute("data-event-id", "chapter-02-scout-recruitment-choice");
  await expect(scoutDialogue.getByTestId("map-event-choice")).toHaveCount(2);
  await activate(
    scoutDialogue.getByTestId("map-event-choice").filter({ hasText: "仲間に誘う" }),
    input
  );
  await expect(scoutDialogue).toHaveAttribute("data-event-id", "chapter-02-scout-recruitment-join");
  await expect(scoutDialogue).toContainText("斥候ミナが同行することになりました");
  await acknowledgePendingMapEvents(page, { input });

  const chapterTwoWithRecruit = await readAutoSave(page) as SaveSnapshot;
  expect(chapterTwoWithRecruit.campaignChoices).toContainEqual({
    key: "chapter-02.scout-recruitment",
    choiceId: "join-scout",
    sourceChapterId: "chapter_02_map",
    sourceEventId: "chapter-02-scout-recruitment-choice"
  });
  expect(chapterTwoWithRecruit.firedMapEventIds).toContain("chapter-02-scout-recruitment-join");
  expect(chapterTwoWithRecruit.units.some((unit) => unit.id === "recruit_scout")).toBe(false);
  expect(chapterTwoWithRecruit.reserveUnits.find((unit) => unit.id === "recruit_scout"))
    .toMatchObject({ name: "斥候ミナ", classId: "archer", currentHp: 20 });

  const clearedChapterTwo: SaveSnapshot = {
    ...chapterTwoWithRecruit,
    units: chapterTwoWithRecruit.units.filter((unit) => unit.faction === "player")
  };
  await writeAutoSave(page, withTerminalVictoryResult(clearedChapterTwo, "defeat_all"));
  await page.reload();
  await continueCampaign(page, input);
  await expect(page.getByText("ステージクリア", { exact: true })).toBeVisible();

  await activate(page.getByRole("button", { name: "第3章・試作マップを開始" }), input);
  await expect(page.getByRole("heading", { name: "出撃準備" })).toBeVisible();
  await expect(page.locator(".deployment-heading")).toContainText("4人出撃 / 1人控え");
  const clearedChapterTwoWithResult = withTerminalVictoryResult(clearedChapterTwo, "defeat_all");
  expect(await readAutoSave(page)).toEqual(clearedChapterTwoWithResult);

  const scoutRow = page.locator(".deployment-unit").filter({ hasText: "斥候ミナ" });
  const scoutCheckbox = scoutRow.locator('input[type="checkbox"]');
  await expect(scoutRow).toBeVisible();
  await expect(scoutCheckbox).not.toBeChecked();
  await activate(scoutCheckbox, input);
  await expect(page.locator(".deployment-heading")).toContainText("5人出撃 / 0人控え");
  await expect(page.getByLabel("斥候ミナの出撃位置")).toHaveValue("7,8");

  await activate(page.getByRole("button", { name: deploymentStartButton }), input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  const scoutArrival = page.getByTestId("map-event-dialog");
  await expect(scoutArrival).toHaveAttribute("data-event-id", "chapter-03-scout-joins-expedition");
  await expect(scoutArrival).toContainText("同行を認めてくれてありがとう");
  await acknowledgePendingMapEvents(page, { input });

  const chapterThreeState = await readAutoSave(page) as SaveSnapshot;
  expect(chapterThreeState).toMatchObject({
    saveVersion: 10,
    chapterId: "chapter_03_map",
    phase: "player",
    turn: 1
  });
  expect(chapterThreeState.units.find((unit) => unit.id === "recruit_scout")).toMatchObject({
    faction: "player",
    name: "斥候ミナ",
    position: { x: 7, y: 8 },
    hasMoved: false,
    hasActed: false
  });
  expect(chapterThreeState.reserveUnits.some((unit) => unit.id === "recruit_scout")).toBe(false);
  expect(chapterThreeState.campaignChoices).toContainEqual({
    key: "chapter-02.scout-recruitment",
    choiceId: "join-scout",
    sourceChapterId: "chapter_02_map",
    sourceEventId: "chapter-02-scout-recruitment-choice"
  });
  expect(chapterThreeState.firedMapEventIds).toContain("chapter-03-scout-joins-expedition");

  await page.reload();
  await continueCampaign(page, input);
  await expect(page.locator(".phase-badge")).toHaveText("第1ターン · 自軍フェイズ");
  expect(await readAutoSave(page)).toEqual(chapterThreeState);
  await expect(page.locator(".map-grid").getByRole("button", { name: /斥候ミナ/ })).toBeVisible();
  await expectMobileViewport(page, input);
});

test("updates the operation guide with the current tactical situation", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const input: InteractionInput = testInfo.project.name === "webkit-mobile" ? "tap" : "click";
  if (input === "tap") await page.setViewportSize({ width: 320, height: 720 });

  await startCampaign(page, input);
  const guideToggle = page.getByRole("button", { name: "操作ガイド" });
  const stateBeforeGuide = await readAutoSave(page);
  await activate(guideToggle, input);
  const guide = page.getByTestId("battle-guide");
  await expect(guide).toBeVisible();
  await expect(guide).toContainText("行動可能な味方を選びましょう");
  await expect(page.getByTestId("battle-guide-count")).toHaveText("0 / 3項目完了");
  expect(await readAutoSave(page)).toEqual(stateBeforeGuide);

  const protagonistTile = page.locator('[data-map-position="1,8"]');
  await activate(protagonistTile, input);
  await expect(guide).toContainText("青いマスから移動先を選びましょう");
  const destination = page.locator('[data-map-position="2,8"]');
  await activate(destination, input);
  if (input === "tap") await activate(destination, input);

  await expect(page.getByTestId("battle-guide-count")).toHaveText("1 / 3項目完了");
  await expect(guide).toContainText("この味方の行動を選びましょう");
  const movedState = await readAutoSave(page) as SaveSnapshot;
  expect(movedState.units.find((unit) => unit.id === "unit_001")).toMatchObject({
    position: { x: 2, y: 8 },
    hasMoved: true,
    hasActed: false
  });
  expect(movedState.campaignBattleLog.at(-1)).toMatchObject({
    kind: "player-action",
    action: "movement",
    actorId: "unit_001"
  });
  await expectMobileViewport(page, input);
});
