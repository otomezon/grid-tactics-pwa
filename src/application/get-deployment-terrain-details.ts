import { TERRAIN_DEFINITIONS } from "../content/terrain";
import type { GameMapDefinition, MovementType, Position } from "../domain/models/game";

export interface DeploymentTerrainDetails {
  coordinate: string;
  terrainName: string;
  infantryMovementCost: number | null;
  cavalryMovementCost: number | null;
  defenseBonus: number;
  avoidanceBonus: number;
  unitMovementType: MovementType | null;
  unitMovementCost: number | null;
  specialEffect: string | null;
}

/** Reads the terrain effects of a configured deployment slot without changing the map or assignment. */
export function getDeploymentTerrainDetails(
  map: GameMapDefinition,
  position: Position,
  unitMovementType?: MovementType
): DeploymentTerrainDetails | null {
  if (
    !Number.isInteger(position.x) ||
    !Number.isInteger(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    position.x >= map.width ||
    position.y >= map.height
  ) {
    return null;
  }
  if (!map.playerDeployment.some((slot) => slot.x === position.x && slot.y === position.y)) {
    return null;
  }

  const terrainType = map.terrain[position.y]?.[position.x];
  if (!terrainType) return null;
  const terrain = TERRAIN_DEFINITIONS[terrainType];
  const unitMovementCost = unitMovementType
    ? terrain.movementCost[unitMovementType]
    : null;

  return {
    coordinate: (position.x + 1) + "列・" + (position.y + 1) + "行",
    terrainName: terrain.label,
    infantryMovementCost: terrain.movementCost.infantry,
    cavalryMovementCost: terrain.movementCost.cavalry,
    defenseBonus: terrain.defenseBonus,
    avoidanceBonus: terrain.avoidanceBonus,
    unitMovementType: unitMovementType ?? null,
    unitMovementCost,
    specialEffect: terrainType === "fort"
      ? "所属陣営のフェイズ開始時に最大HPの10%を回復（端数切り捨ての試作挙動）"
      : null
  };
}
