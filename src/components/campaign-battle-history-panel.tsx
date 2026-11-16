import { useMemo, useState } from "react";
import {
  getCampaignBattleLogCoverage,
  type CampaignBattleHistoryEntry,
  type CampaignBattleLogCoverage
} from "../application/get-campaign-battle-history";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import { CampaignUnitBattleRecordsArchive } from "./campaign-unit-battle-records";
import { buildCampaignBattleHistoryCsv, buildCampaignEnemyStrikeSummaryCsv, buildCampaignIncomingStrikeSummaryCsv, type CampaignBattleHistoryCsvExportScope } from "../application/export-campaign-archive-csv";
import { getCampaignIncomingStrikeSummary, type CampaignIncomingStrikeSummary } from "../application/get-campaign-incoming-strike-summary";
import { getCampaignEnemyStrikeSummary, type CampaignEnemyStrikeSummary } from "../application/get-campaign-enemy-strike-summary";
import { downloadCsv } from "./download-csv";
import {
  filterCampaignBattleHistory,
  getCampaignBattleHistoryUnitOptions,
  type CampaignBattleHistoryCategory
} from "../application/filter-campaign-battle-history";
import type { CampaignBattleLogEntry, CampaignBattleStrikeRecord } from "../domain/models/game";

export interface CampaignBattleHistoryPanelProps {
  entries: readonly CampaignBattleHistoryEntry[];
  unitRecords: readonly CampaignUnitBattleRecord[];
  onClose: () => void;
}

const CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE = 50;

const PLAYER_ACTION_LABELS: Record<Extract<CampaignBattleLogEntry, { kind: "player-action" }>["action"], string> = {
  movement: "移動",
  "weapon-change": "武器変更",
  "item-use": "アイテム使用",
  "class-change": "クラスチェンジ",
  "map-interaction": "マップ調査",
  wait: "待機"
};

const ENEMY_ACTION_LABELS: Record<Extract<CampaignBattleLogEntry, { kind: "enemy-action" }>["actionKind"], string> = {
  attacked: "攻撃",
  "moved-and-attacked": "移動・攻撃",
  moved: "移動",
  waited: "待機"
};

function CampaignBattleHistoryCoverage({ coverage }: { coverage: CampaignBattleLogCoverage }) {
  return (
    <section className="campaign-battle-history-coverage" aria-label="保存された戦闘記録の保持状況" data-testid="campaign-battle-history-coverage">
      <div className="campaign-battle-history-coverage-heading">
        <strong>保存された時系列記録</strong>
        <span>保持件数: {coverage.retainedCount.toLocaleString("ja-JP")} / {coverage.retentionLimit.toLocaleString("ja-JP")}件</span>
      </div>
      {coverage.retainedCount > 0 ? (
        <>
          <p>連番範囲: {coverage.firstSequence?.toLocaleString("ja-JP")}–{coverage.lastSequence?.toLocaleString("ja-JP")}</p>
          <p>先頭より前の未保持連番: {coverage.unretainedLeadingSequenceCount.toLocaleString("ja-JP")}件</p>
          <p>保持範囲内の連番欠番: {coverage.missingSequenceCount.toLocaleString("ja-JP")}件</p>
        </>
      ) : (
        <p>キャンペーン戦闘記録はまだありません。</p>
      )}
      {coverage.unretainedLeadingSequenceCount > 0 && (
        <p className="campaign-battle-history-coverage-note">
          sequenceは1から採番されます。最初に保持された記録より前の番号は現在のログに含まれません。この集計だけでは、その理由や行動内容を判断できません。
        </p>
      )}
      {coverage.missingSequenceCount > 0 && (
        <p className="campaign-battle-history-coverage-note">
          保持範囲内で連番の欠番を検出しました。欠けた行動内容は推測で補いません。
        </p>
      )}
      {coverage.reachedRetentionLimit && (
        <p className="campaign-battle-history-coverage-note">
          保存上限の5,000件を保持しています。より古い記録が保持対象に含まれない可能性がありますが、上限到達だけでは過去記録が削除済みとは断定できません。
        </p>
      )}
    </section>
  );
}

function strikeLabel(strike: CampaignBattleStrikeRecord): string {
  const outcome = strike.outcome === "miss" ? "ミス" : strike.outcome === "critical" ? "必殺" : "命中";
  return `${strike.actorName} → ${strike.targetName} · ${strike.weaponName} · ${outcome} · ${strike.damage}ダメージ · HP ${strike.targetHpBefore} → ${strike.targetHpAfter}`;
}

function buildDefeatCounts(entries: readonly CampaignBattleHistoryEntry[]) {
  const byActor = new Map<string, { actorId: string; actorName: string; count: number }>();
  for (const entry of entries) {
    if (entry.kind !== "player-attack" && entry.kind !== "enemy-action") continue;
    for (const strike of entry.strikes) {
      if (strike.targetHpBefore <= 0 || strike.targetHpAfter !== 0) continue;
      const previous = byActor.get(strike.actorId);
      byActor.set(strike.actorId, {
        actorId: strike.actorId,
        actorName: strike.actorName,
        count: (previous?.count ?? 0) + 1
      });
    }
  }
  return [...byActor.values()].sort((left, right) =>
    right.count - left.count || left.actorName.localeCompare(right.actorName)
  );
}


export function CampaignIncomingStrikeSummaryView({
  summaries,
  coverage,
  onExport
}: {
  summaries: readonly CampaignIncomingStrikeSummary[];
  coverage: CampaignBattleLogCoverage;
  onExport: () => void;
}) {
  const hasIncompleteLog = coverage.reachedRetentionLimit
    || coverage.unretainedLeadingSequenceCount > 0
    || coverage.missingSequenceCount > 0;

  return (
    <section className="campaign-incoming-strike-summary" aria-labelledby="campaign-incoming-strike-title" data-testid="campaign-incoming-strikes">
      <header className="campaign-incoming-strike-header">
        <div>
          <h3 id="campaign-incoming-strike-title">味方が受けた攻撃（保持ログ内）</h3>
          <p>敵軍の攻撃と、味方攻撃に対する敵側の反撃を実strikeから集計します。</p>
        </div>
        <button
          className="secondary-button campaign-battle-history-export"
          type="button"
          aria-label="被攻撃集計をCSV出力"
          disabled={summaries.length === 0}
          onClick={onExport}
        >
          被攻撃集計をCSV出力
        </button>
      </header>
      {hasIncompleteLog && (
        <p className="campaign-incoming-strike-warning" role="note">
          先頭より前の未保持連番 {coverage.unretainedLeadingSequenceCount.toLocaleString("ja-JP")}件、
          保持範囲内の欠番 {coverage.missingSequenceCount.toLocaleString("ja-JP")}件、
          上限到達 {coverage.reachedRetentionLimit ? "あり" : "なし"}。
          集計は現在保持しているログのみを対象とし、欠けた行動は補完しません。
        </p>
      )}
      {summaries.length > 0 ? (
        <ol className="campaign-incoming-strike-list">
          {summaries.map((summary) => (
            <li key={summary.unitId} data-testid="campaign-incoming-strike-entry" data-unit-id={summary.unitId}>
              <article className="campaign-incoming-strike-card">
                <header>
                  <strong>{summary.unitName}</strong>
                  <span>{summary.unitId}</span>
                </header>
                <dl>
                  <div><dt>被攻撃strike</dt><dd>{summary.receivedStrikes.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>被弾</dt><dd>{summary.hitsReceived.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>ミス</dt><dd>{summary.missesAvoided.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>被必殺</dt><dd>{summary.criticalHitsReceived.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>被ダメージ</dt><dd>{summary.damageReceived.toLocaleString("ja-JP")}</dd></div>
                  <div><dt>攻撃者数</dt><dd>{summary.attackerCount.toLocaleString("ja-JP")}人</dd></div>
                  <div><dt>最新連番</dt><dd>{summary.lastSequence.toLocaleString("ja-JP")}</dd></div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="campaign-battle-history-empty" role="status">
          保持中のログに、味方が受けた敵軍strikeはありません。
        </p>
      )}
      <p className="campaign-incoming-strike-footnote">
        被攻撃strike数にはミスも含みます。被ダメージは記録済みstrikeのダメージ合計で、味方のいないログや未保持ログの0件行は追加しません。
      </p>
    </section>
  );
}


export function CampaignEnemyStrikeSummaryView({
  summaries,
  coverage,
  onExport
}: {
  summaries: readonly CampaignEnemyStrikeSummary[];
  coverage: CampaignBattleLogCoverage;
  onExport: () => void;
}) {
  const hasIncompleteLog = coverage.reachedRetentionLimit
    || coverage.unretainedLeadingSequenceCount > 0
    || coverage.missingSequenceCount > 0;

  return (
    <section className="campaign-enemy-strike-summary campaign-incoming-strike-summary" aria-labelledby="campaign-enemy-strike-title" data-testid="campaign-enemy-strikes">
      <header className="campaign-enemy-strike-header campaign-incoming-strike-header">
        <div>
          <h3 id="campaign-enemy-strike-title">敵ユニット別の攻撃（保持ログ内）</h3>
          <p>敵軍フェイズの実攻撃と、味方攻撃に対する敵側の反撃を章・敵ユニット別に集計します。</p>
        </div>
        <button
          className="secondary-button campaign-battle-history-export"
          type="button"
          aria-label="敵攻撃集計をCSV出力"
          disabled={summaries.length === 0}
          onClick={onExport}
        >
          敵攻撃集計をCSV出力
        </button>
      </header>
      {hasIncompleteLog && (
        <p className="campaign-enemy-strike-warning campaign-incoming-strike-warning" role="note">
          先頭より前の未保持連番 {coverage.unretainedLeadingSequenceCount.toLocaleString("ja-JP")}件、
          保持範囲内の欠番 {coverage.missingSequenceCount.toLocaleString("ja-JP")}件、
          上限到達 {coverage.reachedRetentionLimit ? "あり" : "なし"}。
          集計は現在保持しているログのみを対象とし、欠けた行動は補完しません。
        </p>
      )}
      {summaries.length > 0 ? (
        <ol className="campaign-enemy-strike-list campaign-incoming-strike-list">
          {summaries.map((summary) => (
            <li key={summary.chapterId + "\u0000" + summary.enemyId} data-testid="campaign-enemy-strike-entry" data-chapter-id={summary.chapterId} data-unit-id={summary.enemyId}>
              <article className="campaign-enemy-strike-card campaign-incoming-strike-card">
                <header>
                  <strong>{summary.chapterNumber === null ? summary.chapterTitle : `第${summary.chapterNumber}章 · ${summary.chapterTitle}`} · {summary.enemyName}</strong>
                  <span>{summary.enemyId}</span>
                </header>
                <dl>
                  <div><dt>攻撃strike</dt><dd>{summary.attackStrikes.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>命中</dt><dd>{summary.hits.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>ミス</dt><dd>{summary.misses.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>必殺</dt><dd>{summary.criticalHits.toLocaleString("ja-JP")}回</dd></div>
                  <div><dt>与ダメージ</dt><dd>{summary.damageDealt.toLocaleString("ja-JP")}</dd></div>
                  <div><dt>攻撃対象味方</dt><dd>{summary.targetCount.toLocaleString("ja-JP")}人</dd></div>
                  <div><dt>味方撃破</dt><dd>{summary.alliesDefeated.toLocaleString("ja-JP")}人</dd></div>
                  <div><dt>最新連番</dt><dd>{summary.lastSequence.toLocaleString("ja-JP")}</dd></div>
                </dl>
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="campaign-battle-history-empty" role="status">
          保持中のログに、敵軍が実際に行ったstrikeはありません。
        </p>
      )}
      <p className="campaign-enemy-strike-footnote campaign-incoming-strike-footnote">
        攻撃strike数にはミスも含みます。与ダメージ・味方撃破数は記録済みstrikeだけから算出し、履歴に登場しない敵の0件行は追加しません。
      </p>
    </section>
  );
}

export function CampaignBattleHistoryPanel({ entries, unitRecords, onClose }: CampaignBattleHistoryPanelProps) {
  const [activeView, setActiveView] = useState<"timeline" | "units" | "incoming" | "enemy">("timeline");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<CampaignBattleHistoryCategory>("all");
  const [unitFilter, setUnitFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const logCoverage = useMemo(() => getCampaignBattleLogCoverage(entries), [entries]);
  const incomingSummaries = useMemo(() => getCampaignIncomingStrikeSummary(entries), [entries]);
  const enemySummaries = useMemo(() => getCampaignEnemyStrikeSummary(entries), [entries]);

  const chapters = useMemo(() => {
    const byId = new Map<string, { id: string; chapterNumber: number | null; title: string }>();
    for (const entry of entries) {
      if (!byId.has(entry.chapterId)) {
        byId.set(entry.chapterId, {
          id: entry.chapterId,
          chapterNumber: entry.chapterNumber,
          title: entry.chapterTitle
        });
      }
    }
    return [...byId.values()];
  }, [entries]);

  const unitOptions = useMemo(() => getCampaignBattleHistoryUnitOptions(entries), [entries]);
  const filteredEntries = useMemo(() => filterCampaignBattleHistory(entries, {
    chapterId: chapterFilter,
    category: categoryFilter,
    unitId: unitFilter,
    query
  }), [entries, chapterFilter, categoryFilter, unitFilter, query]);
  const defeatCounts = useMemo(() => buildDefeatCounts(filteredEntries), [filteredEntries]);
  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE));
  const currentPageIndex = Math.min(pageIndex, totalPages - 1);
  const pageStartIndex = currentPageIndex * CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE;
  const pageEntries = filteredEntries.slice(
    pageStartIndex,
    pageStartIndex + CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE
  );
  const pageRangeLabel = filteredEntries.length > CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE
    ? `${pageStartIndex + 1}–${pageStartIndex + pageEntries.length} / ${filteredEntries.length}件を表示 · 全${entries.length}件`
    : `${filteredEntries.length} / ${entries.length}件を表示 · 発生順`;
  const hasActiveFilter = chapterFilter !== "all" || categoryFilter !== "all" || unitFilter !== "all" || query.trim().length > 0;

  function clearFilters() {
    setChapterFilter("all");
    setCategoryFilter("all");
    setUnitFilter("all");
    setQuery("");
    setPageIndex(0);
  }

  function exportTimeline(scope: CampaignBattleHistoryCsvExportScope): void {
    const exportEntries = scope === "all-retained" ? entries : filteredEntries;
    const suffix = scope === "all-retained" ? "all-retained" : "filtered";
    downloadCsv(buildCampaignBattleHistoryCsv(exportEntries, {
      scope,
      retainedEntries: entries,
      filters: { chapterId: chapterFilter, category: categoryFilter, unitId: unitFilter, query: query.trim() }
    }), "campaign-battle-history-" + suffix + "-" + new Date().toISOString().slice(0, 10) + ".csv");
  }

  function exportIncomingSummary(): void {
    downloadCsv(
      buildCampaignIncomingStrikeSummaryCsv(incomingSummaries, logCoverage),
      "campaign-incoming-strikes-" + new Date().toISOString().slice(0, 10) + ".csv"
    );
  }

  function exportEnemySummary(): void {
    downloadCsv(
      buildCampaignEnemyStrikeSummaryCsv(enemySummaries, logCoverage),
      "campaign-enemy-strikes-" + new Date().toISOString().slice(0, 10) + ".csv"
    );
  }

  return (
    <section
      id="campaign-battle-history-panel"
      className="campaign-battle-history-panel"
      role="region"
      aria-labelledby="campaign-battle-history-title"
      data-testid="campaign-battle-history"
      onKeyDown={(keyboardEvent) => {
        if (keyboardEvent.key === "Escape") {
          keyboardEvent.preventDefault();
          onClose();
        }
      }}
    >
      <header className="campaign-battle-history-header">
        <div>
          <p className="eyebrow">CAMPAIGN BATTLE LOG</p>
          <h2 id="campaign-battle-history-title">キャンペーン戦闘記録</h2>
          <p className="campaign-battle-history-note" aria-live="polite" data-testid="campaign-history-page-status">
            {activeView === "timeline"
              ? pageRangeLabel
              : activeView === "units"
                ? `${unitRecords.length}名 · 味方別の累計戦績`
                : activeView === "incoming"
                  ? `${incomingSummaries.length}名 · 保持ログの被攻撃集計`
                  : `${enemySummaries.length}件 · 保持ログの敵攻撃集計`}
          </p>
        </div>
        <button className="secondary-button campaign-battle-history-close" type="button" onClick={onClose}>
          閉じる
        </button>
      </header>

      <div className="campaign-battle-history-tabs" role="group" aria-label="キャンペーン記録の表示切替">
        <button
          className="secondary-button"
          type="button"
          aria-pressed={activeView === "timeline"}
          onClick={() => setActiveView("timeline")}
        >
          時系列ログ
        </button>
        <button
          className="secondary-button"
          type="button"
          aria-pressed={activeView === "units"}
          onClick={() => setActiveView("units")}
        >
          味方別累計
        </button>
        <button
          className="secondary-button"
          type="button"
          aria-pressed={activeView === "incoming"}
          onClick={() => setActiveView("incoming")}
        >
          被攻撃集計
        </button>
        <button
          className="secondary-button"
          type="button"
          aria-pressed={activeView === "enemy"}
          onClick={() => setActiveView("enemy")}
        >
          敵攻撃集計
        </button>
      </div>

      {activeView === "timeline" ? (
        <>
      <CampaignBattleHistoryCoverage coverage={logCoverage} />
      <div className="campaign-battle-history-filters" role="group" aria-label="戦闘記録の絞り込み">
        <label className="campaign-battle-history-filter">
          <span>章</span>
          <select
            aria-label="章で絞り込み"
            value={chapterFilter}
            onChange={(event) => {
              setChapterFilter(event.currentTarget.value);
              setPageIndex(0);
            }}
          >
            <option value="all">すべての章</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.chapterNumber === null
                  ? chapter.title
                  : `第${chapter.chapterNumber}章 · ${chapter.title}`}
              </option>
            ))}
          </select>
        </label>
        <label className="campaign-battle-history-filter">
          <span>記録種別</span>
          <select
            aria-label="記録種別で絞り込み"
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.currentTarget.value as CampaignBattleHistoryCategory);
              setPageIndex(0);
            }}
          >
            <option value="all">すべての記録</option>
            <option value="player">味方の行動・攻撃</option>
            <option value="enemy">敵軍行動</option>
            <option value="result">章結果</option>
          </select>
        </label>
        <label className="campaign-battle-history-filter">
          <span>味方ユニット</span>
          <select
            aria-label="味方ユニットで絞り込み"
            value={unitFilter}
            onChange={(event) => {
              setUnitFilter(event.currentTarget.value);
              setPageIndex(0);
            }}
          >
            <option value="all">すべての味方</option>
            {unitOptions.map((unit) => (
              <option key={unit.unitId} value={unit.unitId}>
                {unit.unitName}（{unit.unitId}）
              </option>
            ))}
          </select>
        </label>
        <label className="campaign-battle-history-filter campaign-battle-history-search">
          <span>キーワード</span>
          <input
            type="search"
            aria-label="履歴内を検索"
            placeholder="ユニット名・武器・内容"
            value={query}
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              setPageIndex(0);
            }}
          />
        </label>
        <button
          className="secondary-button campaign-battle-history-reset"
          type="button"
          onClick={clearFilters}
          disabled={!hasActiveFilter}
        >
          絞り込みを解除
        </button>
        <button className="secondary-button campaign-battle-history-reset campaign-battle-history-export" type="button" aria-label="絞り込み結果をCSV出力" disabled={filteredEntries.length === 0} onClick={() => exportTimeline("filtered")}>
          絞り込み結果をCSV出力
        </button>
        <button className="secondary-button campaign-battle-history-reset campaign-battle-history-export" type="button" aria-label="保持ログ全件をCSV出力" disabled={entries.length === 0} onClick={() => exportTimeline("all-retained")}>
          保持ログ全件をCSV出力
        </button>
      </div>
      <p className="campaign-battle-history-export-note">
        「絞り込み結果」は章・種別・味方ユニット・キーワードに一致した記録のみ、「保持ログ全件」は画面の絞り込みに関係なく保存中の最大5,000件を出力します。CSVには出力範囲と、選択中の絞り込み条件、絞り込み前の保持状況・連番監査値を記録します。
      </p>

      <section className="campaign-battle-defeats" aria-labelledby="campaign-battle-defeats-title">
        <h3 id="campaign-battle-defeats-title">撃破者別記録（絞り込み結果全体）</h3>
        {defeatCounts.length > 0 ? (
          <ul>
            {defeatCounts.map((record) => (
              <li key={record.actorId}><strong>{record.actorName}</strong><span>{record.count}体撃破</span></li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">絞り込み結果に確定した撃破はありません。</p>
        )}
      </section>

      {filteredEntries.length > CAMPAIGN_BATTLE_HISTORY_PAGE_SIZE && (
        <nav className="campaign-battle-history-pagination" aria-label="時系列ログのページ送り" data-testid="campaign-battle-history-pagination">
          <button
            className="secondary-button"
            type="button"
            aria-label="最初のページ"
            disabled={currentPageIndex === 0}
            onClick={() => setPageIndex(0)}
          >
            最初
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-label="前のページ"
            disabled={currentPageIndex === 0}
            onClick={() => setPageIndex(Math.max(0, currentPageIndex - 1))}
          >
            前へ
          </button>
          <span aria-live="polite">ページ {currentPageIndex + 1} / {totalPages}</span>
          <button
            className="secondary-button"
            type="button"
            aria-label="次のページ"
            disabled={currentPageIndex >= totalPages - 1}
            onClick={() => setPageIndex(Math.min(totalPages - 1, currentPageIndex + 1))}
          >
            次へ
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-label="最後のページ"
            disabled={currentPageIndex >= totalPages - 1}
            onClick={() => setPageIndex(totalPages - 1)}
          >
            最後
          </button>
        </nav>
      )}

      {filteredEntries.length > 0 ? (
        <ol className="campaign-battle-history-list" aria-label="絞り込み後のキャンペーン戦闘記録">
          {pageEntries.map((entry) => (
            <li key={entry.sequence}>
              <article className="campaign-battle-history-entry" data-testid="campaign-battle-log-entry" data-sequence={entry.sequence}>
                <div className="campaign-battle-history-entry-heading">
                  <span>{entry.chapterNumber === null ? entry.chapterTitle : `第${entry.chapterNumber}章 · ${entry.chapterTitle}`}</span>
                  <strong>第{entry.turn}ターン</strong>
                </div>
                {entry.kind === "player-action" ? (
                  <>
                    <h4>{entry.actorName} · {PLAYER_ACTION_LABELS[entry.action]}</h4>
                    <p>{entry.detail}</p>
                  </>
                ) : entry.kind === "player-attack" ? (
                  <>
                    <h4>{entry.attackerName} → {entry.defenderName} · 味方の攻撃</h4>
                    <p>{entry.defenderRemainingHp === 0 ? "撃破" : `残りHP ${entry.defenderRemainingHp}`} · 獲得EXP +{entry.experienceAwarded}</p>
                    <ul className="campaign-battle-strikes">
                      {entry.strikes.map((strike, index) => <li key={index}>{strikeLabel(strike)}</li>)}
                    </ul>
                  </>
                ) : entry.kind === "enemy-action" ? (
                  <>
                    <h4>{entry.enemyName} · 敵軍行動（{ENEMY_ACTION_LABELS[entry.actionKind]}）</h4>
                    {entry.targetName && <p>対象: {entry.targetName}</p>}
                    {entry.destination && <p>移動先: {entry.destination.x + 1}列・{entry.destination.y + 1}行</p>}
                    {entry.strikes.length > 0 && (
                      <ul className="campaign-battle-strikes">
                        {entry.strikes.map((strike, index) => <li key={index}>{strikeLabel(strike)}</li>)}
                      </ul>
                    )}
                  </>
                ) : (
                  <>
                    <h4>{entry.outcome === "victory" ? "ステージクリア" : "敗北"} · {entry.reason === "objective-cleared" ? "勝利条件達成" : entry.reason === "party-wiped" ? "味方全滅" : "保護対象の敗北"}</h4>
                    <p>{entry.objective === "defeat_boss" ? "敵将撃破目標" : "敵全滅目標"} · 生存味方 {entry.livingPlayerCount}名 · 生存敵 {entry.livingEnemyCount}体</p>
                  </>
                )}
              </article>
            </li>
          ))}
        </ol>
      ) : (
        <p className="campaign-battle-history-empty" role="status">
          条件に一致する戦闘記録はありません。絞り込みを解除してください。
        </p>
      )}

      <p className="campaign-battle-history-footnote">
        実際に確定した行動・攻撃結果と章の勝敗結果のみを保存しています。敵AIの予測や候補評価は含みません。
        最大5,000件を保持し、上限を超えると古い履歴から入れ替わります。
      </p>
        </>
      ) : activeView === "units" ? (
        <CampaignUnitBattleRecordsArchive records={unitRecords} />
      ) : activeView === "incoming" ? (
        <CampaignIncomingStrikeSummaryView
          summaries={incomingSummaries}
          coverage={logCoverage}
          onExport={exportIncomingSummary}
        />
      ) : (
        <CampaignEnemyStrikeSummaryView
          summaries={enemySummaries}
          coverage={logCoverage}
          onExport={exportEnemySummary}
        />
      )}
    </section>
  );
}
