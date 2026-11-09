# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-09
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1〜#5はマージ済み。PR #5のマージコミット: `d63981b9a51e36286a53ebfc1922bbaba2d6fafc`
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- PR #5 latest head (`e02012e4`) CI run #90: TypeScript型チェック成功、9 test files／54 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 initial implementation head (`4c8efb0b`) CI run #112: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 UI-complete head (`b09ebc61`) CI run #116: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- 現在の開発対象: 経験値報酬、レベルアップ、ステージ結果表示。
- Node.js 26、npm、Vitest 5.0.0。
- Game save schema: `saveVersion: 2`。今回のフェイズ進行ではGameStateの形を変更しない。

## 2. 機能別ステータス

| 機能 | 状況 | 関連ファイル |
|---|---|---|
| React／Vite／PWA | 実装済み | `package.json`, `vite.config.ts`, `src/main.tsx` |
| 10×10マップ・地形 | 実装済み（仮コンテンツ） | `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` |
| 味方ユニット移動 | 実装済み | `src/domain/movement/` |
| 仮武器・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` |
| 戦闘予測・プレイヤー攻撃 | 実装済み | `src/domain/combat/`, `src/application/perform-attack.ts` |
| RNG state・save migration | 実装済み（saveVersion 2） | `src/domain/random/`, `src/persistence/migrations.ts` |
| 自軍フェイズ終了／敵軍開始 | 実装済み | `src/application/resolve-enemy-phase.ts`, `src/App.tsx` |
| 敵AI（攻撃対象評価） | 基本実装・暫定スコア | `src/application/resolve-enemy-phase.ts` |
| 敵AI（移動後攻撃／接近／待機） | 基本実装 | 同上、`src/domain/movement/` |
| 敵行動順の固定 | 実装済み（ID辞書順） | `src/application/resolve-enemy-phase.ts` |
| 敵軍フェイズ／AI／勝敗判定テスト | 実装済み | `src/application/resolve-enemy-phase.test.ts`, `src/domain/rules/evaluate-battle-outcome.test.ts` | 9 test files／54 tests、GitHub Actions run #90成功 |
| ターン進行・行動フラグreset | 実装済み | 同上 |
| 敵軍フェイズ中セーブからの再開 | 実装済み | `src/App.tsx`, `src/persistence/save-repository.ts` |
| 勝利（defeat_all／defeat_boss） | 実装済み | `src/domain/rules/evaluate-battle-outcome.ts` |
| 敗北（味方全滅） | 実装済み | 同上 |
| 主人公個別撃破による敗北 | 未実装（主人公IDなし） | 未定義 |
| 戦闘後リザルト／報酬 | 未実装 | — |
| 経験値・レベルアップ・クラスチェンジ | 未実装 | — |
| 経験値報酬 | 実装済み（設計書§5.3の初期案） | `src/application/perform-attack.ts` | application tests |
| レベルアップ・個別成長判定 | 実装済み（仮クラス上限） | `src/domain/progression/level-up.ts`, `src/content/classes.ts` | progression tests |
| ステージ結果表示 | 実装済み（勝敗・撃破数・生存味方のLv/EXP/HP） | `src/App.tsx` | UI手動確認未実施 |
| 選択ユニットの経験値表示 | 実装済み（EXP x/100） | `src/App.tsx` | CI build。実機操作未確認 |
| progression／attack tests | 実装済み | `src/domain/progression/level-up.test.ts`, `src/application/perform-attack.test.ts` | 10 test files／66 tests、GitHub Actions run #112成功 |
| クラスチェンジ | 未実装 | — |
| 敵の役割タグ／AI優先度 | 未実装 | — |
| 砦のフェイズ開始回復 | 未実装（10%回復の整数端数未決定） | `docs/game-design.md` §4.2 |
| UI／スマートフォン実機確認 | 未実施 | — |

## 3. 検証コマンド

`npm run typecheck`、`npm test`、`npm run build` をGitHub Actionsで実行する。PR #6のrun #112で型チェック、10 test files／66 tests、本番ビルド、PWA precache 11 entriesを確認。ローカルnpm実行およびブラウザ／スマートフォン実機確認は未実施。

## 4. 暫定・未決定事項

- 仮武器能力値・Manhattan距離は正式仕様ではない。
- AI対象スコアと移動先評価は初期ヒューリスティックで、実プレイ調整が必要。
- 役割タグは現在のユニットモデルにないためスコア対象外。
- 敗北条件は味方全滅のみ。主人公個別撃破は主人公識別データがないため保留。
- 砦回復は設計書に記載があるが、処理／端数規則未確定のため未実装。
- クラス上限はHP60／他能力30の暫定共通値。正式なクラス別上限ではない。
- 1戦闘中に複数回ダメージを与えた場合、現行はstrikeごとに+10 EXPを付与する解釈。
- HP成長時は最大HPのみ増やし、現在HPは維持。
- 詳細統計・加入・報酬・クラスチェンジ・キャンペーン進行は未実装。
- ブラウザ統合テスト・モバイル実機・IndexedDB再開動作は未実施。

## 5. 次の作業候補

1. AIの行動スコアをプレイテストして調整。
2. リザルト、経験値・撃破報酬、レベルアップ。
3. 主人公識別と敗北条件、砦回復の端数規則を決定。
4. 1ステージの開始からクリアまでをブラウザで検証。
