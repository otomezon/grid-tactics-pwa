import type { EnemyMovementEvaluation } from "../application/resolve-enemy-phase";

function formatNumber(value: number): string {
  return Number(value.toFixed(1)).toString();
}

function formatPoints(value: number): string {
  const prefix = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${prefix}${formatNumber(Math.abs(value))}点`;
}

export function EnemyMovementEvaluations({
  evaluations
}: {
  evaluations: readonly EnemyMovementEvaluation[] | undefined;
}) {
  if (!evaluations || evaluations.length === 0) return null;
  return (
    <details className="enemy-movement-evaluations" data-testid="enemy-movement-evaluations">
      <summary>移動先の評価内訳（{evaluations.length}候補）</summary>
      <ol className="enemy-movement-evaluation-list">
        {evaluations.map((evaluation, index) => {
          const score = evaluation.scoreBreakdown;
          const { position, movementReason } = evaluation;
          return (
            <li
              className="enemy-movement-evaluation"
              key={position.x + "," + position.y}
              data-testid="enemy-movement-evaluation"
              data-position={position.x + "," + position.y}
              data-score={score.totalScore}
            >
              <div className="enemy-movement-evaluation-heading">
                <span>{index === 0 ? "採用候補" : "比較候補"}</span>
                <strong>{position.x + 1}列{position.y + 1}行</strong>
                <b>{formatNumber(score.totalScore)}点</b>
              </div>
              <ul className="enemy-movement-evaluation-factors">
                {score.mode === "attack-after-move" && movementReason.kind === "attack-after-move" ? (
                  <>
                    <li>移動後に攻撃可能：{movementReason.targetName}</li>
                    <li>攻撃可能マス優先：{formatPoints(score.attackOpportunityBonus)}</li>
                    <li>攻撃対象評価 {formatNumber(score.attackTargetScore ?? 0)} × 10：{formatPoints(score.attackTargetContribution)}</li>
                  </>
                ) : movementReason.kind === "approach-player" ? (
                  <>
                    <li>最寄りの味方まで：{movementReason.nearestPlayerDistanceAfter}マス</li>
                    <li>距離ペナルティ：{formatPoints(score.distancePenalty)}</li>
                  </>
                ) : null}
                <li>地形評価：{formatPoints(score.terrainScore)}</li>
                <li className="enemy-movement-evaluation-total">合計評価値：{formatNumber(score.totalScore)}点</li>
              </ul>
            </li>
          );
        })}
      </ol>
      <p className="helper-text">既存の到達候補を評価値の降順で表示します。同点時はY座標、X座標の順です。現在のAI評価は暫定で、表示は移動先や行動を変更しません。</p>
    </details>
  );
}
