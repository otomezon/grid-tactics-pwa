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
| Game save schema | `saveVersion: 3` |

## 2. SaveVersion 3

`GameStateSnapshot` は `saveVersion`、`chapterId`、`phase`、`turn`、`rngState`、戦闘中の `units`、控えの `reserveUnits` を保持する。`reserveUnits` は座標・陣営・行動フラグを持たない `CampaignUnit` 配列で、レベル・EXP・能力・成長率・HP・クラス・移動特性・武器適性・所持品・装備を保持する。戦闘中の `units` はマップに配置された味方／敵だけを保持するため、控えは敵AI・勝敗判定・マップ占有に影響しない。

`GameUnit.inventory` は既存の最大5枠のID配列を維持し、クラスチェンジアイテムもアイテムIDとして保持できる。昇格コマンドは指定アイテムIDを1つだけ消費し、他の所持品と装備武器IDを保持する。試作では `promotion_seal` をchapter-01の新規初期状態にある味方01へ1個配布する。正式な章報酬による配布は未実装。

## 3. Save migrations

`src/persistence/migrations.ts` は次の移行を行う。

- version 1: 旧所持品・装備・乱数stateを従来どおり変換し、空の `reserveUnits` を加えてversion 3にする。
- version 2: 既存の進行データを保持し、空の `reserveUnits` を加えてversion 3にする。
- version 3: 現行validatorで検証し、書き換えない。

不正／未対応データは自動初期化・上書きしない。移行後の保存に失敗した場合も、ロードしたデータを画面上で扱い続けることと保存成功を混同しない。

## 4. 保存・復元タイミング

- ユニット移動確定後
- 装備武器変更後
- 攻撃確定後（HP、行動状態、撃破状態、RNG state）
- 待機確定後
- 自軍フェイズ終了時：`phase: enemy` の状態を先に保存
- 敵軍フェイズ終了時：次の自軍フェイズ／turn／行動フラグを保存
- 起動時に `phase: enemy` のセーブがあれば、敵軍処理を再開して結果を保存
- 出撃準備確定時：選択された出撃ユニットと控え名簿を同じsnapshotで保存

敵軍フェイズのAI解決は同期的に状態を作成してから保存する。ブラウザ統合テストでは、フェイズ開始状態から再開して二重行動が発生しないことを確認する必要がある。

## 5. 検証

saveVersion、chapterId、phase、turn、非ゼロ32bit RNG state、戦闘ユニットの座標、重複ID／占有、能力値、所持品、装備武器を検証する。戦闘中の全ユニットID／陣営が対応マップの出撃名簿と一致することも確認する。控えは生存HPを持ち、現在のマップのplayerDeployment候補IDに含まれ、戦闘ユニットや他の控えとIDが重複しないことを検証する。マップで敗北対象として指定されたユニットは控えにできない。

## 6. 章間遷移

章間遷移は `GameStateSnapshot` を次章用に再構成する。前章の生存出撃ユニットと控えの双方を、次章の `playerDeployment` 候補IDに応じて引き継ぐ。前章の候補IDなのに出撃・控えのどちらにも存在しないユニットは撃破済みとして復帰させない。次章候補に新規登録されたユニットは次章テンプレートから追加する。次章stateは出撃準備の確定までauto slotへ保存せず、前章の勝利セーブを保持する。章間HPは仕様未決定のため、現行は暫定的に維持する。

## 7. 未実装

複数slot、backup世代、export/import、IndexedDBブラウザ統合テスト、quota超過・private browsing時の復旧案内、敵軍フェイズ中の各行動ごとの個別autosave。
