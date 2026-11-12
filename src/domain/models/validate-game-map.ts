import type {
  GameMapDefinition,
  MapDeployment
} from "./game";

const TERRAIN_TYPES: ReadonlySet<string> = new Set([
  "plain",
  "road",
  "forest",
  "mountain",
  "fort",
  "wall",
  "water"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isDeployment(
  value: unknown,
  width: number,
  height: number
): value is MapDeployment {
  if (!isRecord(value)) return false;
  return isNonEmptyString(value.unitId) &&
    Number.isInteger(value.x) && (value.x as number) >= 0 && (value.x as number) < width &&
    Number.isInteger(value.y) && (value.y as number) >= 0 && (value.y as number) < height;
}

/**
 * Validates static map content before battle rules or save data use it.
 * Deployment IDs and tiles must be unique across both factions. Objective and
 * defeat-condition targets must point to the correct faction's deployment.
 */
export function isValidGameMapDefinition(value: unknown): value is GameMapDefinition {
  if (!isRecord(value)) return false;

  const { id, width, height, terrain, playerDeployment, enemyDeployment, objective } = value;
  if (
    !isNonEmptyString(id) ||
    !Number.isInteger(width) || (width as number) < 1 ||
    !Number.isInteger(height) || (height as number) < 1 ||
    !Array.isArray(terrain) || terrain.length !== height ||
    !terrain.every((row) =>
      Array.isArray(row) &&
      row.length === width &&
      row.every((cell) => typeof cell === "string" && TERRAIN_TYPES.has(cell))
    ) ||
    !Array.isArray(playerDeployment) ||
    !Array.isArray(enemyDeployment) ||
    !isRecord(objective)
  ) {
    return false;
  }

  const ids = new Set<string>();
  const occupied = new Set<string>();
  const playerIds = new Set<string>();
  const enemyIds = new Set<string>();

  for (const [deploymentList, factionIds] of [
    [playerDeployment, playerIds],
    [enemyDeployment, enemyIds]
  ] as const) {
    for (const candidate of deploymentList) {
      if (!isDeployment(candidate, width as number, height as number)) return false;

      const positionKey = candidate.x + "," + candidate.y;
      if (ids.has(candidate.unitId) || occupied.has(positionKey)) return false;
      ids.add(candidate.unitId);
      occupied.add(positionKey);
      factionIds.add(candidate.unitId);
    }
  }

  if (objective.type === "defeat_boss") {
    if (!isNonEmptyString(objective.targetUnitId) || !enemyIds.has(objective.targetUnitId)) {
      return false;
    }
  } else if (objective.type !== "defeat_all") {
    return false;
  }

  const defeatCondition = value.defeatCondition;
  if (defeatCondition !== undefined) {
    if (
      !isRecord(defeatCondition) ||
      defeatCondition.type !== "unit_defeated" ||
      !isNonEmptyString(defeatCondition.targetUnitId) ||
      !playerIds.has(defeatCondition.targetUnitId)
    ) {
      return false;
    }
  }

  return true;
}
