import type {
  CampaignUnit,
  GameMapDefinition,
  GameStateSnapshot,
  GameUnit,
  Position
} from "../domain/models/game";
import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";

export type ChapterCarryOverHpPolicy = "preserve" | "restore";
export interface PrepareNextChapterInput {
  previousState: GameStateSnapshot;
  previousMap: GameMapDefinition;
  nextChapterInitialState: GameStateSnapshot;
  nextMap: GameMapDefinition;
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
function placeReserve(unit: CampaignUnit, policy: ChapterCarryOverHpPolicy): CampaignUnit {
  return {
    ...unit,
    stats: { ...unit.stats },
    growthRates: { ...unit.growthRates },
    currentHp: policy === "restore" ? unit.stats.hp : unit.currentHp,
    usableWeaponTypes: [...unit.usableWeaponTypes],
    inventory: [...unit.inventory]
  };
}

/** Carries living active and reserve campaign members into the next map's candidate roster. */
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
  if (nextMap.id === previousMap.id) throw new Error("The next chapter must use a different map.");
  if (
    !isValidGameStateSnapshot(nextChapterInitialState, nextMap) ||
    nextChapterInitialState.phase !== "player" ||
    nextChapterInitialState.turn !== 1
  ) {
    throw new Error("The next chapter template must be a valid player-phase turn 1 state.");
  }

  const previousPartyIds = new Set(previousMap.playerDeployment.map(({ unitId }) => unitId));
  const previousPlayers = new Map(
    previousState.units.filter((unit) => unit.faction === "player").map((unit) => [unit.id, unit] as const)
  );
  const previousReserves = new Map(previousState.reserveUnits.map((unit) => [unit.id, unit] as const));
  const nextTemplateUnits = new Map(nextChapterInitialState.units.map((unit) => [unit.id, unit] as const));
  const nextTemplateReserves = new Map(nextChapterInitialState.reserveUnits.map((unit) => [unit.id, unit] as const));
  const playerUnits: GameUnit[] = [];
  const reserveUnits: CampaignUnit[] = [];

  for (const deployment of nextMap.playerDeployment) {
    const wasInPreviousRoster = previousPartyIds.has(deployment.unitId);
    const previousUnit = previousPlayers.get(deployment.unitId);
    const previousReserve = previousReserves.get(deployment.unitId);
    if (wasInPreviousRoster && !previousUnit && !previousReserve) continue;

    if (previousReserve) {
      reserveUnits.push(placeReserve(previousReserve, currentHpPolicy));
      continue;
    }
    const templateUnit = nextTemplateUnits.get(deployment.unitId);
    const templateReserve = nextTemplateReserves.get(deployment.unitId);
    const sourceUnit = wasInPreviousRoster ? previousUnit : templateUnit;
    if (sourceUnit) {
      if (sourceUnit.faction !== "player") {
        throw new Error(`Player deployment "${deployment.unitId}" has no matching player unit.`);
      }
      playerUnits.push(placeUnit(
        sourceUnit,
        { x: deployment.x, y: deployment.y },
        currentHpPolicy,
        wasInPreviousRoster
      ));
      continue;
    }
    if (!wasInPreviousRoster && templateReserve) {
      reserveUnits.push(placeReserve(templateReserve, "preserve"));
      continue;
    }
    throw new Error(`Player deployment "${deployment.unitId}" has no matching player unit.`);
  }

  const enemyUnits = nextMap.enemyDeployment.map((deployment) => {
    const templateUnit = nextTemplateUnits.get(deployment.unitId);
    if (!templateUnit || templateUnit.faction !== "enemy") {
      throw new Error(`Enemy deployment "${deployment.unitId}" has no matching enemy unit.`);
    }
    return placeUnit(templateUnit, { x: deployment.x, y: deployment.y }, currentHpPolicy, false);
  });
  const nextState: GameStateSnapshot = {
    ...nextChapterInitialState,
    units: [...playerUnits, ...enemyUnits],
    reserveUnits
  };
  if (!isValidGameStateSnapshot(nextState, nextMap)) {
    throw new Error("The prepared next chapter state is invalid.");
  }
  return nextState;
}
