# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-09
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1（AI開発ドキュメント基盤）: マージ済み。マージコミット: `83d24fc9b3a2952127f36605efb5cc8ef8b7a20d`\n- PR #2（PWA／マップ初期プロトタイプ）: マージ済み。マージコミット: `bd7f7acf6d787ec51ef985f6f617dbbd16ab6b74`。
- 現在の対象: 戦闘計算・予測・決定論的な解決エンジンのdomain実装。戦闘UI・実武器content・RNGセーブ統合は未実装。
- Node.js: `.nvmrc` は26。package.jsonはNode 22.12+／24+／26+を許容。
- package manager: npm\n- Vitest: `5.0.0`（安定版）。`5.1.0` は確認時点でbetaのため置換。
- このブランチでアプリ本体のソース、設定、テストを追加。CIの結果はPR作成後に確認する。

## 2. 機能別ステータス

「実装済み」はこのブランチでコードを追加したことを示す。CI成功・実機確認済みという意味ではない。

| 機能 | 状況 | 関連ファイル | テスト状況 |
|---|---|---|---|
| React + TypeScript + Vite基盤 | 実装済み | `package.json`, `vite.config.ts`, `tsconfig.json`, `src/main.tsx` | CIで型チェック・buildを実行 |
| PWA manifest／Service Worker | 実装済み | `vite.config.ts`, `src/main.tsx`, `public/icons/` | CI build。実機オフライン確認は未実施 |
| 10×10マップ表示 | 実装済み（試作データ） | `src/App.tsx`, `src/content/maps/chapter-01.ts`, `src/styles.css` | ブラウザ確認は未実施 |
| 地形定義 | 初期版を実装 | `src/content/terrain.ts` | 移動計算テストで使用 |
| ユニット選択・情報表示 | 実装済み（試作） | `src/App.tsx`, `src/domain/models/game.ts` | ブラウザ確認は未実施 |
| 移動可能範囲計算 | 実装済み | `src/domain/movement/calculate-reachable-tiles.ts` | Vitest単体テスト追加 |
| 移動確定・待機 | 実装済み（自軍のみ） | `src/App.tsx` | UI自動テストなし |
| IndexedDB自動保存／復元 | 実装済み（saveVersion 1、auto slot） | `src/persistence/save-repository.ts` | ブラウザ統合テスト未実施 |
| 保存データ検証 | 実装済み | `src/domain/models/validate-game-state.ts` | Vitest単体テスト追加 |
| 戦闘計算・予測・解決のUI統合 | 未実装 | `src/App.tsx`, `docs/combat.md` | 未実施 |
| 敵AI・敵フェイズ・ターン進行 | 未実装 | 同 §3, §7 | 未実施 |
| レベルアップ・クラスチェンジ | 未実装 | 同 §5 | 未実施 |
| アイテム・イベント・リザルト | 未実装 | 同 §8, §9 | 未実施 |
| 勝利・敗北判定 | 未実装 | 同 §3, §8 | 未実施 |
| 章選択・複数ステージ | 未実装 | 同 §3, §9 | 未実施 |
| API／認証／バックエンド | 設計資料に仕様なし | — | 対象外 |
| ホスティング・本番デプロイ | 未選定／未実施 | — | 対象外 |

## 3. 開発・検証コマンド

- `npm run dev`: Vite開発サーバー
- `npm run typecheck`: TypeScript型チェック
- `npm test`: Vitest単体テスト
- `npm run build`: 型チェック後に本番ビルド
- `npm run preview`: ビルド成果物のローカル確認
- GitHub Actions: `.github/workflows/ci.yml` でPR／main push／feature branch push時に型チェック・テスト・ビルドを実行。

この作業環境ではGitHub clone／npm registryへの接続ができず、ローカル依存インストール・実行は未実施。CIの結果をPR上で確認する。

## 4. 試作データと制約

- マップ・ユニットは移動・UI確認用の仮データ。正式な章・キャラクター・マップではない。
- 移動は4方向、地形コスト、壁／水域、ユニット占有を考慮する。
- 戦闘domain kernelは追加済みだが、UIから攻撃を選ぶ操作、実武器データ、ゲーム状態へのHP反映、RNG保存は未接続。攻撃・アイテム・敵AI・フェイズ進行は未実装。移動後は待機のみ確定可能。
- セーブはブラウザ内IndexedDBの自動保存スロット1つ。複数スロット・バックアップ・マイグレーションは未実装。
- PWAのビルド設定はあるが、実機インストール・オフライン・更新動作は未検証。

## 5. 次の作業候補

1. PR CI結果を確認し、失敗があれば修正する。
2. ブラウザ／スマートフォンで地形表示、タップ選択、移動、リロード後復元を確認する。
3. マップ・セーブデータの検証とIndexedDB統合テストを追加する。
4. 攻撃距離の定義、正式な武器数値、装備／反撃武器選択、RNGセーブ方式を確定し、戦闘UIとapplication commandを接続する。
