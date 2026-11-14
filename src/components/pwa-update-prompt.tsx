import { createContext, useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

type UpdateListener = () => void;
let updateIsWaiting = false;
const updateListeners = new Set<UpdateListener>();

// Register once at module load, outside React StrictMode's effect lifecycle.
const updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh: () => {
    updateIsWaiting = true;
    updateListeners.forEach((listener) => listener());
  }
});

function subscribeToUpdate(listener: UpdateListener): () => void {
  updateListeners.add(listener);
  if (updateIsWaiting) listener();
  return () => updateListeners.delete(listener);
}

export const PwaUpdateSafetyContext = createContext<(canApplyUpdate: boolean) => void>(
  () => undefined
);

interface PwaUpdatePromptProps {
  canApplyUpdate: boolean;
}

export function PwaUpdatePrompt({ canApplyUpdate }: PwaUpdatePromptProps) {
  const [needsRefresh, setNeedsRefresh] = useState(updateIsWaiting);
  const [dismissed, setDismissed] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState(false);

  useEffect(() => subscribeToUpdate(() => {
    setNeedsRefresh(true);
    setDismissed(false);
  }), []);

  useEffect(() => {
    if (canApplyUpdate) setDismissed(false);
  }, [canApplyUpdate]);

  function handleApplyUpdate(): void {
    if (!canApplyUpdate || isApplying) return;
    setIsApplying(true);
    setApplyError(false);
    void updateServiceWorker(true).catch(() => {
      setIsApplying(false);
      setApplyError(true);
    });
  }

  if (!needsRefresh || dismissed) return null;

  return (
    <section className="pwa-update-prompt" role="region" aria-label="アプリの更新"
      aria-live="polite" data-testid="pwa-update-prompt">
      <div className="pwa-update-prompt-copy">
        <p className="eyebrow">PWA UPDATE</p>
        <h2>新しいバージョンがあります</h2>
        {canApplyUpdate ? (
          <p>現在のセーブが保存済みです。更新を適用すると画面を再読み込みします。</p>
        ) : (
          <p>プレイ中の状態を守るため更新を保留しています。タイトル画面または保存済みの勝敗結果に移ると適用できます。</p>
        )}
        {applyError && <p className="pwa-update-error" role="alert">更新を適用できませんでした。通信状態を確認して、もう一度お試しください。</p>}
      </div>
      <div className="pwa-update-prompt-actions">
        <button className="primary-button" type="button" data-testid="pwa-update-apply"
          disabled={!canApplyUpdate || isApplying} onClick={handleApplyUpdate}>
          {isApplying ? "更新を適用中…" : "更新して再読み込み"}
        </button>
        <button className="secondary-button" type="button" data-testid="pwa-update-dismiss"
          disabled={isApplying} onClick={() => setDismissed(true)}>
          あとで
        </button>
      </div>
    </section>
  );
}
