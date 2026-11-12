import { useMemo, useState } from "react";
import { CLASS_DISPLAY_NAMES, CLASS_PROMOTION_TARGETS, getClassDisplayName } from "../content/classes";
import type { UnitStats } from "../domain/models/game";
import {
  PROTOTYPE_GROWTH_PROFILES,
  PROTOTYPE_PROMOTION_SCENARIOS,
  type PrototypeGrowthProfileId
} from "../test-support/class-promotion-balance-scenarios";

const STAT_ROWS: readonly { key: keyof UnitStats; label: string }[] = [
  { key: "hp", label: "HP" },
  { key: "strength", label: "力" },
  { key: "magic", label: "魔力" },
  { key: "skill", label: "技" },
  { key: "speed", label: "速さ" },
  { key: "luck", label: "幸運" },
  { key: "defense", label: "守備" },
  { key: "resistance", label: "魔防" }
];

const PROMOTION_PATHS = Object.entries(CLASS_PROMOTION_TARGETS).map(
  ([sourceClassId, targetClassId]) => ({ sourceClassId, targetClassId })
);

const PROFILE_LABELS: Record<PrototypeGrowthProfileId, string> = {
  low: "低成長（10 percentile）",
  median: "中央値（50 percentile）",
  high: "上位（90 percentile）"
};

export function ClassPromotionLab() {
  const [sourceClassId, setSourceClassId] = useState(PROMOTION_PATHS[0]!.sourceClassId);
  const [profileId, setProfileId] = useState<PrototypeGrowthProfileId>("low");

  const scenario = useMemo(
    () => PROTOTYPE_PROMOTION_SCENARIOS.find(
      (entry) => entry.sourceClassId === sourceClassId && entry.profileId === profileId
    ) ?? PROTOTYPE_PROMOTION_SCENARIOS[0]!,
    [sourceClassId, profileId]
  );
  const profile = PROTOTYPE_GROWTH_PROFILES.find((entry) => entry.id === scenario.profileId)!;

  return (
    <main className="promotion-lab" data-testid="promotion-lab">
      <header className="promotion-lab-header">
        <div>
          <p className="eyebrow">DEVELOPMENT ONLY · SYNTHETIC FIXTURES</p>
          <h1>昇格バランス試験室</h1>
          <p className="promotion-lab-lead">
            現行の仮ボーナス・仮上限を使った、再現可能な能力値previewです。実プレイ結果や正式バランスではありません。
          </p>
        </div>
        <a className="secondary-button promotion-lab-back" href="/">キャンペーンへ戻る</a>
      </header>

      <section className="promotion-lab-card" aria-labelledby="promotion-lab-controls-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">SCENARIO SELECT</p>
            <h2 id="promotion-lab-controls-heading">試験ケース</h2>
          </div>
          <span className="promotion-lab-count">21ケース</span>
        </div>
        <div className="promotion-lab-controls">
          <label>
            <span>昇格経路</span>
            <select
              id="promotion-lab-class"
              aria-label="昇格経路"
              value={sourceClassId}
              onChange={(event) => setSourceClassId(event.target.value)}
            >
              {PROMOTION_PATHS.map(({ sourceClassId: source, targetClassId }) => (
                <option key={source} value={source}>
                  {getClassDisplayName(source)} → {getClassDisplayName(targetClassId)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>合成成長profile</span>
            <select
              id="promotion-lab-profile"
              aria-label="合成成長profile"
              value={profileId}
              onChange={(event) => setProfileId(event.target.value as PrototypeGrowthProfileId)}
            >
              {PROTOTYPE_GROWTH_PROFILES.map((entry) => (
                <option key={entry.id} value={entry.id}>{PROFILE_LABELS[entry.id]}</option>
              ))}
            </select>
          </label>
        </div>
        <p className="promotion-lab-profile" data-testid="promotion-lab-profile-summary">
          {PROFILE_LABELS[profile.id]} · seed: {profile.seed} · 9回の合計成長数: {profile.totalStatGains}
        </p>
      </section>

      <section className="promotion-lab-card" aria-labelledby="promotion-lab-preview-heading">
        <div className="promotion-lab-section-heading">
          <div>
            <p className="eyebrow">STAT PREVIEW</p>
            <h2 id="promotion-lab-preview-heading">
              {CLASS_DISPLAY_NAMES[scenario.sourceClassId] ?? scenario.sourceClassId} → {getClassDisplayName(scenario.targetClassId)}
            </h2>
          </div>
          <span className="promotion-lab-provisional">試作値</span>
        </div>
        <div className="promotion-lab-table-wrap">
          <table className="promotion-lab-table" aria-label="昇格能力値preview">
            <thead>
              <tr>
                <th scope="col">能力</th>
                <th scope="col">昇格しない場合</th>
                <th scope="col">昇格preview</th>
                <th scope="col">要求ボーナス</th>
                <th scope="col">実増加</th>
                <th scope="col">仮上限</th>
              </tr>
            </thead>
            <tbody>
              {STAT_ROWS.map(({ key, label }) => {
                const change = scenario.changes.find((entry) => entry.key === key)!;
                return (
                  <tr key={key} data-testid={"promotion-lab-stat-" + key}>
                    <th scope="row">{label}</th>
                    <td>{change.currentValue}</td>
                    <td>{change.nextValue}</td>
                    <td>+{change.requestedBonus}</td>
                    <td>+{change.appliedBonus}</td>
                    <td>{change.cap}{change.currentValueExceedsCap ? "（既存値を維持）" : ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <dl className="promotion-lab-impact">
          <div><dt>基本職Lv.</dt><dd>10 → 1</dd></div>
          <div><dt>EXP</dt><dd>{profile.experience}（保持）</dd></div>
          <div><dt>合成fixture</dt><dd>{profile.percentile} percentile · seed {profile.seed}</dd></div>
          <div><dt>比較単位</dt><dd>8能力のstat previewのみ</dd></div>
        </dl>
      </section>

      <section className="promotion-lab-card promotion-lab-caveats" aria-labelledby="promotion-lab-limits-heading">
        <p className="eyebrow">SCOPE & LIMITS</p>
        <h2 id="promotion-lab-limits-heading">試験室の範囲</h2>
        <ul>
          <li>low／median／highは固定seed 1〜1024の合成分布内の10／50／90 percentileです。プレイヤーの実成長分布ではありません。</li>
          <li>現在値と昇格previewの比較は能力値だけです。戦闘・移動・武器射程・敵AIのsimulationは行いません。</li>
          <li>本編のGameState、戦闘RNG、IndexedDB、自動保存、セーブデータは読み書きしません。</li>
          <li>実際の昇格では証1個と当該フェイズの行動を消費します。HP／EXP／移動／武器／装備の適用は本編側の採択済みルールに従います。</li>
          <li>CP-04／05の正式数値決定には、実プレイsnapshotを使う21ケースの統制試験が別途必要です。</li>
        </ul>
      </section>
      <footer className="promotion-lab-footer">
        <span>この画面は開発サーバーでのみ表示されます。本番ビルドでは無効です。</span>
        <a href="/">通常のキャンペーンに戻る</a>
      </footer>
    </main>
  );
}
