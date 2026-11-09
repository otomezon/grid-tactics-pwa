import { isValidGameMapDefinition } from "./validate-game-map";
import {
  SAVE_VERSION,
  type GameMapDefinition,
  type GameStateSnapshot,
  type GameUnit,
  type UnitGrowthRates,
  type UnitStats,
  type WeaponType
} from "./game";

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp", "strength", "magic", "skill", "speed", "luck", "defense", "resistance"
];
const WEAPON_TYPES: readonly WeaponType[] = ["sword", "lance", "axe", "bow", "magic"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isUnitStats(value: unknown): value is UnitStats {
  return isRecord(value) &&
    STAT_KEYS.every((key) => isNonNegativeInteger(value[key])) &&
    (value.hp as number) > 0;
}

function isGrowthRates(value: unknown): value is UnitGrowthRates {
  return isRecord(value) && STAT_KEYS.every((key) => {
    const rate = value[key];
    return typeof rate === "number" && Number.isInteger(rate) && rate >= 0 && rate <= 100;
  });
}

function isWeaponType(value: unknown): value is WeaponType {
  return WEAPON_TYPES.includes(value as WeaponType);
}

function isGameUnit(value: unknown, map: GameMapDefinition): value is GameUnit {
  if (!isRecord(value) || !isRecord(value.position)) return false;

  const position = value.position;
  const stats = value.stats;
  const equippedWeaponId = value.equippedWeaponId;
  const inventory = value.inventory;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    (value.faction === "player" || value.faction === "enemy") &&
    isNonEmptyString(value.classId) &&
    isNonNegativeInteger(value.level) && (value.level as number) >= 1 &&
    isNonNegativeInteger(value.experience) && (value.experience as number) < 100 &&
    isUnitStats(stats) &&
    isGrowthRates(value.growthRates) &&
    isNonNegativeInteger(value.currentHp) && (value.currentHp as number) <= stats.hp &&
    (value.movementType === "infantry" || value.movementType === "cavalry") &&
    isNonNegativeInteger(value.move) &&
    Array.isArray(value.usableWeaponTypes) && value.usableWeaponTypes.every(isWeaponType) &&
    Array.isArray(inventory) && inventory.length <= 5 && inventory.every(isNonEmptyString) &&
    (equippedWeaponId === null ||
      (isNonEmptyString(equippedWeaponId) && inventory.includes(equippedWeaponId))) &&
    isNonNegativeInteger(position.x) && isNonNegativeInteger(position.y) &&
    position.x < map.width && position.y < map.height &&
    typeof value.hasMoved === "boolean" && typeof value.hasActed === "boolean"
  );
}

export function isValidGameStateSnapshot(
  value: unknown,
  map: GameMapDefinition
): value is GameStateSnapshot {
  if (!isValidGameMapDefinition(map) || !isRecord(value)) return false;

  if (
    value.saveVersion !== SAVE_VERSION ||
    value.chapterId !== map.id ||
    (value.phase !== "player" && value.phase !== "enemy") ||
    !isNonNegativeInteger(value.turn) || (value.turn as number) < 1 ||
    !isNonNegativeInteger(value.rngState) || value.rngState === 0 || value.rngState > 0xffffffff ||
    !Array.isArray(value.units) || value.units.length === 0 ||
    map.terrain.length !== map.height ||
    map.terrain.some((row) => row.length !== map.width)
  ) {
    return false;
  }

  const deployedFactionByUnitId = new Map<string, GameUnit["faction"]>();
  for (const deployment of map.playerDeployment) {
    deployedFactionByUnitId.set(deployment.unitId, "player");
  }
  for (const deployment of map.enemyDeployment) {
    deployedFactionByUnitId.set(deployment.unitId, "enemy");
  }

  const ids = new Set<string>();
  const occupied = new Set<string>();

  for (const candidate of value.units) {
    if (
      !isGameUnit(candidate, map) ||
      deployedFactionByUnitId.get(candidate.id) !== candidate.faction
    ) {
      return false;
    }

    const positionKey = candidate.position.x + "," + candidate.position.y;
    if (ids.has(candidate.id) || occupied.has(positionKey)) return false;
    ids.add(candidate.id);
    occupied.add(positionKey);
  }

  return true;
}
