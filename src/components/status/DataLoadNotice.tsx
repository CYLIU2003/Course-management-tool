export type DataLoadNoticeProps = {
  status?: "idle" | "loading" | "ready" | "partial" | "failed" | "unavailable";
  message?: string | null;
  details?: string[];
  onRetry?: () => void;
};

export function DataLoadNotice({ status = "idle", message, details = [], onRetry }: DataLoadNoticeProps) {
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

  if (status === "partial" || status === "unavailable") {
    return (
      <div className="data-load-notice is-partial" aria-live="polite">
        {message || (status === 'unavailable' ? 'この学科・入学年度に対応する履修情報はありません。' : '科目一覧には未確認の項目があります。必選・必要単位は学修要覧で確認してください。')}
        {details.length > 0 && (
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
            {details.map((detail) => (
              <li key={detail} style={{ marginTop: '0.2rem' }}>
                {detail}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="data-load-notice is-failed" aria-live="polite">
      <span>{message || "科目データの読み込みに失敗しました。"}</span>
      {details.length > 0 && (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.2rem' }}>
          {details.map((detail) => (
            <li key={detail} style={{ marginTop: '0.2rem' }}>
              {detail}
            </li>
          ))}
        </ul>
      )}
      {onRetry && (
        <button type="button" onClick={onRetry}>
          再読み込み
        </button>
      )}
    </div>
  );
}
