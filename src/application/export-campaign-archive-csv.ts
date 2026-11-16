import type { CampaignBattleStrikeRecord, CampaignUnitBattleRecord } from "../domain/models/game";
import type { CampaignIncomingStrikeSummary } from "./get-campaign-incoming-strike-summary";
import type { CampaignEnemyStrikeSummary } from "./get-campaign-enemy-strike-summary";
import { getCampaignBattleLogCoverage, type CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import type { CampaignBattleHistoryCategory } from "./filter-campaign-battle-history";
import type { CampaignUnitBattleRecordSort } from "./get-campaign-unit-battle-records-archive";

type CsvCell = string | number | null | undefined;

const PLAYER_ACTION_LABELS: Record<Extract<CampaignBattleHistoryEntry, { kind: "player-action" }>["action"], string> = {
  movement: "移動", "weapon-change": "武器変更", "item-use": "アイテム使用",
  "class-change": "クラスチェンジ", "map-interaction": "マップ調査", wait: "待機"
};
const ENEMY_ACTION_LABELS: Record<Extract<CampaignBattleHistoryEntry, { kind: "enemy-action" }>["actionKind"], string> = {
  attacked: "攻撃", "moved-and-attacked": "移動・攻撃", moved: "移動", waited: "待機"
};
const STRIKE_KIND_LABELS: Record<CampaignBattleStrikeRecord["kind"], string> = {
  initial: "初撃", counter: "反撃", "follow-up": "追撃"
};
const STRIKE_OUTCOME_LABELS: Record<CampaignBattleStrikeRecord["outcome"], string> = {
  miss: "ミス", hit: "命中", critical: "必殺"
};

function escapeCsvCell(value: CsvCell): string {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe = typeof value === "string" && /^[\u0000-\u0020]*[=+\-@]/u.test(value) ? "'" + value : raw;
  return '"' + safe.replace(/"/gu, '""') + '"';
}

function serializeCsv(rows: readonly (readonly CsvCell[])[]): string {
  return "\uFEFF" + rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n") + "\r\n";
}

export type CampaignBattleHistoryCsvExportScope = "filtered" | "all-retained";

export interface CampaignBattleHistoryCsvExportContext {
  scope: CampaignBattleHistoryCsvExportScope;
  /** The full retained timeline, before any on-screen filters are applied. */
  retainedEntries: readonly Pick<CampaignBattleHistoryEntry, "sequence">[];
  filters: { chapterId: string; category: CampaignBattleHistoryCategory; unitId: string; query: string };
}

function getExportMetadata(entries: readonly CampaignBattleHistoryEntry[], context: CampaignBattleHistoryCsvExportContext): CsvCell[] {
  const coverage = getCampaignBattleLogCoverage(context.retainedEntries);
  return [context.scope === "all-retained" ? "保持ログ全件" : "絞り込み結果", entries.length, coverage.retainedCount, coverage.retentionLimit, coverage.firstSequence ?? "", coverage.lastSequence ?? "", coverage.unretainedLeadingSequenceCount, coverage.missingSequenceCount, coverage.reachedRetentionLimit ? "はい" : "いいえ", context.filters.chapterId, context.filters.category, context.filters.unitId, context.filters.query];
}

/** Exports confirmed campaign-log facts only. Each saved actual strike gets its own row. */
export function buildCampaignBattleHistoryCsv(entries: readonly CampaignBattleHistoryEntry[], context?: CampaignBattleHistoryCsvExportContext): string {
  const metadataHeaders = context ? ["出力範囲", "出力記録件数", "保持ログ件数", "保持上限件数", "保持先頭連番", "保持末尾連番", "先頭より前の未保持連番", "保持範囲内の連番欠番", "保持上限到達", "画面の章フィルター", "画面の記録種別フィルター", "画面の味方ユニットフィルター", "画面のキーワードフィルター"] : [];
  const headers: CsvCell[] = [...(context ? ["CSV行種別"] : []),
    "連番", "章ID", "章番号", "章名", "ターン", "記録種別", "行動",
    "行動者ID", "行動者名", "対象ID", "対象名", "詳細", "対象残HP", "獲得EXP",
    "勝敗", "勝敗理由", "勝利目標", "生存味方数", "生存敵数", "移動先X", "移動先Y",
    "strike番号", "strike種別", "strike行動者ID", "strike行動者名", "strike対象ID",
    "strike対象名", "武器", "strike結果", "ダメージ", "対象HP（攻撃前）", "対象HP（攻撃後）", ...metadataHeaders
  ];
  const rows: CsvCell[][] = [headers];
  const exportMetadata = context ? getExportMetadata(entries, context) : [];
  if (context && entries.length === 0) rows.push(["エクスポート情報", ...Array<CsvCell>(headers.length - metadataHeaders.length - 1).fill(""), ...exportMetadata]);

  for (const entry of entries) {
    let recordKind = "";
    let action = "";
    let actorId = "";
    let actorName = "";
    let targetId = "";
    let targetName = "";
    let detail = "";
    let targetRemainingHp: number | "" = "";
    let experienceAwarded: number | "" = "";
    let outcome = "";
    let reason = "";
    let objective = "";
    let livingPlayerCount: number | "" = "";
    let livingEnemyCount: number | "" = "";
    let destinationX: number | "" = "";
    let destinationY: number | "" = "";
    let strikes: readonly CampaignBattleStrikeRecord[] = [];

    switch (entry.kind) {
      case "player-action":
        recordKind = "味方行動";
        action = PLAYER_ACTION_LABELS[entry.action];
        actorId = entry.actorId;
        actorName = entry.actorName;
        detail = entry.detail;
        break;
      case "player-attack":
        recordKind = "味方攻撃";
        action = "攻撃";
        actorId = entry.attackerId;
        actorName = entry.attackerName;
        targetId = entry.defenderId;
        targetName = entry.defenderName;
        targetRemainingHp = entry.defenderRemainingHp;
        experienceAwarded = entry.experienceAwarded;
        strikes = entry.strikes;
        break;
      case "enemy-action":
        recordKind = "敵軍行動";
        action = ENEMY_ACTION_LABELS[entry.actionKind];
        actorId = entry.enemyId;
        actorName = entry.enemyName;
        targetId = entry.targetId ?? "";
        targetName = entry.targetName ?? "";
        destinationX = entry.destination ? entry.destination.x + 1 : "";
        destinationY = entry.destination ? entry.destination.y + 1 : "";
        strikes = entry.strikes;
        break;
      case "chapter-result":
        recordKind = "章結果";
        action = "勝敗結果";
        outcome = entry.outcome === "victory" ? "勝利" : "敗北";
        reason = entry.reason === "objective-cleared" ? "勝利条件達成"
          : entry.reason === "party-wiped" ? "味方全滅" : "保護対象の敗北";
        objective = entry.objective === "defeat_boss" ? "敵将撃破" : "敵全滅";
        livingPlayerCount = entry.livingPlayerCount;
        livingEnemyCount = entry.livingEnemyCount;
        break;
    }

    for (let index = 0; index < Math.max(strikes.length, 1); index += 1) {
      const strike = strikes[index] ?? null;
      rows.push([
        ...(context ? ["戦闘ログ"] : []),
        entry.sequence, entry.chapterId, entry.chapterNumber ?? "", entry.chapterTitle, entry.turn,
        recordKind, action, actorId, actorName, targetId, targetName, detail,
        targetRemainingHp, experienceAwarded, outcome, reason, objective,
        livingPlayerCount, livingEnemyCount, destinationX, destinationY,
        strike ? index + 1 : "", strike ? STRIKE_KIND_LABELS[strike.kind] : "",
        strike?.actorId ?? "", strike?.actorName ?? "", strike?.targetId ?? "",
        strike?.targetName ?? "", strike?.weaponName ?? "",
        strike ? STRIKE_OUTCOME_LABELS[strike.outcome] : "",
        strike?.damage ?? "", strike?.targetHpBefore ?? "", strike?.targetHpAfter ?? "", ...exportMetadata
      ]);
    }
  }

  return serializeCsv(rows);
}

export type CampaignUnitBattleRecordsCsvExportScope = "filtered" | "all-records";

export interface CampaignUnitBattleRecordsCsvExportContext {
  scope: CampaignUnitBattleRecordsCsvExportScope;
  totalRecordCount: number;
  query: string;
  sortBy: CampaignUnitBattleRecordSort;
}

const UNIT_RECORD_SORT_LABELS: Record<CampaignUnitBattleRecordSort, string> = {
  damageDealt: "与ダメージ順",
  enemiesDefeated: "撃破数順",
  experienceAwarded: "獲得EXP順",
  attacks: "攻撃行動順",
  unitName: "名前順"
};

/** Exports the ordered per-ally metrics supplied by the current archive view. */
export function buildCampaignUnitBattleRecordsCsv(
  records: readonly CampaignUnitBattleRecord[],
  context?: CampaignUnitBattleRecordsCsvExportContext
): string {
  const metadataHeaders = context
    ? ["出力範囲", "出力対象人数", "累計記録人数", "画面の検索キーワード", "画面の並べ替え"]
    : [];
  const headers: CsvCell[] = [
    ...(context ? ["CSV行種別"] : []),
    "味方ID", "名前", "攻撃行動", "実strike", "命中", "ミス", "必殺", "与ダメージ",
    "撃破", "獲得EXP", "レベルアップ", "HP上昇", "力上昇", "魔力上昇", "技上昇",
    "速さ上昇", "幸運上昇", "守備上昇", "魔防上昇",
    ...metadataHeaders
  ];
  const rows: CsvCell[][] = [headers];
  const exportMetadata: CsvCell[] = context ? [
    context.scope === "all-records" ? "累計全員" : "検索結果",
    records.length,
    context.totalRecordCount,
    context.query,
    UNIT_RECORD_SORT_LABELS[context.sortBy]
  ] : [];

  // Preserve an auditable zero-result export when a name search matches no unit.
  if (context && records.length === 0) {
    rows.push([
      "エクスポート情報",
      ...Array<CsvCell>(headers.length - metadataHeaders.length - 1).fill(""),
      ...exportMetadata
    ]);
  }

  for (const record of records) {
    rows.push([
      ...(context ? ["味方累計"] : []),
      record.unitId, record.unitName, record.attacks, record.strikes, record.hits, record.misses,
      record.criticalHits, record.damageDealt, record.enemiesDefeated, record.experienceAwarded,
      record.levelUps, record.statGains.hp, record.statGains.strength, record.statGains.magic,
      record.statGains.skill, record.statGains.speed, record.statGains.luck,
      record.statGains.defense, record.statGains.resistance,
      ...exportMetadata
    ]);
  }
  return serializeCsv(rows);
}


/** Exports recorded incoming enemy strikes from the currently retained campaign log. */
export function buildCampaignIncomingStrikeSummaryCsv(
  summaries: readonly CampaignIncomingStrikeSummary[],
  coverage: ReturnType<typeof getCampaignBattleLogCoverage>
): string {
  const headers: CsvCell[] = [
    "CSV行種別", "味方ID", "味方名", "被攻撃strike数", "被弾数", "ミス数",
    "被必殺数", "被ダメージ", "攻撃者数", "最終記録連番",
    "保持ログ件数", "保持上限件数", "保持先頭連番", "保持末尾連番",
    "先頭より前の未保持連番", "保持範囲内の連番欠番", "保持上限到達"
  ];
  const coverageValues: CsvCell[] = [
    coverage.retainedCount, coverage.retentionLimit, coverage.firstSequence ?? "",
    coverage.lastSequence ?? "", coverage.unretainedLeadingSequenceCount,
    coverage.missingSequenceCount, coverage.reachedRetentionLimit ? "はい" : "いいえ"
  ];
  const rows: CsvCell[][] = [headers];

  if (summaries.length === 0) {
    rows.push([
      "エクスポート情報", "", "", "", "", "", "", "", "", "",
      ...coverageValues
    ]);
  }

  for (const summary of summaries) {
    rows.push([
      "被攻撃集計", summary.unitId, summary.unitName, summary.receivedStrikes,
      summary.hitsReceived, summary.missesAvoided, summary.criticalHitsReceived,
      summary.damageReceived, summary.attackerCount, summary.lastSequence,
      ...coverageValues
    ]);
  }

  return serializeCsv(rows);
}


/** Exports recorded enemy attacks from the currently retained campaign log. */
export function buildCampaignEnemyStrikeSummaryCsv(
  summaries: readonly CampaignEnemyStrikeSummary[],
  coverage: ReturnType<typeof getCampaignBattleLogCoverage>
): string {
  const headers: CsvCell[] = [
    "CSV行種別", "章ID", "章番号", "章名", "敵ID", "敵名",
    "攻撃strike数", "命中数", "ミス数", "必殺数", "与ダメージ",
    "攻撃対象味方数", "味方撃破数", "最終記録連番",
    "保持ログ件数", "保持上限件数", "保持先頭連番", "保持末尾連番",
    "先頭より前の未保持連番", "保持範囲内の連番欠番", "保持上限到達"
  ];
  const coverageValues: CsvCell[] = [
    coverage.retainedCount, coverage.retentionLimit, coverage.firstSequence ?? "",
    coverage.lastSequence ?? "", coverage.unretainedLeadingSequenceCount,
    coverage.missingSequenceCount, coverage.reachedRetentionLimit ? "はい" : "いいえ"
  ];
  const rows: CsvCell[][] = [headers];

  if (summaries.length === 0) {
    rows.push([
      "エクスポート情報", "", "", "", "", "", "", "", "", "", "", "", "",
      ...coverageValues
    ]);
  }

  for (const summary of summaries) {
    rows.push([
      "敵攻撃集計", summary.chapterId, summary.chapterNumber ?? "", summary.chapterTitle,
      summary.enemyId, summary.enemyName, summary.attackStrikes, summary.hits, summary.misses,
      summary.criticalHits, summary.damageDealt, summary.targetCount, summary.alliesDefeated,
      summary.lastSequence, ...coverageValues
    ]);
  }

  return serializeCsv(rows);
}
