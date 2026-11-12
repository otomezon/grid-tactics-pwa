import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { PlayerBattleRecordInput } from "./record-player-battle-contribution";
import { recordPlayerBattleContribution } from "./record-player-battle-contribution";

function contribution(overrides: Partial<PlayerBattleRecordInput> = {}): PlayerBattleRecordInput {
  return {
    attacker: { id: "unit_001", name: "味方01" },
    defenderId: "enemy_001",
    defenderDefeated: true,
    result: {
      attackerHp: 16,
      defenderHp: 0,
      consumedRolls: 3,
      events: [
        {
          kind: "initial", attackerId: "unit_001", defenderId: "enemy_001",
          weaponId: "iron_sword", hit: true, critical: false, damage: 8,
          defenderHpBefore: 20, defenderHpAfter: 12, hitRate: 90, criticalRate: 5
        },
        {
          kind: "counter", attackerId: "enemy_001", defenderId: "unit_001",
          weaponId: "iron_axe", hit: true, critical: true, damage: 4,
          defenderHpBefore: 20, defenderHpAfter: 16, hitRate: 70, criticalRate: 10
        },
        {
          kind: "follow-up", attackerId: "unit_001", defenderId: "enemy_001",
          weaponId: "iron_sword", hit: true, critical: true, damage: 12,
          defenderHpBefore: 12, defenderHpAfter: 0, hitRate: 95, criticalRate: 5
        }
      ]
    },
    experienceAwarded: 30,
    levelUps: [{
      previousLevel: 1,
      newLevel: 2,
      gains: { hp: 1, strength: 1 }
    }],
    ...overrides
  };
}

describe("recordPlayerBattleContribution", () => {
  it("records actual player strikes, progression, and kills while excluding enemy counterattacks", () => {
    const before = structuredClone(INITIAL_GAME_STATE);
    const after = recordPlayerBattleContribution(before, contribution());

    expect(after.campaignUnitBattleRecords).toEqual([{
      unitId: "unit_001",
      unitName: "味方01",
      attacks: 1,
      strikes: 2,
      hits: 2,
      misses: 0,
      criticalHits: 1,
      damageDealt: 20,
      enemiesDefeated: 1,
      experienceAwarded: 30,
      levelUps: 1,
      statGains: {
        hp: 1, strength: 1, magic: 0, skill: 0,
        speed: 0, luck: 0, defense: 0, resistance: 0
      }
    }]);
    expect(before.campaignUnitBattleRecords).toEqual([]);
    expect(before.units).toEqual(INITIAL_GAME_STATE.units);
  });

  it("accumulates a later missed attack without erasing earlier campaign totals", () => {
    const first = recordPlayerBattleContribution(INITIAL_GAME_STATE, contribution());
    const second = recordPlayerBattleContribution(first, contribution({
      defenderId: "enemy_002",
      defenderDefeated: false,
      experienceAwarded: 0,
      levelUps: [],
      result: {
        attackerHp: 16,
        defenderHp: 20,
        consumedRolls: 1,
        events: [{
          kind: "initial", attackerId: "unit_001", defenderId: "enemy_002",
          weaponId: "iron_sword", hit: false, critical: false, damage: 0,
          defenderHpBefore: 20, defenderHpAfter: 20, hitRate: 5, criticalRate: 0
        }]
      }
    }));

    expect(second.campaignUnitBattleRecords).toHaveLength(1);
    expect(second.campaignUnitBattleRecords[0]).toMatchObject({
      attacks: 2,
      strikes: 3,
      hits: 2,
      misses: 1,
      criticalHits: 1,
      damageDealt: 20,
      enemiesDefeated: 1,
      experienceAwarded: 30,
      levelUps: 1
    });
    expect(second.campaignUnitBattleRecords[0]?.statGains.hp).toBe(1);
  });

  it("retains the campaign history for other units and appends newly contributing allies", () => {
    const first = recordPlayerBattleContribution(INITIAL_GAME_STATE, contribution());
    const other = recordPlayerBattleContribution(first, contribution({
      attacker: { id: "unit_003", name: "味方03" },
      defenderId: "enemy_003",
      defenderDefeated: false,
      experienceAwarded: 10,
      levelUps: [],
      result: {
        attackerHp: 20,
        defenderHp: 16,
        consumedRolls: 1,
        events: [{
          kind: "initial", attackerId: "unit_003", defenderId: "enemy_003",
          weaponId: "iron_lance", hit: true, critical: false, damage: 4,
          defenderHpBefore: 20, defenderHpAfter: 16, hitRate: 80, criticalRate: 0
        }]
      }
    }));

    expect(other.campaignUnitBattleRecords.map((record) => record.unitId)).toEqual(["unit_001", "unit_003"]);
    expect(other.campaignUnitBattleRecords[0]?.damageDealt).toBe(20);
    expect(other.campaignUnitBattleRecords[1]?.damageDealt).toBe(4);
  });
});
