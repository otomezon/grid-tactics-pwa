import { getClassDisplayName, getClassTierLabel } from "../content/classes";
import { WEAPONS_BY_ID } from "../content/weapons";
import type { GameUnit, UnitStats } from "../domain/models/game";

type NonHpStatKey = Exclude<keyof UnitStats, "hp">;

const STAT_LABELS: Readonly<Record<NonHpStatKey, string>> = {
  strength: "力",
  magic: "魔力",
  skill: "技",
  speed: "速さ",
  luck: "幸運",
  defense: "守備",
  resistance: "魔防"
};

const WEAPON_TYPE_LABELS = {
  sword: "剣",
  lance: "槍",
  axe: "斧",
  bow: "弓",
  magic: "魔法"
} as const;

/**
 * Builds a read-only inspection view from the living enemy's current snapshot.
 * All weapon and class values are content data; no battle rule is evaluated here.
 */
export function getEnemyInspectionDetails(unit: GameUnit) {
  if (unit.faction !== "enemy" || unit.currentHp <= 0) return null;

  const weapons = unit.inventory.flatMap((itemId, inventoryIndex) => {
    const weapon = WEAPONS_BY_ID[itemId];
    if (!weapon) return [];

    const baseAttack = weapon.damageType === "physical"
      ? unit.stats.strength
      : unit.stats.magic;

    return [{
      id: weapon.id,
      name: weapon.name,
      inventoryIndex,
      isEquipped: unit.equippedWeaponId === weapon.id,
      weaponTypeLabel: WEAPON_TYPE_LABELS[weapon.weaponType],
      damageTypeLabel: weapon.damageType === "physical" ? "物理" : "魔法",
      power: weapon.power,
      attackPower: baseAttack + weapon.power,
      hit: weapon.hit,
      critical: weapon.critical,
      minRange: weapon.minRange,
      maxRange: weapon.maxRange
    }];
  });

  return {
    id: unit.id,
    name: unit.name,
    className: getClassDisplayName(unit.classId),
    classTierLabel: getClassTierLabel(unit.classId),
    level: unit.level,
    currentHp: unit.currentHp,
    maxHp: unit.stats.hp,
    positionLabel: String(unit.position.x + 1) + "列・" + String(unit.position.y + 1) + "行",
    move: unit.move,
    movementTypeLabel: unit.movementType === "infantry" ? "歩兵" : "騎馬",
    stats: (Object.keys(STAT_LABELS) as NonHpStatKey[]).map((key) => ({
      key,
      label: STAT_LABELS[key],
      value: unit.stats[key]
    })),
    weapons
  };
}

export type EnemyInspectionDetails = NonNullable<ReturnType<typeof getEnemyInspectionDetails>>;
