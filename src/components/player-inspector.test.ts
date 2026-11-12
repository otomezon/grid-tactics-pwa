import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HEALING_POTION_ID } from "../content/items";
import { INITIAL_UNITS } from "../content/maps/chapter-01";
import { getPlayerInspectionDetails } from "../application/get-player-inspection-details";
import { PlayerInspector } from "./player-inspector";

describe("PlayerInspector", () => {
  it("renders class tier and the approved promotion destination with current requirements", () => {
    const ally = INITIAL_UNITS.find((unit) => unit.id === "unit_001");
    if (!ally) throw new Error("The player inspector fixture is missing unit_001.");
    const details = getPlayerInspectionDetails({
      ...ally, inventory: [...ally.inventory, "short_bow", HEALING_POTION_ID, HEALING_POTION_ID]
    });
    if (!details) throw new Error("The player inspector fixture was not projected.");
    const html = renderToStaticMarkup(createElement(PlayerInspector, { details }));
    expect(html).toContain('data-testid="player-inspector"');
    expect(html).toContain("味方01");
    expect(html).toContain("剣士 · 基本職");
    expect(html).toContain("昇格先：ソードマスター（基本職Lv.10以上・クラスチェンジの証1個）");
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
    expect(html).toContain("キャンペーン累計戦績");
    expect(html).toContain("まだキャンペーン内の攻撃記録はありません");
  });

  it("renders an existing campaign battle record for the selected ally", () => {
    const ally = INITIAL_UNITS.find((unit) => unit.id === "unit_001");
    if (!ally) throw new Error("The player inspector fixture is missing unit_001.");
    const record = {
      unitId: "unit_001",
      unitName: "味方01",
      attacks: 2, strikes: 3, hits: 2, misses: 1, criticalHits: 1,
      damageDealt: 14, enemiesDefeated: 1, experienceAwarded: 30, levelUps: 1,
      statGains: { hp: 1, strength: 1, magic: 0, skill: 0, speed: 0, luck: 0, defense: 0, resistance: 0 }
    };
    const details = getPlayerInspectionDetails(ally, record);
    if (!details) throw new Error("The player inspector fixture was not projected.");
    const html = renderToStaticMarkup(createElement(PlayerInspector, { details }));
    expect(html).toContain("攻撃行動");
    expect(html).toContain("累計能力上昇：HP +1 · 力 +1");
  });
});
