# Grid Tactics PWA

スマートフォンのブラウザで遊べる、オフライン対応を目指したターン制タクティカルSRPGのプロジェクトです。

## 現在の開発状況

- PR #1〜#22をmainへマージ済みです。PR #22でバージョン付きJSON形式のセーブ書き出し／読み込み機能を追加し、章・マップ・saveVersion検証と上書き前確認を実装しました。PR #23では既存IndexedDB storeを再利用した最大3世代の手動ローカルバックアップを追加し、4回目以降の最古世代ローテーション、確認付き復元、旧saveVersion migration、不正データ拒否を実装しました。PR #23はレビュー待ちであり、まだmainにはマージされていません。
- 章遷移はデータ駆動で、第2章は引き継ぎ動作確認用の試作マップです。正式な章報酬の内容・数量は未設定です。
- マップ・ユニット・武器の能力値は操作確認用の仮データです。AIスコアも初期ヒューリスティックで、正式なバランス値ではありません。
- クラスチェンジの能力ボーナス／クラス上限は暫定値です。章報酬は設定データが定義された場合のみ配布し、未設定の試作章にアイテムを勝手に付与しません。
- 出撃準備は [docs/deployment.md](docs/deployment.md)、実装状況は [docs/current-state.md](docs/current-state.md)、敵AIの判断と未決定事項は [docs/enemy-ai.md](docs/enemy-ai.md) を参照してください。

## 技術スタック

- Node.js 26（許容: Node 22.12+、24+、26+）
- npm
- React 19.3.1 / React DOM 19.3.1
- TypeScript 7.0.2
- Vite 8.3.6
- vite-plugin-pwa 2.0.0
- Vitest 5.0.0
- Playwright Test 1.65.0（Chromium E2E）
- IndexedDB（ブラウザ内の自動保存、JSON export/import、PR #23ブランチの最大3世代ローカルバックアップ、saveVersion 3／v1・v2セーブ移行）

## セットアップ

```bash
npm install
npm run dev
```

主な確認コマンド:

```bash
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

初回の `npm install` で `package-lock.json` を生成し、依存関係の再現性を確保するため別途コミットしてください。詳細は [docs/development.md](docs/development.md) を参照。

## ドキュメント

- [AIエージェント向け開発ルール](AGENTS.md)
- [ドキュメント目次](docs/README.md)
- [ゲーム設計書 v1.0](docs/game-design.md)
- [アーキテクチャ](docs/architecture.md)
- [戦闘システム](docs/combat.md)
- [敵AI・フェイズ進行](docs/enemy-ai.md)
- [経験値・レベルアップ・リザルト](docs/progression.md)
- [開発環境・手順](docs/development.md)
- [データ保存設計](docs/database.md)
- [セキュリティ](docs/security.md)
- [実装状況](docs/current-state.md)
- [設計と実装の照合](docs/design-reconciliation.md)

## 開発方針

ゲーム設計の基準は [docs/game-design.md](docs/game-design.md) です。設計提案、仮データによる実装上の選択、正式に決定した仕様を混同せず、未決定のゲームルールを確定扱いしないでください。AI開発時は必ず [AGENTS.md](AGENTS.md) を参照してください。
