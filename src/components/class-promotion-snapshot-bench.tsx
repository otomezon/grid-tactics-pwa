import { useMemo, useState, type ChangeEvent } from "react";
import { CLASS_PROMOTION_TARGETS, getClassDisplayName, getClassPromotionDefinition } from "../content/classes";
import { PROMOTION_ITEM_ID } from "../content/items";
import { getChapterById } from "../content/chapters";
import { performClassChange } from "../application/perform-class-change";
import { createAttackPlan } from "../application/perform-attack";
import { getPromotionCombatComparison } from "../application/get-promotion-combat-comparison";
import { getPromotionCombatSampleSummary, type PromotionCombatSampleSummary } from "../application/get-promotion-combat-sample-summary";
import { getPromotionEnemyPhaseSampleSummary, type PromotionEnemyPhaseSampleSummary } from "../application/get-promotion-enemy-phase-sample-summary";
import { buildPromotionPlaytestMatrix, getAverageClassStatPercentile } from "../application/build-promotion-playtest-matrix";
import { importPromotionPlaytestSaveContent, type ImportedPromotionPlaytestSave } from "../application/import-promotion-playtest-save";
import { getPromotionPlaytestEvidence, type PromotionPlaytestEvidence } from "../application/get-promotion-playtest-evidence";
import { escapeCsvField } from "../application/escape-csv-field";
import { serializeCsvDocument } from "../application/serialize-csv-document";
import { auditPromotionManualPlaytestWorksheet, type PromotionManualPlaytestWorksheetAudit, type PromotionManualPlaytestBranchAudit } from "../application/audit-promotion-manual-playtest-worksheet";
import { getPromotionManualPlaytestObservationComparisons } from "../application/get-promotion-manual-playtest-observation-comparisons";
import { getPromotionManualPlaytestObservationCoverage } from "../application/get-promotion-manual-playtest-observation-coverage";
import { PROMOTION_MANUAL_PLAYTEST_WORKSHEET_HEADERS } from "../application/promotion-manual-playtest-worksheet-schema";
import { getClassPromotionStatPreview } from "../domain/progression/class-change";
import { SAVE_VERSION, type GameStateSnapshot, type GameUnit, type UnitStats } from "../domain/models/game";

const STAT_ROWS: readonly { key: keyof UnitStats; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "strength", label: "力" },
  { key: "magic", label: "魔力" },
  { key: "skill", label: "技" },
  { key: "speed", label: "速さ" },
  { key: "luck", label: "幸運" },
  { key: "defense", label: "守備" },
  { key: "resistance", label: "魔防" }
];

const BASIC_CLASS_IDS = Object.keys(CLASS_PROMOTION_TARGETS);

interface ImportedCandidate {
  key: string;
  fileName: string;
  fingerprint: string;
  /** Canonical save content plus unit ID; the same unit in a renamed file remains one candidate. */
  unitSnapshotIdentity: string;
  snapshot: GameStateSnapshot;
  unit: GameUnit;
  eligible: boolean;
  reasons: string[];
  testSealInjected: boolean;
  sourceSaveVersion: number;
  normalizedSaveVersion: number;
  migrated: boolean;
  exportedAt: string;
}

interface ImportedFileResult {
  candidates: ImportedCandidate[];
  error?: string;
}

type MatrixDataClassification = "unconfirmed" | "actual-play" | "synthetic";

interface PromotionPlaytestClassCoverage {
  candidateCount: number;
  eligibleCandidateCount: number;
  distinctUnitSnapshotCount: number;
  eligibleDistinctUnitSnapshotCount: number;
  campaignHistoryUnitSnapshotCount: number;
  unitBattleTotalsUnitSnapshotCount: number;
}

interface PromotionPlaytestMatrixResult {
  classCoverage: PromotionPlaytestClassCoverage;
  caseId: string;
  classId: string;
  promotedClassId: string;
  profile: string;
  targetPercentile: number;
  candidatePercentile: number | null;
  fileName: string;
  fingerprint: string;
  unitId: string;
  unitName: string;
  candidateStats: UnitStats;
  currentHp: number;
  experience: number;
  equippedWeaponId: string | null;
  promotedStats: UnitStats;
  promotedCurrentHp: number;
  promotedExperience: number;
  promotedEquippedWeaponId: string | null;
  requestedBonuses: Partial<UnitStats>;
  appliedBonuses: Partial<UnitStats>;
  chapterId: string;
  turn: number;
  rngState: number;
  enemyId: string;
  enemyClassId: string;
  enemyCurrentHp: number;
  enemyPosition: string;
  dataClassification: MatrixDataClassification;
  sourceSaveVersion: number;
  normalizedSaveVersion: number;
  migrationApplied: boolean;
  exportedAt: string;
  evidence: PromotionPlaytestEvidence;
  summary: PromotionCombatSampleSummary;
  enemyPhaseSummary: PromotionEnemyPhaseSampleSummary;
}

function getMatrixDataClassificationLabel(value: MatrixDataClassification): string {
  if (value === "actual-play") return "実プレイ由来（利用者申告）";
  if (value === "synthetic") return "合成fixture";
  return "未確認";
}

/** A short deterministic label only; this is not a cryptographic hash. */
/** Canonical, exact JSON identity: ignores object key ordering without relying on a short display hash. */
function serializeSnapshotIdentity(value: unknown): string {
  if (Array.isArray(value)) {
    return "[" + value.map(serializeSnapshotIdentity).join(",") + "]";
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort()
      .map((key) => JSON.stringify(key) + ":" + serializeSnapshotIdentity(record[key]))
      .join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

function snapshotFingerprint(snapshot: GameStateSnapshot): string {
  const source = serializeSnapshotIdentity(snapshot);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function getCandidateEligibility(snapshot: GameStateSnapshot, unit: GameUnit): string[] {
  const reasons: string[] = [];
  if (snapshot.phase !== "player") reasons.push("保存時点が自軍フェイズではありません");
  if (unit.hasMoved) reasons.push("移動済みです");
  if (unit.hasActed) reasons.push("行動済みです");
  if (unit.level < 10) reasons.push("基本職Lv.10未満です");
  if (!Object.hasOwn(CLASS_PROMOTION_TARGETS, unit.classId)) reasons.push("初期7基本職の対象外です");
  if (!unit.inventory.includes(PROMOTION_ITEM_ID) && unit.inventory.length >= 5) {
    reasons.push("所持品が満杯で、試験用の証を追加できません");
  }
  return reasons;
}

function getCandidatesFromSnapshot(
  fileName: string,
  importedSave: ImportedPromotionPlaytestSave
): ImportedFileResult {
  const snapshot = importedSave.snapshot;
  const fingerprint = snapshotFingerprint(snapshot);
  const unitSnapshotIdentity = serializeSnapshotIdentity(snapshot);
  const candidates = snapshot.units
    .filter((unit) =>
      unit.faction === "player" &&
      unit.currentHp > 0 &&
      unit.level >= 10 &&
      BASIC_CLASS_IDS.includes(unit.classId)
    )
    .map((unit): ImportedCandidate => {
      const reasons = getCandidateEligibility(snapshot, unit);
      return {
        key: fingerprint + ":" + unit.id + ":" + fileName,
        fileName,
        fingerprint,
        unitSnapshotIdentity: unitSnapshotIdentity + "\u0000" + JSON.stringify(unit.id),
        snapshot,
        unit,
        eligible: reasons.length === 0,
        reasons,
        testSealInjected: !unit.inventory.includes(PROMOTION_ITEM_ID),
        sourceSaveVersion: importedSave.sourceSaveVersion,
        normalizedSaveVersion: importedSave.normalizedSaveVersion,
        migrated: importedSave.migrated,
        exportedAt: importedSave.exportedAt
      };
    });

  return { candidates };
}

function getAverageClassPercentile(
  candidate: ImportedCandidate,
  classCandidates: readonly ImportedCandidate[]
): number | null {
  return getAverageClassStatPercentile(candidate, classCandidates);
}

function buildPromotionComparison(candidate: ImportedCandidate) {
  const definition = getClassPromotionDefinition(candidate.unit.classId);
  if (!definition || !candidate.eligible) return null;

  // All edits happen on a detached in-memory copy. If the real save has no
  // promotion seal, add one only to this temporary branch to exercise the
  // already-implemented promotion command without inventing a campaign reward.
  const promotionInput: GameStateSnapshot = {
    ...candidate.snapshot,
    units: candidate.snapshot.units.map((unit) => {
      if (unit.id !== candidate.unit.id || !candidate.testSealInjected) return unit;
      return { ...unit, inventory: [...unit.inventory, PROMOTION_ITEM_ID] };
    })
  };

  const execution = performClassChange(promotionInput, candidate.unit.id, definition);
  const statPreview = getClassPromotionStatPreview(candidate.unit.stats, definition);

  return {
    controlUnit: candidate.unit,
    promotedUnit: execution.promotedUnit,
    statPreview,
    appliedBonuses: execution.appliedBonuses,
    promotionState: execution.nextState,
    rngUnchanged: promotionInput.rngState === execution.nextState.rngState
  };
}

function formatUnitLocation(unit: GameUnit): string {
  return (unit.position.x + 1) + "列・" + (unit.position.y + 1) + "行";
}

function getAttackableEnemyTargets(candidate: ImportedCandidate): GameUnit[] {
  const chapter = getChapterById(candidate.snapshot.chapterId);
  if (!chapter || !candidate.eligible) return [];
  return candidate.snapshot.units.filter((unit) => {
    if (unit.faction !== "enemy" || unit.currentHp <= 0) return false;
    try {
      createAttackPlan(candidate.snapshot, chapter.map, candidate.unit.id, unit.id);
      return true;
    } catch {
      return false;
    }
  });
}

function formatDelta(value: number, suffix: string): string {
  return (value > 0 ? "+" : "") + value.toFixed(1) + suffix;
}

function formatRateWithConfidenceInterval(
  rate: number,
  interval: { lower: number; upper: number }
): string {
  return rate.toFixed(1) + "%（95%区間 " + interval.lower.toFixed(1) + "–" + interval.upper.toFixed(1) + "%）";
}

function formatPairedOutcomeBreakdown(summary: {
  controlOnlyCount: number;
  promotionOnlyCount: number;
  bothCount: number;
  neitherCount: number;
  promotionMinusControlPercentagePoints: number;
}): string {
  return "昇格のみ " + summary.promotionOnlyCount +
    "／非昇格のみ " + summary.controlOnlyCount +
    "／両方 " + summary.bothCount +
    "／どちらもなし " + summary.neitherCount +
    "（差 " + formatDelta(summary.promotionMinusControlPercentagePoints, "pt") + "）";
}

function pairedOutcomeCsvValues(summary: {
  controlOnlyCount: number;
  promotionOnlyCount: number;
  bothCount: number;
  neitherCount: number;
  promotionMinusControlPercentagePoints: number;
}): number[] {
  return [
    summary.controlOnlyCount,
    summary.promotionOnlyCount,
    summary.bothCount,
    summary.neitherCount,
    summary.promotionMinusControlPercentagePoints
  ];
}

function getStrikeLabel(kind: "initial" | "counter" | "follow-up"): string {
  if (kind === "initial") return "先制攻撃";
  if (kind === "counter") return "反撃";
  return "追撃";
}

function formatManualObservationDelta(
  value: number | null,
  controlValue: string,
  promotionValue: string
): string {
  if (value !== null) return (value > 0 ? "+" : "") + String(value);
  if (controlValue.length === 0 || promotionValue.length === 0) return "未算出（空欄あり。0とは扱わない）";
  return "数値比較対象外";
}

export function ClassPromotionSnapshotBench() {
  const [candidates, setCandidates] = useState<ImportedCandidate[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [sampleCount, setSampleCount] = useState(100);
  const [matrixCandidateSelections, setMatrixCandidateSelections] = useState<Record<string, string>>({});
  const [matrixTargetSelections, setMatrixTargetSelections] = useState<Record<string, string>>({});
  const [matrixConfirmations, setMatrixConfirmations] = useState<Record<string, boolean>>({});
  const [matrixDataClassifications, setMatrixDataClassifications] = useState<Record<string, MatrixDataClassification>>({});
  const [matrixResults, setMatrixResults] = useState<Record<string, PromotionPlaytestMatrixResult>>({});
  const [matrixRunError, setMatrixRunError] = useState("");
  const [manualWorksheetFileName, setManualWorksheetFileName] = useState("");
  const [manualWorksheetAudit, setManualWorksheetAudit] = useState<PromotionManualPlaytestWorksheetAudit | null>(null);
  const [manualWorksheetImportError, setManualWorksheetImportError] = useState("");
  const [manualWorksheetComparisonField, setManualWorksheetComparisonField] = useState("");
  const manualWorksheetComparisons = useMemo(() =>
    manualWorksheetAudit
      ? getPromotionManualPlaytestObservationComparisons(manualWorksheetAudit)
      : [],
    [manualWorksheetAudit]
  );
  const manualWorksheetComparisonFields = useMemo(
    () => Array.from(new Set(manualWorksheetComparisons.map((entry) => entry.field))),
    [manualWorksheetComparisons]
  );
  const activeManualWorksheetComparisonField = manualWorksheetComparisonFields.includes(manualWorksheetComparisonField)
    ? manualWorksheetComparisonField
    : manualWorksheetComparisonFields[0] ?? "";
  const manualWorksheetObservationCoverage = useMemo(
    () => manualWorksheetAudit
      ? getPromotionManualPlaytestObservationCoverage(manualWorksheetAudit)
      : [],
    [manualWorksheetAudit]
  );

  const selectedCandidate = candidates.find((candidate) => candidate.key === selectedKey) ?? candidates[0];
  const selectedClassId = selectedCandidate?.unit.classId;
  const snapshotInventoryRows = useMemo(() => {
    const grouped = new Map<string, {
      candidate: ImportedCandidate;
      imports: Array<{
        fileName: string;
        sourceSaveVersion: number;
        normalizedSaveVersion: number;
        migrated: boolean;
        exportedAt: string;
        campaignLogTrackingAvailable: boolean;
        unitBattleTotalsTrackingAvailable: boolean;
      }>;
    }>();

    for (const candidate of candidates) {
      const source = {
        fileName: candidate.fileName,
        sourceSaveVersion: candidate.sourceSaveVersion,
        normalizedSaveVersion: candidate.normalizedSaveVersion,
        migrated: candidate.migrated,
        exportedAt: candidate.exportedAt,
        campaignLogTrackingAvailable: candidate.sourceSaveVersion >= 9,
        unitBattleTotalsTrackingAvailable: candidate.sourceSaveVersion >= 3
      };
      const existing = grouped.get(candidate.unitSnapshotIdentity);
      if (existing) existing.imports.push(source);
      else grouped.set(candidate.unitSnapshotIdentity, { candidate, imports: [source] });
    }

    return Array.from(grouped.values());
  }, [candidates]);
  const selectedEvidence = selectedCandidate
    ? getPromotionPlaytestEvidence(selectedCandidate.snapshot, selectedCandidate.unit.id, selectedCandidate.sourceSaveVersion)
    : null;
  const classCandidates = selectedClassId
    ? candidates.filter((candidate) => candidate.unit.classId === selectedClassId)
    : [];
  const comparison = useMemo(
    () => selectedCandidate ? buildPromotionComparison(selectedCandidate) : null,
    [selectedCandidate]
  );
  const combatTargets = useMemo(
    () => selectedCandidate ? getAttackableEnemyTargets(selectedCandidate) : [],
    [selectedCandidate]
  );
  const effectiveTargetId = combatTargets.some((target) => target.id === selectedTargetId)
    ? selectedTargetId
    : combatTargets[0]?.id ?? "";
  const selectedTarget = combatTargets.find((target) => target.id === effectiveTargetId);
  const selectedChapter = selectedCandidate
    ? getChapterById(selectedCandidate.snapshot.chapterId)
    : undefined;
  const combatComparison = useMemo(() => {
    if (!selectedCandidate || !comparison || !selectedTarget || !selectedChapter) return null;
    return getPromotionCombatComparison(
      selectedCandidate.snapshot,
      comparison.promotionState,
      selectedChapter.map,
      selectedCandidate.unit.id,
      selectedTarget.id
    );
  }, [selectedCandidate, comparison, selectedTarget, selectedChapter]);
  const combatSamples = useMemo(() => {
    if (!selectedCandidate || !comparison || !selectedTarget || !selectedChapter) return null;
    return getPromotionCombatSampleSummary(
      selectedCandidate.snapshot,
      comparison.promotionState,
      selectedChapter.map,
      selectedCandidate.unit.id,
      selectedTarget.id,
      sampleCount
    );
  }, [selectedCandidate, comparison, selectedTarget, selectedChapter, sampleCount]);

  const matrixSlots = useMemo(
    () => buildPromotionPlaytestMatrix(candidates),
    [candidates]
  );
  const matrixCoverageRows = useMemo(() => matrixSlots
    .filter((slot) => slot.profile === "low")
    .map((slot) => {
      const eligibleCandidates = slot.candidatePool.filter((candidate) => candidate.eligible);
      const campaignHistorySnapshots = new Set<string>();
      const unitBattleTotalsSnapshots = new Set<string>();

      for (const candidate of eligibleCandidates) {
        const evidence = getPromotionPlaytestEvidence(
          candidate.snapshot,
          candidate.unit.id,
          candidate.sourceSaveVersion
        );
        if (evidence.campaignLogTrackingAvailable && evidence.campaignLogEntries > 0) {
          campaignHistorySnapshots.add(candidate.unitSnapshotIdentity);
        }
        if (evidence.unitBattleTotalsTrackingAvailable && evidence.selectedUnitBattleTotals) {
          unitBattleTotalsSnapshots.add(candidate.unitSnapshotIdentity);
        }
      }

      return {
        classId: slot.classId,
        candidateCount: slot.candidateCount,
        eligibleCandidateCount: slot.eligibleCandidateCount,
        distinctUnitSnapshotCount: slot.distinctUnitSnapshotCount,
        eligibleDistinctUnitSnapshotCount: slot.eligibleDistinctUnitSnapshotCount,
        campaignHistoryUnitSnapshotCount: campaignHistorySnapshots.size,
        unitBattleTotalsUnitSnapshotCount: unitBattleTotalsSnapshots.size
      };
    }), [matrixSlots]);
  const matrixCoverageByClass = new Map(matrixCoverageRows.map((row) => [row.classId, row] as const));
  const matrixRows = useMemo(() => {
    const selectedCandidates = matrixSlots.map((slot) => {
      const selectedKey = matrixCandidateSelections[slot.id];
      const candidate = slot.candidatePool.find((entry) => entry.key === selectedKey) ??
        slot.suggestedCandidate;
      return { slot, candidate };
    });
    const usageCounts = new Map<string, number>();
    for (const entry of selectedCandidates) {
      if (!entry.candidate) continue;
      const usageKey = entry.slot.classId + ":" + entry.candidate.unitSnapshotIdentity;
      usageCounts.set(usageKey, (usageCounts.get(usageKey) ?? 0) + 1);
    }

    return selectedCandidates.map(({ slot, candidate }) => {
      const targets = candidate ? getAttackableEnemyTargets(candidate) : [];
      const chosenTargetId = matrixTargetSelections[slot.id];
      const target = targets.find((enemy) => enemy.id === chosenTargetId) ?? targets[0];
      const usageKey = candidate ? slot.classId + ":" + candidate.unitSnapshotIdentity : "";
      const duplicateCandidate = candidate !== null && (usageCounts.get(usageKey) ?? 0) > 1;
      const confirmed = matrixConfirmations[slot.id] === true;
      const eligible = candidate?.eligible === true;
      const ready =
        slot.eligibleDistinctUnitSnapshotCount >= 3 &&
        candidate !== null &&
        !duplicateCandidate &&
        eligible &&
        target !== undefined &&
        confirmed;
      let status = "実行可能";
      if (slot.eligibleDistinctUnitSnapshotCount < 3) status = "異なる有効snapshot不足（" + slot.eligibleDistinctUnitSnapshotCount + "/3）";
      else if (!candidate) status = "候補未選択";
      else if (duplicateCandidate) status = "同一snapshot内容が複数profileに重複";
      else if (!eligible) status = candidate.reasons.join("／");
      else if (!target) status = "射程内の生存敵なし";
      else if (!confirmed) status = "候補・敵条件の確認待ち";
      return {
        ...slot,
        candidate,
        candidatePercentile: candidate
          ? getAverageClassStatPercentile(candidate, slot.candidatePool)
          : null,
        targets,
        target,
        duplicateCandidate,
        confirmed,
        dataClassification: matrixDataClassifications[slot.id] ?? "unconfirmed",
        ready,
        status
      };
    });
  }, [
    matrixSlots,
    matrixCandidateSelections,
    matrixTargetSelections,
    matrixConfirmations,
    matrixDataClassifications
  ]);
  const readyMatrixCount = matrixRows.filter((row) => row.ready).length;
  const completedMatrixCount = Object.keys(matrixResults).length;

  function handleSampleCountChange(nextCount: number) {
    setSampleCount(nextCount);
    setMatrixResults({});
    setMatrixRunError("");
  }

  function handleRunPromotionPlaytestMatrix() {
    const nextResults: Record<string, PromotionPlaytestMatrixResult> = {};
    setMatrixRunError("");

    try {
      for (const row of matrixRows) {
        if (!row.ready || !row.candidate || !row.target) continue;
        const chapter = getChapterById(row.candidate.snapshot.chapterId);
        const promotion = buildPromotionComparison(row.candidate);
        if (!chapter || !promotion) {
          throw new Error(row.id + ": 昇格commandまたは章マップを解決できません。");
        }

        const summary = getPromotionCombatSampleSummary(
          row.candidate.snapshot,
          promotion.promotionState,
          chapter.map,
          row.candidate.unit.id,
          row.target.id,
          sampleCount
        );
        const enemyPhaseSummary = getPromotionEnemyPhaseSampleSummary(
          row.candidate.snapshot,
          promotion.promotionState,
          chapter.map,
          row.candidate.unit.id,
          sampleCount
        );
        const classCoverage = matrixCoverageByClass.get(row.classId);
        if (!classCoverage) throw new Error(row.classId + ": 候補snapshotの集計を解決できません。");
        const requestedBonuses = promotion.statPreview.changes.reduce<Partial<UnitStats>>(
          (values, change) => ({ ...values, [change.key]: change.requestedBonus }),
          {}
        );
        nextResults[row.id] = {
          caseId: row.id,
          classId: row.classId,
          promotedClassId: row.promotedClassId,
          profile: row.profile,
          targetPercentile: row.targetPercentile,
          candidatePercentile: row.candidatePercentile,
          fileName: row.candidate.fileName,
          fingerprint: row.candidate.fingerprint,
          unitId: row.candidate.unit.id,
          unitName: row.candidate.unit.name,
          candidateStats: row.candidate.unit.stats,
          currentHp: row.candidate.unit.currentHp,
          experience: row.candidate.unit.experience,
          equippedWeaponId: row.candidate.unit.equippedWeaponId,
          promotedStats: promotion.promotedUnit.stats,
          promotedCurrentHp: promotion.promotedUnit.currentHp,
          promotedExperience: promotion.promotedUnit.experience,
          promotedEquippedWeaponId: promotion.promotedUnit.equippedWeaponId,
          requestedBonuses,
          appliedBonuses: promotion.appliedBonuses,
          chapterId: row.candidate.snapshot.chapterId,
          turn: row.candidate.snapshot.turn,
          rngState: row.candidate.snapshot.rngState,
          enemyId: row.target.id,
          enemyClassId: row.target.classId,
          enemyCurrentHp: row.target.currentHp,
          enemyPosition: formatUnitLocation(row.target),
          dataClassification: row.dataClassification,
          sourceSaveVersion: row.candidate.sourceSaveVersion,
          normalizedSaveVersion: row.candidate.normalizedSaveVersion,
          migrationApplied: row.candidate.migrated,
          exportedAt: row.candidate.exportedAt,
          classCoverage,
          evidence: getPromotionPlaytestEvidence(
            row.candidate.snapshot,
            row.candidate.unit.id,
            row.candidate.sourceSaveVersion
          ),
          summary,
          enemyPhaseSummary
        };
      }
      setMatrixResults(nextResults);
      if (Object.keys(nextResults).length !== 21) {
        setMatrixRunError("21ケースすべてを完了できませんでした。条件と各候補を確認してください。");
      }
    } catch (error) {
      setMatrixResults(nextResults);
      setMatrixRunError(error instanceof Error ? error.message : "21ケースの試行に失敗しました。");
    }
  }

  function handleDownloadPromotionPlaytestMatrix() {
    const results = matrixSlots
      .map((slot) => matrixResults[slot.id])
      .filter((entry): entry is PromotionPlaytestMatrixResult => entry !== undefined);
    if (results.length !== 21) return;

    const headers = [
      "case_id", "basic_class", "promoted_class", "profile", "target_percentile",
      "candidate_percentile", "source_file", "source_save_version", "normalized_save_version",
      "migration_applied", "exported_at",
      "class_candidate_count", "class_eligible_candidate_count", "class_distinct_unit_snapshot_count",
      "class_eligible_distinct_unit_snapshot_count", "class_campaign_history_unit_snapshot_count",
      "class_unit_battle_totals_unit_snapshot_count",
      "campaign_log_tracking_available", "unit_battle_totals_tracking_available",
      "campaign_log_entries", "campaign_log_retention_limit", "campaign_log_at_retention_limit",
      "campaign_log_first_sequence", "campaign_log_last_sequence", "campaign_log_sequence_gap_count",
      "campaign_chapter_count", "campaign_player_action_entries",
      "campaign_player_attack_entries", "campaign_enemy_action_entries", "campaign_chapter_result_entries",
      "selected_unit_action_entries", "selected_unit_attack_entries", "selected_unit_targeted_enemy_action_entries",
      "selected_unit_attack_strikes", "selected_unit_record_attacks", "selected_unit_record_strikes",
      "selected_unit_record_hits", "selected_unit_record_damage_dealt",
      "selected_unit_record_enemies_defeated", "selected_unit_record_experience_awarded",
      "snapshot_fingerprint", "unit_id", "unit_name",
      "control_hp", "control_strength", "control_magic", "control_skill", "control_speed", "control_luck", "control_defense", "control_resistance",
      "control_current_hp", "control_experience", "movement", "move", "weapon_types", "control_equipped_weapon",
      "promotion_hp", "promotion_strength", "promotion_magic", "promotion_skill", "promotion_speed", "promotion_luck", "promotion_defense", "promotion_resistance",
      "promotion_current_hp", "promotion_experience", "promotion_equipped_weapon",
      "requested_hp_bonus", "requested_strength_bonus", "requested_magic_bonus", "requested_skill_bonus", "requested_speed_bonus", "requested_luck_bonus", "requested_defense_bonus", "requested_resistance_bonus",
      "applied_hp_bonus", "applied_strength_bonus", "applied_magic_bonus", "applied_skill_bonus", "applied_speed_bonus", "applied_luck_bonus", "applied_defense_bonus", "applied_resistance_bonus",
      "chapter_id", "turn", "starting_rng", "enemy_id", "enemy_class", "enemy_hp", "enemy_position",
      "sample_count", "first_seed", "last_seed", "data_classification",
      "control_hit_rate", "promotion_hit_rate", "hit_rate_delta_pt",
      "control_critical_rate_on_hit", "promotion_critical_rate_on_hit",
      "control_avg_damage_per_battle", "promotion_avg_damage_per_battle",
      "control_enemy_defeat_rate", "promotion_enemy_defeat_rate",
      "control_enemy_defeat_rate_95ci_lower", "control_enemy_defeat_rate_95ci_upper",
      "promotion_enemy_defeat_rate_95ci_lower", "promotion_enemy_defeat_rate_95ci_upper",
      "combat_enemy_defeat_control_only", "combat_enemy_defeat_promotion_only", "combat_enemy_defeat_both", "combat_enemy_defeat_neither", "combat_enemy_defeat_promotion_minus_control_pt",
      "control_avg_counter_damage", "promotion_avg_counter_damage",
      "control_attacker_survival_rate", "promotion_attacker_survival_rate",
      "control_attacker_survival_rate_95ci_lower", "control_attacker_survival_rate_95ci_upper",
      "promotion_attacker_survival_rate_95ci_lower", "promotion_attacker_survival_rate_95ci_upper",
      "combat_attacker_survival_control_only", "combat_attacker_survival_promotion_only", "combat_attacker_survival_both", "combat_attacker_survival_neither", "combat_attacker_survival_promotion_minus_control_pt",
      "control_avg_attacker_hp", "promotion_avg_attacker_hp",
      "control_enemy_phase_actions", "promotion_enemy_phase_actions",
      "control_enemy_phase_attack_actions", "promotion_enemy_phase_attack_actions",
      "control_selected_unit_targeted_phase_rate", "promotion_selected_unit_targeted_phase_rate",
      "control_selected_unit_targeted_phase_rate_95ci_lower", "control_selected_unit_targeted_phase_rate_95ci_upper",
      "promotion_selected_unit_targeted_phase_rate_95ci_lower", "promotion_selected_unit_targeted_phase_rate_95ci_upper",
      "enemy_phase_targeted_control_only", "enemy_phase_targeted_promotion_only", "enemy_phase_targeted_both", "enemy_phase_targeted_neither", "enemy_phase_targeted_promotion_minus_control_pt",
      "control_selected_unit_avg_damage", "promotion_selected_unit_avg_damage",
      "control_selected_unit_survival_rate", "promotion_selected_unit_survival_rate",
      "control_selected_unit_survival_rate_95ci_lower", "control_selected_unit_survival_rate_95ci_upper",
      "promotion_selected_unit_survival_rate_95ci_lower", "promotion_selected_unit_survival_rate_95ci_upper",
      "enemy_phase_selected_survival_control_only", "enemy_phase_selected_survival_promotion_only", "enemy_phase_selected_survival_both", "enemy_phase_selected_survival_neither", "enemy_phase_selected_survival_promotion_minus_control_pt",
      "control_party_avg_damage", "promotion_party_avg_damage",
      "control_battle_defeat_rate", "promotion_battle_defeat_rate",
      "control_battle_defeat_rate_95ci_lower", "control_battle_defeat_rate_95ci_upper",
      "promotion_battle_defeat_rate_95ci_lower", "promotion_battle_defeat_rate_95ci_upper",
      "enemy_phase_battle_defeat_control_only", "enemy_phase_battle_defeat_promotion_only", "enemy_phase_battle_defeat_both", "enemy_phase_battle_defeat_neither", "enemy_phase_battle_defeat_promotion_minus_control_pt",
      "control_party_wipe_rate", "promotion_party_wipe_rate",
      "control_party_wipe_rate_95ci_lower", "control_party_wipe_rate_95ci_upper",
      "promotion_party_wipe_rate_95ci_lower", "promotion_party_wipe_rate_95ci_upper",
      "enemy_phase_party_wipe_control_only", "enemy_phase_party_wipe_promotion_only", "enemy_phase_party_wipe_both", "enemy_phase_party_wipe_neither", "enemy_phase_party_wipe_promotion_minus_control_pt",
      "control_player_phase_advance_rate", "promotion_player_phase_advance_rate",
      "control_player_phase_advance_rate_95ci_lower", "control_player_phase_advance_rate_95ci_upper",
      "promotion_player_phase_advance_rate_95ci_lower", "promotion_player_phase_advance_rate_95ci_upper",
      "enemy_phase_player_phase_advance_control_only", "enemy_phase_player_phase_advance_promotion_only",
      "enemy_phase_player_phase_advance_both", "enemy_phase_player_phase_advance_neither",
      "enemy_phase_player_phase_advance_promotion_minus_control_pt"
    ];
    const rows = results.map((entry) => {
      const candidate = matrixRows.find((row) => row.id === entry.caseId)?.candidate;
      const stats = entry.candidateStats;
      const control = entry.summary.control;
      const promotion = entry.summary.promotion;
      return [
        entry.caseId, entry.classId, entry.promotedClassId, entry.profile,
        entry.targetPercentile, entry.candidatePercentile, entry.fileName,
        entry.sourceSaveVersion, entry.normalizedSaveVersion, entry.migrationApplied ? "true" : "false",
        entry.exportedAt,
        entry.classCoverage.candidateCount,
        entry.classCoverage.eligibleCandidateCount,
        entry.classCoverage.distinctUnitSnapshotCount,
        entry.classCoverage.eligibleDistinctUnitSnapshotCount,
        entry.classCoverage.campaignHistoryUnitSnapshotCount,
        entry.classCoverage.unitBattleTotalsUnitSnapshotCount,
        entry.evidence.campaignLogTrackingAvailable ? "true" : "false",
        entry.evidence.unitBattleTotalsTrackingAvailable ? "true" : "false",
        entry.evidence.campaignLogEntries, entry.evidence.campaignLogRetentionLimit,
        entry.evidence.campaignLogAtRetentionLimit ? "true" : "false",
        entry.evidence.campaignLogFirstSequence ?? "", entry.evidence.campaignLogLastSequence ?? "",
        entry.evidence.campaignLogSequenceGapCount, entry.evidence.campaignChapterCount,
        entry.evidence.playerActionEntries, entry.evidence.playerAttackEntries,
        entry.evidence.enemyActionEntries, entry.evidence.chapterResultEntries,
        entry.evidence.selectedUnitActionEntries, entry.evidence.selectedUnitAttackEntries,
        entry.evidence.selectedUnitTargetedEnemyActionEntries, entry.evidence.selectedUnitAttackStrikes,
        entry.evidence.selectedUnitBattleTotals?.attacks ?? "",
        entry.evidence.selectedUnitBattleTotals?.strikes ?? "",
        entry.evidence.selectedUnitBattleTotals?.hits ?? "",
        entry.evidence.selectedUnitBattleTotals?.damageDealt ?? "",
        entry.evidence.selectedUnitBattleTotals?.enemiesDefeated ?? "",
        entry.evidence.selectedUnitBattleTotals?.experienceAwarded ?? "",
        entry.fingerprint, entry.unitId, entry.unitName,
        stats.hp, stats.strength, stats.magic, stats.skill, stats.speed, stats.luck, stats.defense, stats.resistance,
        entry.currentHp, entry.experience, candidate?.unit.movementType ?? "", candidate?.unit.move ?? "",
        candidate?.unit.usableWeaponTypes.join("|") ?? "", entry.equippedWeaponId ?? "",
        entry.promotedStats.hp, entry.promotedStats.strength, entry.promotedStats.magic, entry.promotedStats.skill,
        entry.promotedStats.speed, entry.promotedStats.luck, entry.promotedStats.defense, entry.promotedStats.resistance,
        entry.promotedCurrentHp, entry.promotedExperience, entry.promotedEquippedWeaponId ?? "",
        entry.requestedBonuses.hp ?? 0, entry.requestedBonuses.strength ?? 0, entry.requestedBonuses.magic ?? 0,
        entry.requestedBonuses.skill ?? 0, entry.requestedBonuses.speed ?? 0, entry.requestedBonuses.luck ?? 0,
        entry.requestedBonuses.defense ?? 0, entry.requestedBonuses.resistance ?? 0,
        entry.appliedBonuses.hp ?? 0, entry.appliedBonuses.strength ?? 0, entry.appliedBonuses.magic ?? 0,
        entry.appliedBonuses.skill ?? 0, entry.appliedBonuses.speed ?? 0, entry.appliedBonuses.luck ?? 0,
        entry.appliedBonuses.defense ?? 0, entry.appliedBonuses.resistance ?? 0,
        entry.chapterId, entry.turn, entry.rngState, entry.enemyId, entry.enemyClassId,
        entry.enemyCurrentHp, entry.enemyPosition, entry.summary.sampleCount,
        entry.summary.firstSeed, entry.summary.lastSeed,
        getMatrixDataClassificationLabel(entry.dataClassification),
        control.attackHitRate, promotion.attackHitRate,
        Number((promotion.attackHitRate - control.attackHitRate).toFixed(1)),
        control.criticalRateOnHit, promotion.criticalRateOnHit,
        control.averageAttackDamagePerBattle, promotion.averageAttackDamagePerBattle,
        control.enemyDefeatRate, promotion.enemyDefeatRate,
        control.enemyDefeatRateInterval95.lower, control.enemyDefeatRateInterval95.upper,
        promotion.enemyDefeatRateInterval95.lower, promotion.enemyDefeatRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.summary.pairedOutcomes.enemyDefeat),
        control.averageCounterDamagePerBattle, promotion.averageCounterDamagePerBattle,
        control.attackerSurvivalRate, promotion.attackerSurvivalRate,
        control.attackerSurvivalRateInterval95.lower, control.attackerSurvivalRateInterval95.upper,
        promotion.attackerSurvivalRateInterval95.lower, promotion.attackerSurvivalRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.summary.pairedOutcomes.attackerSurvival),
        control.averageAttackerHpRemaining, promotion.averageAttackerHpRemaining,
        entry.enemyPhaseSummary.control.totalEnemyActions,
        entry.enemyPhaseSummary.promotion.totalEnemyActions,
        entry.enemyPhaseSummary.control.enemyAttackActions,
        entry.enemyPhaseSummary.promotion.enemyAttackActions,
        entry.enemyPhaseSummary.control.selectedUnitTargetedPhaseRate,
        entry.enemyPhaseSummary.promotion.selectedUnitTargetedPhaseRate,
        entry.enemyPhaseSummary.control.selectedUnitTargetedPhaseRateInterval95.lower,
        entry.enemyPhaseSummary.control.selectedUnitTargetedPhaseRateInterval95.upper,
        entry.enemyPhaseSummary.promotion.selectedUnitTargetedPhaseRateInterval95.lower,
        entry.enemyPhaseSummary.promotion.selectedUnitTargetedPhaseRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.enemyPhaseSummary.pairedOutcomes.selectedUnitTargeted),
        entry.enemyPhaseSummary.control.selectedUnitAverageDamagePerPhase,
        entry.enemyPhaseSummary.promotion.selectedUnitAverageDamagePerPhase,
        entry.enemyPhaseSummary.control.selectedUnitSurvivalRate,
        entry.enemyPhaseSummary.promotion.selectedUnitSurvivalRate,
        entry.enemyPhaseSummary.control.selectedUnitSurvivalRateInterval95.lower,
        entry.enemyPhaseSummary.control.selectedUnitSurvivalRateInterval95.upper,
        entry.enemyPhaseSummary.promotion.selectedUnitSurvivalRateInterval95.lower,
        entry.enemyPhaseSummary.promotion.selectedUnitSurvivalRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.enemyPhaseSummary.pairedOutcomes.selectedUnitSurvived),
        entry.enemyPhaseSummary.control.averageTotalPlayerDamagePerPhase,
        entry.enemyPhaseSummary.promotion.averageTotalPlayerDamagePerPhase,
        entry.enemyPhaseSummary.control.battleDefeatRate,
        entry.enemyPhaseSummary.promotion.battleDefeatRate,
        entry.enemyPhaseSummary.control.battleDefeatRateInterval95.lower,
        entry.enemyPhaseSummary.control.battleDefeatRateInterval95.upper,
        entry.enemyPhaseSummary.promotion.battleDefeatRateInterval95.lower,
        entry.enemyPhaseSummary.promotion.battleDefeatRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.enemyPhaseSummary.pairedOutcomes.battleDefeat),
        entry.enemyPhaseSummary.control.partyWipeRate,
        entry.enemyPhaseSummary.promotion.partyWipeRate,
        entry.enemyPhaseSummary.control.partyWipeRateInterval95.lower,
        entry.enemyPhaseSummary.control.partyWipeRateInterval95.upper,
        entry.enemyPhaseSummary.promotion.partyWipeRateInterval95.lower,
        entry.enemyPhaseSummary.promotion.partyWipeRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.enemyPhaseSummary.pairedOutcomes.partyWipe),
        entry.enemyPhaseSummary.control.playerPhaseAdvanceRate,
        entry.enemyPhaseSummary.promotion.playerPhaseAdvanceRate,
        entry.enemyPhaseSummary.control.playerPhaseAdvanceRateInterval95.lower,
        entry.enemyPhaseSummary.control.playerPhaseAdvanceRateInterval95.upper,
        entry.enemyPhaseSummary.promotion.playerPhaseAdvanceRateInterval95.lower,
        entry.enemyPhaseSummary.promotion.playerPhaseAdvanceRateInterval95.upper,
        ...pairedOutcomeCsvValues(entry.enemyPhaseSummary.pairedOutcomes.playerPhaseAdvanced)
      ].map(escapeCsvField).join(",");
    });
    const csv = "\ufeff" + [headers.map(escapeCsvField).join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-promotion-playtest-matrix.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPromotionManualPlaytestWorksheet() {
    if (readyMatrixCount !== 21 || matrixRows.length !== 21) return;
    if (matrixRows.some((row) => !row.ready || !row.candidate || !row.target)) return;

    const headers = PROMOTION_MANUAL_PLAYTEST_WORKSHEET_HEADERS;

    const rows: Array<Record<string, string | number | boolean>> = matrixRows.flatMap((row) => {
      const candidate = row.candidate!;
      const target = row.target!;
      const unit = candidate.unit;
      const values: Record<string, string | number | boolean> = {
        case_id: row.id,
        manual_record_status: "未記録",
        basic_class: row.classId,
        promoted_class: row.promotedClassId,
        profile: row.profile,
        target_percentile: row.targetPercentile,
        candidate_source_classification: getMatrixDataClassificationLabel(row.dataClassification),
        classification_is_verified: "false",
        snapshot_fingerprint: candidate.fingerprint,
        source_file: candidate.fileName,
        source_save_version: candidate.sourceSaveVersion,
        normalized_save_version: candidate.normalizedSaveVersion,
        migration_applied: candidate.migrated,
        exported_at: candidate.exportedAt,
        chapter_id: candidate.snapshot.chapterId,
        snapshot_turn: candidate.snapshot.turn,
        snapshot_phase: candidate.snapshot.phase,
        snapshot_rng_state: candidate.snapshot.rngState,
        unit_id: unit.id,
        unit_name: unit.name,
        candidate_position_x: unit.position.x,
        candidate_position_y: unit.position.y,
        pre_level: unit.level,
        pre_experience: unit.experience,
        pre_current_hp: unit.currentHp,
        pre_max_hp: unit.stats.hp,
        pre_hp: unit.stats.hp,
        pre_strength: unit.stats.strength,
        pre_magic: unit.stats.magic,
        pre_skill: unit.stats.skill,
        pre_speed: unit.stats.speed,
        pre_luck: unit.stats.luck,
        pre_defense: unit.stats.defense,
        pre_resistance: unit.stats.resistance,
        pre_equipped_weapon_id: unit.equippedWeaponId ?? "",
        movement_type: unit.movementType,
        move: unit.move,
        usable_weapon_types_json: JSON.stringify(unit.usableWeaponTypes),
        enemy_id: target.id,
        enemy_name: target.name,
        enemy_class: target.classId,
        enemy_hp: target.currentHp,
        enemy_position: formatUnitLocation(target)
      };
      return (["control", "promotion"] as const).map((plannedBranch): Record<string, string | number | boolean> => ({
        ...values,
        planned_branch: plannedBranch
      }));
    });
    const csv = serializeCsvDocument(headers, rows.map((row) =>
      headers.map((header) => row[header] ?? "")
    ));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-promotion-manual-playtest-worksheet.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadPromotionSnapshotInventory() {
    if (snapshotInventoryRows.length === 0) return;

    const headers = [
      "source_file_names_json", "source_imports_json", "import_copy_count", "snapshot_fingerprint",
      "source_save_versions_json", "normalized_save_versions_json", "migration_applied_values_json", "exported_at_values_json",
      "chapter_id", "turn", "phase", "rng_state",
      "unit_id", "unit_name", "basic_class", "level", "experience", "current_hp", "max_hp",
      "position_x", "position_y", "eligible", "eligibility_reasons", "promotion_seal_added_to_comparison_copy",
      "stat_hp", "stat_strength", "stat_magic", "stat_skill", "stat_speed", "stat_luck", "stat_defense", "stat_resistance",
      "movement_type", "move", "usable_weapon_types_json", "equipped_weapon_id", "inventory_json",
      "campaign_log_tracking_available_for_all_imports", "campaign_log_tracking_available_for_any_import",
      "campaign_log_entries", "campaign_log_retention_limit", "campaign_log_at_retention_limit",
      "campaign_log_first_sequence", "campaign_log_last_sequence", "campaign_log_sequence_gap_count",
      "campaign_chapter_count",
      "campaign_player_action_entries", "campaign_player_attack_entries", "campaign_enemy_action_entries",
      "campaign_chapter_result_entries", "selected_unit_action_entries", "selected_unit_attack_entries",
      "selected_unit_targeted_enemy_action_entries", "selected_unit_attack_strikes",
      "unit_battle_totals_tracking_available_for_all_imports",
      "unit_battle_totals_tracking_available_for_any_import", "selected_unit_battle_totals_present",
      "selected_unit_record_attacks", "selected_unit_record_strikes", "selected_unit_record_hits",
      "selected_unit_record_damage_dealt", "selected_unit_record_enemies_defeated",
      "selected_unit_record_experience_awarded"
    ];
    const rows = snapshotInventoryRows.map(({ candidate, imports }) => {
      const evidence = getPromotionPlaytestEvidence(
        candidate.snapshot,
        candidate.unit.id,
        candidate.sourceSaveVersion
      );
      const totals = evidence.selectedUnitBattleTotals;
      const sourceFileNames = Array.from(new Set(imports.map((entry) => entry.fileName)));
      const exportedAtValues = Array.from(new Set(imports.map((entry) => entry.exportedAt)));

      return [
        JSON.stringify(sourceFileNames), JSON.stringify(imports), imports.length, candidate.fingerprint,
        JSON.stringify(Array.from(new Set(imports.map((entry) => entry.sourceSaveVersion)))),
        JSON.stringify(Array.from(new Set(imports.map((entry) => entry.normalizedSaveVersion)))),
        JSON.stringify(Array.from(new Set(imports.map((entry) => entry.migrated)))),
        JSON.stringify(exportedAtValues), candidate.snapshot.chapterId, candidate.snapshot.turn,
        candidate.snapshot.phase, candidate.snapshot.rngState,
        candidate.unit.id, candidate.unit.name, candidate.unit.classId, candidate.unit.level,
        candidate.unit.experience, candidate.unit.currentHp, candidate.unit.stats.hp,
        candidate.unit.position.x, candidate.unit.position.y, candidate.eligible,
        candidate.reasons.join("／"), candidate.testSealInjected,
        candidate.unit.stats.hp, candidate.unit.stats.strength, candidate.unit.stats.magic,
        candidate.unit.stats.skill, candidate.unit.stats.speed, candidate.unit.stats.luck,
        candidate.unit.stats.defense, candidate.unit.stats.resistance,
        candidate.unit.movementType, candidate.unit.move, JSON.stringify(candidate.unit.usableWeaponTypes),
        candidate.unit.equippedWeaponId, JSON.stringify(candidate.unit.inventory),
        imports.every((entry) => entry.campaignLogTrackingAvailable),
        imports.some((entry) => entry.campaignLogTrackingAvailable),
        evidence.campaignLogEntries, evidence.campaignLogRetentionLimit,
        evidence.campaignLogAtRetentionLimit, evidence.campaignLogFirstSequence ?? "",
        evidence.campaignLogLastSequence ?? "", evidence.campaignLogSequenceGapCount,
        evidence.campaignChapterCount,
        evidence.playerActionEntries, evidence.playerAttackEntries, evidence.enemyActionEntries,
        evidence.chapterResultEntries, evidence.selectedUnitActionEntries,
        evidence.selectedUnitAttackEntries, evidence.selectedUnitTargetedEnemyActionEntries,
        evidence.selectedUnitAttackStrikes,
        imports.every((entry) => entry.unitBattleTotalsTrackingAvailable),
        imports.some((entry) => entry.unitBattleTotalsTrackingAvailable), totals !== null, totals?.attacks ?? "", totals?.strikes ?? "", totals?.hits ?? "",
        totals?.damageDealt ?? "", totals?.enemiesDefeated ?? "", totals?.experienceAwarded ?? ""
      ];
    });
    const csv = serializeCsvDocument(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-promotion-snapshot-inventory.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const imported: ImportedCandidate[] = [];
    const nextErrors: string[] = [];

    for (const file of files) {
      try {
        const content = await file.text();
        const importedSave = importPromotionPlaytestSaveContent(content);
        const result = getCandidatesFromSnapshot(file.name, importedSave);
        if (result.error) {
          nextErrors.push(file.name + ": " + result.error);
        } else if (result.candidates.length === 0) {
          nextErrors.push(file.name + ": 生存中で昇格対象の基本職Lv.10以上ユニットが見つかりません。");
        } else {
          imported.push(...result.candidates);
        }
      } catch (error) {
        nextErrors.push(
          file.name + ": " + (error instanceof Error ? error.message : "読み込みに失敗しました。")
        );
      }
    }

    setCandidates((current) => {
      const next = [...current];
      for (const candidate of imported) {
        if (!next.some((existing) => existing.key === candidate.key)) next.push(candidate);
      }
      return next;
    });
    setErrors(nextErrors);
    if (imported.length > 0) {
      setSelectedKey(imported[0]!.key);
      setMatrixCandidateSelections({});
      setMatrixTargetSelections({});
      setMatrixConfirmations({});
      setMatrixDataClassifications({});
      setMatrixResults({});
      setMatrixRunError("");
    }
    event.target.value = "";
  }

  async function handleManualWorksheetFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setManualWorksheetFileName(file.name);
    setManualWorksheetAudit(null);
    setManualWorksheetImportError("");
    setManualWorksheetComparisonField("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("CSVは5MB以下のファイルを選択してください。");
      setManualWorksheetAudit(auditPromotionManualPlaytestWorksheet(await file.text()));
    } catch (error) {
      setManualWorksheetImportError(error instanceof Error ? error.message : "CSVを読み込めませんでした。");
    }
    event.target.value = "";
  }

  function clearManualWorksheetAudit() {
    setManualWorksheetFileName("");
    setManualWorksheetAudit(null);
    setManualWorksheetImportError("");
    setManualWorksheetComparisonField("");
  }

  function handleDownloadManualWorksheetObservationCoverage() {
    if (!manualWorksheetAudit || manualWorksheetObservationCoverage.length === 0) return;

    const headers = [
      "observation_field",
      "expected_case_count",
      "paired_case_count",
      "missing_branch_case_count",
      "both_values_present_case_count",
      "control_only_value_case_count",
      "promotion_only_value_case_count",
      "both_values_empty_case_count",
      "numeric_delta_available_pair_count",
      "both_values_without_numeric_delta_pair_count",
      "metadata_mismatch_case_count"
    ];
    const rows = manualWorksheetObservationCoverage.map((entry) => [
      entry.field,
      entry.expectedCaseCount,
      entry.pairedCaseCount,
      entry.missingBranchCaseCount,
      entry.bothValuesPresentCaseCount,
      entry.controlOnlyValueCaseCount,
      entry.promotionOnlyValueCaseCount,
      entry.bothValuesEmptyCaseCount,
      entry.numericDeltaAvailablePairCount,
      entry.bothValuesWithoutNumericDeltaPairCount,
      entry.metadataMismatchCaseCount
    ]);
    const csv = serializeCsvDocument(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-promotion-manual-playtest-observation-coverage.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function handleDownloadManualWorksheetComparisons() {
    if (!manualWorksheetAudit || manualWorksheetComparisons.length === 0) return;

    const headers = [
      "case_id",
      "pair_condition_status",
      "pair_condition_mismatches",
      "control_csv_row",
      "promotion_csv_row",
      "observation_field",
      "control_value",
      "promotion_value",
      "promotion_minus_control",
      "numeric_delta_available"
    ];
    const rows = manualWorksheetComparisons.map((comparison) => [
      comparison.caseId,
      comparison.pairConditionsMatch ? "記載上の条件一致" : "記載上の条件不一致",
      comparison.pairFieldMismatches.join("／"),
      comparison.controlRowNumber,
      comparison.promotionRowNumber,
      comparison.field,
      comparison.controlValue,
      comparison.promotionValue,
      comparison.numericDelta,
      comparison.numericDelta !== null
    ]);
    const csv = serializeCsvDocument(headers, rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "class-promotion-manual-playtest-comparison.csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  const classCounts = BASIC_CLASS_IDS.map((classId) => ({
    classId,
    count: candidates.filter((candidate) => candidate.unit.classId === classId).length
  }));

  return (
    <main className="promotion-lab promotion-snapshot-bench" data-testid="promotion-snapshot-bench">
      <header className="promotion-lab-header">
        <div>
          <p className="eyebrow">DEVELOPMENT ONLY · LOCAL SAVE SNAPSHOTS</p>
          <h1>実セーブ昇格比較ベンチ</h1>
          <p className="promotion-lab-lead">
            ゲームから書き出したセーブJSONをこのブラウザ内だけで検証し、Lv.10以上の基本職ユニットの実データと仮昇格結果を比較します。
          </p>
        </div>
        <a className="secondary-button promotion-lab-back" href="/">キャンペーンへ戻る</a>
      </header>

      <section className="promotion-lab-card" aria-labelledby="promotion-manual-worksheet-audit-heading" data-testid="promotion-manual-worksheet-audit">
        <div className="promotion-lab-section-heading"><div>
          <p className="eyebrow">MANUAL PLAYTEST · LOCAL AUDIT</p>
          <h2 id="promotion-manual-worksheet-audit-heading">記入済み実プレイ記録CSVを確認</h2>
        </div>
        {manualWorksheetAudit && <span className="promotion-lab-count">{manualWorksheetAudit.matchedPairCount}/21 条件一致ペア</span>}</div>
        <label className="promotion-snapshot-file-label">
          <span>記入後のCSVテンプレート</span>
          <input type="file" accept=".csv,text/csv" aria-label="記入済み実プレイ記録CSV"
            onChange={(event) => void handleManualWorksheetFileChange(event)} />
        </label>
        <p className="helper-text">#163で出力したCSVを読み込み、21ケースのcontrol／promotion行、候補snapshot・敵・開始条件の一致、記入欄の入力数を確認します。ファイル内容はこの画面のメモリ上だけで扱い、保存・アップロード・外部送信はしません。確認を終えたら破棄できます。</p>
        <p className="helper-text">ペア成立は2枝の行と記載条件が揃ったことだけを示します。プレイ実施・観測値の正確性・データの真正性・独立campaign・バランス承認は認定しません。manual_record_statusやclassification_is_verifiedの記載値も自動証明として扱いません。</p>
        {manualWorksheetImportError && <div className="promotion-snapshot-errors" role="alert">{manualWorksheetImportError}</div>}
        {manualWorksheetAudit && <>
          <div className="promotion-snapshot-selected"><dl>
            <div><dt>ファイル</dt><dd>{manualWorksheetFileName}</dd></div>
            <div><dt>CSV行数／受理行</dt><dd>{manualWorksheetAudit.csvRowCount}／{manualWorksheetAudit.acceptedRowCount}</dd></div>
            <div><dt>control／promotion両枝あり</dt><dd>{manualWorksheetAudit.pairedCaseCount}/21</dd></div>
            <div><dt>候補・条件一致ペア</dt><dd>{manualWorksheetAudit.matchedPairCount}/21</dd></div>
            <div><dt>不足している枝</dt><dd>{manualWorksheetAudit.missingBranchCount}</dd></div>
            <div><dt>重複枝／不正行</dt><dd>{manualWorksheetAudit.duplicateBranchCount}／{manualWorksheetAudit.invalidRowCount}</dd></div>
            <div><dt>観測欄入力済みセル／行</dt><dd>{manualWorksheetAudit.observationFilledFieldCount}セル／{manualWorksheetAudit.rowsWithAnyObservation}行</dd></div>
          </dl></div>
          {manualWorksheetAudit.errors.length > 0 && <div className="promotion-snapshot-errors" role="alert">
            <strong>CSV構造・行の確認事項</strong><ul>{manualWorksheetAudit.errors.map((error, index) => <li key={index}>{error}</li>)}</ul>
          </div>}
          {manualWorksheetAudit.warnings.length > 0 && <div className="promotion-snapshot-evidence" role="status">
            <h3>確認上の注意</h3><ul>{manualWorksheetAudit.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
          </div>}
          <div className="promotion-lab-table-wrap"><table className="promotion-lab-table" aria-label="実プレイ記録CSVのケース別監査結果">
            <thead><tr><th>ケース</th><th>control</th><th>promotion</th><th>ペア状態</th><th>候補区分（申告）</th></tr></thead>
            <tbody>{manualWorksheetAudit.cases.map((entry) => {
              const formatBranch = (branch: PromotionManualPlaytestBranchAudit | null) => {
                if (!branch) return "行なし";
                const observation = branch.observationFilledFieldCount + "/" + branch.observationFieldCount + "欄入力";
                return (
                  <div>
                    <div>{(branch.manualRecordStatus || "状態空欄") + " · " + observation}</div>
                    {branch.observationMissingFields.length > 0 && (
                      <details className="promotion-manual-missing-fields">
                        <summary>未入力欄 {branch.observationMissingFields.length}</summary>
                        <ul>{branch.observationMissingFields.map((field) => <li key={field}><code>{field}</code></li>)}</ul>
                      </details>
                    )}
                  </div>
                );
              };
              const pairStatus = !entry.control || !entry.promotion ? "片枝不足" : entry.pairFieldMismatches.length > 0 ? "2枝あり・条件差" : "2枝あり・条件一致";
              const classification = entry.control?.candidateSourceClassification || entry.promotion?.candidateSourceClassification || "未記入";
              return <tr key={entry.caseId} data-testid={"promotion-manual-audit-case-" + entry.caseId.replace(":", "-")}>
                <th scope="row">{entry.caseId}</th><td>{formatBranch(entry.control)}</td><td>{formatBranch(entry.promotion)}</td>
                <td>{pairStatus}{entry.pairFieldMismatches.length > 0 && <small>{entry.pairFieldMismatches.join("／")}</small>}</td>
                <td>{classification}</td></tr>;
            })}</tbody>
          </table></div>
          <section className="promotion-manual-observation-matrix" data-testid="promotion-manual-observation-matrix">
            <div className="promotion-manual-comparison-heading">
              <h3>観測項目別・21ケース比較マトリクス</h3>
              {manualWorksheetComparisonFields.length > 0 && (
                <label className="promotion-manual-comparison-field">
                  <span>比較する観測欄</span>
                  <select
                    aria-label="比較する観測欄"
                    value={activeManualWorksheetComparisonField}
                    onChange={(event) => setManualWorksheetComparisonField(event.target.value)}
                  >
                    {manualWorksheetComparisonFields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </label>
              )}
            </div>
            <p className="helper-text">
              観測欄を1つ選び、全21ケースのcontrol／promotion値を同じ列で確認できます。枝が不足するケースも行として残し、入力のない値は未記入と表示します。数値差は両枝が有限数値の場合だけ算出します。
            </p>
            {manualWorksheetComparisonFields.length === 0 ? (
              <p className="helper-text">受理された行に入力済みの観測欄がないため、項目別比較はまだ表示できません。</p>
            ) : (
              <>
                <p className="helper-text">
                  {activeManualWorksheetComparisonField} · 入力済み {manualWorksheetAudit.observationFieldCoverage.find((entry) => entry.field === activeManualWorksheetComparisonField)?.populatedRows ?? 0}/{manualWorksheetAudit.acceptedRowCount}枝行
                </p>
                <div className="promotion-lab-table-wrap">
                  <table className="promotion-lab-table promotion-manual-observation-matrix-table" aria-label={activeManualWorksheetComparisonField + "の21ケース比較"}>
                    <thead><tr><th>ケース</th><th>ペア状態</th><th>control</th><th>promotion</th><th>差（promotion − control）</th></tr></thead>
                    <tbody>
                      {manualWorksheetAudit.cases.map((entry) => {
                        const comparison = manualWorksheetComparisons.find((item) =>
                          item.caseId === entry.caseId && item.field === activeManualWorksheetComparisonField
                        );
                        const controlValue = entry.control?.values[activeManualWorksheetComparisonField]?.trim() ?? "";
                        const promotionValue = entry.promotion?.values[activeManualWorksheetComparisonField]?.trim() ?? "";
                        const pairStatus = !entry.control || !entry.promotion
                          ? "片枝不足"
                          : entry.pairFieldMismatches.length > 0
                            ? "条件の記載に差あり"
                            : "CSV記載条件一致";
                        const delta = !entry.control || !entry.promotion
                          ? "未算出（ペア不足）"
                          : comparison
                            ? formatManualObservationDelta(comparison.numericDelta, controlValue, promotionValue)
                            : "未記入（両枝空欄）";
                        return (
                          <tr key={entry.caseId} data-testid={"promotion-manual-observation-matrix-row-" + entry.caseId.replace(":", "-")}>
                            <th scope="row">{entry.caseId}</th>
                            <td>
                              {pairStatus}
                              {entry.pairFieldMismatches.length > 0 && <small>{entry.pairFieldMismatches.join("／")}</small>}
                            </td>
                            <td>{controlValue || (entry.control ? "未記入" : "行なし")}</td>
                            <td>{promotionValue || (entry.promotion ? "未記入" : "行なし")}</td>
                            <td>{delta}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
          <section className="promotion-manual-comparisons" aria-label="control／promotionの手動記録比較">
            <h3>control／promotionの記録値比較</h3>
            <p className="helper-text">
              両枝に入力された値を項目ごとに並べます。数値差は両方のセルが有限数値として読める場合だけ promotion − control で計算し、空欄を0として補完しません。条件の記載に差があるペアも表示しますが、その差分は記録値の説明に限られます。
            </p>
            {manualWorksheetAudit.cases.map((entry) => {
              if (!entry.control || !entry.promotion) return null;
              const comparisons = manualWorksheetComparisons.filter((comparison) => comparison.caseId === entry.caseId);
              return (
                <details
                  key={entry.caseId}
                  className="promotion-manual-comparison-case"
                  data-testid={"promotion-manual-audit-comparison-" + entry.caseId.replace(":", "-")}
                >
                  <summary>{entry.caseId} · 比較項目 {comparisons.length}</summary>
                  <p className="helper-text">
                    {entry.pairFieldMismatches.length > 0
                      ? "条件の記載に差があります（" + entry.pairFieldMismatches.join("／") + "）。以下は条件一致を前提にしない参考表示です。"
                      : "条件メタデータはCSVの記載上で一致しています。実プレイの同一条件や記録の真正性を検証したものではありません。"}
                  </p>
                  {comparisons.length === 0 ? (
                    <p className="helper-text">両枝とも比較対象の観測欄は空欄です。</p>
                  ) : (
                    <div className="promotion-lab-table-wrap">
                      <table className="promotion-lab-table promotion-manual-comparison-table" aria-label={entry.caseId + "の記録値比較"}>
                        <thead><tr><th>観測欄</th><th>control</th><th>promotion</th><th>差（promotion − control）</th></tr></thead>
                        <tbody>
                          {comparisons.map((comparison) => (
                            <tr key={comparison.field}>
                              <th scope="row"><code>{comparison.field}</code></th>
                              <td>{comparison.controlValue || "未記入"}</td>
                              <td>{comparison.promotionValue || "未記入"}</td>
                              <td>{formatManualObservationDelta(
                                comparison.numericDelta,
                                comparison.controlValue,
                                comparison.promotionValue
                              )}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </details>
              );
            })}
          </section>
          <details className="promotion-manual-pair-coverage" data-testid="promotion-manual-pair-coverage">
            <summary>観測欄ごとのペア充足状況（{manualWorksheetObservationCoverage.length}項目）</summary>
            <p className="helper-text">
              各観測欄について21ケースを単位に、両枝入力・controlのみ・promotionのみ・両枝空欄・枝不足を分けて数えます。数値差が算出できるペア数と、条件記載差があるペア数も併記します。条件記載差は値の有無とは独立した件数で、他の列と重複します。
            </p>
            <div className="promotion-lab-table-wrap">
              <table className="promotion-lab-table promotion-manual-pair-coverage-table" aria-label="観測欄ごとのペア充足状況">
                <thead><tr>
                  <th>観測欄</th>
                  <th>両枝記録</th>
                  <th>controlのみ</th>
                  <th>promotionのみ</th>
                  <th>両枝空欄</th>
                  <th>枝不足</th>
                  <th>数値差算出可</th>
                  <th>両枝記録・数値差なし</th>
                  <th>条件記載差</th>
                </tr></thead>
                <tbody>
                  {manualWorksheetObservationCoverage.map((entry) => (
                    <tr key={entry.field} data-testid={"promotion-manual-pair-coverage-" + entry.field}>
                      <th scope="row"><code>{entry.field}</code></th>
                      <td>{entry.bothValuesPresentCaseCount}/{entry.pairedCaseCount}</td>
                      <td>{entry.controlOnlyValueCaseCount}</td>
                      <td>{entry.promotionOnlyValueCaseCount}</td>
                      <td>{entry.bothValuesEmptyCaseCount}</td>
                      <td>{entry.missingBranchCaseCount}/{entry.expectedCaseCount}</td>
                      <td>{entry.numericDeltaAvailablePairCount}</td>
                      <td>{entry.bothValuesWithoutNumericDeltaPairCount}</td>
                      <td>{entry.metadataMismatchCaseCount}/{entry.pairedCaseCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <details className="promotion-manual-field-coverage" data-testid="promotion-manual-field-coverage">
            <summary>観測欄ごとの入力状況（{manualWorksheetAudit.observationFieldCoverage.length}項目）</summary>
            <p className="helper-text">受理できた枝行のうち、各CSV列に値が入力された件数です。空欄は一律の必須漏れではなく、項目ごとの収集状況を示します。状況に合わない項目は未記入のままで構いません。</p>
            <div className="promotion-lab-table-wrap">
              <table className="promotion-lab-table" aria-label="観測欄ごとの入力状況">
                <thead><tr><th>CSV列</th><th>入力済み枝行</th><th>空欄枝行</th></tr></thead>
                <tbody>
                  {manualWorksheetAudit.observationFieldCoverage.map((entry) => (
                    <tr key={entry.field}>
                      <th scope="row"><code>{entry.field}</code></th>
                      <td>{entry.populatedRows}/{manualWorksheetAudit.acceptedRowCount}</td>
                      <td>{entry.emptyRows}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
          <div className="promotion-snapshot-matrix-actions">
            <button className="secondary-button" type="button" onClick={handleDownloadManualWorksheetComparisons} disabled={manualWorksheetComparisons.length === 0}>
              記録値の比較CSVを出力（{manualWorksheetComparisons.length}項目）
            </button>
            <button className="secondary-button" type="button" onClick={handleDownloadManualWorksheetObservationCoverage} disabled={manualWorksheetObservationCoverage.length === 0}>
              観測欄ペア充足CSVを書き出す
            </button>
            <button className="secondary-button" type="button" onClick={clearManualWorksheetAudit}>取り込んだCSVを破棄</button>
          </div>
        </>}
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-import-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">IMPORT · MEMORY ONLY</p>
            <h2 id="promotion-snapshot-import-heading">セーブsnapshotを追加</h2>
          </div>
          <span className="promotion-lab-count">{candidates.length}候補</span>
        </div>
        <label className="promotion-snapshot-file-label">
          <span>対応するセーブJSON（複数選択可）</span>
          <input
            type="file"
            accept=".json,application/json"
            multiple
            aria-label="対応するセーブJSON（複数選択可）"
            onChange={(event) => void handleFileChange(event)}
          />
        </label>
        <p className="helper-text">
          JSON export（envelope v1／GameState saveVersion 1〜{SAVE_VERSION}）に対応します。v1〜v9はこのベンチ内のコピーだけをsaveVersion {SAVE_VERSION}へ移行し、元ファイルは変更しません。読み込んだ内容はメモリ上だけに保持し、ページ再読み込みで消えます。
        </p>
        <p className="helper-text">
          候補・履歴根拠CSVは21ケースの実行前でも書き出せます。同一セーブ内容＋同一unit IDの重複読み込みは1行にまとめ、元ファイル名・export日時・version情報は読み込み元一覧として残します。位置は0始まりです。履歴欄は追跡可否フラグと件数を分け、未追跡と記録0件を区別します。
        </p>
        {errors.length > 0 && (
          <div className="promotion-snapshot-errors" role="alert">
            {errors.map((error, index) => <p key={index}>{error}</p>)}
          </div>
        )}
        {candidates.length > 0 && (
          <div className="promotion-snapshot-matrix-actions">
            <button
              className="secondary-button"
              type="button"
              data-testid="promotion-snapshot-inventory-export"
              onClick={handleDownloadPromotionSnapshotInventory}
            >
              候補・履歴根拠CSVを書き出す
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
              setCandidates([]);
              setSelectedKey("");
              setErrors([]);
              setMatrixCandidateSelections({});
              setMatrixTargetSelections({});
              setMatrixConfirmations({});
              setMatrixDataClassifications({});
              setMatrixResults({});
              setMatrixRunError("");
            }}
          >
              読み込んだsnapshotをすべて破棄
            </button>
          </div>
        )}
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-profile-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">CLASS SAMPLE COUNTS</p>
            <h2 id="promotion-snapshot-profile-heading">基本職ごとの実データ候補</h2>
          </div>
        </div>
        <p className="helper-text">
          21ケースの候補を用意するには、各基本職でLv.10以上のユニットsnapshotが3件以上必要です。候補のpercentileから低位25%・中央値50%・上位90%に近い個体を候補表示しますが、自動確定ではありません。上位プロファイルは実測分布内の上位であり、正式な上限近傍を意味しません。
        </p>
        <div className="promotion-snapshot-class-grid">
          {classCounts.map(({ classId, count }) => (
            <div key={classId} className="promotion-snapshot-class-count">
              <strong>{getClassDisplayName(classId)}</strong>
              <span>{count}件</span>
              <small>{count >= 3 ? "percentile参考値を表示" : "分布データ不足（3件未満）"}</small>
            </div>
          ))}
        </div>
        <p className="helper-text">
          各基本職内で8能力それぞれの順位を求め、その平均を参考percentileとして表示します。3件未満では参考順位を出しません。これは候補整理用であり、統計的な妥当性や合格基準を定めるものではありません。low／median／highの確定は試験記録で人が判断します。
        </p>
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-candidates-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">LV.10+ BASIC-CLASS UNITS</p>
            <h2 id="promotion-snapshot-candidates-heading">昇格候補</h2>
          </div>
        </div>
        {candidates.length === 0 ? (
          <p className="helper-text">まだsnapshotがありません。セーブ管理からJSONを書き出し、ここで読み込んでください。</p>
        ) : (
          <label className="promotion-snapshot-candidate-label">
            <span>比較するユニット</span>
            <select
              aria-label="比較するユニット"
              value={selectedCandidate?.key ?? ""}
              onChange={(event) => setSelectedKey(event.target.value)}
            >
              {candidates.map((candidate) => {
                const classSamples = candidates.filter((entry) => entry.unit.classId === candidate.unit.classId);
                const percentile = getAverageClassPercentile(candidate, classSamples);
                const status = candidate.eligible ? "昇格比較可" : candidate.reasons.join("／");
                return (
                  <option key={candidate.key} value={candidate.key}>
                    {candidate.unit.name} · {getClassDisplayName(candidate.unit.classId)} · {candidate.fileName} · {percentile === null ? "順位算出前" : "約" + percentile + " percentile"} · {status}
                  </option>
                );
              })}
            </select>
          </label>
        )}
        {selectedCandidate && (
          <div className="promotion-snapshot-selected" data-testid="promotion-snapshot-selected">
            <dl>
              <div><dt>snapshot</dt><dd>{selectedCandidate.fileName}</dd></div>
              <div><dt>元saveVersion</dt><dd>{selectedCandidate.sourceSaveVersion} → {selectedCandidate.normalizedSaveVersion}（{selectedCandidate.migrated ? "移行済み" : "移行なし"}）</dd></div>
              <div><dt>export日時</dt><dd>{selectedCandidate.exportedAt}</dd></div>
              <div><dt>fingerprint</dt><dd>{selectedCandidate.fingerprint}</dd></div>
              <div><dt>章／turn</dt><dd>{selectedCandidate.snapshot.chapterId} · 第{selectedCandidate.snapshot.turn}ターン</dd></div>
              <div><dt>ユニット</dt><dd>{selectedCandidate.unit.name}（{selectedCandidate.unit.id}）</dd></div>
              <div><dt>クラス／Lv／EXP</dt><dd>{getClassDisplayName(selectedCandidate.unit.classId)} · Lv.{selectedCandidate.unit.level} · EXP {selectedCandidate.unit.experience}</dd></div>
              <div><dt>HP／位置</dt><dd>{selectedCandidate.unit.currentHp}/{selectedCandidate.unit.stats.hp} · {formatUnitLocation(selectedCandidate.unit)}</dd></div>
              <div><dt>移動／武器適性</dt><dd>{selectedCandidate.unit.movementType}・{selectedCandidate.unit.move} · {selectedCandidate.unit.usableWeaponTypes.join("／")}</dd></div>
              <div><dt>装備／所持品</dt><dd>{selectedCandidate.unit.equippedWeaponId ?? "なし"} · {selectedCandidate.unit.inventory.join("／")}</dd></div>
              <div><dt>RNG</dt><dd>{selectedCandidate.snapshot.rngState}</dd></div>
              <div><dt>平均能力percentile</dt><dd>{getAverageClassPercentile(selectedCandidate, classCandidates) === null ? "分布データ不足" : "約" + getAverageClassPercentile(selectedCandidate, classCandidates) + " percentile（参考値）"}</dd></div>
            </dl>
            {selectedEvidence && (
              <section className="promotion-snapshot-evidence" data-testid="promotion-snapshot-evidence">
                <h3>保存済みキャンペーン履歴の根拠</h3>
                <p className="helper-text">
                  保存データ内に残っている件数を表示します。ファイルの真正性や、すべての行動が実プレイ由来かどうかを認定するものではありません。
                </p>
                <dl>
                  <div><dt>campaignBattleLog（元saveVersion 9以上）</dt><dd>{selectedEvidence.campaignLogTrackingAvailable ? "追跡対象 · " + selectedEvidence.campaignLogEntries + "件" : "未追跡（この元saveVersionでは記録対象外）"}</dd></div>
                  <div><dt>ログ保管件数／上限</dt><dd>{selectedEvidence.campaignLogTrackingAvailable ? selectedEvidence.campaignLogEntries + "／" + selectedEvidence.campaignLogRetentionLimit + "件" : "未追跡"}</dd></div>
                  <div><dt>sequence範囲／欠番</dt><dd>{!selectedEvidence.campaignLogTrackingAvailable ? "未追跡" : selectedEvidence.campaignLogFirstSequence === null ? "記録なし" : selectedEvidence.campaignLogFirstSequence + "–" + selectedEvidence.campaignLogLastSequence + " · 欠番 " + selectedEvidence.campaignLogSequenceGapCount + "件"}</dd></div>
                  <div><dt>上限状態</dt><dd>{!selectedEvidence.campaignLogTrackingAvailable ? "未追跡" : selectedEvidence.campaignLogAtRetentionLimit ? "最大保管件数に到達（古い記録が切り捨てられたかは、この値だけでは判定できません）" : "上限未到達"}</dd></div>
                  <div><dt>記録のある章数</dt><dd>{selectedEvidence.campaignChapterCount}</dd></div>
                  <div><dt>履歴の内訳</dt><dd>味方行動 {selectedEvidence.playerActionEntries} · 味方攻撃 {selectedEvidence.playerAttackEntries} · 敵行動 {selectedEvidence.enemyActionEntries} · 章結果 {selectedEvidence.chapterResultEntries}</dd></div>
                  <div><dt>対象ユニットの履歴</dt><dd>行動 {selectedEvidence.selectedUnitActionEntries} · 攻撃 {selectedEvidence.selectedUnitAttackEntries} · 被標的 {selectedEvidence.selectedUnitTargetedEnemyActionEntries} · 攻撃strike {selectedEvidence.selectedUnitAttackStrikes}</dd></div>
                  <div><dt>味方別累計（元saveVersion 3以上）</dt><dd>{!selectedEvidence.unitBattleTotalsTrackingAvailable ? "未追跡（この元saveVersionでは記録対象外）" : selectedEvidence.selectedUnitBattleTotals ? "攻撃 " + selectedEvidence.selectedUnitBattleTotals.attacks + " · strike " + selectedEvidence.selectedUnitBattleTotals.strikes + " · 命中 " + selectedEvidence.selectedUnitBattleTotals.hits + " · 与ダメージ " + selectedEvidence.selectedUnitBattleTotals.damageDealt + " · 撃破 " + selectedEvidence.selectedUnitBattleTotals.enemiesDefeated + " · EXP " + selectedEvidence.selectedUnitBattleTotals.experienceAwarded : "対象ユニットの累計レコードなし"}</dd></div>
                </dl>
                <p className="helper-text">sequence欠番は保存配列内で確認できる連番の欠けた数で、欠落した行動の内容は推測しません。最大5,000件に達した場合も、上限到達だけでは古い履歴の切り捨て有無を確定できません。</p>
                <p className="helper-text">記録が空でも未プレイとは限りません。旧バージョンでは戦闘履歴が保存されていない場合があり、途中の記録欠落・改変の有無も判定しません。</p>
              </section>
            )}
            {!selectedCandidate.eligible && (
              <div className="promotion-snapshot-errors" role="status">
                <strong>現時点では昇格比較できません。</strong>
                <ul>{selectedCandidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-matrix-heading" data-testid="promotion-playtest-matrix">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">7 PATHS × 3 MEASURED PROFILES</p>
            <h2 id="promotion-snapshot-matrix-heading">21ケース統制評価マトリクス</h2>
          </div>
          <span className="promotion-lab-count">{readyMatrixCount}/21 実行準備完了</span>
        </div>
        <p className="helper-text">
          各基本職の実測候補から低位25%・中央値50%・上位90%に近い個体を仮選出します。各行で候補と射程内の敵を確認し、条件確認チェックを入れてください。percentileは8能力順位の平均であり、成長率そのものではありません。実プレイ由来かどうかは自動判定できないため、各ケースのデータ区分を別途指定します。
        </p>
        <div className="promotion-playtest-coverage" data-testid="promotion-playtest-coverage">
          <h3>基本職別の候補snapshotカバレッジ</h3>
          <p className="helper-text">
            各基本職で、実行条件を満たす異なるユニットsnapshotが3件必要です。同じセーブ・同じunit IDを別ファイル名やJSONキー順で読み込んでも1件として数え、同じユニットを複数profileへ割り当てません。同じセーブ内の異なるunit IDは別候補にできますが、別キャンペーン／別プレイの証明ではありません。ログや累計の件数も真正性の自動判定ではありません。
          </p>
          <div className="promotion-lab-table-wrap">
            <table className="promotion-lab-table" aria-label="基本職別の候補snapshotカバレッジ">
              <thead>
                <tr>
                  <th>基本職</th>
                  <th>候補ユニット</th>
                  <th>昇格比較可能</th>
                  <th>異なるユニットsnapshot</th>
                  <th>有効ユニットsnapshot</th>
                  <th>履歴ログあり候補</th>
                  <th>味方別累計あり候補</th>
                </tr>
              </thead>
              <tbody>
                {matrixCoverageRows.map((row) => (
                  <tr key={row.classId} data-testid={"promotion-playtest-coverage-" + row.classId}>
                    <th scope="row">{getClassDisplayName(row.classId)}</th>
                    <td>{row.candidateCount}</td>
                    <td>{row.eligibleCandidateCount}</td>
                    <td>{row.distinctUnitSnapshotCount}</td>
                    <td>{row.eligibleDistinctUnitSnapshotCount}/3</td>
                    <td>{row.campaignHistoryUnitSnapshotCount}</td>
                    <td>{row.unitBattleTotalsUnitSnapshotCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="helper-text">percentileは読み込んだ同クラス候補の8能力順位の平均です。自己申告の「実プレイ由来」区分は別途各ケースで指定してください。</p>
        </div>
        <div className="promotion-snapshot-matrix-controls">
          <label className="promotion-snapshot-candidate-label">
            <span>各ケースのseed試行回数</span>
            <select
              aria-label="21ケースの乱数試行回数"
              value={sampleCount}
              onChange={(event) => handleSampleCountChange(Number(event.target.value))}
            >
              <option value={20}>20</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
            </select>
          </label>
          <span className="helper-text">実行結果: {completedMatrixCount}/21ケース</span>
        </div>
        <p className="helper-text">
          実プレイ記録用テンプレートは、21ケースすべての候補・敵・条件を確認した後に出力できます。control／promotionの2枝で42行を作成し、観測結果・実施日時・実測seedなどの欄は空欄のままです。seed反復のシミュレーション結果は転記しません。データ区分は候補の自己申告であり、真正性を検証しません。
        </p>
        <div className="promotion-snapshot-matrix-actions">
          <button
            className="secondary-button"
            type="button"
            data-testid="promotion-playtest-manual-worksheet-export"
            onClick={handleDownloadPromotionManualPlaytestWorksheet}
            disabled={readyMatrixCount !== 21}
          >
            実プレイ記録用CSVテンプレートを書き出す
          </button>
        </div>
        <div className="promotion-lab-table-wrap">
          <table className="promotion-lab-table promotion-snapshot-matrix-table" aria-label="21ケース統制評価の候補割当">
            <thead>
              <tr>
                <th>昇格経路</th>
                <th>プロフィール／目標順位</th>
                <th>候補ユニット・実測順位</th>
                <th>比較対象の敵</th>
                <th>データ区分</th>
                <th>条件確認</th>
                <th>状態</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={row.id} data-testid={"promotion-playtest-case-" + row.id}>
                  <th scope="row">
                    {getClassDisplayName(row.classId)} → {getClassDisplayName(row.promotedClassId)}
                  </th>
                  <td>{row.profileLabel}<small>目標 {row.targetPercentile}%</small></td>
                  <td>
                    <select
                      aria-label={getClassDisplayName(row.classId) + " " + row.profileLabel + " 候補"}
                      value={row.candidate?.key ?? ""}
                      onChange={(event) => {
                        setMatrixCandidateSelections((current) => ({
                          ...current,
                          [row.id]: event.target.value
                        }));
                        setMatrixConfirmations((current) => ({ ...current, [row.id]: false }));
                        setMatrixResults({});
                      }}
                    >
                      <option value="">候補を選択</option>
                      {row.candidatePool.map((candidate) => (
                        <option key={candidate.key} value={candidate.key}>
                          {candidate.unit.name} · {candidate.fileName} · {getAverageClassStatPercentile(candidate, row.candidatePool) ?? "順位不足"} percentile
                        </option>
                      ))}
                    </select>
                    {row.candidate && (
                      <small>
                        {row.candidate.unit.id} · {row.candidatePercentile === null ? "順位不足" : "約" + row.candidatePercentile + " percentile"} · {row.candidate.fingerprint}
                      </small>
                    )}
                  </td>
                  <td>
                    {row.targets.length > 0 ? (
                      <select
                        aria-label={getClassDisplayName(row.classId) + " " + row.profileLabel + " 比較対象の敵"}
                        value={row.target?.id ?? ""}
                        onChange={(event) => {
                          setMatrixTargetSelections((current) => ({ ...current, [row.id]: event.target.value }));
                          setMatrixConfirmations((current) => ({ ...current, [row.id]: false }));
                          setMatrixResults({});
                        }}
                      >
                        {row.targets.map((enemy) => (
                          <option key={enemy.id} value={enemy.id}>
                            {enemy.name} · HP {enemy.currentHp} · {formatUnitLocation(enemy)}
                          </option>
                        ))}
                      </select>
                    ) : <small>攻撃可能な敵なし</small>}
                  </td>
                  <td>
                    <select
                      aria-label={getClassDisplayName(row.classId) + " " + row.profileLabel + " データ区分"}
                      value={row.dataClassification}
                      onChange={(event) => {
                        setMatrixDataClassifications((current) => ({
                          ...current,
                          [row.id]: event.target.value as MatrixDataClassification
                        }));
                        setMatrixResults({});
                      }}
                    >
                      <option value="unconfirmed">未確認</option>
                      <option value="actual-play">実プレイ由来（利用者申告）</option>
                      <option value="synthetic">合成fixture</option>
                    </select>
                  </td>
                  <td>
                    <label className="promotion-matrix-confirm">
                      <input
                        type="checkbox"
                        checked={row.confirmed}
                        disabled={!row.candidate || !row.target || !row.candidate.eligible || row.eligibleDistinctUnitSnapshotCount < 3 || row.duplicateCandidate}
                        onChange={(event) => {
                          setMatrixConfirmations((current) => ({ ...current, [row.id]: event.target.checked }));
                          setMatrixResults({});
                        }}
                      />
                      <span>確認済み</span>
                    </label>
                  </td>
                  <td>
                    <small>{row.status}</small>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="promotion-snapshot-matrix-actions">
          <button
            className="primary-button"
            type="button"
            disabled={readyMatrixCount !== 21}
            onClick={handleRunPromotionPlaytestMatrix}
          >
            21ケースのseed反復を実行
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={completedMatrixCount !== 21}
            onClick={handleDownloadPromotionPlaytestMatrix}
          >
            21ケース結果CSVを書き出す
          </button>
        </div>
        {matrixRunError && <p className="promotion-snapshot-errors" role="alert">{matrixRunError}</p>}
        {completedMatrixCount > 0 && (
          <div className="promotion-playtest-matrix-results" data-testid="promotion-playtest-matrix-results">
            <h3>試行結果（{completedMatrixCount}/21件）</h3>
            <div className="promotion-lab-table-wrap">
              <table className="promotion-lab-table" aria-label="21ケースのseed反復集計結果">
                <thead>
                  <tr>
                    <th>基本職／プロフィール</th>
                    <th>候補／敵</th>
                    <th>試行数</th>
                    <th>命中率 control → promotion</th>
                    <th>平均与ダメージ／戦闘</th>
                    <th>敵撃破率（95%区間）</th>
                    <th>平均反撃被ダメージ</th>
                    <th>単発攻撃後の生存率（95%区間）</th>
                    <th>敵軍行動数</th>
                    <th>敵軍攻撃数</th>
                    <th>本人が狙われた割合（95%区間）</th>
                    <th>敵軍phase本人平均被ダメージ</th>
                    <th>敵軍phase本人生存率（95%区間）</th>
                    <th>味方全体平均被ダメージ</th>
                    <th>敗北結果率（95%区間）</th>
                    <th>味方全滅率（95%区間）</th>
                    <th>次の自軍phase進行率（95%区間）</th>
                    <th>保存内履歴の根拠</th>
                    <th>データ区分</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixSlots.map((slot) => {
                    const result = matrixResults[slot.id];
                    if (!result) return null;
                    return (
                      <tr key={slot.id} data-testid={"promotion-playtest-result-" + slot.id}>
                        <th scope="row">{getClassDisplayName(result.classId)}・{result.profile}</th>
                        <td>{result.unitName} → {result.enemyId}</td>
                        <td>{result.summary.sampleCount}</td>
                        <td>{result.summary.control.attackHitRate.toFixed(1)}% → {result.summary.promotion.attackHitRate.toFixed(1)}%</td>
                        <td>{result.summary.control.averageAttackDamagePerBattle.toFixed(1)} → {result.summary.promotion.averageAttackDamagePerBattle.toFixed(1)}</td>
                        <td>
                          {formatRateWithConfidenceInterval(result.summary.control.enemyDefeatRate, result.summary.control.enemyDefeatRateInterval95)} → {formatRateWithConfidenceInterval(result.summary.promotion.enemyDefeatRate, result.summary.promotion.enemyDefeatRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.summary.pairedOutcomes.enemyDefeat)}</small>
                        </td>
                        <td>{result.summary.control.averageCounterDamagePerBattle.toFixed(1)} → {result.summary.promotion.averageCounterDamagePerBattle.toFixed(1)}</td>
                        <td>
                          {formatRateWithConfidenceInterval(result.summary.control.attackerSurvivalRate, result.summary.control.attackerSurvivalRateInterval95)} → {formatRateWithConfidenceInterval(result.summary.promotion.attackerSurvivalRate, result.summary.promotion.attackerSurvivalRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.summary.pairedOutcomes.attackerSurvival)}</small>
                        </td>
                        <td>{result.enemyPhaseSummary.control.totalEnemyActions.toFixed(1)} → {result.enemyPhaseSummary.promotion.totalEnemyActions.toFixed(1)}</td>
                        <td>{result.enemyPhaseSummary.control.enemyAttackActions.toFixed(1)} → {result.enemyPhaseSummary.promotion.enemyAttackActions.toFixed(1)}</td>
                        <td>
                          {formatRateWithConfidenceInterval(result.enemyPhaseSummary.control.selectedUnitTargetedPhaseRate, result.enemyPhaseSummary.control.selectedUnitTargetedPhaseRateInterval95)} → {formatRateWithConfidenceInterval(result.enemyPhaseSummary.promotion.selectedUnitTargetedPhaseRate, result.enemyPhaseSummary.promotion.selectedUnitTargetedPhaseRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.enemyPhaseSummary.pairedOutcomes.selectedUnitTargeted)}</small>
                        </td>
                        <td>{result.enemyPhaseSummary.control.selectedUnitAverageDamagePerPhase.toFixed(1)} → {result.enemyPhaseSummary.promotion.selectedUnitAverageDamagePerPhase.toFixed(1)}</td>
                        <td>
                          {formatRateWithConfidenceInterval(result.enemyPhaseSummary.control.selectedUnitSurvivalRate, result.enemyPhaseSummary.control.selectedUnitSurvivalRateInterval95)} → {formatRateWithConfidenceInterval(result.enemyPhaseSummary.promotion.selectedUnitSurvivalRate, result.enemyPhaseSummary.promotion.selectedUnitSurvivalRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.enemyPhaseSummary.pairedOutcomes.selectedUnitSurvived)}</small>
                        </td>
                        <td>{result.enemyPhaseSummary.control.averageTotalPlayerDamagePerPhase.toFixed(1)} → {result.enemyPhaseSummary.promotion.averageTotalPlayerDamagePerPhase.toFixed(1)}</td>
                        <td>
                          {formatRateWithConfidenceInterval(result.enemyPhaseSummary.control.battleDefeatRate, result.enemyPhaseSummary.control.battleDefeatRateInterval95)} → {formatRateWithConfidenceInterval(result.enemyPhaseSummary.promotion.battleDefeatRate, result.enemyPhaseSummary.promotion.battleDefeatRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.enemyPhaseSummary.pairedOutcomes.battleDefeat)}</small>
                        </td>
                        <td>
                          {formatRateWithConfidenceInterval(result.enemyPhaseSummary.control.partyWipeRate, result.enemyPhaseSummary.control.partyWipeRateInterval95)} → {formatRateWithConfidenceInterval(result.enemyPhaseSummary.promotion.partyWipeRate, result.enemyPhaseSummary.promotion.partyWipeRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.enemyPhaseSummary.pairedOutcomes.partyWipe)}</small>
                        </td>
                        <td>
                          {formatRateWithConfidenceInterval(result.enemyPhaseSummary.control.playerPhaseAdvanceRate, result.enemyPhaseSummary.control.playerPhaseAdvanceRateInterval95)} → {formatRateWithConfidenceInterval(result.enemyPhaseSummary.promotion.playerPhaseAdvanceRate, result.enemyPhaseSummary.promotion.playerPhaseAdvanceRateInterval95)}
                          <small>同一seed: {formatPairedOutcomeBreakdown(result.enemyPhaseSummary.pairedOutcomes.playerPhaseAdvanced)}</small>
                        </td>
                        <td>
                          {result.evidence.campaignLogTrackingAvailable ? "ログ " + result.evidence.campaignLogEntries + "件" : "ログ: 未追跡"} · {result.evidence.campaignChapterCount}章
                          <small>対象ユニット: 行動 {result.evidence.selectedUnitActionEntries}／攻撃 {result.evidence.selectedUnitAttackEntries}／被標的 {result.evidence.selectedUnitTargetedEnemyActionEntries}</small>
                          <small>{result.evidence.campaignLogTrackingAvailable ? "ログ保管: " + result.evidence.campaignLogEntries + "/" + result.evidence.campaignLogRetentionLimit + "件 · 欠番 " + result.evidence.campaignLogSequenceGapCount + "件" + (result.evidence.campaignLogAtRetentionLimit ? " · 上限到達" : "") : "ログ保管: 未追跡"}</small>
                          <small>{result.evidence.unitBattleTotalsTrackingAvailable ? "味方別累計: " + (result.evidence.selectedUnitBattleTotals?.attacks ?? 0) + "攻撃" : "味方別累計: 未追跡"}</small>
                        </td>
                        <td>{getMatrixDataClassificationLabel(result.dataClassification)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="helper-text">
          同一seed内訳の「昇格のみ／非昇格のみ」はそのイベントが発生した枝を示します。敗北・全滅などの悪いイベントでは、発生数が少ない枝の方が良い結果です。このマトリクスは実セーブの候補選定と戦闘反復の記録用です。各ケースは独立した単発攻撃比較に加え、両枝とも選択ユニットの行動を消費した状態で既存beginEnemyPhase／runEnemyPhaseを実行し、敵AIの移動・標的選択・戦闘・砦回復を比較します。controlは昇格せず行動を見送り、promotionは昇格を行います。敵軍フェイズ1回のみで、次の自軍行動や複数ターン・章攻略は再現しません。敗北結果率はマップ固有の敗北条件を含み、味方全滅率は生存プレイヤーユニットが全員いなくなった場合を別に数えます。現行の敵AIは試作ロジックです。「実プレイ由来」は利用者の申告であり、ファイルの真正性を自動検証するものではありません。合成fixtureや未確認の結果を実プレイ記録として扱わないでください。
        </p>
      </section>

      {selectedCandidate && comparison && (
        <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-result-heading" data-testid="promotion-snapshot-comparison">
          <div className="promotion-lab-section-heading">
            <div>
              <p className="eyebrow">DETACHED CONTROL / PROMOTION COPY</p>
              <h2 id="promotion-snapshot-result-heading">同一snapshotからの昇格前後比較</h2>
            </div>
            <span className="promotion-lab-provisional">数値は試作値</span>
          </div>
          <p className="helper-text">
            左は読み込んだsnapshotのまま、右はそのコピーに昇格コマンドを実行した結果です。実セーブ／本編stateは変更しません。
            {selectedCandidate.testSealInjected
              ? " 試験用の証をコピーにだけ追加してコマンドを実行し、コピー内で消費しています。"
              : " 読み込んだsnapshot内の証をコピーで消費しています。"}
          </p>
          <div className="promotion-snapshot-branch-grid">
            <div>
              <h3>control（元snapshot）</h3>
              <dl>
                <div><dt>クラス</dt><dd>{getClassDisplayName(comparison.controlUnit.classId)}</dd></div>
                <div><dt>レベル／EXP</dt><dd>Lv.{comparison.controlUnit.level} · EXP {comparison.controlUnit.experience}</dd></div>
                <div><dt>HP</dt><dd>{comparison.controlUnit.currentHp}/{comparison.controlUnit.stats.hp}</dd></div>
                <div><dt>行動</dt><dd>{comparison.controlUnit.hasMoved ? "移動済み" : "未移動"}・{comparison.controlUnit.hasActed ? "行動済み" : "未行動"}</dd></div>
                <div><dt>装備／移動</dt><dd>{comparison.controlUnit.equippedWeaponId ?? "なし"} · {comparison.controlUnit.movementType}/{comparison.controlUnit.move}</dd></div>
              </dl>
            </div>
            <div>
              <h3>promotion（コピー上で実行）</h3>
              <dl>
                <div><dt>クラス</dt><dd>{getClassDisplayName(comparison.promotedUnit.classId)}</dd></div>
                <div><dt>レベル／EXP</dt><dd>Lv.{comparison.promotedUnit.level} · EXP {comparison.promotedUnit.experience}</dd></div>
                <div><dt>HP</dt><dd>{comparison.promotedUnit.currentHp}/{comparison.promotedUnit.stats.hp}</dd></div>
                <div><dt>行動</dt><dd>{comparison.promotedUnit.hasMoved ? "移動済み" : "未移動"}・{comparison.promotedUnit.hasActed ? "行動済み" : "未行動"}</dd></div>
                <div><dt>装備／移動</dt><dd>{comparison.promotedUnit.equippedWeaponId ?? "なし"} · {comparison.promotedUnit.movementType}/{comparison.promotedUnit.move}</dd></div>
              </dl>
            </div>
          </div>
          <div className="promotion-lab-table-wrap">
            <table className="promotion-lab-table" aria-label="実セーブ能力値の昇格比較">
              <thead><tr><th>能力</th><th>control</th><th>promotion</th><th>要求ボーナス</th><th>実増加</th><th>仮上限</th></tr></thead>
              <tbody>
                {STAT_ROWS.map(({ key, label }) => {
                  const change = comparison.statPreview.changes.find((entry) => entry.key === key)!;
                  return (
                    <tr key={key} data-testid={"promotion-snapshot-stat-" + key}>
                      <th scope="row">{label}</th>
                      <td>{comparison.controlUnit.stats[key]}</td>
                      <td>{comparison.promotedUnit.stats[key]}</td>
                      <td>+{change.requestedBonus}</td>
                      <td>+{change.appliedBonus}</td>
                      <td>{change.cap}{change.currentValueExceedsCap ? "（既存値を維持）" : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="promotion-snapshot-result-meta">
            <span>EXP端数保持: {comparison.controlUnit.experience} → {comparison.promotedUnit.experience}</span>
            <span>現在HP維持: {comparison.controlUnit.currentHp} → {comparison.promotedUnit.currentHp}</span>
            <span>行動消費: {comparison.controlUnit.hasActed ? "既に行動済み" : "未行動"} → {comparison.promotedUnit.hasActed ? "行動済み" : "未行動"}</span>
            <span>RNG不変: {comparison.rngUnchanged ? "確認済み" : "不一致"}</span>
          </div>
        </section>
      )}

      {selectedCandidate && comparison && (
        <section
          className="promotion-lab-card"
          aria-labelledby="promotion-snapshot-combat-heading"
          data-testid="promotion-snapshot-combat"
        >
          <div className="promotion-lab-section-heading">
            <div>
              <p className="eyebrow">SAME SNAPSHOT · SAME RNG</p>
              <h2 id="promotion-snapshot-combat-heading">同条件の仮想戦闘比較</h2>
            </div>
            <span className="promotion-lab-provisional">試作戦闘データ</span>
          </div>
          <p className="helper-text">
            昇格は現在の自軍フェイズの行動を消費します。この比較では、元snapshotと昇格後コピーの両方で次の自軍行動機会を模し、同じ開始RNG・位置・敵・地形から既存の戦闘コマンドを1回ずつ実行します。敵軍フェイズや移動、複数ターンの進行は再現しません。
          </p>
          {combatTargets.length === 0 ? (
            <p className="helper-text" role="status">
              現在のsnapshotには、装備武器の射程内で攻撃可能な生存敵がいません。戦闘比較には同じchapter／phase／unit編成で敵が射程内にいるsnapshotを読み込んでください。
            </p>
          ) : (
            <>
              <label className="promotion-snapshot-candidate-label">
                <span>比較対象の敵</span>
                <select
                  aria-label="比較対象の敵"
                  value={effectiveTargetId}
                  onChange={(event) => setSelectedTargetId(event.target.value)}
                >
                  {combatTargets.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.name} · HP {target.currentHp}/{target.stats.hp} · {formatUnitLocation(target)}
                    </option>
                  ))}
                </select>
              </label>
              {combatComparison && selectedTarget && (
                <>
                  <p className="helper-text" data-testid="promotion-snapshot-combat-rng">
                    共通開始RNG: {combatComparison.startingRngState}。両枝はそれぞれ同じseedから独立して乱数を進めます。
                  </p>
                  <div className="promotion-snapshot-branch-grid">
                    {([
                      { id: "control", label: "control（昇格なし）", branch: combatComparison.control, attacker: comparison.controlUnit },
                      { id: "promotion", label: "promotion（昇格後）", branch: combatComparison.promotion, attacker: comparison.promotedUnit }
                    ] as const).map(({ id, label, branch, attacker }) => (
                      <div key={id} data-testid={"promotion-snapshot-combat-" + id}>
                        <h3>{label}</h3>
                        <dl>
                          <div><dt>攻撃側／相手</dt><dd>{attacker.name} → {selectedTarget.name}</dd></div>
                          <div><dt>初期HP</dt><dd>{attacker.currentHp}/{attacker.stats.hp} → {selectedTarget.currentHp}/{selectedTarget.stats.hp}</dd></div>
                        </dl>
                        <strong>予測（既存forecast）</strong>
                        <ul>
                          {branch.forecast.strikes.map((strike, index) => (
                            <li key={strike.kind + "-" + index}>
                              {getStrikeLabel(strike.kind)}: 命中 {strike.hitRate}%・通常 {strike.normalDamage}・必殺 {strike.criticalRate}%
                            </li>
                          ))}
                        </ul>
                        <strong>実行結果（このseedの1試行）</strong>
                        <ul>
                          {branch.result.events.map((event, index) => (
                            <li key={event.kind + "-" + index}>
                              {getStrikeLabel(event.kind)}: {event.hit ? (event.critical ? "必殺命中" : "命中") : "回避"}・{event.damage} damage・相手HP {event.defenderHpBefore} → {event.defenderHpAfter}
                            </li>
                          ))}
                        </ul>
                        <dl>
                          <div><dt>戦闘後HP</dt><dd>攻撃側 {branch.result.attackerHp} / 相手 {branch.result.defenderHp}</dd></div>
                          <div><dt>獲得EXP／レベルアップ</dt><dd>+{branch.experienceAwarded} EXP／{branch.levelUps.length}回</dd></div>
                          <div><dt>終了RNG</dt><dd>{branch.finalRngState}</dd></div>
                        </dl>
                      </div>
                    ))}
                  </div>

                  {combatSamples && (
                    <section className="promotion-snapshot-samples" data-testid="promotion-snapshot-combat-samples">
                      <div className="promotion-lab-section-heading">
                        <div>
                          <p className="eyebrow">PAIRED DETERMINISTIC SAMPLES</p>
                          <h3>複数seed試行（独立した1戦闘の反復）</h3>
                        </div>
                        <label className="promotion-snapshot-candidate-label">
                          <span>乱数試行回数</span>
                          <select
                            aria-label="乱数試行回数"
                            value={sampleCount}
                            onChange={(event) => handleSampleCountChange(Number(event.target.value))}
                          >
                            <option value={20}>20</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                          </select>
                        </label>
                      </div>
                      <p className="helper-text">
                        {combatSamples.sampleCount}試行。seed系列はsnapshotの開始RNGから固定saltで分離して生成し、各番号を両枝へペアで適用します。seed系列の先頭／末尾: {combatSamples.firstSeed} ／ {combatSamples.lastSeed}。
                      </p>
                      <p className="helper-text">
                        各試行は元snapshotへ戻した独立の1戦闘です。HP・敵HP・EXP・撃破状態を次の試行へ引き継ぎません。結果はこの仮想戦闘条件での試行集計であり、複数ターンの攻略率・キャンペーン勝率ではありません。
                      </p>
                      <p className="helper-text">
                        95% Wilson区間は「1 seedにつき1結果」の撃破／生存率にのみ表示します。 同じseedでイベントが起きた枝だけを数えた内訳も併記し、ペア内の差を確認できます。1戦闘内に複数発生するstrikeの命中率・必殺率には、独立試行ではないためこの区間を付けていません。 区間はcontrol／promotionそれぞれの率の幅であり、両者の差の信頼区間や統計的有意差を示すものではありません。
                      </p>
                      <div className="promotion-lab-table-wrap">
                        <table className="promotion-lab-table" aria-label="昇格前後の複数seed戦闘集計">
                          <thead>
                            <tr><th>指標</th><th>control</th><th>promotion</th><th>差（昇格−非昇格）</th></tr>
                          </thead>
                          <tbody>
                            <tr>
                              <th scope="row">攻撃命中率</th>
                              <td>{combatSamples.control.attackHitRate.toFixed(1)}%（{combatSamples.control.attackHits}/{combatSamples.control.attackAttempts}）</td>
                              <td>{combatSamples.promotion.attackHitRate.toFixed(1)}%（{combatSamples.promotion.attackHits}/{combatSamples.promotion.attackAttempts}）</td>
                              <td>{formatDelta(combatSamples.promotion.attackHitRate - combatSamples.control.attackHitRate, "pt")}</td>
                            </tr>
                            <tr>
                              <th scope="row">命中時必殺率</th>
                              <td>{combatSamples.control.criticalRateOnHit.toFixed(1)}%（{combatSamples.control.criticalHits}）</td>
                              <td>{combatSamples.promotion.criticalRateOnHit.toFixed(1)}%（{combatSamples.promotion.criticalHits}）</td>
                              <td>{formatDelta(combatSamples.promotion.criticalRateOnHit - combatSamples.control.criticalRateOnHit, "pt")}</td>
                            </tr>
                            <tr>
                              <th scope="row">平均与ダメージ／戦闘</th>
                              <td>{combatSamples.control.averageAttackDamagePerBattle.toFixed(1)}</td>
                              <td>{combatSamples.promotion.averageAttackDamagePerBattle.toFixed(1)}</td>
                              <td>{formatDelta(combatSamples.promotion.averageAttackDamagePerBattle - combatSamples.control.averageAttackDamagePerBattle, "")}</td>
                            </tr>
                            <tr>
                              <th scope="row">この敵の撃破率</th>
                              <td>{formatRateWithConfidenceInterval(combatSamples.control.enemyDefeatRate, combatSamples.control.enemyDefeatRateInterval95)}（{combatSamples.control.enemyDefeats}/{combatSamples.sampleCount}）</td>
                              <td>{formatRateWithConfidenceInterval(combatSamples.promotion.enemyDefeatRate, combatSamples.promotion.enemyDefeatRateInterval95)}（{combatSamples.promotion.enemyDefeats}/{combatSamples.sampleCount}）</td>
                              <td>
                                {formatDelta(combatSamples.promotion.enemyDefeatRate - combatSamples.control.enemyDefeatRate, "pt")}
                                <small>同一seed: {formatPairedOutcomeBreakdown(combatSamples.pairedOutcomes.enemyDefeat)}</small>
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">平均反撃被ダメージ／戦闘</th>
                              <td>{combatSamples.control.averageCounterDamagePerBattle.toFixed(1)}</td>
                              <td>{combatSamples.promotion.averageCounterDamagePerBattle.toFixed(1)}</td>
                              <td>{formatDelta(combatSamples.promotion.averageCounterDamagePerBattle - combatSamples.control.averageCounterDamagePerBattle, "")}</td>
                            </tr>
                            <tr>
                              <th scope="row">反撃後の生存率</th>
                              <td>{formatRateWithConfidenceInterval(combatSamples.control.attackerSurvivalRate, combatSamples.control.attackerSurvivalRateInterval95)}（{combatSamples.control.attackerSurvivals}/{combatSamples.sampleCount}）</td>
                              <td>{formatRateWithConfidenceInterval(combatSamples.promotion.attackerSurvivalRate, combatSamples.promotion.attackerSurvivalRateInterval95)}（{combatSamples.promotion.attackerSurvivals}/{combatSamples.sampleCount}）</td>
                              <td>
                                {formatDelta(combatSamples.promotion.attackerSurvivalRate - combatSamples.control.attackerSurvivalRate, "pt")}
                                <small>同一seed: {formatPairedOutcomeBreakdown(combatSamples.pairedOutcomes.attackerSurvival)}</small>
                              </td>
                            </tr>
                            <tr>
                              <th scope="row">平均戦闘後HP</th>
                              <td>{combatSamples.control.averageAttackerHpRemaining.toFixed(1)}</td>
                              <td>{combatSamples.promotion.averageAttackerHpRemaining.toFixed(1)}</td>
                              <td>{formatDelta(combatSamples.promotion.averageAttackerHpRemaining - combatSamples.control.averageAttackerHpRemaining, "")}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      <section className="promotion-lab-card promotion-lab-caveats">
        <p className="eyebrow">SCOPE & LIMITS</p>
        <h2>このベンチで確認できること／できないこと</h2>
        <ul>
          <li>実セーブのユニット能力値・HP／EXP・移動・武器適性・装備を、読み込んだ時点のsnapshotとして表示します。</li>
          <li>7経路のうち対象の1ユニットについて、既存application/domain commandを切り離したコピーへ実行し、レベル／EXP／能力値／HP／移動／装備／行動消費を比較します。</li>
          <li>射程内に生存敵がいる場合は、既存performAttackを使った単一seedの比較と、20／100／250個の同一seedペアによる独立1戦闘反復を表示します。集計は命中率・必殺率・平均ダメージ・対象撃破率・反撃被ダメージ・生存率です。HPや撃破を試行間で持ち越さず、複数ターンの攻略率・敵AI・移動・21ケースの実プレイを代替しません。</li>
          <li>21ケースマトリクスでは、各基本職3件以上の候補からlow／median／upper相当を参考選出し、利用者が候補・敵・条件を確認した後に一括反復・CSV出力できます。実プレイ由来かどうかは利用者申告として保存し、自動判定しません。</li>
          <li>21ケースの集計には既存の敵軍フェイズ解決を使った1 phase比較も含みます。control／promotionの双方で選択ユニットは行動済みにしてphaseを進め、敵AIの移動・攻撃・生存・被ダメージを集計します。複数turnの戦闘やキャンペーン勝率ではありません。</li>
          <li>envelope v1のsaveVersion 1〜{SAVE_VERSION}を読み込みます。旧版は元の書き出しversion・export日時・v{SAVE_VERSION}へのmigration有無を記録してから、メモリ上のコピーだけを検証・比較します。IndexedDBへの読書き、ファイルのアップロード、サーバー送信はしません。</li>
          <li>現行クラス上限・ボーナスは仮値のままです。実データの比較はできてもCP-04／05の承認にはなりません。</li>
        </ul>
      </section>

      <footer className="promotion-lab-footer">
        <span>開発サーバー専用。メモリ上だけで処理し、リロードすると読み込んだsnapshotは破棄されます。</span>
        <a href="/">通常のキャンペーンに戻る</a>
      </footer>
    </main>
  );
}
