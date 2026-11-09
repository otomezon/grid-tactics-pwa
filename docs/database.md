# データ保存設計

## 1. IndexedDB

サーバーDBはなく、ブラウザ内のIndexedDBを使用する。

| 項目 | 実装値 |
|---|---|
| Database | `grid-tactics-pwa` |
| IndexedDB database version | `1` |
| Object Store | `game-saves` |
| Key path | `slotId` |
| 自動保存slot | `auto` |
| Game save schema | `saveVersion: 2` |
| 実装 | `src/persistence/save-repository.ts` |

IndexedDBのObject Store／key pathは変更していないため、IndexedDB database versionは1のまま。内部のゲームセーブschema versionは2へ更新した。

## 2. SaveVersion 2

Object Storeのレコードは従来どおり次の形式。

```ts
interface SaveRecord {
  slotId: string;
  savedAt: number;
  data: GameStateSnapshot;
}
```

`GameStateSnapshot` は `saveVersion`、`chapterId`、`phase`、`turn`、`rngState`、`units` を保持する。

- `rngState`: Xorshift32の非ゼロunsigned 32bit状態。
- `GameUnit.equippedWeaponId`: 選択中の装備武器ID。未装備はnull。
- 既存のユニット能力、HP、成長率、移動種別／移動力、武器種、所持品、座標、行動状態は継続して保存する。

マップ地形・武器の定義は静的contentとして読み込むため、saveに重複保存しない。

## 3. SaveVersion 1 → 2 migration

`src/persistence/migrations.ts` が旧version 1を読み込む。

- `prototype_weapon` は、各ユニットの `usableWeaponTypes` の先頭に対応する仮武器IDへ変換する。
- `equippedWeaponId` は旧所持品を変換後、カタログ上の最初の認識可能な武器を設定する。該当がなければnull。
- `rngState` は旧saveの章ID・ターン・ユニットID／HP／座標／経験値情報から安定的に導出する。
- HP、座標、経験値、ターン、フェイズなど既存の進行状態は保持する。
- migration後にversion 2 validatorで全体を検証し、成功した場合だけ新形式で保存する。不正／未対応データは自動初期化・上書きしない。

## 4. 保存・復元タイミング

- ユニット移動確定後
- 装備武器変更後
- 攻撃確定後（HP、行動状態、撃破状態、RNG stateを同時保存）
- ユニット待機確定後
- アプリ起動時にauto slotがあれば復元／必要に応じmigration

IndexedDB未対応または読み書き失敗時はUIに状態を表示する。保存失敗時に操作後の画面状態は維持するが、リロード後の復元は保証しない。

## 5. 読込データの検証

`src/domain/models/validate-game-state.ts` でsaveVersion、chapterId、phase、turn、非ゼロ32bit RNG state、座標範囲、重複ID／重複占有、能力値、成長率、所持品上限、装備武器IDとinventoryの整合を検証する。

## 6. 未実装・今後の設計事項

- 複数slot、バックアップ世代、export/import。
- IndexedDBのブラウザ統合テスト。
- quota超過・private browsing・ストレージ消去時の復旧案内。
- セーブデータschemaの追加変更時のmigration。
- RNGアルゴリズムを変更する場合の互換性方針。

セーブ形式を変更するときは `SAVE_VERSION` を更新し、旧saveからの明示的なmigrationとテストを同時に追加すること。
