import type {
  CampaignUnit,
  GameMapDefinition,
  GameStateSnapshot,
  GameUnit,
  Position
} from "../domain/models/game";
import { isValidGameMapDefinition } from "../domain/models/validate-game-map";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";

export interface PlayerDeploymentAssignment {
  unitId: string;
  position: Position;
}
function toCampaignUnit(unit: GameUnit): CampaignUnit {
  const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...rest } = unit;
  return {
    ...rest,
    stats: { ...rest.stats },
    growthRates: { ...rest.growthRates },
    usableWeaponTypes: [...rest.usableWeaponTypes],
    inventory: [...rest.inventory]
  };
}
function reserveToGameUnit(unit: CampaignUnit, position: Position): GameUnit {
  return {
    ...unit,
    faction: "player",
    position: { ...position },
    hasMoved: false,
    hasActed: false
  };
}

/** Selects living campaign members; non-selected survivors become persistent reserves. */
export function preparePlayerDeployment(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  assignments: readonly PlayerDeploymentAssignment[],
  selectedUnitIds: readonly string[] = state.units
    .filter((unit) => unit.faction === "player" && unit.currentHp > 0)
    .map((unit) => unit.id)
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

  const livingActivePlayers = state.units.filter((unit) =>
    unit.faction === "player" && unit.currentHp > 0
  );
  const reservePositions = new Map(map.playerDeployment.map((entry) =>
    [entry.unitId, { x: entry.x, y: entry.y }] as const
  ));
  const availableCandidates = new Map<string, GameUnit>();
  for (const unit of livingActivePlayers) availableCandidates.set(unit.id, unit);
  for (const reserve of state.reserveUnits) {
    const position = reservePositions.get(reserve.id);
    if (!position || availableCandidates.has(reserve.id)) {
      throw new Error("The reserve roster contains a unit that cannot be deployed on this map.");
    }
    availableCandidates.set(reserve.id, reserveToGameUnit(reserve, position));
  }

  if (selectedUnitIds.length === 0) {
    throw new Error("At least one living player unit must be selected for deployment.");
  }
  if (
    new Set(selectedUnitIds).size !== selectedUnitIds.length ||
    selectedUnitIds.some((id) => !availableCandidates.has(id))
  ) {
    throw new Error("Deployment selection must contain unique members of the living campaign roster.");
  }
  if (map.defeatCondition?.type === "unit_defeated" &&
      !selectedUnitIds.includes(map.defeatCondition.targetUnitId)) {
    throw new Error("The map's critical player unit must be selected for deployment.");
  }
  if (selectedUnitIds.length > map.playerDeployment.length) {
    throw new Error("The selected party exceeds the map's available deployment positions.");
  }
  const selectedSet = new Set(selectedUnitIds);
  if (assignments.length !== selectedUnitIds.length) {
    throw new Error("Every surviving selected player unit must have exactly one deployment position.");
  }

  const availablePositions = new Set(map.playerDeployment.map(({ x, y }) => x + "," + y));
  const assignmentsByUnitId = new Map<string, Position>();
  const assignedPositions = new Set<string>();
  for (const assignment of assignments) {
    const key = assignment.position.x + "," + assignment.position.y;
    if (!selectedSet.has(assignment.unitId) || assignmentsByUnitId.has(assignment.unitId)) {
      throw new Error("Deployment assignments must reference each surviving player unit exactly once.");
    }
    if (!availablePositions.has(key) || assignedPositions.has(key)) {
      throw new Error("Each unit must use a unique configured player deployment tile.");
    }
    assignmentsByUnitId.set(assignment.unitId, { ...assignment.position });
    assignedPositions.add(key);
  }
  if (selectedUnitIds.some((id) => !assignmentsByUnitId.has(id))) {
    throw new Error("Every selected player unit must have a deployment position.");
  }

  const selectedPlayers = selectedUnitIds.map((id) => {
    const candidate = availableCandidates.get(id)!;
    return {
      ...candidate,
      position: { ...assignmentsByUnitId.get(id)! },
      hasMoved: false,
      hasActed: false
    };
  });
  const reserveUnits: CampaignUnit[] = [
    ...livingActivePlayers.filter((unit) => !selectedSet.has(unit.id)).map(toCampaignUnit),
    ...state.reserveUnits.filter((unit) => !selectedSet.has(unit.id))
  ];
  const nextState: GameStateSnapshot = {
    ...state,
    units: [...state.units.filter((unit) => unit.faction === "enemy"), ...selectedPlayers],
    reserveUnits
  };
  if (!isValidGameStateSnapshot(nextState, map)) {
    throw new Error("The prepared deployment state is invalid.");
  }
  return nextState;
}
