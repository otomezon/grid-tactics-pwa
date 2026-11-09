import type { GameMapDefinition, GameStateSnapshot } from "../models/game";

export type BattleOutcome = "playing" | "victory" | "defeat";

/**
 * Evaluates the current map objective and the available player roster.
 * Defeat takes precedence when no player units remain.
 */
export function evaluateBattleOutcome(
  state: GameStateSnapshot,
  map: GameMapDefinition
): BattleOutcome {
  const livingPlayers = state.units.filter(
    (unit) => unit.faction === "player" && unit.currentHp > 0
  );
  if (livingPlayers.length === 0) return "defeat";

  const livingEnemies = state.units.filter(
    (unit) => unit.faction === "enemy" && unit.currentHp > 0
  );

  if (map.objective.type === "defeat_all" && livingEnemies.length === 0) {
    return "victory";
  }

  if (
    map.objective.type === "defeat_boss" &&
    map.objective.targetUnitId &&
    !livingEnemies.some((unit) => unit.id === map.objective.targetUnitId)
  ) {
    return "victory";
  }

  return "playing";
}
