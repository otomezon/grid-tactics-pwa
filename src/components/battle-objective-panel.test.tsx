import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import { BattleObjectivePanel } from "./battle-objective-panel";

const details = {
  victoryLabel: "ボスを撃破する",
  victoryStatus: "敵01 · HP 20 / 20",
  defeatLabel: "味方01を撃破させない",
  defeatStatus: "味方01 · HP 20 / 20"
};

describe("BattleObjectivePanel navigation", () => {
  it("offers direct map inspection for a living boss and protected ally", () => {
    const html = renderToStaticMarkup(createElement(BattleObjectivePanel, {
      details,
      navigationTargets: {
        victoryTarget: INITIAL_GAME_STATE.units.find((unit) => unit.id === "enemy_001")!,
        defeatTarget: INITIAL_GAME_STATE.units.find((unit) => unit.id === "unit_001")!,
        remainingEnemyCount: 0
      },
      disabled: false,
      onInspectUnit: vi.fn(),
      onInspectEnemyRoster: vi.fn()
    }));

    expect(html).toContain('aria-label="敵01をマップで確認"');
    expect(html).toContain("ボスの位置を確認：敵01");
    expect(html).toContain('aria-label="味方01をマップで確認"');
    expect(html).toContain("保護対象の位置を確認：味方01");
  });

  it("offers the living enemy roster for a defeat-all objective", () => {
    const html = renderToStaticMarkup(createElement(BattleObjectivePanel, {
      details: { ...details, victoryLabel: "敵を全滅させる", victoryStatus: "残り 3 / 5体" },
      navigationTargets: { victoryTarget: null, defeatTarget: null, remainingEnemyCount: 3 },
      disabled: false,
      onInspectUnit: vi.fn(),
      onInspectEnemyRoster: vi.fn()
    }));

    expect(html).toContain('aria-label="残りの敵を一覧で確認、3体"');
    expect(html).toContain("残りの敵を一覧で確認（3体）");
  });

  it("does not offer navigation after the objective target is defeated", () => {
    const html = renderToStaticMarkup(createElement(BattleObjectivePanel, {
      details: { ...details, victoryStatus: "敵01 · 撃破済み", defeatStatus: "味方01 · 撃破済み" },
      navigationTargets: { victoryTarget: null, defeatTarget: null, remainingEnemyCount: 0 },
      disabled: false,
      onInspectUnit: vi.fn(),
      onInspectEnemyRoster: vi.fn()
    }));

    expect(html).not.toContain("マップで確認");
    expect(html).not.toContain("一覧で確認");
  });
});
