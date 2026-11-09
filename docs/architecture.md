# アーキテクチャ

## 1. 現在の構成

PR #1〜#3でドキュメント基盤、PWA／マップ／移動、戦闘計算エンジンをmainに追加した。現在のブランチでは戦闘エンジンをUI・保存へ接続している。

```text
src/
├── App.tsx
├── main.tsx
├── styles.css
├── application/
│   └── perform-attack.ts
├── content/
│   ├── terrain.ts
│   ├── weapons.ts
│   └── maps/chapter-01.ts
├── domain/
│   ├── models/
│   ├── movement/
│   ├── combat/
│   └── random/
└── persistence/
    ├── save-repository.ts
    └── migrations.ts
```

単体テストは対象モジュールと同じ階層に `*.test.ts` として置く。

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形、試作マップ／ユニット、仮武器定義 | 実装あり。武器数値は未承認の試作値 |
| domain/models | GameUnit、GameStateSnapshot、saveVersion 2の検証 | 実装あり |
| domain/movement | 地形コストと占有を考慮した到達可能範囲計算 | 実装あり |
| domain/combat | 武器適合、三すくみ、計算、射程、戦闘予測、決定論的解決、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32、seed/state、戦闘roll生成 | 実装あり |
| application | 攻撃コマンド検証、戦闘実行、HP／行動状態／撃破／RNG反映 | 攻撃のみ実装 |
| ui | マップ、ユニット情報、装備変更、攻撃可能表示、戦闘予測・実行 | 試作実装あり |
| persistence | IndexedDB read/write、saveVersion 1→2移行 | 実装あり |
| pwa | manifest、Service Worker、静的アセットキャッシュ | Vite plugin設定あり |

## 3. 現在のデータフロー

1. `App.tsx` がIndexedDBのauto slotを読み、`migrateGameStateSnapshot` でversion 1から2への移行またはversion 2検証を行う。
2. version 1では旧 `prototype_weapon` IDをユニットの使用可能武器種に応じて仮武器IDへ変換し、HP・位置・ターン等を保持する。乱数状態を旧セーブ情報から安定的に導出し、新形式を保存する。
3. 新規ゲームはWeb Cryptoから非ゼロ32bit seedを作成する（利用できない場合は固定fallback）。
4. ユニット選択時に `calculate-reachable-tiles.ts` が4方向の移動可能範囲を計算する。装備武器の射程に入る敵は赤色で示す。
5. 敵を選択すると `createAttackPlan` が、攻撃者／対象、装備武器、地形、距離、使用可能な反撃武器を検証し、`buildCombatForecast` を作る。
6. 攻撃確定時に `performAttack` がXorshift32から決定論的rollを生成し、`resolveCombat` を呼ぶ。HP、攻撃側の行動済み、撃破ユニット除去、消費したrollに応じたRNG stateを更新する。
7. 変更後のGameStateSnapshotをIndexedDBへ保存する。

## 4. 依存方向のルール

- domainはReact／DOM／IndexedDBに依存しない。
- contentはゲームデータと定義を保持し、計算処理を持たない。
- applicationはdomainとcontentを使って合法性を検証し、純粋な次状態を返す。
- UIはapplication/domainの結果を表示し、移動・戦闘計算式を再実装しない。
- persistenceは保存・ロード・version migrationを担当する。UIからIndexedDB APIを直接呼ばない。

## 5. これからの分割候補

- `application/gameController.ts`: 移動、装備、攻撃、待機、フェイズ進行を統合する。
- `application/perform-attack.ts`: 現在は攻撃コマンドのみ。
- `domain/ai/`: 敵行動選択。
- `domain/progression/`: 経験値・成長・クラスチェンジ。
- `content/weapons.ts`: 現在は仮武器の一時定義。正式なコンテンツ構成へ拡張。
- `persistence/migrations.ts`: 現在はsaveVersion 1→2。
- UIコンポーネント分割。現状は `App.tsx` に集約。

## 6. 外部サービス

現時点でサーバー、アカウント、オンライン同期、HTTP APIは追加していない。PWAのオフライン利用とローカルIndexedDB保存を基本とする。新規ゲームの乱数seed生成にWeb Cryptoを使用するが、外部サービス接続は行わない。
