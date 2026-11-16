import { describe, expect, it } from "vitest";
import type { CampaignBattleHistoryEntry } from "./get-campaign-battle-history";
import { getCampaignIncomingStrikeSummary } from "./get-campaign-incoming-strike-summary";

const chapter = {
  chapterId: "chapter_01_map",
  chapterNumber: 1,
  chapterTitle: "第1章・試作マップ"
} as const;

const entries: CampaignBattleHistoryEntry[] = [
  {
    ...chapter, sequence: 10, turn: 3, kind: "player-attack",
    attackerId: "unit_001", attackerName: "主人公",
    defenderId: "enemy_001", defenderName: "敵01",
    defenderRemainingHp: 0, experienceAwarded: 30,
    strikes: [
      {
        actorId: "unit_001", actorName: "主人公", targetId: "enemy_001",
        targetName: "敵01", kind: "initial", weaponName: "鉄の剣",
        outcome: "critical", damage: 20, targetHpBefore: 20, targetHpAfter: 0
      },
      {
        actorId: "enemy_001", actorName: "敵01", targetId: "unit_001",
        targetName: "主人公", kind: "counter", weaponName: "鉄の斧",
        outcome: "hit", damage: 4, targetHpBefore: 18, targetHpAfter: 14
      }
    ]
  },
  {
    ...chapter, sequence: 12, turn: 4, kind: "enemy-action",
    enemyId: "enemy_002", enemyName: "敵02", actionKind: "attacked",
    targetId: "unit_001", targetName: "主人公",
    strikes: [
      {
        actorId: "enemy_002", actorName: "敵02", targetId: "unit_001",
        targetName: "主人公", kind: "initial", weaponName: "鉄の弓",
        outcome: "miss", damage: 0, targetHpBefore: 14, targetHpAfter: 14
      },
      {
        actorId: "enemy_002", actorName: "敵02", targetId: "unit_001",
        targetName: "主人公", kind: "follow-up", weaponName: "鉄の弓",
        outcome: "critical", damage: 7, targetHpBefore: 14, targetHpAfter: 7
      }
    ]
  },
  {
    ...chapter, sequence: 13, turn: 4, kind: "enemy-action",
    enemyId: "enemy_002", enemyName: "敵02", actionKind: "attacked",
    targetId: "unit_003", targetName: "斥候",
    strikes: [{
      actorId: "enemy_002", actorName: "敵02", targetId: "unit_003",
      targetName: "斥候", kind: "initial", weaponName: "鉄の弓",
      outcome: "hit", damage: 2, targetHpBefore: 16, targetHpAfter: 14
    }]
  }
];

describe("getCampaignIncomingStrikeSummary", () => {
  it("counts actual enemy strikes and player-attack counterstrikes against each ally", () => {
    expect(getCampaignIncomingStrikeSummary(entries)).toEqual([
      {
        unitId: "unit_001",
        unitName: "主人公",
        receivedStrikes: 3,
        hitsReceived: 2,
        missesAvoided: 1,
        criticalHitsReceived: 1,
        damageReceived: 11,
        attackerCount: 2,
        lastSequence: 12
      },
      {
        unitId: "unit_003",
        unitName: "斥候",
        receivedStrikes: 1,
        hitsReceived: 1,
        missesAvoided: 0,
        criticalHitsReceived: 0,
        damageReceived: 2,
        attackerCount: 1,
        lastSequence: 13
      }
    ]);
  });

  it("does not treat allied opening strikes or follow-ups as incoming damage", () => {
    const playerOnly: CampaignBattleHistoryEntry[] = [{
      ...chapter, sequence: 1, turn: 1, kind: "player-attack",
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
    expect(getCampaignIncomingStrikeSummary(playerOnly)).toEqual([]);
  });

  it("returns no invented zero rows and does not mutate the saved timeline", () => {
    const snapshot = structuredClone(entries);
    const summary = getCampaignIncomingStrikeSummary(entries);
    expect(summary.map((record) => record.unitId)).toEqual(["unit_001", "unit_003"]);
    expect(entries).toEqual(snapshot);
    expect(getCampaignIncomingStrikeSummary([])).toEqual([]);
  });
});
