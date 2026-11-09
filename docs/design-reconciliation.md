# 設計書と実装の照合

## 1. 対象と判定基準

- 基準資料: `docs/game-design.md`（v1.0、2026-11-09、初期実装向け設計案）
- PR #1（文書基盤）、PR #2（PWA／マップ初期基盤）、PR #3（戦闘計算kernel）はmainへマージ済み。現在のブランチで戦闘UI・攻撃コマンド・RNG保存・旧save migrationを追加。
- A: 設計記載と実装が一致
- B: 設計済み・未実装
- C: 実装済み・未文書化
- D: 不一致・要確認、または設計案に対する暫定判断

## 2. A：設計案と実装が一致する項目

| 対象 | 設計書 | 現在の実装 | 根拠 |
|---|---|---|---|
| PWA／React／TypeScript | 初期技術案 | 構成済み | package.json、vite.config.ts |
| マップ規模・移動 | 10×10、4方向 | 10×10試作マップと4近傍探索 | chapter-01.ts、movement |
| 地形移動・防御・回避 | terrain定義へ集約 | content/terrain.tsで管理 | terrain.ts |
| 三すくみ | 剣／槍／斧の命中±20、弓／魔法対象外 | domain combatに反映 | combat.ts |
| 戦闘計算 | 初期案の攻撃力・ダメージ・命中・必殺式 | domain関数に実装 | combat.ts |
| 必殺・追撃 | 必殺×3、速さ差4 | 定数とforecast／resolverに反映 | combat.ts |
| 攻撃順 | 先制→可能なら反撃→追撃 | forecast／resolverに反映 | combat.ts |
| 戦闘予測・攻撃操作 | 予測UIと実戦闘 | マップで対象選択、予測確認、攻撃確定 | App.tsx、perform-attack.ts |
| 状態・RNG保存 | 行動後自動保存、乱数状態保存 | saveVersion 2でHP／行動状態／RNG stateを保存 | game.ts、save-repository.ts |
| save互換性 | saveVersionとmigration | version1→2を追加 | migrations.ts |

## 3. B：設計済み・未実装

敵AI・敵フェイズ・ターン進行、勝利／敗北判定、リザルト、経験値・成長・クラスチェンジ、アイテム・イベント、章選択・複数ステージ、複数slot・backup・export/import、戦闘演出・専用ログ画面は未実装。

## 4. C：実装済み・未文書化

現時点で該当なし。今回追加した機能は `combat.md`、`database.md`、`architecture.md`、`current-state.md` に記録する。

## 5. D：暫定実装・要確認

| 項目 | 現状 | 判断・影響 |
|---|---|---|
| 仮武器数値 | 鉄の剣は設計書 §12.2の例。他4種は操作確認用の暫定値 | 正式な武器データ・能力値を決める |
| 攻撃距離 | Manhattan距離を暫定採用 | 正式なdistance metricを決める。斜め攻撃の距離解釈に影響 |
| 反撃武器 | 防御側のequippedWeaponIdを使用 | 複数武器時の最適選択やユーザー選択を決める |
| 追撃全条件 | 設計書初期案の速さ差4と攻撃順を実装 | 反撃不可能な場合など全端条件を正式確認 |
| RNG方式 | Xorshift32を実装しsaveVersion 2で状態保存 | 実装方式は再現性のため固定。将来変更時はmigrationが必要 |
| 試作コンテンツ | マップ・ユニット・仮武器を表示・操作に利用 | 正式な物語／コンテンツ／バランスではない |
| IndexedDB | database version 1、save schema version 2 | 複数slot・backup・import/export等は未決定 |

Dは実装バグの断定ではなく、設計書で最終決定されていない仕様を暫定実装している項目を示す。

## 6. 検証上の制約

- ローカルnpm install／typecheck／test／buildは未実施。PRのGitHub Actionsで検証する。
- 実ブラウザ／スマートフォンでの攻撃操作、セーブmigration、PWAオフライン挙動は未実施。
- 既存version1 saveを実ブラウザIndexedDBから移行する統合テストは未実施。

詳細は [`combat.md`](combat.md) と [`database.md`](database.md) を参照。
