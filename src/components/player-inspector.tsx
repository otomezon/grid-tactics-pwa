import type { PlayerInspectionDetails } from "../application/get-player-inspection-details";

interface PlayerInspectorProps {
  details: PlayerInspectionDetails;
}

export function PlayerInspector({ details }: PlayerInspectorProps) {
  return (
    <section className="info-card enemy-inspector player-inspector" aria-labelledby="player-inspector-heading" data-testid="player-inspector">
      <p className="eyebrow">ALLY INTEL</p>
      <div className="player-inspector-heading enemy-inspector-heading">
        <span className="large-unit-token unit-player" aria-hidden="true">味</span>
        <div><h2 id="player-inspector-heading">{details.name}</h2><p>Lv.{details.level} · {details.className}</p></div>
      </div>
      <div className="enemy-inspector-health">
        <progress max={details.maxHp} value={details.currentHp} aria-label={details.name + "のHP"} />
        <strong>HP {details.currentHp} / {details.maxHp}</strong>
      </div>
      <dl className="enemy-inspector-overview">
        <div><dt>位置</dt><dd>{details.positionLabel}</dd></div>
        <div><dt>EXP</dt><dd>{details.experience}</dd></div>
        <div><dt>移動力</dt><dd>{details.move}</dd></div>
        <div><dt>移動種別</dt><dd>{details.movementTypeLabel}</dd></div>
        <div><dt>行動状態</dt><dd>{details.actionStatus}</dd></div>
      </dl>
      <section className="enemy-inspector-section" aria-labelledby="player-inspector-stats-heading">
        <h3 id="player-inspector-stats-heading">能力値</h3>
        <dl className="enemy-inspector-stats">
          {details.stats.map((stat) => <div className="enemy-inspector-stat" key={stat.key}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}
        </dl>
      </section>
      <section className="enemy-inspector-section" aria-labelledby="player-inspector-weapons-heading">
        <h3 id="player-inspector-weapons-heading">所持武器</h3>
        {details.weapons.length > 0 ? (
          <ul className="enemy-inspector-weapons">
            {details.weapons.map((weapon) => (
              <li className={"enemy-inspector-weapon" + (weapon.isEquipped ? " is-equipped" : "")} key={weapon.inventoryIndex} data-testid="player-inspector-weapon">
                <div className="enemy-inspector-weapon-heading"><strong>{weapon.name}</strong>{weapon.isEquipped && <span>装備中</span>}</div>
                <p>{weapon.weaponTypeLabel} · {weapon.damageTypeLabel}</p>
                <p className={"player-inspector-weapon-suitability" + (weapon.isUsable ? "" : " is-unusable")}>{weapon.isUsable ? "使用適性あり" : "適性なし"}</p>
                <dl className="enemy-inspector-weapon-stats">
                  <div><dt>威力</dt><dd>{weapon.power}</dd></div><div><dt>攻撃力</dt><dd>{weapon.attackPower}</dd></div>
                  <div><dt>命中</dt><dd>{weapon.hit}%</dd></div><div><dt>必殺</dt><dd>{weapon.critical}%</dd></div>
                  <div><dt>射程</dt><dd>{weapon.minRange}–{weapon.maxRange}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        ) : <p className="helper-text">所持武器はありません。</p>}
      </section>
      <section className="enemy-inspector-section" aria-labelledby="player-inspector-items-heading">
        <h3 id="player-inspector-items-heading">所持アイテム</h3>
        {details.items.length > 0 ? (
          <ul className="player-inspector-item-list">
            {details.items.map((item) => <li className="player-inspector-item" key={item.id}>
              <div><strong>{item.name}</strong><span>所持数：{item.quantity}個</span></div>
              {item.description && <p>{item.description}</p>}
            </li>)}
          </ul>
        ) : <p className="helper-text">所持アイテムはありません。</p>}
      </section>
      <p className="enemy-inspector-note">表示専用です。装備変更・アイテム使用・移動／攻撃・セーブ内容は変更しません。能力値と武器性能は試作データです。</p>
    </section>
  );
}
