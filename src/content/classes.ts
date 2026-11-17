import type { UnitStats } from "../domain/models/game";
import type { ClassPromotionDefinition, PromotionClassProfile } from "../domain/progression/class-change";
import {
  CLASS_DEFINITIONS,
  getClassDefinition,
  type BasicClassDefinition,
  type PromotedClassId
} from "./class-definitions";

export {
  BASIC_CLASS_IDS,
  CLASS_DEFINITIONS,
  PROMOTED_CLASS_IDS,
  getClassDefinition,
  isRegisteredClassId
} from "./class-definitions";
export type {
  BasicClassDefinition,
  BasicClassId,
  ClassDefinition,
  GameClassId,
  PromotedClassDefinition,
  PromotedClassId
} from "./class-definitions";

function copyStatCaps(caps: Readonly<UnitStats>): UnitStats {
  return { ...caps };
}

function copyMovementProfile(profile: PromotionClassProfile): PromotionClassProfile {
  return {
    move: profile.move,
    movementType: profile.movementType,
    usableWeaponTypes: [...profile.usableWeaponTypes]
  };
}

type ImmutableClassPromotionDefinition = Readonly<
  Omit<ClassPromotionDefinition, "statBonuses" | "statCaps" | "targetClassProfile">
> & {
  readonly statBonuses: Readonly<Partial<UnitStats>>;
  readonly statCaps: Readonly<UnitStats>;
  readonly targetClassProfile: PromotionClassProfile;
};

function freezePromotionDefinition(
  definition: ClassPromotionDefinition
): ImmutableClassPromotionDefinition {
  return Object.freeze({
    ...definition,
    statBonuses: Object.freeze({ ...definition.statBonuses }),
    statCaps: Object.freeze({ ...definition.statCaps }),
    targetClassProfile: Object.freeze({
      ...definition.targetClassProfile!,
      usableWeaponTypes: Object.freeze([...definition.targetClassProfile!.usableWeaponTypes])
    })
  });
}

export const CLASS_DISPLAY_NAMES: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    Object.values(CLASS_DEFINITIONS).map((definition) => [
      definition.id,
      definition.displayName
    ])
  ) as Record<string, string>
);

export function getClassDisplayName(classId: string): string {
  return getClassDefinition(classId)?.displayName ?? classId;
}

export function getClassTierLabel(classId: string): "基本職" | "昇格職" | "未登録職" {
  const definition = getClassDefinition(classId);
  if (!definition) return "未登録職";
  return definition.tier === "basic" ? "基本職" : "昇格職";
}

export const CLASS_STAT_CAPS: Readonly<Record<string, Readonly<UnitStats>>> = Object.freeze(
  Object.fromEntries(
    Object.values(CLASS_DEFINITIONS).map((definition) => [
      definition.id,
      Object.freeze(copyStatCaps(definition.statCaps))
    ])
  ) as Record<string, Readonly<UnitStats>>
);

/** @deprecated Use CLASS_STAT_CAPS. Kept for the development-only fixture lab. */
export const PROTOTYPE_CLASS_STAT_CAPS = CLASS_STAT_CAPS;

export function getClassStatCaps(classId: string): UnitStats {
  const definition = getClassDefinition(classId);
  if (!definition) {
    throw new Error("No class stat caps are defined for class: " + classId);
  }
  return copyStatCaps(definition.statCaps);
}

/** @deprecated Use getClassStatCaps. */
export function getPrototypeStatCaps(classId: string): UnitStats {
  return getClassStatCaps(classId);
}

function toPromotionDefinition(
  definition: BasicClassDefinition
): ClassPromotionDefinition {
  const target = CLASS_DEFINITIONS[definition.promotion.targetClassId];
  return {
    fromClassId: definition.id,
    toClassId: target.id,
    requiredItemId: definition.promotion.requiredItemId,
    statBonuses: { ...definition.promotion.statBonuses },
    statCaps: copyStatCaps(target.statCaps),
    experiencePolicy: definition.promotion.experiencePolicy,
    targetClassProfile: copyMovementProfile(target.movementProfile)
  };
}

const basicClassDefinitions = Object.values(CLASS_DEFINITIONS).filter(
  (definition): definition is BasicClassDefinition => definition.tier === "basic"
);

export const CLASS_PROMOTION_TARGETS: Readonly<
  Record<string, PromotedClassId>
> = Object.freeze(
  Object.fromEntries(
    basicClassDefinitions.map((definition) => [
      definition.id,
      definition.promotion.targetClassId
    ])
  ) as Record<string, PromotedClassId>
);

export function getPromotionTargetClassId(
  classId: string
): PromotedClassId | undefined {
  const definition = getClassDefinition(classId);
  return definition?.tier === "basic"
    ? definition.promotion.targetClassId
    : undefined;
}

export const CLASS_PROMOTION_DEFINITIONS: Readonly<
  Record<string, ImmutableClassPromotionDefinition>
> = Object.freeze(
  Object.fromEntries(
    basicClassDefinitions.map((definition) => [
      definition.id,
      freezePromotionDefinition(toPromotionDefinition(definition))
    ])
  ) as Record<string, ImmutableClassPromotionDefinition>
);

export function getClassPromotionDefinition(
  classId: string
): ClassPromotionDefinition | undefined {
  const definition = getClassDefinition(classId);
  return definition?.tier === "basic"
    ? toPromotionDefinition(definition)
    : undefined;
}
