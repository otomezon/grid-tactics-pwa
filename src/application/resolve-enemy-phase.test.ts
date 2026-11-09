import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { beginEnemyPhase, runEnemyPhase } from "./resolve-enemy-phase";

function openMap(): GameMapDefinition {
  return {
    ...CHAPTER_01_MAP,
    terrain: Array.from({ length: 10 }, () =>
      Array.from({ length: 10 }, () => "plain" as const)
    )
  };
}

function mapWithFortAt(x: number, y: number): GameMapDefinition {
  const base = openMap();
  const terrain = base.terrain.map((row) => [...row]);
  terrain[y]![x] = "fort";
  return { ...base, terrain };
}

function battleState(
  units: GameStateSnapshot["units"],
  phase: "player" | "enemy" = "enemy"
): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    phase,
    units
  };
}

describe("enemy phase controller", () => {
  it("starts the enemy phase and rejects invalid phase transitions", () => {
    const started = beginEnemyPhase(INITIAL_GAME_STATE, CHAPTER_01_MAP);
    expect(started.nextState.phase).toBe("enemy");
    expect(() => beginEnemyPhase(started.nextState, CHAPTER_01_MAP)).toThrow("not active");
  });


  it("recovers enemy units on forts when the enemy phase begins", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      currentHp: 10
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 4, y: 4 },
      currentHp: 10
    };
    const started = beginEnemyPhase(
      battleState([player, enemy], "player"),
      mapWithFortAt(4, 4)
    );

    expect(started.nextState.units.find((unit) => unit.id === enemy.id)?.currentHp).toBe(12);
    expect(started.nextState.units.find((unit) => unit.id === player.id)?.currentHp).toBe(10);
    expect(started.fortRecoveries).toEqual([
      { unitId: enemy.id, unitName: enemy.name, recoveredHp: 2 }
    ]);
  });

  it("recovers player units when the next player phase begins", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 8 },
      currentHp: 10
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      hasActed: true
    };
    const result = runEnemyPhase(
      battleState([player, enemy]),
      mapWithFortAt(1, 8)
    );

    expect(result.nextState.phase).toBe("player");
    expect(result.nextState.units.find((unit) => unit.id === player.id)?.currentHp).toBe(12);
    expect(result.phaseStartRecoveries).toEqual([
      { unitId: player.id, unitName: player.name, recoveredHp: 2 }
    ]);
  });


  it("does not reapply enemy fort recovery when resuming a saved enemy phase", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      currentHp: 20
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 4, y: 4 },
      currentHp: 12,
      hasActed: true
    };
    const savedEnemyPhase = battleState([player, enemy], "enemy");
    const result = runEnemyPhase(savedEnemyPhase, mapWithFortAt(4, 4));

    expect(result.nextState.units.find((unit) => unit.id === enemy.id)?.currentHp).toBe(12);
  });

  it("attacks a player unit already in range and advances the round", () => {
    const initialPlayer = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const initialEnemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const state = battleState([
      { ...initialPlayer, position: { x: 1, y: 8 }, currentHp: 20 },
      { ...initialEnemy, position: { x: 1, y: 7 } }
    ]);
    const result = runEnemyPhase(state, openMap());

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.kind).toBe("attacked");
    expect(result.actions[0]?.targetId).toBe("unit_001");
    expect(result.nextState.phase).toBe("player");
    expect(result.nextState.turn).toBe(2);
    expect(result.nextState.rngState).not.toBe(state.rngState);
    expect(result.nextState.units.every((unit) => !unit.hasActed && !unit.hasMoved)).toBe(true);
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")?.currentHp).toBeLessThan(20);
  });

  it("moves toward the nearest player and attacks when reachable after moving", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 8 },
      currentHp: 20
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 2 }
    };
    const result = runEnemyPhase(battleState([player, enemy]), openMap());

    expect(result.actions[0]?.kind).toBe("moved-and-attacked");
    expect(result.actions[0]?.destination).toEqual({ x: 1, y: 7 });
    expect(result.nextState.phase).toBe("player");
    expect(result.nextState.turn).toBe(2);
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")?.currentHp).toBeLessThan(20);
  });

  it("uses lexical ID order for enemy actions", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 4 },
      currentHp: 40,
      stats: { ...INITIAL_GAME_STATE.units[0]!.stats, hp: 40 }
    };
    const enemyOne = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      id: "enemy_010",
      name: "Enemy 10",
      position: { x: 4, y: 3 }
    };
    const enemyTwo = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_003")!,
      id: "enemy_002",
      name: "Enemy 2",
      position: { x: 5, y: 4 }
    };
    const result = runEnemyPhase(battleState([player, enemyOne, enemyTwo]), openMap());

    expect(result.actions.map((action) => action.enemyId)).toEqual(["enemy_002", "enemy_010"]);
  });

  it("stops the phase immediately when all player units are defeated", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 8 },
      currentHp: 1
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 7 },
      stats: {
        ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!.stats,
        strength: 100,
        skill: 100
      }
    };
    const result = runEnemyPhase(battleState([player, enemy]), openMap());

    expect(result.outcome).toBe("defeat");
    expect(result.actions).toHaveLength(1);
    expect(result.nextState.phase).toBe("enemy");
    expect(result.nextState.turn).toBe(1);
    expect(result.nextState.units.some((unit) => unit.faction === "player")).toBe(false);
  });

  it("rejects execution outside the enemy phase", () => {
    expect(() => runEnemyPhase(INITIAL_GAME_STATE, openMap())).toThrow("not active");
  });

  it("returns a deterministic result for the same enemy-phase snapshot", () => {
    const state = battleState(
      INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "enemy_001" ? { ...unit, position: { x: 1, y: 7 } } : unit
      )
    );
    expect(runEnemyPhase(state, CHAPTER_01_MAP)).toEqual(runEnemyPhase(state, CHAPTER_01_MAP));
  });
});
