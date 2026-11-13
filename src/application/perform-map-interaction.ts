import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import type { GameMapDefinition, GameStateSnapshot, Position } from "../domain/models/game";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { resolveMapEvents } from "./resolve-map-events";

export interface MapInteractionPoint {
  id: string;
  label: string;
  description: string | null;
  position: Position;
  unitId: string | null;
}

export interface MapInteractionExecution {
  nextState: GameStateSnapshot;
  interaction: MapInteractionPoint;
  actorName: string;
}

/** Projects untriggered, map-authored investigation points for their map markers. */
export function getMapInteractionPoints(
  state: GameStateSnapshot,
  map: GameMapDefinition
): MapInteractionPoint[] {
  if (state.chapterId !== map.id) {
    throw new Error("Map interactions can only be read for the snapshot's current chapter.");
  }
  const fired = new Set(state.firedMapEventIds);
  return (map.events ?? []).flatMap((event) => {
    if (event.trigger.type !== "unit-interacts" || fired.has(event.id)) return [];
    return [{
      id: event.id,
      label: event.trigger.label,
      description: event.trigger.description ?? null,
      position: { x: event.trigger.x, y: event.trigger.y },
      unitId: event.trigger.unitId ?? null
    }];
  });
}

/** Returns the one interaction available to a selected ally standing on its tile. */
export function getAvailableMapInteraction(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  unitId: string
): MapInteractionPoint | null {
  if (
    state.chapterId !== map.id ||
    state.phase !== "player" ||
    evaluateBattleOutcome(state, map) !== "playing"
  ) return null;
  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.faction !== "player" || unit.currentHp <= 0 || unit.hasActed) return null;
  return getMapInteractionPoints(state, map).find((point) =>
    point.position.x === unit.position.x &&
    point.position.y === unit.position.y &&
    (point.unitId === null || point.unitId === unit.id)
  ) ?? null;
}

/**
 * Executes a map interaction as a committed player command. Movement is allowed
 * beforehand; the interaction consumes the unit's action only after its event
 * effect has completed and the resulting snapshot validates.
 */
export function performMapInteraction(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  unitId: string
): MapInteractionExecution {
  const interaction = getAvailableMapInteraction(state, map, unitId);
  if (!interaction) {
    throw new Error("The selected ally cannot interact at its current position.");
  }
  const actor = state.units.find((candidate) => candidate.id === unitId)!;
  const eventExecution = resolveMapEvents(state, map, {
    type: "unit-interacts",
    x: interaction.position.x,
    y: interaction.position.y,
    label: interaction.label,
    unitId
  });
  if (!eventExecution.nextState.firedMapEventIds.includes(interaction.id)) {
    throw new Error("The map interaction event did not fire.");
  }
  const nextState: GameStateSnapshot = {
    ...eventExecution.nextState,
    units: eventExecution.nextState.units.map((unit) =>
      unit.id === unitId ? { ...unit, hasActed: true } : unit
    )
  };
  if (!isValidGameStateSnapshot(nextState, map)) {
    throw new Error("The game state after the map interaction is invalid.");
  }
  return { nextState, interaction, actorName: actor.name };
}
