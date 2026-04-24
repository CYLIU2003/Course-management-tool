import type { AutoLoadDepartmentCSVResult, CSVResourceLoadResult } from "../../utils/autoLoadCSV";

type CSVLoadStatusPanelProps = {
  loading: boolean;
  result: AutoLoadDepartmentCSVResult | null;
  error?: string | null;
};

function labelForStatus(status: AutoLoadDepartmentCSVResult["status"] | "loading") {
  switch (status) {
    case "success":
      return "success";
    case "partial":
      return "partial";
    case "failed":
      return "failed";
    default:
      return "loading";
  }
}

function statusTextForStatus(status: AutoLoadDepartmentCSVResult["status"] | "loading") {
  switch (status) {
    case "success":
      return "成功";
    case "partial":
      return "一部完了";
    case "failed":
      return "失敗";
    default:
      return "読み込み中";
  }
}

function resourceKindLabel(kind: CSVResourceLoadResult["kind"]) {
  switch (kind) {
    case "requirements":
      return "卒業要件";
    case "timetable":
      return "科目マスタ";
    case "schedule":
      return "時間割CSV";
  }
}

function resourceStatusLabel(status: CSVResourceLoadResult["status"]) {
  switch (status) {
    case "loaded":
      return "読込完了";
    case "fallback-loaded":
      return "fallback読込";
    case "missing":
      return "未検出";
    case "failed":
      return "失敗";
    case "skipped":
      return "スキップ";
  }
}

export default function CSVLoadStatusPanel({ loading, result, error }: CSVLoadStatusPanelProps) {
  if (!loading && !result && !error) {
    return null;
  }

  const status = loading ? "loading" : labelForStatus(result?.status ?? (error ? "failed" : "loading"));
  const resources = result?.resources ?? [];
  const messages = result?.messages ?? (error ? [{ level: "error" as const, text: error }] : []);

  return (
    <section className={`tt-card csv-load-panel csv-load-panel--${status}`} aria-live="polite">
      <div className="csv-load-panel__head">
        <div>
          <h3>CSV読込ステータス</h3>
          <p className="small">
            {loading
              ? "CSVを読み込み中です。"
              : result
                ? `${result.departmentName} / ${result.entranceYear ?? "-"}年度の読込結果です。`
                : "CSV読込に失敗しました。"}
          </p>
        </div>
        <span className={`csv-load-panel__badge csv-load-panel__badge--${status}`}>
          {statusTextForStatus(status)}
        </span>
      </div>

      {result && (
        <div className="csv-load-panel__stats">
          <div>
            <span className="small">要件CSV</span>
            <strong>{result.stats.requirementRows}</strong>
          </div>
          <div>
            <span className="small">科目CSV</span>
            <strong>{result.stats.timetableRows}</strong>
          </div>
          <div>
            <span className="small">開講CSV</span>
            <strong>{result.stats.scheduleRows}</strong>
          </div>
          <div>
            <span className="small">同期済み科目</span>
            <strong>{result.stats.coursesWithOfferings}</strong>
          </div>
        </div>
      )}

      {messages.length > 0 && (
        <div className="csv-load-panel__messages">
          {messages.map((message, index) => (
            <p key={`${message.level}-${index}`} className={`csv-load-panel__message csv-load-panel__message--${message.level}`}>
              {message.text}
            </p>
          ))}
        </div>
      )}

      {resources.length > 0 && (
        <div className="csv-load-panel__resources">
          {resources.map((resource) => (
            <article key={`${resource.kind}-${resource.path ?? resource.attemptedPaths.join('|')}`} className={`csv-resource csv-resource--${resource.status}`}>
              <div className="csv-resource__head">
                <strong>{resourceKindLabel(resource.kind)}</strong>
                <span className={`csv-resource__badge csv-resource__badge--${resource.status}`}>
                  {resourceStatusLabel(resource.status)}
                </span>
              </div>
              <p className="small">{resource.message ?? "-"}</p>
              {resource.path && <p className="csv-resource__path">{resource.path}</p>}
              {resource.rowCount !== undefined && <p className="small">行数: {resource.rowCount}</p>}
              {resource.error && <p className="csv-resource__error">{resource.error}</p>}
              {resource.attemptedPaths.length > 1 && (
                <ul className="csv-resource__paths">
                  {resource.attemptedPaths.map((attemptedPath) => (
                    <li key={attemptedPath}>{attemptedPath}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}