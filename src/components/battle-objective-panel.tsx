import type { BattleObjectiveDetails } from "../application/get-battle-map-details";
import type { BattleObjectiveNavigationTargets } from "../application/get-battle-objective-navigation-targets";
import type { GameUnit } from "../domain/models/game";

interface BattleObjectivePanelProps {
  details: BattleObjectiveDetails;
  navigationTargets: BattleObjectiveNavigationTargets;
  disabled: boolean;
  onInspectUnit: (unit: GameUnit) => void;
  onInspectEnemyRoster: () => void;
}

export function BattleObjectivePanel({
  details,
  navigationTargets,
  disabled,
  onInspectUnit,
  onInspectEnemyRoster
}: BattleObjectivePanelProps) {
  const { victoryTarget, defeatTarget, remainingEnemyCount } = navigationTargets;

  return (
    <section className="map-info-card" aria-labelledby="map-objective-heading" data-testid="battle-objective">
      <p className="eyebrow">OBJECTIVE</p>
      <h3 id="map-objective-heading">勝利条件</h3>
      <strong>{details.victoryLabel}</strong>
      <p aria-live="polite">{details.victoryStatus}</p>
      {victoryTarget ? (
        <button
          className="secondary-button objective-navigation-button"
          type="button"
          disabled={disabled}
          aria-label={victoryTarget.name + "をマップで確認"}
          onClick={() => onInspectUnit(victoryTarget)}
        >
          ボスの位置を確認：{victoryTarget.name}
        </button>
      ) : remainingEnemyCount > 0 ? (
        <button
          className="secondary-button objective-navigation-button"
          type="button"
          disabled={disabled}
          aria-label={"残りの敵を一覧で確認、" + remainingEnemyCount + "体"}
          onClick={onInspectEnemyRoster}
        >
          残りの敵を一覧で確認（{remainingEnemyCount}体）
        </button>
      ) : null}
      <div className="map-info-defeat">
        <span>敗北条件</span>
        <strong>{details.defeatLabel}</strong>
        <p aria-live="polite">{details.defeatStatus}</p>
        {defeatTarget && (
          <button
            className="secondary-button objective-navigation-button"
            type="button"
            disabled={disabled}
            aria-label={defeatTarget.name + "をマップで確認"}
            onClick={() => onInspectUnit(defeatTarget)}
          >
            保護対象の位置を確認：{defeatTarget.name}
          </button>
        )}
      </div>
    </section>
  );
}
