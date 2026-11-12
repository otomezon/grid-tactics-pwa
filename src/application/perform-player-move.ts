import { calculateMovementPath, type MovementPath } from "../domain/movement/calculate-reachable-tiles";
import type { GameMapDefinition, GameStateSnapshot, GameUnit, Position } from "../domain/models/game";

export interface PlayerMoveExecution {
  nextState: GameStateSnapshot;
  movedUnit: GameUnit;
  path: MovementPath;
}

/**
 * Moves one living player unit to a reachable tile.
 * Movement legality and the immutable state transition live in the application
 * layer so UI event handlers cannot bypass terrain, occupancy, or action rules.
 */
export function performPlayerMove(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  unitId: string,
  destination: Position
): PlayerMoveExecution {
  if (state.phase !== "player") {
    throw new Error("自軍フェイズ中のみ移動できます。");
  }

  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.faction !== "player") {
    throw new Error("選択した味方ユニットが見つかりません。");
  }
  if (unit.currentHp <= 0) {
    throw new Error("撃破されたユニットは移動できません。");
  }
  if (unit.hasMoved || unit.hasActed) {
    throw new Error("移動済みまたは行動済みのユニットは移動できません。");
  }
  if (destination.x === unit.position.x && destination.y === unit.position.y) {
    throw new Error("現在位置と同じマスには移動できません。");
  }

  const path = calculateMovementPath({
    terrain: map.terrain,
    start: unit.position,
    movementPoints: unit.move,
    movementType: unit.movementType,
    occupiedPositions: state.units
      .filter((candidate) => candidate.id !== unit.id)
      .map((candidate) => candidate.position)
  }, destination);

  if (!path || path.positions.length < 2) {
    throw new Error("そのマスには移動できません。移動力・地形・他ユニットの位置を確認してください。");
  }

  const movedUnit: GameUnit = {
    ...unit,
    position: { ...destination },
    hasMoved: true
  };
  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.map((candidate) =>
      candidate.id === unitId ? movedUnit : candidate
    )
  };

  return { nextState, movedUnit, path };
}
