import type { UnitStats } from "../domain/models/game";

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
  fighter: PROTOTYPE_STAT_CAPS
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
