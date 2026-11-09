# アーキテクチャ

## 1. 現在の構成

添付設計書 v1.0 のレイヤー分離方針を踏まえ、Phase 0のアプリ基盤とマップ・移動の試作実装を追加した。

```text
.
├── AGENTS.md
├── index.html
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── .github/workflows/ci.yml
├── public/
│   ├── favicon.svg
│   └── icons/
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── styles.css
    ├── content/
    │   ├── terrain.ts
    │   └── maps/chapter-01.ts
    ├── domain/
    │   ├── models/
    │   └── movement/
    └── persistence/
```

単体テストは対象モジュールと同じ階層に `*.test.ts` として置く。

## 2. レイヤーと責務

| レイヤー | 現在の責務 | 状態 |
|---|---|---|
| content | 地形定義、試作マップ、試作ユニット・初期状態 | 実装あり |
| domain/models | ゲーム型、セーブ状態検証 | 実装あり |
| domain/movement | 地形コストと占有を考慮した到達可能範囲計算 | 実装あり |
| application | UIイベントと状態更新を `App.tsx` が暫定的に制御 | 今後分離 |
| ui | React画面、マップ、情報パネル、レスポンシブCSS | 試作実装あり |
| persistence | IndexedDBの初期化、読込、保存 | saveVersion 1を実装 |
| pwa | manifest、Service Worker生成・登録、静的アセットキャッシュ | Vite plugin設定あり |

独立したapplication／engine controller／event layerは今後の作業で必要性を評価する。設計書の理想レイヤーをすべて実装済みとみなさないこと。

## 3. 現在のデータフロー

1. `chapter-01.ts` が試作マップ・地形・ユニットの初期値を提供する。
2. `App.tsx` がIndexedDBのauto slotを読み、保存があれば型・範囲・重複占有を検証する。
3. プレイヤーがユニットをタップすると、選択ユニットと移動可能マスを計算する。
4. `calculate-reachable-tiles.ts` が4方向の到達範囲を地形コスト付きで探索する。占有マスと進入不可地形は通過しない。
5. 移動確定または待機確定でゲーム状態を更新し、`save-repository.ts` 経由でIndexedDBに保存する。
6. `vite-plugin-pwa` がビルド時にmanifestとService Workerを生成し、静的アセットをキャッシュする。

## 4. 依存方向のルール

- domainはReact／DOMに依存しない。
- contentはゲームデータと定義を保持し、計算処理を持たない。
- UIはdomainの計算結果を表示し、移動計算式を再実装しない。
- persistenceは型付きの保存状態を扱い、UIからIndexedDB APIを直接呼ばない。
- UIからユニット座標を直接変更する処理は、将来application commandへ移管する。

## 5. これからの分割候補

- `application/gameController.ts`: コマンド検証・状態遷移・行動確定。
- `domain/combat/`: 射程、三すくみ、戦闘予測、実際の解決処理。
- `domain/progression/`: 経験値・成長・クラスチェンジ。
- `domain/ai/`: 敵行動選択。
- `content/classes/`、`content/weapons/`、`content/chapters/`: 静的コンテンツ。
- `persistence/migrations.ts`: saveVersion更新時の明示的移行。
- UIコンポーネント分割。現状は `App.tsx` に集約。

## 6. 外部サービス

現時点でサーバー、アカウント、オンライン同期、HTTP APIは追加していない。PWAのオフライン利用とローカルIndexedDB保存を基本とする。
