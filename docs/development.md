# 開発環境・開発手順

## 1. 採用した基盤

| 項目 | 設定 |
|---|---|
| Node.js | `.nvmrc` は 26（Node.js 26 LTSを基準） |
| 許容Node.js | `^22.12.0 || ^24.0.0 || >=26.0.0` |
| package manager | npm |
| UI | React 19.3.1 / React DOM 19.3.1 |
| 言語 | TypeScript 7.0.2 |
| 開発・ビルド | Vite 8.3.6、`@vitejs/plugin-react` 6.2.1 |
| PWA | `vite-plugin-pwa` 2.0.0 |
| テスト | Vitest 5.1.0 |

直接依存のバージョンは `package.json` に固定している。現時点ではnpm lockfileは未作成。PWA plugin 2.0.0はNode.js 20.19.0以上を要求し、Vitest 5系のNode要件も満たすようNode 26を標準にしている。

## 2. ローカルセットアップ

Node.js 26系とnpmを用意し、リポジトリのルートで実行する。

```bash
npm install
npm run dev
```

Viteが表示するローカルURLをブラウザで開く。スマートフォン実機から確認する場合は、LANからアクセスできるよう開発サーバーのhost設定等を別途調整する。

初回の `npm install` で `package-lock.json` を生成し、再現可能な依存解決のためリポジトリへコミットすること。

## 3. 検証コマンド

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

- `typecheck`: TypeScript型チェック。
- `test`: Vitest単体テスト。
- `build`: 型チェック後にVite本番ビルド。PWA manifest／Service Workerも生成対象。
- `preview`: build後の成果物をローカルで確認。

## 4. CI

`.github/workflows/ci.yml` を追加した。Pull Requestと `main`／`feature/**` へのpushでNode.jsを `.nvmrc` からセットアップし、`npm install`、型チェック、Vitest、Vite buildを実行する。PRのChecksで実行結果を確認すること。ローカル実行・CI実行済みであると推測して報告してはいけない。

## 5. PWA

`vite.config.ts` で `vite-plugin-pwa` を設定し、manifest、SVGアイコン、Service Workerを生成する。Service Workerはbuild成果物に含まれる。実際のインストール・オフライン動作・更新挙動はHTTPS配信または対応するローカル環境で実機確認すること。

## 6. 環境変数・外部サービス・デプロイ

現時点で環境変数、外部API、ホスティング先、本番デプロイ手順は定義していない。設定を推測で追加しないこと。本番環境への接続やデプロイは別途承認を得てから行う。
