import { TERRAIN_DEFINITIONS } from "../../content/terrain";
import { isValidGameMapDefinition } from "./validate-game-map";
import { isValidCampaignUnitData } from "./validate-campaign-unit";
import {
  SAVE_VERSION,
  MAX_CAMPAIGN_BATTLE_LOG_ENTRIES,
  type CampaignBattleLogEntry,
  type CampaignBattleStrikeRecord,
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

function isBoundedString(value: unknown, maxLength: number): value is string {
  return isNonEmptyString(value) && value.length <= maxLength;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function isCampaignBattleStrikeRecord(value: unknown): value is CampaignBattleStrikeRecord {
  if (!isRecord(value)) return false;
  if (!hasOnlyKeys(value, [
    "actorId", "actorName", "targetId", "targetName", "kind",
    "weaponName", "outcome", "damage", "targetHpBefore", "targetHpAfter"
  ])) return false;
  if (
    !isBoundedString(value.actorId, 128) ||
    !isBoundedString(value.actorName, 128) ||
    !isBoundedString(value.targetId, 128) ||
    !isBoundedString(value.targetName, 128) ||
    !isBoundedString(value.weaponName, 128) ||
    (value.kind !== "initial" && value.kind !== "counter" && value.kind !== "follow-up") ||
    (value.outcome !== "miss" && value.outcome !== "hit" && value.outcome !== "critical") ||
    !isNonNegativeInteger(value.damage) ||
    !isNonNegativeInteger(value.targetHpBefore) ||
    !isNonNegativeInteger(value.targetHpAfter) ||
    value.targetHpAfter > value.targetHpBefore ||
    value.targetHpBefore - value.targetHpAfter !== value.damage
  ) return false;
  return value.outcome !== "miss" || value.damage === 0;
}

function isCampaignBattleLogEntry(value: unknown): value is CampaignBattleLogEntry {
  if (!isRecord(value)) return false;
  if (
    !isNonNegativeInteger(value.sequence) || value.sequence < 1 ||
    !isBoundedString(value.chapterId, 128) ||
    !isNonNegativeInteger(value.turn) || value.turn < 1
  ) return false;

  if (value.kind === "chapter-result") {
    if (!hasOnlyKeys(value, [
      "sequence", "chapterId", "turn", "kind", "outcome", "objective",
      "reason", "livingPlayerCount", "livingEnemyCount"
    ])) return false;
    if (
      (value.outcome !== "victory" && value.outcome !== "defeat") ||
      (value.objective !== "defeat_all" && value.objective !== "defeat_boss") ||
      !isNonNegativeInteger(value.livingPlayerCount) ||
      !isNonNegativeInteger(value.livingEnemyCount)
    ) return false;
    if (value.outcome === "victory") {
      if (value.reason !== "objective-cleared" || value.livingPlayerCount === 0) return false;
      return value.chapterId !== map.id ||
        value.objective !== "defeat_all" ||
        value.livingEnemyCount === 0;
    }
    if (value.reason === "party-wiped") return value.livingPlayerCount === 0;
    return value.reason === "protected-unit-defeated" && value.livingPlayerCount > 0;
  }

  if (value.kind === "player-action") {
    if (!hasOnlyKeys(value, ["sequence", "chapterId", "turn", "kind", "action", "actorId", "actorName", "detail"])) return false;
    return (
      ["movement", "weapon-change", "item-use", "class-change", "map-interaction", "wait"].includes(String(value.action)) &&
      isBoundedString(value.actorId, 128) &&
      isBoundedString(value.actorName, 128) &&
      isBoundedString(value.detail, 512)
    );
  }

  if (value.kind === "player-attack") {
    if (!hasOnlyKeys(value, ["sequence", "chapterId", "turn", "kind", "attackerId", "attackerName", "defenderId", "defenderName", "defenderRemainingHp", "experienceAwarded", "strikes"])) return false;
    return (
      isBoundedString(value.attackerId, 128) &&
      isBoundedString(value.attackerName, 128) &&
      isBoundedString(value.defenderId, 128) &&
      isBoundedString(value.defenderName, 128) &&
      isNonNegativeInteger(value.defenderRemainingHp) &&
      isNonNegativeInteger(value.experienceAwarded) &&
      Array.isArray(value.strikes) &&
      value.strikes.length >= 1 &&
      value.strikes.length <= 8 &&
      value.strikes.every(isCampaignBattleStrikeRecord)
    );
  }

  if (value.kind === "enemy-action") {
    if (!hasOnlyKeys(value, ["sequence", "chapterId", "turn", "kind", "enemyId", "enemyName", "actionKind", "targetId", "targetName", "destination", "strikes"])) return false;
    const hasTarget = value.targetId === undefined && value.targetName === undefined
      ? true
      : isBoundedString(value.targetId, 128) && isBoundedString(value.targetName, 128);
    const hasDestination = value.destination === undefined ||
      (isRecord(value.destination) &&
        hasOnlyKeys(value.destination, ["x", "y"]) &&
        isNonNegativeInteger(value.destination.x) &&
        isNonNegativeInteger(value.destination.y));
    return (
      isBoundedString(value.enemyId, 128) &&
      isBoundedString(value.enemyName, 128) &&
      ["attacked", "moved-and-attacked", "moved", "waited"].includes(String(value.actionKind)) &&
      hasTarget &&
      hasDestination &&
      Array.isArray(value.strikes) &&
      value.strikes.length <= 8 &&
      value.strikes.every(isCampaignBattleStrikeRecord)
    );
  }

  return false;
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
    !Array.isArray(value.campaignChoices) || value.campaignChoices.length > 256 ||
    !Array.isArray(value.campaignBattleLog) || value.campaignBattleLog.length > MAX_CAMPAIGN_BATTLE_LOG_ENTRIES ||
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

  let previousBattleLogSequence = 0;
  const chapterResultIds = new Set<string>();
  for (const entry of value.campaignBattleLog) {
    if (
      !isCampaignBattleLogEntry(entry) ||
      entry.sequence <= previousBattleLogSequence ||
      chapterResultIds.has(entry.chapterId)
    ) return false;
    previousBattleLogSequence = entry.sequence;
    if (entry.kind === "chapter-result") chapterResultIds.add(entry.chapterId);
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
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.eventId) || candidate.eventId.length > 128 ||
      !isNonEmptyString(candidate.choiceId) || candidate.choiceId.length > 64 ||
      selectedChoiceEventIds.has(candidate.eventId)
    ) return false;
    const source = choiceEvents.get(candidate.eventId);
    if (
      !source ||
      source.action.type !== "show-choice" ||
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

  const campaignChoicesByKey = new Map<string, {
    choiceId: string;
    sourceChapterId: string;
    sourceEventId: string;
  }>();
  for (const candidate of value.campaignChoices) {
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.key) || candidate.key.length > 128 ||
      !isNonEmptyString(candidate.choiceId) || candidate.choiceId.length > 64 ||
      !isNonEmptyString(candidate.sourceChapterId) || candidate.sourceChapterId.length > 128 ||
      !isNonEmptyString(candidate.sourceEventId) || candidate.sourceEventId.length > 128 ||
      campaignChoicesByKey.has(candidate.key)
    ) return false;
    const selection = {
      choiceId: candidate.choiceId,
      sourceChapterId: candidate.sourceChapterId,
      sourceEventId: candidate.sourceEventId
    };
    campaignChoicesByKey.set(candidate.key, selection);

    if (candidate.sourceChapterId === map.id) {
      const source = choiceEvents.get(candidate.sourceEventId);
      if (
        !source ||
        source.action.type !== "show-choice" ||
        source.action.campaignChoiceKey !== candidate.key ||
        !source.action.choices.some((choice) => choice.id === candidate.choiceId) ||
        !firedMapEventIds.has(candidate.sourceEventId) ||
        !acknowledgedMapEventIds.has(candidate.sourceEventId) ||
        !value.mapEventChoices.some((choice) =>
          choice.eventId === candidate.sourceEventId && choice.choiceId === candidate.choiceId
        )
      ) return false;
    }
  }

  for (const candidate of value.mapEventChoices) {
    const source = choiceEvents.get(candidate.eventId);
    if (source?.action.type !== "show-choice" || source.action.campaignChoiceKey === undefined) continue;
    const campaignSelection = campaignChoicesByKey.get(source.action.campaignChoiceKey);
    if (
      !campaignSelection ||
      campaignSelection.choiceId !== candidate.choiceId ||
      campaignSelection.sourceChapterId !== map.id ||
      campaignSelection.sourceEventId !== candidate.eventId
    ) return false;
  }

  return true;
}
