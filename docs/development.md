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
| テスト | Vitest 5.0.0、Playwright Test 1.65.0（Chromium E2E） |

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
npx playwright install chromium
npm run test:e2e
npm run preview
```

- `typecheck`: TypeScript型チェック。
- `test`: Vitest単体テスト。
- `build`: 型チェック後にVite本番ビルド。PWA manifest／Service Workerも生成対象。
- `preview`: build後の成果物をローカルで確認。
- `test:e2e`: Playwrightで `e2e/pwa-preview-server.mjs` を起動し、Vite Previewが事前に生成した本番ビルドを配信する。Chromiumで出撃準備・控え名簿保存・行動状態復元・敵軍フェイズ・モバイル幅・PWA manifest／Service Worker／オフライン起動・Service Worker更新時の自動再読み込みとセーブ復元、セーブファイルの書き出し／読み込みと不正ファイル拒否を確認する。`playwright.config.ts` と `e2e/` が定義元。テストサーバーにある `/__test/force-sw-update` はテスト中だけ `dist/sw.js` にコメントを追記し、Service Workerの更新検知を発生させる専用エンドポイントである。

## 4. CI

`.github/workflows/ci.yml` を追加した。Pull Requestと `main`／`feature/**` へのpushでNode.jsを `.nvmrc` からセットアップし、`npm install`、型チェック、Vitest、Vite build、Playwright用Chromiumの導入、ブラウザE2Eテストを実行する。PRのChecksで実行結果を確認すること。ローカル実行・CI実行済みであると推測して報告してはいけない。

## 5. PWA

`vite.config.ts` で `vite-plugin-pwa` を設定し、manifest、SVGアイコン、Service Workerを生成する。Service Workerはbuild成果物に含まれる。CIのブラウザE2Eでは、本番Preview上でmanifest・制御状態・precache・オフライン起動に加え、Service Workerスクリプト更新後の自動再読み込みとIndexedDB保存状態の復元を検証する。実際のスマートフォンへのインストール、OSによるアプリ終了／再開、実機オフライン動作は引き続き手動確認が必要。

## 6. 環境変数・外部サービス・デプロイ

現時点で環境変数、外部API、ホスティング先、本番デプロイ手順は定義していない。設定を推測で追加しないこと。本番環境への接続やデプロイは別途承認を得てから行う。
