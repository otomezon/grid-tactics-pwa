import type { CampaignUnit, GameStateSnapshot, GameUnit } from "../domain/models/game";
import { WEAPONS_BY_ID } from "../content/weapons";
import { canUnitUseWeapon } from "../domain/combat/combat";

export interface DeploymentWeaponChangeExecution {
  nextState: GameStateSnapshot;
  updatedUnit: GameUnit | CampaignUnit;
  previousWeaponId: string | null;
  equippedWeaponId: string | null;
  equippedWeaponName: string | null;
}

/**
 * Changes a living campaign member's equipped weapon while deployment is pending.
 * The change is returned as an immutable snapshot and is not persisted by this command.
 * The caller saves it only when the user explicitly confirms deployment.
 */
export function performDeploymentWeaponChange(
  state: GameStateSnapshot,
  unitId: string,
  weaponId: string | null
): DeploymentWeaponChangeExecution {
  if (state.phase !== "player" || state.turn !== 1) {
    throw new Error("Loadouts can only be changed before the first player-phase action.");
  }

  const activeMatches = state.units.filter((unit) => unit.id === unitId);
  const reserveMatches = state.reserveUnits.filter((unit) => unit.id === unitId);
  if (activeMatches.length + reserveMatches.length !== 1) {
    throw new Error("The selected campaign unit does not exist or is duplicated.");
  }

  const activeUnit = activeMatches[0];
  const reserveUnit = reserveMatches[0];
  const target: GameUnit | CampaignUnit = activeUnit ?? reserveUnit!;
  if (activeUnit && activeUnit.faction !== "player") {
    throw new Error("Only player campaign units can change deployment equipment.");
  }
  if (target.currentHp <= 0) {
    throw new Error("A defeated unit cannot change deployment equipment.");
  }
  if (activeUnit && (activeUnit.hasMoved || activeUnit.hasActed)) {
    throw new Error("A unit that has already moved or acted cannot change deployment equipment.");
  }

  let equippedWeaponName: string | null = null;
  if (weaponId !== null) {
    const weapon = WEAPONS_BY_ID[weaponId];
    if (!weapon) {
      throw new Error("The selected weapon is not registered.");
    }
    if (!canUnitUseWeapon(target, weapon)) {
      throw new Error("The unit does not own or cannot use the selected weapon.");
    }
    equippedWeaponName = weapon.name;
  }

  const updatedUnit = { ...target, equippedWeaponId: weaponId };
  const nextState: GameStateSnapshot = activeUnit
    ? {
        ...state,
        units: state.units.map((unit) => unit.id === unitId ? { ...unit, equippedWeaponId: weaponId } : unit)
      }
    : {
        ...state,
        reserveUnits: state.reserveUnits.map((unit) => unit.id === unitId ? { ...unit, equippedWeaponId: weaponId } : unit)
      };

  return {
    nextState,
    updatedUnit,
    previousWeaponId: target.equippedWeaponId,
    equippedWeaponId: weaponId,
    equippedWeaponName
  };
}
