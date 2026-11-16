import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";

export type CampaignBattleHistoryCategory = "all" | "player" | "enemy" | "result";

export interface CampaignBattleHistoryFilter {
  chapterId: string;
  category: CampaignBattleHistoryCategory;
  /** "all" keeps every unit; otherwise this is a recorded allied unit ID. */
  unitId?: string;
  query: string;
}

export interface CampaignBattleHistoryUnitOption {
  unitId: string;
  unitName: string;
}

/** Lists only allies already present as a player actor or enemy-action target in the saved timeline. */
export function getCampaignBattleHistoryUnitOptions(
  entries: readonly CampaignBattleHistoryEntry[]
): CampaignBattleHistoryUnitOption[] {
  const units = new Map<string, CampaignBattleHistoryUnitOption>();
  const add = (unitId: string, unitName: string): void => {
    if (!unitId || !unitName || units.has(unitId)) return;
    units.set(unitId, { unitId, unitName });
  };

  for (const entry of entries) {
    if (entry.kind === "player-action") add(entry.actorId, entry.actorName);
    else if (entry.kind === "player-attack") add(entry.attackerId, entry.attackerName);
    else if (entry.kind === "enemy-action" && entry.targetId && entry.targetName) {
      add(entry.targetId, entry.targetName);
    }
  }

  return [...units.values()];
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

function matchesUnit(entry: CampaignBattleHistoryEntry, unitId: string): boolean {
  if (unitId === "all") return true;
  if (entry.kind === "player-action") return entry.actorId === unitId;
  if (entry.kind === "player-attack") return entry.attackerId === unitId;
  if (entry.kind === "enemy-action") return entry.targetId === unitId;
  return false;
}

function searchableText(entry: CampaignBattleHistoryEntry): string {
  const chapter = entry.chapterNumber === null
    ? entry.chapterTitle
    : \`第\${entry.chapterNumber}章 \${entry.chapterTitle}\`;
  const kindLabel = entry.kind === "player-action"
    ? "味方の行動"
    : entry.kind === "player-attack"
      ? "味方の攻撃"
      : entry.kind === "enemy-action"
        ? "敵軍行動"
        : entry.outcome === "victory" ? "ステージクリア 勝利" : "敗北";
  // JSON includes nested strike names, weapons, outcomes, action details, and results.
  return \`\${chapter} 第\${entry.turn}ターン \${kindLabel} \${JSON.stringify(entry)}\`.toLocaleLowerCase();
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
    if (!matchesUnit(entry, filter.unitId ?? "all")) return false;
    if (terms.length === 0) return true;
    const text = searchableText(entry);
    return terms.every((term) => text.includes(term));
  });
}
