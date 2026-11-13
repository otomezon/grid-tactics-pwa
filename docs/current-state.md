# 現在の実装状況

## 1. 監査スナップショット

PR #1〜#115はmainへマージ済み。PR #114で味方のマップ地点調査、PR #115でマップイベントによる味方加入を追加した。PR #116では選択肢付き会話と条件分岐の汎用処理を実装している（レビュー待ち）。PR #105では現章の発火済みイベント履歴、PR #106では自軍フェイズ終了レビューの敵攻撃対象・全味方予測HP表示、PR #107では敵攻撃のstrike別予測詳細を追加した。 PR #108では敵軍フェイズ予測の各行動をマップで一時確認できるようにした。PR #102でプレイヤー操作commandのapplication境界とマップイベント基盤（saveVersion 5）、PR #103で未確認イベントメッセージの再表示・確認状態保存（saveVersion 6）、PR #104でイベント確認に対応したブラウザテストセットアップを追加した。PR #113ではマップイベントに明示的なアイテム付与と事前定義された敵増援の出現を追加し、発火ID・ユニット・所持品の既存GameStateだけで一度限り実行する。PR #95で出撃前の装備変更を出撃予定／控え予定の両方へ追加し、saveVersion 3を維持した。PR #92でタイトル画面／保存データ管理と第3章試作マップを追加し、PR #93でREADME・AGENTS.md・実装状況の記述を同期した。PR #87でクラス役割タグによる遠距離攻撃役の暫定標的優先、PR #88で移動先選択理由、PR #89で攻撃対象候補の既存評価内訳、PR #90で移動先候補の既存評価内訳を予測／戦闘履歴へ追加した。PR #91では章クリアから次章出撃確定・再読込までの統合E2Eを追加した。

- 勝利／敗北リザルトの「タイトルへ戻る」はタイトル画面の表示状態だけを切り替え、自動セーブを変更しない。タイトルの「つづきから」では同じステージ結果へ再開できる。PR #110で追加。
- PR #112では、7基本職×3 profileの21ケース昇格試験fixtureに第1章の敵将 `enemy_005` を生存・行動済みで追加する。`defeat_boss` 目標が試験前に勝利へ解決される状態を避け、既存AIによる敵軍phase比較を開始できるようにする。試験用fixtureのみの変更で、ゲーム処理・未承認バランス値・GameState／saveVersion／IndexedDBは変更しない。
- 敵軍フェイズ予測・ターン終了前レビューの各行動から「マップで確認」を選ぶと、予測開始位置・敵AIが選択した移動先・攻撃対象を戦闘マップ上で強調する一時プレビューを表示する。強調表示は既存の敵行動ログと現在のユニット位置だけを使い、経路や別のAI判断を生成しない。マップクリック、通常のユニット選択、GameState更新で解除し、GameState／RNG／IndexedDB／saveVersionを変更しない。PR #108で追加。
- 更新日: 2026-11-13
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #104のCI run #1279ではtypecheck・53 test files／308 unit tests・production buildが成功し、Chromium E2Eは63件成功・1件失敗。失敗は共通`startBattle` helperによるイベント確認後の二重クリックで、PR #105にて修正した。PR #105ではイベント履歴のunit／Chromium E2Eも追加した。
- PR #1〜#110は `main` にマージ済み。PR #111 merge commitは `cd1170413e04d965705bc39f12ac396a4f690f64`（Chapter 1の敵将目標・主人公固定出撃を反映したE2E修正）、PR #110 merge commitは `f721e48829b6247dbf680631c187e208e1863172`（勝利／敗北リザルトから自動セーブを保持してタイトルへ戻る導線）、PR #109 merge commitは `8816064472dc54b75ad7aa6577efdc12a81a56c1`（主人公敗北条件・第1章の敵将勝利条件）、PR #108 merge commitは `8096f06fdd4d631cb3b3418e01003d1d612a02d1`（敵行動のマップ一時プレビュー）、PR #107 merge commitは `4f32a7a1447da70a7e4346279710e9d90953cc2c`（敵攻撃のstrike別予測詳細）、PR #106 merge commitは `69f8b1146a3571e4d7f358b979c97834bcb1bc71`（ターン終了レビューで敵攻撃対象／全味方予測HP表示）、PR #105 merge commitは `dce2c09138d58b2efe983cfbaff12a0e814030d9`（現章の発火済みイベント履歴）、PR #104 merge commitは `93c85981058ffb7edcabe60e5b9de86171a771af`（イベント確認を含むE2Eセットアップ）、PR #103 merge commitは `ffed3c865837e6a180d4abd8ec18931abd32ed9b`（saveVersion 6の未確認イベント永続確認）、PR #102 merge commitは `5ed8b9677c5e9d7d6f985ba25a2a61bd19d07549`、CI run #1234はtypecheck、53 test files／303 unit tests、本番build、Chromium E2E（本番63件・開発5件）が成功。PR #97では味方開始攻撃の実strikeだけを集計するリザルト表示を追加。敵の反撃は味方の与ダメージに含めず、履歴は画面セッション内のみ（saveVersion 3／IndexedDBの形式変更なし）。PR #95では出撃予定／控え予定の装備変更を出撃確定時にまとめて保存するUIを追加し、saveVersion 3を維持した。PR #94ではChapter 1→2→3の連続キャンペーン引き継ぎをChromium E2Eで検証した。PR #90では敵移動候補評価内訳、PR #91では章間引き継ぎE2E、PR #92ではタイトル画面／セーブ管理と第3章試作マップを追加した。PR #87では遠距離攻撃役のclass roleと暫定+35点、PR #88では移動先選択理由、PR #89では攻撃対象候補ごとの評価内訳を予測／戦闘履歴に表示した。GameUnit／saveVersionは変更していない。PR #81〜#83で実セーブsnapshot比較・単一seed比較・20／100／250 seedの単発戦闘集計を追加し、PR #84で7基本職×3profileの21ケース候補マトリクス、一括評価、CSV出力を実装した。PR #86で既存 `beginEnemyPhase`／`runEnemyPhase` による敵軍phase 1回のpaired seed比較も追加済み。敵軍移動・標的選択・攻撃・砦回復までを含むが、次の自軍操作／複数turn／章攻略は含まない。controlは昇格せず待機し、別の攻撃行動を比較するものではない。21ケースmatrixのデータ区分は利用者申告であり真正性を検証しない。CP-04／05の数値と昇格アイテムの具体的な章報酬は引き続き未決定。PR #69では移動後攻撃プレビューのキーボード操作E2Eを追加し、PR head CI run `43003039801` はtypecheck、32 test files／210 unit tests、本番ビルド、Chromium E2E 38件が成功。PR #68では合法な移動先をプレビュー中に、その位置から新たに攻撃可能になる敵を橙色で表示する機能を追加した。main CI run #872はtypecheck、32 test files／210 unit tests、production build、Chromium E2E 37件がすべて成功。PR #54ではブラウザ標準のPWAインストールプロンプトと、非対応ブラウザ向けの手動追加案内を追加した（merge commit `146c5952713f1cae3916fcde3e0f8a2407f995e1`、main CI run #643成功）。PR #55では既存の勝利／敗北条件と地形定義を参照する目標進行・マス情報パネルを追加した。PR #56では、味方攻撃と敵軍フェイズの実行結果をターン順にまとめたセッション内戦闘履歴を追加し、地形情報パネルのポインターフォーカスによるマップ位置ずれも修正した（merge commit `c7c9d9ced4cd226b9c25cba7ab6d59e82b924910`、CI run #675でChromium E2E 23件成功）。PR #57ではセーブ内ユニットの地形通行可否を検証した（merge commit `1fc9d6e924e7323d4ea611d1b9649e4e39d408b3`、CI run #679でtypecheck・単体テスト・本番ビルド・Chromium E2E 23件成功）。PR #58ではクラス／武器／アイテムIDの登録整合性、装備武器の適性、および現役ユニットの生存HPもセーブ検証に加えた（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。saveVersion 3とDB形式は維持。PR #59では、移動可能マスの累計コスト表示と、ポインター／キーボードフォーカス時の最小コスト経路プレビューを追加した。タッチ操作では最初のタップで経路を表示し、同じマスへの2回目のタップで移動を確定する。プレビューは一時UI状態で、移動確定まではGameState／オートセーブを変更しない（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60ではタッチ操作に1回目プレビュー・2回目確定を追加した（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。PR #61では任意で開閉できる6段階の操作ガイドを追加した。今回のPR #62では戦闘マップをARIAグリッドとして行・列で構造化し、1つのTab停止位置、矢印キー移動、Home／Endの行端移動、フォーカス連動の地形／移動経路表示を追加した。フォーカス移動はGameState／オートセーブを変更しない。PR #63では生存・出撃中の味方だけを一覧化し、HP・移動／行動フラグを表示、クリックで対応マスを選択・表示領域へスクロールできる。控え名簿は含まず、セーブ形式は変更しない。 PR #64では既存AttackPlanから攻撃側／防御側HP、反撃可否、攻撃別の武器・ダメージ・命中率・三すくみ・地形補正を投影表示した（merge commit `b7084f8c0447efe98992848605ccdc0d2d79cde3`、CI run #780成功）。PR #25で昇格仕様監査・実装計画、PR #27でバランス記入表、PR #28で了承済み非数値ベースライン（CP-07〜CP-14／CP-16）の行動消費・初期証付与廃止を実装し、PR #29で昇格状態保持・7経路・明示報酬・満杯時拒否・確認キャンセル時のオートセーブ不変を回帰テストに追加した。PR #29のマージコミットは `35cf355e4b642943208b3f3a56ee57f3fea9c0ca`、CI run #497は22 test files／142 testsとChromium E2E 11件が成功。PR #30でガイド／目次／実装状況の記述をPR #29マージ後の状態へ同期した。PR #30のマージコミットは `bac853ed0b3c22c709c03015117f90675a96a8b7`、CI run #499もtypecheck・22 test files／142 tests・production build・Chromium E2E 11件が成功。PR #31はPR #30のマージ後文書を同期。PR #32ではCP-07／08の境界回帰テスト（EXP 0／99、現在HP 1／満タン、HP上限でのボーナス制限）を追加した。PR #32のマージコミットは `860e64130a754c056d970b11adf272ebca33b2fb`、CI run #503は22 test files／146 tests・Chromium E2E 11件成功。PR #33は文書同期のみで、merge commit `b04947dc3bee010b9e08ab408daf9be76b5a80e6`、CI run #505は22 test files／146 tests・Chromium E2E 11件成功。PR #34では、複数の章報酬の後続処理が所持品満杯で失敗した場合に入力snapshotが不変であることを検証するテストを追加した。merge commit `20c7ee2a440628d6ebf3ab197badc688a6ad56f4`、CI run #506は22 test files／147 tests・Chromium E2E 11件成功。PR #35はPR #33・#34の結果を文書へ同期し、merge commit `280cf310ee7b3b4262d470a34e4a188b84f3ecc0`、CI run #509は22 test files／147 tests・Chromium E2E 11件成功。PR #36では昇格確認画面の現行説明（暫定ボーナス、レベル1、EXP保持、証1個消費、行動消費）と確定後のセーブ状態をE2Eで検証し、73 EXPがリロード後も保持されることを確認した。merge commit `0eded6662a6f6e37c22501f6f64303fe988d9f86`、CI run #510は22 test files／147 tests・Chromium E2E 11件成功。PR #38 added the shared class-promotion stat preview and a responsive confirmation panel showing all eight stat results, HP/EXP effects, item/action cost, and preserved movement/weapon/equipment; prototype values remain provisional. Its merge commit is `72e32e673d4d02ecdcd4bd2a0c75e8bc2fa7f085`. CI run #527 passed typecheck, 22 test files / 148 unit tests, and production build, but its browser test still expected the previous confirmation copy. PR #39 corrected the UI assertions and verifies all eight stat rows; the repository owner merged it at `aeaa8be6ec1f4f9ae24acb92fae3fd7856cc55fe`. CI run #532 passed typecheck, 22 test files / 148 unit tests, production build, and 11 Chromium E2E tests. PR #40の最終head CI run #560はtypecheck、23 test files／154 unit tests、production build、Chromium E2E 12件成功。PR #41でステージ結果詳細を追加し、オーナーが `30ebbfcc155a0d8a533ff8d5ef7a2debc9c85c5c` でマージ。マージ後CI run #42827297778も成功。PR #42で敵軍フェイズの一時行動記録を追加し、オーナーが `8b5b3b583ad4cd6f7fae3f2cccd8b8ebbefe0e4f` でマージ。CI run #583は24 test files／158 testsとChromium E2E 14件成功。PR #43で味方攻撃のstrike別実行記録を追加し、オーナーが `8f0a3d023afab1a379dce99147f59bc9770084bb` でマージ。CI run #587は25 test files／161 testsとChromium E2E 15件成功。PR #44では320px幅で40px以上のタイルを維持する横スクロール領域、キーボード操作、タッチ入力によるユニット選択を追加し、`ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba` でマージ。CI run #596はtypecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功。狭幅マップの動作はChromiumで検証済みだが、実機スマートフォンは別途確認が必要。CP-15の最終要件は未決定のまま。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。Issue #26に了承記録がある。PR #23（最大3世代の手動ローカルバックアップ／確認付き復元）のマージコミット: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`。PR #22（バージョン付きJSONセーブexport/import）のマージコミット: `e70206fe92592c0c892171cb1e4d31abf0f53a42`。PR #16（キャンペーン控え名簿・出撃メンバー選択）のマージコミット: `fcbf021ce3fd978eb026251ff6c6005c0f0350f0`。PR #15（章開始前の出撃配置準備）のマージコミット: `4954d65843d4a9a1d0340a6ac36da50e7e09d408`。PR #14（セーブ内ユニットの出撃名簿照合）のマージコミット: `4a22f50680262808157a1232cc3e66909eee9626`。PR #11（章報酬／次章開始フロー）のマージコミット: `29fc033f11a01dda36768a00a6a3a7476cc6de3b`。PR #12（マップ指定ユニット撃破による敗北条件）のマージコミット: `7d9a25e2472cc5bd42529cfe48cb7b313109bcca`。PR #13（マップ定義検証）のマージコミット: `6a775ad1b0f33d3cd335bec7356728219740d9b7`。
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- PR #5 latest head (`e02012e4`) CI run #90: TypeScript型チェック成功、9 test files／54 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 initial implementation head (`4c8efb0b`) CI run #112: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #6 latest head (`914aca11`) CI run #118: TypeScript型チェック成功、10 test files／66 tests成功、Vite build／PWA Service Worker生成成功（precache 11 entries）。
- PR #17（出撃候補のキャラクター詳細・所持武器確認UI）とPR #18（詳細表示データ整形のテスト）はmainへマージ済み。PR #19でPlaywrightによるブラウザE2Eテスト、PR #20で本番PreviewにおけるPWA manifest／Service Worker／オフライン起動テストを追加し、いずれもCI検証済み。PR #20のマージコミット: `45e5a41ab16da1fd36fbd54967d68cd23b025a96`。PR #21ではService Worker更新時の自動再読み込み、IndexedDBセーブ復元、オフライン再読み込み後の状態保持をCIで検証済み。
- Node.js 26、npm、Vitest 5.0.0。
- Game save schema: `saveVersion: 7`。マップ定義・戦闘ユニット・控え名簿・キャンペーン累計戦績・発火済み／確認済みマップイベント・選択済み会話分岐の整合性を検証し、version 1〜6から移行する。

PR #50はPR #48／#49後のREADME・開発ルール・実装状況を同期した（merge commit `451d1b47cd0084af47b2a64b7220bb376250b2e6`、CI run #611成功）。PR #51は320px幅・高さ568／720pxのタッチ操作E2Eと、回復量10HP（試作値）の回復薬使用フローを追加した（merge commit `a6162dc3180b0b635aa73573acf9ec7258dc1b11`、CI run #621: typecheck、26 test files／168 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3は維持。PR #52は採択済み非数値昇格方針と未承認バランス数値を記入表で区別した（merge commit `66ba9bf7769a5f1b97e2a259b547977a9d7c0faf`、CI run #614成功）。PR #53では所持アイテムの数量スタック表示と、登録済みitem IDから効果を解決する安全な使用処理を追加した（merge commit `29ca7cf75343ca3f0c382f62ad43a6c5cdf64ca0`、CI run #638: 27 test files／171 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3と既存inventory配列は維持。

## 2. 機能別ステータス

| 機能 | 状況 | 関連ファイル |
|---|---|---|
| タイトル画面・キャンペーン開始／再開 | 実装追加（起動時に「はじめから」「つづきから」を提供。新規開始の出撃確定前は既存auto saveを保持し、確定後の保存成功時に置換。セーブJSON import/exportと3世代バックアップ管理も起動時画面に集約） | `src/components/campaign-title-screen.tsx`, `src/App.tsx` | Chromium E2Eで初回起動・再開・キャンセル／未確定時セーブ不変・壊れたセーブによる上書き防止・バックアップ作成・320px幅を検証 |
| キャンペーン3章カタログ | 実装追加（既存の地形・ユニット・武器・勝利条件を再利用した第3章の試作マップを登録。章1→2→3の順次遷移と現行saveVersion 7の読み込みを維持。正式シナリオ／報酬／バランスを含まない） | `src/content/maps/chapter-03.ts`, `src/content/chapters.ts` | chapter registry unit testで各マップ／初期snapshotの妥当性と次章参照を検証。Chromium E2Eで第2章クリア→第3章出撃確定→再読み込みを検証 |
| React／Vite／PWA | 実装済み（manifest／Service Worker／オフライン起動に加え、ブラウザ標準のインストールプロンプトとインストール済み状態のUIを提供） | `package.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx` |
| 操作ガイド | 実装済み（任意で開閉できる6段階の案内。出撃準備・移動・攻撃予測・アイテム／行動・地形・敵攻撃範囲・ターン進行・セーブ管理を説明。表示専用でGameState／saveVersion／IndexedDBを変更しない） | `src/components/operation-guide.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで全6段階の遷移、320px幅での横はみ出し防止、閉じた後の再表示、ガイド表示中のオートセーブ不変を確認 |
| 10×10マップ・地形 | 実装済み（仮コンテンツ） | `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` |
| 戦闘マップのキーボード操作 | 実装済み（ARIAのgrid／row／gridcellを使用し、グリッド内は1つのTab停止位置から矢印キーで隣接マスへ移動、Home／Endで行の端へ移動。フォーカスは地形情報と移動経路プレビューのみを更新し、Enter／Spaceで既存のマス操作を実行。ゲーム状態／オートセーブは変更しない） | `src/App.tsx`, `src/styles.css` | Chromium E2Eで行列数、単一Tab停止位置、方向・行端移動、マップ境界、セーブ不変を検証 |
| 戦闘中の味方ユニット一覧 | 実装済み（生存・出撃中の味方を表示し、HP、未移動・未行動／移動済・未行動／行動済の状態を既存GameStateから表示。一覧選択で対応マスを選択してマップ内へスクロール。控えは表示せず、UI選択のみでGameState／オートセーブを変更しない） | `src/components/unit-roster.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで行動フラグ別表示、未行動人数、マス選択、320px幅での右端ユニットへの自動スクロール、セーブ不変を検証 |
| 味方の能力成長率・EXP進捗表示 | 実装追加（出撃候補の詳細と戦闘中の味方インスペクターに、HP・力・魔力・技・速さ・幸運・守備・魔防の成長率、現在EXP／100、次レベルまでの残EXPを表示。確率表示のみで、レベルアップ抽選・RNG・GameState・セーブを変更しない） | `src/components/unit-growth-panel.tsx`, `src/application/get-player-inspection-details.ts`, `src/App.tsx` | projection／component tests、Chromium E2Eで8能力表示・EXP進捗・320px幅・閲覧中セーブ不変を検証 |
| 戦闘中の敵ユニット一覧 | 実装済み（生存・出撃中の敵をHP・クラス・位置・装備武器とともに表示。選択すると敵の占有マスを地形インスペクターで確認してマップをスクロール。撃破済みは一覧から除外し、配置総数は保持。攻撃やGameState／オートセーブは変更しない） | `src/components/enemy-roster.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで生存数・撃破後の除外、マップと一覧の選択同期、320px幅で右端敵の表示、セーブ不変を検証 |
| 敵ユニットの詳細情報 | 実装追加（選択中の生存敵についてHP、7能力値、位置、移動力／移動種別、所持武器の威力・攻撃力・命中・必殺・射程を読み取り専用で表示。装備中武器を明示し、敵一覧／マップ選択に同期。敵の行動や戦闘計算は実行しない） | `src/application/get-enemy-inspection-details.ts`, `src/components/enemy-inspector.tsx`, `src/App.tsx`, `src/styles.css` | 単体テストで能力値・物理／魔法攻撃力・武器表示・非生存／味方の除外を検証。Chromium E2Eで一覧／マップ選択同期、セーブ不変、320px幅表示を検証 |
| 味方ユニット移動 | 実装済み（4近傍Dijkstraによる到達可能範囲に累計移動コストを表示。ポインター／キーボードフォーカスで決定的な最小コスト経路を番号付きプレビュー。プレビュー中はGameState／セーブ不変で、タップによる移動実行は従来どおり） | `src/domain/movement/calculate-reachable-tiles.ts`, `src/App.tsx`, `src/styles.css` | 経路再構成・同コスト経路の決定性・占有／通行不可地形の遮断を単体テスト。コスト／経路表示・キーボード操作・移動後保存をChromium E2Eで検証 |
| 移動後の攻撃可能対象プレビュー | 実装追加（未移動・未行動の味方が合法な移動先をプレビューすると、現在位置では射程外でも、その移動先から装備中の使用可能武器で攻撃できる生存敵を橙色の枠で表示。現在位置から攻撃可能な敵の赤表示とは区別し、キーボード／ポインター／タッチの一時プレビューに連動。戦闘・移動・GameState／RNG／オートセーブは変更しない。距離は既存の暫定Manhattan方式） | `src/domain/combat/calculate-attackable-enemy-positions.ts`, `src/App.tsx`, `src/styles.css` | Domain単体テストで移動先起点・生存敵・武器適合・射程外・行動済み・未装備武器を検証。Chromium E2Eでポインター／キーボード／タッチ操作別の敵タイル識別、凡例／ARIA、プレビュー中のセーブ不変を検証 |
| 仮武器・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` |
| 戦闘予測・プレイヤー攻撃 | 実装済み（攻撃側／防御側HP、距離・速さ差、反撃可否と理由、武器・攻撃力・通常／必殺ダメージ、命中／必殺率、三すくみ・対象地形補正を既存forecastから表示。計算／戦闘ルールは不変） | `src/domain/combat/`, `src/application/perform-attack.ts`, `src/application/get-combat-forecast-details.ts`, `src/components/combat-forecast.tsx` |
| マップ目標・地形情報パネル | 実装済み（既存マップ／GameStateから勝利・敗北条件の進行と、選択／フォーカス中マスの移動コスト・守備／回避補正・配置ユニット・砦効果を表示。PR #73では残敵一覧／名前付きボス／保護対象の位置へ目標パネルから移動する閲覧専用ナビゲーションを追加。ゲーム状態／セーブは変更しない） | `src/application/get-battle-map-details.ts`, `src/application/get-battle-objective-navigation-targets.ts`, `src/components/battle-objective-panel.tsx`, `src/App.tsx`, `src/styles.css` | application／component単体テストとChromium E2Eで残敵数・ボスHP・敗北対象・目標ナビゲーション・320px幅・セーブ不変を検証 |
| 敵攻撃範囲の表示切替 | 実装済み（PR #40マージ済み。自軍フェイズでON／OFF。生存・未行動敵の現在位置と、地形・占有を考慮した移動可能マス、装備中で使用可能な武器の射程から脅威マスを予測。敵AIの移動先・対象の確定予告ではない。距離は暫定Manhattan。表示状態はセーブしない） | `src/domain/combat/calculate-enemy-threatened-tiles.ts`, `src/App.tsx`, `src/styles.css` | PR #40最終head CI run #560: typecheck、23 test files／154 tests、production build、Chromium E2E 12件成功 |
| 敵攻撃範囲の発生源詳細 | 実装追加（敵攻撃範囲を表示中にマスを確認すると、そのマスへ攻撃可能な生存・未行動敵、装備武器、現在位置／移動後の候補起点と距離を表示。脅威範囲と同一の移動・射程projectionを使い、敵AIの行動先／攻撃対象を確定しない。UIは一時状態でGameState／オートセーブを変更しない） | `src/domain/combat/calculate-enemy-threatened-tiles.ts`, `src/application/get-enemy-threat-inspection-details.ts`, `src/components/enemy-threat-inspector.tsx`, `src/App.tsx`, `src/styles.css` | 単体テストで複数敵の帰属、起点、敵ID順、無脅威／敵フェイズ、集合overlayとの整合性を確認。Chromium E2Eで詳細表示・空の安全マス・セーブ不変・狭幅表示を検証 |
| RNG state・save migration | 実装済み（saveVersion 7、version 1〜6→7。v1は旧weapon／RNG変換、v2はreserve追加、v3はcampaignUnitBattleRecords追加、v4は発火済みイベントID追加、v5は既発火イベントIDを確認済みに移行、v6は空のmapEventChoicesを追加。既存の発火／確認状態を保持し、旧セーブに存在しない選択履歴は捏造しない） | `src/domain/random/`, `src/persistence/migrations.ts` | migrations／validator／save-file tests、Chromium E2Eでv6の保存・再読み込みを検証 |
| 自軍フェイズ終了／敵軍開始 | 実装済み | `src/application/resolve-enemy-phase.ts`, `src/App.tsx` |
| ターン終了レビュー | 実装追加（未行動の味方一覧に加え、敵軍フェイズ予測から敵の攻撃対象と味方全員の予測HP／被ダメージ／撃破見込みを表示。予測一覧から行動済みを含む味方を選択して戦闘へ戻れる。未行動者を残してフェイズ終了するかを明示選択し、全員行動済みなら即時終了。確認はゲーム状態を変更しない） | `src/components/player-phase-end-review.tsx`, `src/App.tsx`, `src/styles.css`。component testsとChromium E2Eで全味方のHP予測、敵の攻撃対象、行動済み味方の選択／フォーカス復帰、320px幅、レビュー中のオートセーブ不変、明示確認後のフェイズ進行、全員行動済み時の確認省略を検証。 |
| 敵AI（攻撃対象評価） | 基本実装・暫定スコア | `src/application/resolve-enemy-phase.ts` |
| 敵AI（移動後攻撃／接近／待機） | 基本実装＋選択理由と全到達候補の評価内訳を表示（PR #90で既存スコアを移動後攻撃優先・攻撃対象評価・距離ペナルティ・地形評価へ分解。候補順、Y→Xタイブレーク、移動先は変更しない） | `src/application/resolve-enemy-phase.ts`, `src/components/enemy-movement-evaluations.tsx` | 単体テストで合計式・候補順・採用候補一致、Chromium E2Eで予測／履歴一致とプレビュー中のセーブ不変を検証 |
| 敵軍フェイズの行動予測 | 実装追加（自軍フェイズ中に実際のbeginEnemyPhase／runEnemyPhaseを呼び出し、敵の行動順・移動先・攻撃対象・戦闘結果・砦回復・勝敗見込みを表示。味方ごとの敵行動後HP、砦回復後HP、予測被ダメージ、撃破見込みも表示。敵の攻撃では実際に選ばれたAttackPlanから初撃／反撃／追撃ごとの攻撃力・通常／必殺ダメージ・命中率・必殺率・武器相性を展開表示し、ターン終了レビュー／実行後履歴でも同じ内容を再利用。味方操作でsnapshotが変わると更新。予測後stateは破棄し、GameState／RNG／IndexedDB／オートセーブは変更しない。AIスコアとManhattan距離は暫定） | `src/application/get-enemy-phase-forecast.ts`, `src/application/resolve-enemy-phase.ts`, `src/components/enemy-phase-forecast.tsx`, `src/components/enemy-attack-forecast-details.tsx`, `src/components/player-phase-end-review.tsx`, `src/App.tsx` | unit／component testsで実フェイズ解決との一致、選択攻撃の初撃／反撃／追撃ごとのforecast値を検証。Chromium E2Eで予測・終了レビュー・実行後履歴のstrike値一致、予測中のオートセーブ不変、実際の行動ログ／保存後HPとの一致を検証 |
| 敵行動順の固定 | 実装済み（ID辞書順） | `src/application/resolve-enemy-phase.ts` |
| 敵軍フェイズ／AI／勝敗判定テスト | 実装済み | `src/application/resolve-enemy-phase.test.ts`, `src/domain/rules/evaluate-battle-outcome.test.ts` | 9 test files／54 tests、GitHub Actions run #90成功 |
| ターン進行・行動フラグreset | 実装済み | 同上 |
| 敵軍フェイズ中セーブからの再開 | 実装済み（`phase: enemy` checkpointから再解決し、完了後は`phase: player`を保存） | `src/App.tsx`, `src/persistence/save-repository.ts` | E2Eで再開後の二重実行なしを検証 |
| 敵軍フェイズ行動記録 | 実装済み（敵ごとの行動種別・対象／移動先・命中／必殺／ダメージを一時表示。saveVersion変更なし。通常の再読み込み後は非保持） | `src/App.tsx`, `src/application/resolve-enemy-phase.ts`, `src/styles.css` | PR #42 CI run #583でChromium E2E 14件成功 |
| 味方攻撃の実行記録 | 実装済み（先制／反撃／追撃の各strikeの実結果、HP変化、EXP／レベルアップを一時表示。saveVersion変更なし） | `src/application/get-player-attack-report.ts`, `src/App.tsx`, `src/styles.css` | PR #43でprojection単体テスト／Chromium E2Eを追加。CI run #596でも回帰確認 |
| 勝利（defeat_all／defeat_boss） | 実装済み | `src/domain/rules/evaluate-battle-outcome.ts` |
| 敗北（味方全滅） | 実装済み | 同上 |
| マップ指定ユニット撃破による敗北 | ルール実装済み。試作3章すべてで `unit_001` を主人公の保護対象に設定（セーブ形式変更なし）。正式キャラクター設定は未確定 | `src/domain/rules/evaluate-battle-outcome.ts`, `src/content/maps/chapter-01.ts`, `chapter-02.ts`, `chapter-03.ts` |
| マップ定義の整合性検証 | 実装済み（terrain寸法／値、配置ID／座標の重複・範囲、ボス／敗北対象の所属陣営を検証） | `src/domain/models/validate-game-map.ts` |
| セーブ内ユニットの出撃名簿・地形・コンテンツ参照整合性 | 実装済み（各unit ID／factionの出撃名簿一致、移動種別で通行可能な現在地、登録済みクラス／武器／アイテムID、装備武器の所持・適性、現役ユニットのHP>0を検証。撃破済みユニットの欠落は許可） | `src/domain/models/validate-game-state.ts` |
| 出撃準備・配置確定 | 実装済み（生存中の候補／控えから出撃メンバーと位置を選択。候補詳細から所有・適性のある武器へ装備変更／解除が可能で、active／reserveの両方に対応。編集はメモリ上のみで、配置確定時にまとめて保存。saveVersion 7を使用）。正式な章ごとの人数条件は未決定。 | `src/application/prepare-player-deployment.ts`, `src/application/perform-deployment-weapon-change.ts`, `src/App.tsx` | application testsとChromium E2Eでactive／reserveの装備・解除、所有・適性制約、確定前セーブ不変、確定後保存を確認 |
| 出撃準備のユニット比較 | 実装追加（出撃予定／控え予定の候補から2人を選び、クラス・Lv・EXP・HP・移動・装備・武器適性・8能力・8成長率を横並び表示。同一ユニットの比較は拒否。320px幅では比較表内だけを横スクロールし、ページ横はみ出しを防止。UI状態のみでGameState／編成／装備／IndexedDB／saveVersionを変更しない） | `src/components/deployment-unit-comparison.tsx`, `src/App.tsx`, `src/styles.css` | component test、Chromium E2Eでactive／reserve間比較、重複選択拒否、クリア、320px幅、確定前セーブ不変を検証 |
| 出撃準備の配置プレビュー | 実装追加（章マップの地形・登録済み出撃マス・現在の編成／割り当てを10列×10行で表示。位置プルダウン／メンバー選択に追従し、空きマスを表示。配置済み味方から詳細を開ける。プレビューは一時UI状態のみ） | `src/components/deployment-preview.tsx`, `src/App.tsx`, `src/styles.css` | Chromium E2Eで初期配置、入れ替え、控え化、詳細フォーカス、320px幅、確定前のセーブ不変を検証 |
| 出撃準備の地形インスペクター | 実装追加（登録済み出撃マスを選ぶと地形名・歩兵／騎馬の移動コスト・守備／回避補正を表示。配置中ユニットに対する通行可否も表示し、通行不可なら警告。砦効果は既存の試作値をそのまま説明。地形値／出撃ルール／GameState／セーブは変更しない） | `src/application/get-deployment-terrain-details.ts`, `src/application/get-deployment-terrain-details.test.ts`, `src/components/deployment-preview.tsx`, `src/styles.css` | application／component単体テストで平地・山・砦・範囲外・非出撃マス、歩兵／騎馬の通行差を検証。Chromium E2Eで空きマス閲覧・補正表示・320px幅・セーブ不変を確認 |
| 出撃候補のキャラクター詳細・所持武器確認 | 実装済み（PR #17。クラス・能力・移動・武器適性・武器性能・所持アイテムの閲覧）。閲覧専用。インベントリ整形は専用単体テストで検証。ブラウザ／スマートフォンでの表示確認は未実施 | `src/App.tsx`, `src/styles.css`, `src/application/get-deployment-unit-details.ts` |
| 章クリアから次章準備・保存再開 | 実装済み（勝利後の明示操作で報酬適用と次章snapshotを準備し、出撃配置確定後にのみ保存。既存のHP／EXP／能力／所持品／控え／RNGを引き継ぐ） | `src/application/prepare-next-chapter.ts`, `src/application/apply-chapter-rewards.ts`, `src/App.tsx` | Chromium E2Eで第1章クリアfixture→第2章準備→未確定中の旧セーブ維持→配置確定→saveVersion 7再読込を検証 |
| ステージ結果詳細表示 | 実装済み（敵配置全体の生存／撃破一覧、生存味方のクラス・Lv・EXP・HPに加え、画面セッション中に確定した味方開始攻撃の実貢献を味方別に表示。攻撃回数、命中／ミス／必殺、実与ダメージ、撃破、獲得EXP、レベルアップ／能力上昇を集計し、敵の反撃は除外。リロード後は集計なしを明示。恒久記録や撃破済みユニットの最終HPは保持せず、saveVersion変更なし） | `src/application/get-battle-result-details.ts`, `src/application/get-battle-contribution-details.ts`, `src/components/battle-contribution-panel.tsx`, `src/App.tsx` | application／component tests、Chromium E2Eでリロード後の履歴欠落表示を検証 |
| キャンペーン累計戦績 | 実装追加（味方開始攻撃の実strikeのみを累計し、攻撃行動・strike・命中／ミス／必殺・実与ダメージ・撃破・獲得EXP・レベルアップ・能力上昇を味方IDごとに保存。active／reserve／撃破済み名簿から外れた味方の過去記録も保持。出撃候補詳細・戦闘中インスペクター・リザルトに表示。章間引き継ぎ、JSON export/import、バックアップを通じて保持。saveVersion 7） | `src/application/record-player-battle-contribution.ts`, `src/components/campaign-unit-battle-records.tsx`, `src/domain/models/game.ts`, `src/persistence/migrations.ts` | application／validation／migration／save-file／component tests、Chromium E2Eで実攻撃・レベルアップ・リロード後保持を検証 |
| 戦闘行動のセッション内時系列履歴 | 実装済み（PR #56で味方攻撃・敵軍フェイズを追加、PR #77で味方の移動・武器変更・アイテム使用・クラスチェンジ・待機を追加。確定済み行動だけを発生順に表示し、閲覧／プレビュー／キャンセルは記録しない。リロード・セーブ読込・バックアップ復元・章切替でリセットし、saveVersion 7のセーブ形式には保存しない） | `src/App.tsx`, `src/application/get-player-attack-report.ts`, `src/application/resolve-enemy-phase.ts` | PR #77 CI run #984: typecheck・unit tests・production build・Chromium E2E 46件成功。main CI run #985も成功 |
| マップイベントによる味方加入 | 実装済み（`unit-interacts` の一度限りイベントに `recruit-unit` を定義すると、検証済みCampaignUnitを既存の `reserveUnits` に追加。今の戦闘へは出さず、次章マップのplayerDeploymentにIDが定義された場合に出撃準備から選択可能。saveVersion 7で保存） | `src/domain/models/validate-campaign-unit.ts`, `src/application/resolve-map-events.ts`, `src/application/prepare-next-chapter.ts` | map／save validation、二重加入防止、加入者の次章引き継ぎ・出撃準備までのunit tests |
| 会話選択肢・条件分岐イベント | 実装済み（2〜4択の `show-choice` と、選択IDに一致する `event-choice` トリガーを検証・一度限り実行。選択を `mapEventChoices` に保存し、履歴にも反映。saveVersion 7） | `src/application/resolve-map-events.ts`, `src/domain/models/validate-game-map.ts`, `src/domain/models/validate-game-state.ts` | resolver・map/save validation・migration・dialog/history component tests |
| 永続的な戦闘履歴・撃破者別統計・キャンペーン選択／分岐 | 未実装（永続的な撃破者ログ、章解放・選択進行をまたぐキャンペーン全体の分岐管理が必要。汎用会話分岐エンジンは実装済みだが、正式な人物・会話・章コンテンツは未設定） | — |
| 経験値・レベルアップ | 実装済み（PR #6） | `src/domain/progression/level-up.ts`, `src/application/perform-attack.ts` |
| 経験値報酬 | 実装済み（設計書§5.3の初期案） | `src/application/perform-attack.ts` | application tests |
| レベルアップ・個別成長判定 | 実装済み（仮クラス上限） | `src/domain/progression/level-up.ts`, `src/content/classes.ts` | progression tests |
| 敵軍ユニットの結果一覧 | 実装済み（章マップの敵配置と現在状態を照合し、生存／撃破を表示） | `src/application/get-battle-result-details.ts` | 単体テスト・E2Eで検証 |
| 選択ユニットの経験値表示 | 実装済み（EXP x/100） | `src/App.tsx` | CI build。実機操作未確認 |
| 戦闘中の消費型回復アイテム | 実装済み（同一IDの所持アイテムは数量をまとめて表示し、回復薬の操作はスタックごとに1つ。移動後の味方が自身に使用し、確認後に最大10HPを回復。HP上限で制限し、アイテム1個と行動を消費。回復量は試作値。アプリケーション層はIDから登録済みアイテム効果を解決する。saveVersion 7の既存inventory配列を利用） | `src/content/items.ts`, `src/application/perform-item-use.ts`, `src/App.tsx` | application単体テストとChromium E2Eで移動後使用・キャンセル・HP上限・保存後状態を検証 |
| progression／attack／class-change／content tests | mainのPR #6〜#7と今回のPR #8で実装済み | `src/domain/progression/`, `src/application/`, `src/content/class-promotion.test.ts` | GitHub Actions run #168: 13 test files／78 tests成功 |
| 昇格先パス | 実装済み（設計書§5.5の7系統） | `src/content/classes.ts` | mapping tests |
| クラスチェンジ条件・アイテム消費・能力ボーナス適用 | ルール基盤実装済み。採択済みCP-12により移動・行動前のみ実行可、成功時に行動済みとなる。CP-09／10の移動・武器適性・装備維持、7経路すべての一段階昇格を回帰テスト化。PR #32でCP-07／08のEXP 0／99保持、現在HP 1／満タン維持、HP上限でのボーナス制限を追加 | `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts`, `src/domain/progression/class-change.test.ts`, `src/content/class-promotion.test.ts` | PR #32 CI run #503: 22 test files／146 tests、Chromium E2E 11件成功 |
| クラスチェンジアイテム定義・所持品表示 | アイテム定義と表示は実装済み。採択済みCP-13により初期付与を廃止し、章報酬／イベント定義による配布のみ許可。具体的な報酬は未登録。PR #29で明示報酬は勝利後のみ付与、所持枠満杯時は状態を変更せず拒否することを検証 | `src/content/items.ts`, `src/content/maps/chapter-01.ts`, `src/application/apply-chapter-rewards.ts`, `src/App.tsx` | PR #29 CI run #497: chapter-reward tests passed |
| クラスチェンジUI・確認・自動保存接続 | 実装済み（Lv.10／証所持／自軍フェイズ／未移動・未行動条件。確定でユニットの行動を消費）。確認画面に8能力の現在値・昇格後予測・実増加量・仮上限、最大HP／現在HP、Lv.1化・EXP保持、証消費、移動／武器適性／装備の維持、行動消費を表示する（CP-15の必須表示は採択済み。能力数値／上限は引き続き試作値） | `src/App.tsx`, `src/domain/progression/class-change.ts`, `src/application/perform-class-change.ts` | PR #38で8能力の現在値・昇格後値・実増加量・仮上限、HP／EXP等の影響を表示。PR #39で8能力すべての画面表示、暫定上限超過値の維持、キャンセル時のセーブ不変、確定後の状態保持をE2E検証。PR #39最終head CI run #532: typecheck、22 test files／148 tests、production build、Chromium E2E 11件すべて成功（オーナーがマージ済み） |
| 開発専用の昇格・戦闘比較ベンチ | PR #81〜#84をmainへマージ済み。/?promotion-lab=1 の合成stat previewと、/?promotion-snapshots=1 のv3セーブJSONローカル読込を提供。PR #84の21ケースmatrixは7基本職×3profileの参考候補を提示し、人が候補・敵・条件を確認してから一括実行・CSV出力する。PR #86では既存 `beginEnemyPhase`／`runEnemyPhase` を再利用した敵軍phase 1回のpaired seed比較を追加済み。controlは行動を見送り、promotionは昇格で行動を消費する。敵軍AIの移動・標的選択・攻撃・砦回復、選択ユニット／味方全体の被害、生存／全滅、次phase進行率を集計するが、複数turn・次の自軍操作・章攻略の再現ではない。データ区分は利用者申告で真正性を検証しない。CP-04／05承認とは別。snapshot／結果はメモリ上だけで、IndexedDB／GameState／自動保存／外部送信なし | `src/components/class-promotion-snapshot-bench.tsx`, `src/application/build-promotion-playtest-matrix.ts`, `src/application/get-promotion-combat-comparison.ts`, `src/application/get-promotion-combat-sample-summary.ts`, `src/application/get-promotion-enemy-phase-sample-summary.ts` | PR #86でunit／dev E2E・paired seed条件・CSV指標を追加し、mainへマージ済み |
| 正式な昇格ボーナス・上限・昇格後移動／武器データ | 未決定（現行は仮値） | `src/content/classes.ts` | playtest／仕様決定待ち |
| 敵AIの役割ベース標的優先 | 遠距離攻撃役（archer／mage／sniper／sage）をクラスcontentの役割メタデータで識別し、既存攻撃対象スコアに試作+35点を加算。攻撃ログ・敵軍フェイズ予測に採用理由を表示。GameUnit／saveVersion変更なし。回復役は対応する行動が未実装のため未登録 | `src/content/tactical-roles.ts`, `src/application/resolve-enemy-phase.ts`, `src/components/enemy-phase-forecast.tsx` | 役割対応・同点優先・予測／実行一致のunit／Chromium E2Eで検証 |
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
- AI対象スコアと移動先評価は初期ヒューリスティックで、実プレイ調整が必要。遠距離攻撃役の標的優先は試作+35点で、正式バランスではない。
- 役割タグは現在のユニットモデルにないためスコア対象外。
- 敗北条件は味方全滅に加え、マップが `defeatCondition: { type: "unit_defeated", targetUnitId }` を設定すれば指定味方の撃破でも成立する。現在の試作3章では `unit_001` を主人公の保護対象として設定している。これは初期キャンペーンの動作確認用IDであり、正式なキャラクター設定は未確定。
- 砦回復は実装済み。端数切り捨ては暫定判断で、設計書に正式規則はない。最大HP9以下では回復量0。
- クラス上限はHP60／他能力30の暫定共通値。正式なクラス別上限ではない。CP-01／02／03／06／15は2026-11-12に採択済み。昇格確認画面では要求ボーナス・実増加量・仮上限を分けて表示する。開発用 `/?promotion-lab=1` は合成fixtureだけを使う独立stat previewで、本編GameState／RNG／IndexedDB／自動保存には接続しない。
- 1戦闘中に複数回ダメージを与えた場合、現行はstrikeごとに+10 EXPを付与する解釈。
- HP成長時は最大HPのみ増やし、現在HPは維持。
- 正式な章マップ／敵構成／報酬品目・数量、会話／加入イベント、キャンペーン選択／分岐／解放管理は未実装。第2章はUI／引き継ぎ確認用の試作データ。クラスチェンジ証は採択済みCP-13に従い章報酬／イベントのみで配布するが、具体的な報酬定義は未登録。CP-04／CP-05の正式な数値バランスは未決定。
- マップ定義validatorは主要な構造・参照整合性を検証し、セーブ状態validatorは出撃名簿、地形通行可否、登録済みクラス／武器／アイテム参照、装備武器の所持・適性、現役ユニットのHP>0を検証する。このセーブ検証はプレイ中の経路履歴や、直前の移動経路が移動力内だったかまでは検証しない（経路プレビューは操作時だけの一時表示）。
- 出撃準備のメンバー選択・控え保存・章間引き継ぎと、候補詳細のインベントリ表示データ整形はCIテスト対象。ブラウザ／スマートフォン実機でのUI／IndexedDB通し確認は未実施。
- PlaywrightによるChromium E2Eは出撃準備・名簿保存・行動状態復元・敵軍フェイズ／ターン復元・幅390pxのレイアウトを確認済み。PWA manifest／Service Worker／precache／オフライン起動も本番Previewで検証済み。Service Worker更新時の自動再読み込みとセーブ復元はPR #21で検証済み。セーブファイルのexport/importはPR #22のCIで単体・ブラウザテスト済み（mainマージ済み）。3世代バックアップはPR #23の最終CI run #42734263896でtypecheck・unit tests（21 files／136 tests）・production build・Chromium E2E（10 cases）がすべて成功。 PR #29マージheadのCI run #497ではtypecheck・unit tests（22 files／142 tests）・production build・Chromium E2E（11 cases）がすべて成功。PR #30のマージheadのCI run #499でも同じくtypecheck・22 files／142 tests・production build・Chromium E2E 11 casesがすべて成功。PR #32のマージheadのCI run #503ではtypecheck・22 files／146 tests・production build・Chromium E2E 11 casesがすべて成功。PR #23はmainへマージ済み（merge commit: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`）。実スマートフォンへのインストール・オフライン操作の手動確認は未実施。

## 5. 次の作業候補

1. snapshotベンチへ実プレイ由来の有効なセーブを集め、PR #84の21ケース候補matrixで候補・敵・条件を確認して統制した実プレイ試験を行う。その観測結果を [クラスチェンジ・バランス記入表](class-promotion-balance-worksheet.md) に記録し、CP-04／05の7経路ボーナス／14クラス上限を別途承認する（合成fixture・単発seed集計だけでは承認しない）。
2. 章報酬・イベントの具体的な品目／受取人／数量を決定し、採択済みCP-13に従ってクラスチェンジ証を配布する。
3. 主人公の正式な人物設定・各章マップの正式コンテンツを作成し、砦回復の端数規則を確定。
4. タイトル画面からの新規開始／続きから／バックアップ復元を含め、スマートフォン実機で出撃準備・3章キャンペーン・章間引き継ぎ・次章再開までを検証する。加入コマンドは実装済みだが、加入人物・条件・会話内容の正式コンテンツは別途定義する。


## 初期キャンペーンの勝敗条件（試作）

- 試作3章では `unit_001` を共通の主人公保護対象に設定。主人公が撃破されると、味方が残っていても敗北する。
- 第1章は `enemy_005`（表示名「敵将」）を `defeat_boss` の対象とし、敵将撃破で勝利する。ほかの敵を全滅させる必要はない。第2章・第3章は従来どおり `defeat_all`。
- 主人公敗北時は各章の `defeat` イベントでメッセージを表示し、第1章では敵将撃破時に `boss-defeated` イベントを表示する。
- いずれも既存のマップ定義・イベント基盤を使用し、`GameStateSnapshot`／`saveVersion: 6`／IndexedDB schemaは変更しない。主人公の正式な人物設定、章のシナリオ、敵構成・数値は引き続き試作。

## 戦闘履歴の拡張（PR #77）

PR #77（merge commit `8883a9042c5527632fabdac87c0d74fb32c04ff9`）で、戦闘履歴へ味方の移動・武器変更・アイテム使用・クラスチェンジ・待機を追加した。履歴は確定済みコマンドだけを発生順に表示し、移動プレビュー・予測・フォーカス・選択・閲覧・確認キャンセルは記録しない。履歴はセッション内のみで、リロード／セーブ読込／バックアップ復元／章切替で消去する。GameState／RNG／IndexedDB／saveVersion 3は変更していない。PR CI run #984はtypecheck・unit tests・production build・Chromium E2E 46件が成功し、main CI run #985も成功した。


## 直近のクラスチェンジ更新（2026-11-12）

- PR #79をmainへマージ（merge commit `5e74df2c713c9184f4f43f2cc580740dd50856b1`）。固定seed 1〜1024から選んだlow／median／highの合成fixtureと、7経路×3profileの21 preview scenarioを追加。実プレイ結果ではない。
- CP-01／02／03／06／15をIssue #26で採択。CP-01は初期7基本職のみ、CP-02は基本職Lv.10以上、CP-03は7経路、CP-06は既存能力を切り下げず以後の成長のみ上限で停止、CP-15は確定前の影響情報表示を必須とする。
- 開発専用の試験室は `npm run dev` 起動後 `/?promotion-lab=1`。合成profileのstat previewだけを扱い、本編state／RNG／IndexedDB／自動保存／saveVersionには接続しない。
- CP-04／05の正式な能力上限・昇格ボーナス数値、クラス別移動／武器データ、および初回の証の章／イベント／受取人／数量は引き続き未決定。実プレイバランス試験は未実施。


### 実セーブsnapshot比較ベンチ（PR #81〜#83）

- 開発route /?promotion-snapshots=1 で、portable save JSON（envelope v1／GameState saveVersion 7）をメモリ上へ複数読み込み、既存validatorで章・マップ・ユニットを検証する。
- 現行7基本職のLv.10以上の出撃味方を候補とし、同クラス内の8能力percentileの平均を参考値として表示。3 snapshot未満は分布不足と扱い、low／median／highは自動で決めない。
- 元snapshotと、試験用promotion tokenをコピーにだけ用いた昇格command結果を比較する。IndexedDB／GameState／RNG／自動保存への書込み・外部送信なし。
- PR #82で既存 `performAttack` を使う単一seedのcontrol／promotion戦闘比較を追加し、PR #83では20／100／250seedの独立単発戦闘集計を追加。seedはcontrol／promotionでペアにし、各試行は元snapshotへ戻して実行する。HP／敵HP／EXP／撃破状態は試行間で持ち越さない。結果は攻撃命中率・命中時必殺率・平均与ダメージ・対象撃破率・反撃被ダメージ・生存率等を表示するが、敵軍フェイズ・移動・複数ターンの攻略を含まない。統制21ケースの実プレイ比較は未完了で、CP-04／05の数値承認も未実施。


### 複数seedの昇格戦闘サンプル（PR #83対象）

- 既存の `performAttack` と `getPromotionCombatComparison` を使い、読み込んだ同一snapshotから各試行を独立に構築する。control／promotionは各試行で同一の初期seedを使う。
- seed系列はsnapshotの初期RNGをsaltで分離したXorshift32 streamから決定論的に生成する。選択できる試行数は20／100／250。各試行は同じHP／EXP／敵HPから開始し、結果を次試行へ持ち越さない。
- 表示指標は攻撃命中率、命中時必殺率、平均与ダメージ／戦闘、対象敵撃破率、平均反撃被ダメージ／戦闘、反撃後の生存率、平均戦闘後HP。これは単一戦闘条件における固定seed集計で、完全な敵軍フェイズ・移動・複数ターン・地図攻略の勝率ではない。
- E2Eでは合成snapshotを使う。実プレイヤーのセーブ／プレイ結果を取り込んだものではなく、CP-04／05や初回証報酬の承認根拠にしない。


### 21ケース統制評価の候補整理（PR #84で実装済み）

- 実セーブsnapshotベンチに7基本職×低位／中央値／上位の21 slot matrixを追加。各基本職3件以上の候補がない場合は候補不足とし、候補が少ないことを合成データで補わない。
- 各候補は8能力ごとの同クラス内mid-rank平均percentileで並べ、下位25%・50%・90%に近い候補を仮提案する。プロフィールは相対的な候補選定ラベルであり、成長率や正式上限近傍の意味ではない。最終候補・敵・条件は利用者が各行で確認する。
- 21ケース一括実行は既存performAttackの独立単発戦闘20／100／250 seed反復を21組実行するもの。各ケースでcontrol／promotionに同一seedを適用し、元snapshotから各試行を再開始する。敵軍フェイズ・移動・複数turnは含まないため、実プレイ21ケースの代替ではない。
- CSVにcase/profile、候補source file・fingerprint・unit／class／stats、enemy／map／turn／RNG、seed range、sample count、control／promotion metrics、data classificationを記録する。data classificationの「実プレイ由来」は利用者申告であり、ファイルの真正性を機械的に検証しない。初期値「未確認」のままの出力は実プレイ結果に数えない。
- CSVはユーザーが明示的にダウンロードした時だけ作成される。import snapshot、matrix候補、結果はメモリ上だけであり、IndexedDB／GameState／自動保存／ネットワーク送信は行わない。


### 敵軍phase 1回のpaired seed比較（PR #86）

- 既存の `beginEnemyPhase`／`runEnemyPhase` を使い、control／promotionの両枝で同じ開始snapshot・turn・敵／味方編成・map・RNG系列から敵軍phaseを1回ずつ解決する。試行ごとに元snapshotの切り離しコピーから開始する。
- controlは昇格せず選択ユニットを行動済みにして待機し、promotionは既存昇格commandの行動消費状態を維持する。したがって「昇格して行動を失う場合」と「昇格せず行動を見送る場合」の比較であり、「昇格せず攻撃／回復等を行った場合」との比較ではない。
- 比較前に章／map／saveVersion／player phase／turn／RNG、対象味方の生存・未移動・HP／EXP／位置／移動性能／武器適性、対象以外の全unitとreserveの一致を検証する。
- 敵行動数・攻撃数、対象ユニットが狙われた率・被ダメージ・生存率、味方全体の被害／撃破、マップ条件を含む敗北結果率・味方全滅率、次の自軍phase進行率を記録する。敵AIの移動・標的選択・攻撃・砦回復には現行prototypeロジックを使用する。
- これは独立した敵軍phase 1回の比較であり、次の自軍操作、複数turn、移動を含む完全な戦闘、章攻略や勝率を再現しない。合成fixtureのCI結果は実プレイ証拠ではなく、CP-04／05の数値承認を代替しない。
- CSVはmatrix全21件の明示的なダウンロード操作でのみ出力する。snapshot／結果はメモリ上だけであり、GameState／IndexedDB／自動保存／ネットワーク送信を行わない。


## 3章キャンペーン連続遷移E2E（PR #94）

- `e2e/three-chapter-campaign.spec.ts`で、同一ブラウザー／同一campaign saveを使ってChapter 1→2→3の連続遷移を検証する。
- クリア済みchapter snapshotはテスト内で準備し、実際の戦闘を自動プレイしたとは主張しない。Victory表示、次章の出撃準備、配置確定前の旧auto save保持、配置確定後のIndexedDB保存、再読み込み後の「つづきから」を3章それぞれで確認する。
- Chapter 1開始時に用意したactive unitとreserve unitについて、level／EXP／stats／current HP／inventory、次章開始時の行動フラグreset、reserve所属、RNG stateの継承をChapter 2・3で照合する。
- 第3章の5敵ユニット登録と `saveVersion: 3` を確認する。戦闘式、AI、章報酬、正式シナリオ、能力値、保存スキーマは変更しない。
- このE2Eは章間の統合配線を検証するfixtureベースのブラウザ試験であり、実プレイ21ケースの昇格評価・実機スマートフォン試験を代替しない。


## 型付きクラス定義レジストリ（次期変更）

- `src/content/class-definitions.ts` を14職（基本職7／昇格職7）の唯一の定義元とし、ID、表示名、職階、現行の試作能力上限、基本職からの昇格先、必要アイテム、試作ボーナス、EXP方針を型で保持する。
- `src/content/classes.ts` は既存利用側との互換projectionを提供する。表示名、上限、昇格経路、`ClassPromotionDefinition` はレジストリから導出し、二重定義をなくす。
- セーブ検証は同じレジストリの登録ID判定を使う。未知クラスIDは引き続き拒否する。既存クラスID・保存フィールドは変えず、saveVersion 4およびIndexedDB形式にも変更はない。
- 味方詳細には基本職／昇格職、基本職の昇格先と現在の条件（Lv.10以上・証1個）を表示する。敵詳細には職階のみ表示する。閲覧専用で、クラス変更や行動は実行しない。
- 能力上限・昇格ボーナスは従来の試作値のまま。移動力・移動種別・武器適性は承認済みCP-09／10に従ってユニットの現行値を維持し、14職ごとの未承認テーブルは追加しない。
- 確認対象: `src/content/class-definitions.test.ts`、味方／敵インスペクターprojection tests、既存クラス昇格／セーブ検証tests。型チェック・全単体テスト・build・Chromium E2Eで確認する。


## クラス定義互換projectionの不変性

- `PROTOTYPE_CLASS_STAT_CAPS` はクラスごとの能力上限オブジェクトまで読み取り専用として公開する。返却値を変更する場合は `getPrototypeStatCaps` の防御的コピーを使う。
- `CLASS_PROMOTION_DEFINITIONS` は定義レコードに加えて能力ボーナス・能力上限も凍結し、実行時の誤変更を防ぐ。TypeScript上もネストした値を読み取り専用として扱う。
- `getClassPromotionDefinition` は従来どおり独立した防御的コピーを返すため、昇格処理側の計算・呼び出し規約は変えない。
- PR #101のクラス定義projection不変化では、ゲームルール、暫定バランス値、`GameStateSnapshot`、当時の `saveVersion: 4`、IndexedDB形式を変更しなかった。PR #102でイベントの発火済みIDを追加してsaveVersion 5とし、今回の確認状態追加でsaveVersion 6へ拡張する。

## プレイヤー行動コマンドのapplication境界

- プレイヤーの移動・武器変更・待機を、それぞれ `perform-player-move.ts`、`perform-player-weapon-change.ts`、`perform-player-wait.ts` のapplication commandへ集約した。
- commandはフェイズ、対象ユニットの陣営／生存状態、行動フラグ、武器所持・適性、移動力・地形・占有を検証し、入力snapshotを変更せずに次状態を返す。
- 移動経路は既存のDijkstra helperを再利用する。UIのタッチ2回確定・キーボード／ポインターによるプレビューはApp側に残し、確定時にapplication commandで再検証する。
- 武器変更は移動後も行動前なら実行可能という従来挙動を維持し、待機は移動済みでも未行動なら実行可能とする。
- これら3 command自体はGameStateフィールドを追加せず、RNGやキャンペーン累計戦績を変更しない。マップイベント進行は `firedMapEventIds` と `acknowledgedMapEventIds` をsaveVersion 6へ保存し、IndexedDB schemaは維持する。

## マップイベント基盤と永続確認（saveVersion 6）

- `GameMapDefinition.events` にマップ固有のイベントを定義する。トリガーはステージ開始、指定ターン／フェイズ開始、特定ユニット撃破、ボス撃破、勝利、敗北をサポートする。
- 初期アクションは `show-message` のみ。イベントはマップ定義順に評価し、メッセージを既存のステータスメッセージへ追加表示する。村・宝箱・扉・増援・加入・選択肢付き会話・アイテム配布は未実装。
- `GameStateSnapshot.firedMapEventIds` に発火済みイベントID、`acknowledgedMapEventIds` に明示確認済みIDを保存する。同じイベントは同一章内で一度だけ発火し、同じ章で未確認のメッセージを再読み込み後も再表示する。確認済みメッセージは再表示しない。出撃配置確定時のステージ開始／初回自軍ターン開始、以降のフェイズ／ターン遷移、ユニット撃破、ボス撃破、勝敗確定の各コミット後に発火を判定する。
- 未確認イベントがある間はモーダルで内容を表示し、確認操作が完了するまで通常の戦闘操作・次章遷移をロックする。複数件は発火順に1件ずつ表示し、確認済みIDを同じGameStateSnapshotへ保存する。ダイアログはEscape／背景クリックで閉じない。
- 敵軍フェイズ開始時にイベントメッセージが発火した場合、フェイズ開始checkpointを保存してAI解決を停止する。最後のイベントが確認された後にのみ敵軍AIを実行する。未確認イベントがある敵軍フェイズsnapshotを再読み込みした場合も同じ停止状態から再開する。
- セーブ検証はイベント定義の構造・参照、発火済みIDの一意性・サイズ、確認済みIDが発火済みIDの一意な部分集合であることを検証する。v1〜v4は空の発火／確認ID配列を加えてv6へ移行する。v5は発火済みIDを保持し、既存メッセージが一時表示のみで既読状態が不明なため、すべて確認済みとしてv6へ移行して意図しない再表示を防ぐ。新章は空のイベント進行から開始する。
- 章1には中立的な操作案内を1件だけ定義し、章2／3はイベントなしを明示している。ストーリー・報酬・正式シナリオの追加を意味しない。
- Event historyは現在章の発火済み`show-message`だけを `firedMapEventIds` の保存順に再構成し、確認済み／未確認の両方を読み取り専用パネルで表示する。未発火イベントは表示せず、履歴本文・時刻・追加進行情報を保存しない。章切替で表示対象は新章に切り替わる。saveVersion 6／IndexedDB schema 1は変更しない。
- 関連テスト: `resolve-map-events.test.ts`、`resolve-map-event-transition.test.ts`、マップ／GameState validator tests、v1〜v5 migration tests、キャンペーン／バックアップ／開発ベンチE2E。

- PR #113ではマップイベントの `grant-item`／`spawn-reinforcement` アクションを追加。付与先は生存中の出撃味方、アイテムは登録済みID、数量は1〜5、所持品は最大5枠。増援はマップイベントに事前定義された敵ユニットのみで、ID重複・敵陣営・座標・地形通行可否・占有マスを検証。イベントはコンテンツ順にdetached snapshotへ適用し、途中失敗時は部分更新せず発火IDも追加しない。増援の撃破も通常の `unit-defeated` トリガーに接続。GameStateに新しいfieldを設けず、既存のfired IDsとunits/inventoryで保持するためsaveVersion 6／IndexedDB schema 1を維持。既存3章に新報酬・増援は追加しない。

- PR #114（作業ブランチ `feat/map-interaction-actions`）では、味方によるマップ地点調査を追加。未発火の調査地点をマップ上の「調」マーカー・凡例・ARIAラベルで表示し、地点にいる生存・未行動の味方の詳細へ「調べる」操作を追加。移動後も調査でき、成功時はその味方の行動を消費する。調査結果は既存のイベント確認ダイアログ／履歴・発火IDで保存し、リロード後に未確認メッセージを再表示。map validatorは座標範囲・通行可能地形・初期配置との重複・地点重複・表示テキスト・任意対象unitを検証。GameStateの新field・saveVersion／IndexedDB schema変更なし。Chapter 1の追加地点は探索コマンド確認用の中立メッセージのみ。
