import { canUnitUseWeapon, isWithinWeaponRange } from "./combat";
import { calculateManhattanDistance } from "./grid-distance";
import { calculateReachableTiles } from "../movement/calculate-reachable-tiles";
import type { GameMapDefinition, GameStateSnapshot, Position } from "../models/game";
import type { WeaponDefinition } from "./types";

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
  if (
    state.phase !== "player" ||
    !Number.isInteger(map.width) ||
    map.width < 1 ||
    !Number.isInteger(map.height) ||
    map.height < 1 ||
    map.terrain.length !== map.height ||
    map.terrain.some((row) => row.length !== map.width)
  ) {
    return [];
  }

  const livingEnemies = state.units.filter((unit) =>
    unit.faction === "enemy" && unit.currentHp > 0 && !unit.hasActed
  );
  const livingEnemyTiles = new Set(
    livingEnemies.map((enemy) => `${enemy.position.x},${enemy.position.y}`)
  );
  const threatenedTiles = new Map<string, Position>();

  for (const enemy of livingEnemies) {
    const weapon = enemy.equippedWeaponId
      ? weaponsById[enemy.equippedWeaponId]
      : undefined;
    if (!weapon || !canUnitUseWeapon(enemy, weapon)) continue;

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

    // Enemies can attack before moving or after moving to any reachable tile.
    const attackOrigins: Position[] = [enemy.position, ...reachablePositions];

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const target = { x, y };
        const key = `${x},${y}`;
        if (livingEnemyTiles.has(key) || threatenedTiles.has(key)) continue;

        const canBeAttacked = attackOrigins.some((origin) =>
          isWithinWeaponRange(calculateManhattanDistance(origin, target), weapon)
        );
        if (canBeAttacked) threatenedTiles.set(key, target);
      }
    }
  }

  return [...threatenedTiles.values()].sort((left, right) =>
    left.y - right.y || left.x - right.x
  );
}
