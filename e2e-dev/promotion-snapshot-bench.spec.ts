import { expect, test } from "@playwright/test";

function makePromotionSnapshotFile() {
  const snapshot = {
    saveVersion: 3,
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
      }
    ],
    reserveUnits: []
  };
  return {
    format: "grid-tactics-pwa-save",
    formatVersion: 1,
    exportedAt: "2026-11-12T00:00:00.000Z",
    data: snapshot
  };
}

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
