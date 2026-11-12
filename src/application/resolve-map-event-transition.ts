import type { GameMapDefinition, GameStateSnapshot, MapEventTrigger } from "../domain/models/game";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { resolveMapEvents, type MapEventMessage } from "./resolve-map-events";

export interface MapEventTransitionExecution {
  nextState: GameStateSnapshot;
  messages: MapEventMessage[];
}

function getDefeatedUnitIds(
  previousState: GameStateSnapshot,
  nextState: GameStateSnapshot
): string[] {
  const nextUnitsById = new Map(nextState.units.map((unit) => [unit.id, unit]));
  return previousState.units.flatMap((unit) => {
    if (unit.currentHp <= 0) return [];
    const nextUnit = nextUnitsById.get(unit.id);
    return !nextUnit || nextUnit.currentHp <= 0 ? [unit.id] : [];
  });
}

/**
 * Fires events implied by a committed state transition: phase/turn start,
 * unit defeats, boss defeat, and the first transition to victory/defeat.
 */
export function resolveMapEventTransition(
  previousState: GameStateSnapshot,
  nextState: GameStateSnapshot,
  map: GameMapDefinition
): MapEventTransitionExecution {
  if (previousState.chapterId !== map.id || nextState.chapterId !== map.id) {
    throw new Error("Map event transitions must stay within the active chapter.");
  }

  const triggers: MapEventTrigger[] = [];
  if (
    previousState.phase !== nextState.phase ||
    previousState.turn !== nextState.turn
  ) {
    triggers.push({
      type: "turn-start",
      turn: nextState.turn,
      phase: nextState.phase
    });
  }

  const defeatedUnitIds = getDefeatedUnitIds(previousState, nextState);
  for (const unitId of defeatedUnitIds) {
    triggers.push({ type: "unit-defeated", unitId });
  }

  if (
    map.objective.type === "defeat_boss" &&
    defeatedUnitIds.includes(map.objective.targetUnitId)
  ) {
    triggers.push({ type: "boss-defeated" });
  }

  const previousOutcome = evaluateBattleOutcome(previousState, map);
  const nextOutcome = evaluateBattleOutcome(nextState, map);
  if (previousOutcome === "playing" && nextOutcome !== "playing") {
    triggers.push({ type: nextOutcome });
  }

  let currentState = nextState;
  const messages: MapEventMessage[] = [];
  for (const trigger of triggers) {
    const execution = resolveMapEvents(currentState, map, trigger);
    currentState = execution.nextState;
    messages.push(...execution.messages);
  }
  return { nextState: currentState, messages };
}
