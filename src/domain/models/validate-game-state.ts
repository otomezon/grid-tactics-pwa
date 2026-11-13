import { TERRAIN_DEFINITIONS } from "../../content/terrain";
import { isValidGameMapDefinition } from "./validate-game-map";
import { isValidCampaignUnitData } from "./validate-campaign-unit";
import {
  SAVE_VERSION,
  type CampaignUnitBattleRecord,
  type GameMapDefinition,
  type GameStateSnapshot,
  type GameUnit,
  type UnitStats
} from "./game";

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp", "strength", "magic", "skill", "speed", "luck", "defense", "resistance"
];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  if (!isValidCampaignUnitData(value) || !isRecord(fields.position)) return false;
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
    !Array.isArray(value.firedMapEventIds) || value.firedMapEventIds.length > 1000 ||
    !Array.isArray(value.acknowledgedMapEventIds) || value.acknowledgedMapEventIds.length > 1000 ||
    !Array.isArray(value.mapEventChoices) || value.mapEventChoices.length > 256 ||
    map.terrain.length !== map.height || map.terrain.some((row) => row.length !== map.width)
  ) return false;

  const deployedFactionByUnitId = new Map<string, GameUnit["faction"]>();
  const playerRosterIds = new Set<string>();
  for (const deployment of map.playerDeployment) {
    deployedFactionByUnitId.set(deployment.unitId, "player");
    playerRosterIds.add(deployment.unitId);
  }
  for (const deployment of map.enemyDeployment) deployedFactionByUnitId.set(deployment.unitId, "enemy");
  const reinforcementEventByUnitId = new Map<string, string>();
  const recruitmentEventByUnitId = new Map<string, string>();
  for (const event of map.events ?? []) {
    if (event.action.type === "spawn-reinforcement") {
      deployedFactionByUnitId.set(event.action.unit.id, "enemy");
      reinforcementEventByUnitId.set(event.action.unit.id, event.id);
    } else if (event.action.type === "recruit-unit") {
      recruitmentEventByUnitId.set(event.action.unit.id, event.id);
    }
  }
  const firedEventIdsForUnitValidation = new Set(value.firedMapEventIds as string[]);

  const ids = new Set<string>();
  const occupied = new Set<string>();
  for (const candidate of value.units) {
    if (!isGameUnit(candidate, map) || deployedFactionByUnitId.get(candidate.id) !== candidate.faction) {
      return false;
    }
    const reinforcementEventId = reinforcementEventByUnitId.get(candidate.id);
    if (reinforcementEventId && !firedEventIdsForUnitValidation.has(reinforcementEventId)) return false;
    const positionKey = candidate.position.x + "," + candidate.position.y;
    if (ids.has(candidate.id) || occupied.has(positionKey)) return false;
    ids.add(candidate.id);
    occupied.add(positionKey);
  }

  for (const candidate of value.reserveUnits) {
    if (
      !isValidCampaignUnitData(candidate) || candidate.currentHp <= 0 ||
      (!playerRosterIds.has(candidate.id) &&
        !(recruitmentEventByUnitId.has(candidate.id) &&
          firedEventIdsForUnitValidation.has(recruitmentEventByUnitId.get(candidate.id)!))) ||
      ids.has(candidate.id) ||
      map.defeatCondition?.targetUnitId === candidate.id
    ) return false;
    ids.add(candidate.id);
  }

  const battleRecordIds = new Set<string>();
  for (const record of value.campaignUnitBattleRecords) {
    if (!isCampaignUnitBattleRecord(record) || battleRecordIds.has(record.unitId)) return false;
    battleRecordIds.add(record.unitId);
  }

  const firedMapEventIds = new Set<string>();
  for (const eventId of value.firedMapEventIds) {
    if (
      !isNonEmptyString(eventId) ||
      eventId.length > 128 ||
      firedMapEventIds.has(eventId)
    ) return false;
    firedMapEventIds.add(eventId);
  }

  const acknowledgedMapEventIds = new Set<string>();
  for (const eventId of value.acknowledgedMapEventIds) {
    if (
      !isNonEmptyString(eventId) ||
      eventId.length > 128 ||
      !firedMapEventIds.has(eventId) ||
      acknowledgedMapEventIds.has(eventId)
    ) return false;
    acknowledgedMapEventIds.add(eventId);
  }
  const choiceEvents = new Map((map.events ?? [])
    .filter((event) => event.action.type === "show-choice")
    .map((event) => [event.id, event] as const));
  const selectedChoiceEventIds = new Set<string>();
  for (const candidate of value.mapEventChoices) {
    if (!isRecord(candidate) || !isNonEmptyString(candidate.eventId) ||
        candidate.eventId.length > 128 || !isNonEmptyString(candidate.choiceId) ||
        candidate.choiceId.length > 64 || selectedChoiceEventIds.has(candidate.eventId)) return false;
    const source = choiceEvents.get(candidate.eventId);
    if (
      !source ||
      !firedMapEventIds.has(candidate.eventId) ||
      !acknowledgedMapEventIds.has(candidate.eventId) ||
      !source.action.choices.some((choice) => choice.id === candidate.choiceId)
    ) return false;
    selectedChoiceEventIds.add(candidate.eventId);
  }
  for (const [eventId] of choiceEvents) {
    if (
      firedMapEventIds.has(eventId) &&
      acknowledgedMapEventIds.has(eventId) !== selectedChoiceEventIds.has(eventId)
    ) return false;
  }
  return true;
}
