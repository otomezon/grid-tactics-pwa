# アーキテクチャ

## 1. 現在の構成

PR #1〜#101で文書基盤、PWA／マップ／移動、戦闘・敵AI・経験値、クラスチェンジUI、章間引き継ぎ、セーブ／バックアップ、戦闘結果・各種インスペクター、操作ガイド、ブラウザE2E、型付きクラス定義レジストリとprojection不変性をmainに追加した。現在のPR #102ではプレイヤー操作command境界の整理とデータ駆動マップイベント基盤を統合する。PR #54のマージコミットは `146c5952713f1cae3916fcde3e0f8a2407f995e1`。CI run #643で型チェック・単体テスト・本番ビルド・Chromium E2Eの成功を確認した。PR #55では既存データから目標進行と地形詳細を投影した。PR #73では `src/application/get-battle-objective-navigation-targets.ts` が現在生存中のボス／保護対象と全滅目標の残敵数を導出し、`src/components/battle-objective-panel.tsx` が目標パネルにナビゲーション操作を表示する。PR #74では `src/components/deployment-preview.tsx` が既存の `GameMapDefinition.playerDeployment`、地形、Appの一時割り当てをマップ表示へ投影する。PR #75では `src/application/get-deployment-terrain-details.ts` が指定座標のうち登録済み出撃マスだけから既存の `TERRAIN_DEFINITIONS` を参照し、地形名・歩兵／騎馬移動コスト・守備／回避補正・砦の既存効果をprojectionする。`DeploymentPreview` は選択中マスと配置中ユニットの移動種別を渡し、通行不可なら既存validatorと同じnull判定で注意を表示する。座標変更や出撃確定は実行せず、GameState／RNG／IndexedDB／saveVersionを変更しない。選択中ユニットと座標が一致する出撃マスにトークンを描き、未使用の出撃マスを空きとして表示する。トークン選択は候補詳細UIを開くだけであり、座標編集は既存の位置選択UIが担当する。確定前はGameState／RNG／IndexedDB／saveVersionへ影響しない。Appは既存の敵一覧フォーカス、味方選択、敵マス検査を再利用し、指定対象の位置へフォーカスとスクロールを行う。撃破済み・不在の対象はナビゲーションを表示しない。すべて画面内の操作であり、GameState／RNG／IndexedDB／saveVersionには触れない。PR #56では既存の味方攻撃レポートと敵軍行動結果をAppのセッション内状態で発生順にまとめ、リロードやセーブ読込で消去するとともに、terrain inspectorのポインターフォーカスによるレイアウトずれを修正した（merge commit `c7c9d9ced4cd226b9c25cba7ab6d59e82b924910`、CI run #675成功）。PR #57では保存内ユニットの地形通行可否を検証した（merge commit `1fc9d6e924e7323d4ea611d1b9649e4e39d408b3`、CI run #679成功）。PR #58では、登録済みクラス／武器／アイテムの参照、装備武器の所持と武器適性、および現役ユニットの生存HPも確認した（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。GameStateSnapshotやpersistenceには追加していない。PR #59では既存Dijkstra探索から経路を再構成し、累計コストと経路順をマップ上に一時表示する。タッチ操作では1回目のタップでプレビューし、同じ目的地への2回目のタップで移動を確定する（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60では同じ操作をタッチ端末向けに確認式へ変更した（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。現在の実装には、出撃準備からセーブ管理までを案内する6段階の操作ガイドと、ARIA grid／row／gridcellで構成したキーボード対応マップを追加している。マップは単一Tab停止位置と矢印キー／Home／Endのフォーカス移動を提供し、移動中は地形インスペクターと経路プレビューを更新する。フォーカス操作はReactの一時UI状態だけで動作し、GameState／IndexedDBには保存しない。`src/components/unit-roster.tsx` は現役playerユニットのHP・行動フラグを読み取り専用で表示し、選択時にAppの選択状態を更新して対応するマップタイルをスクロールする。reserveUnitsやsave schemaには触れない。 `src/components/enemy-roster.tsx` は生存中の敵のHP・クラス・座標・装備武器を読み取り専用で表示し、選択時には既存の `inspectedPosition` を更新してマップの占有マスへスクロールする。`src/application/get-enemy-inspection-details.ts` は現在の敵状態と登録済み武器定義から能力値・移動・所持武器性能の表示用projectionを作り、`src/components/enemy-inspector.tsx` が敵情報パネルを描画する。敵一覧とマップのどちらから選択しても同じ `inspectedPosition` に同期する。表示値は既存の攻撃力式を用いた情報表示に限り、敵選択は攻撃や敵AIを実行せず、GameState／persistenceには触れない。`src/domain/combat/calculate-enemy-threatened-tiles.ts` は全体の脅威範囲と、選択マスを攻撃可能な敵ごとの候補起点を同じ攻撃プロファイルから導出する。`src/application/get-enemy-threat-inspection-details.ts` が表示用に整形し、`src/components/enemy-threat-inspector.tsx` が現在位置／移動後の起点を表示する。敵AIの選択処理は呼び出さず、`inspectedPosition` と脅威表示toggleのみの一時UI状態でGameState／persistenceには触れない。`src/application/get-enemy-phase-forecast.ts` は実際の `beginEnemyPhase`／`runEnemyPhase` を呼び出して敵軍の行動列と味方ごとの敵行動後HP・砦回復後HP・被ダメージ・撃破見込みをprojectionし、`src/components/enemy-phase-forecast.tsx` は敵の行動順・移動先・対象・戦闘結果・砦回復・味方HP予測・勝敗見込みを折りたたみ表示する。予測後stateは破棄し、入力GameState／RNG／IndexedDBには触れない。味方の操作でsnapshotが変わると再計算する。AIスコア・Manhattan距離は暫定のまま。`src/components/player-phase-end-review.tsx` は、未行動の味方が残る自軍フェイズ終了操作に対し、未行動名簿と既存の敵フェイズ予測をまとめた読み取り専用レビューを描画する。ユーザーは味方を選んで既存のユニット選択フローへ戻るか、未行動者を残して通常のフェイズ終了処理を実行できる。全員行動済みの場合はレビューを省略する。Appの一時UI状態だけを使用し、GameState／RNG／IndexedDB／saveVersionには触れない。`src/domain/combat/calculate-attackable-enemy-positions.ts` は現在位置または合法な移動プレビュー位置から攻撃可能な生存敵の座標を既存の装備武器・射程・暫定Manhattan距離で導出する。Appは移動プレビュー経路が有効な間だけ追加の敵ターゲット表示を重ね、現在位置から攻撃可能な敵とは色・凡例・ARIA説明を分ける。これは既存の射程表示を再利用した読み取り専用projectionで、移動・戦闘・RNG・GameState／IndexedDBには触れない。PR #64の戦闘予測も既存AttackPlanの値を表示するprojectionで、計算式・乱数・セーブ形式を変更しない。PR #42のマージコミットは `8b5b3b583ad4cd6f7fae3f2cccd8b8ebbefe0e4f`、PR #43のマージコミットは `8f0a3d023afab1a379dce99147f59bc9770084bb`、PR #44のマージコミットは `ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba`。PR #44のCI run #596は25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功した。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。

PR #68では、合法な移動プレビュー起点からの攻撃可能対象projectionを追加し、現在位置から射程外で移動後に初めて攻撃可能になる敵を別の枠・凡例・ARIA説明で表示する。現在位置と移動先の判定は同じdomain helperを共有する。プレビューはGameState／RNG／IndexedDBに触れない。merge commit `cad5d4a92bc6854b8d9f5abd1f4f23cb5952f04e`、main CI run #872は32 test files／210 unit tests、本番ビルド、Chromium E2E 37件が成功。


```text
src/
├── App.tsx
├── components/
│   ├── operation-guide.tsx
│   ├── unit-roster.tsx
│   ├── enemy-roster.tsx
│   ├── enemy-inspector.tsx
│   ├── enemy-threat-inspector.tsx
│   └── enemy-phase-forecast.tsx
├── application/
│   ├── perform-attack.ts
│   ├── get-player-attack-report.ts
│   ├── get-enemy-inspection-details.ts
│   ├── get-enemy-threat-inspection-details.ts
│   └── get-enemy-phase-forecast.ts
│   ├── get-battle-map-details.ts
│   ├── perform-class-change.ts
│   ├── apply-chapter-rewards.ts
│   ├── prepare-next-chapter.ts
│   ├── prepare-player-deployment.ts
│   └── resolve-enemy-phase.ts
├── content/
│   ├── terrain.ts
│   ├── weapons.ts
│   ├── classes.ts
│   ├── items.ts
│   ├── chapters.ts
│   └── maps/
│       ├── chapter-01.ts
│       └── chapter-02.ts
├── domain/
│   ├── models/
│   ├── movement/
│   ├── combat/
│   ├── random/
│   ├── progression/
│   └── rules/
│       ├── evaluate-battle-outcome.ts
│       └── apply-fort-recovery.ts
└── persistence/
    ├── save-repository.ts
    ├── save-file.ts
    └── migrations.ts
```

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形、章レジストリ／章別マップ／初期状態、仮武器、14職の型付きクラスレジストリ、昇格先・仮能力ボーナス、クラスチェンジアイテム | 実装あり。第2章・昇格ボーナス／上限は試作データ。移動／武器クラス別表はCP-09／10の承認待ち |
| domain/models | GameUnit、CampaignUnit、GameStateSnapshot、saveVersion 4検証、戦闘／控え名簿・配置地形・クラス／所持品／装備参照の整合性検証 | 実装あり |
| domain/movement | 地形・占有を考慮した到達可能範囲と、同じDijkstra探索から再構成する決定的な最小コスト経路 | 実装あり。経路表示はUI専用でGameState／saveVersionへ追加しない |
| domain/combat | 武器適合、式、射程、予測、決定論的解決、敵脅威範囲、移動プレビュー起点の攻撃可能対象、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32 seed/state・combat rolls | 実装あり |
| domain/rules | defeat_all／defeat_boss／味方全滅／マップ指定ユニット撃破の勝敗判定、砦回復 | 実装あり。主人公ID未決定のため試作マップの個別敗北対象は未設定。回復端数は暫定切り捨て |
| domain/progression | EXP閾値、個別成長判定、クラス昇格条件・能力ボーナス適用 | 実装あり。クラス上限・昇格値は呼び出し側の仮設定データ |
| application | プレイヤー／敵の攻撃、クラスチェンジ、章報酬付与、勝利後の次章state構築、出撃配置検証、出撃前の装備変更、敵AI／フェイズ進行、目標進行・地形情報の読み取り専用projection | 出撃前装備変更は既存のweapon ownership／class／type compatibilityを再利用し、active／reserveを不変更新。保存は既存の配置確定時のみ。報酬は章データで明示したアイテムのみ適用 |
| ui | 出撃準備から戦闘・地形判断・ターン進行・保存を6段階で説明する任意表示の操作ガイド（`src/components/operation-guide.tsx`）を含む。ガイドはセーブ非変更。章別マップ（狭幅画面では各40pxタイルの横スクロール領域）、目標進行・マス情報パネル、移動可能マスの累計コスト／経路プレビュー、戦闘予測／セッション内時系列戦闘履歴、装備／所持品／クラスチェンジ、結果／報酬、次章開始、出撃準備／候補詳細 | 試作実装。出撃候補の詳細パネルはPR #17でmainに実装済み。狭幅マップ操作はPR #44でmainに実装済み。PR #46／#47で320px幅の横スワイプとスワイプ後の右端ユニット選択をChromium E2Eで検証済み（実機未確認）。第2章は遷移検証用 |
| persistence | IndexedDB auto slot／backup-1〜backup-3、saveVersion 1／2／3→4 migration、JSON export/import | 3世代backup／復元、export/importともmain実装済み。PR #23で最大3世代の保持、最古世代ローテーション、auto不変、確認付き復元をCI検証。DB version／saveVersionは据え置き |
| pwa | manifest、Service Worker、静的アセットキャッシュ、ブラウザ標準のインストールプロンプトとstandalone状態表示 | Vite pluginとAppのイベント連携あり |

## 3. 現在のデータフロー

1. AppがIndexedDB auto slotをロードし、saveVersion 1／2→3 migrationまたはversion 3 validatorを通す。validatorはマップ構造と目標参照を確認し、保存内の各ユニットID／陣営がマップの出撃名簿と一致すること、各ユニットの現在地が移動種別のmovementCostがnullでない地形であること、クラス／所持品IDが登録済みであること、装備武器が所持品かつ使用可能武器種に含まれること、現役ユニットのHPが正であることを検証する。撃破済みユニットはstateから除去できるため、配置名簿の全員がstateに存在することまでは要求しない。
2. player phaseでは既存の移動・装備・攻撃・待機操作を使う。移動可能マスと累計コストは同じ到達可能性計算から表示し、ポインター／キーボードフォーカス時にはDijkstraの前駆ノードをたどって最小コスト経路を一時表示する。経路プレビューが有効な間は、その移動先を攻撃起点として同じ装備武器・射程projectionを評価し、現在位置から射程外でも移動後に攻撃可能な敵を別の枠で表示する。タッチ操作では最初のタップで同じ経路を表示し、同じマスへの2回目のタップで移動を確定する。経路プレビューはGameStateやIndexedDBへ書き込まず、移動先を選択した時点で従来どおり位置とhasMovedを保存する。味方攻撃と敵軍フェイズの実結果はAppのReact stateに時系列で蓄積する。履歴はIndexedDBやGameStateSnapshotには書き込まず、リロード・セーブ読込・バックアップ復元・章切替で破棄する。
3. 「自軍フェイズ終了」で敵軍フェイズへ移り、砦上の生存中の敵軍ユニットを最大HPの10%（端数切り捨て・暫定）回復してから `phase: enemy` のスナップショットを保存する。
4. `runEnemyPhase` が敵ユニットをID辞書順に処理する。現在攻撃できるなら対象評価して攻撃、いなければ移動可能範囲を調べ、移動後攻撃、接近、待機を選ぶ。
5. 各戦闘は共通combat resolverと保存済みXorshift32 stateを利用する。HP・撃破・RNG stateはGameStateへ反映する。
6. 戦闘継続中なら敵軍フェイズ後にturnを1増やし、残存ユニットの行動フラグをresetしてplayer phaseへ戻し、砦上の生存中の味方を最大HPの10%（端数切り捨て・暫定）回復する。勝敗ならterminal stateのままにする。
7. 次状態をIndexedDBへ保存。起動時に `phase: enemy` の保存が読み込まれた場合は敵軍フェイズを再開・解決する。
8. ユーザーが手動バックアップを作成すると、persistenceがauto slotを検証済みsnapshotと照合し、同じreadwrite transaction内で `backup-1`〜`backup-3` をローテーションする。復元時は章解決・migration・validator・確認後にauto slotを置き換える。

## 4. 章間遷移

`content/chapters.ts` が章ID・マップ・初期状態・クリア報酬を登録する。起動時は保存されたchapterIdに対応するマップでセーブを検証・復元する。勝利後は `apply-chapter-rewards.ts` が設定済み報酬を生存味方へ付与し、`prepare-next-chapter.ts` が次章stateを構築する。Appは章別マップへ切り替え、通常のIndexedDB auto slotへ保存する。撃破済み味方を復帰させず、章間HPは現在の設計未決定のためUIでは暫定的に維持する。saveVersion 3で控え名簿を保持する。

装備変更は `perform-deployment-weapon-change.ts` が登録済み武器・所持・クラス／武器種適性を検証し、`units` または `reserveUnits` の対象だけを不変更新する。これは出撃準備中のApp stateにだけ反映し、既存の配置確定処理が `saveGameState` を呼ぶまでIndexedDBへ保存しない。GameStateスキーマ／saveVersionは変更しない。

出撃準備は `prepare-player-deployment.ts` がturn 1のplayer phaseかつ味方未行動であることを確認し、マップの `playerDeployment` 候補から出撃メンバーを選択して座標を一意に割り当てる。非選択の生存者は `reserveUnits` へ移し、HP・経験値・能力・所持品・装備を保持する。控えは戦闘stateの `units` に含めない。Appは新規ゲーム／次章開始直後に出撃準備画面を表示し、確定時にv3 snapshotを保存してから戦闘操作を有効化する。次章stateは配置確定までauto slotへ保存せず、前章の勝利セーブを保持する。正式な章ごとの人数条件は未決定で、現在の上限はマップ候補数。

## 5. 依存方向のルール

- domainはReact／DOM／IndexedDBに依存しない。
- contentは定義データのみを保持する。
- applicationはdomainとcontentを使って合法性を検証し、次状態を返す。
- UIはapplication/domainの結果を表示し、ルールや計算式を再実装しない。
- persistenceは保存・ロード・migrationを担当する。

## 6. 今後の分割候補

- `application/gameController.ts`: 移動、装備、攻撃、待機、フェイズ進行を統合する。
- 敵AIは現在単純なスコア式。役割タグ、戦略の追加、プレイテストを別途行う。
- `domain/progression/`: EXP・成長、クラス昇格、章報酬定義型を実装。正式な昇格値とクラス別移動／武器データは未決定。
- `domain/events/`: ターン／撃破／勝利イベント。
- UIコンポーネント分割。現状は `App.tsx` に集約。
- 基本リザルト、章定義されたアイテム報酬、次章開始UIは実装済み。詳細戦闘統計／会話イベント／キャンペーン選択・章解放管理は未実装。

## 能力成長率の読み取り専用表示

`src/application/get-player-inspection-details.ts` は既存の `GameUnit.growthRates` を表示projectionへ渡す。`src/components/unit-growth-panel.tsx` は同じprojectionを出撃候補詳細と味方インスペクターで共有し、8能力の確率とEXP進捗だけを描画する。成長率の再計算、レベルアップ抽選、乱数消費、GameState／IndexedDB／saveVersionの変更は行わない。実際の成長判定とクラス上限適用は既存の `applyExperience` に委譲する。

## 7. 外部サービス

サーバー、アカウント、オンライン同期、HTTP APIはない。PWAとブラウザ内IndexedDBを基本とする。新規ゲームの乱数seed生成にはWeb Cryptoを使うが、外部サービス接続は行わない。


## 味方ユニットの読み取り専用インスペクター（レビュー対象）

`src/application/get-player-inspection-details.ts` は `inspectedPosition` にいる生存中の味方の能力値7項目、HP／EXP、位置、移動力・移動種別・行動状態を現在のGameStateSnapshotから表示用に投影する。所持武器の物理／魔法攻撃力は既存の敵インスペクターと同じ能力値＋武器威力で表示し、既存の `usableWeaponTypes` に基づく適性と装備中状態も表示する。所持アイテムは `getInventoryItemStacks` で数量をまとめ、既知定義の説明と未知IDを表示する。

`src/components/player-inspector.tsx` は味方一覧またはマップ上の味方マスを確認したときだけ表示され、敵マスを確認すると敵インスペクターへ切り替わる。表示は閲覧専用で、装備変更／アイテム使用の既存コマンドUIとは分離し、GameState／RNG／IndexedDB／オートセーブ／saveVersion 3に触れない。攻撃・命中・AI予測を再計算せず、暫定データの最終バランス承認を意味しない。


## 味方コマンドの一時戦闘履歴（PR #77）

App.tsx の battleHistory に、確定済みの味方コマンドを player-action として追加する。対象は移動、武器変更、アイテム使用、クラスチェンジ、待機。既存の player-attack と enemy-phase エントリーと同じ連番にし、ターン内の発生順で表示する。各行はユニット名・操作種別・移動元／先や装備武器、消費アイテム／回復量、昇格先／適用ボーナスなど確認可能な結果を示す。

イベントを追加するのは、既存コマンドが成功して次のGameStateを画面に反映する箇所だけ。プレビュー、クリック／キーボードの選択、インスペクション、戦闘予測、確認キャンセルやエラーは記録しない。履歴は従来どおりReactのセッション状態であり、GameStateSnapshot／RNG／IndexedDB／saveVersion 3／JSON save exportには含めず、リロード・セーブ読込・バックアップ復元・章切替で消去する。


## タイトル画面・キャンペーン起動

src/components/campaign-title-screen.tsx は新規開始／続きからとローカルセーブ管理の画面を担当する。保存データの読込・検証・移行は CampaignApp と既存のpersistence/application処理に委譲する。新規キャンペーンはメモリ上で初期snapshotを準備し、出撃配置確定時の保存が成功するまでauto slotを置き換えない。saveVersion／IndexedDB schemaの変更は不要。

## 第3章コンテンツ登録

src/content/maps/chapter-03.ts は既存の第1章ユニット定義を再利用し、章3固有のterrain／deploymentと初期RNG stateを定義する。src/content/chapters.ts が第1〜第3章を順序付きで登録し、getNextChapterを通じて遷移させる。第3章も isPrototype: true であり、新規キャスト・最終シナリオ・章報酬を追加したわけではない。


## ステージリザルトの一時戦闘貢献集計

`src/application/get-battle-contribution-details.ts` は画面セッション内の `PlayerAttackReport` だけを入力にし、攻撃開始者ごとに実strikeの命中／ミス／必殺／ダメージ、撃破、EXP、レベルアップを集計する。攻撃開始者IDと各strikeのactor IDを照合して敵の反撃を除外する。リザルトUIは `BattleContributionPanel` が読み取り専用で表示する。履歴がリロード／セーブ読込／章切替で消えた場合に結果を推測せず、「記録なし」と示す。戦闘履歴と集計はGameStateSnapshot／IndexedDB／saveVersion 3へ保存しない。


## 出撃準備のユニット比較

`src/components/deployment-unit-comparison.tsx` は、Appが既存の章候補／キャンペーン名簿から投影した候補を受け取り、2人の出撃候補を読み取り専用で並べる。比較対象選択はコンポーネント内の一時React stateのみ。能力値・成長率は候補の `CampaignUnit` データを直接表示し、優位度や将来の成長結果を推計しない。狭い画面で比較表の横幅を専用スクロール領域へ閉じ込める。GameStateSnapshot、IndexedDB、装備、deployment assignments、saveVersion 3は変更しない。


## キャンペーン累計戦績とsaveVersion 4

`GameStateSnapshot.campaignUnitBattleRecords` は味方IDごとに重複しない累計値を保持する。`src/application/record-player-battle-contribution.ts` は `performAttackForFaction` が返す確定済み `CombatResult` のうち、攻撃開始者IDと一致するstrikeだけを加算し、EXP／レベルアップ／成長値は同じattack executionの出力を用いる。敵の反撃は記録対象外。`prepareNextChapter` は累計名簿をコピーし、active／reserve／その章で撃破された味方を含むキャンペーン履歴を次章へ維持する。

`CampaignUnitBattleRecordPanel` は候補詳細と戦闘インスペクターの個別戦績を表示し、`CampaignUnitBattleRecordsSummary` はリザルトの累計一覧を表示する。PR #97の現在ステージ内 `BattleContributionPanel` は引き続きセッション限定であり、両者の表示は用途が異なる。

saveVersionを4へ更新し、v1／v2／v3は既存データを保持したまま空の累計配列を追加して移行する。新しい累計値はJSON save envelope、IndexedDB auto slot、ローカルバックアップに含まれる。IndexedDB database versionは1のまま。戦闘式、乱数、経験値配分、敵AIは変更しない。


## 型付きクラス定義レジストリ

`src/content/class-definitions.ts` は初期版14職の正規レジストリで、7基本職・7昇格職のID、表示名、職階、現行プロトタイプの能力上限を持つ。基本職の定義には昇格先、専用アイテムID、試作ボーナス、EXP方針も含む。定義はreadonly／freezeし、content testで全職と7経路の対応を照合する。

`src/content/classes.ts` は既存呼び出し元向けの互換projectionで、表示名・能力上限・昇格先・昇格定義をレジストリから導出する。レジストリを二重に保持しない。セーブ検証（`validate-game-state.ts`）も `isRegisteredClassId` を共有し、content登録外のクラスIDを拒否する。

味方／敵インスペクターは登録された職階ラベルを表示し、基本職の味方には昇格先と現行条件を示す。いずれも読み取り専用。CP-04／05の数値は仮データと明示し、CP-09／10が未承認の移動・武器適性を推測しない。クラスIDやGameStateSnapshotの形は変更せず、saveVersion 4／IndexedDB schema 1を維持する。


## プレイヤー行動commandの境界

プレイヤーフェイズ中の状態遷移は、攻撃（`perform-attack.ts`）、アイテム使用（`perform-item-use.ts`）、クラスチェンジ（`perform-class-change.ts`）に加え、移動（`perform-player-move.ts`）、武器変更（`perform-player-weapon-change.ts`）、待機（`perform-player-wait.ts`）もapplication層が担当する。`App.tsx` は入力プレビュー・選択・メッセージ・保存・戦闘履歴などUIセッションの責務を持ち、GameStateの変更ルールを直接再実装しない。

移動commandはマップ地形、移動種別、移動力、他ユニットの占有を含めて既存の最小コスト経路探索で合法性を再検証する。武器変更commandは登録武器・所持・クラス／武器種適性を検証し、移動後の行動前変更を許可する。待機commandは生存味方の未行動状態を検証して行動フラグのみを更新する。3 commandとも入力snapshotを不変に保ち、RNGや累計戦績を変更しない。

## データ駆動マップイベントと保存状態

`GameMapDefinition.events` は章マップに属する一度きりのイベント定義であり、`src/application/resolve-map-events.ts` が単一トリガーを解決し、`resolve-map-event-transition.ts` が確定済みGameStateの前後差分からターン／フェイズ開始、ユニット撃破、ボス撃破、勝敗確定のトリガーを生成する。ステージ開始と初回ターン開始は出撃確定時に処理する。

イベントは定義順に処理され、同じ章で一度だけ発火する。`firedMapEventIds` はGameStateSnapshotに保存し、同じ保存操作でイベントメッセージの発火済み状態も永続化する。新章のテンプレートは空配列から始まり、v1〜v4セーブは履歴を捏造せず空配列を追加してsaveVersion 5へ移行する。

イベントアクションは現時点で `show-message` のみ。メッセージはAppの既存ステータス表示に追加し、イベント処理はHP・位置・RNG・報酬・ユニット名簿を直接変更しない。村・宝箱・扉・増援・加入・会話選択肢などはイベント基盤の将来の拡張対象である。
