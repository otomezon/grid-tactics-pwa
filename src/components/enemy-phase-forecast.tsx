import type { EnemyPhaseForecast } from "../application/get-enemy-phase-forecast";
import type { EnemyActionKind } from "../application/resolve-enemy-phase";

const ACTION_KIND_LABELS: Record<EnemyActionKind, string> = {
  attacked: "攻撃",
  "moved-and-attacked": "移動して攻撃",
  moved: "移動",
  waited: "待機"
};
const OUTCOME_LABELS: Record<EnemyPhaseForecast["outcome"], string> = {
  playing: "戦闘継続",
  victory: "敵軍フェイズ中に勝利条件成立",
  defeat: "敵軍フェイズ中に敗北条件成立"
};

export function EnemyPhaseForecastPanel({ forecast }: { forecast: EnemyPhaseForecast | null }) {
  if (!forecast) return null;
  return (
    <section className="info-card enemy-phase-forecast-card" aria-labelledby="enemy-phase-forecast-heading" data-testid="enemy-phase-forecast">
      <div className="enemy-phase-report-meta">
        <p className="eyebrow">ENEMY PHASE FORECAST</p>
        <span>{forecast.actions.length}件</span>
      </div>
      <h2 id="enemy-phase-forecast-heading">敵軍フェイズの行動予測</h2>
      <details className="enemy-phase-forecast-details" data-testid="enemy-phase-forecast-details">
        <summary className="enemy-phase-forecast-summary">行動順と予測結果を表示</summary>
        <section className="enemy-phase-forecast-units" aria-label="味方ユニット別のHP予測">
          <h3>味方ユニットの予測HP</h3>
          <ul className="enemy-phase-forecast-unit-list">
            {forecast.playerUnitOutcomes.map((unit) => (
              <li
                className={"enemy-phase-forecast-unit" + (unit.defeated ? " is-defeated" : "")}
                key={unit.unitId}
                data-testid="enemy-phase-forecast-unit"
                data-unit-id={unit.unitId}
                data-predicted-hp={unit.hpAfterResolution}
                data-defeated={unit.defeated}
              >
                <div className="enemy-phase-forecast-unit-heading">
                  <strong>{unit.unitName}</strong>
                  {unit.defeated && <span className="enemy-phase-forecast-defeated">撃破見込み</span>}
                </div>
                <p>
                  HP {unit.currentHp} → {unit.hpAfterEnemyActions}（敵行動後） → {unit.hpAfterResolution}（回復処理後） / {unit.maxHp}
                </p>
                <p className="enemy-phase-forecast-unit-detail">
                  予測被ダメージ {unit.incomingDamage} · 砦回復 +{unit.fortRecovery}
                </p>
              </li>
            ))}
          </ul>
        </section>
        {forecast.phaseStartRecoveries.length > 0 && (
          <section className="enemy-phase-forecast-recoveries" aria-label="敵軍フェイズ開始時の砦回復">
            <h3>敵軍フェイズ開始時の砦回復</h3>
            <ul>{forecast.phaseStartRecoveries.map((r) => <li key={r.unitId}>{r.unitName}：HP +{r.recoveredHp}</li>)}</ul>
          </section>
        )}
        {forecast.actions.length > 0 ? (
          <ol className="enemy-phase-action-list">
            {forecast.actions.map((action, index) => (
              <li className="enemy-phase-action enemy-phase-forecast-action" key={action.enemyId} data-testid="enemy-phase-forecast-action">
                <div className="enemy-phase-action-heading">
                  <span className="enemy-phase-action-number">{index + 1}</span>
                  <strong>{action.enemyName}</strong>
                  <span className="enemy-phase-action-kind">{ACTION_KIND_LABELS[action.kind]}</span>
                </div>
                <p>{action.message}</p>
              </li>
            ))}
          </ol>
        ) : <p className="helper-text">敵ユニットの行動はありません。</p>}
        <p className="enemy-phase-forecast-outcome">予測結果：<strong>{OUTCOME_LABELS[forecast.outcome]}</strong></p>
        <p className="helper-text enemy-phase-forecast-note">
          現在の配置・HP・装備・乱数状態と実際の敵AIを使った予測です。味方の行動で状態が変わると内容も更新されます。
          味方HPは敵行動後と砦回復処理後を分けて表示します。クラスの役割タグによる標的優先も表示します。AIの評価値と距離方式は暫定です。役割加点も試作値です。
          この表示だけでGameState・乱数・オートセーブは変更されません。
        </p>
      </details>
    </section>
  );
}
