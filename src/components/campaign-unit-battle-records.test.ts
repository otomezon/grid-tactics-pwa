import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CampaignUnitBattleRecord } from "../domain/models/game";
import {
  CampaignUnitBattleRecordPanel,
  CampaignUnitBattleRecordsArchive,
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


describe("CampaignUnitBattleRecordsArchive", () => {
  it("renders sortable and searchable campaign-wide ally records", () => {
    const secondRecord: CampaignUnitBattleRecord = {
      ...record,
      unitId: "unit_002",
      unitName: "味方02",
      damageDealt: 24,
      enemiesDefeated: 2,
      experienceAwarded: 50
    };
    const html = renderToStaticMarkup(createElement(CampaignUnitBattleRecordsArchive, {
      records: [record, secondRecord]
    }));
    expect(html).toContain('data-testid="campaign-unit-battle-records-archive"');
    expect(html).toContain('aria-label="累計戦績の並べ替え"');
    expect(html).toContain('aria-label="味方戦績を名前で検索"');
    expect(html).toContain("与ダメージ順");
    expect(html).toContain("撃破数順");
    expect(html).toContain("2 / 2名を表示");
    expect(html).toContain("味方01");
    expect(html).toContain("味方02");
    expect(html).toContain("敵の反撃は含まず");
    expect(html).toContain('aria-label="検索結果をCSV出力"');
    expect(html).toContain('aria-label="累計全員をCSV出力"');
    expect(html).toContain("現在の並び順で出力します");
  });

  it("distinguishes a campaign without attack records from a search with no matches", () => {
    const emptyHtml = renderToStaticMarkup(createElement(CampaignUnitBattleRecordsArchive, {
      records: []
    }));
    const noMatchHtml = renderToStaticMarkup(createElement(CampaignUnitBattleRecordsArchive, {
      records: [record]
    }));
    expect(emptyHtml).toContain("このキャンペーンには、まだ味方の攻撃記録がありません");
    expect(noMatchHtml).toContain("味方別の累計戦績");
  });
});
