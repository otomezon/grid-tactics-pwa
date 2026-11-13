import { createElement } from "react";
import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EnemyPhaseForecast } from "../application/get-enemy-phase-forecast";
import { INITIAL_GAME_STATE } from "../content/maps/chapter-01";
import type { GameUnit } from "../domain/models/game";
import { PlayerPhaseEndReview } from "./player-phase-end-review";

const playerUnits: GameUnit[] = INITIAL_GAME_STATE.units
  .filter((unit) => unit.faction === "player")
  .map((unit, index) => index === 1 ? { ...unit, hasMoved: true, hasActed: true } : unit);

const firstUnit = playerUnits[0]!;

const forecast: EnemyPhaseForecast = {
  actions: [{
    enemyId: "enemy_001",
    enemyName: "敵01",
    kind: "moved-and-attacked",
    targetId: firstUnit.id,
    targetName: firstUnit.name,
    destination: { x: 1, y: 7 },
    message: "敵01は味方01へ移動して攻撃します。"
  }],
  outcome: "playing",
  phaseStartRecoveries: [],
  playerUnitOutcomes: playerUnits.map((unit, index) => ({
    unitId: unit.id,
    unitName: unit.name,
    currentHp: unit.currentHp,
    hpAfterEnemyActions: index === 0 ? 0 : unit.currentHp - 2,
    hpAfterResolution: index === 0 ? 0 : unit.currentHp - 2,
    maxHp: unit.stats.hp,
    incomingDamage: index === 0 ? unit.currentHp : 2,
    fortRecovery: 0,
    defeated: index === 0
  }))
};

function renderReview(
  overrides: Partial<ComponentProps<typeof PlayerPhaseEndReview>> = {}
): string {
  return renderToStaticMarkup(createElement(PlayerPhaseEndReview, {
    pendingUnits: playerUnits.filter((unit) => !unit.hasActed),
    playerUnits,
    forecast,
    disabled: false,
    onSelectUnit: () => undefined,
    onReturnToBattle: () => undefined,
    onEndPhase: () => undefined,
    selectedEnemyActionId: null,
    onPreviewAction: () => undefined,
    ...overrides
  }));
}

describe("PlayerPhaseEndReview", () => {
  it("shows enemy attack targets and predicted HP for every ally", () => {
    const html = renderReview();

    expect((html.match(/data-testid="phase-end-review-forecast-unit"/g) ?? [])).toHaveLength(playerUnits.length);
    expect(html).toContain('data-testid="phase-end-review-action"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("マップで確認");
    expect(html).toContain('data-enemy-id="enemy_001"');
    expect(html).toContain('data-target-id="unit_001"');
    expect(html).toContain("予測される敵の行動");
    expect(html).toContain("敵01");
    expect(html).toContain("味方01");
    expect(html).toContain("HP 20 → 0 / 20");
    expect(html).toContain("撃破見込み");
    expect(html).toContain("行動済み");
    expect(html).toContain("味方全員の予測HP");
    expect(html).toContain("敵軍フェイズ後の予測HP");
  });

  it("marks the selected enemy action as the one highlighted on the map", () => {
    const html = renderReview({ selectedEnemyActionId: "enemy_001" });

    expect(html).toContain('data-testid="phase-end-review-action"');
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("マップ表示中");
  });

  it("explains when no enemy action is forecast and disables unit selection while locked", () => {
    const html = renderReview({
      forecast: {
        ...forecast,
        actions: [],
        playerUnitOutcomes: []
      },
      disabled: true
    });

    expect(html).toContain("敵ユニットの行動はありません。");
    expect(html).toContain('class="phase-end-review-unit" type="button" disabled=""');
    expect(html).toContain('class="primary-button" type="button" disabled=""');
  });
});
