# アーキテクチャ

## 1. 現在の構成

PR #1〜#10で文書基盤、PWA／マップ／移動、戦闘・敵AI・経験値、クラスチェンジUI、砦回復、章間引き継ぎ、章報酬／次章開始UIをmainに追加した。

```text
src/
├── App.tsx
├── application/
│   ├── perform-attack.ts
│   ├── perform-class-change.ts
│   ├── apply-chapter-rewards.ts
│   ├── prepare-next-chapter.ts
│   └── resolve-enemy-phase.ts
├── content/
│   ├── terrain.ts
│   ├── weapons.ts
│   ├── classes.ts
│   ├── items.ts
│   ├── chapters.ts
│   └── maps/
│       ├── chapter-01.ts
│       └── chapter-02.ts
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
| content | 地形、章レジストリ／章別マップ／初期状態、仮武器、昇格先・仮能力ボーナス、クラスチェンジアイテム | 実装あり。第2章・昇格ボーナス／上限は試作データ |
| domain/models | GameUnit、GameStateSnapshot、saveVersion 2検証 | 実装あり |
| domain/movement | 地形・占有を考慮した到達可能範囲 | 実装あり |
| domain/combat | 武器適合、式、射程、予測、決定論的解決、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32 seed/state・combat rolls | 実装あり |
| domain/rules | defeat_all／defeat_boss／味方全滅／マップ指定ユニット撃破の勝敗判定、砦回復 | 実装あり。主人公ID未決定のため試作マップの個別敗北対象は未設定。回復端数は暫定切り捨て |
| domain/progression | EXP閾値、個別成長判定、クラス昇格条件・能力ボーナス適用 | 実装あり。クラス上限・昇格値は呼び出し側の仮設定データ |
| application | プレイヤー／敵の攻撃、クラスチェンジ、章報酬付与、勝利後の次章state構築、敵AI／フェイズ進行 | 実装あり。報酬は章データで明示したアイテムのみ適用 |
| ui | 章別マップ、戦闘UI、装備／所持品／クラスチェンジ、結果／報酬表示、次章開始 | 試作実装。第2章は遷移検証用で正式な章データではない |
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

`content/chapters.ts` が章ID・マップ・初期状態・クリア報酬を登録する。起動時は保存されたchapterIdに対応するマップでセーブを検証・復元する。勝利後は `apply-chapter-rewards.ts` が設定済み報酬を生存味方へ付与し、`prepare-next-chapter.ts` が次章stateを構築する。Appは章別マップへ切り替え、通常のIndexedDB auto slotへ保存する。撃破済み味方を復帰させず、章間HPは現在の設計未決定のためUIでは暫定的に維持する。saveVersion 2の形は変更しない。

## 5. 依存方向のルール

- domainはReact／DOM／IndexedDBに依存しない。
- contentは定義データのみを保持する。
- applicationはdomainとcontentを使って合法性を検証し、次状態を返す。
- UIはapplication/domainの結果を表示し、ルールや計算式を再実装しない。
- persistenceは保存・ロード・migrationを担当する。

## 6. 今後の分割候補

- `application/gameController.ts`: 移動、装備、攻撃、待機、フェイズ進行を統合する。
- 敵AIは現在単純なスコア式。役割タグ、戦略の追加、プレイテストを別途行う。
- `domain/progression/`: EXP・成長、クラス昇格、章報酬定義型を実装。正式な昇格値とクラス別移動／武器データは未決定。
- `domain/events/`: ターン／撃破／勝利イベント。
- UIコンポーネント分割。現状は `App.tsx` に集約。
- 基本リザルト、章定義されたアイテム報酬、次章開始UIは実装済み。詳細戦闘統計／会話イベント／キャンペーン選択・章解放管理は未実装。

## 7. 外部サービス

サーバー、アカウント、オンライン同期、HTTP APIはない。PWAとブラウザ内IndexedDBを基本とする。新規ゲームの乱数seed生成にはWeb Cryptoを使うが、外部サービス接続は行わない。
