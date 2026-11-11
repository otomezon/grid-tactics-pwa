import { getClassDisplayName } from "../content/classes";
import { WEAPONS_BY_ID } from "../content/weapons";
import type { GameUnit } from "../domain/models/game";

interface EnemyRosterProps {
  units: GameUnit[];
  totalEnemyCount: number;
  selectedEnemyId: string | null;
  disabled: boolean;
  onSelect: (unit: GameUnit) => void;
}

function positionLabel(position: GameUnit["position"]): string {
  return String(position.x + 1) + "列・" + String(position.y + 1) + "行";
}

export function EnemyRoster({
  units,
  totalEnemyCount,
  selectedEnemyId,
  disabled,
  onSelect
}: EnemyRosterProps) {
  return (
    <section className="info-card enemy-roster" aria-labelledby="enemy-roster-heading" data-testid="enemy-roster">
      <div className="unit-roster-heading">
        <div>
          <p className="eyebrow">ENEMIES</p>
          <h2 id="enemy-roster-heading">敵ユニット一覧</h2>
        </div>
        <span className="unit-roster-summary" data-testid="enemy-roster-summary">
          生存 {units.length} / 配置 {totalEnemyCount}体
        </span>
      </div>
      {units.length > 0 ? (
        <ul className="unit-roster-list">
          {units.map((unit) => {
            const weapon = unit.equippedWeaponId
              ? WEAPONS_BY_ID[unit.equippedWeaponId]
              : undefined;
            const position = positionLabel(unit.position);
            const isSelected = unit.id === selectedEnemyId;

            return (
              <li key={unit.id}>
                <button
                  className={"unit-roster-button enemy-roster-button" + (isSelected ? " is-selected" : "")}
                  type="button"
                  aria-label={unit.name + "を確認、HP " + unit.currentHp + "/" + unit.stats.hp + "、" + position}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => onSelect(unit)}
                >
                  <span className="unit-roster-token enemy-roster-token" aria-hidden="true">敵</span>
                  <span className="unit-roster-copy">
                    <span className="unit-roster-name">
                      <strong>{unit.name}</strong>
                      <span>Lv.{unit.level} · {getClassDisplayName(unit.classId)}</span>
                    </span>
                    <span className="enemy-roster-meta">
                      {position} · {weapon ? "装備 " + weapon.name : "武器未装備"}
                    </span>
                    <span className="unit-roster-health">
                      <progress
                        max={unit.stats.hp}
                        value={unit.currentHp}
                        aria-label={unit.name + "のHP"}
                      />
                      <span>HP {unit.currentHp} / {unit.stats.hp}</span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty-selection">マップ上に生存している敵はいません。</p>
      )}
    </section>
  );
}
