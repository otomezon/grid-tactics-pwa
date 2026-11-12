import { describe, expect, it } from "vitest";
import {
  getClassTacticalRoles,
  getTacticalRoleLabel,
  getTacticalRolePriorityBonus,
  TACTICAL_ROLE_DEFINITIONS
} from "./tactical-roles";

describe("class tactical-role metadata", () => {
  it("marks current and promoted ranged classes without adding save fields", () => {
    for (const classId of ["archer", "mage", "sniper", "sage"]) {
      expect(getClassTacticalRoles(classId)).toEqual(["ranged-attacker"]);
    }
    for (const classId of ["swordsman", "mercenary", "fighter", "soldier", "cavalry", "hero", "warrior", "general", "paladin"]) {
      expect(getClassTacticalRoles(classId)).toEqual([]);
    }
    expect(getClassTacticalRoles("future-unregistered-class")).toEqual([]);
  });

  it("keeps labels and provisional target-priority weights in one content definition", () => {
    expect(getTacticalRoleLabel("ranged-attacker")).toBe("遠距離攻撃役");
    expect(getTacticalRolePriorityBonus("ranged-attacker")).toBe(35);
    expect(TACTICAL_ROLE_DEFINITIONS["ranged-attacker"]).toEqual({
      label: "遠距離攻撃役",
      targetPriorityBonus: 35
    });
  });
});
