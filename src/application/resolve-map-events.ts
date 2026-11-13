import type {
  GameMapDefinition,
  GameStateSnapshot,
  MapEventDefinition,
  MapEventTrigger
} from "../domain/models/game";

export interface MapEventMessage {
  id: string;
  speaker: string | null;
  text: string;
}

export interface MapEventExecution {
  nextState: GameStateSnapshot;
  messages: MapEventMessage[];
}

function matchesTrigger(
  event: MapEventDefinition,
  trigger: MapEventTrigger
): boolean {
  const expected = event.trigger;
  if (expected.type !== trigger.type) return false;

  switch (expected.type) {
    case "stage-start":
    case "boss-defeated":
    case "victory":
    case "defeat":
      return true;
    case "turn-start":
      return trigger.type === "turn-start" &&
        expected.turn === trigger.turn &&
        expected.phase === trigger.phase;
    case "unit-defeated":
      return trigger.type === "unit-defeated" &&
        expected.unitId === trigger.unitId;
  }
}

/** Returns fired message events that still need explicit player acknowledgement. */
export function getPendingMapEventMessages(
  state: GameStateSnapshot,
  map: GameMapDefinition
): MapEventMessage[] {
  if (state.chapterId !== map.id) {
    throw new Error("Map events can only run for the snapshot's current chapter.");
  }

  const fired = new Set(state.firedMapEventIds);
  const acknowledged = new Set(state.acknowledgedMapEventIds);
  return (map.events ?? []).flatMap((event) => {
    if (
      !fired.has(event.id) ||
      acknowledged.has(event.id) ||
      event.action.type !== "show-message"
    ) return [];
    return [{
      id: event.id,
      speaker: event.action.speaker ?? null,
      text: event.action.text
    }];
  });
}

/** Acknowledges only an event message that has fired and is still pending. */
export function acknowledgeMapEvent(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  eventId: string
): GameStateSnapshot {
  if (!getPendingMapEventMessages(state, map).some((event) => event.id === eventId)) {
    return state;
  }
  return {
    ...state,
    acknowledgedMapEventIds: [...state.acknowledgedMapEventIds, eventId]
  };
}

/** Resolves one or more map-local triggers in content order without mutating the input snapshot. */
export function resolveMapEvents(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  triggerOrTriggers: MapEventTrigger | MapEventTrigger[]
): MapEventExecution {
  if (state.chapterId !== map.id) {
    throw new Error("Map events can only run for the snapshot's current chapter.");
  }

  const triggers = Array.isArray(triggerOrTriggers) ? triggerOrTriggers : [triggerOrTriggers];
  const fired = new Set(state.firedMapEventIds);
  const newlyFiredIds: string[] = [];
  const messages: MapEventMessage[] = [];

  for (const event of map.events ?? []) {
    if (fired.has(event.id) || !triggers.some((trigger) => matchesTrigger(event, trigger))) continue;
    newlyFiredIds.push(event.id);
    fired.add(event.id);
    if (event.action.type === "show-message") {
      messages.push({
        id: event.id,
        speaker: event.action.speaker ?? null,
        text: event.action.text
      });
    }
  }

  return newlyFiredIds.length === 0
    ? { nextState: state, messages }
    : {
        nextState: {
          ...state,
          firedMapEventIds: [...state.firedMapEventIds, ...newlyFiredIds]
        },
        messages
      };
}
