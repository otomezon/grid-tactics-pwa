import type { GameUnit } from "../domain/models/game";
import { getClassDisplayName } from "../content/classes";

interface UnitRosterProps {
  units: GameUnit[];
  selectedUnitId: string | null;
  disabled: boolean;
  onSelect: (unit: GameUnit) => void;
}

function getUnitActionStatus(unit: GameUnit): string {
  if (unit.hasActed) return "行動済";
  if (unit.hasMoved) return "移動済・行動可能";
  return "未移動・未行動";
}

export function UnitRoster({
  units,
  selectedUnitId,
  disabled,
  onSelect
}: UnitRosterProps) {
  const actionableCount = units.filter((unit) => !unit.hasActed).length;

  return (
    <section className="info-card unit-roster" aria-labelledby="unit-roster-heading" data-testid="unit-roster">
      <div className="unit-roster-heading">
        <div>
          <p className="eyebrow">PARTY</p>
          <h2 id="unit-roster-heading">味方ユニット一覧</h2>
        </div>
        <span className="unit-roster-summary" data-testid="unit-roster-summary">
          行動可能 {actionableCount} / {units.length}人
        </span>
      </div>
      {units.length > 0 ? (
        <ul className="unit-roster-list">
          {units.map((unit) => {
            const status = getUnitActionStatus(unit);
            const isSelected = unit.id === selectedUnitId;

            return (
              <li key={unit.id}>
                <button
                  className={"unit-roster-button" + (isSelected ? " is-selected" : "")}
                  type="button"
                  aria-label={unit.name + "を選択、HP " + unit.currentHp + "/" + unit.stats.hp + "、" + status}
                  aria-pressed={isSelected}
                  disabled={disabled}
                  onClick={() => onSelect(unit)}
                >
                  <span className="unit-roster-token" aria-hidden="true">味</span>
                  <span className="unit-roster-copy">
                    <span className="unit-roster-name">
                      <strong>{unit.name}</strong>
                      <span>Lv.{unit.level} · {getClassDisplayName(unit.classId)}</span>
                    </span>
                    <span className="unit-roster-status">{status}</span>
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
        <p className="empty-selection">出撃中の味方ユニットはいません。</p>
      )}
    </section>
  );
}
