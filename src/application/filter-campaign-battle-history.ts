import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";

export type CampaignBattleHistoryCategory = "all" | "player" | "enemy" | "result";

export interface CampaignBattleHistoryFilter {
  chapterId: string;
  category: CampaignBattleHistoryCategory;
  query: string;
}

function matchesCategory(
  entry: CampaignBattleHistoryEntry,
  category: CampaignBattleHistoryCategory
): boolean {
  switch (category) {
    case "all": return true;
    case "player": return entry.kind === "player-action" || entry.kind === "player-attack";
    case "enemy": return entry.kind === "enemy-action";
    case "result": return entry.kind === "chapter-result";
  }
}

function searchableText(entry: CampaignBattleHistoryEntry): string {
  const chapter = entry.chapterNumber === null
    ? entry.chapterTitle
    : `第${entry.chapterNumber}章 ${entry.chapterTitle}`;
  const kindLabel = entry.kind === "player-action"
    ? "味方の行動"
    : entry.kind === "player-attack"
      ? "味方の攻撃"
      : entry.kind === "enemy-action"
        ? "敵軍行動"
        : entry.outcome === "victory" ? "ステージクリア 勝利" : "敗北";
  // JSON includes nested strike names, weapons, outcomes, action details, and results.
  return `${chapter} 第${entry.turn}ターン ${kindLabel} ${JSON.stringify(entry)}`.toLocaleLowerCase();
}

/** Read-only filter that preserves the source order and never mutates campaign state. */
export function filterCampaignBattleHistory(
  entries: readonly CampaignBattleHistoryEntry[],
  filter: CampaignBattleHistoryFilter
): CampaignBattleHistoryEntry[] {
  const terms = filter.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (filter.chapterId !== "all" && entry.chapterId !== filter.chapterId) return false;
    if (!matchesCategory(entry, filter.category)) return false;
    if (terms.length === 0) return true;
    const text = searchableText(entry);
    return terms.every((term) => text.includes(term));
  });
}
