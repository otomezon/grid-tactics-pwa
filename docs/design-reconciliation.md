# 設計書と実装の照合

## 1. 対象と判定基準

- 基準資料: `docs/game-design.md`（v1.0、2026-11-09、初期実装向け設計案）
- PR #1はマージ済み。今回のブランチはPhase 0とPhase 1のマップ・移動初期実装。
- A: 設計記載と実装が一致
- B: 設計済み・未実装
- C: 実装済み・未文書化
- D: 不一致・要確認、または設計案に判断待ち

## 2. A：一致（設計要件の初期部分）

| 対象 | 設計書 | 現在の実装 | 根拠 |
|---|---|---|---|
| 技術基盤 | TypeScript + Vite + React推奨 | 指定バージョンで導入 | `package.json`, `vite.config.ts` |
| PWA基盤 | Manifest、Service Worker、静的アセットキャッシュ | vite-plugin-pwaで生成・登録設定 | `vite.config.ts`, `src/main.tsx` |
| マップ規模 | 標準10×10 | 10×10試作マップ表示 | `src/content/maps/chapter-01.ts` |
| 4方向移動 | 上下左右、斜めなし | 4近傍の探索 | `calculate-reachable-tiles.ts` |
| 地形コスト | 平地／道1、森は歩兵2・騎馬3、山は歩兵2・騎馬不可、砦1、壁・水域進入不可 | 地形定義と到達範囲計算に反映 | `src/content/terrain.ts` |
| 占有マス | 他ユニットのいるマスには進入不可 | occupied tileを探索対象から除外 | `calculate-reachable-tiles.ts` |
| 行動回数 | 1ユニット1フェイズ原則1回 | 試作UIに移動済み／行動済み状態を保持 | `src/App.tsx`, `game.ts` |
| IndexedDB保存 | 行動確定後等に自動保存 | 移動／待機確定後にauto slot保存 | `src/persistence/save-repository.ts` |
| 保存version | saveVersionと将来マイグレーション | saveVersion 1とロード時検証 | `game.ts`, `validate-game-state.ts` |

## 3. B：設計済み・未実装

戦闘・武器・射程・三すくみ・命中／回避／必殺・反撃・追撃、フェイズ進行、敵AI、経験値・成長・クラスチェンジ、アイテム・イベント、勝敗判定、リザルト、章選択・複数ステージ、複数slot・セーブマイグレーションは未実装。

## 4. C：実装済み・未文書化

現時点で該当なし。今回追加した機能は本書と `current-state.md` に記録する。

## 5. D：不一致・要確認

| 項目 | 現状 | 判断・影響 |
|---|---|---|
| 縦画面／横画面 | UIはレスポンシブな縦並び／横並びの切替。正式優先方向は未決定 | 実機確認後に正式化 |
| アート方式 | 地形・ユニットは仮のCSS図形とラベル | ピクセルアート採用等は未決定 |
| 試作コンテンツ | マップ・ユニット名・能力値は操作検証用 | 正式キャラクター・章設定ではない |
| 追撃順 | 設計書の記述だけでは全条件での順序が曖昧 | 戦闘実装前に詳細ルールを決定 |
| 武器ランク・回復手段 | 設計書 §17で確認事項 | 初期版の要否を決定 |
| IndexedDBスキーマ | 初期Object Storeを実装 | 複数slot・migration・backup等は未決定 |

Dはコードとの差異を検出したという意味ではない。設計案の判断待ちを記録する。

## 6. 検証上の制約

- 実行環境からGitHub clone／npm registryへの接続ができず、ローカル依存インストール・test・buildは未実施。
- GitHub Actionsで型チェック・テスト・buildを実行するworkflowを追加。結果はPRのChecksで確認する。
- 実ブラウザ・スマートフォンでのタップ／オフライン／IndexedDB復元テストは未実施。
