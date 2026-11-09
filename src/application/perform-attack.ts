import { WEAPONS_BY_ID } from "../content/weapons";
import { TERRAIN_DEFINITIONS } from "../content/terrain";
import {
  buildCombatForecast,
  canUnitUseWeapon,
  resolveCombat
} from "../domain/combat/combat";
import { calculateManhattanDistance } from "../domain/combat/grid-distance";
import type {
  BattlePhase,
  Faction,
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

/** Creates an attack plan for the faction whose turn is currently active. */
export function createAttackPlanForFaction(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string,
  attackerFaction: Faction
): AttackPlan {
  const requiredPhase: BattlePhase = attackerFaction === "player" ? "player" : "enemy";
  const defenderFaction: Faction = attackerFaction === "player" ? "enemy" : "player";

  if (state.phase !== requiredPhase) {
    throw new Error("Attacks can only be initiated during the matching faction phase.");
  }

  const attacker = state.units.find((unit) => unit.id === attackerId);
  const defender = state.units.find((unit) => unit.id === defenderId);

  if (!attacker || !defender) {
    throw new Error("The selected attacker or target no longer exists.");
  }
  if (attacker.faction !== attackerFaction || defender.faction !== defenderFaction) {
    throw new Error(attackerFaction === "player"
      ? "The player unit must target an enemy unit."
      : "The enemy unit must target a player unit.");
  }
  if (attacker.currentHp <= 0 || defender.currentHp <= 0) {
    throw new Error("Combat participants must be alive.");
  }
  if (attacker.hasActed) {
    throw new Error("This unit has already acted.");
  }

  const weaponId = attacker.equippedWeaponId;
  const attackerWeapon = weaponId ? WEAPONS_BY_ID[weaponId] : undefined;
  if (!attackerWeapon || !canUnitUseWeapon(attacker, attackerWeapon)) {
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

/** Player-facing helper retained for existing UI callers. */
export function createAttackPlan(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): AttackPlan {
  return createAttackPlanForFaction(state, map, attackerId, defenderId, "player");
}

/** Executes one combat exchange and returns an immutable next snapshot. */
export function performAttackForFaction(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string,
  attackerFaction: Faction
): AttackExecution {
  const plan = createAttackPlanForFaction(state, map, attackerId, defenderId, attackerFaction);
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

/** Executes a player-initiated attack. */
export function performAttack(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): AttackExecution {
  return performAttackForFaction(state, map, attackerId, defenderId, "player");
}

/** Executes one enemy AI attack during the enemy phase. */
export function performEnemyAttack(
  state: GameStateSnapshot,
  map: GameMapDefinition,
  attackerId: string,
  defenderId: string
): AttackExecution {
  return performAttackForFaction(state, map, attackerId, defenderId, "enemy");
}
