# 設計書と実装の照合

## 1. 対象と判定基準

- 基準資料: `docs/game-design.md`（v1.0、2026-11-09、初期実装向け設計案）
- PR #1（文書基盤）とPR #2（PWA／マップ初期基盤）はマージ済み。現在のブランチで戦闘domain kernelを追加。
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
| 保存version | saveVersionと将来マイグレーション | saveVersion 1とロード時検証 | `game.ts`, `validate-game-state.ts` |\n| 武器三すくみ | 剣・槍・斧に命中±20、弓・魔法は対象外 | `getWeaponTriangleHitModifier` に反映 | `src/domain/combat/combat.ts` |\n| 戦闘計算 | 初期案の攻撃力・ダメージ・命中・必殺式 | domainの純粋関数に実装 | `src/domain/combat/combat.ts` |\n| 必殺ダメージ | 通常ダメージ×3 | 定数と予測・解決処理に反映 | `src/domain/combat/combat.ts` |\n| 反撃・追撃 | 攻撃→可能なら反撃→速さ差4以上の追撃 | 予測・決定論的解決に反映 | `src/domain/combat/combat.ts` |

## 3. B：設計済み・未実装

正式な武器データ／数値、攻撃距離の座標計算、武器選択UI、戦闘予測UI、戦闘結果のゲーム状態反映、乱数シード／状態の生成・保存、フェイズ進行、敵AI、経験値・成長・クラスチェンジ、アイテム・イベント、勝敗判定、リザルト、章選択・複数ステージ、複数slot・セーブマイグレーションは未実装。

## 4. C：実装済み・未文書化

現時点で該当なし。今回追加した機能は本書、`combat.md`、`current-state.md` に記録する。

## 5. D：不一致・要確認

| 項目 | 現状 | 判断・影響 |
|---|---|---|
| 縦画面／横画面 | UIはレスポンシブな縦並び／横並びの切替。正式優先方向は未決定 | 実機確認後に正式化 |
| アート方式 | 地形・ユニットは仮のCSS図形とラベル | ピクセルアート採用等は未決定 |
| 試作コンテンツ | マップ・ユニット名・能力値は操作検証用 | 正式キャラクター・章設定ではない |
| 追撃順 | 初回攻撃→可能なら反撃→速さ差4以上の追撃を実装。反撃不能な防御側が速さ優位の場合は追撃しない暫定解釈 | 最終的な追撃条件・同時条件は製品仕様として確認 |\n| 攻撃距離 | `buildCombatForecast` は呼び出し元から整数distanceを受け取る | マンハッタン／チェビシェフ等の座標距離を決める |\n| 武器数値・選択 | weapon modelのみ。具体的な数値・装備選択フィールドなし | 初期武器の能力値と装備・反撃武器選択を決める |\n| RNG | resolverは呼び出し側からロール列を受け取る。GameStateにはRNG状態なし | RNG方式、シード／消費位置、saveVersion migrationを設計 |
| 武器ランク・回復手段 | 設計書 §17で確認事項 | 初期版の要否を決定 |
| IndexedDBスキーマ | 初期Object Storeを実装 | 複数slot・migration・backup等は未決定 |

Dはコードとの差異を検出したという意味ではない。設計案の判断待ちを記録する。

## 6. 検証上の制約

- 実行環境からGitHub clone／npm registryへの接続ができず、ローカル依存インストール・test・buildは未実施。
- GitHub Actionsで型チェック・テスト・buildを実行するworkflowを追加。結果はPRのChecksで確認する。
- 実ブラウザ・スマートフォンでのタップ／オフライン／IndexedDB復元テストは未実施。
\n## 7. 戦闘domain kernelの参照\n\n戦闘計算・予測・決定論的な解決の詳細、適用済み初期案、未決定の座標距離／武器数値／RNG方式は [`combat.md`](combat.md) を参照。\n