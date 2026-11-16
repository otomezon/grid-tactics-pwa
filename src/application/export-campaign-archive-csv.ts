import type { CampaignBattleStrikeRecord, CampaignUnitBattleRecord } from "../domain/models/game";
import { getCampaignBattleLogCoverage, type CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import type { CampaignBattleHistoryCategory } from "./filter-campaign-battle-history";

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

/** Exports confirmed campaign-log facts only. Each saved actual strike gets its own row. */
export function buildCampaignBattleHistoryCsv(entries: readonly CampaignBattleHistoryEntry[]): string {
  const rows: CsvCell[][] = [[
    "連番", "章ID", "章番号", "章名", "ターン", "記録種別", "行動",
    "行動者ID", "行動者名", "対象ID", "対象名", "詳細", "対象残HP", "獲得EXP",
    "勝敗", "勝敗理由", "勝利目標", "生存味方数", "生存敵数", "移動先X", "移動先Y",
    "strike番号", "strike種別", "strike行動者ID", "strike行動者名", "strike対象ID",
    "strike対象名", "武器", "strike結果", "ダメージ", "対象HP（攻撃前）", "対象HP（攻撃後）"
  ]];

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
        entry.sequence, entry.chapterId, entry.chapterNumber ?? "", entry.chapterTitle, entry.turn,
        recordKind, action, actorId, actorName, targetId, targetName, detail,
        targetRemainingHp, experienceAwarded, outcome, reason, objective,
        livingPlayerCount, livingEnemyCount, destinationX, destinationY,
        strike ? index + 1 : "", strike ? STRIKE_KIND_LABELS[strike.kind] : "",
        strike?.actorId ?? "", strike?.actorName ?? "", strike?.targetId ?? "",
        strike?.targetName ?? "", strike?.weaponName ?? "",
        strike ? STRIKE_OUTCOME_LABELS[strike.outcome] : "",
        strike?.damage ?? "", strike?.targetHpBefore ?? "", strike?.targetHpAfter ?? ""
      ]);
    }
  }

  return serializeCsv(rows);
}

/** Exports the ordered per-ally metrics supplied by the current archive view. */
export function buildCampaignUnitBattleRecordsCsv(records: readonly CampaignUnitBattleRecord[]): string {
  const rows: CsvCell[][] = [[
    "味方ID", "名前", "攻撃行動", "実strike", "命中", "ミス", "必殺", "与ダメージ",
    "撃破", "獲得EXP", "レベルアップ", "HP上昇", "力上昇", "魔力上昇", "技上昇",
    "速さ上昇", "幸運上昇", "守備上昇", "魔防上昇"
  ]];
  for (const record of records) {
    rows.push([
      record.unitId, record.unitName, record.attacks, record.strikes, record.hits, record.misses,
      record.criticalHits, record.damageDealt, record.enemiesDefeated, record.experienceAwarded,
      record.levelUps, record.statGains.hp, record.statGains.strength, record.statGains.magic,
      record.statGains.skill, record.statGains.speed, record.statGains.luck,
      record.statGains.defense, record.statGains.resistance
    ]);
  }
  return serializeCsv(rows);
}
