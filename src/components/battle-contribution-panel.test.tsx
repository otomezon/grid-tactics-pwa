import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { BattleContributionEntry } from "../application/get-battle-contribution-details";
import { BattleContributionPanel } from "./battle-contribution-panel";

const contributions: BattleContributionEntry[] = [{
  unitId: "unit_001",
  unitName: "味方01",
  attacks: 2,
  strikes: 3,
  hits: 2,
  misses: 1,
  criticalHits: 1,
  damageDealt: 14,
  enemiesDefeated: 1,
  experienceAwarded: 30,
  levelUps: 1,
  statGains: {
    hp: 1, strength: 1, magic: 0, skill: 0,
    speed: 0, luck: 0, defense: 0, resistance: 0
  }
}];

describe("BattleContributionPanel", () => {
  it("renders actual attack totals, progression gains, and aggregation boundaries", () => {
    const html = renderToStaticMarkup(createElement(BattleContributionPanel, { contributions }));

    expect(html).toContain('data-testid="battle-contributions"');
    expect(html).toContain("味方の戦闘貢献");
    expect(html).toContain('data-testid="battle-contribution-unit_001"');
    expect(html).toContain("与ダメージ");
    expect(html).toContain(">14</dd>");
    expect(html).toContain("+30");
    expect(html).toContain("必殺");
    expect(html).toContain("レベルアップ");
    expect(html).toContain("能力上昇：HP +1 · 力 +1");
    expect(html).toContain("敵の反撃は味方の与ダメージ／命中数に含めず");
    expect(html).not.toContain("<button");
  });

  it("explains that no session attack record is available after a reload", () => {
    const html = renderToStaticMarkup(createElement(BattleContributionPanel, { contributions: [] }));

    expect(html).toContain("集計できる味方の攻撃記録はありません");
    expect(html).toContain("リロード・セーブ読込・章切替後");
  });
});
