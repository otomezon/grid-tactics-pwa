# セキュリティ・プライバシー

## 1. 現在の確認状況

初期アプリ基盤を追加した。現時点ではシングルプレイのブラウザアプリであり、サーバー、ログイン、外部API、オンライン同期、分析・トラッキングは実装していない。

「脆弱性なし」「安全」と評価できる状態ではない。GitHub Actionsには依存関係監査、Pull Requestの依存変更レビュー、JavaScript／TypeScriptのCodeQL解析を定義しているが、各実行結果はActions／Securityの実際の結果で確認する。ワークフローを置いただけで脆弱性がないことや、必須チェックとして保護されていることを意味しない。本番ホスティング、HTTPS配信、CSP、HTTPセキュリティヘッダーは未設定／未確認。

### 自動検査と依存更新

- `.github/workflows/security.yml` はPull Request、`main`へのpush、毎週のスケジュール、手動実行で起動する。
- 依存関係監査はlockfile全体を対象に `npm audit --audit-level=high` を実行する。high／criticalの脆弱性が検出された場合は失敗させる。devDependenciesも監査対象である。
- `--audit-level=high` は失敗させる最低severityであり、moderate以下が存在してもjobは成功する。2026-11-17のmain Security run `43991915856` ではjobは成功したが、moderateが6件報告されたため「脆弱性ゼロ」とは扱わない。
- 同runで確認したVitest 5.0.0の `@vitest/mocker` に関するGHSA-qxg6-89mg-rqv8／GHSA-xp26-3454-mjgpはVitest 5.1.0で修正されているため、Vitestとlockfileを同期した。旧 `vite-plugin-pwa@2.0.0 → workbox-build@7.4.1` の依存範囲はglob／minimatchの修正版を選択できないため、公式後継の `@unplugin-pwa/vite@0.0.6`／`@vite-pwa/workbox-build@8.0.15` へ移行する。後継は `tinyglobby` を使い、旧Workbox 7のglob／minimatch経路を使わない。設定はクラシックService Workerと既存の `virtual:pwa-register` 登録APIを維持し、生成物・オフライン起動・ユーザー確認式更新の互換性はCIのPWA E2Eで確認する。新プラグインは0.xのため、E2Eと依存監査の結果を確認するまで本番反映しない。
- Dependency ReviewはPull Requestで変更されたruntime／development依存関係を確認し、新たに導入されるhigh／critical脆弱性を失敗にする。ライセンスの許可／拒否ポリシーはまだ定義していないため、この検査ではライセンス判定を無効にしている。
- CodeQLはJavaScript／TypeScriptを解析する。自動ビルド工程を必要としない言語として `build-mode: none` を指定し、同一リポジトリのPull Request、`main`へのpush、週次実行で解析する。forkからのPull Requestでは、Security Eventsへの書き込み権限を与えないためCodeQL jobを実行しない。
- `.github/dependabot.yml` はnpm依存関係とGitHub Actionsの更新確認を毎週行い、各ecosystemの更新をそれぞれ1つのグループへまとめる。major／minor／patchを同じ週次グループで提案するため、更新は一括してCIで検証し、互換性を確認してから採用する。
- Dependency Review／CodeQLの結果や監査の失敗状態はGitHub上で確認する。PRマージを必須チェックでブロックするには、GitHubのRulesets／ブランチ保護設定で対象checkをrequiredにする必要がある。ワークフロー定義自体はその設定を変更しない。
- Dependabotのversion update設定は、GitHub側のDependabot alerts／security updatesを有効にしたことを意味しない。リポジトリのSecurity設定でDependency graph、Dependabot alerts、Dependabot security updates、secret scanningの可否と状態を別途確認する。

## 2. ローカル保存データ

- セーブデータはIndexedDBに保存する。
- 読込時にsaveVersion、chapterId、出撃名簿、座標範囲・地形通行可否、重複ID／重複占有、登録済みクラス／武器／アイテムID、装備武器の所持・武器適性、現役ユニットの生存HP、能力値、成長率、所持品上限等を検証する。
- 非対応／不正なデータを自動で初期化・上書きしない。現在は読み込みを停止する。
- IndexedDBは暗号化・改ざん防止を保証しない。機密情報や認証情報を保存しない。
- 自動セーブは形式version付きJSONとして書き出し・読み込みできる。読み込み時はJSON形式、保存version、章ID、章マップ整合性を検証し、ユーザー確認後にのみ既存の自動セーブを置き換える。
- エクスポートファイルは平文JSONであり、暗号化やパスワード保護を行わない。信頼できる保管先を使用し、他人と共有する際は内容に注意する。
- 手動バックアップは同じIndexedDB内に最大3世代保存する。復元時は章ID解決、既存saveVersion migration、snapshot validatorを通し、確認後にのみauto slotを置き換える。不正・未知形式は拒否し、バックアップも暗号化や改ざん防止を提供しない。
- タイトル画面ではStorageManager.persisted()でブラウザの永続ストレージ許可状態を確認し、利用者が明示操作した場合だけpersist()を要求する。非対応・拒否・APIエラーを区別し、許可済みの場合も永続保管を保証する表示はしない。
- タイトル画面では `StorageManager.estimate()` からサイト全体の推定使用量と推定割当量を読み取り、必要な場合は明示操作で再取得できる。これはブラウザが返すorigin単位の概算で、IndexedDB以外のキャッシュ等を含むことがあり、端末の空き容量や実際に利用可能な残量を示すものではない。読み取りは永続ストレージ許可を要求せず、estimate非対応・取得失敗・不正値は表示上区別する。
- 永続ストレージの許可はブラウザによる自動的な容量整理・evictionのリスクを下げるための要求であり、端末故障、利用者によるデータ消去、ブラウザ設定のリセット、OS／ブラウザの不具合から保護するものではない。JSON exportと手動3世代backupを引き続き利用する。
- IndexedDB書き込みで `QuotaExceededError` が発生した場合は、セーブJSONの退避と空き容量の確保を案内する。`SecurityError` の場合は、プライベートブラウズやサイトデータ制限など、ブラウザー側のローカル保存制限を確認するよう案内する。エラー名に基づく案内であり、ブラウザーごとの発生条件を保証するものではない。
- 自動保存だけでなく、手動バックアップ復元とJSONセーブ読み込みも、操作開始時の `savedAt` revisionをtransaction内で照合する。別タブなどが先に更新していれば置換を拒否する。
- 対応ブラウザーではBroadcastChannelで自動セーブのrevision番号だけを同一オリジンの別タブへ通知し、古い画面をすぐ競合状態へ切り替えて操作を停止する。セーブ本文やユニット情報は通知しない。BroadcastChannel非対応・失敗時もIndexedDBのreadwrite transaction内のrevision照合を維持し、上書きを防ぐ。これは同一ブラウザー内の競合保護であり、別ブラウザー・端末との同期機能ではない。
- ストレージ消去・容量制限・ブラウザ設定によりセーブが失われる可能性がある。

## 3. PWA・依存関係

- Service Workerはビルド時に静的アセットをprecacheする。
- 更新検知は `registerType: "prompt"` で行い、新しいService Workerが待機しても自動で有効化・再読み込みしない。アプリの更新案内から明示的に「更新して再読み込み」を選択した場合だけ待機中workerを有効化する。
- 更新ボタンはタイトル画面、または保存済みの勝敗確定画面でのみ有効。出撃準備／戦闘中、未確認イベントがある間、ロード・保存・バックアップ・次章準備中、セーブ検証で読み込みがブロックされた状態では更新を適用しない。
- 「あとで」で案内を閉じても待機中workerは保持する。アプリが安全な画面へ戻ると更新案内を再表示する。適用時のページ再読み込み後は既存IndexedDBセーブから再開する。
- 依存関係は `package.json` とlockfileで固定し、週次のグループ更新はDependabotから提案する。npm audit、Dependency Review、CodeQLの各CI結果はGitHub Actions／Securityで確認する。
- HTTPS配信、CSP、HTTPセキュリティヘッダー、本番ホスティングは配信先が未決定のため今後の作業。設定値や外部サービスを推測して追加しない。

## 4. コンテンツ権利

ゲームは独自の世界観・キャラクター・マップ・画像・シナリオ・音源を持つオリジナル作品とする。既存作品の固有名称、キャラクター、台詞、マップ、画像、音源等を流用しない。素材を追加する場合は出典・利用許諾・ライセンスを確認する。

## 5. 未確認事項

npm audit／Dependency Review／CodeQLの実行結果と、GitHub側のDependency graph／Dependabot alerts／security updates／secret scanningの有効状態は各CI runとリポジトリ設定で確認する。ブランチ保護でSecurity checksが必須になっているかも未確認。本番ホスティングのHTTPS・ヘッダー設定、CSP、セーブ／バックアップの実スマートフォンでの作成・復元、ストレージ容量不足・private browsing時の実際の挙動、Service Worker更新時の実機保護動作は引き続き未確認。`QuotaExceededError`／`SecurityError` に対する画面案内は実装したが、実機での再現・復旧確認は別途必要。