import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";

export interface BattleResultEnemyEntry {
  id: string;
  name: string;
  classId: string;
  status: "alive" | "defeated";
  currentHp: number | null;
  maxHp: number | null;
}

export interface BattleResultPlayerEntry {
  id: string;
  name: string;
  classId: string;
  level: number;
  experience: number;
  currentHp: number;
  maxHp: number;
}

export interface BattleResultDetails {
  enemies: BattleResultEnemyEntry[];
  survivingPlayers: BattleResultPlayerEntry[];
}

/**
 * Builds result-screen details from the current battle snapshot.
 *
 * Enemy deployment is fixed by the chapter map, so a missing enemy can be
 * identified as defeated by comparing it with the chapter's reference state.
 * Defeated enemies' final HP and fallen players' last state are not retained
 * by the current save model and are intentionally not reconstructed.
 */
export function getBattleResultDetails(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  chapterInitialState: GameStateSnapshot
): BattleResultDetails {
  const currentUnitsById = new Map(state.units.map((unit) => [unit.id, unit]));
  const referenceUnitsById = new Map(
    chapterInitialState.units.map((unit) => [unit.id, unit])
  );

  const enemies = map.enemyDeployment
    .map(({ unitId }) => {
      const currentUnit = currentUnitsById.get(unitId);
      const referenceUnit = referenceUnitsById.get(unitId);
      const sourceUnit = currentUnit ?? referenceUnit;
      const alive = currentUnit !== undefined && currentUnit.currentHp > 0;

      return {
        id: unitId,
        name: sourceUnit?.name ?? unitId,
        classId: sourceUnit?.classId ?? "unknown",
        status: alive ? "alive" as const : "defeated" as const,
        currentHp: alive ? currentUnit.currentHp : null,
        maxHp: alive ? currentUnit.stats.hp : null
      };
    })
    .sort((left, right) => compareIds(left.id, right.id));

  const survivingPlayers = state.units
    .filter((unit) => unit.faction === "player" && unit.currentHp > 0)
    .map((unit) => ({
      id: unit.id,
      name: unit.name,
      classId: unit.classId,
      level: unit.level,
      experience: unit.experience,
      currentHp: unit.currentHp,
      maxHp: unit.stats.hp
    }))
    .sort((left, right) => compareIds(left.id, right.id));

  return { enemies, survivingPlayers };
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
