import { INVENTORY_ITEMS_BY_ID } from "../../content/items";
import { TERRAIN_DEFINITIONS } from "../../content/terrain";
import { WEAPONS_BY_ID } from "../../content/weapons";
import { isValidCampaignUnitData } from "./validate-campaign-unit";
import type { GameMapDefinition, MapDeployment, TerrainType } from "./game";

const TERRAIN_TYPES: ReadonlySet<string> = new Set([
  "plain", "road", "forest", "mountain", "fort", "wall", "water"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isDeployment(value: unknown, width: number, height: number): value is MapDeployment {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.unitId) &&
    Number.isInteger(value.x) && (value.x as number) >= 0 && (value.x as number) < width &&
    Number.isInteger(value.y) && (value.y as number) >= 0 && (value.y as number) < height;
}
function isEventMessage(action: Record<string, unknown>): boolean {
  return isNonEmptyString(action.text) && action.text.length <= 2000 &&
    (action.speaker === undefined ||
      (isNonEmptyString(action.speaker) && action.speaker.length <= 80));
}
function isReinforcementUnitShape(
  value: unknown,
  width: number,
  height: number,
  terrain: readonly (readonly TerrainType[])[]
): boolean {
  if (!isRecord(value) || !isRecord(value.position)) return false;
  const { id, name, faction, movementType, hasMoved, hasActed } = value;
  const { x, y } = value.position;
  if (
    !isNonEmptyString(id) || !isNonEmptyString(name) || faction !== "enemy" ||
    (movementType !== "infantry" && movementType !== "cavalry") ||
    hasMoved !== false || hasActed !== false ||
    !Number.isInteger(x) || (x as number) < 0 || (x as number) >= width ||
    !Number.isInteger(y) || (y as number) < 0 || (y as number) >= height
  ) return false;
  const terrainType = terrain[y as number]?.[x as number];
  return terrainType !== undefined &&
    TERRAIN_DEFINITIONS[terrainType].movementCost[movementType] !== null;
}

/** Validates map deployments, objectives, event triggers, and event-effect definitions. */
export function isValidGameMapDefinition(value: unknown): value is GameMapDefinition {
  if (!isRecord(value)) return false;
  const { id, width, height, terrain, playerDeployment, enemyDeployment, objective } = value;
  if (
    !isNonEmptyString(id) ||
    !Number.isInteger(width) || (width as number) < 1 ||
    !Number.isInteger(height) || (height as number) < 1 ||
    !Array.isArray(terrain) || terrain.length !== height ||
    !terrain.every((row) => Array.isArray(row) && row.length === width &&
      row.every((cell) => typeof cell === "string" && TERRAIN_TYPES.has(cell))) ||
    !Array.isArray(playerDeployment) || !Array.isArray(enemyDeployment) || !isRecord(objective)
  ) return false;

  const ids = new Set<string>();
  const occupied = new Set<string>();
  const playerIds = new Set<string>();
  const enemyIds = new Set<string>();
  for (const [list, factionIds] of [[playerDeployment, playerIds], [enemyDeployment, enemyIds]] as const) {
    for (const candidate of list) {
      if (!isDeployment(candidate, width as number, height as number)) return false;
      const key = candidate.x + "," + candidate.y;
      if (ids.has(candidate.unitId) || occupied.has(key)) return false;
      ids.add(candidate.unitId);
      occupied.add(key);
      factionIds.add(candidate.unitId);
    }
  }

  if (objective.type === "defeat_boss") {
    if (!isNonEmptyString(objective.targetUnitId) || !enemyIds.has(objective.targetUnitId)) return false;
  } else if (objective.type !== "defeat_all") return false;

  const defeatCondition = value.defeatCondition;
  if (defeatCondition !== undefined && (
    !isRecord(defeatCondition) || defeatCondition.type !== "unit_defeated" ||
    !isNonEmptyString(defeatCondition.targetUnitId) || !playerIds.has(defeatCondition.targetUnitId)
  )) return false;

  if (value.events !== undefined) {
    if (!Array.isArray(value.events) || value.events.length > 256) return false;

    const reinforcementIds = new Set<string>();
    const recruitmentIds = new Set<string>();
    for (const candidate of value.events) {
      if (!isRecord(candidate) || !isRecord(candidate.action)) continue;
      if (candidate.action.type === "spawn-reinforcement") {
        const unit = candidate.action.unit;
        if (!isReinforcementUnitShape(unit, width as number, height as number, terrain as TerrainType[][])) return false;
        const unitId = (unit as Record<string, unknown>).id as string;
        if (ids.has(unitId) || reinforcementIds.has(unitId) || recruitmentIds.has(unitId)) return false;
        reinforcementIds.add(unitId);
      } else if (candidate.action.type === "recruit-unit") {
        const unit = candidate.action.unit;
        if (!isValidCampaignUnitData(unit) || ids.has(unit.id) || reinforcementIds.has(unit.id) || recruitmentIds.has(unit.id)) return false;
        recruitmentIds.add(unit.id);
      }
    }

    const eventIds = new Set<string>();
    const interactionPositions = new Set<string>();
    const validDefeatTargetIds = new Set([...ids, ...reinforcementIds]);
    for (const candidate of value.events) {
      if (!isRecord(candidate) || !isNonEmptyString(candidate.id) ||
          candidate.id.length > 128 || eventIds.has(candidate.id) ||
          !isRecord(candidate.trigger) || !isRecord(candidate.action)) return false;
      eventIds.add(candidate.id);

      const trigger = candidate.trigger;
      switch (trigger.type) {
        case "stage-start":
        case "boss-defeated":
        case "victory":
        case "defeat":
          break;
        case "turn-start":
          if (!Number.isInteger(trigger.turn) || (trigger.turn as number) < 1 ||
              (trigger.phase !== "player" && trigger.phase !== "enemy")) return false;
          break;
        case "unit-defeated":
          if (!isNonEmptyString(trigger.unitId) || !validDefeatTargetIds.has(trigger.unitId)) return false;
          break;
        case "unit-interacts": {
          if (
            !Number.isInteger(trigger.x) || (trigger.x as number) < 0 || (trigger.x as number) >= (width as number) ||
            !Number.isInteger(trigger.y) || (trigger.y as number) < 0 || (trigger.y as number) >= (height as number) ||
            !isNonEmptyString(trigger.label) || trigger.label.length > 60 ||
            (trigger.description !== undefined &&
              (typeof trigger.description !== "string" || trigger.description.length > 240)) ||
            (trigger.unitId !== undefined &&
              (!isNonEmptyString(trigger.unitId) || !playerIds.has(trigger.unitId)))
          ) return false;
          const positionKey = String(trigger.x) + "," + String(trigger.y);
          if (interactionPositions.has(positionKey) || occupied.has(positionKey)) return false;
          interactionPositions.add(positionKey);
          const interactionTerrain = (terrain as TerrainType[][])[trigger.y as number]?.[trigger.x as number];
          if (
            !interactionTerrain ||
            (TERRAIN_DEFINITIONS[interactionTerrain].movementCost.infantry === null &&
             TERRAIN_DEFINITIONS[interactionTerrain].movementCost.cavalry === null)
          ) return false;
          break;
        }
        default:
          return false;
      }

      const action = candidate.action;
      if (!isEventMessage(action)) return false;
      if (action.type === "show-message") continue;
      if (action.type === "grant-item") {
        const itemId = action.itemId;
        if (
          !isNonEmptyString(action.recipientUnitId) || !playerIds.has(action.recipientUnitId) ||
          !isNonEmptyString(itemId) ||
          (!Object.hasOwn(INVENTORY_ITEMS_BY_ID, itemId) && !Object.hasOwn(WEAPONS_BY_ID, itemId)) ||
          !Number.isInteger(action.quantity) || (action.quantity as number) < 1 ||
          (action.quantity as number) > 5
        ) return false;
        continue;
      }
      if (action.type === "spawn-reinforcement") continue;
      if (action.type === "recruit-unit") {
        if (trigger.type !== "unit-interacts" || !isValidCampaignUnitData(action.unit)) return false;
        continue;
      }
      return false;
    }
  }
  return true;
}