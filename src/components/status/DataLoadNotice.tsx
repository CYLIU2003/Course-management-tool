export type DataLoadNoticeProps = {
  status?: "idle" | "loading" | "ready" | "partial" | "failed";
  message?: string | null;
  onRetry?: () => void;
};

export function DataLoadNotice({ status = "idle", message, onRetry }: DataLoadNoticeProps) {
  if (status === "idle" || status === "ready") {
    return null;
  }

  if (status === "loading") {
    return (
      <div className="data-load-notice is-loading" aria-live="polite">
        科目データを読み込み中です...
      </div>
    );
  }

  if (status === "partial") {
    return (
      <div className="data-load-notice is-partial" aria-live="polite">
        一部の時間割情報が未読込です。科目一覧と卒業要件は利用できます。
      </div>
    );
  }

  return (
    <div className="data-load-notice is-failed" aria-live="polite">
      <span>{message || "科目データの読み込みに失敗しました。"}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          再読み込み
        </button>
      )}
    </div>
  );
}