import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import {
  CampaignUnitBattleRecordPanel,
  CampaignUnitBattleRecordsSummary
} from "./campaign-unit-battle-records";

const record: CampaignUnitBattleRecord = {
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
};

describe("CampaignUnitBattleRecordPanel", () => {
  it("renders persistent cumulative metrics for one ally", () => {
    const html = renderToStaticMarkup(createElement(CampaignUnitBattleRecordPanel, { record }));
    expect(html).toContain("キャンペーン累計戦績");
    expect(html).toContain("攻撃行動");
    expect(html).toContain(">14</dd>");
    expect(html).toContain("+30");
    expect(html).toContain("累計能力上昇：HP +1 · 力 +1");
    expect(html).toContain("敵の反撃は含みません");
  });

  it("explains when the ally has no prior attack record", () => {
    const html = renderToStaticMarkup(createElement(CampaignUnitBattleRecordPanel, { record: null }));
    expect(html).toContain("まだキャンペーン内の攻撃記録はありません");
  });
});

describe("CampaignUnitBattleRecordsSummary", () => {
  it("renders each ally's persistent record on the result screen", () => {
    const html = renderToStaticMarkup(createElement(CampaignUnitBattleRecordsSummary, { records: [record] }));
    expect(html).toContain('data-testid="campaign-unit-record-summary"');
    expect(html).toContain('data-testid="campaign-unit-record-unit_001"');
    expect(html).toContain("味方01");
    expect(html).toContain("キャンペーン累計戦績");
  });

  it("renders an empty campaign state without inventing statistics", () => {
    const html = renderToStaticMarkup(createElement(CampaignUnitBattleRecordsSummary, { records: [] }));
    expect(html).toContain("このキャンペーンには、まだ味方の攻撃記録がありません");
  });
});
