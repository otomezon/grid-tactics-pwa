import { TERRAIN_DEFINITIONS } from "../content/terrain";
import type { GameMapDefinition, TerrainType } from "../domain/models/game";

export interface DeploymentPreviewCandidate {
  id: string;
  name: string;
  classId: string;
  level: number;
}

interface DeploymentPreviewProps {
  map: GameMapDefinition;
  candidates: readonly DeploymentPreviewCandidate[];
  selectedUnitIds: readonly string[];
  assignments: Readonly<Record<string, string>>;
  detailUnitId: string | null;
  disabled: boolean;
  onSelectUnit: (unitId: string) => void;
}

function positionKey(x: number, y: number): string {
  return x + "," + y;
}

function positionLabel(x: number, y: number): string {
  return (x + 1) + "列・" + (y + 1) + "行";
}

export function DeploymentPreview({
  map,
  candidates,
  selectedUnitIds,
  assignments,
  detailUnitId,
  disabled,
  onSelectUnit
}: DeploymentPreviewProps) {
  const candidatesById = new Map(candidates.map((unit) => [unit.id, unit]));
  const assignedByPosition = new Map<string, DeploymentPreviewCandidate>();
  for (const unitId of selectedUnitIds) {
    const position = assignments[unitId];
    const candidate = candidatesById.get(unitId);
    if (position && candidate) assignedByPosition.set(position, candidate);
  }
  const deploymentSlots = new Map(map.playerDeployment.map((slot, index) => [
    positionKey(slot.x, slot.y),
    { ordinal: index + 1, unitId: slot.unitId }
  ]));
  const occupiedCount = assignedByPosition.size;

  return (
    <section className="deployment-preview" aria-labelledby="deployment-preview-heading" data-testid="deployment-preview">
      <div className="deployment-preview-heading">
        <div>
          <p className="eyebrow">FORMATION</p>
          <h3 id="deployment-preview-heading">出撃配置プレビュー</h3>
          <p>出撃予定の味方をマップ上に表示します。味方のマスを選ぶと詳細を確認できます。</p>
        </div>
        <span data-testid="deployment-preview-count">{occupiedCount} / {map.playerDeployment.length}か所</span>
      </div>
      <div
        className="deployment-preview-grid"
        role="group"
        aria-label={map.width + "列" + map.height + "行の出撃配置プレビュー"}
        style={{ gridTemplateColumns: "repeat(" + map.width + ", minmax(0, 1fr))" }}
      >
        {map.terrain.flatMap((row, y) => row.map((terrainType: TerrainType, x) => {
          const key = positionKey(x, y);
          const slot = deploymentSlots.get(key);
          const assigned = assignedByPosition.get(key);
          const label = positionLabel(x, y);
          return (
            <div
              key={key}
              className={"deployment-preview-cell terrain-" + terrainType + (slot ? " is-deployment-slot" : "")}
              data-testid="deployment-preview-tile"
              data-position={key}
              data-slot={slot ? "true" : "false"}
            >
              {slot && assigned ? (
                <button
                  className={"deployment-preview-unit" + (detailUnitId === assigned.id ? " is-inspected" : "")}
                  type="button"
                  aria-label={assigned.name + "、" + label + "に配置済み。詳細を表示"}
                  aria-pressed={detailUnitId === assigned.id}
                  disabled={disabled}
                  onClick={() => onSelectUnit(assigned.id)}
                  title={assigned.name + " · Lv." + assigned.level}
                  data-unit-id={assigned.id}
                >
                  <span className="deployment-preview-token" aria-hidden="true">味</span>
                  <span className="deployment-preview-unit-name" aria-hidden="true">{assigned.name}</span>
                </button>
              ) : slot ? (
                <span
                  className="deployment-preview-empty-slot"
                  aria-label={"空き出撃位置 " + slot.ordinal + "、" + label}
                  data-testid="deployment-preview-empty-slot"
                >
                  <span aria-hidden="true">＋</span>
                </span>
              ) : (
                <span className="deployment-preview-terrain-symbol" aria-hidden="true">
                  {TERRAIN_DEFINITIONS[terrainType].symbol}
                </span>
              )}
            </div>
          );
        }))}
      </div>
      <div className="deployment-preview-legend" aria-label="配置プレビューの凡例">
        <span><i className="deployment-preview-legend-ally" />出撃予定</span>
        <span><i className="deployment-preview-legend-empty" />空き出撃位置</span>
        <span><i className="deployment-preview-legend-terrain" />地形</span>
      </div>
      <p className="deployment-preview-note">表示は現在の編成・出撃位置のプレビューです。配置確定まではゲーム状態とセーブを変更しません。</p>
    </section>
  );
}
