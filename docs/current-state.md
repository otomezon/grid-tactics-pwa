# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-09
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1（AI開発ドキュメント基盤）: マージ済み
- PR #2（PWA／マップ初期プロトタイプ）: マージ済み。マージコミット: `bd7f7acf6d787ec51ef985f6f617dbbd16ab6b74`
- PR #3（戦闘計算・決定論的resolver）: マージ済み。マージコミット: `43c9cb8483678b526a46d2c02fc4565b733e0e85`
- 現在の対象: 戦闘予測・実行UI、ゲーム状態へのHP／撃破／行動済み反映、RNG state保存、saveVersion 1→2 migration。
- Node.js: `.nvmrc` は26。package.jsonはNode 22.12+／24+／26+を許容。
- package manager: npm
- Vitest: `5.0.0`
- Game save schema: `saveVersion: 2`。IndexedDB database versionは1のまま。
- この作業ブランチでアプリ、ドメイン、content、persistence、テスト、ドキュメントを追加・更新。
- PR #4のGitHub Actions CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。ブラウザ実機確認は未実施。

## 2. 機能別ステータス

「実装済み」はコードを追加したことを示す。CI成功・実機確認済みという意味ではない。

| 機能 | 状況 | 関連ファイル | テスト状況 |
|---|---|---|---|
| React + TypeScript + Vite基盤 | 実装済み | `package.json`, `vite.config.ts`, `src/main.tsx` | CI |
| PWA manifest／Service Worker | 実装済み | `vite.config.ts`, `src/main.tsx`, `public/icons/` | CI build。実機確認は未実施 |
| 10×10マップ・地形表示 | 実装済み（試作） | `src/App.tsx`, `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` | ブラウザ確認未実施 |
| ユニット選択・移動範囲・移動 | 実装済み（自軍のみ） | `src/App.tsx`, `src/domain/movement/` | Vitest 6件。UI自動テストなし |
| 仮武器5種・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` | application／migration tests |
| 攻撃可能範囲表示 | 実装済み（暫定Manhattan距離） | `src/domain/combat/grid-distance.ts`, `src/App.tsx` | 距離テスト |
| 戦闘予測UI | 実装済み | `src/App.tsx`, `src/application/perform-attack.ts` | domain／application tests |
| 戦闘解決・HP反映・撃破除去 | 実装済み（自軍から攻撃） | `src/application/perform-attack.ts`, `src/domain/combat/combat.ts` | domain／application tests |
| 命中・必殺乱数 | 実装済み（Xorshift32） | `src/domain/random/xorshift32.ts` | RNG tests |
| RNG stateの自動保存 | 実装済み（saveVersion 2） | `src/domain/models/game.ts`, `src/persistence/save-repository.ts` | migration／validation tests |
| saveVersion 1→2 migration | 実装済み | `src/persistence/migrations.ts` | migration tests |
| 敵AI・敵フェイズ・ターン進行 | 未実装 | `docs/game-design.md` §3, §7 | 未実施 |
| 勝利・敗北判定・リザルト | 未実装 | 同 §3, §8 | 未実施 |
| レベルアップ・クラスチェンジ | 未実装 | 同 §5 | 未実施 |
| アイテム・イベント | 未実装 | 同 §8, §9 | 未実施 |
| 章選択・複数ステージ | 未実装 | 同 §3, §9 | 未実施 |
| API／認証／バックエンド | 設計資料に仕様なし | — | 対象外 |
| ホスティング・本番デプロイ | 未選定／未実施 | — | 対象外 |

## 3. 検証コマンド

- `npm run dev`: Vite開発サーバー
- `npm run typecheck`: TypeScript型チェック
- `npm test`: Vitest単体テスト
- `npm run build`: 型チェック後に本番ビルド
- `npm run preview`: ビルド成果物のローカル確認
- GitHub Actions: PR／main push／feature branch push時に型チェック・テスト・build。

本作業のローカルnpm実行は行っていない。CIの結果はPR Checksで確認する。ブラウザ・スマートフォン実機での操作検証も未実施。

## 4. 制約と未決定事項

- マップ・ユニット・武器は操作検証用の仮データ。正式コンテンツではない。
- 仮武器の数値のうち鉄の剣は設計書 §12.2 の例に一致する。他の武器値は暫定値であり、正式バランスではない。
- 攻撃距離は暫定的にManhattan距離。設計書で明示された最終ルールではない。
- 反撃は防御側の現在装備している武器を使用する。
- 攻撃後の敵撃破は反映するが、勝利判定・敵AI・敵フェイズは未実装。
- IndexedDB saveVersion 1から2へのmigrationを追加した。複数slot・backup・export/importは未実装。
- UIのブラウザ／スマートフォン実機確認、IndexedDB統合テスト、PWAオフライン確認は未実施。

## 5. 次の作業候補

1. PR CIとレビュー差分を確認する。
2. 仮武器値と攻撃距離（Manhattan）の正式仕様を決める。
3. 戦闘ログ表示、勝利／敗北判定、フェイズ進行へ進む。
4. 敵AIを実装し、1ステージを通してプレイできる状態にする。
