import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { preparePlayerDeployment } from "./prepare-player-deployment";

function assignments(
  state: GameStateSnapshot = INITIAL_GAME_STATE
) {
  return state.units
    .filter((unit) => unit.faction === "player" && unit.currentHp > 0)
    .map((unit, index) => ({
      unitId: unit.id,
      position: index === 0
        ? { x: 3, y: 8 }
        : index === 1
          ? { x: 1, y: 8 }
          : unit.position
    }));
}

describe("preparePlayerDeployment", () => {
  it("rearranges surviving player units among configured deployment tiles", () => {
    const result = preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      assignments()
    );

    expect(result.units.find((unit) => unit.id === "unit_001")?.position).toEqual({ x: 3, y: 8 });
    expect(result.units.find((unit) => unit.id === "unit_002")?.position).toEqual({ x: 1, y: 8 });
    expect(result.units.find((unit) => unit.id === "unit_003")?.position).toEqual({ x: 5, y: 8 });
    expect(result.units.find((unit) => unit.id === "enemy_001")?.position).toEqual(
      INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")?.position
    );
  });

  it("preserves progression, inventory, HP, RNG, and turn without consuming an action", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      rngState: 123456789,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001"
          ? {
              ...unit,
              level: 4,
              experience: 63,
              currentHp: 12,
              inventory: [...unit.inventory, "vulnerary"],
              hasMoved: false,
              hasActed: false
            }
          : unit
      )
    };
    const result = preparePlayerDeployment(state, CHAPTER_01_MAP, assignments(state));
    const unit = result.units.find((candidate) => candidate.id === "unit_001")!;

    expect(unit.level).toBe(4);
    expect(unit.experience).toBe(63);
    expect(unit.currentHp).toBe(12);
    expect(unit.inventory).toContain("vulnerary");
    expect(unit.hasMoved).toBe(false);
    expect(unit.hasActed).toBe(false);
    expect(result.rngState).toBe(123456789);
    expect(result.turn).toBe(1);
    expect(result.phase).toBe("player");
  });

  it("does not carry a zero-HP player into the prepared battle roster", () => {
    const state = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_002" ? { ...unit, currentHp: 0 } : unit
      )
    };
    const result = preparePlayerDeployment(state, CHAPTER_01_MAP, assignments(state));

    expect(result.units.some((unit) => unit.id === "unit_002")).toBe(false);
    expect(result.units.filter((unit) => unit.faction === "player")).toHaveLength(3);
  });

  it("requires one unique, valid slot for every surviving player unit", () => {
    const duplicatePosition = assignments();
    duplicatePosition[1] = {
      ...duplicatePosition[1]!,
      position: { ...duplicatePosition[0]!.position }
    };
    expect(() => preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      duplicatePosition
    )).toThrow(/unique configured player deployment tile/);

    expect(() => preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      assignments().slice(1)
    )).toThrow(/Every surviving player unit/);

    const invalidSlot = assignments();
    invalidSlot[0] = { ...invalidSlot[0]!, position: { x: 0, y: 0 } };
    expect(() => preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      invalidSlot
    )).toThrow(/unique configured player deployment tile/);
  });

  it("rejects an assignment for an unknown or duplicate unit", () => {
    const unknown = assignments();
    unknown[0] = { ...unknown[0]!, unitId: "not_deployed" };
    expect(() => preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      unknown
    )).toThrow(/surviving player unit exactly once/);

    const duplicate = assignments();
    duplicate[1] = { ...duplicate[1]!, unitId: duplicate[0]!.unitId };
    expect(() => preparePlayerDeployment(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      duplicate
    )).toThrow(/surviving player unit exactly once/);
  });

  it("moves non-selected survivors into reserves and allows a later redeployment", () => {
    const selectedIds = ["unit_001", "unit_003"];
    const benched = preparePlayerDeployment(INITIAL_GAME_STATE, CHAPTER_01_MAP, [
      { unitId: "unit_001", position: { x: 1, y: 8 } },
      { unitId: "unit_003", position: { x: 3, y: 8 } }
    ], selectedIds);
    expect(benched.units.filter((unit) => unit.faction === "player").map((unit) => unit.id)).toEqual(selectedIds);
    expect(benched.reserveUnits.map((unit) => unit.id).sort()).toEqual(["unit_002", "unit_004"]);

    const redeployed = preparePlayerDeployment(benched, CHAPTER_01_MAP, [
      { unitId: "unit_002", position: { x: 1, y: 8 } }
    ], ["unit_002"]);
    expect(redeployed.units.find((unit) => unit.id === "unit_002")).toMatchObject({
      faction: "player", position: { x: 1, y: 8 }, hasMoved: false, hasActed: false
    });
    expect(redeployed.reserveUnits.map((unit) => unit.id).sort()).toEqual(["unit_001", "unit_003"]);
  });

  it("requires at least one selected unit and keeps a critical target deployed", () => {
    expect(() => preparePlayerDeployment(INITIAL_GAME_STATE, CHAPTER_01_MAP, [], []))
      .toThrow(/At least one living player unit/);
    const map = { ...CHAPTER_01_MAP, defeatCondition: { type: "unit_defeated" as const, targetUnitId: "unit_001" } };
    expect(() => preparePlayerDeployment(INITIAL_GAME_STATE, map, [
      { unitId: "unit_002", position: { x: 1, y: 8 } }
    ], ["unit_002"])).toThrow(/critical player unit/);
  });

  it("rejects deployment after the first action, outside turn one, or outside player phase", () => {
    const actedState = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, hasActed: true } : unit
      )
    };
    expect(() => preparePlayerDeployment(
      actedState,
      CHAPTER_01_MAP,
      assignments()
    )).toThrow(/after a player unit has acted/);

    expect(() => preparePlayerDeployment(
      { ...INITIAL_GAME_STATE, turn: 2 },
      CHAPTER_01_MAP,
      assignments()
    )).toThrow(/before the first player phase action/);

    expect(() => preparePlayerDeployment(
      { ...INITIAL_GAME_STATE, phase: "enemy" },
      CHAPTER_01_MAP,
      assignments()
    )).toThrow(/before the first player phase action/);
  });

  it("rejects deployment after victory or defeat", () => {
    const victory = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player")
    };
    expect(() => preparePlayerDeployment(
      victory,
      CHAPTER_01_MAP,
      assignments(victory)
    )).toThrow(/battle has ended/);

    const defeat = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "enemy")
    };
    expect(() => preparePlayerDeployment(
      defeat,
      CHAPTER_01_MAP,
      []
    )).toThrow(/battle has ended/);
  });
});
