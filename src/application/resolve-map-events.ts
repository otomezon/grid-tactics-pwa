import { INVENTORY_ITEMS_BY_ID } from "../content/items";
import { WEAPONS_BY_ID } from "../content/weapons";
import type {
  GameMapDefinition, GameStateSnapshot, GameUnit, MapEventDefinition, MapEventTrigger
} from "../domain/models/game";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";

const MAX_INVENTORY_SIZE = 5;

export interface MapEventMessage {
  id: string;
  speaker: string | null;
  text: string;
}
export interface MapEventExecution {
  nextState: GameStateSnapshot;
  messages: MapEventMessage[];
}

function matchesTrigger(event: MapEventDefinition, trigger: MapEventTrigger): boolean {
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
        expected.turn === trigger.turn && expected.phase === trigger.phase;
    case "unit-defeated":
      return trigger.type === "unit-defeated" && expected.unitId === trigger.unitId;
  }
}

function toMapEventMessage(event: MapEventDefinition): MapEventMessage {
  return { id: event.id, speaker: event.action.speaker ?? null, text: event.action.text };
}

/** Rebuilds fired event messages in the persisted order. */
export function getMapEventMessageHistory(
  state: GameStateSnapshot,
  map: GameMapDefinition
): MapEventMessage[] {
  if (state.chapterId !== map.id) throw new Error("Map events can only run for the snapshot's current chapter.");
  const byId = new Map((map.events ?? []).map((event) => [event.id, event] as const));
  return state.firedMapEventIds.flatMap((id) => {
    const event = byId.get(id);
    return event ? [toMapEventMessage(event)] : [];
  });
}

export function getPendingMapEventMessages(
  state: GameStateSnapshot,
  map: GameMapDefinition
): MapEventMessage[] {
  const acknowledged = new Set(state.acknowledgedMapEventIds);
  return getMapEventMessageHistory(state, map).filter((event) => !acknowledged.has(event.id));
}

export function acknowledgeMapEvent(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  eventId: string
): GameStateSnapshot {
  if (!getPendingMapEventMessages(state, map).some((event) => event.id === eventId)) return state;
  return { ...state, acknowledgedMapEventIds: [...state.acknowledgedMapEventIds, eventId] };
}

function cloneReinforcement(unit: GameUnit): GameUnit {
  return {
    ...unit, stats: { ...unit.stats }, growthRates: { ...unit.growthRates },
    usableWeaponTypes: [...unit.usableWeaponTypes], inventory: [...unit.inventory],
    position: { ...unit.position }
  };
}

function applyMapEventAction(state: GameStateSnapshot, event: MapEventDefinition): GameStateSnapshot {
  const action = event.action;
  if (action.type === "show-message") return state;

  if (action.type === "grant-item") {
    if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > MAX_INVENTORY_SIZE) {
      throw new Error("A map event item quantity must be an integer from 1 to 5.");
    }
    if (!Object.hasOwn(INVENTORY_ITEMS_BY_ID, action.itemId) && !Object.hasOwn(WEAPONS_BY_ID, action.itemId)) {
      throw new Error(`Map event item "${action.itemId}" is not registered.`);
    }
    const recipient = state.units.find((unit) => unit.id === action.recipientUnitId);
    if (!recipient || recipient.faction !== "player" || recipient.currentHp <= 0) {
      throw new Error(`Map event recipient "${action.recipientUnitId}" is not a living deployed ally.`);
    }
    if (recipient.inventory.length + action.quantity > MAX_INVENTORY_SIZE) {
      throw new Error(`${recipient.name}'s inventory does not have enough free slots for the event reward.`);
    }
    return {
      ...state,
      units: state.units.map((unit) => unit.id === recipient.id ? {
        ...unit,
        inventory: [...unit.inventory, ...Array.from({ length: action.quantity }, () => action.itemId)]
      } : unit)
    };
  }

  const unit = action.unit;
  if (state.units.some((candidate) => candidate.id === unit.id) ||
      state.reserveUnits.some((candidate) => candidate.id === unit.id)) {
    throw new Error(`Map event reinforcement "${unit.id}" already exists in the campaign state.`);
  }
  if (state.units.some((candidate) =>
    candidate.position.x === unit.position.x && candidate.position.y === unit.position.y
  )) {
    throw new Error(`Map event reinforcement "${unit.name}" cannot spawn on an occupied tile.`);
  }
  return { ...state, units: [...state.units, cloneReinforcement(unit)] };
}

/**
 * Applies matching actions to a detached snapshot in content order. A failed
 * action rejects the complete transition; event IDs are committed last.
 */
export function resolveMapEvents(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  triggerOrTriggers: MapEventTrigger | MapEventTrigger[]
): MapEventExecution {
  if (state.chapterId !== map.id) throw new Error("Map events can only run for the snapshot's current chapter.");
  const triggers = Array.isArray(triggerOrTriggers) ? triggerOrTriggers : [triggerOrTriggers];
  const fired = new Set(state.firedMapEventIds);
  const ids: string[] = [];
  const messages: MapEventMessage[] = [];
  let nextState = state;
  let hasStateEffects = false;

  for (const event of map.events ?? []) {
    if (fired.has(event.id) || !triggers.some((trigger) => matchesTrigger(event, trigger))) continue;
    nextState = applyMapEventAction(nextState, event);
    ids.push(event.id);
    fired.add(event.id);
    if (event.action.type !== "show-message") hasStateEffects = true;
    messages.push(toMapEventMessage(event));
  }
  if (ids.length === 0) return { nextState: state, messages };

  const committed: GameStateSnapshot = {
    ...nextState,
    firedMapEventIds: [...state.firedMapEventIds, ...ids]
  };
  if (hasStateEffects && !isValidGameStateSnapshot(committed, map)) {
    throw new Error("The game state after resolving map event actions is invalid.");
  }
  return { nextState: committed, messages };
}