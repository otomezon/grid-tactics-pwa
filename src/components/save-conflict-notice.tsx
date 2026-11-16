export function SaveConflictNotice() {
  return (
    <section className="campaign-title-warning save-conflict-notice" role="alert" data-testid="save-conflict-notice">
      <strong>このタブが読み込んだ後にセーブデータが変更されました</strong>
      <p>このタブからの保存は停止しました。現在の画面にだけ残る未保存の操作は保存されていません。最新のセーブ状態へ戻って続けてください。</p>
      <button
        className="campaign-secondary-button"
        type="button"
        onClick={() => window.location.reload()}
      >
        最新のセーブを再読み込み
      </button>
    </section>
  );
}
