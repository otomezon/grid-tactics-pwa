import { useMemo, useState } from "react";
import {
  getCampaignBattleLogCoverage,
  type CampaignBattleHistoryEntry,
  type CampaignBattleLogCoverage
} from "../application/get-campaign-battle-history";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import { CampaignUnitBattleRecordsArchive } from "./campaign-unit-battle-records";
import { buildCampaignBattleHistoryCsv } from "../application/export-campaign-archive-csv";
import { downloadCsv } from "./download-csv";
import {
  filterCampaignBattleHistory,
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
          <p>保持範囲内の連番欠番: {coverage.missingSequenceCount.toLocaleString("ja-JP")}件</p>
        </>
      ) : (
        <p>キャンペーン戦闘記録はまだありません。</p>
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

export function CampaignBattleHistoryPanel({ entries, unitRecords, onClose }: CampaignBattleHistoryPanelProps) {
  const [activeView, setActiveView] = useState<"timeline" | "units">("timeline");
  const [chapterFilter, setChapterFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<CampaignBattleHistoryCategory>("all");
  const [query, setQuery] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const logCoverage = useMemo(() => getCampaignBattleLogCoverage(entries), [entries]);

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

  const filteredEntries = useMemo(() => filterCampaignBattleHistory(entries, {
    chapterId: chapterFilter,
    category: categoryFilter,
    query
  }), [entries, chapterFilter, categoryFilter, query]);
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
  const hasActiveFilter = chapterFilter !== "all" || categoryFilter !== "all" || query.trim().length > 0;

  function clearFilters() {
    setChapterFilter("all");
    setCategoryFilter("all");
    setQuery("");
    setPageIndex(0);
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
              : `${unitRecords.length}名 · 味方別の累計戦績`}
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
        <button
          className="secondary-button campaign-battle-history-reset campaign-battle-history-export"
          type="button"
          aria-label="時系列ログをCSV出力"
          disabled={filteredEntries.length === 0}
          onClick={() => downloadCsv(
            buildCampaignBattleHistoryCsv(filteredEntries),
            "campaign-battle-history-" + new Date().toISOString().slice(0, 10) + ".csv"
          )}
        >
          CSV出力
        </button>
      </div>

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
      ) : (
        <CampaignUnitBattleRecordsArchive records={unitRecords} />
      )}
    </section>
  );
}
