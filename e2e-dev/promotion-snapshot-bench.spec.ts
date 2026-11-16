import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

function parseCsvRecords(content: string): string[][] {
  const source = content.startsWith("\ufeff") ? content.slice(1) : content;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      record.push(field);
      field = "";
    } else if (character === "\r" && source[index + 1] === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
      index += 1;
    } else if (character === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  return records;
}

function serializeCsvRecords(records: string[][]): string {
  return records.map((record) => record.map((value) =>
    '"' + value.replace(/"/g, '""') + '"'
  ).join(",")).join("\r\n");
}

function makePromotionSnapshotFile() {
  const snapshot = {
    saveVersion: 10,
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
    mapEventChoices: [],
    campaignChoices: [],
    campaignBattleLog: []
  };
  return {
    format: "grid-tactics-pwa-save",
    formatVersion: 1,
    exportedAt: "2026-11-12T00:00:00.000Z",
    data: snapshot
  };
}


function makePromotionSnapshotAtCampaignHistoryLimitFile() {
  const envelope = makePromotionSnapshotFile();
  return {
    ...envelope,
    data: {
      ...envelope.data,
      campaignBattleLog: Array.from({ length: 5000 }, (_, index) => ({
        sequence: index + 6,
        chapterId: "chapter_01_map",
        turn: 4,
        kind: "player-action",
        action: "wait",
        actorId: "unit_001",
        actorName: "試験ユニット01",
        detail: "待機"
      }))
    }
  };
}

function makePromotionSnapshotWithCampaignHistoryFile() {
  const envelope = makePromotionSnapshotFile();
  return {
    ...envelope,
    data: {
      ...envelope.data,
      campaignBattleLog: [
        {
          sequence: 1, chapterId: "chapter_01_map", turn: 2,
          kind: "player-action", action: "movement", actorId: "unit_001",
          actorName: "試験ユニット01", detail: "移動"
        },
        {
          sequence: 2, chapterId: "chapter_01_map", turn: 2,
          kind: "player-attack", attackerId: "unit_001", attackerName: "試験ユニット01",
          defenderId: "enemy_001", defenderName: "比較用の敵01", defenderRemainingHp: 18,
          experienceAwarded: 10,
          strikes: [{
            actorId: "unit_001", actorName: "試験ユニット01",
            targetId: "enemy_001", targetName: "比較用の敵01",
            kind: "initial", weaponName: "Iron Sword", outcome: "hit", damage: 12,
            targetHpBefore: 30, targetHpAfter: 18
          }]
        },
        {
          sequence: 3, chapterId: "chapter_01_map", turn: 2,
          kind: "enemy-action", enemyId: "enemy_001", enemyName: "比較用の敵01",
          actionKind: "attacked", targetId: "unit_001", targetName: "試験ユニット01",
          strikes: []
        },
        {
          sequence: 4, chapterId: "chapter_01_map", turn: 4,
          kind: "chapter-result", outcome: "victory", objective: "defeat_boss",
          reason: "objective-cleared", livingPlayerCount: 1, livingEnemyCount: 0
        }
      ],
      campaignUnitBattleRecords: [{
        unitId: "unit_001", unitName: "試験ユニット01",
        attacks: 1, strikes: 1, hits: 1, misses: 0, criticalHits: 0,
        damageDealt: 12, enemiesDefeated: 0, experienceAwarded: 10, levelUps: 0,
        statGains: {
          hp: 0, strength: 0, magic: 0, skill: 0,
          speed: 0, luck: 0, defense: 0, resistance: 0
        }
      }]
    }
  };
}

function makeThreeSwordsmanCandidatesFromOneSaveFile() {
  const envelope = makePromotionSnapshotFile();
  const first = envelope.data.units[0]!;
  const makeCandidateUnit = (id: string, name: string, x: number, strengthBonus: number) => ({
    ...structuredClone(first),
    id,
    name,
    classId: "swordsman",
    stats: { ...first.stats, strength: first.stats.strength + strengthBonus },
    currentHp: first.currentHp,
    usableWeaponTypes: ["sword"],
    inventory: ["iron_sword"],
    equippedWeaponId: "iron_sword",
    position: { x, y: 8 },
    hasMoved: false,
    hasActed: false
  });

  return {
    ...envelope,
    data: {
      ...envelope.data,
      units: [
        ...envelope.data.units,
        makeCandidateUnit("unit_002", "剣士候補02", 3, 2),
        makeCandidateUnit("unit_003", "剣士候補03", 5, 4)
      ]
    }
  };
}

function makeLegacyVersionNinePromotionSnapshotFile() {
  const envelope = makePromotionSnapshotFile();
  return { ...envelope, data: { ...envelope.data, saveVersion: 9 } };
}

function makeLegacyVersionOnePromotionSnapshotFile() {
  const envelope = makePromotionSnapshotFile();
  const {
    saveVersion: _saveVersion,
    rngState: _rngState,
    reserveUnits: _reserveUnits,
    campaignUnitBattleRecords: _campaignUnitBattleRecords,
    firedMapEventIds: _firedMapEventIds,
    acknowledgedMapEventIds: _acknowledgedMapEventIds,
    mapEventChoices: _mapEventChoices,
    campaignChoices: _campaignChoices,
    campaignBattleLog: _campaignBattleLog,
    ...legacy
  } = envelope.data;

  return {
    ...envelope,
    data: {
      ...legacy,
      saveVersion: 1,
      units: legacy.units.map(({ equippedWeaponId: _equippedWeaponId, ...unit }) => ({
        ...unit,
        inventory: ["prototype_weapon"]
      }))
    }
  };
}

function reverseObjectKeyOrder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseObjectKeyOrder);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .reverse()
      .map(([key, entry]) => [key, reverseObjectKeyOrder(entry)])
  );
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
  const manualWorksheetButton = matrix.getByTestId("promotion-playtest-manual-worksheet-export");
  await expect(manualWorksheetButton).toBeDisabled();

  await matrix.getByLabel("21ケースの乱数試行回数").selectOption("20");
  for (let index = 0; index < 21; index += 1) {
    // Synthetic fixtures must be explicitly classified before exporting manual evidence.
    await caseRows.nth(index).locator('select[aria-label$="データ区分"]').selectOption("synthetic");
    await caseRows.nth(index).getByRole("checkbox").check();
  }
  await expect(matrix).toContainText("21/21 実行準備完了");
  await expect(runButton).toBeEnabled();
  await expect(manualWorksheetButton).toBeEnabled();

  const manualDownloadPromise = page.waitForEvent("download");
  await manualWorksheetButton.click();
  const manualDownload = await manualDownloadPromise;
  expect(manualDownload.suggestedFilename()).toBe("class-promotion-manual-playtest-worksheet.csv");
  const manualDownloadPath = await manualDownload.path();
  if (!manualDownloadPath) throw new Error("Manual worksheet CSV download path was not available.");
  const manualRecords = parseCsvRecords(await readFile(manualDownloadPath, "utf8"));
  expect(manualRecords).toHaveLength(43);
  const manualHeaders = manualRecords[0]!;
  expect(manualHeaders).toHaveLength(120);
  const manualValueAt = (row: string[], name: string) => row[manualHeaders.indexOf(name)] ?? "";
  expect(manualHeaders).toContain("manual_record_status");
  expect(manualHeaders).toContain("candidate_source_classification");
  expect(manualHeaders).toContain("actual_damage");
  expect(manualHeaders).toContain("observed_start_rng_state");
  expect(manualHeaders).toContain("reachable_tiles_count");
  expect(manualHeaders).toContain("enemy_phase_actions");
  for (const record of manualRecords.slice(1)) {
    expect(record).toHaveLength(manualHeaders.length);
    expect(manualValueAt(record, "manual_record_status")).toBe("未記録");
    expect(manualValueAt(record, "actual_damage")).toBe("");
    expect(manualValueAt(record, "observed_start_rng_state")).toBe("");
    expect(manualValueAt(record, "played_at")).toBe("");
    expect(manualValueAt(record, "branch_commit")).toBe("");
  }
  const manualRowsByCase = new Map<string, string[]>();
  for (const record of manualRecords.slice(1)) {
    const caseId = manualValueAt(record, "case_id");
    manualRowsByCase.set(caseId, [...(manualRowsByCase.get(caseId) ?? []), manualValueAt(record, "planned_branch")]);
  }
  expect(manualRowsByCase.size).toBe(21);
  for (const branches of manualRowsByCase.values()) {
    expect(branches.sort()).toEqual(["control", "promotion"]);
  }
  const swordsmanLowControl = manualRecords.slice(1).find((record) =>
    manualValueAt(record, "case_id") === "swordsman:low" &&
    manualValueAt(record, "planned_branch") === "control"
  );
  expect(swordsmanLowControl).toBeDefined();
  expect(manualValueAt(swordsmanLowControl!, "unit_id")).toBeTruthy();
  expect(manualValueAt(swordsmanLowControl!, "snapshot_rng_state")).toBeTruthy();
  expect(manualValueAt(swordsmanLowControl!, "candidate_source_classification")).toBe("合成fixture");
  expect(manualValueAt(swordsmanLowControl!, "classification_is_verified")).toBe("false");
  expect(manualValueAt(swordsmanLowControl!, "post_strength")).toBe("");
  expect(manualValueAt(swordsmanLowControl!, "applied_strength_bonus")).toBe("");

  const auditColumn = (name: string) => manualHeaders.indexOf(name);
  const completedWorksheet = manualRecords.map((record, index) => {
    if (index === 0) return record;
    const next = [...record];
    const values = new Map<string, string>([
      ["manual_record_status", "記録済み"],
      ["manual_session_id", "session-" + manualValueAt(record, "case_id")],
      ["played_at", "2026-11-16T10:00:00+09:00"],
      ["branch_commit", "abcdef1234567890"],
      ["observed_start_rng_state", "305419896"],
      ["post_strength", manualValueAt(record, "planned_branch") === "control" ? "14" : ""],
      ["actual_damage", manualValueAt(record, "planned_branch") === "promotion" ? "11" : "8"]
    ]);
    for (const [name, value] of values) next[auditColumn(name)] = value;
    return next;
  });
  await bench.locator('input[aria-label="記入済み実プレイ記録CSV"]').setInputFiles({
    name: "completed-manual-playtest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(serializeCsvRecords(completedWorksheet))
  });
  const worksheetAudit = bench.getByTestId("promotion-manual-worksheet-audit");
  await expect(worksheetAudit).toContainText("21/21 条件一致ペア");
  await expect(worksheetAudit).toContainText("42／42");
  await expect(worksheetAudit).toContainText("観測欄入力済みセル");
  const swordsmanLowAudit = worksheetAudit.getByTestId("promotion-manual-audit-case-swordsman-low");
  await expect(swordsmanLowAudit.locator("td").nth(0)).toContainText("6/76欄入力");
  await expect(swordsmanLowAudit.locator("td").nth(1)).toContainText("5/76欄入力");
  await swordsmanLowAudit.locator("td").nth(1).locator("summary").click();
  await expect(swordsmanLowAudit.locator("td").nth(1)).toContainText("post_level");
  await expect(worksheetAudit).toContainText("真正性");

  const fieldCoverage = worksheetAudit.getByTestId("promotion-manual-field-coverage");
  await fieldCoverage.locator("summary").click();
  await expect(fieldCoverage.locator("tr").filter({ hasText: "actual_damage" })).toContainText("42/42");
  await expect(fieldCoverage.locator("tr").filter({ hasText: "post_level" })).toContainText("0/42");

  const pairCoverage = worksheetAudit.getByTestId("promotion-manual-pair-coverage");
  await pairCoverage.locator("summary").click();
  const actualDamagePairCoverage = pairCoverage.getByTestId("promotion-manual-pair-coverage-actual_damage");
  await expect(actualDamagePairCoverage.locator("td").nth(0)).toHaveText("21/21");
  await expect(actualDamagePairCoverage.locator("td").nth(5)).toHaveText("21");
  await expect(actualDamagePairCoverage.locator("td").nth(7)).toHaveText("0/21");
  const postStrengthPairCoverage = pairCoverage.getByTestId("promotion-manual-pair-coverage-post_strength");
  await expect(postStrengthPairCoverage.locator("td").nth(1)).toHaveText("21");
  await expect(pairCoverage.getByTestId("promotion-manual-pair-coverage-manual_session_id")).toHaveCount(0);

  const pairCoverageDownloadPromise = page.waitForEvent("download");
  await worksheetAudit.getByRole("button", { name: "観測欄ペア充足CSVを書き出す" }).click();
  const pairCoverageDownload = await pairCoverageDownloadPromise;
  expect(pairCoverageDownload.suggestedFilename()).toBe("class-promotion-manual-playtest-observation-coverage.csv");
  const pairCoverageDownloadPath = await pairCoverageDownload.path();
  if (!pairCoverageDownloadPath) throw new Error("Manual observation coverage CSV download path was not available.");
  const pairCoverageRecords = parseCsvRecords(await readFile(pairCoverageDownloadPath, "utf8"));
  const pairCoverageHeaders = pairCoverageRecords[0]!;
  const pairCoverageColumn = (name: string) => pairCoverageHeaders.indexOf(name);
  const actualDamageCoverageRecord = pairCoverageRecords.slice(1).find((record) =>
    record[pairCoverageColumn("observation_field")] === "actual_damage"
  );
  expect(actualDamageCoverageRecord).toBeDefined();
  expect(actualDamageCoverageRecord![pairCoverageColumn("both_values_present_case_count")]).toBe("21");
  expect(actualDamageCoverageRecord![pairCoverageColumn("numeric_delta_available_pair_count")]).toBe("21");
  expect(actualDamageCoverageRecord![pairCoverageColumn("metadata_mismatch_case_count")]).toBe("0");


  const observationMatrix = worksheetAudit.getByTestId("promotion-manual-observation-matrix");
  await expect(observationMatrix.locator("tbody tr")).toHaveCount(21);
  const comparisonFieldSelect = observationMatrix.getByLabel("比較する観測欄");
  const comparisonFieldOptions = await comparisonFieldSelect.locator("option").allTextContents();
  expect(comparisonFieldOptions).toContain("actual_damage");
  expect(comparisonFieldOptions).not.toContain("manual_session_id");
  expect(comparisonFieldOptions).not.toContain("played_at");
  await comparisonFieldSelect.selectOption("actual_damage");
  const swordsmanLowMatrixRow = observationMatrix.getByTestId("promotion-manual-observation-matrix-row-swordsman-low");
  await expect(swordsmanLowMatrixRow).toContainText("CSV記載条件一致");
  await expect(swordsmanLowMatrixRow).toContainText("8");
  await expect(swordsmanLowMatrixRow).toContainText("11");
  await expect(swordsmanLowMatrixRow).toContainText("+3");

  const swordsmanLowComparison = worksheetAudit.getByTestId("promotion-manual-audit-comparison-swordsman-low");
  await swordsmanLowComparison.locator("summary").click();
  await expect(swordsmanLowComparison).toContainText("actual_damage");
  await expect(swordsmanLowComparison).toContainText("8");
  await expect(swordsmanLowComparison).toContainText("11");
  await expect(swordsmanLowComparison).toContainText("+3");
  await expect(swordsmanLowComparison).toContainText("post_strength");
  await expect(swordsmanLowComparison).toContainText("未記入");
  await expect(swordsmanLowComparison).toContainText("空欄あり。0とは扱わない");

  const comparisonDownloadPromise = page.waitForEvent("download");
  await worksheetAudit.getByRole("button", { name: /記録値の比較CSVを出力/ }).click();
  const comparisonDownload = await comparisonDownloadPromise;
  expect(comparisonDownload.suggestedFilename()).toBe("class-promotion-manual-playtest-comparison.csv");
  const comparisonDownloadPath = await comparisonDownload.path();
  if (!comparisonDownloadPath) throw new Error("Manual comparison CSV download path was not available.");
  const comparisonRecords = parseCsvRecords(await readFile(comparisonDownloadPath, "utf8"));
  const comparisonHeaders = comparisonRecords[0]!;
  const comparisonColumn = (name: string) => comparisonHeaders.indexOf(name);
  expect(comparisonHeaders).toContain("promotion_minus_control");
  expect(comparisonHeaders).toContain("pair_condition_status");
  const actualDamageComparison = comparisonRecords.slice(1).find((record) =>
    record[comparisonColumn("case_id")] === "swordsman:low" &&
    record[comparisonColumn("observation_field")] === "actual_damage"
  );
  expect(actualDamageComparison).toBeDefined();
  expect(actualDamageComparison![comparisonColumn("control_value")]).toBe("8");
  expect(actualDamageComparison![comparisonColumn("promotion_value")]).toBe("11");
  expect(actualDamageComparison![comparisonColumn("promotion_minus_control")]).toBe("3");
  expect(actualDamageComparison![comparisonColumn("numeric_delta_available")]).toBe("true");
  const blankComparison = comparisonRecords.slice(1).find((record) =>
    record[comparisonColumn("case_id")] === "swordsman:low" &&
    record[comparisonColumn("observation_field")] === "post_strength"
  );
  expect(blankComparison).toBeDefined();
  expect(blankComparison![comparisonColumn("control_value")]).toBe("14");
  expect(blankComparison![comparisonColumn("promotion_value")]).toBe("");
  expect(blankComparison![comparisonColumn("promotion_minus_control")]).toBe("");
  expect(blankComparison![comparisonColumn("numeric_delta_available")]).toBe("false");

  const mismatchedWorksheet = completedWorksheet.map((record) => [...record]);
  const mismatchRow = mismatchedWorksheet.findIndex((record, index) =>
    index > 0 &&
    record[auditColumn("case_id")] === "swordsman:low" &&
    record[auditColumn("planned_branch")] === "promotion"
  );
  mismatchedWorksheet[mismatchRow]![auditColumn("snapshot_fingerprint")] = "different-fingerprint";
  await bench.locator('input[aria-label="記入済み実プレイ記録CSV"]').setInputFiles({
    name: "mismatched-manual-playtest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(serializeCsvRecords(mismatchedWorksheet))
  });
  await expect(worksheetAudit).toContainText("20/21 条件一致ペア");
  await expect(worksheetAudit.getByTestId("promotion-manual-audit-case-swordsman-low")).toContainText("2枝あり・条件差");
  const mismatchedComparison = worksheetAudit.getByTestId("promotion-manual-audit-comparison-swordsman-low");
  await mismatchedComparison.locator("summary").click();
  await expect(mismatchedComparison).toContainText("条件の記載に差があります");
  const mismatchedMatrix = worksheetAudit.getByTestId("promotion-manual-observation-matrix");
  await mismatchedMatrix.getByLabel("比較する観測欄").selectOption("actual_damage");
  await expect(mismatchedMatrix.getByTestId("promotion-manual-observation-matrix-row-swordsman-low")).toContainText("条件の記載に差あり");
  const mismatchedPairCoverage = worksheetAudit.getByTestId("promotion-manual-pair-coverage");
  await mismatchedPairCoverage.locator("summary").click();
  await expect(mismatchedPairCoverage.getByTestId("promotion-manual-pair-coverage-actual_damage").locator("td").nth(7)).toHaveText("1/21");

  const partialWorksheet = completedWorksheet.filter((record, index) =>
    !(index > 0 &&
      record[auditColumn("case_id")] === "mage:upper" &&
      record[auditColumn("planned_branch")] === "promotion")
  );
  await bench.locator('input[aria-label="記入済み実プレイ記録CSV"]').setInputFiles({
    name: "partial-manual-playtest.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(serializeCsvRecords(partialWorksheet))
  });
  await expect(worksheetAudit).toContainText("control／promotion両枝あり20/21");
  const partialPairCoverage = worksheetAudit.getByTestId("promotion-manual-pair-coverage");
  await partialPairCoverage.locator("summary").click();
  const partialDamageCoverage = partialPairCoverage.getByTestId("promotion-manual-pair-coverage-actual_damage");
  await expect(partialDamageCoverage.locator("td").nth(0)).toHaveText("20/20");
  await expect(partialDamageCoverage.locator("td").nth(4)).toHaveText("1/21");
  const missingPromotionMatrixRow = worksheetAudit
    .getByTestId("promotion-manual-observation-matrix")
    .getByTestId("promotion-manual-observation-matrix-row-mage-upper");
  await expect(missingPromotionMatrixRow.locator("td").nth(0)).toHaveText("片枝不足");
  await expect(missingPromotionMatrixRow.locator("td").nth(2)).toHaveText("行なし");
  await expect(missingPromotionMatrixRow.locator("td").nth(3)).toHaveText("未算出（ペア不足）");

  const partialCoverageDownloadPromise = page.waitForEvent("download");
  await worksheetAudit.getByRole("button", { name: "観測欄ペア充足CSVを書き出す" }).click();
  const partialCoverageDownload = await partialCoverageDownloadPromise;
  const partialCoveragePath = await partialCoverageDownload.path();
  if (!partialCoveragePath) throw new Error("Partial coverage CSV download path was not available.");
  const partialCoverageRecords = parseCsvRecords(await readFile(partialCoveragePath, "utf8"));
  const partialCoverageHeaders = partialCoverageRecords[0]!;
  const partialCoverageColumn = (name: string) => partialCoverageHeaders.indexOf(name);
  const partialDamageRecord = partialCoverageRecords.slice(1).find((record) =>
    record[partialCoverageColumn("observation_field")] === "actual_damage"
  );
  expect(partialDamageRecord).toBeDefined();
  expect(partialDamageRecord![partialCoverageColumn("paired_case_count")]).toBe("20");
  expect(partialDamageRecord![partialCoverageColumn("missing_branch_case_count")]).toBe("1");
  expect(partialDamageRecord![partialCoverageColumn("both_values_present_case_count")]).toBe("20");

  const firstSelectedSnapshot = await caseRows.nth(0).locator("select").nth(0).inputValue();
  await caseRows.nth(1).locator("select").nth(0).selectOption(firstSelectedSnapshot);
  await expect(caseRows.nth(0)).toContainText("同一snapshot内容が複数profileに重複");
  await expect(matrix).toContainText("19/21 実行準備完了");
  await expect(runButton).toBeDisabled();
  await caseRows.nth(1).locator("select").nth(0).selectOption("");
  await caseRows.nth(1).getByRole("checkbox").check();
  await expect(matrix).toContainText("21/21 実行準備完了");
  await expect(runButton).toBeEnabled();
  await runButton.click();

  const results = matrix.getByTestId("promotion-playtest-matrix-results");
  await expect(results).toContainText("試行結果（21/21件）");
  await expect(matrix.getByTestId("promotion-playtest-coverage-swordsman")).toContainText("3/3");
  await expect(results.locator('tr[data-testid^="promotion-playtest-result-"]')).toHaveCount(21);
  await expect(results).toContainText("合成fixture");
  await expect(results).not.toContainText("未確認");
  await expect(results).toContainText("敵軍行動数");
  await expect(results).toContainText("本人が狙われた割合");
  await expect(results).toContainText("敵軍phase本人生存率");
  await expect(results).toContainText("95%区間");
  await expect(results).toContainText("同一seed:");
  await expect(results).toContainText("昇格のみ");
  await expect(results).toContainText("非昇格のみ");
  await expect(results).toContainText("同一seed:");
  await expect(results).toContainText("昇格のみ");
  await expect(results).toContainText("非昇格のみ");

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
  expect(csv).toContain("source_save_version");
  expect(csv).toContain("normalized_save_version");
  expect(csv).toContain("migration_applied");
  expect(csv).toContain("class_distinct_unit_snapshot_count");
  expect(csv).toContain("class_eligible_distinct_unit_snapshot_count");
  expect(csv).toContain("class_campaign_history_unit_snapshot_count");
  expect(csv).toContain("campaign_log_entries");
  expect(csv).toContain("selected_unit_record_damage_dealt");
  expect(csv).toContain("exported_at");
  expect(csv).toContain("control_enemy_defeat_rate_95ci_lower");
  expect(csv).toContain("promotion_enemy_defeat_rate_95ci_upper");
  expect(csv).toContain("control_selected_unit_survival_rate_95ci_lower");
  expect(csv).toContain("promotion_player_phase_advance_rate_95ci_upper");
  expect(csv).toContain("combat_enemy_defeat_control_only");
  expect(csv).toContain("combat_enemy_defeat_promotion_only");
  expect(csv).toContain("enemy_phase_targeted_control_only");
  expect(csv).toContain("enemy_phase_party_wipe_control_only");
  expect(csv).toContain("enemy_phase_party_wipe_promotion_only");
  expect(csv).toContain("enemy_phase_player_phase_advance_promotion_minus_control_pt");
  expect(csv).toContain("未確認");
  const csvRecords = parseCsvRecords(csv);
  expect(csvRecords).toHaveLength(22);
  expect(csvRecords[0]).toHaveLength(191);
  for (const record of csvRecords.slice(1)) {
    expect(record).toHaveLength(csvRecords[0]!.length);
  }
});
 
test("allows three different candidate units from one save as separate unit snapshots", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles({
    name: "one-campaign-three-swordsmen.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(makeThreeSwordsmanCandidatesFromOneSaveFile()))
  });

  await expect(bench).toContainText("3候補");
  const coverage = bench.getByTestId("promotion-playtest-coverage-swordsman");
  await expect(coverage).toContainText("3/3");
  const matrix = bench.getByTestId("promotion-playtest-matrix");
  const firstCase = matrix.locator('tr[data-testid^="promotion-playtest-case-"]').first();
  await expect(firstCase.locator("select").nth(0).locator("option")).toHaveCount(4);
});

test("does not count renamed copies of one save as three distinct promotion samples", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  const sameSave = makePromotionSnapshotFile();
  const sameSaveText = JSON.stringify(sameSave);
  const reorderedSaveText = JSON.stringify(reverseObjectKeyOrder(sameSave));
  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles(
    [sameSaveText, sameSaveText, reorderedSaveText].map((content, index) => ({
      name: "same-save-copy-" + (index + 1) + ".json",
      mimeType: "application/json",
      buffer: Buffer.from(content)
    }))
  );

  await expect(bench).toContainText("3候補");
  const matrix = bench.getByTestId("promotion-playtest-matrix");
  const coverage = matrix.getByTestId("promotion-playtest-coverage-swordsman");
  await expect(coverage).toContainText("3");
  await expect(coverage).toContainText("1/3");
  const firstCase = matrix.locator('tr[data-testid^="promotion-playtest-case-"]').first();
  await expect(firstCase).toContainText("異なる有効snapshot不足（1/3）");
  const runButton = matrix.getByRole("button", { name: "21ケースのseed反復を実行" });
  await expect(runButton).toBeDisabled();
});

test("shows saved campaign-history evidence without claiming save authenticity", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles({
    name: "campaign-history.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(makePromotionSnapshotWithCampaignHistoryFile()))
  });

  const evidence = bench.getByTestId("promotion-snapshot-evidence");
  await expect(evidence).toContainText("保存済みキャンペーン履歴の根拠");
  await expect(evidence).toContainText("追跡対象 · 4件");
  await expect(evidence).toContainText("4／5000件");
  await expect(evidence).toContainText("1–4 · 欠番 0件");
  await expect(evidence).toContainText("上限未到達");
  await expect(evidence).toContainText("記録のある章数");
  await expect(evidence).toContainText("味方行動 1 · 味方攻撃 1 · 敵行動 1 · 章結果 1");
  await expect(evidence).toContainText("行動 1 · 攻撃 1 · 被標的 1 · 攻撃strike 1");
  await expect(evidence).toContainText("攻撃 1 · strike 1 · 命中 1 · 与ダメージ 12 · 撃破 0 · EXP 10");
  await expect(evidence).toContainText("真正性");
  await expect(evidence).toContainText("記録が空でも未プレイとは限りません");
});

test("exports a deduplicated promotion candidate inventory with source and saved-history provenance", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  const first = makePromotionSnapshotWithCampaignHistoryFile();
  first.data.units[0]!.name = '=HYPERLINK("https://example.invalid")';
  const second = reverseObjectKeyOrder({
    ...first,
    exportedAt: "2026-11-13T00:00:00.000Z"
  });

  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles([
    {
      name: "campaign-history-first.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(first))
    },
    {
      name: "campaign-history-key-order-copy.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(second))
    },
    {
      name: "legacy-v1-no-history.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(makeLegacyVersionOnePromotionSnapshotFile()))
    }
  ]);

  await expect(bench).toContainText("3候補");
  const exportButton = bench.getByTestId("promotion-snapshot-inventory-export");
  await expect(exportButton).toBeEnabled();
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("class-promotion-snapshot-inventory.csv");
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("CSV download path was not available.");
  const csv = await readFile(downloadPath, "utf8");
  const records = parseCsvRecords(csv);
  expect(records).toHaveLength(3);

  const headers = records[0]!;
  const valueAt = (row: string[], name: string) => row[headers.indexOf(name)] ?? "";
  const row = records.slice(1).find((entry) =>
    JSON.parse(valueAt(entry, "source_file_names_json")).includes("campaign-history-first.json")
  );
  const legacyRow = records.slice(1).find((entry) =>
    JSON.parse(valueAt(entry, "source_file_names_json")).includes("legacy-v1-no-history.json")
  );
  if (!row || !legacyRow) throw new Error("Expected current and legacy candidate inventory rows.");
  expect(row).toHaveLength(headers.length);
  expect(legacyRow).toHaveLength(headers.length);
  const value = (name: string) => valueAt(row, name);
  const legacyValue = (name: string) => valueAt(legacyRow, name);
  expect(headers).toContain("campaign_log_tracking_available_for_all_imports");
  expect(headers).toContain("campaign_log_at_retention_limit");
  expect(headers).toContain("campaign_log_sequence_gap_count");
  expect(headers).toContain("selected_unit_record_damage_dealt");
  expect(value("import_copy_count")).toBe("2");
  expect(JSON.parse(value("source_file_names_json"))).toEqual([
    "campaign-history-first.json",
    "campaign-history-key-order-copy.json"
  ]);
  const imports = JSON.parse(value("source_imports_json")) as Array<{ exportedAt: string }>;
  expect(imports).toHaveLength(2);
  expect(imports.map((entry) => entry.exportedAt)).toEqual([
    "2026-11-12T00:00:00.000Z",
    "2026-11-13T00:00:00.000Z"
  ]);
  expect(value("campaign_log_tracking_available_for_all_imports")).toBe("true");
  expect(value("campaign_log_tracking_available_for_any_import")).toBe("true");
  expect(value("campaign_log_entries")).toBe("4");
  expect(value("campaign_log_retention_limit")).toBe("5000");
  expect(value("campaign_log_at_retention_limit")).toBe("false");
  expect(value("campaign_log_first_sequence")).toBe("1");
  expect(value("campaign_log_last_sequence")).toBe("4");
  expect(value("campaign_log_sequence_gap_count")).toBe("0");
  expect(value("selected_unit_action_entries")).toBe("1");
  expect(value("unit_battle_totals_tracking_available_for_all_imports")).toBe("true");
  expect(value("unit_battle_totals_tracking_available_for_any_import")).toBe("true");
  expect(value("selected_unit_battle_totals_present")).toBe("true");
  expect(value("selected_unit_record_damage_dealt")).toBe("12");
  expect(value("unit_name")).toContain("'=HYPERLINK");
  expect(JSON.parse(value("source_save_versions_json"))).toEqual([10]);
  expect(JSON.parse(value("normalized_save_versions_json"))).toEqual([10]);
  expect(JSON.parse(value("migration_applied_values_json"))).toEqual([false]);
  expect(JSON.parse(legacyValue("source_save_versions_json"))).toEqual([1]);
  expect(JSON.parse(legacyValue("normalized_save_versions_json"))).toEqual([10]);
  expect(JSON.parse(legacyValue("migration_applied_values_json"))).toEqual([true]);
  expect(legacyValue("campaign_log_tracking_available_for_all_imports")).toBe("false");
  expect(legacyValue("campaign_log_tracking_available_for_any_import")).toBe("false");
  expect(legacyValue("campaign_log_at_retention_limit")).toBe("false");
  expect(legacyValue("campaign_log_sequence_gap_count")).toBe("0");
  expect(legacyValue("campaign_log_entries")).toBe("0");
  expect(legacyValue("unit_battle_totals_tracking_available_for_all_imports")).toBe("false");
  expect(legacyValue("unit_battle_totals_tracking_available_for_any_import")).toBe("false");
  expect(legacyValue("selected_unit_battle_totals_present")).toBe("false");
});

test("shows the campaign log retention cap and gaps in the saved sequence", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles({
    name: "campaign-history-at-retention-limit.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(makePromotionSnapshotAtCampaignHistoryLimitFile()))
  });

  const evidence = bench.getByTestId("promotion-snapshot-evidence");
  await expect(evidence).toContainText("追跡対象 · 5000件");
  await expect(evidence).toContainText("5000／5000件");
  await expect(evidence).toContainText("6–5005 · 欠番 5件");
  await expect(evidence).toContainText("最大保管件数に到達");
  await expect(evidence).toContainText("切り捨て有無を確定できません");

  const exportButton = bench.getByTestId("promotion-snapshot-inventory-export");
  const downloadPromise = page.waitForEvent("download");
  await exportButton.click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error("CSV download path was not available.");
  const records = parseCsvRecords(await readFile(downloadPath, "utf8"));
  const headers = records[0]!;
  const row = records[1]!;
  const value = (name: string) => row[headers.indexOf(name)] ?? "";
  expect(row).toHaveLength(headers.length);
  expect(value("campaign_log_entries")).toBe("5000");
  expect(value("campaign_log_retention_limit")).toBe("5000");
  expect(value("campaign_log_at_retention_limit")).toBe("true");
  expect(value("campaign_log_first_sequence")).toBe("6");
  expect(value("campaign_log_last_sequence")).toBe("5005");
  expect(value("campaign_log_sequence_gap_count")).toBe("5");
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
  await expect(samples).toContainText("95%区間");
  await expect(samples).toContainText("同一seed:");
  await expect(samples).toContainText("同一seed:");
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


test("imports v1 and v9 portable saves through in-memory migration and retains source provenance", async ({ page }) => {
  await page.goto("/?promotion-snapshots=1");
  const bench = page.getByTestId("promotion-snapshot-bench");
  const files = [
    {
      name: "legacy-v1.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(makeLegacyVersionOnePromotionSnapshotFile()))
    },
    {
      name: "legacy-v9.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(makeLegacyVersionNinePromotionSnapshotFile()))
    }
  ];

  await bench.getByLabel("対応するセーブJSON（複数選択可）").setInputFiles(files);
  await expect(bench).toContainText("2候補");

  const selected = bench.getByTestId("promotion-snapshot-selected");
  await expect(selected).toContainText("1 → 10（移行済み）");
  await expect(bench.getByTestId("promotion-snapshot-evidence")).toContainText("未追跡（この元saveVersionでは記録対象外）");
  await expect(selected).toContainText("export日時");
  await expect(selected).toContainText("2026-11-12T00:00:00.000Z");

  const candidateSelect = bench.getByLabel("比較するユニット");
  const optionTexts = await candidateSelect.locator("option").allTextContents();
  const v9Index = optionTexts.findIndex((option) => option.includes("legacy-v9.json"));
  expect(v9Index).toBeGreaterThanOrEqual(0);
  await candidateSelect.selectOption({ index: v9Index });
  await expect(selected).toContainText("9 → 10（移行済み）");
  await expect(bench.getByTestId("promotion-snapshot-evidence")).toContainText("追跡対象 · 0件");

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
