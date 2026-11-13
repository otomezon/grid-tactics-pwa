import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function makePromotionSnapshotFile() {
  const snapshot = {
    saveVersion: 7,
    chapterId: "chapter_01_map",
    phase: "player",
    turn: 4,
    rngState: 0x12345678,
    units: [
      {
        id: "unit_001",
        name: "試験ユニット01",
        faction: "player",
        classId: "swordsman",
        level: 10,
        experience: 73,
        stats: {
          hp: 28,
          strength: 9,
          magic: 0,
          skill: 10,
          speed: 12,
          luck: 7,
          defense: 7,
          resistance: 1
        },
        growthRates: {
          hp: 80,
          strength: 35,
          magic: 5,
          skill: 55,
          speed: 60,
          luck: 35,
          defense: 25,
          resistance: 15
        },
        currentHp: 17,
        movementType: "infantry",
        move: 5,
        usableWeaponTypes: ["sword"],
        inventory: ["iron_sword"],
        equippedWeaponId: "iron_sword",
        position: { x: 1, y: 8 },
        hasMoved: false,
        hasActed: false
      },
      {
        id: "enemy_001",
        name: "比較用の敵01",
        faction: "enemy",
        classId: "fighter",
        level: 1,
        experience: 0,
        stats: {
          hp: 30,
          strength: 6,
          magic: 0,
          skill: 7,
          speed: 20,
          luck: 20,
          defense: 5,
          resistance: 1
        },
        growthRates: {
          hp: 80,
          strength: 35,
          magic: 5,
          skill: 55,
          speed: 60,
          luck: 35,
          defense: 25,
          resistance: 15
        },
        currentHp: 30,
        movementType: "infantry",
        move: 5,
        usableWeaponTypes: ["axe"],
        inventory: ["iron_axe"],
        equippedWeaponId: "iron_axe",
        position: { x: 1, y: 7 },
        hasMoved: false,
        hasActed: false
      }
    ],
    reserveUnits: [],
    campaignUnitBattleRecords: [],
    firedMapEventIds: [],
    acknowledgedMapEventIds: [],
    mapEventChoices: []
  };
  return {
    format: "grid-tactics-pwa-save",
    formatVersion: 1,
    exportedAt: "2026-11-12T00:00:00.000Z",
    data: snapshot
  };
}

function makePromotionMatrixSnapshotFile(classId: string, profileIndex: number) {
  const envelope = makePromotionSnapshotFile();
  const snapshot = structuredClone(envelope.data);
  const weaponByClass: Record<string, { type: string; id: string }> = {
    swordsman: { type: "sword", id: "iron_sword" },
    mercenary: { type: "sword", id: "iron_sword" },
    fighter: { type: "axe", id: "iron_axe" },
    soldier: { type: "lance", id: "iron_lance" },
    cavalry: { type: "lance", id: "iron_lance" },
    archer: { type: "bow", id: "short_bow" },
    mage: { type: "magic", id: "fire_tome" }
  };
  const weapon = weaponByClass[classId];
  if (!weapon) throw new Error("Missing fixture weapon for " + classId);

  const player = snapshot.units[0]!;
  const enemy = snapshot.units[1]!;
  const step = profileIndex * 3;
  player.classId = classId;
  player.level = 10;
  player.experience = 40 + profileIndex;
  player.stats = {
    hp: 24 + step,
    strength: 7 + step,
    magic: profileIndex,
    skill: 8 + step,
    speed: 8 + step,
    luck: 4 + step,
    defense: 5 + step,
    resistance: 1 + profileIndex
  };
  player.currentHp = 17;
  player.usableWeaponTypes = [weapon.type];
  player.inventory = [weapon.id];
  player.equippedWeaponId = weapon.id;
  player.hasMoved = false;
  player.hasActed = false;
  enemy.position = { x: 1, y: classId === "archer" ? 6 : 7 };

  // Chapter 1 now has a defeat_boss objective. Keep the boss alive in every
  // matrix fixture so enemy-phase samples do not start from an already-cleared battle.
  const boss = structuredClone(enemy);
  boss.id = "enemy_005";
  boss.name = "評価用の敵将";
  boss.classId = "cavalry";
  boss.usableWeaponTypes = ["lance"];
  boss.inventory = ["iron_lance"];
  boss.equippedWeaponId = "iron_lance";
  boss.position = { x: 8, y: 4 };
  boss.hasMoved = true;
  boss.hasActed = true;
  snapshot.units.push(boss);

  return {
    ...envelope,
    exportedAt: "2026-11-12T00:00:00.000Z",
    data: snapshot
  };
}

test("organizes and runs all 21 class-promotion cases, keeping synthetic data explicitly classified", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  const classIds = ["swordsman", "mercenary", "fighter", "soldier", "cavalry", "archer", "mage"];
  const profiles = ["low", "median", "upper"];
  const files = classIds.flatMap((classId) =>
    profiles.map((profile, index) => ({
      name: classId + "-" + profile + ".json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(makePromotionMatrixSnapshotFile(classId, index)))
    }))
  );

  const firstMatrixSnapshot = makePromotionMatrixSnapshotFile("swordsman", 0).data;
  expect(firstMatrixSnapshot.units).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: "enemy_005", hasMoved: true, hasActed: true })
  ]));

  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles(files);
  await expect(bench).toContainText("21候補");

  const matrix = bench.getByTestId("promotion-playtest-matrix");
  const caseRows = matrix.locator('tr[data-testid^="promotion-playtest-case-"]');
  await expect(caseRows).toHaveCount(21);
  await expect(matrix).toContainText("0/21 実行準備完了");
  const runButton = matrix.getByRole("button", { name: "21ケースのseed反復を実行" });
  await expect(runButton).toBeDisabled();

  await matrix.getByLabel("21ケースの乱数試行回数").selectOption("20");
  for (let index = 0; index < 21; index += 1) {
    await caseRows.nth(index).getByRole("checkbox").check();
  }
  await expect(matrix).toContainText("21/21 実行準備完了");
  await expect(runButton).toBeEnabled();
  await runButton.click();

  const results = matrix.getByTestId("promotion-playtest-matrix-results");
  await expect(results).toContainText("試行結果（21/21件）");
  await expect(results.locator('tr[data-testid^="promotion-playtest-result-"]')).toHaveCount(21);
  await expect(results).toContainText("未確認");
  await expect(results).toContainText("敵軍行動数");
  await expect(results).toContainText("本人が狙われた割合");
  await expect(results).toContainText("敵軍phase本人生存率");

  const downloadPromise = page.waitForEvent("download");
  await matrix.getByRole("button", { name: "21ケース結果CSVを書き出す" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("class-promotion-playtest-matrix.csv");
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("CSV download path was not available.");
  const csv = await readFile(downloadPath, "utf8");
  expect(csv).toContain("basic_class");
  expect(csv).toContain("swordsman:low");
  expect(csv).toContain("promotion_strength");
  expect(csv).toContain("requested_hp_bonus");
  expect(csv).toContain("applied_hp_bonus");
  expect(csv).toContain("control_enemy_phase_actions");
  expect(csv).toContain("promotion_selected_unit_survival_rate");
  expect(csv).toContain("control_battle_defeat_rate");
  expect(csv).toContain("control_party_wipe_rate");
  expect(csv).toContain("未確認");
});
 
test("imports an exported save locally and compares the actual unit snapshot with a detached promotion copy", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  await expect(bench.getByRole("heading", { name: "実セーブ昇格比較ベンチ" })).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);

  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles({
    name: "unit-snapshot.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(makePromotionSnapshotFile()))
  });

  await expect(bench).toContainText("1候補");
  await expect(bench.getByTestId("promotion-snapshot-selected")).toContainText("試験ユニット01");
  await expect(bench.getByTestId("promotion-snapshot-selected")).toContainText("Lv.10 · EXP 73");
  await expect(bench.getByTestId("promotion-snapshot-selected")).toContainText("平均能力percentile");
  await expect(bench.getByTestId("promotion-snapshot-selected")).toContainText("分布データ不足");
  await expect(bench.getByTestId("promotion-snapshot-comparison")).toContainText("試験用の証をコピーにだけ追加");
  await expect(bench.getByTestId("promotion-snapshot-comparison")).toContainText("Lv.10 · EXP 73");
  await expect(bench.getByTestId("promotion-snapshot-comparison")).toContainText("Lv.1 · EXP 73");
  await expect(bench.getByTestId("promotion-snapshot-comparison")).toContainText("17 → 17");
  await expect(bench.getByTestId("promotion-snapshot-comparison")).toContainText("RNG不変: 確認済み");

  const hpCells = bench.getByTestId("promotion-snapshot-stat-hp").locator("td");
  await expect(hpCells).toHaveCount(5);
  await expect(hpCells.nth(0)).toHaveText("28");
  await expect(hpCells.nth(1)).toHaveText("30");
  await expect(hpCells.nth(2)).toHaveText("+2");
  await expect(hpCells.nth(3)).toHaveText("+2");
  await expect(hpCells.nth(4)).toHaveText("60");

  const combat = bench.getByTestId("promotion-snapshot-combat");
  await expect(combat.getByRole("heading", { name: "同条件の仮想戦闘比較" })).toBeVisible();
  await expect(combat.getByLabel("比較対象の敵")).toHaveValue("enemy_001");
  await expect(combat.getByTestId("promotion-snapshot-combat-rng")).toContainText("305419896");
  const controlCombat = combat.getByTestId("promotion-snapshot-combat-control");
  const promotionCombat = combat.getByTestId("promotion-snapshot-combat-promotion");
  await expect(controlCombat).toContainText("命中 73%");
  await expect(promotionCombat).toContainText("命中 75%");
  await expect(controlCombat).toContainText("実行結果（このseedの1試行）");
  await expect(promotionCombat).toContainText("実行結果（このseedの1試行）");

  const samples = combat.getByTestId("promotion-snapshot-combat-samples");
  await expect(samples).toContainText("100試行");
  await expect(samples).toContainText("攻撃命中率");
  await expect(samples).toContainText("この敵の撃破率");
  await samples.getByLabel("乱数試行回数").selectOption("20");
  await expect(samples).toContainText("20試行");
  await samples.getByLabel("乱数試行回数").selectOption("250");
  await expect(samples).toContainText("250試行");

  const databases = await page.evaluate(async () => {
    if (typeof indexedDB.databases !== "function") return [];
    return (await indexedDB.databases())
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name));
  });
  expect(databases).toEqual([]);

  await page.reload();
  await expect(page.getByTestId("promotion-snapshot-bench")).toContainText("0候補");
});

test("rejects malformed and unsupported snapshot files without opening campaign persistence", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{ not valid json")
  });
  await expect(bench.getByRole("alert")).toContainText("JSONとして読み込めません");
  await expect(bench).toContainText("0候補");

  const databases = await page.evaluate(async () => {
    if (typeof indexedDB.databases !== "function") return [];
    return (await indexedDB.databases())
      .map((database) => database.name)
      .filter((name): name is string => Boolean(name));
  });
  expect(databases).toEqual([]);
});
