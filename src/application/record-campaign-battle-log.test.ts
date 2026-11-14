import { describe, expect, it } from "vitest";
import { CHAPTER_01_MAP, INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { isValidGameStateSnapshot } from "../domain/models/validate-game-state";
import type { CampaignBattleLogEntry } from "../domain/models/game";
import { performAttack } from "./perform-attack";
import { getPlayerAttackReport } from "./get-player-attack-report";
import {
  appendCampaignBattleLogEntries,
  createEnemyBattleLogEntries,
  createPlayerAttackBattleLogEntry
} from "./record-campaign-battle-log";

function adjacentBattleState() {
  return {
    ...INITIAL_GAME_STATE,
    units: INITIAL_GAME_STATE.units.map((unit) =>
      unit.id === "enemy_001" ? { ...unit, position: { x: 1, y: 7 }, currentHp: 1 } : unit
    )
  };
}

describe("campaign battle log recording", () => {
  it("appends confirmed player actions in global order without mutating the source snapshot", () => {
    const first = appendCampaignBattleLogEntries(INITIAL_GAME_STATE, [{
      kind: "player-action",
      action: "movement",
      actorId: "unit_001",
      actorName: "主人公",
      detail: "2列・9行 → 2列・8行"
    }]);
    const second = appendCampaignBattleLogEntries(first, [{
      kind: "player-action",
      action: "wait",
      actorId: "unit_002",
      actorName: "味方02",
      detail: "待機"
    }], "chapter_02_map", 1);

    expect(INITIAL_GAME_STATE.campaignBattleLog).toEqual([]);
    expect(second.campaignBattleLog.map((entry) => entry.sequence)).toEqual([1, 2]);
    expect(second.campaignBattleLog[1]).toMatchObject({
      chapterId: "chapter_02_map",
      turn: 1,
      kind: "player-action",
      action: "wait"
    });
  });

  it("truncates only the oldest entries after the configured retention limit", () => {
    const existing = Array.from({ length: 5000 }, (_, index): CampaignBattleLogEntry => ({
      sequence: index + 1,
      chapterId: "chapter_01_map",
      turn: 1,
      kind: "player-action",
      action: "wait",
      actorId: "unit_001",
      actorName: "主人公",
      detail: "待機"
    }));
    const state = { ...INITIAL_GAME_STATE, campaignBattleLog: existing };
    const next = appendCampaignBattleLogEntries(state, [{
      kind: "player-action",
      action: "wait",
      actorId: "unit_002",
      actorName: "味方02",
      detail: "待機"
    }]);

    expect(next.campaignBattleLog).toHaveLength(5000);
    expect(next.campaignBattleLog[0]?.sequence).toBe(2);
    expect(next.campaignBattleLog[4999]?.sequence).toBe(5001);
    expect(state.campaignBattleLog[0]?.sequence).toBe(1);
  });

  it("records actual player attack strikes but excludes forecast-only values", () => {
    const execution = performAttack(adjacentBattleState(), CHAPTER_01_MAP, "unit_001", "enemy_001");
    const report = getPlayerAttackReport(execution);
    const entry = createPlayerAttackBattleLogEntry(report);

    expect(entry).toMatchObject({
      kind: "player-attack",
      attackerId: "unit_001",
      defenderId: "enemy_001",
      defenderRemainingHp: execution.result.defenderHp,
      experienceAwarded: execution.experienceAwarded
    });
    expect(entry.kind).toBe("player-attack");
    if (entry.kind !== "player-attack") return;
    expect(entry.strikes).toHaveLength(execution.result.events.length);
    expect(entry.strikes[0]).toMatchObject({
      actorId: "unit_001",
      targetId: "enemy_001",
      weaponName: "試作の鉄の剣",
      damage: Math.max(0, (execution.result.events[0]?.defenderHpBefore ?? 0) - (execution.result.events[0]?.defenderHpAfter ?? 0)),
      targetHpBefore: execution.result.events[0]?.defenderHpBefore,
      targetHpAfter: execution.result.events[0]?.defenderHpAfter
    });
    expect(entry.strikes[0]?.damage).toBe(1);
    const stateWithLog = appendCampaignBattleLogEntries(execution.nextState, [entry]);
    expect(isValidGameStateSnapshot(stateWithLog, CHAPTER_01_MAP)).toBe(true);
    expect(entry).not.toHaveProperty("forecast");
    expect(entry).not.toHaveProperty("hitRate");
  });

  it("stores actual enemy strikes and movement without persisting forecast or AI evaluation details", () => {
    const sourceUnits = INITIAL_GAME_STATE.units;
    const actions = [{
      enemyId: "enemy_001",
      enemyName: "敵01",
      kind: "moved-and-attacked" as const,
      message: "敵01は主人公へ移動して攻撃",
      targetId: "unit_001",
      targetName: "主人公",
      destination: { x: 1, y: 7 },
      attackForecast: { attackerId: "enemy_001", defenderId: "unit_001" } as never,
      targetEvaluations: [{ targetId: "unit_001", targetName: "主人公" }] as never,
      movementEvaluations: [{ position: { x: 1, y: 7 } }] as never,
      attackEvents: [{
        kind: "initial" as const,
        attackerId: "enemy_001",
        defenderId: "unit_001",
        weaponId: "iron_axe",
        hit: true,
        critical: false,
        damage: 4,
        defenderHpBefore: 20,
        defenderHpAfter: 16,
        hitRate: 80,
        criticalRate: 0
      }]
    }];
    const [entry] = createEnemyBattleLogEntries(actions, sourceUnits);

    expect(entry).toMatchObject({
      kind: "enemy-action",
      enemyId: "enemy_001",
      actionKind: "moved-and-attacked",
      targetId: "unit_001",
      destination: { x: 1, y: 7 },
      strikes: [{
        actorName: "敵01",
        targetName: "主人公",
        weaponName: "試作の鉄の斧",
        outcome: "hit",
        damage: 4,
        targetHpBefore: 20,
        targetHpAfter: 16
      }]
    });
    expect(entry).not.toHaveProperty("attackForecast");
    expect(entry).not.toHaveProperty("targetEvaluations");
    expect(entry).not.toHaveProperty("movementEvaluations");
  });
});
