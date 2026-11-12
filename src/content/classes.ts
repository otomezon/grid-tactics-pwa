import type { UnitStats } from "../domain/models/game";
import type { ClassPromotionDefinition } from "../domain/progression/class-change";
import {
  BASIC_CLASS_IDS,
  CLASS_DEFINITIONS,
  PROMOTED_CLASS_IDS,
  getClassDefinition,
  isRegisteredClassId,
  type BasicClassDefinition,
  type BasicClassId,
  type GameClassId,
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

export const CLASS_DISPLAY_NAMES: Readonly<Record<GameClassId, string>> = Object.freeze(
  Object.fromEntries(
    Object.values(CLASS_DEFINITIONS).map((definition) => [
      definition.id,
      definition.displayName
    ])
  ) as Record<GameClassId, string>
);

export function getClassDisplayName(classId: string): string {
  return getClassDefinition(classId)?.displayName ?? classId;
}

export function getClassTierLabel(classId: string): "基本職" | "昇格職" | "未登録職" {
  const definition = getClassDefinition(classId);
  if (!definition) return "未登録職";
  return definition.tier === "basic" ? "基本職" : "昇格職";
}

export const PROTOTYPE_CLASS_STAT_CAPS: Readonly<Record<GameClassId, UnitStats>> = Object.freeze(
  Object.fromEntries(
    Object.values(CLASS_DEFINITIONS).map((definition) => [
      definition.id,
      Object.freeze(copyStatCaps(definition.prototypeStatCaps))
    ])
  ) as Record<GameClassId, UnitStats>
);

export function getPrototypeStatCaps(classId: string): UnitStats {
  const definition = getClassDefinition(classId);
  if (!definition) {
    throw new Error("No prototype stat caps are defined for class: " + classId);
  }
  return copyStatCaps(definition.prototypeStatCaps);
}

function toPromotionDefinition(
  definition: BasicClassDefinition
): ClassPromotionDefinition {
  return {
    fromClassId: definition.id,
    toClassId: definition.promotion.targetClassId,
    requiredItemId: definition.promotion.requiredItemId,
    statBonuses: { ...definition.promotion.statBonuses },
    statCaps: copyStatCaps(
      CLASS_DEFINITIONS[definition.promotion.targetClassId].prototypeStatCaps
    ),
    experiencePolicy: definition.promotion.experiencePolicy
  };
}

const basicClassDefinitions = Object.values(CLASS_DEFINITIONS).filter(
  (definition): definition is BasicClassDefinition => definition.tier === "basic"
);

export const CLASS_PROMOTION_TARGETS: Readonly<
  Record<BasicClassId, PromotedClassId>
> = Object.freeze(
  Object.fromEntries(
    basicClassDefinitions.map((definition) => [
      definition.id,
      definition.promotion.targetClassId
    ])
  ) as Record<BasicClassId, PromotedClassId>
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
  Record<BasicClassId, ClassPromotionDefinition>
> = Object.freeze(
  Object.fromEntries(
    basicClassDefinitions.map((definition) => [
      definition.id,
      Object.freeze(toPromotionDefinition(definition))
    ])
  ) as Record<BasicClassId, ClassPromotionDefinition>
);

export function getClassPromotionDefinition(
  classId: string
): ClassPromotionDefinition | undefined {
  const definition = getClassDefinition(classId);
  return definition?.tier === "basic"
    ? toPromotionDefinition(definition)
    : undefined;
}

void BASIC_CLASS_IDS;
void PROMOTED_CLASS_IDS;
void isRegisteredClassId;
