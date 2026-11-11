import { canUnitUseWeapon, isWithinWeaponRange } from "./combat";
import { calculateManhattanDistance } from "./grid-distance";
import type { GameUnit, Position } from "../models/game";
import type { WeaponDefinition } from "./types";

/**
 * Returns living enemy positions that the selected player unit can attack
 * from the supplied origin with its currently equipped, usable weapon.
 *
 * The caller is responsible for proving that an alternate origin is a legal
 * movement destination. Distance intentionally follows the current provisional
 * Manhattan convention shared with attack-plan creation.
 */
export function calculateAttackableEnemyPositions(
  attacker: GameUnit | null,
  potentialTargets: readonly GameUnit[],
  weapon: WeaponDefinition | null,
  attackOrigin?: Position
): Position[] {
  if (
    !attacker ||
    attacker.faction !== "player" ||
    attacker.currentHp <= 0 ||
    attacker.hasActed ||
    !weapon ||
    !canUnitUseWeapon(attacker, weapon)
  ) {
    return [];
  }

  const origin = attackOrigin ?? attacker.position;
  return potentialTargets
    .filter((target) => target.faction === "enemy" && target.currentHp > 0)
    .filter((target) =>
      isWithinWeaponRange(calculateManhattanDistance(origin, target.position), weapon)
    )
    .map((target) => ({ ...target.position }));
}
