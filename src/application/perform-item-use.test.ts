import { describe, expect, it } from "vitest";
import { HEALING_POTION_AMOUNT, HEALING_POTION_ID, INVENTORY_ITEMS_BY_ID } from "../content/items";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { performItemUse } from "./perform-item-use";

function stateWithUnit(overrides: Record<string, unknown> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "unit_001"
        ? {
            ...unit,
            currentHp: 13,
            inventory: ["iron_sword", HEALING_POTION_ID, HEALING_POTION_ID],
            ...overrides
          }
        : unit
    )
  };
}

const healingPotion = INVENTORY_ITEMS_BY_ID[HEALING_POTION_ID]!;

describe("performItemUse", () => {
  it("allows use after movement, caps healing at max HP, consumes one item and the action", () => {
    const state = stateWithUnit({
      currentHp: 13,
      hasMoved: true,
      hasActed: false
    });
    const original = structuredClone(state);
    const result = performItemUse(state, "unit_001", healingPotion);
    const updated = result.nextState.units.find((unit) => unit.id === "unit_001");

    expect(result).toMatchObject({
      usedItemId: HEALING_POTION_ID,
      healedHp: 7
    });
    expect(updated).toMatchObject({
      currentHp: 20,
      hasMoved: true,
      hasActed: true,
      inventory: ["iron_sword", HEALING_POTION_ID]
    });
    expect(result.nextState.saveVersion).toBe(INITIAL_GAME_STATE.saveVersion);
    expect(state).toEqual(original);
  });

  it("applies the configured prototype amount when the unit has enough missing HP", () => {
    const state = stateWithUnit({ currentHp: 2 });
    const result = performItemUse(state, "unit_001", healingPotion);

    expect(result.healedHp).toBe(HEALING_POTION_AMOUNT);
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")?.currentHp).toBe(12);
  });

  it("rejects use at full HP without changing the state", () => {
    const state = stateWithUnit({ currentHp: 20 });
    const original = structuredClone(state);

    expect(() => performItemUse(state, "unit_001", healingPotion)).toThrow(/full HP/);
    expect(state).toEqual(original);
  });

  it("rejects an item the unit does not own", () => {
    const state = stateWithUnit({ inventory: ["iron_sword"] });
    expect(() => performItemUse(state, "unit_001", healingPotion)).toThrow(/does not have this item/);
  });

  it("rejects use outside the player phase", () => {
    const state = { ...stateWithUnit(), phase: "enemy" as const };
    expect(() => performItemUse(state, "unit_001", healingPotion)).toThrow(/player phase/);
  });

  it("rejects enemies, defeated units, and units that have already acted", () => {
    expect(() => performItemUse(stateWithUnit({ faction: "enemy" }), "unit_001", healingPotion))
      .toThrow(/living player units/);
    expect(() => performItemUse(stateWithUnit({ currentHp: 0 }), "unit_001", healingPotion))
      .toThrow(/living player units/);
    expect(() => performItemUse(stateWithUnit({ hasActed: true }), "unit_001", healingPotion))
      .toThrow(/already acted/);
  });

  it("rejects invalid effect amounts", () => {
    expect(() => performItemUse(
      stateWithUnit(),
      "unit_001",
      { ...healingPotion, effect: { type: "heal", amount: 0 } }
    )).toThrow(/positive integer/);
  });
});
