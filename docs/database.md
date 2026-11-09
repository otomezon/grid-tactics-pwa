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
| Game save schema | `saveVersion: 2` |

## 2. SaveVersion 2

`GameStateSnapshot` は `saveVersion`、`chapterId`、`phase`、`turn`、`rngState`、`units` を保持する。フェイズは既存の `player`／`enemy` のenumを利用する。EXP・level・stats・growthRatesはGameUnitに既存のフィールドであり、今回の成長処理でもsave schemaは変更しない。EXPは0〜99の未使用分だけ保存し、成長判定後のXorshift32 stateは既存rngStateに反映する。

## 2.1 所持品内のクラスチェンジアイテム

`GameUnit.inventory` は既存の最大5枠のID配列を維持し、クラスチェンジアイテムもアイテムIDとして保持できる。昇格コマンドは指定アイテムIDを1つだけ消費し、他の所持品と装備武器IDを保持する。試作では `promotion_seal` をchapter-01の新規初期状態にある味方01へ1個配布し、UIで表示・使用する。GameStateの形／saveVersionは変更しない。旧saveVersion 2の既存セーブへは証を追加せず、マイグレーションも行わない。正式な章報酬による配布は未実装。

## 3. SaveVersion 1 → 2 migration

`src/persistence/migrations.ts` が旧version 1の所持品・装備・乱数stateを変換し、version 2として検証する。不正／未対応データは自動初期化・上書きしない。

## 4. 保存・復元タイミング

- ユニット移動確定後
- 装備武器変更後
- 攻撃確定後（HP、行動状態、撃破状態、RNG state）
- 待機確定後
- 自軍フェイズ終了時：`phase: enemy` の状態を先に保存
- 敵軍フェイズ終了時：次の自軍フェイズ／turn／行動フラグを保存
- 起動時に `phase: enemy` のセーブがあれば、敵軍処理を再開して結果を保存

敵軍フェイズのAI解決は同期的に状態を作成してから保存する。ブラウザ統合テストでは、フェイズ開始状態から再開して二重行動が発生しないことを確認する必要がある。

## 5. 検証

saveVersion、chapterId、phase、turn、非ゼロ32bit RNG state、座標、重複ID／占有、能力値、所持品、装備武器を検証する。勝敗は既存stateから派生判定するため、save schemaへのbattleStatus追加は行っていない。

## 6. 章間遷移と保存

章間遷移は既存の `GameStateSnapshot` を次章用に再構成するだけで、新しいフィールドを追加しない。次章stateを生成した後、既存の自動保存slotへ通常の `saveGameState` で保存できる。遷移コマンド自体はIndexedDBへ直接依存せず、Appから呼び出して保存する構成とする。saveVersion 2およびversion 1→2 migrationは変更しない。

## 7. 未実装

複数slot、backup世代、export/import、IndexedDBブラウザ統合テスト、quota超過・private browsing時の復旧案内、敵軍フェイズ中の各行動ごとの個別autosave。
