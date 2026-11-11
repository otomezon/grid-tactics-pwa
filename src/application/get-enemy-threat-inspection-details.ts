import { getClassDisplayName } from "../content/classes";
import { WEAPONS_BY_ID } from "../content/weapons";
import {
  calculateEnemyThreatSourcesAtPosition,
  type EnemyThreatSource
} from "../domain/combat/calculate-enemy-threatened-tiles";
import type { GameMapDefinition, GameStateSnapshot, Position } from "../domain/models/game";

const WEAPON_TYPE_LABELS = {
  sword: "剣",
  lance: "槍",
  axe: "斧",
  bow: "弓",
  magic: "魔法"
} as const;

function formatPosition(position: Position): string {
  return String(position.x + 1) + "列・" + String(position.y + 1) + "行";
}

function mapSource(source: EnemyThreatSource) {
  return {
    enemyId: source.enemyId,
    enemyName: source.enemyName,
    enemyClassName: getClassDisplayName(source.enemyClassId),
    enemyLevel: source.enemyLevel,
    enemyPositionLabel: formatPosition(source.enemyPosition),
    weaponId: source.weaponId,
    weaponName: source.weaponName,
    weaponTypeLabel: WEAPON_TYPE_LABELS[source.weaponType],
    damageTypeLabel: source.damageType === "physical" ? "物理" : "魔法",
    minRange: source.minRange,
    maxRange: source.maxRange,
    attackOrigins: source.attackOrigins.map((origin) => ({
      label: formatPosition(origin.position),
      distance: origin.distance,
      isCurrentPosition: origin.isCurrentPosition
    }))
  };
}

/**
 * Resolves the read-only threat sources for one inspected map tile.
 * Values come from the same movement/range calculation as the map overlay.
 */
export function getEnemyThreatInspectionDetails(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  position: Position | null
) {
  if (
    !position ||
    state.phase !== "player" ||
    !Number.isInteger(position.x) ||
    !Number.isInteger(position.y) ||
    position.x < 0 ||
    position.y < 0 ||
    position.x >= map.width ||
    position.y >= map.height
  ) {
    return null;
  }

  const sources = calculateEnemyThreatSourcesAtPosition(
    state,
    map,
    WEAPONS_BY_ID,
    position
  ).map(mapSource);

  return {
    targetCoordinate: formatPosition(position),
    sourceCount: sources.length,
    attackOriginCount: sources.reduce((total, source) => total + source.attackOrigins.length, 0),
    sources
  };
}

export type EnemyThreatInspectionDetails = NonNullable<
  ReturnType<typeof getEnemyThreatInspectionDetails>
>;
