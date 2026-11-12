import type { GameStateSnapshot, GameUnit } from "../domain/models/game";

export interface PlayerWaitExecution {
  nextState: GameStateSnapshot;
  waitedUnit: GameUnit;
}

/** Ends one living player unit's action for the current player phase. */
export function performPlayerWait(
  state: GameStateSnapshot,
  unitId: string
): PlayerWaitExecution {
  if (state.phase !== "player") {
    throw new Error("自軍フェイズ中のみ待機できます。");
  }

  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.faction !== "player") {
    throw new Error("選択した味方ユニットが見つかりません。");
  }
  if (unit.currentHp <= 0) {
    throw new Error("撃破されたユニットは待機できません。");
  }
  if (unit.hasActed) {
    throw new Error("このユニットはすでに行動済みです。");
  }

  const waitedUnit: GameUnit = { ...unit, hasActed: true };
  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.map((candidate) => candidate.id === unitId ? waitedUnit : candidate)
  };
  return { nextState, waitedUnit };
}
