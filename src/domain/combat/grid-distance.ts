import type { Position } from "../models/game";

/**
 * Provisional orthogonal-grid distance used by the current prototype.
 * The design defines movement as four-directional but does not explicitly
 * name an attack distance metric; Manhattan distance is used temporarily.
 */
export function calculateManhattanDistance(from: Position, to: Position): number {
  if (
    !Number.isInteger(from.x) ||
    !Number.isInteger(from.y) ||
    !Number.isInteger(to.x) ||
    !Number.isInteger(to.y)
  ) {
    throw new RangeError("Grid positions must contain integer coordinates.");
  }

  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}
