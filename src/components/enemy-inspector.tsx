import type { EnemyInspectionDetails } from "../application/get-enemy-inspection-details";

interface EnemyInspectorProps {
  details: EnemyInspectionDetails;
}

export function EnemyInspector({ details }: EnemyInspectorProps) {
  return (
    <section
      className="info-card enemy-inspector"
      aria-labelledby="enemy-inspector-heading"
      data-testid="enemy-inspector"
    >
      <p className="eyebrow">ENEMY INTEL</p>
      <div className="unit-heading enemy-inspector-heading">
        <span className="large-unit-token unit-enemy" aria-hidden="true">敵</span>
        <div>
          <h2 id="enemy-inspector-heading">{details.name}</h2>
          <p>Lv.{details.level} · {details.className}</p>
        </div>
      </div>

      <div className="enemy-inspector-health">
        <progress max={details.maxHp} value={details.currentHp} aria-label={details.name + "のHP"} />
        <strong>HP {details.currentHp} / {details.maxHp}</strong>
      </div>

      <dl className="enemy-inspector-overview">
        <div><dt>位置</dt><dd>{details.positionLabel}</dd></div>
        <div><dt>移動力</dt><dd>{details.move}</dd></div>
        <div><dt>移動種別</dt><dd>{details.movementTypeLabel}</dd></div>
      </dl>

      <section className="enemy-inspector-section" aria-labelledby="enemy-inspector-stats-heading">
        <h3 id="enemy-inspector-stats-heading">能力値</h3>
        <dl className="enemy-inspector-stats">
          {details.stats.map((stat) => (
            <div className="enemy-inspector-stat" key={stat.key}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="enemy-inspector-section" aria-labelledby="enemy-inspector-weapons-heading">
        <h3 id="enemy-inspector-weapons-heading">所持武器</h3>
        {details.weapons.length > 0 ? (
          <ul className="enemy-inspector-weapons">
            {details.weapons.map((weapon) => (
              <li
                className={"enemy-inspector-weapon" + (weapon.isEquipped ? " is-equipped" : "")}
                key={weapon.inventoryIndex}
                data-testid="enemy-inspector-weapon"
              >
                <div className="enemy-inspector-weapon-heading">
                  <strong>{weapon.name}</strong>
                  {weapon.isEquipped && <span>装備中</span>}
                </div>
                <p>{weapon.weaponTypeLabel} · {weapon.damageTypeLabel}</p>
                <dl className="enemy-inspector-weapon-stats">
                  <div><dt>威力</dt><dd>{weapon.power}</dd></div>
                  <div><dt>攻撃力</dt><dd>{weapon.attackPower}</dd></div>
                  <div><dt>命中</dt><dd>{weapon.hit}%</dd></div>
                  <div><dt>必殺</dt><dd>{weapon.critical}%</dd></div>
                  <div><dt>射程</dt><dd>{weapon.minRange}–{weapon.maxRange}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">所持武器はありません。</p>
        )}
      </section>

      <p className="enemy-inspector-note">表示専用です。攻撃・行動・セーブ内容は変更しません。能力値と武器性能は試作データです。</p>
    </section>
  );
}
