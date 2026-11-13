# データ保存設計

## 1. IndexedDB

ブラウザ内IndexedDBを使用。サーバーDBはない。

| 項目 | 実装値 |
|---|---|
| Database | `grid-tactics-pwa` |
| IndexedDB version | `1` |
| Object Store | `game-saves` |
| Key path | `slotId` |
| 自動保存slot | `auto` |
| 手動バックアップslot | `backup-1`（最新）〜`backup-3`（最古） |
| Game save schema | `saveVersion: 6` |

## 2. SaveVersion 6

`GameStateSnapshot` は `saveVersion`、`chapterId`、`phase`、`turn`、`rngState`、戦闘中の `units`、控えの `reserveUnits`、およびキャンペーン累計の `campaignUnitBattleRecords`、`firedMapEventIds`、`acknowledgedMapEventIds` を保持する。`firedMapEventIds` は現在の章で一度だけ発火したマップイベントIDの配列で、同じイベントの二重実行を防ぐ。`acknowledgedMapEventIds` はメッセージをプレイヤーが明示的に確認したIDの配列で、必ず発火済みIDの部分集合とする。`reserveUnits` は座標・陣営・行動フラグを持たない `CampaignUnit` 配列で、レベル・EXP・能力・成長率・HP・クラス・移動特性・武器適性・所持品・装備を保持する。戦闘中の `units` はマップに配置された味方／敵だけを保持するため、控えは敵AI・勝敗判定・マップ占有に影響しない。

### 2.1 キャンペーン累計戦績

`campaignUnitBattleRecords` は味方ユニットIDごとに1件だけ持つ累計記録。登録済みの章 `playerDeployment` に含まれる味方IDだけを許可し、同一IDの重複をvalidatorで拒否する。味方が開始した確定攻撃から、攻撃行動数、味方自身のstrike数、命中／ミス／必殺、実与ダメージ、撃破、実際に付与したEXP、レベルアップ回数と能力上昇を加算する。敵の反撃strikeは攻撃者IDで除外し、予測値やセーブ再読込時の推測値を記録しない。撃破後にactive／reserve名簿から除外された味方の既存記録も残る。キャンペーンを新規開始すると空配列になり、`prepareNextChapter` は前章の記録を次章へコピーする。

この記録はJSON export/import、IndexedDB auto slot、手動バックアップにもsnapshotの一部として含まれる。1回ごとのstrike履歴、時系列ログ、敵軍の与ダメージは含まず、セーブサイズはユニットIDごとの小さな集計値に限定する。

### 2.2 マップイベント進行

- イベント定義は各 `GameMapDefinition.events` に置き、発火条件はステージ開始、指定ターン／フェイズ開始、特定ユニット撃破、ボス撃破、勝利、敗北をサポートする。
- 初期アクションは `show-message` のみ。メッセージ本文はマップcontent側に保持し、snapshotには実行済みIDだけを保存する。加入、増援、村・宝箱・扉、選択肢付き会話はこの基盤の後続機能であり、現時点では実行しない。
- `firedMapEventIds` と `acknowledgedMapEventIds` はそれぞれ同じsnapshot内で重複しない。確認済みIDは必ず発火済みIDに含まれる。未確認メッセージはマップ定義を参照して表示し、発火順は実際の発火時系列（`firedMapEventIds` の配列順）で維持する。
- 未確認メッセージはモーダルで表示し、確認ボタンを押すまで操作をロックする。確認済みIDを同じ保存snapshotへ書き込み、リロード・JSON復元・バックアップ復元後も再表示しない。確認されていないまま再読み込みされたメッセージは再表示する。
- 敵軍フェイズ開始イベントが未確認なら、敵AIを実行せずフェイズ開始snapshotを保存して停止する。すべて確認された後に限り敵軍フェイズを解決する。
- 新規章は章テンプレートの空配列から始まる。旧セーブに存在しない過去イベントの発火履歴を推測したり、移行時にイベントを遡及発火させたりしない。
- ステージ開始／初回ターン開始は出撃配置の確定後に処理する。以降のターン／フェイズ開始、ユニット撃破、ボス撃破、勝敗の遷移は、確定済み状態変更後に解決する。イベント解決と対象のGameStateは同じsave操作で保存する。


`GameUnit.inventory` は既存の最大5枠のID配列を維持し、クラスチェンジアイテムもアイテムIDとして保持できる。昇格コマンドは指定アイテムIDを1つだけ消費し、他の所持品と装備武器IDを保持する。新規初期状態へ昇格アイテムを自動付与しない。CP-13に従い、具体的な章報酬／イベントの受取人・数量は正式決定後にcontentへ明示する。

## 3. Save migrations

`src/persistence/migrations.ts` は次の移行を行う。

- version 1: 旧所持品・装備・乱数stateを従来どおり変換し、空の `reserveUnits`、`campaignUnitBattleRecords`、`firedMapEventIds`、`acknowledgedMapEventIds` を加えてversion 6にする。
- version 2: 既存の進行データを保持し、空の `reserveUnits`、`campaignUnitBattleRecords`、`firedMapEventIds`、`acknowledgedMapEventIds` を加えてversion 6にする。
- version 3: 既存の進行データと控え名簿を保持し、空の `campaignUnitBattleRecords`、`firedMapEventIds`、`acknowledgedMapEventIds` を加えてversion 6にする。version 3以前のプレイ履歴・イベント履歴は存在しないため、過去の戦績やイベント発火を推測して作らない。
- version 4: 既存の進行データとキャンペーン累計戦績を保持し、空の `firedMapEventIds` と `acknowledgedMapEventIds` を加えてversion 6にする。
- version 5: 既存の発火済みイベントIDを保持し、これまでのイベント表示は一時メッセージのみで確認状態が保存されていないため、既発火IDをすべて `acknowledgedMapEventIds` に複製してversion 6にする。これにより既存イベントを意図せず再表示しない。
- version 6: 現行validatorで検証し、書き換えない。

不正／未対応データは自動初期化・上書きしない。移行後の保存に失敗した場合も、ロードしたデータを画面上で扱い続けることと保存成功を混同しない。

## 4. 保存・復元タイミング

- ユニット移動確定後
- 装備武器変更後
- 攻撃確定後（HP、行動状態、撃破状態、RNG state、味方開始攻撃のキャンペーン累計戦績）
- 待機確定後
- 自軍フェイズ終了時：`phase: enemy` の状態を先に保存
- 敵軍フェイズ終了時：次の自軍フェイズ／turn／行動フラグを保存
- 起動時に `phase: enemy` のセーブがあれば、敵軍処理を再開して結果を保存
- 出撃準備確定時：選択された出撃ユニットと控え名簿を同じsnapshotで保存

敵軍フェイズのAI解決は同期的に状態を作成してから保存する。PlaywrightのブラウザE2Eでは、行動確定後のIndexedDB保存と再読み込み後の復元、Service Worker更新時の自動再読み込み後の復元を確認する。

味方の攻撃結果表示と敵軍フェイズの行動記録は、各処理の実行結果から生成する画面内の一時表示であり、snapshotには保存しない。これとは別に、味方開始攻撃から算出する `campaignUnitBattleRecords` の集計値とイベント確認状態をsaveVersion 6へ保存する。戦闘履歴表示は引き続き一時状態で再読み込み後に消えるが、未確認イベント本文はマップcontentから復元して再表示する。`phase: enemy` のcheckpointから再開した場合のみ、敵軍フェイズを再解決し、その実行結果から敵行動記録を再生成する。

## 5. 検証

saveVersion、chapterId、phase、turn、非ゼロ32bit RNG state、戦闘ユニットの座標、重複ID／占有、能力値、所持品、装備武器を検証する。戦闘中の全ユニットID／陣営が対応マップの出撃名簿と一致することも確認する。控えは生存HPを持ち、現在のマップのplayerDeployment候補IDに含まれ、戦闘ユニットや他の控えとIDが重複しないことを検証する。マップで敗北対象として指定されたユニットは控えにできない。

## 6. 章間遷移

章間遷移は `GameStateSnapshot` を次章用に再構成する。前章の生存出撃ユニットと控えの双方を、次章の `playerDeployment` 候補IDに応じて引き継ぐ。前章の候補IDなのに出撃・控えのどちらにも存在しないユニットは撃破済みとして復帰させない。次章候補に新規登録されたユニットは次章テンプレートから追加する。次章stateは出撃準備の確定までauto slotへ保存せず、前章の勝利セーブを保持する。章間HPは仕様未決定のため、現行は暫定的に維持する。

## 7. 未実装

複数の任意slot、quota超過・private browsing時の復旧案内、敵軍フェイズ中の各行動ごとの個別autosave。


## 8. ブラウザ統合テスト

Playwrightは本番ビルドを配信するPreviewサーバーに対して実行する。行動確定後のauto slotをIndexedDBから読み、Service Worker更新によるアプリの自動再読み込み後に行動状態が復元されること、さらにオフライン再読み込み後にも同じ状態が保持されることを検証する。PR #23のChromium E2Eではバックアップ3世代の保持、4回目のローテーション、作成後のauto不変、復元成功、確認キャンセル、saveVersion 2 migration、未知version拒否を確認する。これはブラウザ上の自動テストであり、実機OSによるアプリ停止・再開やストレージ容量不足時の挙動までは保証しない。


## 9. セーブファイル

- 自動セーブslotのスナップショットを、形式識別子 `grid-tactics-pwa-save` とファイル形式version 1を持つJSONファイルとして書き出す。
- 読み込み時はJSON envelope、形式version、exportedAt、章ID、既存のsaveVersion 1／2／3／4／5から6へのmigrationと、現行saveVersion 6の章マップに対するsnapshot validatorを順に検証する。
- 未対応形式・不正JSON・不正snapshot・未知の章IDは拒否し、確認ダイアログおよび検証が完了するまで既存auto slotを変更しない。
- 読み込み確定後にだけauto slotを置き換える。IndexedDBのdatabase versionは1のまま維持し、GameStateSnapshotは現行saveVersion 6として保存する。
- JSONファイルは平文であり暗号化されない。共有・保管先に注意する。

## 10. ローカルバックアップ世代

- 手動バックアップは既存の `game-saves` object store と `slotId` key pathを再利用し、`backup-1`（最新）から `backup-3`（最古）までの3世代を保持する。各レコードは既存slotと同じ `slotId`、`savedAt`、`data` を持つ。
- ユーザーが明示的に作成した時点のauto snapshotを第1世代へコピーする。既存の第1・第2世代を第2・第3世代へ移し、既存の最古世代を破棄する。4回目以降も同じ規則を繰り返す。
- 世代の削除・移動・新規書き込みは単一のIndexedDB `readwrite` transactionで行う。transactionがabortした場合は全変更がロールバックされる。auto slotは書き換えない。読み込み・検証したsnapshotとtransaction内のauto dataが一致しない場合は作成を中止する。
- 一覧には世代番号、作成日時、章名、章IDを表示する。バックアップを復元する前に章IDを解決し、既存のsaveVersion migrationとsnapshot／map validatorを通す。不正形式や未知versionは拒否する。
- 復元は確認後にだけauto slotを置き換える。書き込みtransaction内でも選択されたバックアップレコードの内容を再確認し、変更・削除されていれば中止する。確認キャンセルでは保存データも画面状態も変更しない。`phase: enemy` のデータは既存の敵軍フェイズ復旧処理に従う。
- IndexedDB versionは1、GameStateSnapshot `saveVersion`は6。JSON export/import envelopeとも独立し、追加依存はない。バックアップは同じブラウザ内のローカル保存であり、暗号化・改ざん防止・クラウド同期を提供しない。