# アーキテクチャ

## 1. 現在の構成

PR #1〜#54で文書基盤、PWA／マップ／移動、戦闘・敵AI・経験値、クラスチェンジUI、砦回復、章間引き継ぎ、章報酬／次章開始UI、マップ別敗北条件、マップ／セーブ名簿検証、出撃配置準備、キャンペーン控え名簿と出撃メンバー選択、候補詳細、ブラウザE2E、PWA更新検証、JSONセーブexport/import、3世代ローカルバックアップ／復元、詳細なステージ結果表示、敵軍フェイズの一時行動記録、味方攻撃のstrike別一時結果表示、狭幅画面マップの横スクロールとタッチ操作確認、ブラウザ対応のPWAインストール案内をmainに追加した。PR #54のマージコミットは `146c5952713f1cae3916fcde3e0f8a2407f995e1`。CI run #643で型チェック・単体テスト・本番ビルド・Chromium E2Eの成功を確認した。今回のまとまったマップ情報機能では、既存データから目標進行と地形詳細を投影する。PR #42のマージコミットは `8b5b3b583ad4cd6f7fae3f2cccd8b8ebbefe0e4f`、PR #43のマージコミットは `8f0a3d023afab1a379dce99147f59bc9770084bb`、PR #44のマージコミットは `ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba`。PR #44のCI run #596は25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功した。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。

```text
src/
├── App.tsx
├── application/
│   ├── perform-attack.ts
│   ├── get-player-attack-report.ts
│   ├── get-battle-map-details.ts
│   ├── perform-class-change.ts
│   ├── apply-chapter-rewards.ts
│   ├── prepare-next-chapter.ts
│   ├── prepare-player-deployment.ts
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
    ├── save-file.ts
    └── migrations.ts
```

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形、章レジストリ／章別マップ／初期状態、仮武器、昇格先・仮能力ボーナス、クラスチェンジアイテム | 実装あり。第2章・昇格ボーナス／上限は試作データ |
| domain/models | GameUnit、CampaignUnit、GameStateSnapshot、saveVersion 3検証、戦闘／控え名簿の整合性 | 実装あり |
| domain/movement | 地形・占有を考慮した到達可能範囲 | 実装あり |
| domain/combat | 武器適合、式、射程、予測、決定論的解決、暫定Manhattan距離 | 実装あり |
| domain/random | Xorshift32 seed/state・combat rolls | 実装あり |
| domain/rules | defeat_all／defeat_boss／味方全滅／マップ指定ユニット撃破の勝敗判定、砦回復 | 実装あり。主人公ID未決定のため試作マップの個別敗北対象は未設定。回復端数は暫定切り捨て |
| domain/progression | EXP閾値、個別成長判定、クラス昇格条件・能力ボーナス適用 | 実装あり。クラス上限・昇格値は呼び出し側の仮設定データ |
| application | プレイヤー／敵の攻撃、クラスチェンジ、章報酬付与、勝利後の次章state構築、出撃配置検証、敵AI／フェイズ進行、目標進行・地形情報の読み取り専用projection | 出撃準備は開発ブランチで実装中。報酬は章データで明示したアイテムのみ適用 |
| ui | 章別マップ（狭幅画面では各40pxタイルの横スクロール領域）、目標進行・マス情報パネル、戦闘予測／味方攻撃結果／敵軍フェイズ行動記録、装備／所持品／クラスチェンジ、結果／報酬、次章開始、出撃準備／候補詳細 | 試作実装。出撃候補の詳細パネルはPR #17でmainに実装済み。狭幅マップ操作はPR #44でmainに実装済み。PR #46／#47で320px幅の横スワイプとスワイプ後の右端ユニット選択をChromium E2Eで検証済み（実機未確認）。第2章は遷移検証用 |
| persistence | IndexedDB auto slot／backup-1〜backup-3、saveVersion 1／2→3 migration、JSON export/import | 3世代backup／復元、export/importともmain実装済み。PR #23で最大3世代の保持、最古世代ローテーション、auto不変、確認付き復元をCI検証。DB version／saveVersionは据え置き |
| pwa | manifest、Service Worker、静的アセットキャッシュ、ブラウザ標準のインストールプロンプトとstandalone状態表示 | Vite pluginとAppのイベント連携あり |

## 3. 現在のデータフロー

1. AppがIndexedDB auto slotをロードし、saveVersion 1／2→3 migrationまたはversion 3 validatorを通す。validatorはマップ構造と目標参照を確認し、保存内の各ユニットID／陣営がマップの出撃名簿と一致することを検証する。撃破済みユニットはstateから除去できるため、配置名簿の全員がstateに存在することまでは要求しない。
2. player phaseでは既存の移動・装備・攻撃・待機コマンドを使う。
3. 「自軍フェイズ終了」で敵軍フェイズへ移り、砦上の生存中の敵軍ユニットを最大HPの10%（端数切り捨て・暫定）回復してから `phase: enemy` のスナップショットを保存する。
4. `runEnemyPhase` が敵ユニットをID辞書順に処理する。現在攻撃できるなら対象評価して攻撃、いなければ移動可能範囲を調べ、移動後攻撃、接近、待機を選ぶ。
5. 各戦闘は共通combat resolverと保存済みXorshift32 stateを利用する。HP・撃破・RNG stateはGameStateへ反映する。
6. 戦闘継続中なら敵軍フェイズ後にturnを1増やし、残存ユニットの行動フラグをresetしてplayer phaseへ戻し、砦上の生存中の味方を最大HPの10%（端数切り捨て・暫定）回復する。勝敗ならterminal stateのままにする。
7. 次状態をIndexedDBへ保存。起動時に `phase: enemy` の保存が読み込まれた場合は敵軍フェイズを再開・解決する。
8. ユーザーが手動バックアップを作成すると、persistenceがauto slotを検証済みsnapshotと照合し、同じreadwrite transaction内で `backup-1`〜`backup-3` をローテーションする。復元時は章解決・migration・validator・確認後にauto slotを置き換える。

## 4. 章間遷移

`content/chapters.ts` が章ID・マップ・初期状態・クリア報酬を登録する。起動時は保存されたchapterIdに対応するマップでセーブを検証・復元する。勝利後は `apply-chapter-rewards.ts` が設定済み報酬を生存味方へ付与し、`prepare-next-chapter.ts` が次章stateを構築する。Appは章別マップへ切り替え、通常のIndexedDB auto slotへ保存する。撃破済み味方を復帰させず、章間HPは現在の設計未決定のためUIでは暫定的に維持する。saveVersion 3で控え名簿を保持する。

出撃準備は `prepare-player-deployment.ts` がturn 1のplayer phaseかつ味方未行動であることを確認し、マップの `playerDeployment` 候補から出撃メンバーを選択して座標を一意に割り当てる。非選択の生存者は `reserveUnits` へ移し、HP・経験値・能力・所持品・装備を保持する。控えは戦闘stateの `units` に含めない。Appは新規ゲーム／次章開始直後に出撃準備画面を表示し、確定時にv3 snapshotを保存してから戦闘操作を有効化する。次章stateは配置確定までauto slotへ保存せず、前章の勝利セーブを保持する。正式な章ごとの人数条件は未決定で、現在の上限はマップ候補数。

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
