import { describe, expect, it } from "vitest";
import {
  auditPromotionManualPlaytestWorksheet,
  PROMOTION_MANUAL_PLAYTEST_CASE_IDS
} from "./audit-promotion-manual-playtest-worksheet";
import { getPromotionManualPlaytestObservationComparisons } from "./get-promotion-manual-playtest-observation-comparisons";
import { serializeCsvDocument } from "./serialize-csv-document";
import { PROMOTION_MANUAL_PLAYTEST_WORKSHEET_HEADERS } from "./promotion-manual-playtest-worksheet-schema";

const headers = [...PROMOTION_MANUAL_PLAYTEST_WORKSHEET_HEADERS];

function createRows(): Array<Record<string, string>> {
  return PROMOTION_MANUAL_PLAYTEST_CASE_IDS.flatMap((caseId) =>
    (["control", "promotion"] as const).map((plannedBranch) => ({
      case_id: caseId,
      planned_branch: plannedBranch,
      manual_record_status: "記録済み",
      candidate_source_classification: "未確認",
      classification_is_verified: "false",
      snapshot_fingerprint: "fingerprint-" + caseId,
      source_file: "save-" + caseId + ".json",
      source_save_version: "10",
      normalized_save_version: "10",
      migration_applied: "false",
      chapter_id: "chapter_01_map",
      snapshot_turn: "4",
      snapshot_phase: "player",
      snapshot_rng_state: "305419896",
      unit_id: "unit-" + caseId,
      enemy_id: "enemy-" + caseId,
      enemy_class: "fighter",
      enemy_hp: "30",
      enemy_position: "4列・4行",
      manual_session_id: "session-" + caseId,
      played_at: "2026-11-16T10:00:00+09:00",
      branch_commit: "abcdef1234567890",
      observed_start_rng_state: "305419896",
      post_strength: "",
      actual_damage: "",
      damage_taken: "",
      observations: ""
    }))
  );
}

function toCsv(rows: Array<Record<string, string>>): string {
  return serializeCsvDocument(headers, rows.map((row) => headers.map((header) => row[header] ?? "")));
}

describe("getPromotionManualPlaytestObservationComparisons", () => {
  it("compares paired numeric values and leaves missing or text values without a numeric delta", () => {
    const rows = createRows();
    const control = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "control")!;
    const promotion = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "promotion")!;
    control.actual_damage = "8";
    promotion.actual_damage = "11";
    control.post_strength = "14";
    promotion.post_strength = "";
    control.observations = "命中";
    promotion.observations = "回避";
    control.damage_taken = "-2.5";
    promotion.damage_taken = "1.25";

    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));
    const comparisons = getPromotionManualPlaytestObservationComparisons(audit);
    const find = (field: string) => comparisons.find((entry) => entry.caseId === "swordsman:low" && entry.field === field);

    expect(find("actual_damage")).toMatchObject({
      controlValue: "8",
      promotionValue: "11",
      numericDelta: 3,
      pairConditionsMatch: true
    });
    expect(find("post_strength")).toMatchObject({
      controlValue: "14",
      promotionValue: "",
      numericDelta: null
    });
    expect(find("observations")).toMatchObject({
      controlValue: "命中",
      promotionValue: "回避",
      numericDelta: null
    });
    expect(find("damage_taken")?.numericDelta).toBe(3.75);
    expect(comparisons.some((entry) => entry.field === "manual_session_id")).toBe(false);
  });

  it("keeps descriptive deltas visible without treating a metadata-mismatched pair as matched", () => {
    const rows = createRows();
    const control = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "control")!;
    const promotion = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "promotion")!;
    control.actual_damage = "8";
    promotion.actual_damage = "11";
    promotion.snapshot_fingerprint = "different-snapshot";

    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));
    const comparison = getPromotionManualPlaytestObservationComparisons(audit)
      .find((entry) => entry.caseId === "swordsman:low" && entry.field === "actual_damage");

    expect(comparison).toMatchObject({
      numericDelta: 3,
      pairConditionsMatch: false,
      pairFieldMismatches: ["snapshot fingerprint"]
    });
  });

  it("omits wholly blank fields and cases without both accepted branches", () => {
    const rows = createRows().filter((row) =>
      !(row.case_id === "mage:upper" && row.planned_branch === "promotion")
    );
    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));

    expect(getPromotionManualPlaytestObservationComparisons(audit)).toEqual([]);
  });
});
