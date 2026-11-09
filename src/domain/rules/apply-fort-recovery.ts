import type { Faction, GameMapDefinition, GameStateSnapshot } from "../models/game";

export const FORT_RECOVERY_RATE = 0.1;

export interface FortRecoveryRecord {
  unitId: string;
  unitName: string;
  recoveredHp: number;
}

export interface FortRecoveryResult {
  nextState: GameStateSnapshot;
  recoveries: FortRecoveryRecord[];
}

/**
 * Restores 10% of max HP to living units of the active faction standing on forts.
 * Fractional HP is rounded down because currentHp is an integer. This rounding
 * policy is provisional; the game design proposal does not specify it.
 */
export function applyFortRecovery(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  faction: Faction
): FortRecoveryResult {
  const recoveries: FortRecoveryRecord[] = [];
  const units = state.units.map((unit) => {
    if (unit.faction !== faction || unit.currentHp <= 0) return unit;
    if (map.terrain[unit.position.y]?.[unit.position.x] !== "fort") return unit;

    const recoveryAmount = Math.floor(unit.stats.hp * FORT_RECOVERY_RATE);
    const currentHp = Math.min(unit.stats.hp, unit.currentHp + recoveryAmount);
    const recoveredHp = currentHp - unit.currentHp;
    if (recoveredHp <= 0) return unit;

    recoveries.push({
      unitId: unit.id,
      unitName: unit.name,
      recoveredHp
    });
    return { ...unit, currentHp };
  });

  return {
    nextState: { ...state, units },
    recoveries
  };
}
