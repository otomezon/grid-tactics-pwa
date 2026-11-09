import { WEAPONS_BY_ID } from "../content/weapons";
import { TERRAIN_DEFINITIONS } from "../content/terrain";
import {
  buildCombatForecast,
  canUnitUseWeapon,
  resolveCombat
} from "../domain/combat/combat";
import { calculateManhattanDistance } from "../domain/combat/grid-distance";
import type {
  GameMapDefinition,
  GameStateSnapshot,
  GameUnit
} from "../domain/models/game";
import type { CombatForecast, CombatInput, CombatResult } from "../domain/combat/types";
import { createCombatRollSequence } from "../domain/random/xorshift32";

export interface AttackPlan {
  input: CombatInput;
  forecast: CombatForecast;
}

export interface AttackExecution {
  plan: AttackPlan;
  result: CombatResult;
  nextState: GameStateSnapshot;
}

function getUnitContext(unit: GameUnit, map: GameMapDefinition): CombatInput["attacker"] {
  const terrainType = map.terrain[unit.position.y]?.[unit.position.x];
  if (terrainType === undefined) {
    throw new RangeError("A combat unit is outside the map terrain.");
  }

  return {
    unit,
    terrain: TERRAIN_DEFINITIONS[terrainType],
    terrainType
  };
}

function getCounterWeapon(unit: GameUnit) {
  if (!unit.equippedWeaponId) return undefined;

  const weapon = WEAPONS_BY_ID[unit.equippedWeaponId];
  if (!weapon || !canUnitUseWeapon(unit, weapon)) return undefined;
  return weapon;
}

/** Validates an attack command and creates the same forecast used for resolution. */
export function createAttackPlan(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): AttackPlan {
  if (state.phase !== "player") {
    throw new Error("Attacks can only be initiated during the player phase.");
  }

  const attacker = state.units.find((unit) => unit.id === attackerId);
  const defender = state.units.find((unit) => unit.id === defenderId);

  if (!attacker || !defender) {
    throw new Error("The selected attacker or target no longer exists.");
  }
  if (attacker.faction !== "player" || defender.faction !== "enemy") {
    throw new Error("The player unit must target an enemy unit.");
  }
  if (attacker.hasActed) {
    throw new Error("This unit has already acted.");
  }

  const weaponId = attacker.equippedWeaponId;
  const attackerWeapon = weaponId ? WEAPONS_BY_ID[weaponId] : undefined;
  if (!attackerWeapon) {
    throw new Error("The selected unit has no valid equipped weapon.");
  }

  const distance = calculateManhattanDistance(attacker.position, defender.position);
  const defenderWeapon = getCounterWeapon(defender);

  const input: CombatInput = {
    attacker: getUnitContext(attacker, map),
    defender: getUnitContext(defender, map),
    attackerWeapon,
    ...(defenderWeapon ? { defenderWeapon } : {}),
    distance
  };

  return {
    input,
    forecast: buildCombatForecast(input)
  };
}

/**
 * Executes an attack as an application command:
 * validates, creates deterministic rolls, resolves combat, updates HP/action
 * flags, removes defeated units, and advances the persisted RNG state.
 */
export function performAttack(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): AttackExecution {
  const plan = createAttackPlan(state, map, attackerId, defenderId);
  const sequence = createCombatRollSequence(state.rngState, plan.forecast.strikes.length);
  const result = resolveCombat(plan.input, sequence.rolls);
  const nextRngState =
    sequence.statesAfterEachStrike[result.consumedRolls - 1] ?? state.rngState;

  const nextUnits = state.units
    .map((unit) => {
      if (unit.id === attackerId) {
        return {
          ...unit,
          currentHp: result.attackerHp,
          hasActed: true
        };
      }
      if (unit.id === defenderId) {
        return {
          ...unit,
          currentHp: result.defenderHp
        };
      }
      return unit;
    })
    .filter((unit) => unit.currentHp > 0);

  return {
    plan,
    result,
    nextState: {
      ...state,
      rngState: nextRngState,
      units: nextUnits
    }
  };
}
