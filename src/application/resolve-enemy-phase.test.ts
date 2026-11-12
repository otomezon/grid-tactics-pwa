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
    expect(result.actions[0]?.movementReason).toEqual({
      kind: "attack-after-move",
      targetId: player.id,
      targetName: player.name
    });
    expect(result.actions[0]?.message).toContain("移動後に攻撃可能な位置を優先");
    expect(result.nextState.phase).toBe("player");
    expect(result.nextState.turn).toBe(2);
    expect(result.nextState.units.find((unit) => unit.id === "unit_001")?.currentHp).toBeLessThan(20);
  });

  it("explains the nearest-player distance used for approach movement", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 8 },
      currentHp: 20
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 2 },
      move: 2
    };
    const result = runEnemyPhase(battleState([player, enemy]), openMap());
    const action = result.actions[0];

    expect(action?.kind).toBe("moved");
    expect(action?.destination).toEqual({ x: 1, y: 4 });
    expect(action?.movementReason).toEqual({
      kind: "approach-player",
      nearestPlayerDistanceBefore: 6,
      nearestPlayerDistanceAfter: 4
    });
    expect(action?.message).toContain("最寄りの味方との距離 6→4");
    expect(action?.message).toContain("同距離候補は地形評価で比較");
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
    const baseMap = openMap();
    const map: GameMapDefinition = {
      ...baseMap,
      enemyDeployment: baseMap.enemyDeployment
        .filter((deployment) => deployment.unitId !== "enemy_002")
        .map((deployment) =>
          deployment.unitId === "enemy_001"
            ? { ...deployment, unitId: "enemy_010" }
            : deployment.unitId === "enemy_003"
              ? { ...deployment, unitId: "enemy_002" }
              : deployment
        )
    };
    const result = runEnemyPhase(battleState([player, enemyOne, enemyTwo]), map);

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

  it("prioritizes a ranged-attacker role when otherwise equivalent targets are both in range", () => {
    const basePlayer = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const secondPlayer = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_002")!;
    const baseEnemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const sharedPlayerStats = { ...basePlayer.stats, hp: 20, strength: 6, skill: 7, speed: 8, luck: 4, defense: 5, resistance: 1 };
    const sharedPlayerWeapon = {
      ...basePlayer,
      stats: sharedPlayerStats,
      currentHp: 20,
      usableWeaponTypes: ["sword" as const],
      inventory: ["iron_sword"],
      equippedWeaponId: "iron_sword",
      hasMoved: false,
      hasActed: false
    };
    const frontline = {
      ...sharedPlayerWeapon,
      id: "unit_001",
      name: "Frontline",
      classId: "swordsman",
      position: { x: 4, y: 4 }
    };
    const ranged = {
      ...sharedPlayerWeapon,
      id: secondPlayer.id,
      name: "Ranged",
      classId: "archer",
      position: { x: 5, y: 5 }
    };
    const enemy = {
      ...baseEnemy,
      position: { x: 4, y: 5 },
      hasMoved: false,
      hasActed: false
    };

    const result = runEnemyPhase(battleState([frontline, ranged, enemy]), openMap());
    const action = result.actions[0];

    expect(action?.targetId).toBe("unit_002");
    expect(action?.targetRoles).toEqual(["ranged-attacker"]);
    expect(action?.targetRolePriorityBonus).toBe(35);
    expect(action?.message).toContain("遠距離攻撃役を優先 +35点");
    expect(action?.targetEvaluations).toHaveLength(2);
    expect(action?.targetEvaluations?.[0]?.targetId).toBe("unit_002");
    expect(action?.targetEvaluations?.[0]?.scoreBreakdown.rolePriorityBonus).toBe(35);
    expect(action?.targetEvaluations?.[1]?.targetId).toBe("unit_001");
    expect(action?.targetEvaluations?.[1]?.scoreBreakdown.rolePriorityBonus).toBe(0);
    const selected = action?.targetEvaluations?.[0]?.scoreBreakdown;
    const alternative = action?.targetEvaluations?.[1]?.scoreBreakdown;
    expect(selected?.totalScore).toBe(alternative!.totalScore + 35);
    expect(selected?.totalScore).toBe(selected!.killBonus + selected!.triangleBonus +
      selected!.lowHpBonus + selected!.expectedDamageBonus - selected!.counterDamagePenalty -
      selected!.counterLethalPenalty + selected!.rolePriorityBonus);
  });

  it("keeps lexical target tie-breaking for classes without a tactical role", () => {
    const basePlayer = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const secondPlayer = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_002")!;
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const player = {
      ...basePlayer,
      position: { x: 4, y: 4 },
      currentHp: 20,
      usableWeaponTypes: ["sword" as const],
      inventory: ["iron_sword"],
      equippedWeaponId: "iron_sword"
    };
    const second = {
      ...player,
      id: secondPlayer.id,
      name: "Second",
      classId: "mercenary",
      position: { x: 5, y: 5 }
    };
    const attacker = { ...enemy, position: { x: 4, y: 5 } };

    const result = runEnemyPhase(battleState([player, second, attacker]), openMap());

    expect(result.actions[0]?.targetId).toBe("unit_001");
    expect(result.actions[0]?.targetRoles).toBeUndefined();
    expect(result.actions[0]?.targetRolePriorityBonus).toBeUndefined();
    expect(result.actions[0]?.targetEvaluations?.map((candidate) => candidate.targetId)).toEqual(["unit_001", "unit_002"]);
    expect(result.actions[0]?.targetEvaluations?.every(
      (candidate) => candidate.scoreBreakdown.rolePriorityBonus === 0
    )).toBe(true);
  });

});
