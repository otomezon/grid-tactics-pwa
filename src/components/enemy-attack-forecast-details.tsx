import type { CombatForecast, CombatStrikeKind } from "../domain/combat/types";
import { WEAPONS_BY_ID } from "../content/weapons";

interface EnemyAttackForecastDetailsProps {
  forecast: CombatForecast | undefined;
  attackerName: string;
  defenderName: string;
}

const STRIKE_KIND_LABELS: Record<CombatStrikeKind, string> = {
  initial: "初撃",
  counter: "反撃",
  "follow-up": "追撃"
};

function getTriangleLabel(modifier: number): string {
  if (modifier > 0) return "有利（命中 +" + modifier + "）";
  if (modifier < 0) return "不利（命中 " + modifier + "）";
  return "相性補正なし";
}

/** Read-only view of the exact combat forecast selected by the enemy resolver. */
export function EnemyAttackForecastDetails({
  forecast,
  attackerName,
  defenderName
}: EnemyAttackForecastDetailsProps) {
  if (!forecast || forecast.strikes.length === 0) return null;

  return (
    <details className="enemy-attack-forecast-details" data-testid="enemy-attack-forecast">
      <summary>攻撃の命中率・ダメージ予測（{forecast.strikes.length}回）</summary>
      <ol className="enemy-attack-forecast-list" aria-label="敵攻撃のstrike予測">
        {forecast.strikes.map((strike, index) => {
          const strikeAttackerName = strike.attackerId === forecast.attackerId
            ? attackerName
            : defenderName;
          const strikeDefenderName = strike.defenderId === forecast.defenderId
            ? defenderName
            : attackerName;
          const weapon = WEAPONS_BY_ID[strike.weaponId];

          return (
            <li
              className="enemy-attack-forecast-strike"
              key={String(index) + "-" + strike.kind}
              data-testid="enemy-attack-forecast-strike"
              data-strike-kind={strike.kind}
              data-attacker-id={strike.attackerId}
              data-defender-id={strike.defenderId}
            >
              <div className="enemy-attack-forecast-title">
                <strong>{STRIKE_KIND_LABELS[strike.kind]}</strong>
                <span>{strikeAttackerName} → {strikeDefenderName}</span>
              </div>
              <p className="enemy-attack-forecast-weapon">
                {weapon?.name ?? strike.weaponId}
              </p>
              <dl className="enemy-attack-forecast-stats">
                <div><dt>攻撃力</dt><dd>{strike.attackPower}</dd></div>
                <div><dt>通常ダメージ</dt><dd>{strike.normalDamage}</dd></div>
                <div><dt>必殺時ダメージ</dt><dd>{strike.criticalDamage}</dd></div>
                <div><dt>命中率</dt><dd>{strike.hitRate}%</dd></div>
                <div><dt>必殺率</dt><dd>{strike.criticalRate}%</dd></div>
                <div><dt>武器相性</dt><dd>{getTriangleLabel(strike.weaponTriangleHitModifier)}</dd></div>
              </dl>
            </li>
          );
        })}
      </ol>
      <p className="enemy-attack-forecast-note">
        数値は各strikeの理論値です。実際に発生した命中・必殺・ダメージは、敵の行動メッセージに表示されます。先行攻撃で撃破された場合、後続strikeは実行されません。
      </p>
    </details>
  );
}
