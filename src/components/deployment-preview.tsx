import { useState } from "react";
import { getDeploymentTerrainDetails } from "../application/get-deployment-terrain-details";
import { TERRAIN_DEFINITIONS } from "../content/terrain";
import type { GameMapDefinition, MovementType, TerrainType } from "../domain/models/game";

export interface DeploymentPreviewCandidate {
  id: string;
  name: string;
  classId: string;
  level: number;
  movementType: MovementType;
  move: number;
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
  const candidatesById = new Map(candidates.map((unit) => [unit.id, unit] as const));
  const assignedByPosition = new Map<string, DeploymentPreviewCandidate>();
  for (const unitId of selectedUnitIds) {
    const position = assignments[unitId];
    const candidate = candidatesById.get(unitId);
    if (position && candidate) assignedByPosition.set(position, candidate);
  }
  const deploymentSlots = new Map(map.playerDeployment.map((slot, index) => [
    positionKey(slot.x, slot.y),
    { ordinal: index + 1, unitId: slot.unitId }
  ] as const));
  const occupiedCount = assignedByPosition.size;
  const firstSlot = map.playerDeployment[0];
  const defaultInspectedPosition = firstSlot ? positionKey(firstSlot.x, firstSlot.y) : null;
  const [inspectedPositionKey, setInspectedPositionKey] = useState<string | null>(defaultInspectedPosition);
  const activeInspectedPositionKey = inspectedPositionKey && deploymentSlots.has(inspectedPositionKey)
    ? inspectedPositionKey
    : defaultInspectedPosition;
  const inspectedCoordinates = activeInspectedPositionKey?.split(",").map(Number);
  const inspectedPosition = inspectedCoordinates && inspectedCoordinates.length === 2 &&
    Number.isInteger(inspectedCoordinates[0]) && Number.isInteger(inspectedCoordinates[1])
    ? { x: inspectedCoordinates[0]!, y: inspectedCoordinates[1]! }
    : null;
  const inspectedTerrain = inspectedPosition
    ? getDeploymentTerrainDetails(
        map,
        inspectedPosition,
        assignedByPosition.get(activeInspectedPositionKey ?? "")?.movementType
      )
    : null;
  const inspectedUnit = inspectedPosition
    ? assignedByPosition.get(positionKey(inspectedPosition.x, inspectedPosition.y)) ?? null
    : null;

  return (
    <section className="deployment-preview" aria-labelledby="deployment-preview-heading" data-testid="deployment-preview">
      <div className="deployment-preview-heading">
        <div>
          <p className="eyebrow">FORMATION</p>
          <h3 id="deployment-preview-heading">出撃配置プレビュー</h3>
          <p>出撃予定の味方をマップ上に表示します。味方のマスでは詳細を、空き出撃マスでは地形を確認できます。</p>
        </div>
        <span data-testid="deployment-preview-count" aria-live="polite">{occupiedCount} / {map.playerDeployment.length}か所</span>
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
                  className={"deployment-preview-unit" + (detailUnitId === assigned.id || activeInspectedPositionKey === key ? " is-inspected" : "")}
                  type="button"
                  aria-label={assigned.name + "、" + label + "に配置済み。詳細を表示"}
                  aria-pressed={activeInspectedPositionKey === key}
                  disabled={disabled}
                  onClick={() => {
                    setInspectedPositionKey(key);
                    onSelectUnit(assigned.id);
                  }}
                  title={assigned.name + " · Lv." + assigned.level}
                  data-unit-id={assigned.id}
                >
                  <span className="deployment-preview-token" aria-hidden="true">味</span>
                  <span className="deployment-preview-unit-name" aria-hidden="true">{assigned.name}</span>
                </button>
              ) : slot ? (
                <button
                  className={"deployment-preview-empty-slot" + (activeInspectedPositionKey === key ? " is-inspected" : "")}
                  type="button"
                  aria-label={"空き出撃位置 " + slot.ordinal + "、" + label + "の地形を確認"}
                  aria-pressed={activeInspectedPositionKey === key}
                  disabled={disabled}
                  onClick={() => setInspectedPositionKey(key)}
                  data-testid="deployment-preview-empty-slot"
                >
                  <span aria-hidden="true">＋</span>
                </button>
              ) : (
                <span className="deployment-preview-terrain-symbol" aria-hidden="true">
                  {TERRAIN_DEFINITIONS[terrainType].symbol}
                </span>
              )}
            </div>
          );
        }))}
      </div>
      {inspectedTerrain && inspectedPosition && (
        <section className="deployment-preview-terrain" aria-labelledby="deployment-preview-terrain-heading" data-testid="deployment-preview-terrain" aria-live="polite">
          <div className="deployment-preview-terrain-heading">
            <div>
              <p className="eyebrow">TERRAIN</p>
              <h4 id="deployment-preview-terrain-heading">{inspectedTerrain.coordinate} · {inspectedTerrain.terrainName}</h4>
            </div>
            <span>{inspectedUnit ? "配置中の味方" : "空き出撃マス"}</span>
          </div>
          {inspectedUnit ? (
            <>
              <p className="deployment-preview-terrain-unit">{inspectedUnit.name} · {inspectedUnit.movementType === "infantry" ? "歩兵" : "騎馬"} · 移動力 {inspectedUnit.move}</p>
              {inspectedTerrain.unitMovementCost === null ? (
                <p className="deployment-preview-terrain-warning" role="status">このユニットの移動タイプでは進入できません。別の出撃位置を選んでください。</p>
              ) : (
                <p className="deployment-preview-terrain-passable" role="status">このユニットの移動タイプで進入できます · 移動コスト {inspectedTerrain.unitMovementCost}</p>
              )}
            </>
          ) : (
            <p className="deployment-preview-terrain-unit">この出撃マスは現在空いています。</p>
          )}
          <dl className="deployment-preview-terrain-grid">
            <div><dt>歩兵コスト</dt><dd>{inspectedTerrain.infantryMovementCost === null ? "進入不可" : inspectedTerrain.infantryMovementCost}</dd></div>
            <div><dt>騎馬コスト</dt><dd>{inspectedTerrain.cavalryMovementCost === null ? "進入不可" : inspectedTerrain.cavalryMovementCost}</dd></div>
            <div><dt>守備補正</dt><dd>{inspectedTerrain.defenseBonus >= 0 ? "+" : ""}{inspectedTerrain.defenseBonus}</dd></div>
            <div><dt>回避補正</dt><dd>{inspectedTerrain.avoidanceBonus >= 0 ? "+" : ""}{inspectedTerrain.avoidanceBonus}</dd></div>
          </dl>
          {inspectedTerrain.specialEffect && <p className="deployment-preview-terrain-effect">{inspectedTerrain.specialEffect}</p>}
        </section>
      )}
      <div className="deployment-preview-legend" aria-label="配置プレビューの凡例">
        <span><i className="deployment-preview-legend-ally" />出撃予定</span>
        <span><i className="deployment-preview-legend-empty" />空き出撃位置</span>
        <span><i className="deployment-preview-legend-terrain" />地形</span>
      </div>
      <p className="deployment-preview-note">表示は現在の編成・出撃位置のプレビューです。配置確定まではゲーム状態とセーブを変更しません。</p>
    </section>
  );
}
