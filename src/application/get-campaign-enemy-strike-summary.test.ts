import { describe, expect, it } from "vitest";
import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import { getCampaignEnemyStrikeSummary } from "./get-campaign-enemy-strike-summary";

const chapterOne = {
  chapterId: "chapter_01_map",
  chapterNumber: 1,
  chapterTitle: "第1章・試作マップ"
} as const;
const chapterTwo = {
  chapterId: "chapter_02_map",
  chapterNumber: 2,
  chapterTitle: "第2章・試作マップ"
} as const;

const entries: CampaignBattleHistoryEntry[] = [
  {
    ...chapterOne, sequence: 1, turn: 2, kind: "enemy-action",
    enemyId: "enemy_001", enemyName: "敵01", actionKind: "attacked",
    targetId: "unit_001", targetName: "主人公",
    strikes: [
      {
        actorId: "enemy_001", actorName: "敵01", targetId: "unit_001",
        targetName: "主人公", kind: "initial", weaponName: "鉄の斧",
        outcome: "hit", damage: 5, targetHpBefore: 20, targetHpAfter: 15
      },
      {
        actorId: "enemy_001", actorName: "敵01", targetId: "unit_003",
        targetName: "斥候", kind: "follow-up", weaponName: "鉄の斧",
        outcome: "miss", damage: 0, targetHpBefore: 10, targetHpAfter: 10
      }
    ]
  },
  {
    ...chapterOne, sequence: 2, turn: 2, kind: "player-attack",
    attackerId: "unit_001", attackerName: "主人公",
    defenderId: "enemy_001", defenderName: "敵01",
    defenderRemainingHp: 12, experienceAwarded: 20,
    strikes: [
      {
        actorId: "unit_001", actorName: "主人公", targetId: "enemy_001",
        targetName: "敵01", kind: "initial", weaponName: "鉄の剣",
        outcome: "critical", damage: 18, targetHpBefore: 30, targetHpAfter: 12
      },
      {
        actorId: "enemy_001", actorName: "敵01", targetId: "unit_001",
        targetName: "主人公", kind: "counter", weaponName: "鉄の斧",
        outcome: "hit", damage: 4, targetHpBefore: 15, targetHpAfter: 11
      }
    ]
  },
  {
    ...chapterTwo, sequence: 3, turn: 1, kind: "enemy-action",
    enemyId: "enemy_001", enemyName: "敵01", actionKind: "attacked",
    targetId: "unit_002", targetName: "味方02",
    strikes: [{
      actorId: "enemy_001", actorName: "敵01", targetId: "unit_002",
      targetName: "味方02", kind: "initial", weaponName: "鉄の弓",
      outcome: "critical", damage: 8, targetHpBefore: 8, targetHpAfter: 0
    }]
  },
  {
    ...chapterTwo, sequence: 4, turn: 1, kind: "enemy-action",
    enemyId: "enemy_002", enemyName: "敵02", actionKind: "attacked",
    targetId: "unit_003", targetName: "斥候",
    strikes: [{
      actorId: "enemy_001", actorName: "別の敵", targetId: "unit_003",
      targetName: "斥候", kind: "initial", weaponName: "鉄の弓",
      outcome: "hit", damage: 99, targetHpBefore: 10, targetHpAfter: 0
    }]
  }
];

describe("getCampaignEnemyStrikeSummary", () => {
  it("counts enemy-phase attacks and enemy counterstrikes by chapter and enemy ID", () => {
    expect(getCampaignEnemyStrikeSummary(entries)).toEqual([
      {
        chapterId: "chapter_01_map", chapterNumber: 1, chapterTitle: "第1章・試作マップ",
        enemyId: "enemy_001", enemyName: "敵01",
        attackStrikes: 3, hits: 2, misses: 1, criticalHits: 0,
        damageDealt: 9, targetCount: 2, alliesDefeated: 0, lastSequence: 2
      },
      {
        chapterId: "chapter_02_map", chapterNumber: 2, chapterTitle: "第2章・試作マップ",
        enemyId: "enemy_001", enemyName: "敵01",
        attackStrikes: 1, hits: 1, misses: 0, criticalHits: 1,
        damageDealt: 8, targetCount: 1, alliesDefeated: 1, lastSequence: 3
      }
    ]);
  });

  it("excludes allied opening and follow-up strikes and mismatched enemy actors", () => {
    const playerOnly: CampaignBattleHistoryEntry[] = [{
      ...chapterOne, sequence: 1, turn: 1, kind: "player-attack",
      attackerId: "unit_001", attackerName: "主人公",
      defenderId: "enemy_001", defenderName: "敵01",
      defenderRemainingHp: 10, experienceAwarded: 0,
      strikes: [
        {
          actorId: "unit_001", actorName: "主人公", targetId: "enemy_001",
          targetName: "敵01", kind: "initial", weaponName: "鉄の剣",
          outcome: "hit", damage: 5, targetHpBefore: 15, targetHpAfter: 10
        },
        {
          actorId: "unit_001", actorName: "主人公", targetId: "enemy_001",
          targetName: "敵01", kind: "follow-up", weaponName: "鉄の剣",
          outcome: "hit", damage: 5, targetHpBefore: 10, targetHpAfter: 5
        }
      ]
    }];
    expect(getCampaignEnemyStrikeSummary(playerOnly)).toEqual([]);
  });

  it("returns no invented zero rows and does not mutate the retained source log", () => {
    const snapshot = structuredClone(entries);
    expect(getCampaignEnemyStrikeSummary([])).toEqual([]);
    expect(getCampaignEnemyStrikeSummary(entries)).toHaveLength(2);
    expect(entries).toEqual(snapshot);
  });
});
