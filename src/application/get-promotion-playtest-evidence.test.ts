import { describe, expect, it } from "vitest";
import type { GameStateSnapshot } from "../domain/models/game";
import { getPromotionPlaytestEvidence } from "./get-promotion-playtest-evidence";

describe("getPromotionPlaytestEvidence", () => {
  it("summarizes persisted campaign and selected-unit records without inferring missing events", () => {
    const snapshot = {
      campaignBattleLog: [
        {
          sequence: 1,
          chapterId: "chapter_01_map",
          turn: 2,
          kind: "player-action",
          action: "movement",
          actorId: "unit-1",
          actorName: "Ally",
          detail: "Moved"
        },
        {
          sequence: 2,
          chapterId: "chapter_01_map",
          turn: 2,
          kind: "player-attack",
          attackerId: "unit-1",
          attackerName: "Ally",
          defenderId: "enemy-1",
          defenderName: "Enemy",
          defenderRemainingHp: 8,
          experienceAwarded: 10,
          strikes: [
            {
              actorId: "unit-1",
              actorName: "Ally",
              targetId: "enemy-1",
              targetName: "Enemy",
              kind: "initial",
              weaponName: "Iron Sword",
              outcome: "hit",
              damage: 5,
              targetHpBefore: 13,
              targetHpAfter: 8
            }
          ]
        },
        {
          sequence: 3,
          chapterId: "chapter_01_map",
          turn: 2,
          kind: "enemy-action",
          enemyId: "enemy-1",
          enemyName: "Enemy",
          actionKind: "attacked",
          targetId: "unit-1",
          targetName: "Ally",
          strikes: []
        },
        {
          sequence: 4,
          chapterId: "chapter_02_map",
          turn: 5,
          kind: "chapter-result",
          outcome: "victory",
          objective: "defeat_all",
          reason: "objective-cleared",
          livingPlayerCount: 2,
          livingEnemyCount: 0
        }
      ],
      campaignUnitBattleRecords: [
        {
          unitId: "unit-1",
          unitName: "Ally",
          attacks: 1,
          strikes: 1,
          hits: 1,
          misses: 0,
          criticalHits: 0,
          damageDealt: 5,
          enemiesDefeated: 0,
          experienceAwarded: 10,
          levelUps: 0,
          statGains: {
            hp: 0,
            strength: 0,
            magic: 0,
            skill: 0,
            speed: 0,
            luck: 0,
            defense: 0,
            resistance: 0
          }
        }
      ]
    } as unknown as GameStateSnapshot;

    expect(getPromotionPlaytestEvidence(snapshot, "unit-1", 10)).toEqual({
      campaignLogTrackingAvailable: true,
      unitBattleTotalsTrackingAvailable: true,
      campaignLogEntries: 4,
      campaignChapterCount: 2,
      playerActionEntries: 1,
      playerAttackEntries: 1,
      enemyActionEntries: 1,
      chapterResultEntries: 1,
      selectedUnitActionEntries: 1,
      selectedUnitAttackEntries: 1,
      selectedUnitTargetedEnemyActionEntries: 1,
      selectedUnitAttackStrikes: 1,
      selectedUnitBattleTotals: {
        attacks: 1,
        strikes: 1,
        hits: 1,
        damageDealt: 5,
        enemiesDefeated: 0,
        experienceAwarded: 10
      }
    });
  });

  it("reports tracking coverage separately from an empty history", () => {
    const snapshot = {
      campaignBattleLog: [],
      campaignUnitBattleRecords: []
    } as unknown as GameStateSnapshot;

    expect(getPromotionPlaytestEvidence(snapshot, "unit-1", 1)).toEqual({
      campaignLogTrackingAvailable: false,
      unitBattleTotalsTrackingAvailable: false,
      campaignLogEntries: 0,
      campaignChapterCount: 0,
      playerActionEntries: 0,
      playerAttackEntries: 0,
      enemyActionEntries: 0,
      chapterResultEntries: 0,
      selectedUnitActionEntries: 0,
      selectedUnitAttackEntries: 0,
      selectedUnitTargetedEnemyActionEntries: 0,
      selectedUnitAttackStrikes: 0,
      selectedUnitBattleTotals: null
    });

    const currentTotalsOnly = getPromotionPlaytestEvidence(snapshot, "unit-1", 8);
    expect(currentTotalsOnly.campaignLogTrackingAvailable).toBe(false);
    expect(currentTotalsOnly.unitBattleTotalsTrackingAvailable).toBe(true);
  });
});
