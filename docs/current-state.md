# 現在の実装状況

## 1. 監査スナップショット

- 更新日: 2026-11-09
- Repository: `otomezon/grid-tactics-pwa`
- デフォルトブランチ: `main`
- PR #1〜#4はマージ済み。PR #4のマージコミット: `99b1d26589bc2132aa0e1bd9c916d875f337f118`
- PR #4 CI: TypeScript型チェック成功、7 test files／42 tests成功、Vite build／PWA Service Worker生成成功。
- 現在の開発対象: 敵AI・敵軍フェイズ、勝敗判定、ターン進行。
- Node.js 26、npm、Vitest 5.0.0。
- Game save schema: `saveVersion: 2`。今回のフェイズ進行ではGameStateの形を変更しない。

## 2. 機能別ステータス

| 機能 | 状況 | 関連ファイル |
|---|---|---|
| React／Vite／PWA | 実装済み | `package.json`, `vite.config.ts`, `src/main.tsx` |
| 10×10マップ・地形 | 実装済み（仮コンテンツ） | `src/content/maps/chapter-01.ts`, `src/content/terrain.ts` |
| 味方ユニット移動 | 実装済み | `src/domain/movement/` |
| 仮武器・装備選択 | 実装済み（仮値） | `src/content/weapons.ts`, `src/App.tsx` |
| 戦闘予測・プレイヤー攻撃 | 実装済み | `src/domain/combat/`, `src/application/perform-attack.ts` |
| RNG state・save migration | 実装済み（saveVersion 2） | `src/domain/random/`, `src/persistence/migrations.ts` |
| 自軍フェイズ終了／敵軍開始 | 実装済み | `src/application/resolve-enemy-phase.ts`, `src/App.tsx` |
| 敵AI（攻撃対象評価） | 基本実装・暫定スコア | `src/application/resolve-enemy-phase.ts` |
| 敵AI（移動後攻撃／接近／待機） | 基本実装 | 同上、`src/domain/movement/` |
| 敵行動順の固定 | 実装済み（ID辞書順） | `src/application/resolve-enemy-phase.ts` |
| ターン進行・行動フラグreset | 実装済み | 同上 |
| 敵軍フェイズ中セーブからの再開 | 実装済み | `src/App.tsx`, `src/persistence/save-repository.ts` |
| 勝利（defeat_all／defeat_boss） | 実装済み | `src/domain/rules/evaluate-battle-outcome.ts` |
| 敗北（味方全滅） | 実装済み | 同上 |
| 主人公個別撃破による敗北 | 未実装（主人公IDなし） | 未定義 |
| 戦闘後リザルト／報酬 | 未実装 | — |
| 経験値・レベルアップ・クラスチェンジ | 未実装 | — |
| 敵の役割タグ／AI優先度 | 未実装 | — |
| 砦のフェイズ開始回復 | 未実装（10%回復の整数端数未決定） | `docs/game-design.md` §4.2 |
| UI／スマートフォン実機確認 | 未実施 | — |

## 3. 検証コマンド

`npm run typecheck`、`npm test`、`npm run build` をGitHub Actionsで実行する。今回のローカルnpm実行およびブラウザ／スマートフォン実機確認は未実施。PR Checksの結果を追記する。

## 4. 暫定・未決定事項

- 仮武器能力値・Manhattan距離は正式仕様ではない。
- AI対象スコアと移動先評価は初期ヒューリスティックで、実プレイ調整が必要。
- 役割タグは現在のユニットモデルにないためスコア対象外。
- 敗北条件は味方全滅のみ。主人公個別撃破は主人公識別データがないため保留。
- 砦回復は設計書に記載があるが、処理／端数規則未確定のため未実装。
- リザルト・経験値・成長・報酬・キャンペーン進行は未実装。
- ブラウザ統合テスト・モバイル実機・IndexedDB再開動作は未実施。

## 5. 次の作業候補

1. AIの行動スコアをプレイテストして調整。
2. リザルト、経験値・撃破報酬、レベルアップ。
3. 主人公識別と敗北条件、砦回復の端数規則を決定。
4. 1ステージの開始からクリアまでをブラウザで検証。
