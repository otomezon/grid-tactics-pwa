import { useEffect, useRef } from "react";
import type { EnemyPhaseForecast } from "../application/get-enemy-phase-forecast";
import { getClassDisplayName } from "../content/classes";
import type { GameUnit } from "../domain/models/game";

interface PlayerPhaseEndReviewProps {
  pendingUnits: GameUnit[];
  forecast: EnemyPhaseForecast | null;
  disabled: boolean;
  onSelectUnit: (unit: GameUnit) => void;
  onReturnToBattle: () => void;
  onEndPhase: () => void;
}

function getActionStatus(unit: GameUnit): string {
  return unit.hasMoved ? "移動済み・未行動" : "未移動・未行動";
}

export function PlayerPhaseEndReview({
  pendingUnits,
  forecast,
  disabled,
  onSelectUnit,
  onReturnToBattle,
  onEndPhase
}: PlayerPhaseEndReviewProps) {
  const reviewRef = useRef<HTMLElement | null>(null);
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
                    <span>{getActionStatus(unit)} · HP {unit.currentHp}/{unit.stats.hp}</span>
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
