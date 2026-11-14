import { useRef, useState, type ChangeEvent } from "react";
import { StorageDurabilityPanel } from "./storage-durability-panel";

export interface CampaignBackupView {
  slotId: string;
  generation: number;
  savedAt: number;
  chapterTitle: string;
  chapterId: string;
  restorable: boolean;
}

export interface CampaignTitleScreenProps {
  isLoading: boolean;
  hasSavedCampaign: boolean;
  saveBlocked: boolean;
  canExportSave: boolean;
  canCreateBackup: boolean;
  saveStatusLabel: string;
  message: string;
  savedChapterTitle: string;
  savedTurn: number;
  savedPhaseLabel: string;
  savedOutcomeLabel: string;
  isInstalledApp: boolean;
  canInstall: boolean;
  backups: CampaignBackupView[];
  backupListLoaded: boolean;
  backupActionPending: boolean;
  onContinue: () => void;
  onStartNewCampaign: () => void;
  onExportSaveFile: () => void;
  onImportSaveFile: (file: File) => void;
  onCreateBackup: () => void;
  onRestoreBackup: (slotId: string) => void;
  onInstallApp: () => void;
}

export function CampaignTitleScreen({
  isLoading,
  hasSavedCampaign,
  saveBlocked,
  canExportSave,
  canCreateBackup,
  saveStatusLabel,
  message,
  savedChapterTitle,
  savedTurn,
  savedPhaseLabel,
  savedOutcomeLabel,
  isInstalledApp,
  canInstall,
  backups,
  backupListLoaded,
  backupActionPending,
  onContinue,
  onStartNewCampaign,
  onExportSaveFile,
  onImportSaveFile,
  onCreateBackup,
  onRestoreBackup,
  onInstallApp
}: CampaignTitleScreenProps) {
  const [confirmNewCampaign, setConfirmNewCampaign] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  function handleImportChange(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onImportSaveFile(file);
  }

  function requestNewCampaign(): void {
    if (isLoading || saveBlocked) return;
    if (hasSavedCampaign) setConfirmNewCampaign(true);
    else onStartNewCampaign();
  }

  return (
    <main className="campaign-title-screen" data-testid="campaign-title-screen">
      <div className="campaign-title-shell">
        <header className="campaign-title-hero">
          <p className="eyebrow">TACTICAL SRPG · OFFLINE READY</p>
          <h1>Grid Tactics</h1>
          <p className="campaign-title-subtitle">
            マス目を読み、仲間と進み、戦場を切り開くターン制タクティカルRPG。
          </p>
          <div className="campaign-title-meta">
            <span>スマートフォン・PC対応</span>
            <span>ローカル保存</span>
            {isInstalledApp && <span data-testid="pwa-installed-status">インストール済み</span>}
            {canInstall && (
              <button className="campaign-title-install" type="button" data-testid="pwa-install-button" onClick={onInstallApp}>
                アプリをインストール
              </button>
            )}
          </div>
        </header>

        <div className="campaign-title-grid">
          <section className="campaign-title-card campaign-title-main-card" aria-labelledby="campaign-title-heading">
            <p className="eyebrow">CAMPAIGN</p>
            <h2 id="campaign-title-heading">キャンペーン</h2>
            {hasSavedCampaign && !saveBlocked ? (
              <div className="campaign-resume-summary" data-testid="campaign-resume-summary">
                <div>
                  <span>保存された進行</span>
                  <strong>{savedChapterTitle}</strong>
                </div>
                <div className="campaign-resume-stats">
                  <div><span>ターン</span><strong>{savedTurn}</strong></div>
                  <div><span>状態</span><strong>{savedOutcomeLabel}</strong></div>
                  <div><span>フェイズ</span><strong>{savedPhaseLabel}</strong></div>
                </div>
                <p className="campaign-save-state">保存状態：{saveStatusLabel}</p>
                <button className="campaign-primary-button" type="button" disabled={isLoading} onClick={onContinue}>
                  つづきから
                </button>
              </div>
            ) : saveBlocked ? (
              <div className="campaign-title-warning" role="alert">
                <strong>保存データを保護しています</strong>
                <p>現在の保存データを検証できないため、新規開始による上書きを停止しました。正しいセーブファイルまたはバックアップを読み込んでください。</p>
              </div>
            ) : (
              <div className="campaign-new-summary">
                <strong>新しい冒険を始めましょう</strong>
                <p>出撃メンバーと配置を確認してから、最初のステージを開始できます。</p>
              </div>
            )}

            <button className="campaign-secondary-button" type="button" disabled={isLoading || saveBlocked} onClick={requestNewCampaign}>
              はじめから
            </button>

            {confirmNewCampaign && (
              <div className="campaign-confirmation" role="group" aria-labelledby="campaign-new-confirm-heading">
                <h3 id="campaign-new-confirm-heading">新しいキャンペーンを始めますか？</h3>
                <p>既存の自動セーブは、新しいキャンペーンの出撃配置を確定するまで上書きしません。確定後は新しい進行で置き換わります。必要な場合は先にバックアップを作成してください。</p>
                <div className="campaign-confirmation-actions">
                  <button className="campaign-secondary-button" type="button" onClick={() => setConfirmNewCampaign(false)}>
                    キャンセル
                  </button>
                  <button className="campaign-primary-button" type="button" onClick={() => {
                    setConfirmNewCampaign(false);
                    onStartNewCampaign();
                  }}>
                    新しいゲームを開始
                  </button>
                </div>
              </div>
            )}
            {message && <p className="campaign-title-message" role="status" aria-live="polite">{message}</p>}
          </section>

          <section className="campaign-title-card campaign-title-data-card" aria-labelledby="campaign-data-heading">
            <p className="eyebrow">SAVE DATA</p>
            <h2 id="campaign-data-heading">セーブデータ管理</h2>
            <p className="campaign-data-intro">セーブはこのブラウザ内に保存されます。別の端末へ移す場合はJSONを書き出してください。</p>
            <StorageDurabilityPanel />
            <div className="campaign-data-actions">
              <button className="campaign-secondary-button" type="button" disabled={!canExportSave} onClick={onExportSaveFile}>
                セーブを書き出す
              </button>
              <button className="campaign-secondary-button" type="button" disabled={isLoading || backupActionPending} onClick={() => importInput.current?.click()}>
                セーブファイルを読み込む
              </button>
              <input
                ref={importInput}
                className="save-file-input"
                data-testid="title-save-import-input"
                type="file"
                accept="application/json,.json"
                aria-label="読み込むセーブファイル"
                onChange={handleImportChange}
              />
            </div>

            <div className="campaign-backup-section">
              <div className="campaign-backup-heading">
                <h3>ローカルバックアップ</h3>
                <span>最大3世代</span>
              </div>
              <p>現在の自動セーブを別世代として保管できます。作成しても自動セーブは変更しません。</p>
              <button
                className="campaign-secondary-button"
                type="button"
                data-testid="title-create-save-backup"
                disabled={!canCreateBackup || backupActionPending || !backupListLoaded}
                onClick={onCreateBackup}
              >
                現在の自動セーブからバックアップを作成
              </button>
              {backups.length > 0 ? (
                <div className="campaign-backup-list" aria-label="保存済みバックアップ">
                  {backups.map((backup) => (
                    <div className="campaign-backup-item" key={backup.slotId} data-testid={"title-backup-entry-" + backup.slotId}>
                      <div>
                        <strong>第{backup.generation}世代 · {new Date(backup.savedAt).toLocaleString()}</strong>
                        <span>{backup.chapterTitle}（{backup.chapterId}）</span>
                      </div>
                      <button
                        className="campaign-secondary-button"
                        type="button"
                        data-testid={"title-restore-" + backup.slotId}
                        disabled={!backup.restorable || backupActionPending || isLoading}
                        onClick={() => onRestoreBackup(backup.slotId)}
                      >
                        第{backup.generation}世代を復元
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="campaign-backup-empty">{backupListLoaded ? "保存済みバックアップはありません。" : "バックアップを確認しています…"}</p>
              )}
            </div>
          </section>
        </div>

        <aside className="campaign-title-notice">
          <strong>現在の収録内容について</strong>
          <p>マップ・ユニット・武器・能力値は開発用の試作データを含みます。正式なキャンペーン内容とバランスは調整中です。</p>
          {!isInstalledApp && (
            <details className="pwa-install-help" data-testid="pwa-install-help">
              <summary>アプリとしてホーム画面に追加する方法</summary>
              <p>インストールに対応したブラウザでは「アプリをインストール」から追加できます。iPhone／iPadではSafariの共有メニューから「ホーム画面に追加」を選択してください。</p>
            </details>
          )}
        </aside>

        <footer className="campaign-title-footer">
          <span>Grid Tactics PWA</span>
          <span>ゲームデータはこのブラウザ内に保存されます。</span>
        </footer>
      </div>
    </main>
  );
}
