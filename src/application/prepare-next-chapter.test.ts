import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameMapDefinition, GameStateSnapshot } from "../domain/models/game";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import { prepareNextChapter } from "./prepare-next-chapter";
import { preparePlayerDeployment } from "./prepare-player-deployment";
import { resolveMapEvents } from "./resolve-map-events";

function nextChapterFixture(): { map: GameMapDefinition; state: GameStateSnapshot } {
  const map: GameMapDefinition = {
    ...CHAPTER_01_MAP,
    id: "chapter_02_map",
    playerDeployment: CHAPTER_01_MAP.playerDeployment.map((deployment, index) => ({
      ...deployment,
      x: index,
      y: 9
    }))
  };
  return {
    map,
    state: { ...INITIAL_GAME_STATE, chapterId: map.id }
  };
}

function clearedState(overrides: Partial<GameStateSnapshot> = {}): GameStateSnapshot {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.filter((unit) => unit.faction === "player"),
    ...overrides
  };
}

describe("prepareNextChapter", () => {
  it("carries player progression and inventory into the next map deployment", () => {
    const previousState = clearedState({
      campaignUnitBattleRecords: [{
        unitId: "unit_001",
        unitName: "主人公",
        attacks: 3,
        strikes: 5,
        hits: 4,
        misses: 1,
        criticalHits: 1,
        damageDealt: 31,
        enemiesDefeated: 2,
        experienceAwarded: 70,
        levelUps: 1,
        statGains: { hp: 1, strength: 1, magic: 0, skill: 0, speed: 0, luck: 0, defense: 0, resistance: 0 }
      }],
      units: INITIAL_GAME_STATE.units
        .filter((unit) => unit.faction === "player")
        .map((unit) => unit.id === "unit_001"
          ? {
              ...unit,
              level: 12,
              experience: 42,
              stats: { ...unit.stats, hp: 27, strength: 11 },
              currentHp: 9,
              inventory: [...unit.inventory, "healing_potion"]
            }
          : unit)
    });
    const next = nextChapterFixture();
    const result = prepareNextChapter({
      previousState,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: next.state,
      nextMap: next.map,
      currentHpPolicy: "preserve"
    });
    const carried = result.units.find((unit) => unit.id === "unit_001")!;

    expect(result.chapterId).toBe("chapter_02_map");
    expect(result.turn).toBe(1);
    expect(result.phase).toBe("player");
    expect(result.rngState).toBe(next.state.rngState);
    expect(carried.position).toEqual({ x: 0, y: 9 });
    expect(carried.level).toBe(12);
    expect(carried.experience).toBe(42);
    expect(carried.stats).toEqual({ ...previousState.units[0]!.stats, hp: 27, strength: 11 });
    expect(carried.currentHp).toBe(9);
    expect(carried.inventory).toContain("healing_potion");
    expect(carried.hasMoved).toBe(false);
    expect(carried.hasActed).toBe(false);
    expect(result.campaignUnitBattleRecords).toEqual(previousState.campaignUnitBattleRecords);
    expect(result.campaignUnitBattleRecords).not.toBe(previousState.campaignUnitBattleRecords);
    expect(isValidGameStateSnapshot(result, next.map)).toBe(true);
  });

  it("restores carried units to their new maximum HP only when the policy requests it", () => {
    const previousState = clearedState({
      units: INITIAL_GAME_STATE.units
        .filter((unit) => unit.faction === "player")
        .map((unit) => unit.id === "unit_001"
          ? { ...unit, stats: { ...unit.stats, hp: 27 }, currentHp: 9 }
          : unit)
    });
    const next = nextChapterFixture();
    const result = prepareNextChapter({
      previousState,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: next.state,
      nextMap: next.map,
      currentHpPolicy: "restore"
    });

    expect(result.units.find((unit) => unit.id === "unit_001")?.currentHp).toBe(27);
  });

  it("does not bring back a player unit that was defeated in the previous chapter", () => {
    const previousState = clearedState({
      units: INITIAL_GAME_STATE.units.filter(
        (unit) => unit.faction === "player" && unit.id !== "unit_002"
      )
    });
    const next = nextChapterFixture();
    const result = prepareNextChapter({
      previousState,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: next.state,
      nextMap: next.map,
      currentHpPolicy: "preserve"
    });

    expect(result.units.some((unit) => unit.id === "unit_002")).toBe(false);
  });

  it("includes a newly introduced player unit from the next chapter template", () => {
    const next = nextChapterFixture();
    const newUnit = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      id: "unit_005",
      name: "新加入",
      position: { x: 4, y: 9 }
    };
    const nextMap = {
      ...next.map,
      playerDeployment: [...next.map.playerDeployment, { unitId: "unit_005", x: 4, y: 9 }]
    };
    const nextState = { ...next.state, units: [...next.state.units, newUnit] };
    const result = prepareNextChapter({
      previousState: clearedState(),
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: nextState,
      nextMap,
      currentHpPolicy: "preserve"
    });

    expect(result.units.find((unit) => unit.id === "unit_005")?.name).toBe("新加入");
    expect(result.units.find((unit) => unit.id === "unit_005")?.position).toEqual({ x: 4, y: 9 });
  });

  it("carries a living reserve member into the next chapter without deploying them", () => {
    const reserved = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_003")!;
    const previousState = clearedState({
      units: INITIAL_GAME_STATE.units.filter((unit) =>
        unit.faction === "player" && unit.id !== "unit_003"
      ),
      reserveUnits: [{
        id: reserved.id,
        name: reserved.name,
        classId: reserved.classId,
        level: 7,
        experience: 31,
        stats: { ...reserved.stats, hp: 25, strength: 9 },
        growthRates: { ...reserved.growthRates },
        currentHp: 13,
        movementType: reserved.movementType,
        move: reserved.move,
        usableWeaponTypes: [...reserved.usableWeaponTypes],
        inventory: [...reserved.inventory, "healing_potion"],
        equippedWeaponId: reserved.equippedWeaponId
      }]
    });
    const next = nextChapterFixture();
    const result = prepareNextChapter({
      previousState,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: next.state,
      nextMap: next.map,
      currentHpPolicy: "preserve"
    });
    expect(result.units.some((unit) => unit.id === "unit_003")).toBe(false);
    expect(result.reserveUnits.find((unit) => unit.id === "unit_003")).toMatchObject({
      level: 7,
      experience: 31,
      stats: { hp: 25, strength: 9 },
      currentHp: 13,
      inventory: [...reserved.inventory, "healing_potion"]
    });
    expect(isValidGameStateSnapshot(result, next.map)).toBe(true);
  });

  it("takes enemies and the RNG seed from the next chapter template", () => {
    const next = nextChapterFixture();
    const result = prepareNextChapter({
      previousState: clearedState(),
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: { ...next.state, rngState: 123456789 },
      nextMap: next.map,
      currentHpPolicy: "preserve"
    });

    expect(result.units.filter((unit) => unit.faction === "enemy").map((unit) => unit.id)).toEqual(
      next.map.enemyDeployment.map((deployment) => deployment.unitId)
    );
    expect(result.rngState).toBe(123456789);
    expect(result.units.every((unit) => !unit.hasMoved && !unit.hasActed)).toBe(true);
  });

  it("rejects a transition before victory", () => {
    const next = nextChapterFixture();
    expect(() => prepareNextChapter({
      previousState: INITIAL_GAME_STATE,
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: next.state,
      nextMap: next.map,
      currentHpPolicy: "preserve"
    })).toThrow(/only begin after a chapter victory/);
  });

  it("rejects an invalid next chapter template", () => {
    const next = nextChapterFixture();
    expect(() => prepareNextChapter({
      previousState: clearedState(),
      previousMap: CHAPTER_01_MAP,
      nextChapterInitialState: { ...next.state, turn: 2 },
      nextMap: next.map,
      currentHpPolicy: "preserve"
    })).toThrow(/player-phase turn 1/);
  });

  it("carries an event-recruited reserve into the next chapter and allows deployment", () => {
    const source = INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!;
    const { faction: _faction, position: _position, hasMoved: _hasMoved, hasActed: _hasActed, ...campaignData } = source;
    const recruit = {
      ...campaignData,
      id: "recruit_001",
      name: "加入候補"
    };
    const previousMap: GameMapDefinition = {
      ...CHAPTER_01_MAP,
      events: [{
        id: "unit-recruitment",
        trigger: { type: "unit-interacts", x: 9, y: 8, label: "加入地点" },
        action: { type: "recruit-unit", unit: recruit, text: "加入しました。" }
      }]
    };
    const joined = resolveMapEvents(INITIAL_GAME_STATE, previousMap, {
      type: "unit-interacts", x: 9, y: 8, label: "加入地点", unitId: "unit_004"
    }).nextState;
    const afterVictory: GameStateSnapshot = {
      ...joined,
      units: joined.units.filter((unit) => unit.faction === "player")
    };
    const next = nextChapterFixture();
    const nextMap: GameMapDefinition = {
      ...next.map,
      playerDeployment: [...next.map.playerDeployment, { unitId: recruit.id, x: 4, y: 9 }]
    };
    const carried = prepareNextChapter({
      previousState: afterVictory,
      previousMap,
      nextChapterInitialState: next.state,
      nextMap,
      currentHpPolicy: "preserve"
    });
    expect(carried.reserveUnits.find((unit) => unit.id === recruit.id)?.name).toBe("加入候補");
    expect(isValidGameStateSnapshot(carried, nextMap)).toBe(true);

    const deployed = preparePlayerDeployment(
      carried,
      nextMap,
      [
        { unitId: "unit_001", position: { x: 0, y: 9 } },
        { unitId: recruit.id, position: { x: 4, y: 9 } }
      ],
      ["unit_001", recruit.id]
    );
    expect(deployed.reserveUnits.some((unit) => unit.id === recruit.id)).toBe(false);
    expect(deployed.units.find((unit) => unit.id === recruit.id)).toMatchObject({
      faction: "player",
      name: "加入候補",
      hasMoved: false,
      hasActed: false
    });
    expect(isValidGameStateSnapshot(deployed, nextMap)).toBe(true);
  });

});
