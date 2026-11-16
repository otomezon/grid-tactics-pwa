function getErrorName(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("name" in error)) {
    return undefined;
  }

  const name = (error as { name?: unknown }).name;
  return typeof name === "string" ? name : undefined;
}

/**
 * Returns actionable guidance for browser storage errors. Other errors remain
 * available to the caller's existing generic error handling.
 */
export function getStorageOperationErrorMessage(error: unknown): string | undefined {
  switch (getErrorName(error)) {
    case "QuotaExceededError":
      return "ブラウザーの保存容量が不足しています。タイトル画面からセーブJSONを書き出して保管し、空き容量を確保してから再試行してください。";
    case "SecurityError":
      return "ブラウザーがこのサイトのローカル保存を制限しています。プライベートブラウズやサイトデータの制限を確認し、通常の閲覧モードで再試行してください。";
    case "SaveConflictError":
      return "別のタブで新しいセーブが保存されています。このタブからの上書きは停止しました。最新のセーブを読み込むため、ページを再読み込みしてください。";
    default:
      return undefined;
  }
}
