import { describe, expect, it } from "vitest";
import { WEAPONS_BY_ID } from "../../content/weapons";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../../content/maps/chapter-01";
import type { GameMapDefinition, GameStateSnapshot, GameUnit, Position } from "../models/game";
import { calculateEnemyThreatSourcesAtPosition, calculateEnemyThreatenedTiles } from "./calculate-enemy-threatened-tiles";

function openMap(width = 6, height = 4): GameMapDefinition {
  return {
    ...CHAPTER_01_MAP,
    width,
    height,
    terrain: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => "plain" as const)
    )
  };
}

function playerPhase(units: GameUnit[]): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    phase: "player",
    units
  };
}

function containsPosition(positions: Position[], target: Position): boolean {
  return positions.some((position) => position.x === target.x && position.y === target.y);
}

describe("calculateEnemyThreatenedTiles", () => {
  it("includes tiles threatened after a legal enemy move as well as from its current position", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 2
    };

    const threatened = calculateEnemyThreatenedTiles(playerPhase([player, enemy]), openMap(), WEAPONS_BY_ID);

    expect(containsPosition(threatened, player.position)).toBe(true);
    expect(containsPosition(threatened, { x: 5, y: 1 })).toBe(false);
    expect(containsPosition(threatened, enemy.position)).toBe(false);
    expect(threatened).toEqual([...threatened].sort((left, right) =>
      left.y - right.y || left.x - right.x
    ));
  });

  it("does not project attacks through a unit that blocks enemy movement", () => {
    const target = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const blocker = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_002")!,
      id: "unit_blocker",
      position: { x: 2, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 3
    };

    const threatened = calculateEnemyThreatenedTiles(
      playerPhase([target, blocker, enemy]),
      openMap(),
      WEAPONS_BY_ID
    );

    expect(containsPosition(threatened, target.position)).toBe(false);
    expect(containsPosition(threatened, blocker.position)).toBe(true);
  });

  it("respects a weapon's minimum range", () => {
    const adjacentPlayer = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 2, y: 1 }
    };
    const distantPlayer = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_003")!,
      position: { x: 3, y: 1 }
    };
    const archer = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_002")!,
      position: { x: 1, y: 1 },
      move: 0
    };

    const threatened = calculateEnemyThreatenedTiles(
      playerPhase([adjacentPlayer, distantPlayer, archer]),
      openMap(),
      WEAPONS_BY_ID
    );

    expect(containsPosition(threatened, adjacentPlayer.position)).toBe(false);
    expect(containsPosition(threatened, distantPlayer.position)).toBe(true);
  });

  it("ignores defeated, already-acted, and unequipped enemies", () => {
    const player = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;

    expect(calculateEnemyThreatenedTiles(
      playerPhase([{ ...player, position: { x: 2, y: 1 } }, { ...enemy, currentHp: 0 }]),
      openMap(),
      WEAPONS_BY_ID
    )).toEqual([]);

    expect(calculateEnemyThreatenedTiles(
      playerPhase([{ ...player, position: { x: 2, y: 1 } }, { ...enemy, hasActed: true }]),
      openMap(),
      WEAPONS_BY_ID
    )).toEqual([]);

    expect(calculateEnemyThreatenedTiles(
      playerPhase([{ ...player, position: { x: 2, y: 1 } }, { ...enemy, equippedWeaponId: null }]),
      openMap(),
      WEAPONS_BY_ID
    )).toEqual([]);
  });

  it("includes the enemy's current attack range when it cannot move", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 1, y: 0 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 0
    };

    const threatened = calculateEnemyThreatenedTiles(
      playerPhase([player, enemy]),
      openMap(),
      WEAPONS_BY_ID
    );

    expect(containsPosition(threatened, player.position)).toBe(true);
  });

  it("does not expose an upcoming-phase preview during the enemy phase", () => {
    const player = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const state = { ...playerPhase([player, enemy]), phase: "enemy" as const };

    expect(calculateEnemyThreatenedTiles(state, openMap(), WEAPONS_BY_ID)).toEqual([]);
  });

  it("attributes a threatened tile to the enemy weapon and every legal post-move attack origin", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 2
    };
    const state = playerPhase([player, enemy]);

    const sources = calculateEnemyThreatSourcesAtPosition(
      state,
      openMap(),
      WEAPONS_BY_ID,
      { x: 3, y: 0 }
    );

    expect(sources).toHaveLength(1);
    expect(sources[0]).toMatchObject({
      enemyId: "enemy_001",
      enemyName: "敵01",
      weaponId: "iron_axe",
      weaponName: "試作の鉄の斧",
      weaponType: "axe",
      damageType: "physical",
      minRange: 1,
      maxRange: 1
    });
    expect(sources[0]?.attackOrigins).toEqual([
      { position: { x: 2, y: 0 }, distance: 1, isCurrentPosition: false },
      { position: { x: 3, y: 1 }, distance: 1, isCurrentPosition: false }
    ]);
    expect(containsPosition(
      calculateEnemyThreatenedTiles(state, openMap(), WEAPONS_BY_ID),
      { x: 3, y: 0 }
    )).toBe(true);
  });

  it("marks an in-range current position separately from possible move positions", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 2, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 0
    };

    const sources = calculateEnemyThreatSourcesAtPosition(
      playerPhase([player, enemy]),
      openMap(),
      WEAPONS_BY_ID,
      player.position
    );

    expect(sources[0]?.attackOrigins).toEqual([
      { position: { x: 1, y: 1 }, distance: 1, isCurrentPosition: true }
    ]);
  });

  it("lists multiple threat sources in stable enemy ID order with their own weapons", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const firstEnemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 3, y: 1 },
      move: 0
    };
    const secondEnemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_002")!,
      position: { x: 2, y: 1 },
      move: 0
    };

    const sources = calculateEnemyThreatSourcesAtPosition(
      playerPhase([player, secondEnemy, firstEnemy]),
      openMap(),
      WEAPONS_BY_ID,
      player.position
    );

    expect(sources.map((source) => ({
      enemyId: source.enemyId,
      weaponId: source.weaponId
    }))).toEqual([
      { enemyId: "enemy_001", weaponId: "iron_axe" },
      { enemyId: "enemy_002", weaponId: "short_bow" }
    ]);
  });

  it("returns no sources for an enemy-occupied, out-of-map, or unthreatened tile", () => {
    const player = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const enemy = INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!;
    const state = playerPhase([player, enemy]);

    expect(calculateEnemyThreatSourcesAtPosition(
      state, openMap(), WEAPONS_BY_ID, enemy.position
    )).toEqual([]);
    expect(calculateEnemyThreatSourcesAtPosition(
      state, openMap(), WEAPONS_BY_ID, { x: 6, y: 1 }
    )).toEqual([]);
    const noThreatState = playerPhase([player, { ...enemy, move: 0 }]);
    expect(calculateEnemyThreatSourcesAtPosition(
      noThreatState, openMap(), WEAPONS_BY_ID, { x: 5, y: 3 }
    )).toEqual([]);
    expect(calculateEnemyThreatSourcesAtPosition(
      { ...state, phase: "enemy" }, openMap(), WEAPONS_BY_ID, { x: 2, y: 1 }
    )).toEqual([]);
  });


  it("keeps per-tile source attribution consistent with the aggregate threatened-tile overlay", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 2
    };
    const state = playerPhase([player, enemy]);
    const map = openMap();
    const threatened = calculateEnemyThreatenedTiles(state, map, WEAPONS_BY_ID);

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const sources = calculateEnemyThreatSourcesAtPosition(
          state, map, WEAPONS_BY_ID, { x, y }
        );
        expect(sources.length > 0).toBe(containsPosition(threatened, { x, y }));
      }
    }
  });

});
