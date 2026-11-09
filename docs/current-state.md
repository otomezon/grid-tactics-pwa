# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-09
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1〜#11はすべてマージ済み。PR #11（章報酬／次章開始フロー）のマージコミット: `29fc033f11a01dda36768a00a6a3a7476cc6de3b`。
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- PR #5 latest head (`e02012e4`) CI run #90: TypeScript型チェック成功、9 test files／54 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 initial implementation head (`4c8efb0b`) CI run #112: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 latest head (`914aca11`) CI run #118: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- 現在の開発対象: 章レジストリ、データ駆動の章報酬、リザルトからの次章開始、章IDに応じたセーブ復元を接続。
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
| マップ指定ユニット撃破による敗北 | ルール実装済み（`defeatCondition.targetUnitId`）。既存試作マップは主人公ID未決定のため未設定 | `src/domain/rules/evaluate-battle-outcome.ts`, `src/domain/models/game.ts` |
| ステージ結果概要表示 | 実装済み（PR #6、勝敗・敵撃破数・生存味方のLv／EXP／HP） | `src/App.tsx` | UI手動確認未実施 |
| 詳細リザルト統計・会話／加入イベント・キャンペーン選択／分岐 | 未実装 | — |
| 経験値・レベルアップ | 実装済み（PR #6） | `src/domain/progression/level-up.ts`, `src/application/perform-attack.ts` |
| 経験値報酬 | 実装済み（設計書§5.3の初期案） | `src/application/perform-attack.ts` | application tests |
| レベルアップ・個別成長判定 | 実装済み（仮クラス上限） | `src/domain/progression/level-up.ts`, `src/content/classes.ts` | progression tests |
| ステージ結果表示 | 実装済み（勝敗・撃破数・生存味方のLv/EXP/HP） | `src/App.tsx` | UI手動確認未実施 |
| 選択ユニットの経験値表示 | 実装済み（EXP x/100） | `src/App.tsx` | CI build。実機操作未確認 |
| progression／attack／class-change／content tests | mainのPR #6〜#7と今回のPR #8で実装済み | `src/domain/progression/`, `src/application/`, `src/content/class-promotion.test.ts` | GitHub Actions run #168: 13 test files／78 tests成功 |
| 昇格先パス | 実装済み（設計書§5.5の7系統） | `src/content/classes.ts` | mapping tests |
| クラスチェンジ条件・アイテム消費・能力ボーナス適用 | ルール基盤実装済み（ボーナス／上限／EXP方針は外部設定） | `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts` | GitHub Actions run #142で12 test files／75 tests成功 |
| 試作クラスチェンジアイテム・所持品表示 | 実装済み（新規初期状態の味方01に1個） | `src/content/items.ts`, `src/content/maps/chapter-01.ts`, `src/App.tsx` | content tests |
| クラスチェンジUI・確認・自動保存接続 | 実装済み（Lv.10／証所持／自軍フェイズ条件） | `src/App.tsx`, `src/application/perform-class-change.ts` | typecheck／build。画面手動確認は未実施 |
| 正式な昇格ボーナス・上限・昇格後移動／武器データ | 未決定（現行は仮値） | `src/content/classes.ts` | playtest／仕様決定待ち |
| 敵の役割タグ／AI優先度 | 未実装 | — |
| 砦のフェイズ開始回復 | 実装済み（該当陣営の生存ユニット／最大HPの10%／端数切り捨ては暫定） | `src/domain/rules/apply-fort-recovery.ts`, `src/application/resolve-enemy-phase.ts` |
| 章間引き継ぎ・次章開始UI | 実装済み（章レジストリ、章ID別マップ復元、勝利後の次章開始、レベル／能力／所持品引き継ぎ、撃破者除外、RNG継続、auto slot保存） | `src/content/chapters.ts`, `src/application/prepare-next-chapter.ts`, `src/App.tsx` | 次章は遷移確認用の試作データ |
| 章報酬 | データ駆動の適用処理実装済み（章定義のitemId／recipient／quantityを検証して配布。各所持品5枠上限） | `src/application/apply-chapter-rewards.ts`, `src/content/chapters.ts` | 現在登録した試作章の報酬は空配列。実際の報酬内容・数量は未決定 |
| 第2章マップ | 試作データ実装済み（第1章からの遷移とセーブ復元を確認するための仮配置） | `src/content/maps/chapter-02.ts` | 正式なマップ／敵構成ではない |
| UI／スマートフォン実機確認 | 未実施 | — |

## 3. 検証コマンド

`npm run typecheck`、`npm test`、`npm run build` をGitHub Actionsで実行する。PR #8 latest headで型チェック、13 test files／78 tests、本番ビルドが成功。PR #9をmainへ同期したhead（run #201）でTypeScript型チェック成功、15 test files／93 tests成功、Vite build成功、PWA precache 11 entries（282.60 KiB）を確認。章レジストリ／報酬／画面接続の実装head（run #226）ではTypeScript型チェック成功、17 test files／103 tests成功、Vite build成功、PWA precache 11 entries（289.58 KiB）を確認。PR #11 merge後のmain（run #235）も成功。ローカルnpm実行およびブラウザ／スマートフォン実機確認は未実施。

## 4. 暫定・未決定事項

- 仮武器能力値・Manhattan距離は正式仕様ではない。
- AI対象スコアと移動先評価は初期ヒューリスティックで、実プレイ調整が必要。
- 役割タグは現在のユニットモデルにないためスコア対象外。
- 敗北条件は味方全滅に加え、マップが `defeatCondition: { type: "unit_defeated", targetUnitId }` を設定すれば指定味方の撃破でも成立する。主人公の正式IDは未決定のため試作マップでは未設定。
- 砦回復は実装済み。端数切り捨ては暫定判断で、設計書に正式規則はない。最大HP9以下では回復量0。
- クラス上限はHP60／他能力30の暫定共通値。正式なクラス別上限ではない。
- 1戦闘中に複数回ダメージを与えた場合、現行はstrikeごとに+10 EXPを付与する解釈。
- HP成長時は最大HPのみ増やし、現在HPは維持。
- 正式な章マップ／敵構成／報酬品目・数量、会話／加入イベント、キャンペーン選択／分岐／解放管理は未実装。第2章はUI／引き継ぎ確認用の試作データ。クラスチェンジアイテムの正式な入手・配布ルールも未決定。
- ブラウザ統合テスト・モバイル実機・IndexedDB再開動作は未実施。

## 5. 次の作業候補

1. クラス別の正式上限・昇格ボーナス・EXP方針と昇格後移動／武器データを決定。
2. 章報酬・章間引き継ぎ・次ステージ解放を設計し、証の正式な配布経路を追加。
3. 主人公の正式IDを決定し、各章マップへ敗北対象として設定。砦回復の端数規則も確定。
4. 1ステージの開始からクリアまでをブラウザ／スマートフォンで検証。
