import { evaluateBattleOutcome } from "../domain/rules/evaluate-battle-outcome";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import type { FortRecoveryRecord } from "../domain/rules/apply-fort-recovery";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";
import type { EnemyActionLog } from "./resolve-enemy-phase";

export interface EnemyPhaseForecast {
  actions: EnemyActionLog[];
  outcome: "playing" | "victory" | "defeat";
  phaseStartRecoveries: FortRecoveryRecord[];
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
    phaseStartRecoveries: phaseStart.fortRecoveries
  };
}
