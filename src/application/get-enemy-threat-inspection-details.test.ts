import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { getEnemyThreatInspectionDetails } from "./get-enemy-threat-inspection-details";

describe("getEnemyThreatInspectionDetails", () => {
  it("projects enemy, weapon, and current/post-move attack positions for the inspected tile", () => {
    const player = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
      position: { x: 4, y: 1 }
    };
    const enemy = {
      ...INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
      position: { x: 1, y: 1 },
      move: 2
    };
    const state = { ...INITIAL_GAME_STATE, phase: "player" as const, units: [player, enemy] };

    const details = getEnemyThreatInspectionDetails(state, {
      ...CHAPTER_01_MAP,
      width: 6,
      height: 4,
      terrain: Array.from({ length: 4 }, () => Array.from({ length: 6 }, () => "plain" as const))
    }, { x: 3, y: 0 });

    expect(details).toMatchObject({
      targetCoordinate: "4列・1行",
      sourceCount: 1,
      attackOriginCount: 2,
      sources: [{
        enemyId: "enemy_001",
        enemyName: "敵01",
        enemyClassName: "戦士",
        enemyLevel: 1,
        enemyPositionLabel: "2列・2行",
        weaponName: "試作の鉄の斧",
        weaponTypeLabel: "斧",
        damageTypeLabel: "物理",
        minRange: 1,
        maxRange: 1,
        attackOrigins: [
          { label: "3列・1行", distance: 1, isCurrentPosition: false },
          { label: "4列・2行", distance: 1, isCurrentPosition: false }
        ]
      }]
    });
  });

  it("returns an empty source list for a safe tile and null when no tile can be inspected", () => {
    expect(getEnemyThreatInspectionDetails(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      { x: 0, y: 9 }
    )).toMatchObject({ sourceCount: 0, attackOriginCount: 0, sources: [] });

    expect(getEnemyThreatInspectionDetails(
      INITIAL_GAME_STATE,
      CHAPTER_01_MAP,
      null
    )).toBeNull();
  });

  it("does not show upcoming enemy threats during the enemy phase", () => {
    expect(getEnemyThreatInspectionDetails(
      { ...INITIAL_GAME_STATE, phase: "enemy" },
      CHAPTER_01_MAP,
      { x: 3, y: 0 }
    )).toBeNull();
  });
});
