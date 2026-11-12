import { useState } from "react";
import type { CampaignUnit } from "../domain/models/game";

export interface DeploymentComparisonCandidate {
  id: string;
  name: string;
  classLabel: string;
  rosterStatusLabel: string;
  level: number;
  experience: number;
  currentHp: number;
  stats: CampaignUnit["stats"];
  growthRates: CampaignUnit["growthRates"];
  movementLabel: string;
  weaponAptitudeLabel: string;
  equippedWeaponLabel: string;
}

interface DeploymentUnitComparisonProps {
  candidates: readonly DeploymentComparisonCandidate[];
}

const STAT_ROWS: ReadonlyArray<{ key: keyof CampaignUnit["stats"]; label: string }> = [
  { key: "hp", label: "HP" },
  { key: "strength", label: "力" },
  { key: "magic", label: "魔力" },
  { key: "skill", label: "技" },
  { key: "speed", label: "速さ" },
  { key: "luck", label: "幸運" },
  { key: "defense", label: "守備" },
  { key: "resistance", label: "魔防" }
];

export function DeploymentUnitComparison({ candidates }: DeploymentUnitComparisonProps) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");

  const left = candidates.find((candidate) => candidate.id === leftId);
  const right = candidates.find((candidate) => candidate.id === rightId);
  const sameCandidate = Boolean(left && right && left.id === right.id);

  return (
    <section className="deployment-comparison" aria-labelledby="deployment-comparison-heading" data-testid="deployment-comparison">
      <div className="deployment-comparison-heading">
        <div>
          <p className="eyebrow">UNIT COMPARISON</p>
          <h3 id="deployment-comparison-heading">ユニット比較</h3>
        </div>
        <button
          className="deployment-detail-toggle"
          type="button"
          disabled={!leftId && !rightId}
          onClick={() => { setLeftId(""); setRightId(""); }}
        >
          比較をクリア
        </button>
      </div>
      <p className="helper-text">
        出撃予定と控え予定を含む候補から2人を選び、能力値・成長率・装備適性を並べて確認できます。選択や比較は編成・装備・セーブを変更しません。
      </p>
      <div className="deployment-comparison-selectors">
        <label>
          <span>比較する味方A</span>
          <select aria-label="比較する味方A" value={leftId} onChange={(event) => setLeftId(event.target.value)}>
            <option value="">候補を選択</option>
            {candidates.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>{candidate.name}（{candidate.rosterStatusLabel}）</option>
            ))}
          </select>
        </label>
        <label>
          <span>比較する味方B</span>
          <select aria-label="比較する味方B" value={rightId} onChange={(event) => setRightId(event.target.value)}>
            <option value="">候補を選択</option>
            {candidates.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>{candidate.name}（{candidate.rosterStatusLabel}）</option>
            ))}
          </select>
        </label>
      </div>

      {sameCandidate ? (
        <p className="helper-text" aria-live="polite">異なる2人を選択してください。</p>
      ) : left && right ? (
        <div className="deployment-comparison-table-wrap" role="region" aria-label="ユニット比較表。横スクロールできます。" tabIndex={0} data-testid="deployment-comparison-table-wrap">
          <table className="deployment-comparison-table" aria-label="出撃候補ユニット比較">
            <thead>
              <tr>
                <th scope="col">比較項目</th>
                <th scope="col">{left.name}</th>
                <th scope="col">{right.name}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="deployment-comparison-group"><th colSpan={3} scope="rowgroup">基本情報</th></tr>
              <tr><th scope="row">編成</th><td>{left.rosterStatusLabel}</td><td>{right.rosterStatusLabel}</td></tr>
              <tr><th scope="row">クラス</th><td>{left.classLabel}</td><td>{right.classLabel}</td></tr>
              <tr><th scope="row">レベル</th><td>Lv.{left.level}</td><td>Lv.{right.level}</td></tr>
              <tr><th scope="row">EXP</th><td>{left.experience}/100</td><td>{right.experience}/100</td></tr>
              <tr><th scope="row">HP</th><td>{left.currentHp}/{left.stats.hp}</td><td>{right.currentHp}/{right.stats.hp}</td></tr>
              <tr><th scope="row">移動</th><td>{left.movementLabel}</td><td>{right.movementLabel}</td></tr>
              <tr><th scope="row">装備中</th><td>{left.equippedWeaponLabel}</td><td>{right.equippedWeaponLabel}</td></tr>
              <tr><th scope="row">武器適性</th><td>{left.weaponAptitudeLabel}</td><td>{right.weaponAptitudeLabel}</td></tr>
              <tr className="deployment-comparison-group"><th colSpan={3} scope="rowgroup">能力値</th></tr>
              {STAT_ROWS.map(({ key, label }) => (
                <tr key={"stat-" + key}>
                  <th scope="row">{label}</th>
                  <td>{left.stats[key]}</td>
                  <td>{right.stats[key]}</td>
                </tr>
              ))}
              <tr className="deployment-comparison-group"><th colSpan={3} scope="rowgroup">成長率</th></tr>
              {STAT_ROWS.map(({ key, label }) => (
                <tr key={"growth-" + key}>
                  <th scope="row">{label}</th>
                  <td>{left.growthRates[key]}%</td>
                  <td>{right.growthRates[key]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="helper-text" aria-live="polite">比較する味方を2人選択すると、差を確認できます。</p>
      )}
      <p className="helper-text deployment-comparison-note">
        能力値・成長率は登録済みデータの表示です。数値から優劣や将来の成長結果を判定せず、成長判定・乱数・出撃人数ルールには影響しません。
      </p>
    </section>
  );
}
