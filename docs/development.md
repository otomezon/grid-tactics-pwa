# 開発環境・開発手順

## 1. 採用した基盤

| 項目 | 設定 |
|---|---|
| Node.js | `.nvmrc` は 26（Node.js 26 LTSを基準） |
| 許容Node.js | `^22.12.0 || ^24.0.0 || >=26.0.0` |
| package manager | npm |
| UI | React 19.3.1 / React DOM 19.3.1 |
| 言語 | TypeScript 7.0.2 |
| 開発・ビルド | Vite 8.3.6、`@vitejs/plugin-react` 6.2.1 |
| PWA | `vite-plugin-pwa` 2.0.0 |
| テスト | Vitest 5.0.0、Playwright Test 1.65.0（Chromium E2E／WebKit iPhoneモバイルprofile） |

直接依存のバージョンは `package.json` に固定し、依存関係全体をnpm lockfile v3（`package-lock.json`）へ記録している。クリーンな環境とCIでは `npm ci` を使用し、lockfileにない依存解決の更新が起きないようにする。PWA plugin 2.0.0はNode.js 20.19.0以上を要求し、Vitest 5系のNode要件も満たすようNode 26を標準にしている。

## 2. ローカルセットアップ

Node.js 26系とnpmを用意し、リポジトリのルートで実行する。

```bash
npm ci
npm run dev
```

Viteが表示するローカルURLをブラウザで開く。スマートフォン実機から確認する場合は、LANからアクセスできるよう開発サーバーのhost設定等を別途調整する。

`package-lock.json` はリポジトリで管理する。依存関係を意図的に変更する場合は、対応するNode.js／npm環境で `npm install` を実行し、`package.json` と `package-lock.json` を同じ変更としてレビューする。通常のセットアップ・CIでは `npm ci` を使う。

## 3. 検証コマンド

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

- `typecheck`: TypeScript型チェック。
- `test`: Vitest単体テスト。
- `build`: 型チェック後にVite本番ビルド。PWA manifest／Service Workerも生成対象。
- `preview`: build後の成果物をローカルで確認。
- `test:e2e`: タイトル画面の初回開始／続きから／新規開始キャンセル・未確定時セーブ保護／不正セーブの上書き防止／320px幅と、第2章から第3章への遷移・保存・再読み込みを含め、Playwrightで `e2e/pwa-preview-server.mjs` を起動し、Vite Previewが事前に生成した本番ビルドを配信する。章間E2Eでは、クリア済みの保存fixtureから第2章の出撃準備へ進み、出撃確定前の自動セーブ不変、出撃／控えの能力・HP・EXP・所持品・RNG引き継ぎ、確定後のIndexedDB保存と再読込を検証する。Chromiumで出撃準備・控え名簿保存・10×10配置プレビュー（出撃マス／地形／メンバー割り当て／空きマス／割り当て入れ替え／配置トークンから候補詳細を開く操作）・配置マスの地形インスペクター（地形名・歩兵／騎馬コスト・守備／回避補正・選択ユニットの進入可否・空きマス閲覧・320px幅・閲覧中のセーブ不変）・行動状態復元・操作ガイド全6段階の遷移／再表示／閲覧中のオートセーブ不変／320px幅での横はみ出し防止・移動可能マスの累計コスト表示・ポインター／キーボードフォーカスでの経路プレビュー・タッチの1回目タップでの経路表示と同一マス2回目タップによる移動確定・移動確定前のオートセーブ不変・移動確定後の位置／hasMoved保存・敵軍フェイズ・幅320px・高さ568／720pxでの40pxマップタイル／キーボード横スクロール／タップ選択／指での横スワイプ後に右側ユニットを選択・移動後の回復薬の数量スタック表示／使用／確認キャンセル／HP上限・スタックからアイテム1個と行動の消費・勝利／敗北目標の進行表示・目標パネルから残敵一覧／ボス／保護対象タイルへのナビゲーションとフォーカス・マス選択／フォーカスによる地形効果表示、ARIAグリッド内の矢印キー／Home／End移動と単一Tab停止位置、フォーカス移動時の地形／経路プレビューおよびセーブ不変、味方一覧のHP・行動状態表示／ユニット選択／320px幅でのマップ自動スクロールとセーブ不変・未行動味方がいる場合のターン終了レビュー（未行動名簿・敵フェイズ予測要約・一覧から戦闘復帰・明示確認でのフェイズ終了・レビュー中のセーブ不変・全員行動済み時の即時終了）・味方攻撃と敵軍フェイズの時系列履歴・連続行動での順序・リロード後の履歴消去とセーブ不変・幅390pxのレイアウト・PWA manifest／Service Worker／オフライン起動／インストールプロンプト表示・確定・キャンセル・インストール完了イベント・Service Worker更新時の自動再読み込みとセーブ復元、セーブファイルの書き出し／読み込みと不正ファイル拒否、通行不可地形に置かれたユニットを含むJSONインポート拒否と自動保存不変、未登録クラス／アイテム参照を含むJSONインポート拒否、ローカルバックアップ3世代の保持・ローテーション・復元・キャンセル・migration・不正データ拒否（通行不可地形と未登録アイテム参照を含むバックアップ復元拒否、自動保存不変を含む）を確認する。`playwright.config.ts` と `e2e/` が定義元。Chromium projectは既存の全ブラウザE2Eを実行し、別の`webkit-mobile` projectはiPhone 13相当のWebKit profileで出撃準備のタッチ操作・320px／390px幅の詳細パネル表示を検証する。さらに、戦闘マップで1回目のタップは経路プレビューだけを表示してIndexedDBを変更せず、同じ移動先への2回目のタップで位置と`hasMoved`が保存されることを検証する。WebKitのモバイルprofileはエンジン互換性をみる自動試験であり、実機iOS Safari・ホーム画面インストール・OS統合・実機オフラインの証跡ではない。テストサーバーにある `/__test/force-sw-update` はテスト中だけ `dist/sw.js` にコメントを追記し、Service Workerの更新検知を発生させる専用エンドポイントである。 `npm run test:e2e` はこの本番Previewテストの後、`playwright.dev.config.ts` でVite開発サーバーを起動し、`/?promotion-lab=1` の合成fixture試験室と `/?promotion-snapshots=1` の実セーブsnapshot比較ベンチも検証する。snapshot比較ベンチのE2Eは、21ケースmatrix、手動worksheetの行／枝監査、列別の記入数、観測欄別21ケース比較、ペア充足レポートとCSV出力、条件メタデータ差、片枝不足の再取込時に21ケースの分母を維持することを確認する。監査表の確認は表示文言ではなく、control／promotionの各セルとテーブル列を対象にする。21ケースseed反復E2Eでは全fixtureを`synthetic`として明示選択するため、結果表のデータ区分は`合成fixture`として検証し、`未確認`を期待しない。タイトル画面のバックアップ復元E2Eは、現在の自動セーブを第1世代へ退避してタイトル画面から1回復元する経路に絞る。3世代ローテーション・復元キャンセル・旧形式migration・不正バックアップ拒否は`e2e/pwa.spec.ts`の包括テストで検証し、同じ処理を長い複数段階フローとして重複させない。この包括テストは同一IndexedDBデータを使って3世代作成、世代交代、通常／旧形式復元、キャンセル、複数の不正snapshot拒否を連続確認するため、Playwright個別テストのタイムアウトを180秒に設定する。タイムアウトを延ばすのはこの一連テストだけで、個々のUI assertionの既定timeoutは変更しない。開発用routeは本番buildには露出しない。通常のキャンペーンE2Eでは同一ブラウザー内の2タブで同じauto saveを開き、先に保存したタブの状態を後から保存しようとした古いタブが競合として拒否され、IndexedDBの最新レコードが変化しないこと、再読み込みで最新状態へ戻れることを確認する。タイトル画面のバックアップ復元とJSON importも、別タブの保存後は同じrevision競合でtransaction全体を中止し、最新autoとバックアップ世代の双方を維持することを確認する。通常の2タブE2EではBroadcastChannelによる即時のconflict表示・操作ロック・再読み込みを確認し、transaction fallbackのE2EではBroadcastChannelを無効化して最終防衛線を独立に検証する。 タイトル画面のブラウザストレージ表示では `StorageManager.estimate()` の概算使用量／割当量と明示的な再取得、estimate非対応時の表示、容量表示だけでは `persist()` を呼ばないこともChromium E2Eで確認する。

## 4. CI

`.github/workflows/ci.yml` を追加した。Pull Requestと `main`／`feature/**` へのpushでNode.jsを `.nvmrc` からセットアップし、`npm ci`、型チェック、Vitest、Vite build、Playwright用Chromium／WebKitの導入、ブラウザE2Eテストを実行する。PRのChecksで実行結果を確認すること。ローカル実行・CI実行済みであると推測して報告してはいけない。

追加の `.github/workflows/security.yml` はPull Request／`main` push／週次／手動実行でセキュリティ検査を行う。依存関係全体の `npm audit --audit-level=high`、Pull Requestで新規依存に導入されるhigh／critical脆弱性のDependency Review、JavaScript／TypeScriptのCodeQL解析を定義する。CodeQLは同一リポジトリのPull Requestを対象にし、fork Pull Requestでは書き込み権限を要求する解析jobをskipする。各結果は対応するGitHub Actions checkとSecurity画面で確認する。

`.github/dependabot.yml` はnpmとGitHub Actionsのversion updateを毎週実行し、同一ecosystemのmajor／minor／patch更新を一括グループ化する。大量の個別PRを作らないよう各ecosystemのopen PR上限を1件とする。依存更新はロックファイルを含めて同じPR内で検証し、CI／security checksが通ったことを確認してから採用する。

CIのworkflow checkをマージ必須にするには、GitHubのRulesets／branch protectionでstatus checkをrequiredに設定する。YAMLだけではbranch protectionを変更できないため、リポジトリ設定で別途確認する。

## 5. PWA

`vite.config.ts` で `vite-plugin-pwa` を設定し、manifest、SVGアイコン、Service Workerを生成する。Service Workerはbuild成果物に含まれる。アプリはブラウザの `beforeinstallprompt` イベントを受け取った場合だけインストールボタンを表示し、ユーザー操作からブラウザ標準のインストールプロンプトを呼び出す。`appinstalled` またはstandalone display modeを検知するとインストール済み表示へ切り替える。イベントに対応しないブラウザ向けには手動追加方法を案内し、iPhone／iPadではSafariの共有メニューを利用する。インストール可否はブラウザ・OS・利用条件に依存するため、イベントが届かない場合に独自のインストール成功表示は行わない。CIのブラウザE2Eでは、本番Preview上でmanifest・Service Worker・オフライン起動・インストールイベントの表示／確定／キャンセル／完了状態に加え、Service Workerスクリプト更新後の自動再読み込みとIndexedDB保存状態の復元を検証する。実際のスマートフォンへのインストール、OSによるアプリ終了／再開、実機オフライン動作は引き続き手動確認が必要。実施項目・結果記録は [スマートフォン／PWA実機確認手順](smartphone-verification.md) を使用し、CIのChromium／WebKit mobile profile結果と実機で確認した端末・OS・ブラウザを区別する。

## 6. 環境変数・外部サービス・デプロイ

現時点で環境変数、外部API、ホスティング先、本番デプロイ手順は定義していない。設定を推測で追加しないこと。本番環境への接続やデプロイは別途承認を得てから行う。


### 味方ユニットの読み取り専用インスペクター

味方一覧またはマップの味方マスを選択した際、能力値・HP／EXP・移動／行動状態・武器性能と既存の武器適性・所持アイテム数量を表示する。Application unit testとComponent testに加え、Chromium E2Eで一覧からの表示、敵インスペクターへの切替、320px幅、閲覧中のオートセーブ不変を検証する。表示用projectionは既存のGameStateSnapshotとcontent定義を読むだけで、ゲーム状態／saveVersionを変更しない。


### 戦闘履歴の回帰テスト

Chromium E2Eでは味方の移動・装備変更・アイテム使用・クラスチェンジ・待機が履歴へ発生順に追加されること、移動プレビュー／確認キャンセルでは追加されないこと、閲覧後もsaveVersion 3のオートセーブに履歴データが存在せず、リロードで履歴が消えることを確認する。既存の味方攻撃・敵軍フェイズ履歴テストも継続する。


### キャンペーン戦闘記録のページ送り回帰テスト

キャンペーン戦闘ログは最大5,000件を保持するため、画面では50件単位でページ送りする。component testでは51件のfixtureに対して最初の50件だけが描画され、次ページの表示範囲とボタンのアクセシブル名があることを検証する。Chromium／320px WebKit mobile E2Eでは123件以上のログを読み込み、最初／次／最後／前ページ、ページ末尾、検索条件変更時の先頭復帰、絞り込み解除、CSVへの絞り込み全件出力を確認する。これらの操作後もIndexedDBのauto saveが不変で、WebKit mobile profileでもdocument横幅が320pxを超えないことを検証する。ページ状態はReactの一時UI状態で、GameState／RNG／IndexedDB／saveVersionは変更しない。


### バックアップ世代の表示・復元前プレビュー回帰テスト

Chromium E2Eでは、タイトル画面と戦闘中のバックアップ一覧が既存のbackup snapshotから章・ターン・フェイズ・勝敗・保存形式を表示することを検証する。現在形式はv10、旧形式は検証後の移行先（例: v2 → v10、v9 → v10）を区別する。復元確認には対象ターン／フェイズ／勝敗／形式に加え、現在の自動セーブを第1世代へ退避すること、選択した復元元を保持すること、3世代を超える場合の整理、別タブでrevisionが進んだ場合の復元拒否を表示する。キャンセル・stale-tab拒否・正常復元・旧形式復元の既存E2Eを維持し、auto saveとbackup slotの実データを確認する。プレビューは読み取り専用で、GameState saveVersion 10、IndexedDB schema 1、revision照合transactionを変更しない。


### キャンペーン戦闘ログの保持状況・連番監査テスト

application testでは空ログ、入力配列の順序を変更しないsequence範囲、先頭sequenceより前の未保持連番数、保持範囲内の欠番数、5,000件の上限状態を検証する。component testでは先頭より前の未保持連番と保持範囲内の欠番を別々に表示し、5,000件到達だけでは削除済みと断定しない案内を確認する。Chromium／320px WebKit mobile E2Eでは123件の保存ログについて保持件数・連番範囲・先頭より前の未保持連番0件・保持範囲内の欠番0件を表示し、ページ移動／検索／CSV出力後もIndexedDBの自動セーブが不変であることを確認する。集計は絞り込み前のログ全体を対象とし、不在の理由や行動内容は推測せず、GameState／RNG／IndexedDB／saveVersionを変更しない。


## 7. キャンペーン戦闘履歴CSVの出力範囲

キャンペーン戦闘履歴では、現在の章／記録種別／キーワードに一致した「絞り込み結果」と、画面の絞り込みに関係なく保持されている最大5,000件の「保持ログ全件」を別々にローカルCSV出力できる。どちらのCSVにも出力範囲・出力対象のログ記録件数・全保持件数・保持上限・最初／最後のsequence・先頭より前の未保持sequence数・保持範囲内の欠番数・上限到達状態・画面のフィルター値を含める。欠番と先頭より前の番号は、フィルター後の結果ではなく、エクスポート時点の全保持ログから算出する。出力対象が0件でも、範囲と監査メタデータだけの行を出力する。strikeごとにCSV行を分けるため、「出力記録件数」はCSVの行数ではなく元ログの件数を示す。CSVは式として解釈され得る文字列を無害化し、ローカルダウンロードだけで処理する。セーブ・GameState・RNG・IndexedDB・saveVersionは変更しない。Vitestでscope／coverage／空結果、Chromium E2Eで両方のダウンロード内容とセーブ不変を確認する。


## 8. キャンペーン戦闘履歴CSVのE2E

Chromium／WebKitの3章キャンペーン履歴テストでは、章／種別／キーワードで絞り込んだ「絞り込み結果」CSVを検証する。123件のページング回帰テストでも、50件ずつの表示後、ページング範囲に依存せず絞り込み結果全件がCSVへ含まれることと、filtered付きファイル名を確認する。別のChromium回帰テストでは、検索条件を維持したまま「絞り込み結果」と「保持ログ全件」を両方ダウンロードし、全件側には検索で除外されたログが含まれること、どちらも保存を変更しないことを確認する。CSVの保持件数・sequence範囲・欠番監査値はフィルター前の全保持ログから算出する。


## 9. 味方別累計CSVの出力範囲

味方別累計では、名前検索に一致した「検索結果」と、検索語を無視した「累計全員」を別々にCSV出力できる。全員出力も画面で選択中の並べ替え順を保つ。両CSVに出力範囲、出力対象人数、保存されている累計記録人数、画面の検索キーワード、並べ替え条件を含める。検索結果が0人でも条件を記録したメタデータ行を出力する。味方の累計は既存の保存済みcampaignUnitBattleRecordsのみを使い、攻撃記録のない味方を推測で補わない。セーブ・GameState・RNG・IndexedDB・saveVersionを変更しない。VitestとChromium E2Eで両方の範囲・メタデータ・セーブ不変を検証する。


## 10. 時系列ログの味方ユニットフィルター

時系列ログでは、保持済み記録に現れた味方の行動者／攻撃者と敵軍行動の対象を候補として選択できる。選択した味方の行動・攻撃、およびその味方を対象とした敵軍行動を抽出する。候補と絞り込みは既存ログのみから導出し、ログがない味方や欠落した行動は補完しない。「保持ログ全件」CSVはフィルターを適用せず全保持記録を出力するが、画面の味方ユニット選択IDを含む全条件を監査メタデータへ残す。選択変更・解除・CSV出力はいずれも表示用状態とローカルファイルだけを扱い、GameState／RNG／IndexedDB／saveVersionを変更しない。単体テストで味方行動／攻撃／被対象の抽出と候補重複排除、Chromium E2EでCSV条件記録と自動保存不変を検証する。


## 11. キャンペーンの被攻撃集計

「被攻撃集計」は保持中のcampaignBattleLogだけから、敵軍行動の敵側strikeと味方攻撃イベントに含まれる敵側カウンターstrikeを味方単位で集計する。味方自身の初撃／追撃は被攻撃に含めず、missも被攻撃strike数として数える。被弾数・miss数・被必殺数・被ダメージ・攻撃者数・最新sequenceは保存済み実strike記録から算出し、履歴がない味方のゼロ行や欠落した行動を補完しない。最大5,000件の保持範囲を超えるキャンペーン通算値とは断定せず、欠番／先頭未保持連番／上限到達があれば不完全な保持ログからの集計であることを示す。CSVには保持ログ件数・上限・sequence範囲・欠番・上限到達状態を含める。application／component testで反撃・敵軍strike・味方の初撃除外・miss／critical／damage計算・空結果・formula-safe CSVを確認し、Chromium／320px WebKit E2Eで画面・CSV出力とIndexedDB自動保存不変を検証する。GameState／RNG／IndexedDB／saveVersionは変更しない。


### キャンペーン敵攻撃集計の回帰テスト

「敵攻撃集計」は保持中のcampaignBattleLogから実際の敵strikeだけを章ID＋敵ユニットIDで集計する。敵軍フェイズの敵攻撃と、味方攻撃イベントに記録された敵ディフェンダーのカウンターを対象とし、味方の初撃／追撃・予測値・AI評価は除外する。strike数にはミスを含め、命中／ミス／必殺／実ダメージ／攻撃対象味方数／味方撃破数／最新sequenceを表示する。上限・欠番・先頭より前の未保持連番を警告・CSVへ残し、不在の行動や0件ユニットを作らない。敵IDの章をまたぐ再利用は章IDで分離する。Application unit testsで章別ID衝突、敵カウンター、ミス、撃破条件、味方攻撃除外、入力不変を確認し、component／Chromium／320px WebKit E2Eで表示、CSV、オートセーブ不変を確認する。読み取り専用で、GameState、RNG、IndexedDB、saveVersion 10を変更しない。


### キャンペーン記録ビューのアクセシブルな切替

キャンペーン戦闘記録の4ビューはARIA tablist／tab／tabpanelで構成し、選択中のタブのみをTab順に含める。左右矢印キーは全ビュー間を循環し、Home／Endはどのビューからでも先頭／末尾へ移動する。キー移動後はフォーカス、aria-selected、roving tabIndex、tabpanelのaria-labelledbyを一致させる。Tab／Shift+Tabは選択中タブとtabpanel間を移動し、Escapeで閉じると開く操作を行ったボタンへフォーカスを復帰する。再オープン時は起動ボタンのフォーカスを維持し、タブへ自動移動しない。Component testsでは4ビューそれぞれを起点にすべてのキー移動関数と対象外キーを検証する。Chromium E2Eでは4ビューの循環・端点・選択属性・パネル関連付け・Tab順・Escape後のフォーカス復帰・キーボード再オープン時のフォーカス維持を検証し、WebKit touch E2Eでは従来のタッチ切替と320px幅のレイアウトを維持する。ビュー切替はUI状態のみを更新し、campaignBattleLog、GameState、RNG、IndexedDB、saveVersionを変更しない。
