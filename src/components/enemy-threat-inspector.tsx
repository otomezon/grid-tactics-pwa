import type { EnemyThreatInspectionDetails } from "../application/get-enemy-threat-inspection-details";

interface EnemyThreatInspectorProps {
  details: EnemyThreatInspectionDetails;
}

export function EnemyThreatInspector({ details }: EnemyThreatInspectorProps) {
  return (
    <section
      className="map-info-card enemy-threat-inspector"
      aria-labelledby="enemy-threat-inspector-heading"
      data-testid="enemy-threat-inspector"
    >
      <p className="eyebrow">THREAT DETAILS</p>
      <h3 id="enemy-threat-inspector-heading">このマスを攻撃できる敵</h3>
      <strong className="enemy-threat-target">
        {details.targetCoordinate} · 敵 {details.sourceCount}体
      </strong>

      {details.sources.length > 0 ? (
        <ul className="enemy-threat-source-list">
          {details.sources.map((source) => (
            <li className="enemy-threat-source" key={source.enemyId} data-testid="enemy-threat-source">
              <div className="enemy-threat-source-heading">
                <strong>{source.enemyName}</strong>
                <span>Lv.{source.enemyLevel} · {source.enemyClassName}</span>
              </div>
              <p className="enemy-threat-weapon">
                {source.weaponName} · {source.weaponTypeLabel}／{source.damageTypeLabel} ·
                射程 {source.minRange}–{source.maxRange}
              </p>
              <p className="enemy-threat-origin-heading">
                攻撃可能な起点 {source.attackOrigins.length}箇所
                <span>現在位置 {source.enemyPositionLabel}</span>
              </p>
              <ul className="enemy-threat-origin-list">
                {source.attackOrigins.map((origin, index) => (
                  <li
                    className={origin.isCurrentPosition ? "is-current" : "is-after-move"}
                    key={origin.label}
                    data-testid="enemy-threat-origin"
                  >
                    <span>{origin.isCurrentPosition ? "現在" : "移動後"}</span>
                    <strong>{origin.label}</strong>
                    <small>距離 {origin.distance}</small>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="enemy-threat-empty">このマスを攻撃できる敵はいません。</p>
      )}

      <p className="enemy-threat-note">
        起点は現在位置と地形・占有・移動力から求めた候補です。敵AIが実際に選ぶ移動先や攻撃対象の確定予告ではありません。
        距離計算は暫定Manhattan方式です。
      </p>
    </section>
  );
}
