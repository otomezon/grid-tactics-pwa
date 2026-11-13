import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CombatForecast } from "../domain/combat/types";
import { EnemyAttackForecastDetails } from "./enemy-attack-forecast-details";

const forecast: CombatForecast = {
  attackerId: "enemy_001",
  defenderId: "unit_001",
  distance: 1,
  counterAvailable: true,
  speedDifference: 4,
  strikes: [
    {
      kind: "initial",
      attackerId: "enemy_001",
      defenderId: "unit_001",
      weaponId: "iron_sword",
      attackPower: 9,
      normalDamage: 4,
      hitRate: 75,
      criticalRate: 10,
      criticalDamage: 12,
      weaponTriangleHitModifier: 20
    },
    {
      kind: "counter",
      attackerId: "unit_001",
      defenderId: "enemy_001",
      weaponId: "iron_sword",
      attackPower: 6,
      normalDamage: 3,
      hitRate: 60,
      criticalRate: 5,
      criticalDamage: 9,
      weaponTriangleHitModifier: -20
    },
    {
      kind: "follow-up",
      attackerId: "enemy_001",
      defenderId: "unit_001",
      weaponId: "iron_sword",
      attackPower: 9,
      normalDamage: 4,
      hitRate: 75,
      criticalRate: 10,
      criticalDamage: 12,
      weaponTriangleHitModifier: 20
    }
  ]
};

describe("EnemyAttackForecastDetails", () => {
  it("shows the exact strike sequence, participants, and combat values", () => {
    const html = renderToStaticMarkup(createElement(EnemyAttackForecastDetails, {
      forecast,
      attackerName: "敵01",
      defenderName: "味方01"
    }));

    expect((html.match(/data-testid="enemy-attack-forecast-strike"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("攻撃の命中率・ダメージ予測（3回）");
    expect(html).toContain("初撃");
    expect(html).toContain("反撃");
    expect(html).toContain("追撃");
    expect(html).toContain("敵01 → 味方01");
    expect(html).toContain("味方01 → 敵01");
    expect(html).toContain("通常ダメージ");
    expect(html).toContain("必殺時ダメージ");
    expect(html).toContain("75%");
    expect(html).toContain("10%");
    expect(html).toContain("有利（命中 +20）");
    expect(html).toContain("不利（命中 -20）");
    expect(html).toContain("実際に発生した命中・必殺・ダメージ");
  });

  it("does not render a forecast disclosure when no attack plan exists", () => {
    const html = renderToStaticMarkup(createElement(EnemyAttackForecastDetails, {
      forecast: undefined,
      attackerName: "敵01",
      defenderName: "味方01"
    }));

    expect(html).toBe("");
  });
});
