import type { EnemyTargetEvaluation } from "../application/resolve-enemy-phase";
import { getTacticalRoleLabel } from "../content/tactical-roles";

function formatNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}
function formatPoints(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatNumber(Math.abs(value))}点`;
}

export function EnemyTargetEvaluations({ evaluations }: {
  evaluations: readonly EnemyTargetEvaluation[] | undefined;
}) {
  if (!evaluations || evaluations.length === 0) return null;
  return (
    <details className="enemy-target-evaluations" data-testid="enemy-target-evaluations">
      <summary>攻撃対象の評価内訳（{evaluations.length}候補）</summary>
      <ol className="enemy-target-evaluation-list">
        {evaluations.map((evaluation, index) => {
          const score = evaluation.scoreBreakdown;
          return (
            <li className="enemy-target-evaluation" key={evaluation.targetId}
              data-testid="enemy-target-evaluation" data-target-id={evaluation.targetId}
              data-score={score.totalScore}>
              <div className="enemy-target-evaluation-heading">
                <span>{index === 0 ? "採用対象" : "比較候補"}</span>
                <strong>{evaluation.targetName}</strong>
                <b>{formatNumber(score.totalScore)}点</b>
              </div>
              <ul className="enemy-target-evaluation-factors">
                {score.canDefeatTarget && <li>通常／必殺で撃破可能：{formatPoints(score.killBonus)}</li>}
                {score.triangleBonus > 0 && <li>三すくみ有利：{formatPoints(score.triangleBonus)}</li>}
                {score.lostHp > 0 && <li>失HP {formatNumber(score.lostHp)} × 0.5：{formatPoints(score.lowHpBonus)}</li>}
                <li>期待ダメージ {formatNumber(score.expectedDamage)} × 5：{formatPoints(score.expectedDamageBonus)}</li>
                {score.counterExpectedDamage > 0 && <li>予測反撃 {formatNumber(score.counterExpectedDamage)} × 2：{formatPoints(-score.counterDamagePenalty)}</li>}
                {score.counterLethalPenalty > 0 && <li>反撃で敵が撃破される危険：{formatPoints(-score.counterLethalPenalty)}</li>}
                {score.rolePriorityBonus > 0 && <li>クラス役割（{evaluation.targetRoles.map(getTacticalRoleLabel).join("・")}）：{formatPoints(score.rolePriorityBonus)}</li>}
                <li className="enemy-target-evaluation-total">合計評価値：{formatNumber(score.totalScore)}点</li>
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="helper-text">数値は現行の暫定AI評価を分解した表示です。正式なゲームバランス値ではありません。</p>
    </details>
  );
}
