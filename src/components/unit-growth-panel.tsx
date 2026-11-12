import type { UnitGrowthRates } from "../domain/models/game";

interface UnitGrowthPanelProps {
  growthRates: UnitGrowthRates;
  experience: number;
}

const GROWTH_RATE_ROWS: ReadonlyArray<{ key: keyof UnitGrowthRates; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "strength", label: "力" },
  { key: "magic", label: "魔力" },
  { key: "skill", label: "技" },
  { key: "speed", label: "速さ" },
  { key: "luck", label: "幸運" },
  { key: "defense", label: "守備" },
  { key: "resistance", label: "魔防" }
];

/** Read-only view of the existing per-level growth probabilities and EXP progress. */
export function UnitGrowthPanel({ growthRates, experience }: UnitGrowthPanelProps) {
  return (
    <section className="unit-growth-panel" aria-labelledby="unit-growth-heading" data-testid="unit-growth-panel">
      <div className="unit-growth-heading">
        <h3 id="unit-growth-heading">成長率</h3>
        <span>次のレベルまで {100 - experience} EXP</span>
      </div>
      <div className="unit-growth-experience">
        <progress max={100} value={experience} aria-label={"経験値 " + experience + "/100"} />
        <span>EXP {experience} / 100</span>
      </div>
      <dl className="unit-growth-grid">
        {GROWTH_RATE_ROWS.map(({ key, label }) => (
          <div className="unit-growth-row" key={key} data-testid="unit-growth-rate">
            <dt>{label}</dt>
            <dd>{growthRates[key]}%</dd>
            <progress max={100} value={growthRates[key]} aria-label={label + "成長率"} />
          </div>
        ))}
      </dl>
      <p className="unit-growth-note">
        成長率はレベルアップ時に各能力を独立して抽選する確率です。現在クラスの能力上限に達している能力は上昇しません。成長率と能力上限は試作データです。
      </p>
    </section>
  );
}
