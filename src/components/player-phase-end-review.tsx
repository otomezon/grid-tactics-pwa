import { useEffect, useRef } from "react";
import type { EnemyPhaseForecast } from "../application/get-enemy-phase-forecast";
import { getClassDisplayName } from "../content/classes";
import type { GameUnit } from "../domain/models/game";

interface PlayerPhaseEndReviewProps {
  pendingUnits: GameUnit[];
  playerUnits: GameUnit[];
  forecast: EnemyPhaseForecast | null;
  disabled: boolean;
  onSelectUnit: (unit: GameUnit) => void;
  onReturnToBattle: () => void;
  onEndPhase: () => void;
}

function getActionStatus(unit: GameUnit): string {
  if (unit.hasActed) return "行動済み";
  return unit.hasMoved ? "移動済み・未行動" : "未移動・未行動";
}

function getPredictedDamageLabel(defeated: boolean, incomingDamage: number): string {
  if (defeated) return "撃破見込み";
  return incomingDamage > 0 ? "被ダメージ見込み " + incomingDamage : "被ダメージなし";
}

export function PlayerPhaseEndReview({
  pendingUnits,
  playerUnits,
  forecast,
  disabled,
  onSelectUnit,
  onReturnToBattle,
  onEndPhase
}: PlayerPhaseEndReviewProps) {
  const reviewRef = useRef<HTMLElement | null>(null);
  const playerUnitsById = new Map(playerUnits.map((unit) => [unit.id, unit] as const));
  const attackActions = forecast?.actions.filter((action) => action.targetId && action.targetName) ?? [];
  const unitsWithPredictedDamage = forecast?.playerUnitOutcomes.filter(
    (unit) => unit.incomingDamage > 0
  ) ?? [];
  const defeatedUnits = forecast?.playerUnitOutcomes.filter((unit) => unit.defeated) ?? [];

  useEffect(() => {
    reviewRef.current?.focus();
  }, []);

  return (
    <section
      id="phase-end-review"
      className="phase-end-review"
      aria-labelledby="phase-end-review-heading"
      data-testid="phase-end-review"
      tabIndex={-1}
      ref={reviewRef}
    >
      <div className="phase-end-review-header">
        <div>
          <p className="eyebrow">TURN REVIEW</p>
          <h2 id="phase-end-review-heading">ターン終了前の確認</h2>
        </div>
        <span className="phase-end-review-count">未行動 {pendingUnits.length}人</span>
      </div>

      <p className="phase-end-review-intro">
        行動していない味方が残っています。ここで戦闘に戻って行動するか、未行動の味方を残して敵軍フェイズへ進むか選べます。
      </p>

      <div className="phase-end-review-content">
        <section aria-labelledby="phase-end-review-pending-heading">
          <h3 id="phase-end-review-pending-heading">まだ行動していない味方</h3>
          <ul className="phase-end-review-unit-list">
            {pendingUnits.map((unit) => (
              <li key={unit.id} data-testid="phase-end-review-pending-unit" data-unit-id={unit.id}>
                <button
                  className="phase-end-review-unit"
                  type="button"
                  disabled={disabled}
                  aria-label={unit.name + "を確認"}
                  onClick={() => onSelectUnit(unit)}
                >
                  <span className="phase-end-review-unit-token" aria-hidden="true">味</span>
                  <span className="phase-end-review-unit-copy">
                    <strong>{unit.name}</strong>
                    <span>Lv.{unit.level} · {getClassDisplayName(unit.classId)}</span>
                    <span>{unit.hasMoved ? "移動済み・未行動" : "未移動・未行動"} · HP {unit.currentHp}/{unit.stats.hp}</span>
                  </span>
                  <span className="phase-end-review-unit-action">確認</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="phase-end-review-forecast" aria-labelledby="phase-end-review-forecast-heading">
          <h3 id="phase-end-review-forecast-heading">次の敵軍フェイズ予測</h3>
          {forecast ? (
            <>
              <dl className="phase-end-review-forecast-grid">
                <div>
                  <dt>敵の行動</dt>
                  <dd>{forecast.actions.length}件</dd>
                </div>
                <div>
                  <dt>被ダメージ見込み</dt>
                  <dd>{unitsWithPredictedDamage.length}人</dd>
                </div>
                <div>
                  <dt>撃破見込み</dt>
                  <dd>{defeatedUnits.length}人</dd>
                </div>
              </dl>

              <section className="phase-end-review-forecast-section" aria-labelledby="phase-end-review-health-heading">
                <h3 id="phase-end-review-health-heading">味方全員の予測HP</h3>
                <ul className="phase-end-review-health-list">
                  {forecast.playerUnitOutcomes.map((outcome) => {
                    const unit = playerUnitsById.get(outcome.unitId);
                    const damageLabel = getPredictedDamageLabel(outcome.defeated, outcome.incomingDamage);
                    const accessibleLabel = outcome.unitName + "の予測HPを確認、HP " +
                      outcome.currentHp + "から" + outcome.hpAfterResolution + "、" + damageLabel;
                    return (
                      <li
                        className={"phase-end-review-health-item" +
                          (outcome.defeated ? " is-defeated" : outcome.incomingDamage > 0 ? " is-damaged" : "")}
                        key={outcome.unitId}
                        data-testid="phase-end-review-forecast-unit"
                        data-unit-id={outcome.unitId}
                        data-predicted-hp={outcome.hpAfterResolution}
                        data-predicted-damage={outcome.incomingDamage}
                        data-defeated={outcome.defeated}
                      >
                        <button
                          className="phase-end-review-health-button"
                          type="button"
                          disabled={disabled || !unit}
                          aria-label={accessibleLabel}
                          onClick={() => {
                            if (unit) onSelectUnit(unit);
                          }}
                        >
                          <span className="phase-end-review-health-copy">
                            <strong>{outcome.unitName}</strong>
                            <span>{unit ? getActionStatus(unit) : "現在の名簿にありません"}</span>
                          </span>
                          <span className="phase-end-review-health-value">
                            HP {outcome.currentHp} → {outcome.hpAfterResolution} / {outcome.maxHp}
                          </span>
                          <progress
                            className="phase-end-review-health-progress"
                            max={outcome.maxHp}
                            value={outcome.hpAfterResolution}
                            aria-label={outcome.unitName + "の敵軍フェイズ後の予測HP"}
                          />
                          <span className="phase-end-review-health-status">
                            {damageLabel}
                            {outcome.fortRecovery > 0 ? " · 砦回復 +" + outcome.fortRecovery : ""}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="phase-end-review-forecast-section" aria-labelledby="phase-end-review-attacks-heading">
                <h3 id="phase-end-review-attacks-heading">予測される敵の攻撃対象</h3>
                {attackActions.length > 0 ? (
                  <ol className="phase-end-review-attack-list">
                    {attackActions.map((action) => (
                      <li
                        className="phase-end-review-attack"
                        key={action.enemyId}
                        data-testid="phase-end-review-attack"
                        data-enemy-id={action.enemyId}
                        data-target-id={action.targetId}
                      >
                        <div className="phase-end-review-attack-heading">
                          <strong>{action.enemyName}</strong>
                          <span aria-hidden="true">→</span>
                          <strong>{action.targetName}</strong>
                          <span className="phase-end-review-attack-kind">
                            {action.kind === "moved-and-attacked" ? "移動後攻撃" : "攻撃"}
                          </span>
                        </div>
                        <p>{action.message}</p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="phase-end-review-note">
                    {forecast.actions.length === 0
                      ? "敵ユニットの行動はありません。"
                      : "敵の攻撃は予測されていません。敵は移動または待機します。"}
                  </p>
                )}
              </section>

              {defeatedUnits.length > 0 ? (
                <p className="phase-end-review-danger" data-testid="phase-end-review-defeated">
                  撃破見込み：{defeatedUnits.map((unit) => unit.unitName).join("、")}
                </p>
              ) : (
                <p className="phase-end-review-safe" data-testid="phase-end-review-defeated">
                  現在の予測では、敵軍フェイズ中に撃破される味方はいません。
                </p>
              )}
              <p className="phase-end-review-note">
                予測は現在の配置・HP・装備・乱数状態に基づきます。味方の行動後は表示中の予測も更新されます。AIの評価値と距離方式は暫定です。
              </p>
            </>
          ) : (
            <p className="phase-end-review-note">敵軍フェイズの予測は現在表示できません。</p>
          )}
        </section>
      </div>

      <div className="phase-end-review-actions">
        <button className="secondary-button" type="button" onClick={onReturnToBattle}>
          戦闘に戻る
        </button>
        <button className="primary-button" type="button" disabled={disabled} onClick={onEndPhase}>
          未行動の味方を残して敵軍フェイズへ
        </button>
      </div>
      <p className="phase-end-review-note">
        この確認は行動を強制せず、ゲーム状態やセーブを変更しません。フェイズ終了は従来どおりいつでも選べます。
      </p>
    </section>
  );
}
