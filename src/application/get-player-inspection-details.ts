import {
  getClassDefinition,
  getClassDisplayName,
  getClassTierLabel
} from "../content/classes";
import { WEAPONS_BY_ID } from "../content/weapons";
import { getInventoryItemStacks } from "./get-inventory-item-stacks";
import type { CampaignUnitBattleRecord, GameUnit, UnitStats } from "../domain/models/game";

type NonHpStatKey = Exclude<keyof UnitStats, "hp">;
const STAT_LABELS: Readonly<Record<NonHpStatKey, string>> = {
  strength: "力", magic: "魔力", skill: "技", speed: "速さ",
  luck: "幸運", defense: "守備", resistance: "魔防"
};
const WEAPON_TYPE_LABELS = {
  sword: "剣", lance: "槍", axe: "斧", bow: "弓", magic: "魔法"
} as const;

/** Projects a living player's current combat data for display without changing it. */
export function getPlayerInspectionDetails(unit: GameUnit, battleRecord?: CampaignUnitBattleRecord | null) {
  if (unit.faction !== "player" || unit.currentHp <= 0) return null;
  const classDefinition = getClassDefinition(unit.classId);
  const promotionTarget = classDefinition?.tier === "basic"
    ? getClassDisplayName(classDefinition.promotion.targetClassId)
    : null;
  const weapons = unit.inventory.flatMap((itemId, inventoryIndex) => {
    const weapon = WEAPONS_BY_ID[itemId];
    if (!weapon) return [];
    const baseAttack = weapon.damageType === "physical" ? unit.stats.strength : unit.stats.magic;
    return [{
      id: weapon.id,
      name: weapon.name,
      inventoryIndex,
      isEquipped: unit.equippedWeaponId === weapon.id,
      isUsable: unit.usableWeaponTypes.includes(weapon.weaponType),
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
  const items = getInventoryItemStacks(unit.inventory.filter((itemId) => !WEAPONS_BY_ID[itemId]))
    .map((item) => ({
      id: item.id,
      name: item.definition?.name ?? item.id,
      quantity: item.quantity,
      description: item.definition?.description ?? null
    }));
  return {
    id: unit.id,
    name: unit.name,
    className: getClassDisplayName(unit.classId),
    classTierLabel: getClassTierLabel(unit.classId),
    promotionTargetClassName: promotionTarget,
    promotionRequirementLabel: promotionTarget
      ? "基本職Lv.10以上・クラスチェンジの証1個"
      : null,
    level: unit.level,
    experience: unit.experience,
    currentHp: unit.currentHp,
    maxHp: unit.stats.hp,
    positionLabel: String(unit.position.x + 1) + "列・" + String(unit.position.y + 1) + "行",
    move: unit.move,
    movementTypeLabel: unit.movementType === "infantry" ? "歩兵" : "騎馬",
    actionStatus: unit.hasActed ? "行動済" : unit.hasMoved ? "移動済・未行動" : "未移動・未行動",
    growthRates: { ...unit.growthRates },
    campaignBattleRecord: battleRecord ? {
      ...battleRecord,
      statGains: { ...battleRecord.statGains }
    } : null,
    stats: (Object.keys(STAT_LABELS) as NonHpStatKey[]).map((key) => ({
      key, label: STAT_LABELS[key], value: unit.stats[key]
    })),
    weapons,
    items
  };
}
export type PlayerInspectionDetails = NonNullable<ReturnType<typeof getPlayerInspectionDetails>>;
