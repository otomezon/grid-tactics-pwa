import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DeploymentComparisonCandidate } from "./deployment-unit-comparison";
import { DeploymentUnitComparison } from "./deployment-unit-comparison";

const candidates: DeploymentComparisonCandidate[] = [
  {
    id: "unit_001",
    name: "味方01",
    classLabel: "剣士",
    rosterStatusLabel: "出撃予定",
    level: 3,
    experience: 42,
    currentHp: 18,
    stats: { hp: 22, strength: 8, magic: 0, skill: 9, speed: 10, luck: 4, defense: 5, resistance: 1 },
    growthRates: { hp: 80, strength: 35, magic: 5, skill: 40, speed: 55, luck: 30, defense: 25, resistance: 10 },
    movementLabel: "歩兵 · 5",
    weaponAptitudeLabel: "剣",
    equippedWeaponLabel: "試作の鉄の剣"
  },
  {
    id: "unit_004",
    name: "味方04",
    classLabel: "魔道士",
    rosterStatusLabel: "控え予定",
    level: 2,
    experience: 75,
    currentHp: 12,
    stats: { hp: 17, strength: 0, magic: 9, skill: 7, speed: 8, luck: 6, defense: 2, resistance: 8 },
    growthRates: { hp: 60, strength: 5, magic: 65, skill: 35, speed: 40, luck: 45, defense: 10, resistance: 50 },
    movementLabel: "歩兵 · 5",
    weaponAptitudeLabel: "魔法",
    equippedWeaponLabel: "試作のファイアー"
  }
];

describe("DeploymentUnitComparison", () => {
  it("offers active and reserve candidates and keeps comparison initially empty", () => {
    const html = renderToStaticMarkup(createElement(DeploymentUnitComparison, { candidates }));

    expect(html).toContain("ユニット比較");
    expect(html).toContain('aria-label="比較する味方A"');
    expect(html).toContain('aria-label="比較する味方B"');
    expect(html).toContain("味方01（出撃予定）");
    expect(html).toContain("味方04（控え予定）");
    expect(html).toContain("比較する味方を2人選択すると");
    expect(html).toContain("セーブを変更しません");
  });
});
