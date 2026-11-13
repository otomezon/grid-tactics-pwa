import { INVENTORY_ITEMS_BY_ID } from "../content/items";
import { WEAPONS_BY_ID } from "../content/weapons";
import type {
  CampaignUnit,
  GameMapDefinition,
  GameStateSnapshot,
  GameUnit,
  MapEventChoiceDefinition,
  MapEventDefinition,
  MapEventTrigger
} from "../domain/models/game";
import { isValidCampaignUnitData } from "../domain/models/validate-campaign-unit";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";

const MAX_INVENTORY_SIZE = 5;

export interface MapEventMessage {
  id: string;
  speaker: string | null;
  text: string;
  choices?: MapEventChoiceDefinition[];
  selectedChoiceLabel?: string | null;
}
export interface MapEventExecution {
  nextState: GameStateSnapshot;
  messages: MapEventMessage[];
}
export interface MapEventChoiceExecution extends MapEventExecution {
  selectedChoiceLabel: string;
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
    case "unit-interacts":
      return trigger.type === "unit-interacts" &&
        expected.x === trigger.x &&
        expected.y === trigger.y &&
        (expected.unitId === undefined || expected.unitId === trigger.unitId);
    case "event-choice":
      return trigger.type === "event-choice" &&
        expected.eventId === trigger.eventId &&
        expected.choiceId === trigger.choiceId;
  }
}

function toMapEventMessage(event: MapEventDefinition, selectedChoiceId?: string): MapEventMessage {
  if (event.action.type === "show-choice") {
    return {
      id: event.id,
      speaker: event.action.speaker ?? null,
      text: event.action.text,
      choices: event.action.choices.map((choice) => ({ ...choice })),
      selectedChoiceLabel: event.action.choices.find((choice) => choice.id === selectedChoiceId)?.label ?? null
    };
  }
  return { id: event.id, speaker: event.action.speaker ?? null, text: event.action.text };
}

/** Rebuilds fired event messages and recorded dialogue choices from content and snapshot state. */
export function getMapEventMessageHistory(
  state: GameStateSnapshot,
  map: GameMapDefinition
): MapEventMessage[] {
  if (state.chapterId !== map.id) throw new Error("Map events can only run for the snapshot's current chapter.");
  const byId = new Map((map.events ?? []).map((event) => [event.id, event] as const));
  const selectedChoiceByEventId = new Map(
    state.mapEventChoices.map((selection) => [selection.eventId, selection.choiceId] as const)
  );
  return state.firedMapEventIds.flatMap((id) => {
    const event = byId.get(id);
    return event ? [toMapEventMessage(event, selectedChoiceByEventId.get(id))] : [];
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
  const event = map.events?.find((candidate) => candidate.id === eventId);
  if (!event || event.action.type === "show-choice") return state;
  return { ...state, acknowledgedMapEventIds: [...state.acknowledgedMapEventIds, eventId] };
}

function cloneReinforcement(unit: GameUnit): GameUnit {
  return {
    ...unit,
    stats: { ...unit.stats },
    growthRates: { ...unit.growthRates },
    usableWeaponTypes: [...unit.usableWeaponTypes],
    inventory: [...unit.inventory],
    position: { ...unit.position }
  };
}

function cloneCampaignUnit(unit: CampaignUnit): CampaignUnit {
  return {
    ...unit,
    stats: { ...unit.stats },
    growthRates: { ...unit.growthRates },
    usableWeaponTypes: [...unit.usableWeaponTypes],
    inventory: [...unit.inventory]
  };
}

function applyMapEventAction(state: GameStateSnapshot, event: MapEventDefinition): GameStateSnapshot {
  const action = event.action;
  if (action.type === "show-message" || action.type === "show-choice") return state;

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

  if (action.type === "recruit-unit") {
    if (!isValidCampaignUnitData(action.unit)) {
      throw new Error("The recruited campaign member definition is invalid.");
    }
    if (state.units.some((candidate) => candidate.id === action.unit.id) ||
        state.reserveUnits.some((candidate) => candidate.id === action.unit.id)) {
      throw new Error(`Map event recruit "${action.unit.id}" already exists in the campaign roster.`);
    }
    return { ...state, reserveUnits: [...state.reserveUnits, cloneCampaignUnit(action.unit)] };
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

/** Applies matching map events atomically; event IDs are committed after all effects succeed. */
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
    const eventTrigger = event.trigger;
    const choiceNotRecorded = eventTrigger.type === "event-choice" &&
      !state.mapEventChoices.some((selection) =>
        selection.eventId === eventTrigger.eventId && selection.choiceId === eventTrigger.choiceId
      );
    if (
      fired.has(event.id) ||
      choiceNotRecorded ||
      !triggers.some((trigger) => matchesTrigger(event, trigger))
    ) continue;
    nextState = applyMapEventAction(nextState, event);
    ids.push(event.id);
    fired.add(event.id);
    if (event.action.type !== "show-message" && event.action.type !== "show-choice") hasStateEffects = true;
    messages.push(toMapEventMessage(
      event,
      nextState.mapEventChoices.find((selection) => selection.eventId === event.id)?.choiceId
    ));
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

/** Commits one pending dialogue choice and its selected branch as a single snapshot transition. */
export function chooseMapEventOption(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  eventId: string,
  choiceId: string
): MapEventChoiceExecution {
  const pending = getPendingMapEventMessages(state, map).find((event) => event.id === eventId);
  const definition = map.events?.find((event) => event.id === eventId);
  if (!pending || !definition || definition.action.type !== "show-choice") {
    throw new Error("The requested dialogue choice is not pending.");
  }
  const choice = definition.action.choices.find((candidate) => candidate.id === choiceId);
  if (!choice) throw new Error("The selected dialogue choice is not available.");
  if (state.mapEventChoices.some((selection) => selection.eventId === eventId)) {
    throw new Error("A choice has already been recorded for this dialogue event.");
  }

  const chosenState: GameStateSnapshot = {
    ...state,
    mapEventChoices: [...state.mapEventChoices, { eventId, choiceId }],
    acknowledgedMapEventIds: [...state.acknowledgedMapEventIds, eventId]
  };
  const branchExecution = resolveMapEvents(chosenState, map, { type: "event-choice", eventId, choiceId });
  if (!isValidGameStateSnapshot(branchExecution.nextState, map)) {
    throw new Error("The game state after resolving the selected dialogue branch is invalid.");
  }
  return { ...branchExecution, selectedChoiceLabel: choice.label };
}
