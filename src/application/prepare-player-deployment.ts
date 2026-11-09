import type { GameMapDefinition, GameStateSnapshot, Position } from "../domain/models/game";
import { isValidGameMapDefinition } from "../domain/models/validate-game-map";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";

export interface PlayerDeploymentAssignment {
  unitId: string;
  position: Position;
}

/**
 * Applies a pre-battle arrangement using only the map's configured player
 * deployment tiles. The selected roster is unchanged; this command only
 * rearranges the living player units before the first action of turn one.
 */
export function preparePlayerDeployment(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  assignments: readonly PlayerDeploymentAssignment[]
): GameStateSnapshot {
  if (!isValidGameMapDefinition(map) || !isValidGameStateSnapshot(state, map)) {
    throw new Error("The game state or map definition is invalid.");
  }
  if (state.phase !== "player" || state.turn !== 1) {
    throw new Error("Deployment can only be prepared before the first player phase action.");
  }
  if (state.units.some((unit) => unit.faction === "player" && (unit.hasMoved || unit.hasActed))) {
    throw new Error("Deployment can no longer be changed after a player unit has acted.");
  }
  if (evaluateBattleOutcome(state, map) !== "playing") {
    throw new Error("Deployment cannot be prepared after the battle has ended.");
  }

  const livingPlayers = state.units.filter(
    (unit) => unit.faction === "player" && unit.currentHp > 0
  );
  if (assignments.length !== livingPlayers.length) {
    throw new Error("Every surviving player unit must have exactly one deployment position.");
  }

  const availablePositions = new Set(
    map.playerDeployment.map(({ x, y }) => x + "," + y)
  );
  const assignmentsByUnitId = new Map<string, Position>();
  const assignedPositions = new Set<string>();

  for (const assignment of assignments) {
    const positionKey = assignment.position.x + "," + assignment.position.y;
    if (
      !livingPlayers.some((unit) => unit.id === assignment.unitId) ||
      assignmentsByUnitId.has(assignment.unitId)
    ) {
      throw new Error("Deployment assignments must reference each surviving player unit exactly once.");
    }
    if (!availablePositions.has(positionKey) || assignedPositions.has(positionKey)) {
      throw new Error("Each unit must use a unique configured player deployment tile.");
    }

    assignmentsByUnitId.set(assignment.unitId, {
      x: assignment.position.x,
      y: assignment.position.y
    });
    assignedPositions.add(positionKey);
  }

  if (livingPlayers.some((unit) => !assignmentsByUnitId.has(unit.id))) {
    throw new Error("Every surviving player unit must have a deployment position.");
  }

  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.flatMap((unit) => {
      if (unit.faction !== "player") return [unit];
      if (unit.currentHp <= 0) return [];

      const position = assignmentsByUnitId.get(unit.id)!;
      return [{
        ...unit,
        position: { x: position.x, y: position.y },
        hasMoved: false,
        hasActed: false
      }];
    })
  };

  if (!isValidGameStateSnapshot(nextState, map)) {
    throw new Error("The prepared deployment state is invalid.");
  }

  return nextState;
}
