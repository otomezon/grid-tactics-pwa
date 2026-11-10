# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-10
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1〜#39はマージ済み。PR #25で昇格仕様監査・実装計画、PR #27でバランス記入表、PR #28で了承済み非数値ベースライン（CP-07〜CP-14／CP-16）の行動消費・初期証付与廃止を実装し、PR #29で昇格状態保持・7経路・明示報酬・満杯時拒否・確認キャンセル時のオートセーブ不変を回帰テストに追加した。PR #29のマージコミットは `35cf355e4b642943208b3f3a56ee57f3fea9c0ca`、CI run #497は22 test files／142 testsとChromium E2E 11件が成功。PR #30でガイド／目次／実装状況の記述をPR #29マージ後の状態へ同期した。PR #30のマージコミットは `bac853ed0b3c22c709c03015117f90675a96a8b7`、CI run #499もtypecheck・22 test files／142 tests・production build・Chromium E2E 11件が成功。PR #31はPR #30のマージ後文書を同期。PR #32ではCP-07／08の境界回帰テスト（EXP 0／99、現在HP 1／満タン、HP上限でのボーナス制限）を追加した。PR #32のマージコミットは `860e64130a754c056d970b11adf272ebca33b2fb`、CI run #503は22 test files／146 tests・Chromium E2E 11件成功。PR #33は文書同期のみで、merge commit `b04947dc3bee010b9e08ab408daf9be76b5a80e6`、CI run #505は22 test files／146 tests・Chromium E2E 11件成功。PR #34では、複数の章報酬の後続処理が所持品満杯で失敗した場合に入力snapshotが不変であることを検証するテストを追加した。merge commit `20c7ee2a440628d6ebf3ab197badc688a6ad56f4`、CI run #506は22 test files／147 tests・Chromium E2E 11件成功。PR #35はPR #33・#34の結果を文書へ同期し、merge commit `280cf310ee7b3b4262d470a34e4a188b84f3ecc0`、CI run #509は22 test files／147 tests・Chromium E2E 11件成功。PR #36では昇格確認画面の現行説明（暫定ボーナス、レベル1、EXP保持、証1個消費、行動消費）と確定後のセーブ状態をE2Eで検証し、73 EXPがリロード後も保持されることを確認した。merge commit `0eded6662a6f6e37c22501f6f64303fe988d9f86`、CI run #510は22 test files／147 tests・Chromium E2E 11件成功。PR #38 added the shared class-promotion stat preview and a responsive confirmation panel showing all eight stat results, HP/EXP effects, item/action cost, and preserved movement/weapon/equipment; prototype values remain provisional. Its merge commit is `72e32e673d4d02ecdcd4bd2a0c75e8bc2fa7f085`. CI run #527 passed typecheck, 22 test files / 148 unit tests, and production build, but its browser test still expected the previous confirmation copy. PR #39 corrected the UI assertions and verifies all eight stat rows; the repository owner merged it at `aeaa8be6ec1f4f9ae24acb92fae3fd7856cc55fe`. CI run #532 passed typecheck, 22 test files / 148 unit tests, production build, and 11 Chromium E2E tests. CP-15の最終要件は未決定のまま。Issue #26に了承記録がある。PR #23（最大3世代の手動ローカルバックアップ／確認付き復元）のマージコミット: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`。PR #22（バージョン付きJSONセーブexport/import）のマージコミット: `e70206fe92592c0c892171cb1e4d31abf0f53a42`。PR #16（キャンペーン控え名簿・出撃メンバー選択）のマージコミット: `fcbf021ce3fd978eb026251ff6c6005c0f0350f0`。PR #15（章開始前の出撃配置準備）のマージコミット: `4954d65843d4a9a1d0340a6ac36da50e7e09d408`。PR #14（セーブ内ユニットの出撃名簿照合）のマージコミット: `4a22f50680262808157a1232cc3e66909eee9626`。PR #11（章報酬／次章開始フロー）のマージコミット: `29fc033f11a01dda36768a00a6a3a7476cc6de3b`。PR #12（マップ指定ユニット撃破による敗北条件）のマージコミット: `7d9a25e2472cc5bd42529cfe48cb7b313109bcca`。PR #13（マップ定義検証）のマージコミット: `6a775ad1b0f33d3cd335bec7356728219740d9b7`。
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- PR #5 latest head (`e02012e4`) CI run #90: TypeScript型チェック成功、9 test files／54 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 initial implementation head (`4c8efb0b`) CI run #112: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 latest head (`914aca11`) CI run #118: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #17（出撃候補のキャラクター詳細・所持武器確認UI）とPR #18（詳細表示データ整形のテスト）はmainへマージ済み。PR #19でPlaywrightによるブラウザE2Eテスト、PR #20で本番PreviewにおけるPWA manifest／Service Worker／オフライン起動テストを追加し、いずれもCI検証済み。PR #20のマージコミット: `45e5a41ab16da1fd36fbd54967d68cd23b025a96`。PR #21ではService Worker更新時の自動再読み込み、IndexedDBセーブ復元、オフライン再読み込み後の状態保持をCIで検証済み。
- Node.js 26、npm、Vitest 5.0.0。
- Game save schema: `saveVersion: 3`。マップ定義・戦闘ユニット・控え名簿の整合性を検証し、version 1／2から移行する。

## 2. 機能別ステータス

| 機能 | 状況 | 関連ファイル |
|---|---|---|
| React／Vite／PWA | 実装済み | `package.json`, `vite.config.ts`, `src/main.tsx` |
| 10×10マップ・地形 | 実装済み（仮コンテンツ） | `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` |
| 味方ユニット移動 | 実装済み | `src/domain/movement/` |
| 仮武器・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` |
| 戦闘予測・プレイヤー攻撃 | 実装済み | `src/domain/combat/`, `src/application/perform-attack.ts` |
| 敵攻撃範囲の表示切替 | 実装中（自軍フェイズでON／OFF。生存・未行動敵の現在位置と移動可能マス、装備中で使用可能な武器の射程からマスを予測。敵AIの移動先・対象の確定予告ではない。距離は暫定Manhattan。表示状態はセーブしない） | `src/domain/combat/calculate-enemy-threatened-tiles.ts`, `src/App.tsx`, `src/styles.css` | 本PRのE2E／CI検証中 |
| RNG state・save migration | 実装済み（saveVersion 3、version 1／2→3） | `src/domain/random/`, `src/persistence/migrations.ts` |
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
| マップ定義の整合性検証 | 実装済み（terrain寸法／値、配置ID／座標の重複・範囲、ボス／敗北対象の所属陣営を検証） | `src/domain/models/validate-game-map.ts` |
| セーブ内ユニットの出撃名簿整合性 | 実装済み（各unit IDとfactionがマップ出撃名簿に一致。撃破済みユニットの欠落は許可） | `src/domain/models/validate-game-state.ts` |
| 出撃準備・配置確定 | 実装済み（生存中の候補／控えから出撃メンバーを選択、位置設定、非選択者の控え保存。saveVersion 3で永続化）。正式な章ごとの人数条件は未決定。上限はマップ候補数 | `src/application/prepare-player-deployment.ts`, `src/App.tsx` |
| 出撃候補のキャラクター詳細・所持武器確認 | 実装済み（PR #17。クラス・能力・移動・武器適性・武器性能・所持アイテムの閲覧）。閲覧専用。インベントリ整形は専用単体テストで検証。ブラウザ／スマートフォンでの表示確認は未実施 | `src/App.tsx`, `src/styles.css`, `src/application/get-deployment-unit-details.ts` |
| ステージ結果概要表示 | 実装済み（PR #6、勝敗・敵撃破数・生存味方のLv／EXP／HP） | `src/App.tsx` | UI手動確認未実施 |
| 詳細リザルト統計・会話／加入イベント・キャンペーン選択／分岐 | 未実装 | — |
| 経験値・レベルアップ | 実装済み（PR #6） | `src/domain/progression/level-up.ts`, `src/application/perform-attack.ts` |
| 経験値報酬 | 実装済み（設計書§5.3の初期案） | `src/application/perform-attack.ts` | application tests |
| レベルアップ・個別成長判定 | 実装済み（仮クラス上限） | `src/domain/progression/level-up.ts`, `src/content/classes.ts` | progression tests |
| ステージ結果表示 | 実装済み（勝敗・撃破数・生存味方のLv/EXP/HP） | `src/App.tsx` | UI手動確認未実施 |
| 選択ユニットの経験値表示 | 実装済み（EXP x/100） | `src/App.tsx` | CI build。実機操作未確認 |
| progression／attack／class-change／content tests | mainのPR #6〜#7と今回のPR #8で実装済み | `src/domain/progression/`, `src/application/`, `src/content/class-promotion.test.ts` | GitHub Actions run #168: 13 test files／78 tests成功 |
| 昇格先パス | 実装済み（設計書§5.5の7系統） | `src/content/classes.ts` | mapping tests |
| クラスチェンジ条件・アイテム消費・能力ボーナス適用 | ルール基盤実装済み。採択済みCP-12により移動・行動前のみ実行可、成功時に行動済みとなる。CP-09／10の移動・武器適性・装備維持、7経路すべての一段階昇格を回帰テスト化。PR #32でCP-07／08のEXP 0／99保持、現在HP 1／満タン維持、HP上限でのボーナス制限を追加 | `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts`, `src/domain/progression/class-change.test.ts`, `src/content/class-promotion.test.ts` | PR #32 CI run #503: 22 test files／146 tests、Chromium E2E 11件成功 |
| クラスチェンジアイテム定義・所持品表示 | アイテム定義と表示は実装済み。採択済みCP-13により初期付与を廃止し、章報酬／イベント定義による配布のみ許可。具体的な報酬は未登録。PR #29で明示報酬は勝利後のみ付与、所持枠満杯時は状態を変更せず拒否することを検証 | `src/content/items.ts`, `src/content/maps/chapter-01.ts`, `src/application/apply-chapter-rewards.ts`, `src/App.tsx` | PR #29 CI run #497: chapter-reward tests passed |
| クラスチェンジUI・確認・自動保存接続 | 実装済み（Lv.10／証所持／自軍フェイズ／未移動・未行動条件。確定でユニットの行動を消費）。確認画面に8能力の現在値・昇格後予測・実増加量・仮上限、最大HP／現在HP、Lv.1化・EXP保持、証消費、移動／武器適性／装備の維持、行動消費を表示する（暫定表示でありCP-15の最終仕様ではない） | `src/App.tsx`, `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts` | PR #38で8能力の現在値・昇格後値・実増加量・仮上限、HP／EXP等の影響を表示。PR #39で8能力すべての画面表示、暫定上限超過値の維持、キャンセル時のセーブ不変、確定後の状態保持をE2E検証。PR #39ブランチCI run #530: typecheck、22 test files／148 tests、production build、Chromium E2E 11件すべて成功（PR #39はマージ待ち） |
| 正式な昇格ボーナス・上限・昇格後移動／武器データ | 未決定（現行は仮値） | `src/content/classes.ts` | playtest／仕様決定待ち |
| 敵の役割タグ／AI優先度 | 未実装 | — |
| 砦のフェイズ開始回復 | 実装済み（該当陣営の生存ユニット／最大HPの10%／端数切り捨ては暫定） | `src/domain/rules/apply-fort-recovery.ts`, `src/application/resolve-enemy-phase.ts` |
| 章間引き継ぎ・次章開始UI | 実装済み（章レジストリ、章ID別マップ復元、勝利後の次章開始、レベル／能力／所持品引き継ぎ、撃破者除外、RNG継続、auto slot保存） | `src/content/chapters.ts`, `src/application/prepare-next-chapter.ts`, `src/App.tsx` | 次章は遷移確認用の試作データ |
| 章報酬 | データ駆動の適用処理実装済み（章定義のitemId／recipient／quantityを検証して配布。各所持品5枠上限） | `src/application/apply-chapter-rewards.ts`, `src/content/chapters.ts` | 現在登録した試作章の報酬は空配列。実際の報酬内容・数量は未決定 |
| 第2章マップ | 試作データ実装済み（第1章からの遷移とセーブ復元を確認するための仮配置） | `src/content/maps/chapter-02.ts` | 正式なマップ／敵構成ではない |
| ブラウザE2E（出撃準備・控え保存・行動状態復元・敵軍フェイズ／ターン復元・モバイル幅） | 実装済み（Playwright 4ケース、CI run #374成功） | `playwright.config.ts`, `e2e/campaign.spec.ts`, `.github/workflows/ci.yml` |
| PWA manifest／Service Worker／オフライン起動E2E | 実装済み（PR #20、本番Previewで2ケースをCI検証） | `playwright.config.ts`, `e2e/pwa.spec.ts`, `vite.config.ts` |
| Service Worker更新・自動再読み込み後のセーブ復元E2E | 実装済み（PR #21、CI run #408で更新／オンライン／オフライン復元を検証） | `e2e/pwa-preview-server.mjs`, `e2e/pwa.spec.ts` |
| ローカルセーブのJSON書き出し／読み込み | 実装済み（PR #22でmainへマージ済み。バージョン付きJSON、章・マップ・saveVersion検証、上書き前確認、不正ファイルによる既存セーブ保護） | `src/persistence/save-file.ts`, `src/persistence/save-file.test.ts`, `src/App.tsx`, `e2e/pwa.spec.ts` |
| ローカルセーブの3世代バックアップ | 実装済み（PR #23でmainへマージ済み。最大3世代、4回目の最古ローテーション、auto不変、確認付き復元、migration／validatorによる不正データ拒否） | `src/persistence/save-repository.ts`, `src/App.tsx`, `e2e/pwa.spec.ts` |
| UI／スマートフォン実機確認 | 未実施 | — |

## 3. 検証コマンド

`npm run typecheck`、`npm test`、`npm run build` をGitHub Actionsで実行する。PR #8 latest headで型チェック、13 test files／78 tests、本番ビルドが成功。PR #9をmainへ同期したhead（run #201）でTypeScript型チェック成功、15 test files／93 tests成功、Vite build成功、PWA precache 11 entries（282.60 KiB）を確認。章レジストリ／報酬／画面接続の実装head（run #226）ではTypeScript型チェック成功、17 test files／103 tests成功、Vite build成功、PWA precache 11 entries（289.58 KiB）を確認。PR #11 merge後のmain（run #235）、PR #12 merge後のmain（run #248）、PR #13 merge後のmain（run #266）とPR #14 merge後のmain（run #280）も成功。PR #18のmainマージ後CI（run #360）では既存のTypeScript型チェック、20 test files／131 tests、Vite buildが成功。PR #19のブランチCI（run #374）ではTypeScript型チェック、20 test files／131 tests、Vite buildに加え、ChromiumブラウザE2E 4ケースが成功。PR #20のCI run #392では20 test files／131 tests、Vite build、ChromiumブラウザE2E 6ケースが成功。PR #21のCI run #408では20 test files／131 tests、Vite build、ChromiumブラウザE2E 7ケース（Service Worker更新／オンライン・オフラインのセーブ復元を含む）が成功。PR #22の最終CI run #42730207663（同一headのpush run #42730200764も成功）では21 test files／136 tests、Vite build、ChromiumブラウザE2E 9ケース（セーブ書き出し／別コンテキスト復元／不正ファイル拒否を含む）が成功。ローカルnpm実行およびブラウザ／スマートフォン実機確認は未実施。

## 4. 暫定・未決定事項

- 仮武器能力値・Manhattan距離は正式仕様ではない。
- AI対象スコアと移動先評価は初期ヒューリスティックで、実プレイ調整が必要。
- 役割タグは現在のユニットモデルにないためスコア対象外。
- 敗北条件は味方全滅に加え、マップが `defeatCondition: { type: "unit_defeated", targetUnitId }` を設定すれば指定味方の撃破でも成立する。主人公の正式IDは未決定のため試作マップでは未設定。
- 砦回復は実装済み。端数切り捨ては暫定判断で、設計書に正式規則はない。最大HP9以下では回復量0。
- クラス上限はHP60／他能力30の暫定共通値。正式なクラス別上限ではない。昇格確認画面では仮上限適用後の実増加量を表示するが、CP-15の最終表示要件は未決定。
- 1戦闘中に複数回ダメージを与えた場合、現行はstrikeごとに+10 EXPを付与する解釈。
- HP成長時は最大HPのみ増やし、現在HPは維持。
- 正式な章マップ／敵構成／報酬品目・数量、会話／加入イベント、キャンペーン選択／分岐／解放管理は未実装。第2章はUI／引き継ぎ確認用の試作データ。クラスチェンジ証は採択済みCP-13に従い章報酬／イベントのみで配布するが、具体的な報酬定義は未登録。CP-04／CP-05の正式な数値バランスは未決定。
- マップ定義validatorは主要な構造・参照整合性を検証し、セーブ状態validatorはユニットID／陣営を出撃名簿と照合する。ただし地形と移動種別の通行可否や実際のプレイバランスは検証しない。
- 出撃準備のメンバー選択・控え保存・章間引き継ぎと、候補詳細のインベントリ表示データ整形はCIテスト対象。ブラウザ／スマートフォン実機でのUI／IndexedDB通し確認は未実施。
- PlaywrightによるChromium E2Eは出撃準備・名簿保存・行動状態復元・敵軍フェイズ／ターン復元・幅390pxのレイアウトを確認済み。PWA manifest／Service Worker／precache／オフライン起動も本番Previewで検証済み。Service Worker更新時の自動再読み込みとセーブ復元はPR #21で検証済み。セーブファイルのexport/importはPR #22のCIで単体・ブラウザテスト済み（mainマージ済み）。3世代バックアップはPR #23の最終CI run #42734263896でtypecheck・unit tests（21 files／136 tests）・production build・Chromium E2E（10 cases）がすべて成功。 PR #29マージheadのCI run #497ではtypecheck・unit tests（22 files／142 tests）・production build・Chromium E2E（11 cases）がすべて成功。PR #30のマージheadのCI run #499でも同じくtypecheck・22 files／142 tests・production build・Chromium E2E 11 casesがすべて成功。PR #32のマージheadのCI run #503ではtypecheck・22 files／146 tests・production build・Chromium E2E 11 casesがすべて成功。PR #23はmainへマージ済み（merge commit: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`）。実スマートフォンへのインストール・オフライン操作の手動確認は未実施。

## 5. 次の作業候補

1. [クラスチェンジ仕様・未決定事項と実装計画](class-promotion.md) と記入表に沿って、CP-04／CP-05の7経路ボーナス／14クラス上限をプレイテストで決定する。CP-01〜CP-06／CP-15の未決事項を整理する。
2. 章報酬・イベントの具体的な品目／受取人／数量を決定し、採択済みCP-13に従ってクラスチェンジ証を配布する。
3. 主人公の正式IDを決定し、各章マップへ敗北対象として設定。砦回復の端数規則も確定。
4. 出撃準備から1ステージの開始・クリアまでをブラウザ／スマートフォンで検証し、加入／離脱と章別編成候補の正式仕様を設計。
