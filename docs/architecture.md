# アーキテクチャ

## 1. 現在の構成

PR #1〜#8と#10で文書基盤、PWA／マップ／移動、戦闘・敵AI・経験値、クラスチェンジUI、章間引き継ぎ基盤をmainに追加した。PR #9では砦のフェイズ開始回復を実装し、mainへの追従と再検証を行っている。

```text
src/
├── App.tsx
├── application/
│   ├── perform-attack.ts
│   ├── perform-class-change.ts
│   └── resolve-enemy-phase.ts
├── content/
│   ├── terrain.ts
│   ├── weapons.ts
│   ├── classes.ts
│   ├── items.ts
│   └── maps/chapter-01.ts
├── domain/
│   ├── models/
│   ├── movement/
│   ├── combat/
│   ├── random/
│   ├── progression/
│   └── rules/
│       ├── evaluate-battle-outcome.ts
│       └── apply-fort-recovery.ts
└── persistence/
    ├── save-repository.ts
    └── migrations.ts
```

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形、試作マップ／ユニット、仮武器、昇格先・仮能力ボーナス、クラスチェンジアイテム | 実装あり。昇格ボーナス／上限は仮データ |
| domain/models | GameUnit、GameStateSnapshot、saveVersion 2検証 | 実装あり |
| domain/movement | 地形・占有を考慮した到達可能範囲 | 実装あり |
| domain/combat | 武器適合、式、射程、予測、決定論的解決、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32 seed/state・combat rolls | 実装あり |
| domain/rules | defeat_all／defeat_boss／味方全滅の勝敗判定、砦回復 | 実装あり。回復端数は暫定切り捨て |
| domain/progression | EXP閾値、個別成長判定、クラス昇格条件・能力ボーナス適用 | 実装あり。クラス上限・昇格値は呼び出し側の仮設定データ |
| application | プレイヤー／敵の攻撃、クラスチェンジコマンド、敵AI行動選択、敵フェイズ解決、ターン進行 | 基本実装。試作アイテム／UI／自動保存を接続。正式配布ルールは未実装 |
| ui | マップ、戦闘UI、装備、所持品・クラスチェンジ確認、フェイズ終了、勝敗表示 | 試作実装。正式なクラスデータと章報酬は未実装 |
| persistence | IndexedDB、saveVersion 1→2 migration | 実装あり |
| pwa | manifest、Service Worker、静的アセットキャッシュ | Vite plugin設定あり |

## 3. 現在のデータフロー

1. AppがIndexedDB auto slotをロードし、saveVersion 1→2 migrationまたはversion 2 validatorを通す。
2. player phaseでは既存の移動・装備・攻撃・待機コマンドを使う。
3. 「自軍フェイズ終了」で敵軍フェイズへ移り、砦上の生存中の敵軍ユニットを最大HPの10%（端数切り捨て・暫定）回復してから `phase: enemy` のスナップショットを保存する。
4. `runEnemyPhase` が敵ユニットをID辞書順に処理する。現在攻撃できるなら対象評価して攻撃、いなければ移動可能範囲を調べ、移動後攻撃、接近、待機を選ぶ。
5. 各戦闘は共通combat resolverと保存済みXorshift32 stateを利用する。HP・撃破・RNG stateはGameStateへ反映する。
6. 戦闘継続中なら敵軍フェイズ後にturnを1増やし、残存ユニットの行動フラグをresetしてplayer phaseへ戻し、砦上の生存中の味方を最大HPの10%（端数切り捨て・暫定）回復する。勝敗ならterminal stateのままにする。
7. 次状態をIndexedDBへ保存。起動時に `phase: enemy` の保存が読み込まれた場合は敵軍フェイズを再開・解決する。

## 4. 章間遷移

`application/prepare-next-chapter.ts` は前章の勝利を検証し、次章マップの出撃配置を基準に味方の永続データを引き継ぐ。撃破済み味方を復帰させず、次章テンプレートに定義された新規加入者と敵を追加する。章間HP方針は呼び出し側が明示し、次章の初期turn／phase／RNGは次章テンプレートを使う。saveVersion 2の形は変更しない。UI／保存接続は未実装。

## 5. 依存方向のルール

- domainはReact／DOM／IndexedDBに依存しない。
- contentは定義データのみを保持する。
- applicationはdomainとcontentを使って合法性を検証し、次状態を返す。
- UIはapplication/domainの結果を表示し、ルールや計算式を再実装しない。
- persistenceは保存・ロード・migrationを担当する。

## 6. 今後の分割候補

- `application/gameController.ts`: 移動、装備、攻撃、待機、フェイズ進行を統合する。
- 敵AIは現在単純なスコア式。役割タグ、戦略の追加、プレイテストを別途行う。
- `domain/progression/`: EXP・成長とクラス昇格ルールの基盤を実装。クラスチェンジUI／仮アイテム接続済み。正式な昇格値・クラス別移動／武器データ・章報酬は未実装。
- `domain/events/`: ターン／撃破／勝利イベント。
- UIコンポーネント分割。現状は `App.tsx` に集約。
- 基本的なステージ結果概要は実装済み。詳細統計／加入／章報酬／次章進行は未実装。

## 7. 外部サービス

サーバー、アカウント、オンライン同期、HTTP APIはない。PWAとブラウザ内IndexedDBを基本とする。新規ゲームの乱数seed生成にはWeb Cryptoを使うが、外部サービス接続は行わない。
