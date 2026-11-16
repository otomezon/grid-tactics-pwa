import { describe, expect, it } from "vitest";
import { serializeCsvDocument } from "./serialize-csv-document";
import {
  auditPromotionManualPlaytestWorksheet,
  PROMOTION_MANUAL_PLAYTEST_CASE_IDS,
  PROMOTION_MANUAL_PLAYTEST_REQUIRED_HEADERS
} from "./audit-promotion-manual-playtest-worksheet";

const headers = [
  ...PROMOTION_MANUAL_PLAYTEST_REQUIRED_HEADERS,
  "source_file",
  "source_save_version",
  "normalized_save_version",
  "migration_applied",
  "chapter_id",
  "snapshot_turn",
  "snapshot_phase",
  "enemy_class",
  "enemy_hp",
  "enemy_position"
];

function createRows(): Array<Record<string, string>> {
  return PROMOTION_MANUAL_PLAYTEST_CASE_IDS.flatMap((caseId) =>
    (["control", "promotion"] as const).map((plannedBranch) => ({
      case_id: caseId,
      planned_branch: plannedBranch,
      manual_record_status: "未記録",
      candidate_source_classification: "実プレイ由来（利用者申告）",
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
      manual_session_id: "",
      played_at: "",
      branch_commit: "",
      observed_start_rng_state: "",
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

describe("auditPromotionManualPlaytestWorksheet", () => {
  it("accepts a complete 21-case paired worksheet and counts only entered observation cells", () => {
    const rows = createRows();
    rows[0]!.manual_record_status = "記録済み";
    rows[0]!.post_strength = "14";
    rows[0]!.actual_damage = "8";
    rows[0]!.observations = "命中。\n追加メモ, CSV quote \"test\"";

    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));

    expect(audit.csvRowCount).toBe(42);
    expect(audit.acceptedRowCount).toBe(42);
    expect(audit.pairedCaseCount).toBe(21);
    expect(audit.matchedPairCount).toBe(21);
    expect(audit.missingBranchCount).toBe(0);
    expect(audit.invalidRowCount).toBe(0);
    expect(audit.rowsWithAnyObservation).toBe(1);
    expect(audit.cases[0]!.control?.observationFilledFieldCount).toBe(3);
    expect(audit.cases[0]!.control?.manualRecordStatus).toBe("記録済み");
    expect(audit.warnings.join("\n")).toContain("利用者申告");
    expect(audit.warnings.join("\n")).not.toContain("真正性の検証結果");
    expect(audit.errors).toEqual([]);
  });

  it("flags a mismatch between paired snapshot inputs and paired execution context", () => {
    const rows = createRows();
    const control = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "control")!;
    const promotion = rows.find((row) => row.case_id === "swordsman:low" && row.planned_branch === "promotion")!;
    promotion.snapshot_fingerprint = "different-snapshot";
    control.manual_session_id = "session-swordsman-low";
    promotion.manual_session_id = "session-swordsman-low";
    control.branch_commit = "abcdef123456";
    promotion.branch_commit = "abcdef123456";
    control.observed_start_rng_state = "305419896";
    promotion.observed_start_rng_state = "305419897";

    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));
    const summary = audit.cases.find((entry) => entry.caseId === "swordsman:low")!;

    expect(audit.pairedCaseCount).toBe(21);
    expect(audit.matchedPairCount).toBe(20);
    expect(audit.casesWithMetadataMismatchCount).toBe(1);
    expect(summary.pairFieldMismatches).toContain("snapshot fingerprint");
    expect(summary.pairFieldMismatches).toContain("実行時開始seed");
  });

  it("reports missing branches, duplicate branches, invalid cases, and unknown case IDs", () => {
    const rows = createRows().filter((row) =>
      !(row.case_id === "mage:upper" && row.planned_branch === "promotion")
    );
    rows.push({ ...rows[0]!, observations: "duplicate row" });
    rows.push({ ...rows[1]!, case_id: "unknown:case" });
    rows.push({ ...rows[2]!, planned_branch: "other" });

    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));

    expect(audit.missingBranchCount).toBe(1);
    expect(audit.duplicateBranchCount).toBe(1);
    expect(audit.unknownCaseRowCount).toBe(1);
    expect(audit.invalidRowCount).toBe(3);
    expect(audit.errors.join("\n")).toContain("重複");
    expect(audit.errors.join("\n")).toContain("未知のcase_id");
    expect(audit.errors.join("\n")).toContain("planned_branch");
  });

  it("rejects a template missing required columns and malformed CSV quoting", () => {
    const missingHeaders = ["case_id", "planned_branch"];
    const missingColumnsCsv = serializeCsvDocument(missingHeaders, [["swordsman:low", "control"]]);
    const missingColumnsAudit = auditPromotionManualPlaytestWorksheet(missingColumnsCsv);
    expect(missingColumnsAudit.errors.join("\n")).toContain("必要な列がありません");

    const malformedAudit = auditPromotionManualPlaytestWorksheet(
      "case_id,planned_branch\n\"swordsman:low,control"
    );
    expect(malformedAudit.errors.join("\n")).toContain("閉じていない引用符");
    expect(malformedAudit.missingBranchCount).toBe(42);
  });

  it("does not treat a spreadsheet verification flag as proof of authenticity", () => {
    const rows = createRows();
    rows[0]!.classification_is_verified = "true";
    const audit = auditPromotionManualPlaytestWorksheet(toCsv(rows));

    expect(audit.warnings.join("\n")).toContain("真正性の検証結果として扱いません");
    expect(audit.matchedPairCount).toBe(21);
  });
});
