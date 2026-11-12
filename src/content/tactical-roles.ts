export type TacticalRole = "ranged-attacker";

export interface TacticalRoleDefinition {
  label: string;
  targetPriorityBonus: number;
}

/**
 * Prototype class metadata used by the deterministic enemy AI.
 * These tags are content-side metadata, not GameUnit/save fields.
 */
export const TACTICAL_ROLE_DEFINITIONS: Readonly<Record<TacticalRole, TacticalRoleDefinition>> = {
  "ranged-attacker": {
    label: "遠距離攻撃役",
    targetPriorityBonus: 35
  }
};

const CLASS_TACTICAL_ROLES: Readonly<Record<string, readonly TacticalRole[]>> = {
  archer: ["ranged-attacker"],
  mage: ["ranged-attacker"],
  sniper: ["ranged-attacker"],
  sage: ["ranged-attacker"]
};

export function getClassTacticalRoles(classId: string): readonly TacticalRole[] {
  return CLASS_TACTICAL_ROLES[classId] ?? [];
}

export function getTacticalRoleLabel(role: TacticalRole): string {
  return TACTICAL_ROLE_DEFINITIONS[role].label;
}

export function getTacticalRolePriorityBonus(role: TacticalRole): number {
  return TACTICAL_ROLE_DEFINITIONS[role].targetPriorityBonus;
}
