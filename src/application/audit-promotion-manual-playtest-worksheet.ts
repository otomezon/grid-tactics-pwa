import { CLASS_PROMOTION_TARGETS } from "../content/classes";

const PROFILE_IDS = ["low", "median", "upper"] as const;
const BRANCH_IDS = ["control", "promotion"] as const;

export const PROMOTION_MANUAL_PLAYTEST_CASE_IDS = Object.keys(CLASS_PROMOTION_TARGETS)
  .flatMap((classId) => PROFILE_IDS.map((profile) => classId + ":" + profile));

export const PROMOTION_MANUAL_PLAYTEST_REQUIRED_HEADERS = [
  "case_id",
  "planned_branch",
  "manual_record_status",
  "candidate_source_classification",
  "classification_is_verified",
  "snapshot_fingerprint",
  "unit_id",
  "enemy_id",
  "snapshot_rng_state",
  "manual_session_id",
  "played_at",
  "branch_commit",
  "observed_start_rng_state",
  "post_strength",
  "actual_damage",
  "damage_taken",
  "observations"
] as const;

const OBSERVATION_PREFIXES = [
  "post_",
  "requested_",
  "applied_",
  "approved_cap_",
  "physical_",
  "magical_",
  "forecast_",
  "actual_",
  "hit_",
  "miss_",
  "critical_",
  "follow_up_",
  "damage_",
  "evasion_",
  "hp_after_",
  "survived",
  "enemy_attacks_",
  "healing_",
  "reachable_",
  "attackable_",
  "objective_",
  "promotion_",
  "next_turn_",
  "kills",
  "enemy_phase_",
  "selected_unit_",
  "party_",
  "ally_",
  "player_phase_",
  "observations",
  "retest_conditions"
] as const;

const FIXED_PAIR_FIELDS = [
  ["snapshot_fingerprint", "snapshot fingerprint"],
  ["source_file", "元ファイル"],
  ["source_save_version", "元saveVersion"],
  ["normalized_save_version", "正規化後saveVersion"],
  ["migration_applied", "migration状態"],
  ["exported_at", "export日時"],
  ["chapter_id", "章"],
  ["snapshot_turn", "開始turn"],
  ["snapshot_phase", "開始phase"],
  ["snapshot_rng_state", "snapshot RNG"],
  ["unit_id", "候補unit ID"],
  ["unit_name", "候補unit名"],
  ["enemy_id", "比較敵ID"],
  ["enemy_class", "比較敵クラス"],
  ["enemy_hp", "比較敵HP"],
  ["enemy_position", "比較敵位置"],
  ["candidate_source_classification", "候補データ区分"]
] as const;

const PAIRED_RUN_FIELDS = [
  ["manual_session_id", "実セッションID"],
  ["branch_commit", "実行commit"],
  ["observed_start_rng_state", "実行時開始seed"]
] as const;

export interface PromotionManualPlaytestBranchAudit {
  rowNumber: number;
  values: Readonly<Record<string, string>>;
  observationFilledFieldCount: number;
  observationFieldCount: number;
  manualRecordStatus: string;
  candidateSourceClassification: string;
  classificationIsVerifiedValue: string;
}

export interface PromotionManualPlaytestCaseAudit {
  caseId: string;
  control: PromotionManualPlaytestBranchAudit | null;
  promotion: PromotionManualPlaytestBranchAudit | null;
  pairFieldMismatches: string[];
  duplicateBranchCount: number;
}

export interface PromotionManualPlaytestWorksheetAudit {
  headers: string[];
  csvRowCount: number;
  acceptedRowCount: number;
  invalidRowCount: number;
  unknownCaseRowCount: number;
  duplicateBranchCount: number;
  pairedCaseCount: number;
  matchedPairCount: number;
  missingBranchCount: number;
  casesWithMetadataMismatchCount: number;
  observationColumns: string[];
  observationFilledFieldCount: number;
  rowsWithAnyObservation: number;
  cases: PromotionManualPlaytestCaseAudit[];
  errors: string[];
  warnings: string[];
}

function makeEmptyCaseAudits(): PromotionManualPlaytestCaseAudit[] {
  return PROMOTION_MANUAL_PLAYTEST_CASE_IDS.map((caseId) => ({
    caseId,
    control: null,
    promotion: null,
    pairFieldMismatches: [],
    duplicateBranchCount: 0
  }));
}

function parseCsvRecords(sourceText: string): string[][] {
  const source = sourceText.startsWith("\ufeff") ? sourceText.slice(1) : sourceText;
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;
  let afterClosingQuote = false;

  const finishField = () => {
    record.push(field);
    field = "";
    afterClosingQuote = false;
  };
  const finishRecord = () => {
    finishField();
    if (record.some((value) => value.trim().length > 0)) records.push(record);
    record = [];
  };

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]!;

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        afterClosingQuote = true;
      } else {
        field += character;
      }
      continue;
    }

    if (afterClosingQuote) {
      if (character === ",") {
        finishField();
      } else if (character === "\r" || character === "\n") {
        finishRecord();
        if (character === "\r" && source[index + 1] === "\n") index += 1;
      } else if (character === " " || character === "\t") {
        // Ignore optional whitespace between a closing quote and the delimiter.
      } else {
        throw new Error("CSVの引用符の後に不正な文字があります（位置 " + (index + 1) + "）。");
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === '"') {
      throw new Error("CSVの引用符が正しくありません（位置 " + (index + 1) + "）。");
    } else if (character === ",") {
      finishField();
    } else if (character === "\r" || character === "\n") {
      finishRecord();
      if (character === "\r" && source[index + 1] === "\n") index += 1;
    } else {
      field += character;
    }
  }

  if (quoted) throw new Error("CSVに閉じていない引用符があります。");
  if (afterClosingQuote || field.length > 0 || record.length > 0) {
    finishRecord();
  }
  return records;
}

function isObservationHeader(header: string): boolean {
  return header === "manual_session_id" ||
    header === "played_at" ||
    header === "branch_commit" ||
    header === "observed_start_rng_state" ||
    OBSERVATION_PREFIXES.some((prefix) => header.startsWith(prefix));
}

function readValue(values: Readonly<Record<string, string>>, key: string): string {
  return (values[key] ?? "").trim();
}

function createBranchAudit(
  rowNumber: number,
  values: Record<string, string>,
  observationColumns: readonly string[]
): PromotionManualPlaytestBranchAudit {
  const observationFilledFieldCount = observationColumns
    .filter((column) => readValue(values, column).length > 0).length;
  return {
    rowNumber,
    values,
    observationFilledFieldCount,
    observationFieldCount: observationColumns.length,
    manualRecordStatus: readValue(values, "manual_record_status"),
    candidateSourceClassification: readValue(values, "candidate_source_classification"),
    classificationIsVerifiedValue: readValue(values, "classification_is_verified")
  };
}

/**
 * Audits the manually edited worksheet only. It validates row/pair structure and
 * compares paired setup metadata; it does not verify authenticity or gameplay values.
 */
export function auditPromotionManualPlaytestWorksheet(
  csvText: string
): PromotionManualPlaytestWorksheetAudit {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cases = makeEmptyCaseAudits();
  const caseById = new Map(cases.map((entry) => [entry.caseId, entry] as const));
  let records: string[][];

  try {
    records = parseCsvRecords(csvText);
  } catch (error) {
    return {
      headers: [],
      csvRowCount: 0,
      acceptedRowCount: 0,
      invalidRowCount: 0,
      unknownCaseRowCount: 0,
      duplicateBranchCount: 0,
      pairedCaseCount: 0,
      matchedPairCount: 0,
      missingBranchCount: PROMOTION_MANUAL_PLAYTEST_CASE_IDS.length * BRANCH_IDS.length,
      casesWithMetadataMismatchCount: 0,
      observationColumns: [],
      observationFilledFieldCount: 0,
      rowsWithAnyObservation: 0,
      cases,
      errors: [error instanceof Error ? error.message : "CSVを解析できませんでした。"],
      warnings
    };
  }

  if (records.length === 0) {
    errors.push("CSVにヘッダーとデータ行がありません。");
    return {
      headers: [],
      csvRowCount: 0,
      acceptedRowCount: 0,
      invalidRowCount: 0,
      unknownCaseRowCount: 0,
      duplicateBranchCount: 0,
      pairedCaseCount: 0,
      matchedPairCount: 0,
      missingBranchCount: PROMOTION_MANUAL_PLAYTEST_CASE_IDS.length * BRANCH_IDS.length,
      casesWithMetadataMismatchCount: 0,
      observationColumns: [],
      observationFilledFieldCount: 0,
      rowsWithAnyObservation: 0,
      cases,
      errors,
      warnings
    };
  }

  const headers = records[0]!.map((header) => header.trim());
  const duplicateHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
  if (headers.some((header) => header.length === 0)) errors.push("ヘッダーに空の列名があります。");
  if (duplicateHeaders.length > 0) {
    errors.push("ヘッダー名が重複しています: " + Array.from(new Set(duplicateHeaders)).join("／"));
  }
  const missingHeaders = PROMOTION_MANUAL_PLAYTEST_REQUIRED_HEADERS
    .filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    errors.push("実プレイ記録テンプレートに必要な列がありません: " + missingHeaders.join("、"));
  }
  if (errors.length > 0) {
    return {
      headers,
      csvRowCount: records.length - 1,
      acceptedRowCount: 0,
      invalidRowCount: Math.max(0, records.length - 1),
      unknownCaseRowCount: 0,
      duplicateBranchCount: 0,
      pairedCaseCount: 0,
      matchedPairCount: 0,
      missingBranchCount: PROMOTION_MANUAL_PLAYTEST_CASE_IDS.length * BRANCH_IDS.length,
      casesWithMetadataMismatchCount: 0,
      observationColumns: headers.filter(isObservationHeader),
      observationFilledFieldCount: 0,
      rowsWithAnyObservation: 0,
      cases,
      errors,
      warnings
    };
  }

  const observationColumns = headers.filter(isObservationHeader);
  let acceptedRowCount = 0;
  let invalidRowCount = 0;
  let unknownCaseRowCount = 0;
  let duplicateBranchCount = 0;
  let observationFilledFieldCount = 0;
  let rowsWithAnyObservation = 0;
  let actualPlayClaimSeen = false;
  let verifiedFlagClaimSeen = false;

  for (let index = 1; index < records.length; index += 1) {
    const row = records[index]!;
    const rowNumber = index + 1;
    if (row.length !== headers.length) {
      invalidRowCount += 1;
      errors.push("CSV " + rowNumber + "行目: 列数がヘッダーと一致しません（" + row.length + "／" + headers.length + "）。");
      continue;
    }

    const values = Object.fromEntries(headers.map((header, columnIndex) => [header, row[columnIndex] ?? ""]));
    const caseId = readValue(values, "case_id");
    const branchId = readValue(values, "planned_branch");

    if (!caseById.has(caseId)) {
      invalidRowCount += 1;
      unknownCaseRowCount += 1;
      errors.push("CSV " + rowNumber + "行目: 未知のcase_idです（" + (caseId || "空欄") + "）。");
      continue;
    }
    if (!(BRANCH_IDS as readonly string[]).includes(branchId)) {
      invalidRowCount += 1;
      errors.push("CSV " + rowNumber + "行目: planned_branchはcontrol／promotionのいずれかにしてください。");
      continue;
    }

    const caseAudit = caseById.get(caseId)!;
    const branch = branchId as typeof BRANCH_IDS[number];
    if (caseAudit[branch]) {
      caseAudit.duplicateBranchCount += 1;
      duplicateBranchCount += 1;
      invalidRowCount += 1;
      errors.push("CSV " + rowNumber + "行目: " + caseId + " の " + branch + " 行が重複しています。");
      continue;
    }

    const branchAudit = createBranchAudit(rowNumber, values, observationColumns);
    caseAudit[branch] = branchAudit;
    acceptedRowCount += 1;
    observationFilledFieldCount += branchAudit.observationFilledFieldCount;
    if (branchAudit.observationFilledFieldCount > 0) rowsWithAnyObservation += 1;

    if (branchAudit.candidateSourceClassification === "実プレイ由来（利用者申告）") {
      actualPlayClaimSeen = true;
    }
    if (branchAudit.classificationIsVerifiedValue.toLowerCase() === "true") {
      verifiedFlagClaimSeen = true;
    }
  }

  let pairedCaseCount = 0;
  let matchedPairCount = 0;
  let missingBranchCount = 0;
  let casesWithMetadataMismatchCount = 0;

  for (const caseAudit of cases) {
    if (!caseAudit.control) missingBranchCount += 1;
    if (!caseAudit.promotion) missingBranchCount += 1;
    if (!caseAudit.control || !caseAudit.promotion) continue;

    pairedCaseCount += 1;
    const mismatches: string[] = [];
    for (const [field, label] of FIXED_PAIR_FIELDS) {
      if (!headers.includes(field)) continue;
      const controlValue = readValue(caseAudit.control.values, field);
      const promotionValue = readValue(caseAudit.promotion.values, field);
      if (controlValue !== promotionValue && (controlValue.length > 0 || promotionValue.length > 0)) {
        mismatches.push(label);
      }
    }
    for (const [field, label] of PAIRED_RUN_FIELDS) {
      if (!headers.includes(field)) continue;
      const controlValue = readValue(caseAudit.control.values, field);
      const promotionValue = readValue(caseAudit.promotion.values, field);
      if (controlValue !== promotionValue && controlValue.length > 0 && promotionValue.length > 0) {
        mismatches.push(label);
      }
    }
    caseAudit.pairFieldMismatches = mismatches;
    if (mismatches.length > 0) {
      casesWithMetadataMismatchCount += 1;
      warnings.push(caseAudit.caseId + ": control／promotion間で条件が異なります（" + mismatches.join("、") + "）。");
    } else {
      matchedPairCount += 1;
    }
  }

  if (actualPlayClaimSeen) {
    warnings.push("「実プレイ由来」はCSVに記録された利用者申告です。ファイルの真正性・出所・独立campaignを検証したものではありません。");
  }
  if (verifiedFlagClaimSeen) {
    warnings.push("classification_is_verified の値は真正性の検証結果として扱いません。");
  }
  warnings.push("ペア成立はcontrol／promotionの行と記載条件が揃ったことだけを示します。実施完了、観測値の正確性、バランス承認を認定しません。");

  return {
    headers,
    csvRowCount: records.length - 1,
    acceptedRowCount,
    invalidRowCount,
    unknownCaseRowCount,
    duplicateBranchCount,
    pairedCaseCount,
    matchedPairCount,
    missingBranchCount,
    casesWithMetadataMismatchCount,
    observationColumns,
    observationFilledFieldCount,
    rowsWithAnyObservation,
    cases,
    errors,
    warnings
  };
}
