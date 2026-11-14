import { useMemo, useState } from "react";
import { getCampaignUnitBattleRecordsArchive, type CampaignUnitBattleRecordSort } from "../application/get-campaign-unit-battle-records-archive";
import type { CampaignUnitBattleRecord, UnitStats } from "../domain/models/game";

interface CampaignUnitBattleRecordPanelProps {
  record: CampaignUnitBattleRecord | null | undefined;
}

interface CampaignUnitBattleRecordsSummaryProps {
  records: readonly CampaignUnitBattleRecord[];
}

const STAT_LABELS: ReadonlyArray<{ key: keyof UnitStats; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "strength", label: "力" },
  { key: "magic", label: "魔力" },
  { key: "skill", label: "技" },
  { key: "speed", label: "速さ" },
  { key: "luck", label: "幸運" },
  { key: "defense", label: "守備" },
  { key: "resistance", label: "魔防" }
];

function formatStatGains(gains: UnitStats): string[] {
  return STAT_LABELS.flatMap(({ key, label }) =>
    gains[key] > 0 ? [label + " +" + gains[key]] : []
  );
}

export function CampaignUnitBattleRecordMetrics({ record }: { record: CampaignUnitBattleRecord }) {
  const gains = formatStatGains(record.statGains);
  return (
    <>
      <dl className="campaign-unit-record-metrics">
        <div><dt>攻撃行動</dt><dd>{record.attacks}</dd></div>
        <div><dt>実strike</dt><dd>{record.strikes}</dd></div>
        <div><dt>命中</dt><dd>{record.hits}</dd></div>
        <div><dt>ミス</dt><dd>{record.misses}</dd></div>
        <div><dt>必殺</dt><dd>{record.criticalHits}</dd></div>
        <div><dt>与ダメージ</dt><dd>{record.damageDealt}</dd></div>
        <div><dt>撃破</dt><dd>{record.enemiesDefeated}</dd></div>
        <div><dt>獲得EXP</dt><dd>+{record.experienceAwarded}</dd></div>
        <div><dt>レベルアップ</dt><dd>{record.levelUps}</dd></div>
      </dl>
      {gains.length > 0 && (
        <p className="campaign-unit-record-gains">累計能力上昇：{gains.join(" · ")}</p>
      )}
    </>
  );
}

/** Compact read-only campaign totals for one ally's detail panel. */
export function CampaignUnitBattleRecordPanel({ record }: CampaignUnitBattleRecordPanelProps) {
  return (
    <section className="campaign-unit-record-panel" aria-labelledby="campaign-unit-record-heading" data-testid="campaign-unit-battle-record">
      <h3 id="campaign-unit-record-heading">キャンペーン累計戦績</h3>
      {record ? (
        <CampaignUnitBattleRecordMetrics record={record} />
      ) : (
        <p className="helper-text">まだキャンペーン内の攻撃記録はありません。</p>
      )}
      <p className="helper-text campaign-unit-record-note">確定した味方開始攻撃のみを集計しています。敵の反撃は含みません。</p>
    </section>
  );
}

/** Persistent, per-ally campaign totals on the battle result screen. */
export function CampaignUnitBattleRecordsSummary({ records }: CampaignUnitBattleRecordsSummaryProps) {
  return (
    <section className="campaign-unit-record-summary" aria-labelledby="campaign-record-summary-heading" data-testid="campaign-unit-record-summary">
      <h2 id="campaign-record-summary-heading">キャンペーン累計戦績</h2>
      {records.length > 0 ? (
        <div className="campaign-unit-record-summary-list">
          {records.map((record) => (
            <article className="campaign-unit-record-card" key={record.unitId} data-testid={"campaign-unit-record-" + record.unitId}>
              <h3>{record.unitName}</h3>
              <Metrics record={record} />
            </article>
          ))}
        </div>
      ) : (
        <p className="helper-text">このキャンペーンには、まだ味方の攻撃記録がありません。</p>
      )}
      <p className="helper-text campaign-unit-record-note">この記録は章をまたいでセーブに保存されます。ステージ単位の戦闘履歴とは別の累計値です。</p>
    </section>
  );
}


/** Searchable, sortable read-only archive for the campaign's per-ally attack totals. */
export function CampaignUnitBattleRecordsArchive({
  records
}: CampaignUnitBattleRecordsSummaryProps) {
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<CampaignUnitBattleRecordSort>("damageDealt");
  const visibleRecords = useMemo(
    () => getCampaignUnitBattleRecordsArchive(records, query, sortBy),
    [records, query, sortBy]
  );
  const hasQuery = query.trim().length > 0;

  return (
    <section
      className="campaign-unit-record-archive"
      aria-labelledby="campaign-unit-record-archive-title"
      data-testid="campaign-unit-battle-records-archive"
    >
      <header className="campaign-unit-record-archive-header">
        <div>
          <h3 id="campaign-unit-record-archive-title">味方別の累計戦績</h3>
          <p className="helper-text">{visibleRecords.length} / {records.length}名を表示</p>
        </div>
      </header>

      <div className="campaign-battle-history-filters campaign-unit-record-archive-filters" role="group" aria-label="味方戦績の絞り込み">
        <label className="campaign-battle-history-filter">
          <span>並べ替え</span>
          <select
            aria-label="累計戦績の並べ替え"
            value={sortBy}
            onChange={(event) => setSortBy(event.currentTarget.value as CampaignUnitBattleRecordSort)}
          >
            <option value="damageDealt">与ダメージ順</option>
            <option value="enemiesDefeated">撃破数順</option>
            <option value="experienceAwarded">獲得EXP順</option>
            <option value="attacks">攻撃行動順</option>
            <option value="unitName">名前順</option>
          </select>
        </label>
        <label className="campaign-battle-history-filter campaign-unit-record-archive-search">
          <span>味方の名前</span>
          <input
            type="search"
            aria-label="味方戦績を名前で検索"
            placeholder="ユニット名"
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <button
          className="secondary-button campaign-battle-history-reset"
          type="button"
          onClick={() => setQuery("")}
          disabled={!hasQuery}
        >
          検索を解除
        </button>
      </div>

      {visibleRecords.length > 0 ? (
        <div className="campaign-unit-record-summary-list">
          {visibleRecords.map((record) => (
            <article
              className="campaign-unit-record-card campaign-unit-record-archive-card"
              key={record.unitId}
              data-testid="campaign-unit-record-entry"
              data-unit-id={record.unitId}
            >
              <h4>{record.unitName}</h4>
              <CampaignUnitBattleRecordMetrics record={record} />
            </article>
          ))}
        </div>
      ) : records.length === 0 ? (
        <p className="helper-text">このキャンペーンには、まだ味方の攻撃記録がありません。</p>
      ) : (
        <p className="campaign-battle-history-empty" role="status">
          名前に一致する味方の記録はありません。検索を解除してください。
        </p>
      )}

      <p className="helper-text campaign-unit-record-note">
        確定した味方開始攻撃の累計です。敵の反撃は含まず、記録の閲覧・検索・並べ替えでセーブは変わりません。
      </p>
    </section>
  );
}
