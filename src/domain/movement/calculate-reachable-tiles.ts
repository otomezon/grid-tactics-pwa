import { TERRAIN_DEFINITIONS } from "../../content/terrain";
import type { MovementType, Position, TerrainType } from "../models/game";

export interface ReachabilityInput {
  terrain: readonly (readonly TerrainType[])[];
  start: Position;
  movementPoints: number;
  movementType: MovementType;
  occupiedPositions: readonly Position[];
}

export interface ReachableTile extends Position {
  cost: number;
}

const DIRECTIONS: readonly Position[] = [
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 }
];

function isInsideMap(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function positionKey(position: Position): string {
  return position.x + "," + position.y;
}

/**
 * Calculates the reachable tiles using a small Dijkstra search.
 * Dijkstra is used because terrain movement costs are not uniform.
 * Occupied and impassable tiles cannot be entered or passed through.
 */
export function calculateReachableTiles(input: ReachabilityInput): ReachableTile[] {
  const height = input.terrain.length;
  const width = input.terrain[0]?.length ?? 0;

  if (
    width === 0 ||
    height === 0 ||
    input.terrain.some((row) => row.length !== width) ||
    !Number.isInteger(input.movementPoints) ||
    input.movementPoints < 0 ||
    !Number.isInteger(input.start.x) ||
    !Number.isInteger(input.start.y) ||
    !isInsideMap(input.start.x, input.start.y, width, height)
  ) {
    return [];
  }

  const startTerrain = input.terrain[input.start.y]?.[input.start.x];
  if (
    startTerrain === undefined ||
    TERRAIN_DEFINITIONS[startTerrain].movementCost[input.movementType] === null
  ) {
    return [];
  }

  const occupied = new Set(input.occupiedPositions.map(positionKey));
  const bestCost = new Map<string, number>();
  const positions = new Map<string, Position>();
  const frontier: ReachableTile[] = [{ ...input.start, cost: 0 }];

  bestCost.set(positionKey(input.start), 0);
  positions.set(positionKey(input.start), input.start);

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
    const current = frontier.shift();
    if (!current) break;

    const currentKey = positionKey(current);
    if (current.cost !== bestCost.get(currentKey)) continue;

    for (const direction of DIRECTIONS) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      if (!isInsideMap(next.x, next.y, width, height)) continue;

      const nextKey = positionKey(next);
      if (occupied.has(nextKey)) continue;

      const terrainType = input.terrain[next.y]?.[next.x];
      if (terrainType === undefined) continue;

      const movementCost = TERRAIN_DEFINITIONS[terrainType].movementCost[input.movementType];
      if (movementCost === null) continue;

      const totalCost = current.cost + movementCost;
      if (totalCost > input.movementPoints) continue;

      const previousCost = bestCost.get(nextKey);
      if (previousCost !== undefined && previousCost <= totalCost) continue;

      bestCost.set(nextKey, totalCost);
      positions.set(nextKey, next);
      frontier.push({ ...next, cost: totalCost });
    }
  }

  return [...bestCost.entries()]
    .filter(([key]) => key !== positionKey(input.start))
    .map(([key, cost]) => {
      const position = positions.get(key);
      return position ? { ...position, cost } : null;
    })
    .filter((tile): tile is ReachableTile => tile !== null)
    .sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x);
}
