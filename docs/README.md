# ドキュメント目次

PR #59では移動可能マスの累計コストと最小コスト経路のプレビューを追加しました。タッチ操作では1回目のタップで経路を確認し、同じマスへの2回目のタップで移動を確定します（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60ではタッチ操作の移動確認を追加しました（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。PR #61では出撃準備からセーブ管理までの6段階を案内する操作ガイドを追加し、ガイドは閲覧専用でGameState／saveVersionへ影響しません。PR #62ではARIAグリッド構造の戦闘マップに単一Tab停止位置、矢印キーによる隣接マス移動、Home／Endの行端移動を追加し、地形・経路のフォーカス確認をオートセーブ不変のまま行えるようにしました。PR #63では出撃中の味方一覧にHP・移動／行動状態を表示し、一覧選択から対応するマップタイルへスクロールできるようにしました。PR #64では既存の戦闘予測値からHP・反撃可否・攻撃別の詳細を読み取り専用で表示します。PR #65では生存敵一覧から敵の配置タイルと地形を確認できるようにし、撃破済み敵を一覧から除外します。PR #66では敵の能力値・移動情報・所持武器の性能を表示する読み取り専用パネルを追加しました。PR #67では敵攻撃範囲内の選択マスについて、攻撃可能な敵・武器・現在位置／移動後の候補起点を表示しました。PR #68では合法な移動先プレビューに連動し、その位置から新たに攻撃可能になる敵を橙色の枠で示します。赤色の現在位置からの攻撃可能表示とは区別し、GameState／RNG／オートセーブは変更しません。PR #73では勝利／敗北目標パネルから、残敵一覧または名前付きボス／保護対象のマップ位置へ移動できるようにしました。選択は既存の閲覧・選択処理を再利用し、戦闘状態・セーブは変更しません。PR #74では出撃準備中に地形・出撃マス・現在の割り当てを反映する配置プレビューを追加しました。配置プレビューから候補詳細へ移動でき、メンバー選択／既存の位置プルダウン変更に即時追従します。確定前は保存されません。PR #75では出撃マスを選ぶと地形名・歩兵／騎馬の移動コスト・守備／回避補正を確認できます。配置中ユニットが進入できない地形には警告を表示しますが、出撃ルールや地形数値は変更しません。PR #76（merge commit `1d6e7c2ad3ba0c2444eaf243aa01f7f548b035f8`）で味方の能力値・武器性能／適性・所持品を確認する読み取り専用インスペクターを追加。main CI run #981は38 test files／235 unit tests、本番ビルド、Chromium E2E 45件が成功。作業中のPR #77では移動・装備変更・アイテム使用・クラスチェンジ・待機を一時戦闘履歴へ発生順に記録し、saveVersion 3には保存しない。PR #70／#71では実際の敵AIを再利用した敵軍フェイズ予測と味方ごとの予測HPを追加しました。PR #72では未行動の味方が残っている場合のターン終了レビューを追加し、一覧から戦闘へ戻る操作、敵軍フェイズへ進む明示確認、レビュー中のセーブ不変、全員行動済み時の即時終了をChromium E2Eで検証します。

2026-11-12更新: PR #1〜#99はmainへマージ済み（最新merge commit `d978ee42a13426ce50f13e97d80cf52d9cbf20bf`、main CI run #1182成功）。PR #92でタイトル画面／セーブ管理と第3章の試作コンテンツ、PR #94でChapter 1→2→3の連続遷移E2E、PR #95でactive／reserveの出撃前装備変更、PR #97でセッション内の味方戦闘貢献リザルト、PR #98で出撃候補の横並び比較、PR #99でキャンペーン累計戦績（saveVersion 4）を実装した。第3章は既存の試作キャスト・武器・ルールを使った検証用マップ。AIスコアと距離方式は引き続き暫定であり、CP-04／05の数値・初回昇格証報酬・正式シナリオは未決定。PR #86のpaired comparisonは敵軍phase 1回のみ。

このディレクトリは設計・開発・実装状況を管理します。PR #1〜#76はmainにマージ済みです。PR #76のmerge commitは `1d6e7c2ad3ba0c2444eaf243aa01f7f548b035f8`。main CI run #981は型チェック、38 test files／235 unit tests、本番ビルド、Chromium E2E 45件が成功しました。PR #73 head CI run #43018051521では型チェック、34 test files／220 unit tests、本番ビルド、Chromium E2E 43件が成功しました。PR #53で所持アイテムの数量スタックと登録済みIDによる安全な使用処理を追加し、PR #54でブラウザ標準のPWAインストール案内を追加した。PR #54のマージコミットは `146c5952713f1cae3916fcde3e0f8a2407f995e1`、CI run #643は成功。PR #55では既存のobjective／terrain定義を使うマップ目標進行・マス情報表示を追加した。PR #56では攻撃・敵軍行動の実結果をターン順に並べるセッション内戦闘履歴とポインターフォーカス時のレイアウトずれ修正を追加した（merge commit `c7c9d9ced4cd226b9c25cba7ab6d59e82b924910`、CI run #675でChromium E2E 23件成功）。PR #57ではセーブ内ユニットの地形通行可否を検証した（merge commit `1fc9d6e924e7323d4ea611d1b9649e4e39d408b3`、CI run #679でtypecheck・単体テスト・本番ビルド・Chromium E2E 23件成功）。PR #58では登録クラス／武器／アイテムへの参照と装備適性、現役ユニットの生存HPを検証し、JSONインポートとバックアップ復元で不正データを拒否した（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。今回の移動UI改善では既存の4方向Dijkstra結果から累計コストと最小コスト経路を表示し、移動確定前のセーブ不変をE2Eで確認する。PR #25でクラスチェンジ仕様の監査と未決定事項を整理し、PR #27で14クラスの能力上限・7経路の昇格ボーナス等の記入表を追加しました。PR #28では了承済み非数値ルールに基づき、昇格は移動／行動前のみ可能で行動を消費するよう変更し、初期キャンペーンへの証の自動付与を廃止しました。PR #29では昇格時の移動・武器適性・装備保持、7経路の一段階昇格、勝利後の明示報酬、所持品満杯時の拒否、確認キャンセル時のオートセーブ不変を回帰テストで検証しました（CI run #497: 単体テスト22ファイル／142件、Chromium E2E 11件成功）。PR #30ではPR #29のマージ後の状況を `AGENTS.md` と `docs/current-state.md` に反映し（CI run #499: 単体テスト22ファイル／142件、Chromium E2E 11件成功）、文書間の実装状況を同期しました。PR #31ではPR #30のマージ実績を文書へ反映しました。PR #32ではCP-07／08の境界回帰テストを追加し、EXP 0／99、現在HP 1／満タン、最大HP上限付近でのボーナス制限と現在HP維持を検証しました（CI run #503: 単体テスト22ファイル／146件、Chromium E2E 11件成功）。PR #33でPR #32の結果を文書へ同期した（merge commit `b04947dc3bee010b9e08ab408daf9be76b5a80e6`、CI run #505: 22ファイル／146テスト、Chromium E2E 11件成功）。PR #34で複数の章報酬を一括適用する際、後続報酬の失敗時に入力snapshotが部分更新されないことを回帰テストで確認した（merge commit `20c7ee2a440628d6ebf3ab197badc688a6ad56f4`、CI run #506: 22ファイル／147テスト、Chromium E2E 11件成功）。PR #35ではPR #33・#34の記録を同期した（merge commit `280cf310ee7b3b4262d470a34e4a188b84f3ecc0`、CI run #509: 22ファイル／147テスト、Chromium E2E 11件成功）。PR #36では昇格確認画面の現行説明と確定後のセーブ状態をE2Eで照合し、73 EXPの保持をリロード後まで確認した（merge commit `0eded6662a6f6e37c22501f6f64303fe988d9f86`、CI run #510: 22ファイル／147テスト、Chromium E2E 11件成功）。PR #38ではクラスチェンジ確認画面に8能力の予測値・実増加量・仮上限、HP／EXP、アイテム／行動消費、移動／武器／装備の維持表示を追加した（仮数値のまま）。マージコミット `72e32e673d4d02ecdcd4bd2a0c75e8bc2fa7f085`。PR #39で確認画面の8能力すべてのE2E照合を追加し、オーナーがマージした。マージコミット `aeaa8be6ec1f4f9ae24acb92fae3fd7856cc55fe`、CI run #532は型チェック、22ファイル／148単体テスト、本番ビルド、Chromium E2E 11件が成功。 PR #40で敵攻撃範囲の表示切替を追加した。生存・未行動の敵の現在位置と合法な移動可能マス、装備中の使用可能な武器の射程を重ねる予測表示であり、敵AIの行動先・対象を確定予告するものではない。距離は暫定Manhattan方式。CI run #554は型チェック、23テストファイル／154単体テスト、本番ビルド、Chromium E2E 12件すべて成功。PR #40はオーナーがマージした（merge commit `822d5bd63b196fee9489ce83571752376bd10e9f`）。最終headのCI run #560は型チェック、23テストファイル／154単体テスト、本番ビルド、Chromium E2E 12件すべて成功。PR #41で敵軍の生存／撃破一覧と生存味方のクラス・Lv・EXP・HPをリザルトへ追加し、merge commit `30ebbfcc155a0d8a533ff8d5ef7a2debc9c85c5c` でオーナーがマージした。既存データに記録されていない撃破済みユニットの最終HPや撃破者情報は推測せず、非表示にする。PR #42で敵軍フェイズの各敵の攻撃・命中／ダメージ・移動先・待機を一覧表示する。オーナーがmerge commit `8b5b3b583ad4cd6f7fae3f2cccd8b8ebbefe0e4f` でマージし、CI run #583ですべて成功した。画面内の一時記録で、セーブ形式は変更しない。PR #43では味方攻撃の先制／反撃／追撃ごとの実際の命中・HP変化・EXPを一時表示し、オーナーがmerge commit `8f0a3d023afab1a379dce99147f59bc9770084bb` でマージした（CI run #587: 25 test files／161 tests、Chromium E2E 15件成功）。PR #44では幅320pxでマップタイル40pxを維持する横スクロール領域、キーボード操作、タッチ入力によるユニット選択を追加してmainへマージした（merge commit `ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba`）。CI run #596は25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功した。セーブ形式と戦闘ルールは変更していない。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。 これはCP-15の最終仕様決定ではない。能力値・上限の数値および証の具体的な章報酬は引き続き未決定です。PR #22でバージョン付きJSONセーブの書き出し／読み込みを追加し、章ID・既存saveVersion migration・snapshot validatorによる検証と、上書き前の確認を実装しました。PR #23で最大3世代の手動ローカルバックアップ、4回目以降の最古世代ローテーション、確認付き復元を追加しました（マージコミット: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`）。出撃準備のキャラクター詳細・所持武器確認UI、詳細表示用インベントリ整形テスト、PlaywrightによるブラウザE2E、PWA manifest・Service Worker・オフライン起動、Service Worker更新後の自動再読み込みとIndexedDBセーブ復元もCIで検証済みです。現行実装はクラスチェンジの試作アイテム／UI、砦のフェイズ開始回復、章間引き継ぎ・章報酬のデータ駆動処理・次章開始UIを含みます。第2章は動作確認用の試作データであり、正式なマップ／報酬ではありません。設計提案、仮データによる一時的な実装、未確認事項を分けて記録してください。

PR #50はPR #48／#49後のREADME・開発ルール・実装状況を同期した（merge commit `451d1b47cd0084af47b2a64b7220bb376250b2e6`、CI run #611成功）。PR #51は320px幅・高さ568／720pxのタッチ操作E2Eと、回復量10HP（試作値）の回復薬使用フローを追加した（merge commit `a6162dc3180b0b635aa73573acf9ec7258dc1b11`、CI run #621: typecheck、26 test files／168 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3は維持。PR #52は採択済み非数値昇格方針と未承認バランス数値を記入表で区別した（merge commit `66ba9bf7769a5f1b97e2a259b547977a9d7c0faf`、CI run #614成功）。

| 文書 | 役割 | 主な更新タイミング |
|---|---|---|
| [game-design.md](game-design.md) | 添付されたゲーム設計書v1.0の原文 | 仕様改訂時。原文を無断で書き換えない |
| [architecture.md](architecture.md) | 現在の構成、責務、データフロー、今後の分割 | モジュール／データフロー変更時 |
| [deployment.md](deployment.md) | 出撃準備、配置確定、セーブ動作、未決定の編成ルール | 出撃準備／編成機能の変更時 |
| [combat.md](combat.md) | 戦闘計算・UI・武器データ・距離・未決定ルール | 戦闘式・武器モデル変更時 |
| [enemy-ai.md](enemy-ai.md) | 敵AI、フェイズ進行、勝敗判定、暫定スコア | AI行動・ターン進行・目標変更時 |
| [progression.md](progression.md) | 経験値報酬・レベルアップ・クラス上限・リザルト | EXP・成長・クラス能力上限の変更時 |
| [class-promotion.md](class-promotion.md) | クラスチェンジの設計根拠、未決定事項、互換性、実装計画 | 昇格条件・能力値・クラス性能・アイテム配布を決定／変更した時 |
| [class-promotion-balance-worksheet.md](class-promotion-balance-worksheet.md) | 14クラスの能力上限、7経路の昇格ボーナス、移動／武器データ、プレイテスト記録の入力表 | クラス数値・性能の検討／承認時 |
| [development.md](development.md) | 実際の開発環境、セットアップ、テスト、CI | ツールや手順が変更された時 |
| [database.md](database.md) | IndexedDBの実スキーマ、saveVersion、マイグレーション | 保存形式・マイグレーション変更時 |
| [security.md](security.md) | 実装済み対策、未確認事項、運用上の注意 | 認証・保存・外部接続・配信変更時 |
| [current-state.md](current-state.md) | 機能ごとの実装・テスト状況 | 実装・テスト状況が変わるたび |
| [design-reconciliation.md](design-reconciliation.md) | 設計と実装のA〜D照合、判断待ち | 実装確認または仕様決定時 |

## 文書の使い分け

- ゲームの**何を作るか**は `game-design.md`。
- **戦闘計算・予測・攻撃UI**は `combat.md`。
- **敵AI・フェイズ進行・勝敗判定と未決事項**は `enemy-ai.md`。
- **経験値・能力成長・現行実装の詳細**は `progression.md`。**クラスチェンジの正式決定事項・未決定事項と実装計画**は `class-promotion.md`。
- **どう分割する設計か／現在どう動くか**は `architecture.md`。
- **出撃準備と配置ルール**は `deployment.md`。
- **どう開発・検証するか**は `development.md`。
- **どう保存し、旧セーブをどう移行するか**は `database.md`。
- **何が実装済みか**は `current-state.md`。
- **設計と実装の差・判断待ち**は `design-reconciliation.md`。
- AIエージェントの作業手順・禁止事項はリポジトリ直下の `AGENTS.md`。

## 情報の確度

- **確認済み**: リポジトリのファイル、CI、実行結果などで直接確認した事実。
- **設計提案**: 添付設計書にある初期案。採用・実装済みとは限らない。
- **仮データ／暫定実装**: 操作確認の値や、設計上未決定の事項に対する一時的な実装。正式仕様ではない。
- **推定**: 根拠から導いた解釈。推定であることを明記する。
- **未確認／未決定**: 資料・実装・判断がなく確定できない事項。

## 作成していない文書

- `api.md`: 現行の設計資料にアプリケーションHTTP APIの仕様がなく、サーバーAPIも実装していないため未作成。
- `docs/decisions/ADR-*.md`: 確定済みの技術判断を捏造しないため、正式な意思決定を行った時点で作成する。


2026-11-12更新: PR #79をmainへマージし、固定seed合成fixtureを追加。CP-01／02／03／06／15もIssue #26で採択。開発専用の昇格試験室は `npm run dev` 起動後に `/?promotion-lab=1` で開く。stat preview用の合成fixtureであり、実プレイバランス試験を代替しない。Playwright E2Eは本番Previewに加え、開発サーバー上の試験室も検証する。


2026-11-12更新: PR #80をmainへマージ（merge commit `b3c58fd3e919370d65630186962b0be463474964`）。main CI run #1010はtypecheck／unit tests／production build／Chromium E2Eを含め成功。合成fixture用の `/?promotion-lab=1` に加え、実セーブJSONをローカルメモリで検証する `/?promotion-snapshots=1` はPR #81で実装済み。PR #82では同じsnapshot／開始RNGを使う単一seedのcontrol／promotion戦闘比較を追加した。読み込みはsaveVersion 3のJSONだけを受け取り、本編保存や外部送信を行わない。


2026-11-12更新: PR #81（merge commit `30cfc5fc0c764533bd6379eb2bb864c978d4f2b3`）で実セーブsnapshot比較ベンチを追加し、PR #82（merge commit `593b9eca8f90362a298bf4d3b926045ffc6098ba`）で既存戦闘ロジックによる単一seedのcontrol／promotion比較を追加。main CI run #1032は成功。PR #83（merge commit `0195f41ba09ac0512af9248e0ee7c15fa689f688`）では複数seedの固定条件・独立単発戦闘集計を実装し、final-head CI run #1041／main CI run #1042が成功。PR #84では7基本職×3profileの21ケース候補matrix、各行の人手確認、一括seed反復、データ区分つきCSV出力を追加予定。候補のpercentileは8能力順位平均による相対値で、実プレイデータかどうかを自動検証しない。実プレイの複数turn統制試験、CP-04／05の数値承認、初回の証報酬内容は引き続き未決定。


PR #92の作業内容: 起動時タイトル画面から新規開始／続きからを選び、出撃確定前の既存セーブ保護、JSON import/export、3世代バックアップ管理を行う。キャンペーンカタログに第3章の試作マップを登録し、第2章クリアから第3章へ進む統合ブラウザテストを追加する。saveVersion 3は維持。

2026-11-12更新: 次のPRではsaveVersion 4へ移行し、味方開始攻撃の累計戦績をセーブ／章間引き継ぎし、出撃候補詳細・戦闘中インスペクター・リザルトに表示する。

## マップイベント基盤（saveVersion 5）

初期版で必要な6種類のマップイベントトリガーと、メッセージ表示アクションを実装しました。イベントはマップcontentで宣言し、発火済みIDをセーブへ保存します。詳細は [current-state.md](current-state.md)、[architecture.md](architecture.md)、[database.md](database.md) を参照してください。村・宝箱・扉・増援・加入・会話選択肢は今後の拡張です。
