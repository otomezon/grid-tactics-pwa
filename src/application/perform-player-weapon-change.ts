import { WEAPONS_BY_ID } from "../content/weapons";
import { canUnitUseWeapon } from "../domain/combat/combat";
import type { GameStateSnapshot, GameUnit } from "../domain/models/game";

export interface PlayerWeaponChangeExecution {
  nextState: GameStateSnapshot;
  updatedUnit: GameUnit;
  previousWeaponId: string | null;
  equippedWeaponId: string;
  equippedWeaponName: string;
}

/**
 * Changes a living player's equipped weapon before the unit has acted.
 * Switching after movement remains allowed, matching the existing player-phase
 * command order. Inventory and all unrelated unit/state data are preserved.
 */
export function performPlayerWeaponChange(
  state: GameStateSnapshot,
  unitId: string,
  weaponId: string
): PlayerWeaponChangeExecution {
  if (state.phase !== "player") {
    throw new Error("自軍フェイズ中のみ武器を変更できます。");
  }

  const unit = state.units.find((candidate) => candidate.id === unitId);
  if (!unit || unit.faction !== "player") {
    throw new Error("選択した味方ユニットが見つかりません。");
  }
  if (unit.currentHp <= 0) {
    throw new Error("撃破されたユニットは武器を変更できません。");
  }
  if (unit.hasActed) {
    throw new Error("行動済みのユニットは武器を変更できません。");
  }

  const weapon = WEAPONS_BY_ID[weaponId];
  if (!weapon || !canUnitUseWeapon(unit, weapon)) {
    throw new Error("このユニットはその武器を装備できません。");
  }

  const updatedUnit: GameUnit = { ...unit, equippedWeaponId: weaponId };
  const nextState: GameStateSnapshot = {
    ...state,
    units: state.units.map((candidate) => candidate.id === unitId ? updatedUnit : candidate)
  };

  return {
    nextState,
    updatedUnit,
    previousWeaponId: unit.equippedWeaponId,
    equippedWeaponId: weaponId,
    equippedWeaponName: weapon.name
  };
}
