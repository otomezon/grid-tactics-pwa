import { canUnitUseWeapon, isWithinWeaponRange } from "./combat";
import { calculateManhattanDistance } from "./grid-distance";
import { calculateReachableTiles } from "../movement/calculate-reachable-tiles";
import type { GameMapDefinition, GameStateSnapshot, Position } from "../models/game";
import type { WeaponDefinition } from "./types";

export interface EnemyThreatAttackOrigin {
  position: Position;
  distance: number;
  isCurrentPosition: boolean;
}

export interface EnemyThreatSource {
  enemyId: string;
  enemyName: string;
  enemyClassId: string;
  enemyLevel: number;
  enemyPosition: Position;
  weaponId: string;
  weaponName: string;
  weaponType: WeaponDefinition["weaponType"];
  damageType: WeaponDefinition["damageType"];
  minRange: number;
  maxRange: number;
  attackOrigins: EnemyThreatAttackOrigin[];
}

interface EnemyAttackProfile {
  enemyId: string;
  enemyName: string;
  enemyClassId: string;
  enemyLevel: number;
  enemyPosition: Position;
  weapon: WeaponDefinition;
  attackOrigins: Position[];
}

function hasValidThreatMap(map: GameMapDefinition): boolean {
  return Number.isInteger(map.width) &&
    map.width >= 1 &&
    Number.isInteger(map.height) &&
    map.height >= 1 &&
    map.terrain.length === map.height &&
    map.terrain.every((row) => row.length === map.width);
}

/**
 * Builds the same legal attack origins used by the threat overlay.
 * This is a movement/range possibility projection, not an enemy-AI action forecast.
 */
function getEnemyAttackProfiles(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  weaponsById: Readonly<Record<string, WeaponDefinition>>
): EnemyAttackProfile[] {
  if (state.phase !== "player" || !hasValidThreatMap(map)) return [];

  const livingEnemies = state.units.filter((unit) =>
    unit.faction === "enemy" && unit.currentHp > 0 && !unit.hasActed
  );

  return livingEnemies.flatMap((enemy) => {
    const weapon = enemy.equippedWeaponId
      ? weaponsById[enemy.equippedWeaponId]
      : undefined;
    if (!weapon || !canUnitUseWeapon(enemy, weapon)) return [];

    const occupiedPositions = state.units
      .filter((unit) => unit.id !== enemy.id && unit.currentHp > 0)
      .map((unit) => unit.position);
    const reachablePositions = calculateReachableTiles({
      terrain: map.terrain,
      start: enemy.position,
      movementPoints: enemy.move,
      movementType: enemy.movementType,
      occupiedPositions
    });

    const uniqueOrigins = new Map<string, Position>();
    uniqueOrigins.set(`${enemy.position.x},${enemy.position.y}`, enemy.position);
    for (const position of reachablePositions) {
      uniqueOrigins.set(`${position.x},${position.y}`, position);
    }

    return [{
      enemyId: enemy.id,
      enemyName: enemy.name,
      enemyClassId: enemy.classId,
      enemyLevel: enemy.level,
      enemyPosition: enemy.position,
      weapon,
      attackOrigins: [...uniqueOrigins.values()]
    }];
  });
}

/**
 * Returns map tiles that a living, unacted enemy could attack during the
 * upcoming enemy phase, considering its current position and every reachable
 * post-move position. This is a range preview, not an enemy-AI action forecast.
 */
export function calculateEnemyThreatenedTiles(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  weaponsById: Readonly<Record<string, WeaponDefinition>>
): Position[] {
  const profiles = getEnemyAttackProfiles(state, map, weaponsById);
  if (profiles.length === 0) return [];

  const livingEnemyTiles = new Set(
    state.units
      .filter((unit) => unit.faction === "enemy" && unit.currentHp > 0)
      .map((enemy) => `${enemy.position.x},${enemy.position.y}`)
  );
  const threatenedTiles = new Map<string, Position>();

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const target = { x, y };
      const key = `${x},${y}`;
      if (livingEnemyTiles.has(key)) continue;

      const canBeAttacked = profiles.some((profile) =>
        profile.attackOrigins.some((origin) =>
          isWithinWeaponRange(calculateManhattanDistance(origin, target), profile.weapon)
        )
      );
      if (canBeAttacked) threatenedTiles.set(key, target);
    }
  }

  return [...threatenedTiles.values()].sort((left, right) =>
    left.y - right.y || left.x - right.x
  );
}

/**
 * Identifies each living, unacted enemy and the legal attack origins whose
 * equipped weapon can reach one inspected tile. Results use the same profile
 * projection as the aggregate map overlay and never select an AI move.
 */
export function calculateEnemyThreatSourcesAtPosition(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  weaponsById: Readonly<Record<string, WeaponDefinition>>,
  target: Position
): EnemyThreatSource[] {
  if (
    !Number.isInteger(target.x) ||
    !Number.isInteger(target.y) ||
    target.x < 0 ||
    target.y < 0 ||
    target.x >= map.width ||
    target.y >= map.height ||
    !hasValidThreatMap(map)
  ) {
    return [];
  }

  const livingEnemyTiles = new Set(
    state.units
      .filter((unit) => unit.faction === "enemy" && unit.currentHp > 0)
      .map((enemy) => `${enemy.position.x},${enemy.position.y}`)
  );
  if (livingEnemyTiles.has(`${target.x},${target.y}`)) return [];

  return getEnemyAttackProfiles(state, map, weaponsById)
    .map((profile): EnemyThreatSource | null => {
      const attackOrigins = profile.attackOrigins.flatMap((origin) => {
        const distance = calculateManhattanDistance(origin, target);
        if (!isWithinWeaponRange(distance, profile.weapon)) return [];
        return [{
          position: origin,
          distance,
          isCurrentPosition: origin.x === profile.enemyPosition.x && origin.y === profile.enemyPosition.y
        }];
      }).sort((left, right) =>
        Number(right.isCurrentPosition) - Number(left.isCurrentPosition) ||
        left.position.y - right.position.y ||
        left.position.x - right.position.x
      );

      if (attackOrigins.length === 0) return null;

      return {
        enemyId: profile.enemyId,
        enemyName: profile.enemyName,
        enemyClassId: profile.enemyClassId,
        enemyLevel: profile.enemyLevel,
        enemyPosition: profile.enemyPosition,
        weaponId: profile.weapon.id,
        weaponName: profile.weapon.name,
        weaponType: profile.weapon.weaponType,
        damageType: profile.weapon.damageType,
        minRange: profile.weapon.minRange,
        maxRange: profile.weapon.maxRange,
        attackOrigins
      };
    })
    .filter((source): source is EnemyThreatSource => source !== null)
    .sort((left, right) => left.enemyId < right.enemyId ? -1 : left.enemyId > right.enemyId ? 1 : 0);
}
