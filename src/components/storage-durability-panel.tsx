import { useEffect, useState } from "react";
import {
  readStorageDurabilityStatus,
  readStorageUsageEstimate,
  requestStorageDurability,
  type StorageDurabilityStatus,
  type StorageUsageEstimateResult
} from "../persistence/storage-durability";

const STATUS_LABELS: Record<StorageDurabilityStatus | "checking", string> = {
  checking: "確認中",
  granted: "許可済み",
  "not-granted": "未許可",
  unsupported: "非対応",
  error: "状態を確認できません"
};

type StorageUsageViewState = StorageUsageEstimateResult | { status: "checking" };

function formatStorageBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const formatted = new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value);
  return formatted + " " + units[unitIndex];
}

function formatPercentage(value: number): string {
  return new Intl.NumberFormat("ja-JP", { maximumFractionDigits: 1 }).format(value) + "%";
}

export function StorageDurabilityPanel() {
  const [status, setStatus] = useState<StorageDurabilityStatus | "checking">("checking");
  const [requestPending, setRequestPending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [usageEstimate, setUsageEstimate] = useState<StorageUsageViewState>({ status: "checking" });
  const [usageRefreshPending, setUsageRefreshPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      readStorageDurabilityStatus(),
      readStorageUsageEstimate()
    ]).then(([nextStatus, nextEstimate]) => {
      if (cancelled) return;
      setStatus(nextStatus);
      setUsageEstimate(nextEstimate);
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

  async function handleRefreshUsage(): Promise<void> {
    if (usageRefreshPending) return;
    setUsageRefreshPending(true);
    try {
      setUsageEstimate(await readStorageUsageEstimate());
    } finally {
      setUsageRefreshPending(false);
    }
  }

  const usagePercent = usageEstimate.status === "available"
    ? usageEstimate.usageBytes / usageEstimate.quotaBytes * 100
    : null;
  const usageBarPercent = usagePercent === null ? 0 : Math.min(100, Math.max(0, usagePercent));

  return (
    <section className="campaign-storage-durability" data-testid="storage-durability-panel" aria-labelledby="storage-durability-heading">
      <div className="campaign-storage-durability-heading">
        <h3 id="storage-durability-heading">ブラウザのセーブ保持</h3>
        <span data-testid="storage-durability-status">{STATUS_LABELS[status]}</span>
      </div>
      <div className="campaign-storage-usage" data-testid="storage-usage">
        <div className="campaign-storage-usage-heading">
          <h4>サイトのストレージ使用量（概算）</h4>
          {usagePercent !== null && <strong>{formatPercentage(usagePercent)}</strong>}
        </div>
        {usageEstimate.status === "available" ? (
          <>
            <p data-testid="storage-usage-summary">
              推定使用量 {formatStorageBytes(usageEstimate.usageBytes)} / 推定上限 {formatStorageBytes(usageEstimate.quotaBytes)}
            </p>
            <div
              className="campaign-storage-usage-meter"
              role="progressbar"
              aria-label="サイトのストレージ使用率"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(usageBarPercent * 10) / 10}
              aria-valuetext={formatPercentage(usagePercent)}
            >
              <span style={{ width: usageBarPercent + "%" }} />
            </div>
          </>
        ) : usageEstimate.status === "checking" ? (
          <p data-testid="storage-usage-summary" role="status">使用量を確認しています…</p>
        ) : usageEstimate.status === "unsupported" ? (
          <p data-testid="storage-usage-summary">このブラウザではストレージ使用量を取得できません。</p>
        ) : (
          <p data-testid="storage-usage-summary" role="status">ストレージ使用量を取得できませんでした。再度確認してください。</p>
        )}
        <p className="campaign-storage-usage-note">
          ブラウザが報告するサイト全体の概算です。IndexedDB以外のキャッシュ等を含む場合があり、端末の空き容量や実際に利用できる残量を示すものではありません。
        </p>
        {usageEstimate.status !== "unsupported" && (
          <button
            className="campaign-secondary-button"
            type="button"
            data-testid="refresh-storage-usage"
            disabled={usageRefreshPending || usageEstimate.status === "checking"}
            onClick={() => void handleRefreshUsage()}
          >
            {usageRefreshPending ? "更新中…" : "利用量を更新"}
          </button>
        )}
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
