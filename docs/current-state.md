# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-11
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1〜#63はマージ済み。PR #54ではブラウザ標準のPWAインストールプロンプトと、非対応ブラウザ向けの手動追加案内を追加した（merge commit `146c5952713f1cae3916fcde3e0f8a2407f995e1`、main CI run #643成功）。PR #55では既存の勝利／敗北条件と地形定義を参照する目標進行・マス情報パネルを追加した。PR #56では、味方攻撃と敵軍フェイズの実行結果をターン順にまとめたセッション内戦闘履歴を追加し、地形情報パネルのポインターフォーカスによるマップ位置ずれも修正した（merge commit `c7c9d9ced4cd226b9c25cba7ab6d59e82b924910`、CI run #675でChromium E2E 23件成功）。PR #57ではセーブ内ユニットの地形通行可否を検証した（merge commit `1fc9d6e924e7323d4ea611d1b9649e4e39d408b3`、CI run #679でtypecheck・単体テスト・本番ビルド・Chromium E2E 23件成功）。PR #58ではクラス／武器／アイテムIDの登録整合性、装備武器の適性、および現役ユニットの生存HPもセーブ検証に加えた（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。saveVersion 3とDB形式は維持。PR #59では、移動可能マスの累計コスト表示と、ポインター／キーボードフォーカス時の最小コスト経路プレビューを追加した。タッチ操作では最初のタップで経路を表示し、同じマスへの2回目のタップで移動を確定する。プレビューは一時UI状態で、移動確定まではGameState／オートセーブを変更しない（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60ではタッチ操作に1回目プレビュー・2回目確定を追加した（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。PR #61では任意で開閉できる6段階の操作ガイドを追加した。今回のPR #62では戦闘マップをARIAグリッドとして行・列で構造化し、1つのTab停止位置、矢印キー移動、Home／Endの行端移動、フォーカス連動の地形／移動経路表示を追加した。フォーカス移動はGameState／オートセーブを変更しない。PR #63では生存・出撃中の味方だけを一覧化し、HP・移動／行動フラグを表示、クリックで対応マスを選択・表示領域へスクロールできる。控え名簿は含まず、セーブ形式は変更しない。PR #25で昇格仕様監査・実装計画、PR #27でバランス記入表、PR #28で了承済み非数値ベースライン（CP-07〜CP-14／CP-16）の行動消費・初期証付与廃止を実装し、PR #29で昇格状態保持・7経路・明示報酬・満杯時拒否・確認キャンセル時のオートセーブ不変を回帰テストに追加した。PR #29のマージコミットは `35cf355e4b642943208b3f3a56ee57f3fea9c0ca`、CI run #497は22 test files／142 testsとChromium E2E 11件が成功。PR #30でガイド／目次／実装状況の記述をPR #29マージ後の状態へ同期した。PR #30のマージコミットは `bac853ed0b3c22c709c03015117f90675a96a8b7`、CI run #499もtypecheck・22 test files／142 tests・production build・Chromium E2E 11件が成功。PR #31はPR #30のマージ後文書を同期。PR #32ではCP-07／08の境界回帰テスト（EXP 0／99、現在HP 1／満タン、HP上限でのボーナス制限）を追加した。PR #32のマージコミットは `860e64130a754c056d970b11adf272ebca33b2fb`、CI run #503は22 test files／146 tests・Chromium E2E 11件成功。PR #33は文書同期のみで、merge commit `b04947dc3bee010b9e08ab408daf9be76b5a80e6`、CI run #505は22 test files／146 tests・Chromium E2E 11件成功。PR #34では、複数の章報酬の後続処理が所持品満杯で失敗した場合に入力snapshotが不変であることを検証するテストを追加した。merge commit `20c7ee2a440628d6ebf3ab197badc688a6ad56f4`、CI run #506は22 test files／147 tests・Chromium E2E 11件成功。PR #35はPR #33・#34の結果を文書へ同期し、merge commit `280cf310ee7b3b4262d470a34e4a188b84f3ecc0`、CI run #509は22 test files／147 tests・Chromium E2E 11件成功。PR #36では昇格確認画面の現行説明（暫定ボーナス、レベル1、EXP保持、証1個消費、行動消費）と確定後のセーブ状態をE2Eで検証し、73 EXPがリロード後も保持されることを確認した。merge commit `0eded6662a6f6e37c22501f6f64303fe988d9f86`、CI run #510は22 test files／147 tests・Chromium E2E 11件成功。PR #38 added the shared class-promotion stat preview and a responsive confirmation panel showing all eight stat results, HP/EXP effects, item/action cost, and preserved movement/weapon/equipment; prototype values remain provisional. Its merge commit is `72e32e673d4d02ecdcd4bd2a0c75e8bc2fa7f085`. CI run #527 passed typecheck, 22 test files / 148 unit tests, and production build, but its browser test still expected the previous confirmation copy. PR #39 corrected the UI assertions and verifies all eight stat rows; the repository owner merged it at `aeaa8be6ec1f4f9ae24acb92fae3fd7856cc55fe`. CI run #532 passed typecheck, 22 test files / 148 unit tests, production build, and 11 Chromium E2E tests. PR #40の最終head CI run #560はtypecheck、23 test files／154 unit tests、production build、Chromium E2E 12件成功。PR #41でステージ結果詳細を追加し、オーナーが `30ebbfcc155a0d8a533ff8d5ef7a2debc9c85c5c` でマージ。マージ後CI run #42827297778も成功。PR #42で敵軍フェイズの一時行動記録を追加し、オーナーが `8b5b3b583ad4cd6f7fae3f2cccd8b8ebbefe0e4f` でマージ。CI run #583は24 test files／158 testsとChromium E2E 14件成功。PR #43で味方攻撃のstrike別実行記録を追加し、オーナーが `8f0a3d023afab1a379dce99147f59bc9770084bb` でマージ。CI run #587は25 test files／161 testsとChromium E2E 15件成功。PR #44では320px幅で40px以上のタイルを維持する横スクロール領域、キーボード操作、タッチ入力によるユニット選択を追加し、`ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba` でマージ。CI run #596はtypecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功。狭幅マップの動作はChromiumで検証済みだが、実機スマートフォンは別途確認が必要。CP-15の最終要件は未決定のまま。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。Issue #26に了承記録がある。PR #23（最大3世代の手動ローカルバックアップ／確認付き復元）のマージコミット: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`。PR #22（バージョン付きJSONセーブexport/import）のマージコミット: `e70206fe92592c0c892171cb1e4d31abf0f53a42`。PR #16（キャンペーン控え名簿・出撃メンバー選択）のマージコミット: `fcbf021ce3fd978eb026251ff6c6005c0f0350f0`。PR #15（章開始前の出撃配置準備）のマージコミット: `4954d65843d4a9a1d0340a6ac36da50e7e09d408`。PR #14（セーブ内ユニットの出撃名簿照合）のマージコミット: `4a22f50680262808157a1232cc3e66909eee9626`。PR #11（章報酬／次章開始フロー）のマージコミット: `29fc033f11a01dda36768a00a6a3a7476cc6de3b`。PR #12（マップ指定ユニット撃破による敗北条件）のマージコミット: `7d9a25e2472cc5bd42529cfe48cb7b313109bcca`。PR #13（マップ定義検証）のマージコミット: `6a775ad1b0f33d3cd335bec7356728219740d9b7`。
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- PR #5 latest head (`e02012e4`) CI run #90: TypeScript型チェック成功、9 test files／54 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 initial implementation head (`4c8efb0b`) CI run #112: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 latest head (`914aca11`) CI run #118: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #17（出撃候補のキャラクター詳細・所持武器確認UI）とPR #18（詳細表示データ整形のテスト）はmainへマージ済み。PR #19でPlaywrightによるブラウザE2Eテスト、PR #20で本番PreviewにおけるPWA manifest／Service Worker／オフライン起動テストを追加し、いずれもCI検証済み。PR #20のマージコミット: `45e5a41ab16da1fd36fbd54967d68cd23b025a96`。PR #21ではService Worker更新時の自動再読み込み、IndexedDBセーブ復元、オフライン再読み込み後の状態保持をCIで検証済み。
- Node.js 26、npm、Vitest 5.0.0。
- Game save schema: `saveVersion: 3`。マップ定義・戦闘ユニット・控え名簿の整合性を検証し、version 1／2から移行する。

PR #50はPR #48／#49後のREADME・開発ルール・実装状況を同期した（merge commit `451d1b47cd0084af47b2a64b7220bb376250b2e6`、CI run #611成功）。PR #51は320px幅・高さ568／720pxのタッチ操作E2Eと、回復量10HP（試作値）の回復薬使用フローを追加した（merge commit `a6162dc3180b0b635aa73573acf9ec7258dc1b11`、CI run #621: typecheck、26 test files／168 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3は維持。PR #52は採択済み非数値昇格方針と未承認バランス数値を記入表で区別した（merge commit `66ba9bf7769a5f1b97e2a259b547977a9d7c0faf`、CI run #614成功）。PR #53では所持アイテムの数量スタック表示と、登録済みitem IDから効果を解決する安全な使用処理を追加した（merge commit `29ca7cf75343ca3f0c382f62ad43a6c5cdf64ca0`、CI run #638: 27 test files／171 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3と既存inventory配列は維持。

## 2. 機能別ステータス

| 機能 | 状況 | 関連ファイル |
|---|---|---|
| React／Vite／PWA | 実装済み（manifest／Service Worker／オフライン起動に加え、ブラウザ標準のインストールプロンプトとインストール済み状態のUIを提供） | `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` |
| 操作ガイド | 実装済み（任意で開閉できる6段階の案内。出撃準備・移動・攻撃予測・アイテム／行動・地形・敵攻撃範囲・ターン進行・セーブ管理を説明。表示専用でGameState／saveVersion／IndexedDBを変更しない） | `src/components/operation-guide.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで全6段階の遷移、320px幅での横はみ出し防止、閉じた後の再表示、ガイド表示中のオートセーブ不変を確認 |
| 10×10マップ・地形 | 実装済み（仮コンテンツ） | `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` |
| 戦闘マップのキーボード操作 | 実装済み（ARIAのgrid／row／gridcellを使用し、グリッド内は1つのTab停止位置から矢印キーで隣接マスへ移動、Home／Endで行の端へ移動。フォーカスは地形情報と移動経路プレビューのみを更新し、Enter／Spaceで既存のマス操作を実行。ゲーム状態／オートセーブは変更しない） | `src/App.tsx`, `src/styles.css` | Chromium E2Eで行列数、単一Tab停止位置、方向・行端移動、マップ境界、セーブ不変を検証 |
| 戦闘中の味方ユニット一覧 | 実装済み（生存・出撃中の味方を表示し、HP、未移動・未行動／移動済・未行動／行動済の状態を既存GameStateから表示。一覧選択で対応マスを選択してマップ内へスクロール。控えは表示せず、UI選択のみでGameState／オートセーブを変更しない） | `src/components/unit-roster.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで行動フラグ別表示、未行動人数、マス選択、320px幅での右端ユニットへの自動スクロール、セーブ不変を検証 |
| 味方ユニット移動 | 実装済み（4近傍Dijkstraによる到達可能範囲に累計移動コストを表示。ポインター／キーボードフォーカスで決定的な最小コスト経路を番号付きプレビュー。プレビュー中はGameState／セーブ不変で、タップによる移動実行は従来どおり） | `src/domain/movement/calculate-reachable-tiles.ts`, `src/App.tsx`, `src/styles.css` | 経路再構成・同コスト経路の決定性・占有／通行不可地形の遮断を単体テスト。コスト／経路表示・キーボード操作・移動後保存をChromium E2Eで検証 |
| 仮武器・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` |
| 戦闘予測・プレイヤー攻撃 | 実装済み（攻撃側／防御側HP、距離・速さ差、反撃可否と理由、武器・攻撃力・通常／必殺ダメージ、命中／必殺率、三すくみ・対象地形補正を既存forecastから表示。計算／戦闘ルールは不変） | `src/domain/combat/`, `src/application/perform-attack.ts`, `src/application/get-combat-forecast-details.ts`, `src/components/combat-forecast.tsx` |
| マップ目標・地形情報パネル | 実装済み（既存マップ／GameStateから勝利・敗北条件の進行と、選択／フォーカス中マスの移動コスト・守備／回避補正・配置ユニット・砦の現行効果を表示。閲覧のみでGameState／セーブは変更しない） | `src/application/get-battle-map-details.ts`, `src/App.tsx`, `src/styles.css` | application単体テストとChromium E2Eで残敵数／ボスHP／敗北対象／森林・山岳・砦の表示およびセーブ不変を検証 |
| 敵攻撃範囲の表示切替 | 実装済み（PR #40マージ済み。自軍フェイズでON／OFF。生存・未行動敵の現在位置と、地形・占有を考慮した移動可能マス、装備中で使用可能な武器の射程から脅威マスを予測。敵AIの移動先・対象の確定予告ではない。距離は暫定Manhattan。表示状態はセーブしない） | `src/domain/combat/calculate-enemy-threatened-tiles.ts`, `src/App.tsx`, `src/styles.css` | PR #40最終head CI run #560: typecheck、23 test files／154 tests、production build、Chromium E2E 12件成功 |
| RNG state・save migration | 実装済み（saveVersion 3、version 1／2→3） | `src/domain/random/`, `src/persistence/migrations.ts` |
| 自軍フェイズ終了／敵軍開始 | 実装済み | `src/application/resolve-enemy-phase.ts`, `src/App.tsx` |
| 敵AI（攻撃対象評価） | 基本実装・暫定スコア | `src/application/resolve-enemy-phase.ts` |
| 敵AI（移動後攻撃／接近／待機） | 基本実装 | 同上、`src/domain/movement/` |
| 敵行動順の固定 | 実装済み（ID辞書順） | `src/application/resolve-enemy-phase.ts` |
| 敵軍フェイズ／AI／勝敗判定テスト | 実装済み | `src/application/resolve-enemy-phase.test.ts`, `src/domain/rules/evaluate-battle-outcome.test.ts` | 9 test files／54 tests、GitHub Actions run #90成功 |
| ターン進行・行動フラグreset | 実装済み | 同上 |
| 敵軍フェイズ中セーブからの再開 | 実装済み（`phase: enemy` checkpointから再解決し、完了後は`phase: player`を保存） | `src/App.tsx`, `src/persistence/save-repository.ts` | E2Eで再開後の二重実行なしを検証 |
| 敵軍フェイズ行動記録 | 実装済み（敵ごとの行動種別・対象／移動先・命中／必殺／ダメージを一時表示。saveVersion変更なし。通常の再読み込み後は非保持） | `src/App.tsx`, `src/application/resolve-enemy-phase.ts`, `src/styles.css` | PR #42 CI run #583でChromium E2E 14件成功 |
| 味方攻撃の実行記録 | 実装済み（先制／反撃／追撃の各strikeの実結果、HP変化、EXP／レベルアップを一時表示。saveVersion変更なし） | `src/application/get-player-attack-report.ts`, `src/App.tsx`, `src/styles.css` | PR #43でprojection単体テスト／Chromium E2Eを追加。CI run #596でも回帰確認 |
| 勝利（defeat_all／defeat_boss） | 実装済み | `src/domain/rules/evaluate-battle-outcome.ts` |
| 敗北（味方全滅） | 実装済み | 同上 |
| マップ指定ユニット撃破による敗北 | ルール実装済み（`defeatCondition.targetUnitId`）。既存試作マップは主人公ID未決定のため未設定 | `src/domain/rules/evaluate-battle-outcome.ts`, `src/domain/models/game.ts` |
| マップ定義の整合性検証 | 実装済み（terrain寸法／値、配置ID／座標の重複・範囲、ボス／敗北対象の所属陣営を検証） | `src/domain/models/validate-game-map.ts` |
| セーブ内ユニットの出撃名簿・地形・コンテンツ参照整合性 | 実装済み（各unit ID／factionの出撃名簿一致、移動種別で通行可能な現在地、登録済みクラス／武器／アイテムID、装備武器の所持・適性、現役ユニットのHP>0を検証。撃破済みユニットの欠落は許可） | `src/domain/models/validate-game-state.ts` |
| 出撃準備・配置確定 | 実装済み（生存中の候補／控えから出撃メンバーを選択、位置設定、非選択者の控え保存。saveVersion 3で永続化）。正式な章ごとの人数条件は未決定。上限はマップ候補数 | `src/application/prepare-player-deployment.ts`, `src/App.tsx` |
| 出撃候補のキャラクター詳細・所持武器確認 | 実装済み（PR #17。クラス・能力・移動・武器適性・武器性能・所持アイテムの閲覧）。閲覧専用。インベントリ整形は専用単体テストで検証。ブラウザ／スマートフォンでの表示確認は未実施 | `src/App.tsx`, `src/styles.css`, `src/application/get-deployment-unit-details.ts` |
| ステージ結果詳細表示 | 実装済み（敵配置全体の生存／撃破一覧、生存味方のクラス・Lv・EXP・HP。撃破済みユニットの最終HP／撃破者別記録は保持していないため非表示。saveVersion 変更なし） | `src/application/get-battle-result-details.ts`, `src/App.tsx`, `src/styles.css` | PR #41最終head CIで単体テスト／390px Chromium E2Eを検証。merge commit `30ebbfcc155a0d8a533ff8d5ef7a2debc9c85c5c` |
| 戦闘行動のセッション内時系列履歴 | 実装済み（PR #56でマージ。味方攻撃の実解決結果と敵軍フェイズ行動を発生順に表示。リロード・セーブ読込・バックアップ復元・章切替でリセットし、セーブ形式には保存しない） | `src/App.tsx`, `src/application/get-player-attack-report.ts`, `src/application/resolve-enemy-phase.ts` | CI run #675で連続した攻撃／敵軍行動の順序、リロード後の消去、保存データ不変をChromium E2Eで検証 |
| 永続的な戦闘履歴・撃破者別統計・会話／加入イベント・キャンペーン選択／分岐 | 未実装（セッション内履歴とは別の永続ログ・撃破者情報・イベント基盤が必要） | — |
| 経験値・レベルアップ | 実装済み（PR #6） | `src/domain/progression/level-up.ts`, `src/application/perform-attack.ts` |
| 経験値報酬 | 実装済み（設計書§5.3の初期案） | `src/application/perform-attack.ts` | application tests |
| レベルアップ・個別成長判定 | 実装済み（仮クラス上限） | `src/domain/progression/level-up.ts`, `src/content/classes.ts` | progression tests |
| 敵軍ユニットの結果一覧 | 実装済み（章マップの敵配置と現在状態を照合し、生存／撃破を表示） | `src/application/get-battle-result-details.ts` | 単体テスト・E2Eで検証 |
| 選択ユニットの経験値表示 | 実装済み（EXP x/100） | `src/App.tsx` | CI build。実機操作未確認 |
| 戦闘中の消費型回復アイテム | 実装済み（同一IDの所持アイテムは数量をまとめて表示し、回復薬の操作はスタックごとに1つ。移動後の味方が自身に使用し、確認後に最大10HPを回復。HP上限で制限し、アイテム1個と行動を消費。回復量は試作値。アプリケーション層はIDから登録済みアイテム効果を解決する。saveVersion 3の既存inventory配列を利用） | `src/content/items.ts`, `src/application/perform-item-use.ts`, `src/App.tsx` | application単体テストとChromium E2Eで移動後使用・キャンセル・HP上限・保存後状態を検証 |
| progression／attack／class-change／content tests | mainのPR #6〜#7と今回のPR #8で実装済み | `src/domain/progression/`, `src/application/`, `src/content/class-promotion.test.ts` | GitHub Actions run #168: 13 test files／78 tests成功 |
| 昇格先パス | 実装済み（設計書§5.5の7系統） | `src/content/classes.ts` | mapping tests |
| クラスチェンジ条件・アイテム消費・能力ボーナス適用 | ルール基盤実装済み。採択済みCP-12により移動・行動前のみ実行可、成功時に行動済みとなる。CP-09／10の移動・武器適性・装備維持、7経路すべての一段階昇格を回帰テスト化。PR #32でCP-07／08のEXP 0／99保持、現在HP 1／満タン維持、HP上限でのボーナス制限を追加 | `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts`, `src/domain/progression/class-change.test.ts`, `src/content/class-promotion.test.ts` | PR #32 CI run #503: 22 test files／146 tests、Chromium E2E 11件成功 |
| クラスチェンジアイテム定義・所持品表示 | アイテム定義と表示は実装済み。採択済みCP-13により初期付与を廃止し、章報酬／イベント定義による配布のみ許可。具体的な報酬は未登録。PR #29で明示報酬は勝利後のみ付与、所持枠満杯時は状態を変更せず拒否することを検証 | `src/content/items.ts`, `src/content/maps/chapter-01.ts`, `src/application/apply-chapter-rewards.ts`, `src/App.tsx` | PR #29 CI run #497: chapter-reward tests passed |
| クラスチェンジUI・確認・自動保存接続 | 実装済み（Lv.10／証所持／自軍フェイズ／未移動・未行動条件。確定でユニットの行動を消費）。確認画面に8能力の現在値・昇格後予測・実増加量・仮上限、最大HP／現在HP、Lv.1化・EXP保持、証消費、移動／武器適性／装備の維持、行動消費を表示する（暫定表示でありCP-15の最終仕様ではない） | `src/App.tsx`, `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts` | PR #38で8能力の現在値・昇格後値・実増加量・仮上限、HP／EXP等の影響を表示。PR #39で8能力すべての画面表示、暫定上限超過値の維持、キャンセル時のセーブ不変、確定後の状態保持をE2E検証。PR #39最終head CI run #532: typecheck、22 test files／148 tests、production build、Chromium E2E 11件すべて成功（オーナーがマージ済み） |
| 正式な昇格ボーナス・上限・昇格後移動／武器データ | 未決定（現行は仮値） | `src/content/classes.ts` | playtest／仕様決定待ち |
| 敵の役割タグ／AI優先度 | 未実装 | — |
| 砦のフェイズ開始回復 | 実装済み（該当陣営の生存ユニット／最大HPの10%／端数切り捨ては暫定） | `src/domain/rules/apply-fort-recovery.ts`, `src/application/resolve-enemy-phase.ts` |
| 章間引き継ぎ・次章開始UI | 実装済み（章レジストリ、章ID別マップ復元、勝利後の次章開始、レベル／能力／所持品引き継ぎ、撃破者除外、RNG継続、auto slot保存） | `src/content/chapters.ts`, `src/application/prepare-next-chapter.ts`, `src/App.tsx` | 次章は遷移確認用の試作データ |
| 章報酬 | データ駆動の適用処理実装済み（章定義のitemId／recipient／quantityを検証して配布。各所持品5枠上限） | `src/application/apply-chapter-rewards.ts`, `src/content/chapters.ts` | 現在登録した試作章の報酬は空配列。実際の報酬内容・数量は未決定 |
| 第2章マップ | 試作データ実装済み（第1章からの遷移とセーブ復元を確認するための仮配置） | `src/content/maps/chapter-02.ts` | 正式なマップ／敵構成ではない |
| ブラウザE2E（出撃準備・控え保存・行動状態復元・敵軍フェイズ／ターン復元・320pxマップ操作・モバイル幅） | 実装済み（Playwright E2E。320pxで40pxタイル、キーボード横スクロール、タッチスワイプ後の横スクロールと右端ユニット選択を検証） | `playwright.config.ts`, `e2e/campaign.spec.ts`, `.github/workflows/ci.yml` | PR #47 CI run #605: 25 test files／161 unit tests、Chromium E2E 18件成功 |
| PWA manifest／Service Worker／オフライン起動E2E | 実装済み（PR #20、本番PreviewでCI検証） | `playwright.config.ts`, `e2e/pwa.spec.ts`, `vite.config.ts` |
| PWAインストール導線 | 実装追加（ブラウザが `beforeinstallprompt` を通知した場合にのみインストールボタンを表示。standalone／`appinstalled` を検知し、非対応ブラウザには手動追加方法を案内） | `src/App.tsx`, `src/styles.css` | Chromium E2Eでプロンプト捕捉・確定・キャンセル・インストール完了表示を検証 |
| Service Worker更新・自動再読み込み後のセーブ復元E2E | 実装済み（PR #21、CI run #408で更新／オンライン／オフライン復元を検証） | `e2e/pwa-preview-server.mjs`, `e2e/pwa.spec.ts` |
| ローカルセーブのJSON書き出し／読み込み | 実装済み（PR #22でmainへマージ済み。バージョン付きJSON、章・マップ・saveVersion検証、上書き前確認、不正ファイルによる既存セーブ保護） | `src/persistence/save-file.ts`, `src/persistence/save-file.test.ts`, `src/App.tsx`, `e2e/pwa.spec.ts` |
| ローカルセーブの3世代バックアップ | 実装済み（PR #23でmainへマージ済み。最大3世代、4回目の最古ローテーション、auto不変、確認付き復元、migration／validatorによる不正データ拒否） | `src/persistence/save-repository.ts`, `src/App.tsx`, `e2e/pwa.spec.ts` |
| 狭幅スマートフォンのマップ操作 | 実装済み（PR #44でmainへマージ。320px幅で各マス40pxを維持し、マップ領域内の横スクロール・キーボード操作・タッチ選択を提供。PR #46／#47で指の横スワイプ後の右端ユニット選択とページ全体の横はみ出し防止をChromium E2Eで検証） | `src/App.tsx`, `src/styles.css`, `e2e/campaign.spec.ts` | CI run #605でChromium E2E 18件成功。実機確認は未実施 |
| UI／スマートフォン実機確認 | 未実施（Chromium E2Eは実機のタッチ操作・OS表示を代替しない） | — |

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
- マップ定義validatorは主要な構造・参照整合性を検証し、セーブ状態validatorは出撃名簿、地形通行可否、登録済みクラス／武器／アイテム参照、装備武器の所持・適性、現役ユニットのHP>0を検証する。このセーブ検証はプレイ中の経路履歴や、直前の移動経路が移動力内だったかまでは検証しない（経路プレビューは操作時だけの一時表示）。
- 出撃準備のメンバー選択・控え保存・章間引き継ぎと、候補詳細のインベントリ表示データ整形はCIテスト対象。ブラウザ／スマートフォン実機でのUI／IndexedDB通し確認は未実施。
- PlaywrightによるChromium E2Eは出撃準備・名簿保存・行動状態復元・敵軍フェイズ／ターン復元・幅390pxのレイアウトを確認済み。PWA manifest／Service Worker／precache／オフライン起動も本番Previewで検証済み。Service Worker更新時の自動再読み込みとセーブ復元はPR #21で検証済み。セーブファイルのexport/importはPR #22のCIで単体・ブラウザテスト済み（mainマージ済み）。3世代バックアップはPR #23の最終CI run #42734263896でtypecheck・unit tests（21 files／136 tests）・production build・Chromium E2E（10 cases）がすべて成功。 PR #29マージheadのCI run #497ではtypecheck・unit tests（22 files／142 tests）・production build・Chromium E2E（11 cases）がすべて成功。PR #30のマージheadのCI run #499でも同じくtypecheck・22 files／142 tests・production build・Chromium E2E 11 casesがすべて成功。PR #32のマージheadのCI run #503ではtypecheck・22 files／146 tests・production build・Chromium E2E 11 casesがすべて成功。PR #23はmainへマージ済み（merge commit: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`）。実スマートフォンへのインストール・オフライン操作の手動確認は未実施。

## 5. 次の作業候補

1. [クラスチェンジ仕様・未決定事項と実装計画](class-promotion.md) と記入表に沿って、CP-04／CP-05の7経路ボーナス／14クラス上限をプレイテストで決定する。CP-01〜CP-06／CP-15の未決事項を整理する。
2. 章報酬・イベントの具体的な品目／受取人／数量を決定し、採択済みCP-13に従ってクラスチェンジ証を配布する。
3. 主人公の正式IDを決定し、各章マップへ敗北対象として設定。砦回復の端数規則も確定。
4. 出撃準備から1ステージの開始・クリアまでをブラウザ／スマートフォンで検証し、加入／離脱と章別編成候補の正式仕様を設計。
