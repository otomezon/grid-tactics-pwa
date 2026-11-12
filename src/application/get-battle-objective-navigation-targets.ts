import type { GameMapDefinition, GameStateSnapshot, GameUnit } from "../domain/models/game";

export interface BattleObjectiveNavigationTargets {
  /** Living boss unit, when the victory condition names one. */
  victoryTarget: GameUnit | null;
  /** Living protected ally, when the defeat condition names one. */
  defeatTarget: GameUnit | null;
  /** Living enemies shown by a defeat-all objective. */
  remainingEnemyCount: number;
}

/** Resolves only currently living units named by the configured objective rules. */
export function getBattleObjectiveNavigationTargets(
  state: GameStateSnapshot,
  map: GameMapDefinition
): BattleObjectiveNavigationTargets {
  const livingUnit = (unitId: string | undefined, faction: GameUnit["faction"]): GameUnit | null => {
    if (!unitId) return null;
    const unit = state.units.find((candidate) =>
      candidate.id === unitId && candidate.faction === faction && candidate.currentHp > 0
    );
    return unit ?? null;
  };

  const victoryTarget = map.objective.type === "defeat_boss"
    ? livingUnit(map.objective.targetUnitId, "enemy")
    : null;
  const defeatTarget = map.defeatCondition?.type === "unit_defeated"
    ? livingUnit(map.defeatCondition.targetUnitId, "player")
    : null;
  const remainingEnemyCount = map.objective.type === "defeat_all"
    ? state.units.filter((unit) => unit.faction === "enemy" && unit.currentHp > 0).length
    : 0;

  return { victoryTarget, defeatTarget, remainingEnemyCount };
}
