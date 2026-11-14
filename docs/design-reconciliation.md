# 設計書と実装の照合

## 1. 対象と判定基準

2026-11-12追記: PR #99（merge commit `d978ee42a13426ce50f13e97d80cf52d9cbf20bf`、main CI run #1182成功）でキャンペーン累計戦績とsaveVersion 4移行を追加した。続くクラス定義レジストリ作業では、14職のID・表示名・職階・試作上限・7昇格経路を型付きcontent定義へ集約し、セーブ検証と味方／敵インスペクターに接続する。これはCP-04／05の数値承認ではなく、CP-09／10の移動／武器適性表も未追加。クラスIDとsnapshot構造は変えず、saveVersion 4を維持する。

- 更新日: 2026-11-14
- 基準: `docs/game-design.md` v1.0（2026-11-09、初期実装向け設計案）
- PR #1〜#136はmainにマージ済み。PR #136（merge commit `34bace0451a4ba4609a0e558ad3129e4e9315f5c`）でキャンペーン選択履歴の読み取り専用表示を追加。PR #133で3章のWebKit mobile連続検証、PR #134でWebKit mobileのPWAオフライン起動と戦闘セーブ再開を追加した。PR #116で会話選択肢と条件分岐の汎用イベント処理、PR #117（merge commit `1b462f99cdc70a029e2986e592bc5f689e6bd3cb`）で選択済み会話分岐のセーブJSON round-trip回帰テストと文書同期をmainへ追加した。最新merge commitは `34bace0451a4ba4609a0e558ad3129e4e9315f5c`。PR #109で試作3章に `unit_001` の撃破を敗北条件として設定し、第1章の `enemy_005` を敵将として撃破目標にした。PR #92でタイトル画面／セーブ管理と第3章の試作マップを追加する。第3章は既存コンテンツ再利用の暫定データで、正式な世界観・ステージ設計・報酬・能力バランスの確定を意味しない。PR #90で敵AI移動候補スコアの内訳を予測／履歴へ読み取り専用表示した。PR #84（merge commit `29335744eb34d988efc3275efa42d0b8c8dd41c8`）で、開発専用の21ケース候補マトリクス・ペアseed単発戦闘評価・CSV出力を追加した。main CI run #1052のTypeScript型チェック、単体テスト、本番ビルド、Chromium E2Eはすべて成功。評価は移動・敵軍フェイズ・複数ターンを含む実プレイ再現ではなく、利用者が申告する「実プレイ由来」区分も真正性を自動検証しない。CP-04／05の数値承認と最初の昇格アイテム報酬は未決定。PR #55では既存のobjective／terrain定義を使う目標進行・マス情報パネルを追加した。PR #56では味方攻撃と敵軍フェイズの解決結果をターン順に表示するセッション内戦闘履歴を追加し、履歴を永続化せずsaveVersion 3を維持した。PR #57ではセーブ内の地形通行可否を検証した。PR #58ではクラス／武器／アイテムの参照整合性と装備適性、生存HPの検証を追加した（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。PR #59では累計移動コストと最小コスト経路を表示し、タッチ操作では最初のタップでプレビュー、同じマスへの2回目のタップで移動確定とした。地形・占有・移動力のルールは変更せず、移動確定前のプレビューは保存されない一時UI状態である（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60ではタッチ操作を同じ2段階確定に統一した（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。PR #63の味方ユニット一覧は既存のplayer units／HP／行動フラグを投影し、操作中は選択対象とマップスクロールのみを更新する。勝敗条件、ユニット能力、戦闘ルール、セーブ項目を追加しない。この文書では初期設計案との適合、未実装項目、暫定判断を整理する。現在の機能・実装・テスト状況の詳細は [current-state.md](current-state.md) と [architecture.md](architecture.md) を参照する。
- PR #45はPR #44後の文書同期、PR #46は320px幅のタッチ横スワイプE2E、PR #47はスワイプ後の右端ユニット選択E2Eを追加した。PR #48で関連するREADME・開発ルール・アーキテクチャ・実装状況を同期した。PR #46／#47はテストと文書のみで、ゲームルールやセーブ形式は変更していない。CI run #607（PR #48）はtypecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功。PR #49ではこの照合文書自体の更新をmainへ反映した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #50〜#54ではREADME等の文書同期、回復薬、採択済み昇格方針の表記同期、アイテム数量スタックと安全なID検証、PWAインストール案内をmainへ反映した。PR #54のマージコミット `146c5952713f1cae3916fcde3e0f8a2407f995e1` のCI run #643も成功。PR #57では地形通行可否のsave validatorと、JSONインポート／バックアップ復元のChromium回帰テストを追加した（CI run #679成功）。
- A: 初期設計案と実装が一致
- B: 設計済み・未実装
- C: 実装済み・未文書化
- D: 暫定実装・要確認

## 2. A：設計案に沿って実装した項目

| 対象 | 設計案 | 実装 | 根拠 |
|---|---|---|---|
| タイトル画面 | §9.2 | 起動時に新規開始／保存進行の再開を選択し、JSON import/exportと3世代ローカルバックアップ操作を集約。新規開始は出撃確定・保存成功まで既存auto slotを保持 | `src/components/campaign-title-screen.tsx`, `src/App.tsx` |
| 3ステージの章カタログ | §3.2 | 第1〜第3章をデータ登録し、第2章クリア後に第3章へ順次遷移。第3章は既存キャスト／ルール／仮地形を再利用した試作コンテンツ | `src/content/chapters.ts`, `src/content/maps/chapter-03.ts` |
| マップ・4方向移動 | §4 | 10×10試作マップをARIA grid／row／gridcellで構造化し、1つのTab停止位置と矢印キー／Home／Endによるマス間フォーカス移動を提供。4近傍Dijkstra。移動可能マスに累計コストを表示し、選択先への決定的な最小コスト経路を一時プレビュー（マウス／キーボードはホバー／フォーカス、タッチは1回目のタップでプレビューし2回目で確定） | `src/domain/movement/calculate-reachable-tiles.ts`, `src/App.tsx` |
| 戦闘計算・予測 | §6 | domain kernelと戦闘UI | `src/domain/combat/`, `src/App.tsx` |
| 自軍フェイズ→敵軍フェイズ | §3.1 | 自軍終了操作から敵軍AIを実行 | `resolve-enemy-phase.ts` |
| 敵行動順 | §7.3 | ID辞書順で固定 | 同上 |
| 敵の現在位置から攻撃 | §7.1 | 射程と装備武器を検証し攻撃 | 同上、`perform-attack.ts` |
| 敵の移動後攻撃 | §7.1 | 到達可能マスから攻撃可能位置を探索 | 同上 |
| 敵攻撃範囲表示 | §4.4／§9.2 | 自軍フェイズ中に切替。敵の現在位置・合法な移動先と装備武器の射程から脅威マスを予測 | `src/domain/combat/calculate-enemy-threatened-tiles.ts`, `src/App.tsx` |
| 攻撃できない場合に接近／待機 | §7.1 | 最近接味方との距離を基準に移動、不可なら待機 | 同上 |
| 勝利条件 | §3.2 | defeat_all／defeat_boss | `evaluate-battle-outcome.ts` |
| 勝利／敗北目標の進行表示 | §3.1／§3.2 | 現在の敵残数／ボスHPと、設定された敗北対象または味方全滅条件の状態をマップ上に表示 | `src/application/get-battle-map-details.ts`, `src/App.tsx` |
| マス選択時の地形効果説明 | §4.4 | 選択／フォーカスしたマスの歩兵／騎馬移動コスト、守備／回避補正、占有ユニット、砦の既存フェイズ開始効果を表示。閲覧専用でルール変更なし | `src/application/get-battle-map-details.ts`, `src/App.tsx` |
| 味方全滅時の敗北 | §3.2 | player rosterが0なら敗北 | 同上 |
| 主人公撃破・第1章ボス撃破 | §3.2／§8.3 | 試作3章で `unit_001` の撃破を敗北条件に設定。第1章は `enemy_005`（敵将）の撃破を `defeat_boss` の勝利条件とし、マップイベントで結果メッセージを表示 | `src/content/maps/chapter-01.ts`, `chapter-02.ts`, `chapter-03.ts`, `resolve-map-event-transition.ts` |
| 自動保存 | §10.3 | enemy phase開始状態と終了状態を保存 | App、IndexedDB |
| 砦のフェイズ開始回復 | §4.2 | フェイズ開始時に該当陣営の生存ユニットを最大HPの10%回復 | `apply-fort-recovery.ts`、`resolve-enemy-phase.ts` |
| マップイベント基盤・永続確認・履歴 | §8.3 | ステージ開始・指定ターン／フェイズ開始・ユニット撃破・ボス撃破・勝利／敗北を一度だけ発火。メッセージ確認状態を保存し、未確認イベントは再読み込み後もモーダルで再表示。敵軍フェイズ開始イベントの確認前は敵AIを停止。確認済みを含む発火済みメッセージは現章のイベント履歴で発生順に読み返せる | `GameMapDefinition.events`, `resolve-map-events.ts`, `resolve-map-event-transition.ts`, `map-event-dialog.tsx`, `map-event-history-panel.tsx` | `firedMapEventIds`／`acknowledgedMapEventIds`／`mapEventChoices`／`campaignChoices` はsaveVersion 8で導入され、現行saveVersion 9へ保持。`campaignBattleLog` は別系統で確定戦闘行動を保存。履歴は既存IDとマップcontentから再構成する読み取り専用UIで、新規save field／時刻は追加しない。v5の既発火IDは確認済みとして移行。村／宝箱／扉の独立したマップオブジェクトは未実装。会話選択肢は `show-choice`／`event-choice` による汎用エンジンを実装済み。`campaignChoiceKey`を付けた選択は章間で保持し、後続章のイベント条件にできる。今回、保存記録から章contentを参照する独立した読み取り専用キャンペーン選択履歴も追加したが、正式な会話・人物・章ルートは未設定。加入は `unit-interacts` と `recruit-unit` による汎用イベントアクションを実装済みだが、正式な加入人物・会話・配置コンテンツは未設定 |

| 章クリアから次章準備・保存再開 | 実装済み（勝利後の明示操作で報酬適用と次章snapshotを準備し、出撃配置確定後にのみ保存。既存のHP／EXP／能力／所持品／控え／RNGを引き継ぐ） | `src/application/prepare-next-chapter.ts`, `src/application/apply-chapter-rewards.ts`, `src/App.tsx` | Chromium E2Eで第1章クリアfixture→第2章準備→未確定中の旧セーブ維持→配置確定→saveVersion 3再読込を検証 |

## 3. B：設計済み・未実装

正式な章マップ・敵配置・報酬数量、加入人物や加入会話の具体的コンテンツ、実際の章ルートを選ぶ会話分岐と章解放UIは未実装。汎用的な会話選択肢と `event-choice` 分岐エンジンに加え、名前付き選択を章間で保存し後続章イベントの条件にする仕組み（`campaignChoiceKey`／`campaignChoices`／`campaign-choice` condition）は実装済み。汎用の加入イベント処理は `unit-interacts` に結び付く `recruit-unit` アクションとして実装し、明示定義されたCampaignUnitを控え名簿へ追加して次章へ引き継げる。主人公撃破による敗北条件の接続は試作3章で `unit_001` を対象に実装したが、正式な人物設定やシナリオは未決定。マップイベント基盤は実装済みで、ステージ開始／指定ターン・フェイズ開始／ユニット撃破／ボス撃破／勝利／敗北の一度きりのトリガーと、メッセージ表示・永続確認までを扱う。未確認メッセージは再読み込み後も表示し、敵軍フェイズ開始イベントは確認されるまでAI解決を停止する。章レジストリ・設定報酬適用・次章遷移UIは試作コンテンツ付きで実装済み。クラス昇格条件・コマンド・UIは実装済み。CP-07〜CP-14／CP-16の非数値ベースラインは2026-11-10に了承され、移動・行動前限定／行動消費と初期証の自動付与廃止を実装した。CP-04／CP-05の能力ボーナス・クラス別上限は数値未決定のため仮値のまま。具体的な証の報酬設定も未実装。詳細は [class-promotion.md](class-promotion.md) に記録した。撃破数・経験値・レベルアップの基本表示と、敵軍の生存／撃破一覧・生存味方のクラス／Lv／EXP／HPを表示する詳細リザルトを実装した。味方攻撃と敵軍フェイズの実解決結果を発生順にまとめるセッション内時系列履歴を追加した。これはリロード・セーブ読込・バックアップ復元・章切替で消える一時UI状態であり、永続的な戦闘履歴・撃破者別統計・正式な加入／会話コンテンツは未実装。PR #137では永続的な戦闘行動履歴と撃破者別実strike集計をsaveVersion 9で追加中。会話選択肢の汎用エンジンは実装済み。

## 4. 章間引き継ぎ基盤

設計書§3.2が指定する味方のレベル・能力・所持品の引き継ぎについて、勝利後に次章マップの出撃配置を用いてGameStateを作成するapplication commandを追加した。生存ユニットの永続データを保持し、撃破済みユニットを復帰させず、次章テンプレートの新規加入者と敵を構成する。章間HP方針は未決定のため明示引数とし、UIでは暫定的に現在HPを維持する。章レジストリ／章IDに基づくセーブ復元、章定義されたアイテム報酬、リザルトから次章への遷移、自動保存接続を実装した。第2章は同じ試作ユニットを用いた遷移確認用コンテンツで、正式マップ／報酬ではない。

## 5. C：実装済み・未文書化

現時点で該当なし。今回のAIルール・結果判定は `docs/enemy-ai.md` に記録する。

## 6. D：暫定実装・要確認

| 項目 | 現状 | 判断・影響 |
|---|---|---|
| AI攻撃スコア | 撃破+1000、三すくみ+40、HP欠損+0.5／HP、期待ダメージ、反撃リスクを重み付け | 実プレイで調整が必要。正式バランスではない |
| AIの移動先 | 攻撃可能位置を優先。なければ最寄り味方との距離と地形値で選択 | 評価式は暫定 |
| ID順 | 辞書順で固定 | 設計の例にある固定順を採用 |
| Manhattan距離 | 攻撃射程・AI接近で暫定利用 | 最終距離仕様は未決定 |
| 主人公敗北条件 | 試作3章で `unit_001` を `defeatCondition.targetUnitId` に指定。主人公撃破時は味方が残っていても敗北 | 正式な人物設定・各章の本番コンテンツは未確定 |
| 砦回復 | 最大HPの10%回復を実装。小数部分は暫定切り捨て | 設計書に丸め規則はなく、正式決定待ち。最大HP9以下では0回復 |
| リザルト | 勝敗、撃破数、敵軍全体の生存／撃破一覧、生存味方のクラス／Lv／EXP／HP、章定義されたアイテム報酬、次章開始UI | 永続的な戦闘履歴・撃破者別実strike統計はPR #137で実装中。正式な加入人物／会話コンテンツは未実装。章間の名前付きキャンペーン選択と後続章イベント条件判定の汎用機構はsaveVersion 8で実装済みだが、実際の章ルート選択・解放UIや正式コンテンツは未設定。セッション内の時系列履歴は別途実装（GameStateSnapshotには保存しない） |
| AIロール | 役割タグなし | 回復役・遠距離役等の優先度は未実装 |
| EXP付与単位 | ダメージを与えると+10 | 複数strike時はダメージイベントごとに+10とする実装解釈。行動単位かは要確認 |
| クラス上限 | クラスの能力上限を超えない | 数値定義がないためHP60／他30の仮上限を全クラスへ適用 |
| HP成長時／昇格時 | 最大HPのみ増加 | CP-08採択済み。昇格時も現在HPは維持 |
| 昇格ボーナス | クラス別能力ボーナス・昇格先上限を適用 | 仮値をcontentに設定しUI接続。設計書に数値なし、正式値未決定 |
| 昇格時EXP | preserve／resetを設定側が明示 | CP-07採択済み。昇格後もEXP 0〜99の端数を保持 |
| クラスチェンジ行動タイミング | 自軍フェイズ中、未移動・未行動ユニットのみ実行可能 | CP-12採択済み。昇格成功時に `hasActed=true` とし、そのフェイズの行動を消費。domain／application／UIで検証 |
| 昇格先クラス性能 | 正式な昇格先性能表ができるまでは現在の移動・武器適性を維持 | CP-09／10採択済み。CP-11は将来の承認済み適性表で装備不可が生じた場合に自動解除し、所持品は保持。現時点では適性変更なし |
| 初期昇格範囲 | 各基本職から1つの昇格先 | CP-16採択済み。初期版は一段階のみ。分岐・再昇格・降格は対象外 |
| クラスチェンジアイテム配布 | 明示的な章報酬／イベントでのみ配布 | CP-13／14採択済み。新規初期状態への自動付与を削除し、具体的な報酬設定は未登録。既存章報酬処理は容量超過を事前拒否し、アイテムを破棄しない |

## 6. 検証上の制約

- この監査作業ではローカルnpm install／typecheck／test／buildは実行していない。mainへマージされたPR #48の文書同期ブランチでは、GitHub Actions CI run #607によりtypecheck、25 test files／161 unit tests、production build、Chromium E2E 18件の成功を確認した。
- Chromium E2Eはブラウザ自動テストであり、実機スマートフォンのタッチ操作・OS表示を代替しない。実機確認は未実施。
- 敵AIの挙動、実機でのIndexedDB再開、正式バランスは実プレイを含む別途確認が必要。AIは初期ルールのプロトタイプであり、バランス調整前。


PR #76では味方インスペクターが既存のGameStateSnapshot／content定義から能力値・武器適性・所持品を読み取り専用で投影する。PR #77では現在の戦闘履歴を味方の確定コマンドまで拡張する。どちらも戦闘ルール・数値バランス・セーブ形式は変更せず、PR #77の追加履歴はセッション内一時UIに限る。


## 型付きクラス定義の照合（2026-11-12）

- 設計案の7基本職・7昇格職と7経路を `src/content/class-definitions.ts` の型付き14職レジストリに集約した。
- 表示名、職階、現在の試作能力上限、必要アイテム、試作ボーナス、EXP方針を同じ定義元から導出し、`src/content/classes.ts` は既存API向けprojectionとなる。
- セーブvalidatorは同じ登録ID一覧を参照する。未知クラスIDは拒否し、既存classId／GameStateSnapshot schema／当時の変更ではsaveVersion 4を維持した（後続のマップイベント基盤でsaveVersion 5へ拡張）。
- 味方詳細は基本職／昇格職と昇格先・条件を、敵詳細は職階のみを読み取り専用で示す。
- CP-04／05の数値は未承認のまま。CP-09／10の移動力・移動種別・武器適性は新規テーブルを作らず、現状のGameUnit値を維持する。

## リザルトからタイトルへの復帰（PR #110）

- 勝利／敗北リザルトからタイトル画面へ戻る操作を追加。これは表示状態だけを変更し、自動セーブ／GameState／saveVersion／IndexedDBを書き換えない。
- タイトル画面の「つづきから」で同じリザルトを再表示できることをChromium E2Eで検証する。


## 章間キャンペーン選択の照合（導入saveVersion 8・現行saveVersion 9）

- `show-choice.campaignChoiceKey` は一度だけ選べるキャンペーン全体のキーで、選択結果・元章・元イベントを `campaignChoices` に保存する。通常の `mapEventChoices` は現章内の選択履歴として従来どおり保持する。
- 後続章のマップイベントは `condition: { type: "campaign-choice", key, choiceId }` で選択結果を参照する。chapter registry validationで選択元が後の章になっていないこと、キー重複、choice ID参照を検証する。
- 次章遷移時はcampaignChoicesのみ継承し、現章のイベント発火／確認／選択履歴は次章の初期状態へリセットする。saveVersion 7から8への移行では既存の `mapEventChoices` を保持し、`campaignChoices: []` を追加する。IndexedDB schema 1は維持する。
- 実際の章ルート・正式会話・人物・報酬は追加していない。これは将来のコンテンツ authoring のための汎用基盤である。


## キャンペーン選択履歴UI

`CampaignChoiceHistoryPanel` は現行 `campaignChoices` のみを入力にし、`getCampaignChoiceHistory` が元章／元イベント定義から表示文言を復元する。これは章をまたぐ選択の一覧であり、現章 `MapEventHistoryPanel` が扱う発火済みイベントログとは別表示・別スコープ。現在の章contentに元イベントやchoice IDが見つからない場合は、保存されたIDだけを示し、ストーリー文言を推定しない。UI追加によるsaveVersion／IndexedDB schema変更はない。


| 永続的な戦闘行動履歴 | §8.3／§10 | 確定済みプレイヤーコマンド、味方攻撃strike、解決済み敵行動と実strikeを最大5,000件保存し、章をまたいで発生順に参照できる。撃破者件数は実HP遷移からのみ算出 | `GameStateSnapshot.campaignBattleLog`, `record-campaign-battle-log.ts`, `campaign-battle-history-panel.tsx` | saveVersion 9。v1〜v8は空ログで移行。予測／AI評価／プレビューは保存しない。既存のcampaignUnitBattleRecordsと分離 |
