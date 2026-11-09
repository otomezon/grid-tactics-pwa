import type { UnitStats } from "../domain/models/game";
import type { ClassPromotionDefinition } from "../domain/progression/class-change";
import { PROMOTION_ITEM_ID } from "./items";

/**
 * Placeholder class caps for the prototype.
 *
 * The design document requires class-based caps but does not provide numeric
 * values. These shared provisional caps keep growth bounded until class data
 * and balance values are authored.
 */
const PROTOTYPE_STAT_CAPS: UnitStats = {
  hp: 60,
  strength: 30,
  magic: 30,
  skill: 30,
  speed: 30,
  luck: 30,
  defense: 30,
  resistance: 30
};

export const PROTOTYPE_CLASS_STAT_CAPS: Readonly<Record<string, UnitStats>> = {
  swordsman: PROTOTYPE_STAT_CAPS,
  archer: PROTOTYPE_STAT_CAPS,
  soldier: PROTOTYPE_STAT_CAPS,
  cavalry: PROTOTYPE_STAT_CAPS,
  fighter: PROTOTYPE_STAT_CAPS,
  swordmaster: PROTOTYPE_STAT_CAPS,
  hero: PROTOTYPE_STAT_CAPS,
  warrior: PROTOTYPE_STAT_CAPS,
  general: PROTOTYPE_STAT_CAPS,
  paladin: PROTOTYPE_STAT_CAPS,
  sniper: PROTOTYPE_STAT_CAPS,
  sage: PROTOTYPE_STAT_CAPS
};

export function getPrototypeStatCaps(classId: string): UnitStats {
  const caps = PROTOTYPE_CLASS_STAT_CAPS[classId];
  if (!caps) {
    throw new Error("No prototype stat caps are defined for class: " + classId);
  }
  return caps;
}

/**
 * Promotion paths proposed by docs/game-design.md §5.5.
 * Stat bonuses, promoted-class caps, and other runtime class data are configured
 * separately because the design proposal does not provide those values.
 */
export const CLASS_PROMOTION_TARGETS = {
  swordsman: "swordmaster",
  mercenary: "hero",
  fighter: "warrior",
  soldier: "general",
  cavalry: "paladin",
  archer: "sniper",
  mage: "sage"
} as const;

export function getPromotionTargetClassId(classId: string): string | undefined {
  if (!Object.hasOwn(CLASS_PROMOTION_TARGETS, classId)) return undefined;
  return CLASS_PROMOTION_TARGETS[classId as keyof typeof CLASS_PROMOTION_TARGETS];
}


/**
 * Temporary stat bonuses for the playable prototype.
 * The design proposal requires promotion bonuses but does not specify values;
 * these are test-balancing placeholders, not final class balance.
 */
const PROTOTYPE_PROMOTION_BONUSES: Readonly<Record<string, Partial<UnitStats>>> = {
  swordsman: { hp: 2, skill: 1, speed: 1 },
  mercenary: { hp: 2, strength: 1, speed: 1 },
  fighter: { hp: 3, strength: 2 },
  soldier: { hp: 2, defense: 1 },
  cavalry: { hp: 2, strength: 1, speed: 1 },
  archer: { hp: 2, skill: 2 },
  mage: { hp: 2, magic: 2 }
};

function createPrototypePromotion(
  fromClassId: string,
  toClassId: string
): ClassPromotionDefinition {
  return {
    fromClassId,
    toClassId,
    requiredItemId: PROMOTION_ITEM_ID,
    statBonuses: PROTOTYPE_PROMOTION_BONUSES[fromClassId] ?? { hp: 2 },
    statCaps: getPrototypeStatCaps(toClassId),
    experiencePolicy: "preserve"
  };
}

/** Promotion definitions are provisional until class balance is authored. */
export const CLASS_PROMOTION_DEFINITIONS: Readonly<Record<string, ClassPromotionDefinition>> = {
  swordsman: createPrototypePromotion("swordsman", "swordmaster"),
  mercenary: createPrototypePromotion("mercenary", "hero"),
  fighter: createPrototypePromotion("fighter", "warrior"),
  soldier: createPrototypePromotion("soldier", "general"),
  cavalry: createPrototypePromotion("cavalry", "paladin"),
  archer: createPrototypePromotion("archer", "sniper"),
  mage: createPrototypePromotion("mage", "sage")
};

export function getClassPromotionDefinition(
  classId: string
): ClassPromotionDefinition | undefined {
  return CLASS_PROMOTION_DEFINITIONS[classId];
}
