# データ保存設計

## 1. 現在の実装

初期版のブラウザ内保存としてIndexedDBを追加した。サーバーDBはない。

| 項目 | 実装値 |
|---|---|
| Database | `grid-tactics-pwa` |
| IndexedDB version | `1` |
| Object Store | `game-saves` |
| Key path | `slotId` |
| 自動保存slot | `auto` |
| 保存データversion | `saveVersion: 1` |
| 実装 | `src/persistence/save-repository.ts` |

## 2. レコード形式

Object Storeには次の形式で保存する。

```ts
interface SaveRecord {
  slotId: string;
  savedAt: number;
  data: GameStateSnapshot;
}
```

`GameStateSnapshot` は `saveVersion`、`chapterId`、`phase`、`turn`、`units` を保持する。ユニットにはID、陣営、クラス、レベル、経験値、能力値、成長率、HP、移動種別・移動力、武器種、所持品、座標、移動済み／行動済み状態を保存する。

マップ地形は静的contentとして読み込むため、現行saveにはterrain配列を重複保存しない。

## 3. 保存・復元タイミング

- ユニット移動確定後
- ユニット待機確定後
- アプリ起動時にauto slotがあれば復元

IndexedDB未対応または読み書き失敗時はUIに状態を表示する。保存に失敗しても操作後の画面状態は維持するが、リロード後の復元は保証しない。

## 4. 読込データの検証

`src/domain/models/validate-game-state.ts` でsaveVersion、chapterId、座標範囲、重複ID／重複占有、能力値、成長率、所持品上限等を検証する。不正または非対応の保存データは自動的に初期化・上書きしない。現在は安全側に倒して操作を停止する。

## 5. 未実装・今後の設計事項

- saveVersion 1からのマイグレーション。
- 複数slot、バックアップ世代、export/import。
- IndexedDBのブラウザ統合テスト。
- quota超過・private browsing・ストレージ消去時の復旧案内。
- セーブデータschemaの専用バリデーションライブラリ採否。

能力や戦闘状態を変更するときは、データ形式変更の影響を確認し、マイグレーションとテストを同時に追加すること。
