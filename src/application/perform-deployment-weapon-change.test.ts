import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { CampaignUnit, GameStateSnapshot, GameUnit } from "../domain/models/game";
import { performDeploymentWeaponChange } from "./perform-deployment-weapon-change";

function stateWithUnit(unitId: string, overrides: Partial<GameUnit> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) => unit.id === unitId ? { ...unit, ...overrides } : unit)
  };
}

function moveUnitToReserve(state: GameStateSnapshot, unitId: string): GameStateSnapshot {
  const active = state.units.find((unit) => unit.id === unitId);
  if (!active) throw new Error("Missing active test unit.");
  const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaign } = active;
  const reserve: CampaignUnit = { ...campaign };
  return {
    ...state,
    units: state.units.filter((unit) => unit.id !== unitId),
    reserveUnits: [...state.reserveUnits, reserve]
  };
}

describe("performDeploymentWeaponChange", () => {
  it("changes an active unit to an owned compatible weapon without mutating the input", () => {
    const state = stateWithUnit("unit_004");
    const original = structuredClone(state);
    const result = performDeploymentWeaponChange(state, "unit_004", "iron_lance");

    expect(result).toMatchObject({
      previousWeaponId: "iron_sword",
      equippedWeaponId: "iron_lance",
      equippedWeaponName: "試作の鉄の槍"
    });
    expect(result.nextState.units.find((unit) => unit.id === "unit_004")?.equippedWeaponId).toBe("iron_lance");
    expect(result.nextState.saveVersion).toBe(3);
    expect(state).toEqual(original);
  });

  it("allows a player unit to unequip its weapon", () => {
    const result = performDeploymentWeaponChange(stateWithUnit("unit_001"), "unit_001", null);
    expect(result.equippedWeaponId).toBeNull();
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")?.equippedWeaponId).toBeNull();
  });

  it("changes a reserve unit without moving it into the active battle roster", () => {
    const state = moveUnitToReserve(stateWithUnit("unit_004"), "unit_004");
    const original = structuredClone(state);
    const result = performDeploymentWeaponChange(state, "unit_004", "iron_lance");

    expect(result.nextState.units.some((unit) => unit.id === "unit_004")).toBe(false);
    expect(result.nextState.reserveUnits.find((unit) => unit.id === "unit_004")?.equippedWeaponId).toBe("iron_lance");
    expect(result.nextState.reserveUnits).toHaveLength(1);
    expect(state).toEqual(original);
  });

  it("rejects weapons that are not owned, not compatible, or not registered", () => {
    const state = stateWithUnit("unit_001", { inventory: ["iron_sword", "short_bow"] });
    expect(() => performDeploymentWeaponChange(state, "unit_001", "iron_lance")).toThrow(/does not own or cannot use/);
    expect(() => performDeploymentWeaponChange(state, "unit_001", "short_bow")).toThrow(/does not own or cannot use/);
    expect(() => performDeploymentWeaponChange(state, "unit_001", "missing_weapon")).toThrow(/not registered/);
  });

  it("rejects enemies, defeated units, and active units that already acted or moved", () => {
    expect(() => performDeploymentWeaponChange(stateWithUnit("enemy_001"), "enemy_001", "iron_axe"))
      .toThrow(/Only player/);
    expect(() => performDeploymentWeaponChange(stateWithUnit("unit_001", { currentHp: 0 }), "unit_001", null))
      .toThrow(/defeated/);
    expect(() => performDeploymentWeaponChange(stateWithUnit("unit_001", { hasMoved: true }), "unit_001", null))
      .toThrow(/already moved or acted/);
    expect(() => performDeploymentWeaponChange(stateWithUnit("unit_001", { hasActed: true }), "unit_001", null))
      .toThrow(/already moved or acted/);
  });

  it("rejects changes outside the initial player deployment window", () => {
    expect(() => performDeploymentWeaponChange({
      ...INITIAL_GAME_STATE,
      phase: "enemy"
    }, "unit_004", "iron_lance")).toThrow(/first player-phase action/);
    expect(() => performDeploymentWeaponChange({
      ...INITIAL_GAME_STATE,
      turn: 2
    }, "unit_004", "iron_lance")).toThrow(/first player-phase action/);
  });

  it("rejects missing or duplicated campaign roster entries", () => {
    expect(() => performDeploymentWeaponChange(INITIAL_GAME_STATE, "missing", null))
      .toThrow(/does not exist or is duplicated/);
    expect(() => performDeploymentWeaponChange({
      ...INITIAL_GAME_STATE,
      reserveUnits: [INITIAL_GAME_STATE.units[3] as unknown as CampaignUnit]
    }, "unit_004", null)).toThrow(/does not exist or is duplicated/);
  });
});
