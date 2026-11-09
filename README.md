# Grid Tactics PWA

スマートフォンのブラウザで遊べる、オフライン対応を目指したターン制タクティカルSRPGのプロジェクトです。

## 現在の開発状況

- PR #1でAI開発ドキュメント基盤、PR #2でPWA／マップ／移動、PR #3で戦闘計算エンジン、PR #4で戦闘UI／攻撃実行／乱数保存をmainへマージ済み。
- 現在の開発ブランチでは自軍フェイズ終了、敵AI、敵軍フェイズ、勝利・敗北判定、ターン更新を接続しています。
- マップ・ユニット・武器の能力値は操作確認用の仮データです。AIスコアも初期ヒューリスティックで、正式なバランス値ではありません。
- 経験値・成長、敵フェイズ後のリザルト・報酬、キャンペーン進行は未実装です。
- 実装状況は [docs/current-state.md](docs/current-state.md)、敵AIの判断と未決定事項は [docs/enemy-ai.md](docs/enemy-ai.md) を参照してください。

## 技術スタック

- Node.js 26（許容: Node 22.12+、24+、26+）
- npm
- React 19.3.1 / React DOM 19.3.1
- TypeScript 7.0.2
- Vite 8.3.6
- vite-plugin-pwa 2.0.0
- Vitest 5.0.0
- IndexedDB（ブラウザ内の自動保存、saveVersion 2）

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
- [開発環境・手順](docs/development.md)
- [データ保存設計](docs/database.md)
- [セキュリティ](docs/security.md)
- [実装状況](docs/current-state.md)
- [設計と実装の照合](docs/design-reconciliation.md)

## 開発方針

ゲーム設計の基準は [docs/game-design.md](docs/game-design.md) です。設計提案、仮データによる実装上の選択、正式に決定した仕様を混同せず、未決定のゲームルールを確定扱いしないでください。AI開発時は必ず [AGENTS.md](AGENTS.md) を参照してください。
