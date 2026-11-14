import { useEffect, useState } from "react";
import {
  readStorageDurabilityStatus,
  requestStorageDurability,
  type StorageDurabilityStatus
} from "../persistence/storage-durability";

const STATUS_LABELS: Record<StorageDurabilityStatus | "checking", string> = {
  checking: "確認中",
  granted: "許可済み",
  "not-granted": "未許可",
  unsupported: "非対応",
  error: "状態を確認できません"
};

export function StorageDurabilityPanel() {
  const [status, setStatus] = useState<StorageDurabilityStatus | "checking">("checking");
  const [requestPending, setRequestPending] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let cancelled = false;
    void readStorageDurabilityStatus().then((nextStatus) => {
      if (!cancelled) setStatus(nextStatus);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRequest(): Promise<void> {
    if (requestPending) return;
    setRequestPending(true);
    setFeedback("");
    const nextStatus = await requestStorageDurability();
    setStatus(nextStatus);
    setFeedback(nextStatus === "granted"
      ? "このブラウザで永続ストレージが許可されました。"
      : nextStatus === "not-granted"
        ? "ブラウザは永続ストレージを許可しませんでした。JSON書き出しやバックアップを続けて利用してください。"
        : nextStatus === "unsupported"
          ? "このブラウザでは永続ストレージを要求できません。JSON書き出しやバックアップを利用してください。"
          : "ブラウザから許可結果を取得できませんでした。JSON書き出しやバックアップを利用してください。");
    setRequestPending(false);
  }

  return (
    <section className="campaign-storage-durability" data-testid="storage-durability-panel" aria-labelledby="storage-durability-heading">
      <div className="campaign-storage-durability-heading">
        <h3 id="storage-durability-heading">ブラウザのセーブ保持</h3>
        <span data-testid="storage-durability-status">{STATUS_LABELS[status]}</span>
      </div>
      <p>対応ブラウザでは、サイトデータが自動的な容量整理の対象になりにくくなるよう、永続ストレージを要求できます。</p>
      {(status === "not-granted" || status === "error") && (
        <button
          className="campaign-secondary-button"
          type="button"
          data-testid="request-storage-durability"
          disabled={requestPending}
          onClick={() => void handleRequest()}
        >
          {requestPending ? "確認しています…" : "永続ストレージを要求する"}
        </button>
      )}
      {feedback && <p className="campaign-storage-durability-feedback" role="status" aria-live="polite">{feedback}</p>}
      <p className="campaign-storage-durability-note">許可されても、端末故障・ブラウザデータの消去・利用者による削除からセーブを保護するものではありません。大切な進行はJSON書き出しやローカルバックアップでも保管してください。</p>
    </section>
  );
}
