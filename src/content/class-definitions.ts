import type { UnitStats, WeaponType } from "../domain/models/game";
import type {
  PromotionClassProfile,
  PromotionExperiencePolicy
} from "../domain/progression/class-change";
import { PROMOTION_ITEM_ID } from "./items";

export const BASIC_CLASS_IDS = [
  "swordsman",
  "mercenary",
  "fighter",
  "soldier",
  "cavalry",
  "archer",
  "mage"
] as const;

export const PROMOTED_CLASS_IDS = [
  "swordmaster",
  "hero",
  "warrior",
  "general",
  "paladin",
  "sniper",
  "sage"
] as const;

export type BasicClassId = (typeof BASIC_CLASS_IDS)[number];
export type PromotedClassId = (typeof PROMOTED_CLASS_IDS)[number];
export type GameClassId = BasicClassId | PromotedClassId;

export interface BasicClassPromotionContent {
  readonly targetClassId: PromotedClassId;
  readonly requiredItemId: string;
  readonly statBonuses: Readonly<Partial<UnitStats>>;
  readonly experiencePolicy: PromotionExperiencePolicy;
}

export interface BasicClassDefinition {
  readonly id: BasicClassId;
  readonly displayName: string;
  readonly tier: "basic";
  readonly statCaps: Readonly<UnitStats>;
  readonly movementProfile: PromotionClassProfile;
  readonly promotion: BasicClassPromotionContent;
}

export interface PromotedClassDefinition {
  readonly id: PromotedClassId;
  readonly displayName: string;
  readonly tier: "promoted";
  readonly statCaps: Readonly<UnitStats>;
  readonly movementProfile: PromotionClassProfile;
  readonly promotion: null;
}

export type ClassDefinition = BasicClassDefinition | PromotedClassDefinition;

function stats(
  hp: number,
  strength: number,
  magic: number,
  skill: number,
  speed: number,
  luck: number,
  defense: number,
  resistance: number
): Readonly<UnitStats> {
  return Object.freeze({ hp, strength, magic, skill, speed, luck, defense, resistance });
}

function profile(
  move: number,
  movementType: "infantry" | "cavalry",
  usableWeaponTypes: WeaponType[]
): PromotionClassProfile {
  return Object.freeze({
    move,
    movementType,
    usableWeaponTypes: Object.freeze([...usableWeaponTypes])
  });
}

function createBasicClass(
  id: BasicClassId,
  displayName: string,
  targetClassId: PromotedClassId,
  statCaps: Readonly<UnitStats>,
  movementProfile: PromotionClassProfile,
  statBonuses: Partial<UnitStats>
): BasicClassDefinition {
  return Object.freeze({
    id,
    displayName,
    tier: "basic" as const,
    statCaps,
    movementProfile,
    promotion: Object.freeze({
      targetClassId,
      requiredItemId: PROMOTION_ITEM_ID,
      statBonuses: Object.freeze({ ...statBonuses }),
      experiencePolicy: "preserve" as const
    })
  });
}

function createPromotedClass(
  id: PromotedClassId,
  displayName: string,
  statCaps: Readonly<UnitStats>,
  movementProfile: PromotionClassProfile
): PromotedClassDefinition {
  return Object.freeze({
    id,
    displayName,
    tier: "promoted" as const,
    statCaps,
    movementProfile,
    promotion: null
  });
}

/**
 * Initial-release class data. Caps, promotion gains, movement, and weapon
 * access are explicit content rather than shared prototype placeholders.
 */
export const CLASS_DEFINITIONS = Object.freeze({
  swordsman: createBasicClass(
    "swordsman", "剣士", "swordmaster",
    stats(40, 20, 10, 22, 24, 30, 18, 16),
    profile(5, "infantry", ["sword"]),
    { hp: 5, strength: 2, skill: 3, speed: 3, luck: 1, defense: 1 }
  ),
  mercenary: createBasicClass(
    "mercenary", "傭兵", "hero",
    stats(42, 22, 10, 22, 21, 26, 20, 16),
    profile(5, "infantry", ["sword"]),
    { hp: 5, strength: 3, skill: 2, speed: 2, defense: 2 }
  ),
  fighter: createBasicClass(
    "fighter", "戦士", "warrior",
    stats(45, 24, 5, 18, 18, 24, 22, 12),
    profile(5, "infantry", ["axe"]),
    { hp: 6, strength: 3, skill: 2, speed: 1, defense: 2 }
  ),
  soldier: createBasicClass(
    "soldier", "ソルジャー", "general",
    stats(42, 21, 8, 20, 18, 26, 23, 15),
    profile(5, "infantry", ["lance"]),
    { hp: 5, strength: 2, skill: 1, speed: 1, defense: 3, resistance: 2 }
  ),
  cavalry: createBasicClass(
    "cavalry", "騎兵", "paladin",
    stats(42, 21, 8, 20, 21, 24, 20, 14),
    profile(6, "cavalry", ["sword", "lance"]),
    { hp: 5, strength: 2, skill: 2, speed: 2, defense: 2, resistance: 1 }
  ),
  archer: createBasicClass(
    "archer", "アーチャー", "sniper",
    stats(40, 20, 8, 24, 21, 26, 17, 16),
    profile(5, "infantry", ["bow"]),
    { hp: 4, strength: 2, skill: 3, speed: 2, luck: 1, defense: 1 }
  ),
  mage: createBasicClass(
    "mage", "魔道士", "sage",
    stats(38, 10, 24, 20, 20, 26, 14, 22),
    profile(5, "infantry", ["magic"]),
    { hp: 4, strength: 1, magic: 4, skill: 2, speed: 1, resistance: 2 }
  ),
  swordmaster: createPromotedClass(
    "swordmaster", "ソードマスター",
    stats(60, 25, 10, 30, 30, 30, 22, 20),
    profile(5, "infantry", ["sword"])
  ),
  hero: createPromotedClass(
    "hero", "勇者",
    stats(60, 27, 15, 27, 27, 30, 25, 22),
    profile(5, "infantry", ["sword", "axe"])
  ),
  warrior: createPromotedClass(
    "warrior", "ウォーリア",
    stats(65, 30, 8, 24, 24, 28, 27, 18),
    profile(5, "infantry", ["axe"])
  ),
  general: createPromotedClass(
    "general", "ジェネラル",
    stats(65, 27, 12, 26, 23, 28, 30, 25),
    profile(5, "infantry", ["lance", "axe"])
  ),
  paladin: createPromotedClass(
    "paladin", "パラディン",
    stats(60, 27, 16, 26, 28, 28, 27, 24),
    profile(7, "cavalry", ["sword", "lance"])
  ),
  sniper: createPromotedClass(
    "sniper", "スナイパー",
    stats(58, 25, 12, 30, 27, 30, 22, 21),
    profile(5, "infantry", ["bow"])
  ),
  sage: createPromotedClass(
    "sage", "賢者",
    stats(55, 15, 30, 28, 27, 30, 20, 30),
    profile(5, "infantry", ["magic"])
  )
} satisfies Readonly<Record<GameClassId, ClassDefinition>>);

export function isRegisteredClassId(value: unknown): value is GameClassId {
  return typeof value === "string" && Object.hasOwn(CLASS_DEFINITIONS, value);
}

export function getClassDefinition(classId: string): ClassDefinition | undefined {
  return isRegisteredClassId(classId) ? CLASS_DEFINITIONS[classId] : undefined;
}
