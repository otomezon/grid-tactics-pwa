import type { AttackPlan } from "../application/perform-attack";
import { getCombatForecastDetails } from "../application/get-combat-forecast-details";

interface CombatForecastPanelProps {
  plan: AttackPlan;
  disabled: boolean;
  closeDisabled: boolean;
  onAttack: () => void;
  onClose: () => void;
}

function signed(value: number): string {
  return (value > 0 ? "+" : "") + String(value);
}

export function CombatForecastPanel({
  plan,
  disabled,
  closeDisabled,
  onAttack,
  onClose
}: CombatForecastPanelProps) {
  const details = getCombatForecastDetails(plan);
  const counterLabel = details.counterAvailability === "available"
    ? "反撃あり"
    : details.counterAvailability === "no-weapon"
      ? "反撃なし（有効な装備武器なし）"
      : "反撃なし（防御側の武器が射程外）";
  const triangleLabel = (modifier: number) => modifier > 0
    ? "有利（命中 " + signed(modifier) + "）"
    : modifier < 0
      ? "不利（命中 " + signed(modifier) + "）"
      : "相性補正なし";

  return (
    <section
      className="info-card combat-forecast-card"
      aria-labelledby="forecast-heading"
      data-testid="combat-forecast"
    >
      <p className="eyebrow">COMBAT FORECAST</p>
      <h2 id="forecast-heading">戦闘予測</h2>

      <div className="forecast-participants">
        <div>
          <span>攻撃側</span>
          <strong>{details.attacker.name}</strong>
          <span>HP {details.attacker.currentHp}/{details.attacker.maxHp}</span>
        </div>
        <div>
          <span>防御側</span>
          <strong>{details.defender.name}</strong>
          <span>HP {details.defender.currentHp}/{details.defender.maxHp}</span>
        </div>
      </div>

      <div className="forecast-overview" aria-label="戦闘概要">
        <span>距離 {details.distance}</span>
        <span>{counterLabel}</span>
        <span>速さ差（攻撃側基準） {signed(details.speedDifference)}</span>
      </div>

      <ol className="forecast-strikes" aria-label="攻撃順">
        {details.strikes.map((strike, index) => (
          <li
            className="forecast-strike"
            key={String(index) + "-" + strike.kind}
            data-testid="combat-forecast-strike"
          >
            <div className="forecast-strike-title">
              <strong>{strike.kindLabel}</strong>
              <span>{strike.actorName} → {strike.targetName}</span>
            </div>
            <p className="forecast-weapon">
              {strike.weaponName} · {strike.weaponTypeLabel}／{strike.damageTypeLabel}
            </p>
            <dl className="forecast-details-grid">
              <div><dt>攻撃力</dt><dd>{strike.attackPower}</dd></div>
              <div><dt>通常ダメージ</dt><dd>{strike.normalDamage}</dd></div>
              <div><dt>必殺時ダメージ</dt><dd>{strike.criticalDamage}</dd></div>
              <div><dt>命中率</dt><dd>{strike.hitRate}%</dd></div>
              <div><dt>必殺率</dt><dd>{strike.criticalRate}%</dd></div>
              <div><dt>武器相性</dt><dd>{triangleLabel(strike.weaponTriangleModifier)}</dd></div>
            </dl>
            <p className="forecast-terrain">
              対象地形：{strike.targetTerrainName}
              （守備補正 {signed(strike.targetTerrainDefenseBonus)}／回避補正 {signed(strike.targetTerrainAvoidanceBonus)}）
            </p>
          </li>
        ))}
      </ol>

      <p className="helper-text">
        数値は各攻撃候補の理論値です。必殺時ダメージは通常ダメージの3倍。
        先行攻撃で撃破された場合、後続攻撃は実行されません。
      </p>
      <button
        className="primary-button block-button"
        type="button"
        disabled={disabled}
        onClick={onAttack}
      >
        攻撃を確定
      </button>
      <button
        className="secondary-button block-button"
        type="button"
        disabled={closeDisabled}
        onClick={onClose}
      >
        戦闘予測を閉じる
      </button>
    </section>
  );
}
