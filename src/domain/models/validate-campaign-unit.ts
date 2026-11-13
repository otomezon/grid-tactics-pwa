import { INVENTORY_ITEMS_BY_ID } from "../../content/items";
import { isRegisteredClassId } from "../../content/class-definitions";
import { WEAPONS_BY_ID } from "../../content/weapons";
import type { CampaignUnit, UnitStats, WeaponType } from "./game";

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp", "strength", "magic", "skill", "speed", "luck", "defense", "resistance"
];
const WEAPON_TYPES: readonly WeaponType[] = ["sword", "lance", "axe", "bow", "magic"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function isUnitStats(value: unknown): value is UnitStats {
  return isRecord(value) && STAT_KEYS.every((key) => isNonNegativeInteger(value[key])) &&
    (value.hp as number) > 0;
}
function isGrowthRates(value: unknown): value is CampaignUnit["growthRates"] {
  return isRecord(value) && STAT_KEYS.every((key) => {
    const rate = value[key];
    return typeof rate === "number" && Number.isInteger(rate) && rate >= 0 && rate <= 100;
  });
}
function isWeaponType(value: unknown): value is WeaponType {
  return WEAPON_TYPES.includes(value as WeaponType);
}
function isRegisteredInventoryItemId(value: unknown): value is string {
  return isNonEmptyString(value) &&
    (Object.hasOwn(WEAPONS_BY_ID, value) || Object.hasOwn(INVENTORY_ITEMS_BY_ID, value));
}

/** Validates persistent campaign-member data independently from map placement. */
export function isValidCampaignUnitData(value: unknown): value is CampaignUnit {
  if (!isRecord(value)) return false;
  const stats = value.stats;
  const inventory = value.inventory;
  const usableWeaponTypes = value.usableWeaponTypes;
  const equippedWeaponId = value.equippedWeaponId;
  const equippedWeapon = typeof equippedWeaponId === "string" && Object.hasOwn(WEAPONS_BY_ID, equippedWeaponId)
    ? WEAPONS_BY_ID[equippedWeaponId]
    : undefined;
  return (
    isNonEmptyString(value.id) && isNonEmptyString(value.name) &&
    isNonEmptyString(value.classId) && isRegisteredClassId(value.classId) &&
    isNonNegativeInteger(value.level) && (value.level as number) >= 1 &&
    isNonNegativeInteger(value.experience) && (value.experience as number) < 100 &&
    isUnitStats(stats) && isGrowthRates(value.growthRates) &&
    isNonNegativeInteger(value.currentHp) && (value.currentHp as number) > 0 &&
    (value.currentHp as number) <= stats.hp &&
    (value.movementType === "infantry" || value.movementType === "cavalry") &&
    isNonNegativeInteger(value.move) &&
    Array.isArray(usableWeaponTypes) && usableWeaponTypes.every(isWeaponType) &&
    Array.isArray(inventory) && inventory.length <= 5 && inventory.every(isRegisteredInventoryItemId) &&
    (equippedWeaponId === null || (
      isNonEmptyString(equippedWeaponId) &&
      Array.isArray(inventory) && inventory.includes(equippedWeaponId) &&
      equippedWeapon !== undefined &&
      Array.isArray(usableWeaponTypes) &&
      usableWeaponTypes.includes(equippedWeapon.weaponType)
    ))
  );
}
