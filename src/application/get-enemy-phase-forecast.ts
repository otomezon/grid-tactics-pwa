import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import type { FortRecoveryRecord } from "../domain/rules/apply-fort-recovery";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";
import type { EnemyActionLog } from "./resolve-enemy-phase";

export interface EnemyPlayerUnitForecast {
  unitId: string;
  unitName: string;
  currentHp: number;
  hpAfterEnemyActions: number;
  hpAfterResolution: number;
  maxHp: number;
  incomingDamage: number;
  fortRecovery: number;
  defeated: boolean;
}

export interface EnemyPhaseForecast {
  actions: EnemyActionLog[];
  outcome: "playing" | "victory" | "defeat";
  phaseStartRecoveries: FortRecoveryRecord[];
  playerUnitOutcomes: EnemyPlayerUnitForecast[];
}

function projectPlayerUnitOutcomes(
  state: GameStateSnapshot,
  resolvedState: GameStateSnapshot,
  fortRecoveries: FortRecoveryRecord[]
): EnemyPlayerUnitForecast[] {
  const resolvedById = new Map(resolvedState.units.map((unit) => [unit.id, unit]));
  const recoveryById = new Map(fortRecoveries.map((recovery) => [recovery.unitId, recovery.recoveredHp]));

  return state.units.filter((unit) => unit.faction === "player").map((unit) => {
    const resolvedUnit = resolvedById.get(unit.id);
    const defeated = !resolvedUnit || resolvedUnit.currentHp <= 0;
    const hpAfterResolution = defeated ? 0 : resolvedUnit.currentHp;
    const fortRecovery = defeated ? 0 : recoveryById.get(unit.id) ?? 0;
    const hpAfterEnemyActions = defeated ? 0 : Math.max(0, hpAfterResolution - fortRecovery);

    return {
      unitId: unit.id,
      unitName: unit.name,
      currentHp: unit.currentHp,
      hpAfterEnemyActions,
      hpAfterResolution,
      maxHp: unit.stats.hp,
      incomingDamage: Math.max(0, unit.currentHp - hpAfterEnemyActions),
      fortRecovery,
      defeated
    };
  });
}

/** Uses the same deterministic commands as the real phase transition. */
export function getEnemyPhaseForecast(
  state: GameStateSnapshot,
  map: GameMapDefinition
): EnemyPhaseForecast | null {
  if (state.phase !== "player" || evaluateBattleOutcome(state, map) !== "playing") return null;
  const phaseStart = beginEnemyPhase(state, map);
  const execution = runEnemyPhase(phaseStart.nextState, map);
  return {
    actions: execution.actions,
    outcome: execution.outcome,
    phaseStartRecoveries: phaseStart.fortRecoveries,
    playerUnitOutcomes: projectPlayerUnitOutcomes(state, execution.nextState, execution.phaseStartRecoveries)
  };
}
