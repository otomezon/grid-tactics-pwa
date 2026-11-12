import { describe, expect, it } from "vitest";
import type { PlayerAttackReport } from "./get-player-attack-report";
import { getBattleContributionDetails } from "./get-battle-contribution-details";

function attackReport(overrides: Partial<PlayerAttackReport> = {}): PlayerAttackReport {
  return {
    attackerId: "unit_001",
    defenderId: "enemy_001",
    attackerName: "味方01",
    defenderName: "敵01",
    defenderDefeated: true,
    defenderRemainingHp: 0,
    experienceAwarded: 30,
    levelUps: [{
      previousLevel: 1,
      newLevel: 2,
      gains: { hp: 1, strength: 1 }
    }],
    strikes: [
      {
        actorId: "unit_001",
        targetId: "enemy_001",
        kind: "initial",
        kindLabel: "先制攻撃",
        actorName: "味方01",
        targetName: "敵01",
        weaponName: "試作の鉄の剣",
        outcome: "hit",
        damage: 8,
        targetHpBefore: 20,
        targetHpAfter: 12,
        hitRate: 100,
        criticalRate: 0
      },
      {
        actorId: "enemy_001",
        targetId: "unit_001",
        kind: "counter",
        kindLabel: "反撃",
        actorName: "敵01",
        targetName: "味方01",
        weaponName: "試作の鉄の斧",
        outcome: "critical",
        damage: 4,
        targetHpBefore: 20,
        targetHpAfter: 16,
        hitRate: 80,
        criticalRate: 5
      },
      {
        actorId: "unit_001",
        targetId: "enemy_001",
        kind: "follow-up",
        kindLabel: "追撃",
        actorName: "味方01",
        targetName: "敵01",
        weaponName: "試作の鉄の剣",
        outcome: "critical",
        damage: 6,
        targetHpBefore: 12,
        targetHpAfter: 0,
        hitRate: 100,
        criticalRate: 10
      }
    ],
    ...overrides
  };
}

describe("getBattleContributionDetails", () => {
  it("aggregates actual player strikes and excludes enemy counterattacks", () => {
    const reports = [
      attackReport(),
      attackReport({
        defenderId: "enemy_002",
        defenderName: "敵02",
        defenderDefeated: false,
        defenderRemainingHp: 6,
        experienceAwarded: 0,
        levelUps: [],
        strikes: [{
          actorId: "unit_001",
          targetId: "enemy_002",
          kind: "initial",
          kindLabel: "先制攻撃",
          actorName: "味方01",
          targetName: "敵02",
          weaponName: "試作の鉄の剣",
          outcome: "miss",
          damage: 0,
          targetHpBefore: 20,
          targetHpAfter: 20,
          hitRate: 25,
          criticalRate: 0
        }]
      }),
      attackReport({
        attackerId: "unit_003",
        attackerName: "味方03",
        defenderId: "enemy_003",
        defenderName: "敵03",
        defenderDefeated: false,
        defenderRemainingHp: 10,
        experienceAwarded: 10,
        levelUps: [],
        strikes: [{
          actorId: "unit_003",
          targetId: "enemy_003",
          kind: "initial",
          kindLabel: "先制攻撃",
          actorName: "味方03",
          targetName: "敵03",
          weaponName: "試作の鉄の槍",
          outcome: "hit",
          damage: 3,
          targetHpBefore: 13,
          targetHpAfter: 10,
          hitRate: 75,
          criticalRate: 0
        }]
      })
    ];
    const original = structuredClone(reports);

    const entries = getBattleContributionDetails(reports);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      unitId: "unit_001",
      unitName: "味方01",
      attacks: 2,
      strikes: 3,
      hits: 2,
      misses: 1,
      criticalHits: 1,
      damageDealt: 14,
      enemiesDefeated: 1,
      experienceAwarded: 30,
      levelUps: 1,
      statGains: {
        hp: 1,
        strength: 1,
        magic: 0,
        skill: 0,
        speed: 0,
        luck: 0,
        defense: 0,
        resistance: 0
      }
    });
    expect(entries[1]).toMatchObject({
      unitId: "unit_003",
      unitName: "味方03",
      attacks: 1,
      strikes: 1,
      hits: 1,
      misses: 0,
      damageDealt: 3,
      experienceAwarded: 10
    });
    expect(reports).toEqual(original);
  });

  it("returns an empty list when this session has no player attack records", () => {
    expect(getBattleContributionDetails([])).toEqual([]);
  });
});
