import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { createAttackPlan } from "./perform-attack";
import { getCombatForecastDetails } from "./get-combat-forecast-details";

describe("getCombatForecastDetails", () => {
  it("exposes strike weapons, critical damage, weapon triangle, and target terrain", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) => {
        if (unit.id === "unit_001") {
          return { ...unit, position: { x: 3, y: 1 }, hasMoved: false, hasActed: false };
        }
        if (unit.id === "enemy_001") {
          return { ...unit, position: { x: 4, y: 1 }, hasMoved: false, hasActed: false };
        }
        return unit;
      })
    };

    const details = getCombatForecastDetails(
      createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001")
    );

    expect(details.attacker).toMatchObject({ name: "味方01", currentHp: 20, maxHp: 20 });
    expect(details.defender).toMatchObject({ name: "敵01", currentHp: 20, maxHp: 20 });
    expect(details.distance).toBe(1);
    expect(details.counterAvailability).toBe("available");
    expect(details.strikes).toHaveLength(2);
    expect(details.strikes[0]).toMatchObject({
      kindLabel: "先制攻撃",
      actorName: "味方01",
      targetName: "敵01",
      weaponName: "試作の鉄の剣",
      weaponTypeLabel: "剣",
      damageTypeLabel: "物理",
      weaponTriangleModifier: 20,
      targetTerrainName: "森",
      targetTerrainDefenseBonus: 1,
      targetTerrainAvoidanceBonus: 20
    });
    expect(details.strikes[0]?.criticalDamage).toBe(details.strikes[0]!.normalDamage * 3);
    expect(details.strikes[1]).toMatchObject({
      kindLabel: "反撃",
      actorName: "敵01",
      targetName: "味方01",
      weaponName: "試作の鉄の斧",
      weaponTriangleModifier: -20,
      targetTerrainName: "平地"
    });
  });

  it("explains when the defender has no valid equipped weapon", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) => {
        if (unit.id === "unit_001") {
          return { ...unit, position: { x: 1, y: 1 }, hasMoved: false, hasActed: false };
        }
        if (unit.id === "enemy_001") {
          return {
            ...unit,
            position: { x: 2, y: 1 },
            inventory: [],
            equippedWeaponId: null,
            hasMoved: false,
            hasActed: false
          };
        }
        return unit;
      })
    };

    const details = getCombatForecastDetails(
      createAttackPlan(state, CHAPTER_01_MAP, "unit_001", "enemy_001")
    );

    expect(details.counterAvailability).toBe("no-weapon");
    expect(details.strikes.map((strike) => strike.kind)).toEqual(["initial"]);
  });

  it("explains when the defender weapon cannot counter at the current distance", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) => {
        if (unit.id === "unit_002") {
          return { ...unit, position: { x: 1, y: 1 }, hasMoved: false, hasActed: false };
        }
        if (unit.id === "enemy_001") {
          return { ...unit, position: { x: 3, y: 1 }, hasMoved: false, hasActed: false };
        }
        return unit;
      })
    };

    const details = getCombatForecastDetails(
      createAttackPlan(state, CHAPTER_01_MAP, "unit_002", "enemy_001")
    );

    expect(details.distance).toBe(2);
    expect(details.counterAvailability).toBe("out-of-range");
    expect(details.strikes.map((strike) => strike.kind)).toEqual(["initial"]);
  });
});
