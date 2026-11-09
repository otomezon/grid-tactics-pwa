# Grid Tactics PWA

スマートフォンのブラウザで遊べる、オフライン対応を目指したターン制タクティカルSRPGのプロジェクトです。

## 現在の開発状況

- PR #1でAI開発ドキュメント基盤を整備し、mainへマージ済み。
- 現在の作業ブランチではPhase 0のReact／TypeScript／Vite／PWA基盤と、Phase 1の10×10マップ・ユニット選択・移動範囲・移動の初期プロトタイプを追加しています。
- マップとユニットは操作確認用の仮データです。戦闘、敵AI、フェイズ進行、成長、章選択は未実装です。
- 実装状況は [docs/current-state.md](docs/current-state.md) を参照してください。

## 技術スタック

- Node.js 26（許容: Node 22.12+、24+、26+）
- npm
- React 19.3.1 / React DOM 19.3.1
- TypeScript 7.0.2
- Vite 8.3.6
- vite-plugin-pwa 2.0.0
- Vitest 5.1.0
- IndexedDB（ブラウザ内の自動保存）

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
- [開発環境・手順](docs/development.md)
- [データ保存設計](docs/database.md)
- [セキュリティ](docs/security.md)
- [実装状況](docs/current-state.md)
- [設計と実装の照合](docs/design-reconciliation.md)

## 開発方針

ゲーム設計の基準は [docs/game-design.md](docs/game-design.md) です。設計提案と実装済み仕様を混同せず、未決定のゲームルールを推測で確定しないでください。AI開発時は必ず [AGENTS.md](AGENTS.md) を参照してください。
