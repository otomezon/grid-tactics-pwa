import type { CampaignBattleHistoryEntry } from "../application/get-campaign-battle-history";
import type { CampaignBattleLogEntry, CampaignBattleStrikeRecord } from "../domain/models/game";

export interface CampaignBattleHistoryPanelProps {
  entries: readonly CampaignBattleHistoryEntry[];
  onClose: () => void;
}

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

export function CampaignBattleHistoryPanel({ entries, onClose }: CampaignBattleHistoryPanelProps) {
  const defeatCounts = buildDefeatCounts(entries);
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
          <p className="campaign-battle-history-note">{entries.length}件 · 発生順</p>
        </div>
        <button className="secondary-button campaign-battle-history-close" type="button" onClick={onClose}>
          閉じる
        </button>
      </header>

      <section className="campaign-battle-defeats" aria-labelledby="campaign-battle-defeats-title">
        <h3 id="campaign-battle-defeats-title">撃破者別記録</h3>
        {defeatCounts.length > 0 ? (
          <ul>
            {defeatCounts.map((record) => (
              <li key={record.actorId}><strong>{record.actorName}</strong><span>{record.count}体撃破</span></li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">確定した撃破記録はまだありません。</p>
        )}
      </section>

      <ol className="campaign-battle-history-list" aria-label="キャンペーン戦闘の発生順">
        {entries.map((entry) => (
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
              ) : (
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
              )}
            </article>
          </li>
        ))}
      </ol>

      <p className="campaign-battle-history-footnote">
        実際に確定した行動・攻撃結果と章の勝敗結果のみを保存しています。敵AIの予測や候補評価は含みません。
        最大5,000件を保持し、上限を超えると古い履歴から入れ替わります。
      </p>
    </section>
  );
}
