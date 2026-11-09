import type { GameUnit, UnitStats } from "../models/game";

const STAT_KEYS: readonly (keyof UnitStats)[] = [
  "hp",
  "strength",
  "magic",
  "skill",
  "speed",
  "luck",
  "defense",
  "resistance"
];

export type PromotionExperiencePolicy = "preserve" | "reset";

export interface ClassPromotionDefinition {
  fromClassId: string;
  toClassId: string;
  requiredItemId: string;
  statBonuses: Partial<UnitStats>;
  statCaps: UnitStats;
  /** The design proposal does not specify whether partial EXP survives promotion. */
  experiencePolicy: PromotionExperiencePolicy;
}

export interface ClassPromotionResult {
  unit: GameUnit;
  consumedItemId: string;
  appliedBonuses: Partial<UnitStats>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateDefinition(definition: ClassPromotionDefinition): void {
  if (
    !isNonEmptyString(definition.fromClassId) ||
    !isNonEmptyString(definition.toClassId) ||
    definition.fromClassId === definition.toClassId ||
    !isNonEmptyString(definition.requiredItemId)
  ) {
    throw new RangeError("A promotion must define distinct source and target classes and an item ID.");
  }

  if (definition.experiencePolicy !== "preserve" && definition.experiencePolicy !== "reset") {
    throw new RangeError("A promotion must explicitly choose how partial experience is handled.");
  }

  if (
    !definition.statCaps ||
    STAT_KEYS.some((key) =>
      !Number.isInteger(definition.statCaps[key]) ||
      definition.statCaps[key] < (key === "hp" ? 1 : 0)
    )
  ) {
    throw new RangeError("Promotion stat caps must be non-negative integers and HP must be positive.");
  }

  const bonusEntries = Object.entries(definition.statBonuses ?? {});
  if (bonusEntries.length === 0 || !bonusEntries.some(([, bonus]) => Number.isInteger(bonus) && (bonus as number) > 0)) {
    throw new RangeError("A promotion must define at least one positive stat bonus.");
  }

  for (const [key, bonus] of bonusEntries) {
    if (
      !STAT_KEYS.includes(key as keyof UnitStats) ||
      !Number.isInteger(bonus) ||
      (bonus as number) < 0
    ) {
      throw new RangeError("Promotion stat bonuses must be non-negative integer stat values.");
    }
  }
}

/**
 * Applies a configured promotion without choosing balance values.
 *
 * HP bonuses increase maximum HP only; current HP is preserved. Existing stats
 * are never reduced when a promoted class has a lower cap than the unit's
 * current value. New bonuses are limited by the supplied promoted-class caps.
 */
export function applyClassPromotion(
  unit: GameUnit,
  definition: ClassPromotionDefinition
): ClassPromotionResult {
  validateDefinition(definition);

  if (unit.faction !== "player") {
    throw new Error("Only player units can change class.");
  }
  if (unit.classId !== definition.fromClassId) {
    throw new Error("The unit's current class does not match this promotion.");
  }
  if (!Number.isInteger(unit.level) || unit.level < 10) {
    throw new Error("A unit must reach level 10 before changing class.");
  }
  if (
    !Number.isInteger(unit.experience) ||
    unit.experience < 0 ||
    unit.experience >= 100
  ) {
    throw new RangeError("Unit experience must be between 0 and 99.");
  }

  const itemIndex = unit.inventory.indexOf(definition.requiredItemId);
  if (itemIndex < 0) {
    throw new Error("The required class-change item is not in the unit's inventory.");
  }
  if (unit.equippedWeaponId === definition.requiredItemId) {
    throw new Error("The required class-change item cannot be equipped as a weapon.");
  }

  const stats: UnitStats = { ...unit.stats };
  const appliedBonuses: Partial<UnitStats> = {};

  for (const key of STAT_KEYS) {
    const requestedBonus = definition.statBonuses[key] ?? 0;
    const previousValue = stats[key];
    const cappedValue = Math.min(previousValue + requestedBonus, definition.statCaps[key]);
    const nextValue = Math.max(previousValue, cappedValue);

    if (nextValue > previousValue) {
      stats[key] = nextValue;
      appliedBonuses[key] = nextValue - previousValue;
    }
  }

  const inventory = [...unit.inventory];
  inventory.splice(itemIndex, 1);

  return {
    unit: {
      ...unit,
      classId: definition.toClassId,
      level: 1,
      experience: definition.experiencePolicy === "reset" ? 0 : unit.experience,
      stats,
      currentHp: unit.currentHp,
      inventory
    },
    consumedItemId: definition.requiredItemId,
    appliedBonuses
  };
}
