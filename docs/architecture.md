# アーキテクチャ

## 1. 現在の構成

PR #1〜#5で文書基盤、PWA／マップ／移動、戦闘計算、戦闘UI・攻撃・RNG保存、敵AI／フェイズ進行をmainに追加した。現在の開発ブランチで経験値・レベルアップ・リザルトを実装している。

```text
src/
├── App.tsx
├── application/
│   ├── perform-attack.ts
│   └── resolve-enemy-phase.ts
├── content/
│   ├── terrain.ts
│   ├── weapons.ts
│   └── maps/chapter-01.ts
├── domain/
│   ├── models/
│   ├── movement/
│   ├── combat/
│   ├── random/
│   └── rules/
│       └── evaluate-battle-outcome.ts
└── persistence/
    ├── save-repository.ts
    └── migrations.ts
```

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形、試作マップ／ユニット、仮武器 | 実装あり。仮コンテンツ |
| domain/models | GameUnit、GameStateSnapshot、saveVersion 2検証 | 実装あり |
| domain/movement | 地形・占有を考慮した到達可能範囲 | 実装あり |
| domain/combat | 武器適合、式、射程、予測、決定論的解決、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32 seed/state・combat rolls | 実装あり |
| domain/rules | defeat_all／defeat_boss／味方全滅の勝敗判定 | 実装あり |
| domain/progression | EXP閾値、個別成長判定、複数レベルアップ | 実装あり。クラス上限は仮データ |
| application | プレイヤー／敵の攻撃、敵AI行動選択、敵フェイズ解決、ターン進行 | 基本実装 |
| ui | マップ、戦闘UI、装備、フェイズ終了、勝敗表示 | 試作実装 |
| persistence | IndexedDB、saveVersion 1→2 migration | 実装あり |
| pwa | manifest、Service Worker、静的アセットキャッシュ | Vite plugin設定あり |

## 3. 現在のデータフロー

1. AppがIndexedDB auto slotをロードし、saveVersion 1→2 migrationまたはversion 2 validatorを通す。
2. player phaseでは既存の移動・装備・攻撃・待機コマンドを使う。
3. 「自軍フェイズ終了」で `phase: enemy` のスナップショットをまず保存する。
4. `runEnemyPhase` が敵ユニットをID辞書順に処理する。現在攻撃できるなら対象評価して攻撃、いなければ移動可能範囲を調べ、移動後攻撃、接近、待機を選ぶ。
5. 各戦闘は共通combat resolverと保存済みXorshift32 stateを利用する。HP・撃破・RNG stateはGameStateへ反映する。
6. 戦闘継続中なら敵軍フェイズ後にturnを1増やし、残存ユニットの行動フラグをresetしてplayer phaseへ戻す。勝敗ならterminal stateのままにする。
7. 次状態をIndexedDBへ保存。起動時に `phase: enemy` の保存が読み込まれた場合は敵軍フェイズを再開・解決する。

## 4. 依存方向のルール

- domainはReact／DOM／IndexedDBに依存しない。
- contentは定義データのみを保持する。
- applicationはdomainとcontentを使って合法性を検証し、次状態を返す。
- UIはapplication/domainの結果を表示し、ルールや計算式を再実装しない。
- persistenceは保存・ロード・migrationを担当する。

## 5. 今後の分割候補

- `application/gameController.ts`: 移動、装備、攻撃、待機、フェイズ進行を統合する。
- 敵AIは現在単純なスコア式。役割タグ、戦略の追加、プレイテストを別途行う。
- `domain/progression/`: クラスチェンジ、成長ルールの拡張。経験値・レベルアップは実装済み。
- `domain/events/`: ターン／撃破／勝利イベント。
- UIコンポーネント分割。現状は `App.tsx` に集約。
- 勝敗後のリザルト／報酬／章進行は未実装。

## 6. 外部サービス

サーバー、アカウント、オンライン同期、HTTP APIはない。PWAとブラウザ内IndexedDBを基本とする。新規ゲームの乱数seed生成にはWeb Cryptoを使うが、外部サービス接続は行わない。
