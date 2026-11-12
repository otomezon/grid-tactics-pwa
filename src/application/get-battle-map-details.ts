import { TERRAIN_DEFINITIONS } from "../content/terrain";
import type { GameMapDefinition, GameStateSnapshot, Position } from "../domain/models/game";

export interface BattleObjectiveDetails {
  victoryLabel: string;
  victoryStatus: string;
  defeatLabel: string;
  defeatStatus: string;
}

export interface TerrainInspectionDetails {
  coordinate: string;
  terrainName: string;
  infantryMovementCost: number | null;
  cavalryMovementCost: number | null;
  defenseBonus: number;
  avoidanceBonus: number;
  occupantLabel: string | null;
  specialEffect: string | null;
}

function describeUnitStatus(
  state: GameStateSnapshot,
  initialState: GameStateSnapshot,
  unitId: string,
  fallbackName: string
): string {
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.currentHp <= 0) {
    const initial = initialState.units.find((candidate) => candidate.id === unitId);
    return (initial?.name ?? fallbackName) + " · 撃破済み";
  }
  return unit.name + " · HP " + unit.currentHp + " / " + unit.stats.hp;
}

/** Projects the currently configured win/loss objectives without changing battle rules. */
export function getBattleObjectiveDetails(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  initialState: GameStateSnapshot
): BattleObjectiveDetails {
  let victoryLabel: string;
  let victoryStatus: string;
  if (map.objective.type === "defeat_all") {
    const livingEnemyCount = state.units.filter(
      (unit) => unit.faction === "enemy" && unit.currentHp > 0
    ).length;
    victoryLabel = "敵を全滅させる";
    victoryStatus = "残り " + livingEnemyCount + " / " + map.enemyDeployment.length + "体";
  } else {
    const targetUnitId = map.objective.targetUnitId ?? "";
    const targetUnit = state.units.find((unit) => unit.id === targetUnitId);
    const initialTarget = initialState.units.find((unit) => unit.id === targetUnitId);
    victoryLabel = "ボスを撃破する";
    victoryStatus = targetUnit && targetUnit.currentHp > 0
      ? targetUnit.name + " · HP " + targetUnit.currentHp + " / " + targetUnit.stats.hp
      : (initialTarget?.name ?? "ボス") + " · 撃破済み";
  }

  let defeatLabel: string;
  let defeatStatus: string;
  if (map.defeatCondition?.type === "unit_defeated") {
    defeatLabel = (initialState.units.find((unit) => unit.id === map.defeatCondition?.targetUnitId)?.name ?? "指定された味方") + "を撃破させない";
    defeatStatus = describeUnitStatus(
      state,
      initialState,
      map.defeatCondition.targetUnitId,
      "指定された味方"
    );
  } else {
    const livingPlayerCount = state.units.filter(
      (unit) => unit.faction === "player" && unit.currentHp > 0
    ).length;
    defeatLabel = "味方全滅";
    defeatStatus = livingPlayerCount > 0
      ? "生存味方 " + livingPlayerCount + "体"
      : "味方ユニットが残っていません";
  }

  return { victoryLabel, victoryStatus, defeatLabel, defeatStatus };
}

/** Reads existing terrain data and occupancy for a map tile; this is view-only data. */
export function getTerrainInspectionDetails(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  position: Position | null
): TerrainInspectionDetails | null {
  if (
    !position ||
    !Number.isInteger(position.x) ||
    !Number.isInteger(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    position.x >= map.width ||
    position.y >= map.height
  ) {
    return null;
  }

  const terrainType = map.terrain[position.y]?.[position.x];
  if (!terrainType) return null;
  const terrain = TERRAIN_DEFINITIONS[terrainType];
  const occupant = state.units.find((unit) =>
    unit.position.x === position.x && unit.position.y === position.y
  );

  return {
    coordinate: String(position.x + 1) + "列・" + String(position.y + 1) + "行",
    terrainName: terrain.label,
    infantryMovementCost: terrain.movementCost.infantry,
    cavalryMovementCost: terrain.movementCost.cavalry,
    defenseBonus: terrain.defenseBonus,
    avoidanceBonus: terrain.avoidanceBonus,
    occupantLabel: occupant
      ? (occupant.faction === "player" ? "味方：" : "敵：") + occupant.name
      : null,
    specialEffect: terrainType === "fort"
      ? "所属陣営のフェイズ開始時に最大HPの10%を回復（端数切り捨ての試作挙動）"
      : null
  };
}
