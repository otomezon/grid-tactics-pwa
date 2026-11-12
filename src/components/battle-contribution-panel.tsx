import type { BattleContributionEntry } from "../application/get-battle-contribution-details";
import type { UnitStats } from "../domain/models/game";

interface BattleContributionPanelProps {
  contributions: readonly BattleContributionEntry[];
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

/** Presents attack contributions derived only from actual in-session player attack events. */
export function BattleContributionPanel({ contributions }: BattleContributionPanelProps) {
  return (
    <section className="result-units battle-contribution-panel" aria-labelledby="battle-contribution-heading" data-testid="battle-contributions">
      <div className="battle-contribution-heading">
        <h2 id="battle-contribution-heading">味方の戦闘貢献</h2>
        <span>{contributions.length}人</span>
      </div>
      {contributions.length > 0 ? (
        <div className="battle-contribution-list">
          {contributions.map((entry) => {
            const gains = formatStatGains(entry.statGains);
            return (
              <article className="battle-contribution-card" key={entry.unitId} data-testid={"battle-contribution-" + entry.unitId}>
                <div className="battle-contribution-unit-heading">
                  <strong>{entry.unitName}</strong>
                  <span>攻撃行動 {entry.attacks}回</span>
                </div>
                <dl className="battle-contribution-stats">
                  <div><dt>与ダメージ</dt><dd>{entry.damageDealt}</dd></div>
                  <div><dt>撃破</dt><dd>{entry.enemiesDefeated}</dd></div>
                  <div><dt>命中（必殺含む）</dt><dd>{entry.hits}</dd></div>
                  <div><dt>ミス</dt><dd>{entry.misses}</dd></div>
                  <div><dt>必殺</dt><dd>{entry.criticalHits}</dd></div>
                  <div><dt>獲得EXP</dt><dd>+{entry.experienceAwarded}</dd></div>
                  <div><dt>攻撃回数（strike）</dt><dd>{entry.strikes}</dd></div>
                  <div><dt>レベルアップ</dt><dd>{entry.levelUps}</dd></div>
                </dl>
                {gains.length > 0 && (
                  <p className="battle-contribution-gains">
                    能力上昇：{gains.join(" · ")}
                  </p>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="helper-text">
          この画面セッションに集計できる味方の攻撃記録はありません。攻撃履歴は一時情報のため、リロード・セーブ読込・章切替後には引き継がれません。
        </p>
      )}
      <p className="helper-text battle-contribution-note">
        味方が開始した攻撃の実結果だけを集計しています。敵の反撃は味方の与ダメージ／命中数に含めず、予測値や未確定の攻撃も集計しません。必殺は命中数にも含みます。
      </p>
    </section>
  );
}
