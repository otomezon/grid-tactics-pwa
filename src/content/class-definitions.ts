import type { UnitStats } from "../domain/models/game";
import type { PromotionExperiencePolicy } from "../domain/progression/class-change";
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
  /** Shared prototype cap values; these are not approved balance values. */
  readonly prototypeStatCaps: Readonly<UnitStats>;
  readonly promotion: BasicClassPromotionContent;
}

export interface PromotedClassDefinition {
  readonly id: PromotedClassId;
  readonly displayName: string;
  readonly tier: "promoted";
  /** Shared prototype cap values; these are not approved balance values. */
  readonly prototypeStatCaps: Readonly<UnitStats>;
  readonly promotion: null;
}

export type ClassDefinition = BasicClassDefinition | PromotedClassDefinition;

function createPrototypeStatCaps(): Readonly<UnitStats> {
  return Object.freeze({
    hp: 60,
    strength: 30,
    magic: 30,
    skill: 30,
    speed: 30,
    luck: 30,
    defense: 30,
    resistance: 30
  });
}

function createBasicClass(
  id: BasicClassId,
  displayName: string,
  targetClassId: PromotedClassId,
  statBonuses: Partial<UnitStats>
): BasicClassDefinition {
  return Object.freeze({
    id,
    displayName,
    tier: "basic" as const,
    prototypeStatCaps: createPrototypeStatCaps(),
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
  displayName: string
): PromotedClassDefinition {
  return Object.freeze({
    id,
    displayName,
    tier: "promoted" as const,
    prototypeStatCaps: createPrototypeStatCaps(),
    promotion: null
  });
}

/**
 * Canonical registry for the fourteen classes in the initial release.
 *
 * Numeric caps and promotion bonuses are intentionally labelled and retained
 * as prototype values. Movement and weapon access remain on each saved unit
 * until approved class-specific tables are authored (CP-09 / CP-10).
 */
export const CLASS_DEFINITIONS = Object.freeze({
  swordsman: createBasicClass("swordsman", "剣士", "swordmaster", {
    hp: 2,
    skill: 1,
    speed: 1
  }),
  mercenary: createBasicClass("mercenary", "傭兵", "hero", {
    hp: 2,
    strength: 1,
    speed: 1
  }),
  fighter: createBasicClass("fighter", "戦士", "warrior", {
    hp: 3,
    strength: 2
  }),
  soldier: createBasicClass("soldier", "ソルジャー", "general", {
    hp: 2,
    defense: 1
  }),
  cavalry: createBasicClass("cavalry", "騎兵", "paladin", {
    hp: 2,
    strength: 1,
    speed: 1
  }),
  archer: createBasicClass("archer", "アーチャー", "sniper", {
    hp: 2,
    skill: 2
  }),
  mage: createBasicClass("mage", "魔道士", "sage", {
    hp: 2,
    magic: 2
  }),
  swordmaster: createPromotedClass("swordmaster", "ソードマスター"),
  hero: createPromotedClass("hero", "勇者"),
  warrior: createPromotedClass("warrior", "ウォーリア"),
  general: createPromotedClass("general", "ジェネラル"),
  paladin: createPromotedClass("paladin", "パラディン"),
  sniper: createPromotedClass("sniper", "スナイパー"),
  sage: createPromotedClass("sage", "賢者")
} satisfies Readonly<Record<GameClassId, ClassDefinition>>);

export function isRegisteredClassId(value: unknown): value is GameClassId {
  return typeof value === "string" && Object.hasOwn(CLASS_DEFINITIONS, value);
}

export function getClassDefinition(classId: string): ClassDefinition | undefined {
  return isRegisteredClassId(classId) ? CLASS_DEFINITIONS[classId] : undefined;
}
