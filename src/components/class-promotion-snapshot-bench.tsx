import { useMemo, useState, type ChangeEvent } from "react";
import { CLASS_PROMOTION_TARGETS, getClassDisplayName, getClassPromotionDefinition } from "../content/classes";
import { PROMOTION_ITEM_ID } from "../content/items";
import { getChapterById } from "../content/chapters";
import { performClassChange } from "../application/perform-class-change";
import { createAttackPlan } from "../application/perform-attack";
import { getPromotionCombatComparison } from "../application/get-promotion-combat-comparison";
import { getPromotionCombatSampleSummary } from "../application/get-promotion-combat-sample-summary";
import { getClassPromotionStatPreview } from "../domain/progression/class-change";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import type { GameStateSnapshot, GameUnit, UnitStats } from "../domain/models/game";
import { parseSaveFileContent } from "../persistence/save-file";

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
  snapshot: GameStateSnapshot;
  unit: GameUnit;
  eligible: boolean;
  reasons: string[];
  testSealInjected: boolean;
}

interface ImportedFileResult {
  candidates: ImportedCandidate[];
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A short deterministic label only; this is not a cryptographic hash. */
function snapshotFingerprint(snapshot: GameStateSnapshot): string {
  const source = JSON.stringify(snapshot);
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
  value: unknown
): ImportedFileResult {
  if (!isRecord(value) || typeof value.chapterId !== "string") {
    return { candidates: [], error: "セーブsnapshotの章IDを確認できません。" };
  }
  const chapter = getChapterById(value.chapterId);
  if (!chapter) {
    return { candidates: [], error: "未登録の章IDです: " + value.chapterId };
  }
  if (!isValidGameStateSnapshot(value, chapter.map)) {
    return { candidates: [], error: "saveVersion 3または章マップ整合性の検証に失敗しました。" };
  }

  const snapshot = value;
  const fingerprint = snapshotFingerprint(snapshot);
  const candidates = snapshot.units
    .filter((unit) =>
      unit.faction === "player" &&
      unit.level >= 10 &&
      BASIC_CLASS_IDS.includes(unit.classId)
    )
    .map((unit): ImportedCandidate => {
      const reasons = getCandidateEligibility(snapshot, unit);
      return {
        key: fingerprint + ":" + unit.id + ":" + fileName,
        fileName,
        fingerprint,
        snapshot,
        unit,
        eligible: reasons.length === 0,
        reasons,
        testSealInjected: !unit.inventory.includes(PROMOTION_ITEM_ID)
      };
    });

  return { candidates };
}

function getAverageClassPercentile(
  candidate: ImportedCandidate,
  classCandidates: readonly ImportedCandidate[]
): number | null {
  if (classCandidates.length < 3) return null;

  const average = STAT_ROWS.reduce((total, { key }) => {
    const values = classCandidates.map((entry) => entry.unit.stats[key]);
    const lower = values.filter((value) => value < candidate.unit.stats[key]).length;
    const equal = values.filter((value) => value === candidate.unit.stats[key]).length;
    const midRank = (lower + (equal - 1) / 2) / Math.max(1, values.length - 1);
    return total + midRank * 100;
  }, 0) / STAT_ROWS.length;

  return Math.round(average);
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

function getStrikeLabel(kind: "initial" | "counter" | "follow-up"): string {
  if (kind === "initial") return "先制攻撃";
  if (kind === "counter") return "反撃";
  return "追撃";
}

export function ClassPromotionSnapshotBench() {
  const [candidates, setCandidates] = useState<ImportedCandidate[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedTargetId, setSelectedTargetId] = useState("");
  const [sampleCount, setSampleCount] = useState(100);

  const selectedCandidate = candidates.find((candidate) => candidate.key === selectedKey) ?? candidates[0];
  const selectedClassId = selectedCandidate?.unit.classId;
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

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const imported: ImportedCandidate[] = [];
    const nextErrors: string[] = [];

    for (const file of files) {
      try {
        const content = await file.text();
        const snapshot = parseSaveFileContent(content);
        const result = getCandidatesFromSnapshot(file.name, snapshot);
        if (result.error) {
          nextErrors.push(file.name + ": " + result.error);
        } else if (result.candidates.length === 0) {
          nextErrors.push(file.name + ": 昇格対象の基本職Lv.10以上ユニットが見つかりません。");
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
    if (imported.length > 0) setSelectedKey(imported[0]!.key);
    event.target.value = "";
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
          現在のJSON書き出し形式（envelope v1／GameState saveVersion 3）のみ対応します。読み込んだ内容はメモリ上だけに保持し、ページ再読み込みで消えます。
        </p>
        {errors.length > 0 && (
          <div className="promotion-snapshot-errors" role="alert">
            {errors.map((error, index) => <p key={index}>{error}</p>)}
          </div>
        )}
        {candidates.length > 0 && (
          <button
            className="secondary-button"
            type="button"
            onClick={() => { setCandidates([]); setSelectedKey(""); setErrors([]); }}
          >
            読み込んだsnapshotをすべて破棄
          </button>
        )}
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-snapshot-profile-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">CLASS SAMPLE COUNTS</p>
            <h2 id="promotion-snapshot-profile-heading">基本職ごとの実データ候補</h2>
          </div>
        </div>
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
            {!selectedCandidate.eligible && (
              <div className="promotion-snapshot-errors" role="status">
                <strong>現時点では昇格比較できません。</strong>
                <ul>{selectedCandidate.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              </div>
            )}
          </div>
        )}
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
                            onChange={(event) => setSampleCount(Number(event.target.value))}
                          >
                            <option value={20}>20</option>
                            <option value={100}>100</option>
                            <option value={250}>250</option>
                          </select>
                        </label>
                      </div>
                      <p className="helper-text">
                        {combatSamples.sampleCount}試行。seed系列はsnapshotの開始RNGから固定saltで分離して生成し、各番号を両枝へペアで適用します。seed範囲: {combatSamples.firstSeed} ～ {combatSamples.lastSeed}。
                      </p>
                      <p className="helper-text">
                        各試行は元snapshotへ戻した独立の1戦闘です。HP・敵HP・EXP・撃破状態を次の試行へ引き継ぎません。結果はこの仮想戦闘条件での試行集計であり、複数ターンの攻略率・キャンペーン勝率ではありません。
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
                              <td>{combatSamples.control.enemyDefeatRate.toFixed(1)}%（{combatSamples.control.enemyDefeats}/{combatSamples.sampleCount}）</td>
                              <td>{combatSamples.promotion.enemyDefeatRate.toFixed(1)}%（{combatSamples.promotion.enemyDefeats}/{combatSamples.sampleCount}）</td>
                              <td>{formatDelta(combatSamples.promotion.enemyDefeatRate - combatSamples.control.enemyDefeatRate, "pt")}</td>
                            </tr>
                            <tr>
                              <th scope="row">平均反撃被ダメージ／戦闘</th>
                              <td>{combatSamples.control.averageCounterDamagePerBattle.toFixed(1)}</td>
                              <td>{combatSamples.promotion.averageCounterDamagePerBattle.toFixed(1)}</td>
                              <td>{formatDelta(combatSamples.promotion.averageCounterDamagePerBattle - combatSamples.control.averageCounterDamagePerBattle, "")}</td>
                            </tr>
                            <tr>
                              <th scope="row">反撃後の生存率</th>
                              <td>{combatSamples.control.attackerSurvivalRate.toFixed(1)}%（{combatSamples.control.attackerSurvivals}/{combatSamples.sampleCount}）</td>
                              <td>{combatSamples.promotion.attackerSurvivalRate.toFixed(1)}%（{combatSamples.promotion.attackerSurvivals}/{combatSamples.sampleCount}）</td>
                              <td>{formatDelta(combatSamples.promotion.attackerSurvivalRate - combatSamples.control.attackerSurvivalRate, "pt")}</td>
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
          <li>読み込みはsaveVersion 3のJSON exportだけです。旧版の自動migration、IndexedDBへの読書き、ファイルのアップロード、サーバー送信はしません。</li>
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
