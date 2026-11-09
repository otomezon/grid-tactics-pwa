import type { GameMapDefinition, GameStateSnapshot, GameUnit, Position } from "../domain/models/game";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";

export type ChapterCarryOverHpPolicy = "preserve" | "restore";

export interface PrepareNextChapterInput {
  previousState: GameStateSnapshot;
  previousMap: GameMapDefinition;
  nextChapterInitialState: GameStateSnapshot;
  nextMap: GameMapDefinition;
  /** The design does not specify whether units recover between chapters. */
  currentHpPolicy: ChapterCarryOverHpPolicy;
}

function placeUnit(
  unit: GameUnit,
  position: Position,
  currentHpPolicy: ChapterCarryOverHpPolicy,
  isCarriedOver: boolean
): GameUnit {
  const stats = { ...unit.stats };
  return {
    ...unit,
    stats,
    growthRates: { ...unit.growthRates },
    currentHp: isCarriedOver && currentHpPolicy === "restore" ? stats.hp : unit.currentHp,
    usableWeaponTypes: [...unit.usableWeaponTypes],
    inventory: [...unit.inventory],
    position: { x: position.x, y: position.y },
    hasMoved: false,
    hasActed: false
  };
}

/**
 * Creates a new chapter snapshot after a confirmed victory.
 *
 * The next map's deployment lists are authoritative for who appears and where.
 * Existing player units retain their progression and inventory by ID; a player
 * unit missing from the cleared chapter's state is treated as defeated and is
 * not recreated from the next chapter template. New player units must be present
 * in the next chapter template. Enemy units always come from that template.
 */
export function prepareNextChapter({
  previousState,
  previousMap,
  nextChapterInitialState,
  nextMap,
  currentHpPolicy
}: PrepareNextChapterInput): GameStateSnapshot {
  if (currentHpPolicy !== "preserve" && currentHpPolicy !== "restore") {
    throw new Error("A valid current HP carry-over policy must be selected.");
  }
  if (!isValidGameStateSnapshot(previousState, previousMap)) {
    throw new Error("The previous chapter state is invalid.");
  }
  if (evaluateBattleOutcome(previousState, previousMap) !== "victory") {
    throw new Error("The next chapter can only begin after a chapter victory.");
  }
  if (nextMap.id === previousMap.id) {
    throw new Error("The next chapter must use a different map.");
  }
  if (
    !isValidGameStateSnapshot(nextChapterInitialState, nextMap) ||
    nextChapterInitialState.phase !== "player" ||
    nextChapterInitialState.turn !== 1
  ) {
    throw new Error("The next chapter template must be a valid player-phase turn 1 state.");
  }

  const previousPartyIds = new Set(previousMap.playerDeployment.map(({ unitId }) => unitId));
  const previousPlayers = new Map(
    previousState.units
      .filter((unit) => unit.faction === "player")
      .map((unit) => [unit.id, unit] as const)
  );
  const nextTemplateUnits = new Map(
    nextChapterInitialState.units.map((unit) => [unit.id, unit] as const)
  );

  const playerUnits = nextMap.playerDeployment.flatMap((deployment) => {
    const wasInPreviousParty = previousPartyIds.has(deployment.unitId);
    const previousUnit = previousPlayers.get(deployment.unitId);

    if (wasInPreviousParty && !previousUnit) {
      // A unit missing from the cleared state was defeated; do not respawn it.
      return [];
    }

    const templateUnit = nextTemplateUnits.get(deployment.unitId);
    const sourceUnit = wasInPreviousParty ? previousUnit : templateUnit;
    if (!sourceUnit || sourceUnit.faction !== "player") {
      throw new Error(`Player deployment "${deployment.unitId}" has no matching player unit.`);
    }

    return [
      placeUnit(
        sourceUnit,
        { x: deployment.x, y: deployment.y },
        currentHpPolicy,
        wasInPreviousParty
      )
    ];
  });

  const enemyUnits = nextMap.enemyDeployment.map((deployment) => {
    const templateUnit = nextTemplateUnits.get(deployment.unitId);
    if (!templateUnit || templateUnit.faction !== "enemy") {
      throw new Error(`Enemy deployment "${deployment.unitId}" has no matching enemy unit.`);
    }
    return placeUnit(
      templateUnit,
      { x: deployment.x, y: deployment.y },
      currentHpPolicy,
      false
    );
  });

  const nextState: GameStateSnapshot = {
    ...nextChapterInitialState,
    units: [...playerUnits, ...enemyUnits]
  };

  if (!isValidGameStateSnapshot(nextState, nextMap)) {
    throw new Error("The prepared next chapter state is invalid.");
  }

  return nextState;
}
