import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UnitGrowthPanel } from "./unit-growth-panel";

describe("UnitGrowthPanel", () => {
  it("shows all eight independent growth chances and EXP progress without actions", () => {
    const html = renderToStaticMarkup(createElement(UnitGrowthPanel, {
      experience: 63,
      growthRates: {
        hp: 80,
        strength: 35,
        magic: 5,
        skill: 55,
        speed: 60,
        luck: 35,
        defense: 25,
        resistance: 15
      }
    }));

    expect(html).toContain('data-testid="unit-growth-panel"');
    expect(html).toContain("次のレベルまで 37 EXP");
    expect(html).toContain("EXP 63 / 100");
    expect((html.match(/data-testid="unit-growth-rate"/g) ?? [])).toHaveLength(8);
    expect(html).toContain("<dt>HP</dt><dd>80%</dd>");
    expect(html).toContain("<dt>魔力</dt><dd>5%</dd>");
    expect(html).toContain("各能力を独立して抽選する確率");
    expect(html).toContain("能力上限に達している能力は上昇しません");
    expect(html).not.toContain("<button");
  });
});
