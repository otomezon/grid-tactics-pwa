import { describe, expect, it } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameStateSnapshot } from "../domain/models/game";
import { getBattleGuideDetails } from "./get-battle-guide-details";

function guide(overrides: Partial<Parameters<typeof getBattleGuideDetails>[0]> = {}) {
  return getBattleGuideDetails({
    state: INITIAL_GAME_STATE,
    selectedUnitId: null,
    deploymentPending: false,
    pendingMapEventCount: 0,
    battleOutcome: "playing",
    ...overrides
  });
}

describe("getBattleGuideDetails", () => {
  it("points to deployment before the first battle action", () => {
    const result = guide({ deploymentPending: true });
    expect(result.headline).toBe("出撃メンバーと配置を確定しましょう");
    expect(result.completedCount).toBe(0);
  });

  it("prioritizes pending map events over ordinary battle advice", () => {
    const result = guide({ pendingMapEventCount: 2 });
    expect(result.headline).toBe("マップイベントを確認しましょう");
  });

  it("shows a two-tap movement hint for a selected ally who has not moved", () => {
    const result = guide({ selectedUnitId: "unit_001" });
    expect(result.headline).toBe("青いマスから移動先を選びましょう");
    expect(result.description).toContain("もう1回タップ");
  });

  it("switches to action advice after the selected ally has moved", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, hasMoved: true } : unit
      )
    };
    expect(guide({ state, selectedUnitId: "unit_001" }).headline)
      .toBe("この味方の行動を選びましょう");
  });

  it("suggests choosing another ally or ending the phase after an action", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      units: INITIAL_GAME_STATE.units.map((unit) =>
        unit.id === "unit_001" ? { ...unit, hasActed: true } : unit
      )
    };
    expect(guide({ state, selectedUnitId: "unit_001" }).headline)
      .toBe("次に行動する味方を選びましょう");
    const allActed = {
      ...state,
      units: state.units.map((unit) => unit.faction === "player" ? { ...unit, hasActed: true } : unit)
    };
    expect(guide({ state: allActed, selectedUnitId: "unit_001" }).headline)
      .toBe("自軍フェイズを終了できます");
  });

  it("derives checklist completion only from the current chapter's confirmed actions", () => {
    const otherChapterLog = [
      {
        sequence: 1,
        chapterId: "chapter_02_map",
        turn: 1,
        kind: "player-action" as const,
        action: "movement" as const,
        actorId: "unit_001",
        actorName: "主人公",
        detail: "移動"
      },
      {
        sequence: 2,
        chapterId: "chapter_02_map",
        turn: 1,
        kind: "player-action" as const,
        action: "wait" as const,
        actorId: "unit_001",
        actorName: "主人公",
        detail: "待機"
      }
    ];
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      campaignBattleLog: otherChapterLog
    };
    expect(guide({ state }).completedCount).toBe(0);
  });

  it("recognizes movement, a confirmed action, and an enemy phase in the current chapter", () => {
    const state: GameStateSnapshot = {
      ...INITIAL_GAME_STATE,
      turn: 2,
      campaignBattleLog: [
        {
          sequence: 1,
          chapterId: INITIAL_GAME_STATE.chapterId,
          turn: 1,
          kind: "player-action",
          action: "movement",
          actorId: "unit_001",
          actorName: "主人公",
          detail: "移動"
        },
        {
          sequence: 2,
          chapterId: INITIAL_GAME_STATE.chapterId,
          turn: 1,
          kind: "player-attack",
          attackerId: "unit_001",
          attackerName: "主人公",
          defenderId: "enemy_001",
          defenderName: "敵01",
          defenderRemainingHp: 8,
          experienceAwarded: 20,
          strikes: []
        },
        {
          sequence: 3,
          chapterId: INITIAL_GAME_STATE.chapterId,
          turn: 1,
          kind: "enemy-action",
          enemyId: "enemy_001",
          enemyName: "敵01",
          actionKind: "waited",
          strikes: []
        }
      ]
    };
    const result = guide({ state });
    expect(result.steps.map((step) => step.complete)).toEqual([true, true, true]);
    expect(result.completedCount).toBe(3);
  });

  it("shows result-specific advice and finishes the turn milestone at a terminal result", () => {
    expect(guide({ battleOutcome: "victory" }).headline).toBe("勝利です。リザルトを確認しましょう");
    const defeat = guide({ battleOutcome: "defeat" });
    expect(defeat.headline).toBe("戦闘終了です。敗北結果を確認しましょう");
    expect(defeat.steps[2]?.complete).toBe(true);
  });
});
