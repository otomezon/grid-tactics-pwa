import { INVENTORY_ITEMS_BY_ID } from "../../content/items";
import { isRegisteredClassId } from "../../content/class-definitions";
import { TERRAIN_DEFINITIONS } from "../../content/terrain";
import { WEAPONS_BY_ID } from "../../content/weapons";
import { isValidGameMapDefinition } from "./validate-game-map";
import {
  SAVE_VERSION,
  type CampaignUnit,
  type CampaignUnitBattleRecord,
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
  return isRecord(value) && STAT_KEYS.every((key) => isNonNegativeInteger(value[key])) &&
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

function isRegisteredInventoryItemId(value: unknown): value is string {
  return isNonEmptyString(value) &&
    (Object.hasOwn(WEAPONS_BY_ID, value) || Object.hasOwn(INVENTORY_ITEMS_BY_ID, value));
}

function hasValidCampaignUnitData(value: unknown): value is CampaignUnit {
  if (!isRecord(value)) return false;
  const stats = value.stats;
  const inventory = value.inventory;
  const usableWeaponTypes = value.usableWeaponTypes;
  const equippedWeaponId = value.equippedWeaponId;
  const equippedWeapon = typeof equippedWeaponId === "string" && Object.hasOwn(WEAPONS_BY_ID, equippedWeaponId)
    ? WEAPONS_BY_ID[equippedWeaponId]
    : undefined;
  return (
    isNonEmptyString(value.id) && isNonEmptyString(value.name) &&
    isNonEmptyString(value.classId) && isRegisteredClassId(value.classId) &&
    isNonNegativeInteger(value.level) && (value.level as number) >= 1 &&
    isNonNegativeInteger(value.experience) && (value.experience as number) < 100 &&
    isUnitStats(stats) && isGrowthRates(value.growthRates) &&
    isNonNegativeInteger(value.currentHp) && (value.currentHp as number) > 0 &&
    (value.currentHp as number) <= stats.hp &&
    (value.movementType === "infantry" || value.movementType === "cavalry") &&
    isNonNegativeInteger(value.move) &&
    Array.isArray(usableWeaponTypes) && usableWeaponTypes.every(isWeaponType) &&
    Array.isArray(inventory) && inventory.length <= 5 && inventory.every(isRegisteredInventoryItemId) &&
    (equippedWeaponId === null || (
      isNonEmptyString(equippedWeaponId) &&
      Array.isArray(inventory) && inventory.includes(equippedWeaponId) &&
      equippedWeapon !== undefined &&
      Array.isArray(usableWeaponTypes) &&
      usableWeaponTypes.includes(equippedWeapon.weaponType)
    ))
  );
}
function isNonNegativeStatGains(value: unknown): value is UnitStats {
  return isRecord(value) && STAT_KEYS.every((key) => isNonNegativeInteger(value[key]));
}

function isCampaignUnitBattleRecord(value: unknown): value is CampaignUnitBattleRecord {
  if (!isRecord(value)) return false;
  const attacks = value.attacks;
  const strikes = value.strikes;
  const hits = value.hits;
  const misses = value.misses;
  const criticalHits = value.criticalHits;
  const damageDealt = value.damageDealt;
  const enemiesDefeated = value.enemiesDefeated;
  const experienceAwarded = value.experienceAwarded;
  const levelUps = value.levelUps;
  if (
    !isNonEmptyString(value.unitId) ||
    !isNonEmptyString(value.unitName) ||
    !isNonNegativeInteger(attacks) ||
    !isNonNegativeInteger(strikes) ||
    !isNonNegativeInteger(hits) ||
    !isNonNegativeInteger(misses) ||
    !isNonNegativeInteger(criticalHits) ||
    !isNonNegativeInteger(damageDealt) ||
    !isNonNegativeInteger(enemiesDefeated) ||
    !isNonNegativeInteger(experienceAwarded) ||
    !isNonNegativeInteger(levelUps) ||
    !isNonNegativeStatGains(value.statGains)
  ) return false;

  return attacks > 0 &&
    strikes > 0 &&
    strikes === hits + misses &&
    criticalHits <= hits &&
    enemiesDefeated <= attacks;
}

function isGameUnit(value: unknown, map: GameMapDefinition): value is GameUnit {
  if (!isRecord(value)) return false;
  const fields = value;
  if (!hasValidCampaignUnitData(value) || !isRecord(fields.position)) return false;
  const position = fields.position;
  if (
    (fields.faction !== "player" && fields.faction !== "enemy") ||
    !isNonNegativeInteger(position.x) || !isNonNegativeInteger(position.y) ||
    position.x >= map.width || position.y >= map.height ||
    typeof fields.hasMoved !== "boolean" || typeof fields.hasActed !== "boolean"
  ) {
    return false;
  }

  const terrainType = map.terrain[position.y]?.[position.x];
  return terrainType !== undefined &&
    TERRAIN_DEFINITIONS[terrainType].movementCost[value.movementType] !== null;
}

export function isValidGameStateSnapshot(
  value: unknown,
  map: GameMapDefinition
): value is GameStateSnapshot {
  if (!isValidGameMapDefinition(map) || !isRecord(value)) return false;
  if (
    value.saveVersion !== SAVE_VERSION || value.chapterId !== map.id ||
    (value.phase !== "player" && value.phase !== "enemy") ||
    !isNonNegativeInteger(value.turn) || (value.turn as number) < 1 ||
    !isNonNegativeInteger(value.rngState) || value.rngState === 0 || value.rngState > 0xffffffff ||
    !Array.isArray(value.units) || value.units.length === 0 ||
    !Array.isArray(value.reserveUnits) ||
    !Array.isArray(value.campaignUnitBattleRecords) ||
    map.terrain.length !== map.height || map.terrain.some((row) => row.length !== map.width)
  ) return false;

  const deployedFactionByUnitId = new Map<string, GameUnit["faction"]>();
  const playerRosterIds = new Set<string>();
  for (const deployment of map.playerDeployment) {
    deployedFactionByUnitId.set(deployment.unitId, "player");
    playerRosterIds.add(deployment.unitId);
  }
  for (const deployment of map.enemyDeployment) deployedFactionByUnitId.set(deployment.unitId, "enemy");

  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const candidate of value.units) {
    if (!isGameUnit(candidate, map) || deployedFactionByUnitId.get(candidate.id) !== candidate.faction) {
      return false;
    }
    const positionKey = candidate.position.x + "," + candidate.position.y;
    if (ids.has(candidate.id) || occupied.has(positionKey)) return false;
    ids.add(candidate.id);
    occupied.add(positionKey);
  }

  for (const candidate of value.reserveUnits) {
    if (
      !hasValidCampaignUnitData(candidate) || candidate.currentHp <= 0 ||
      !playerRosterIds.has(candidate.id) || ids.has(candidate.id) ||
      map.defeatCondition?.targetUnitId === candidate.id
    ) return false;
    ids.add(candidate.id);
  }

  const battleRecordIds = new Set<string>();
  for (const record of value.campaignUnitBattleRecords) {
    if (!isCampaignUnitBattleRecord(record) || battleRecordIds.has(record.unitId)) return false;
    battleRecordIds.add(record.unitId);
  }
  return true;
}
