import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HEALING_POTION_ID } from "../content/items";
import { INITIAL_UNITS } from "../content/maps/chapter-01";
import { getPlayerInspectionDetails } from "../application/get-player-inspection-details";
import { PlayerInspector } from "./player-inspector";

describe("PlayerInspector", () => {
  it("renders the selected ally's stats, weapon suitability, and item quantities as read-only details", () => {
    const ally = INITIAL_UNITS.find((unit) => unit.id === "unit_001");
    if (!ally) throw new Error("The player inspector fixture is missing unit_001.");
    const details = getPlayerInspectionDetails({
      ...ally, inventory: [...ally.inventory, "short_bow", HEALING_POTION_ID, HEALING_POTION_ID]
    });
    if (!details) throw new Error("The player inspector fixture was not projected.");
    const html = renderToStaticMarkup(createElement(PlayerInspector, { details }));
    expect(html).toContain('data-testid="player-inspector"');
    expect(html).toContain("味方01");
    expect(html).toContain("能力値");
    expect(html).toContain("成長率");
    expect(html).toContain("次のレベルまで");
    expect((html.match(/data-testid="unit-growth-rate"/g) ?? [])).toHaveLength(8);
    expect(html).toContain("所持武器");
    expect(html).toContain("使用適性あり");
    expect(html).toContain("適性なし");
    expect(html).toContain("所持アイテム");
    expect(html).toContain("回復薬");
    expect(html).toContain("所持数：2個");
    expect(html).toContain("表示専用");
  });
});
