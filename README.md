# Grid Tactics PWA

スマートフォンのブラウザで遊べる、オフライン対応を目指したターン制タクティカルSRPGのプロジェクトです。

## 現在の開発状況

- PR #1〜#63はmainへマージ済みです。PR #54でPWAのブラウザ標準インストールプロンプトと手動追加案内を追加し、merge commit `146c5952713f1cae3916fcde3e0f8a2407f995e1`・CI run #643成功を確認しました。PR #55では戦闘マップに勝利／敗北条件の進行と、選択マスの地形効果・移動コストを追加しました。PR #56では味方攻撃と敵軍フェイズの実結果をターン順に並べるセッション内戦闘履歴を追加し、地形情報パネルのポインターフォーカスによるマップ位置ずれも修正しました（merge commit `c7c9d9ced4cd226b9c25cba7ab6d59e82b924910`、CI run #675でChromium E2E 23件成功）。PR #57ではセーブ内ユニットの現在地と移動種別に基づく地形通行可否を検証し、JSON読込／バックアップ復元で不正配置を拒否しました（merge commit `1fc9d6e924e7323d4ea611d1b9649e4e39d408b3`、CI run #679でtypecheck・単体テスト・本番ビルド・Chromium E2E 23件成功）。PR #58ではクラス／武器／アイテムIDの登録整合性、装備武器の適性、現役ユニットの生存HPを検証しました（merge commit `e0086af741bae0f607e85cfa6f40f147c2c4e3f1`、最終head CI run #688成功）。saveVersion 3を維持しています。PR #59では移動可能マスの累計コスト表示と、マウス／キーボードフォーカス時の最小コスト経路プレビューを追加しました。タッチ操作では最初のタップで経路を表示し、同じマスをもう一度タップすると移動を確定します。プレビュー中はGameState／オートセーブを変更しません（merge commit `d0a7528eb9174bdaa9fd0ff5214e81d43bc84e9d`、PR head CI run #695成功）。PR #60ではスマートフォンのタッチ操作に合わせ、1回目のタップで経路確認、同じマスへの2回目で移動確定とする操作を追加しました（merge commit `0261897c0e14c350cd99d8710776ec3046c99be0`、PR head CI run #709成功）。操作ガイドは出撃準備から戦闘・地形判断・ターン進行・セーブまでを6段階で説明し、いつでも開閉できる表示専用UIです。さらに戦闘マップはARIAグリッドとしてキーボード対応し、Tabで1つのマスへ入り、矢印キー／Home／Endでフォーカスを移動できます。マスのフォーカス移動は地形・経路の確認だけを行い、GameState／saveVersion／IndexedDBを変更しません。PR #63では戦闘中の味方一覧にHPと行動状態を表示し、一覧からユニットを選ぶと対応するマスへマップをスクロールする操作を追加しました（merge commit `28e87536931f22753d1815b8e3911f96e3a29501`）。控え名簿は対象外で、選択は画面内状態のみです。PR #22でバージョン付きJSON形式のセーブ書き出し／読み込み機能を追加し、章・マップ・saveVersion検証と上書き前確認を実装しました。PR #23で既存IndexedDB storeを再利用した最大3世代の手動ローカルバックアップを追加し、4回目以降の最古世代ローテーション、確認付き復元、旧saveVersion migration、不正データ拒否を実装しました（マージコミット: `f283e38c67c4b4c822e47d93d54d7b7941b0abac`）。PR #44では狭幅画面のマップタイルを40px以上に保つ横スクロール領域、キーボード操作、320px幅でのタッチ選択を追加しました（マージコミット: `ef92a0c71d6de705a42a83fa64cf9a6b7529a9ba`）。PR #44のCI run #596は25 test files／161 unit tests、本番ビルド、Chromium E2E 17件すべて成功。IndexedDB DB versionとGameStateSnapshot.saveVersionは変更していません。PR #45ではPR #44のマージ後にREADME・開発ルール・アーキテクチャ・実装状況等の文書を同期した（merge commit `b4e87c9261d81c0166bbcacdc41d3964d02ad1b0`、CI run #598成功）。PR #46では幅320pxのChromiumで指の横スワイプ後にマップ領域だけが横スクロールし、ページ全体が横にはみ出さないことをE2Eで検証した（merge commit `81d8f856c65251d85184d61402edca14c3aad16c`、CI run #599: 25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #47では同じスワイプの後、マップ右端の味方04が表示領域内に収まり、タップで選択情報が更新されることを追加検証した（merge commit `fd1c98bdc3553b4f252c7ce3ca8a7356cbcda01d`、CI run #605: typecheck、25 test files／161 unit tests、production build、Chromium E2E 18件成功）。PR #46／#47はいずれもテストと文書のみで、ゲームルール・セーブ形式・能力値は変更していない。実機スマートフォンの操作確認は別途必要。 PR #48ではPR #45〜#47のマージ履歴と320px幅のタッチスワイプ後ユニット選択E2EをREADME・開発ルール・アーキテクチャ・実装状況へ同期した（merge commit `b0557ba30653632f0deb3edd16f44919da46e301`、CI run #607: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #49では設計書と実装の照合文書を更新し、PR #48までの履歴・未決定事項・実機未確認の区別を整理した（merge commit `d73d8419dc085ef535da7fe73c5609e05f33b40d`、CI run #609: typecheck、25 test files／161 unit tests、本番ビルド、Chromium E2E 18件成功）。PR #48／#49はいずれも文書のみで、アプリ動作・ゲームルール・能力値・報酬・saveVersionは変更していない。
PR #50はPR #48／#49後のREADME・開発ルール・実装状況を同期した（merge commit `451d1b47cd0084af47b2a64b7220bb376250b2e6`、CI run #611成功）。PR #51は320px幅・高さ568／720pxのタッチ操作E2Eと、回復量10HP（試作値）の回復薬使用フローを追加した（merge commit `a6162dc3180b0b635aa73573acf9ec7258dc1b11`、CI run #621: typecheck、26 test files／168 unit tests、production build、Chromium E2E 20件成功）。saveVersion 3は維持。PR #52は採択済み非数値昇格方針と未承認バランス数値を記入表で区別した（merge commit `66ba9bf7769a5f1b97e2a259b547977a9d7c0faf`、CI run #614成功）。PR #53では同一アイテムの数量スタック表示と登録済みIDによる使用処理検証をまとめて実装した（merge commit `29ca7cf75343ca3f0c382f62ad43a6c5cdf64ca0`、CI run #638成功）。
- 章遷移はデータ駆動で、第2章は引き継ぎ動作確認用の試作マップです。正式な章報酬の内容・数量は未設定です。
- 移動プレビューは既存の地形コスト・通行不可地形・占有マス・移動力を使った表示専用機能で、移動ルールやバランス値を変更しません。
- 操作ガイドは出撃準備・移動・攻撃予測・アイテム／行動・地形・ターン／保存を順に説明する任意表示のヘルプです。ガイドを開閉・閲覧してもゲーム状態やセーブは変わりません。
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
- IndexedDB（ブラウザ内の自動保存、JSON export/import、最大3世代の手動ローカルバックアップ／確認付き復元、saveVersion 3／v1・v2セーブ移行）

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
- [クラスチェンジの仕様・判断待ち・実装計画](docs/class-promotion.md)
- [開発環境・手順](docs/development.md)
- [データ保存設計](docs/database.md)
- [セキュリティ](docs/security.md)
- [実装状況](docs/current-state.md)
- [設計と実装の照合](docs/design-reconciliation.md)

## 開発方針

ゲーム設計の基準は [docs/game-design.md](docs/game-design.md) です。設計提案、仮データによる実装上の選択、正式に決定した仕様を混同せず、未決定のゲームルールを確定扱いしないでください。AI開発時は必ず [AGENTS.md](AGENTS.md) を参照してください。
