import type { AutoLoadDepartmentCSVResult } from '../../utils/autoLoadCSV';

type CsvDiagnosticsPanelProps = {
  result: AutoLoadDepartmentCSVResult | null;
};

function formatCount(value: number | undefined) {
  return `${value ?? 0}件`;
}

export default function CsvDiagnosticsPanel({ result }: CsvDiagnosticsPanelProps) {
  if (!result) {
    return null;
  }

  const { stats, resources, messages, status } = result;

  return (
    <section className="tt-card csv-diagnostics-panel" style={{ marginTop: '1rem' }}>
      <div className="section-title">
        <div>
          <h2>CSV診断</h2>
          <span className="small">読込結果、マージ統計、未結合や不明区分を確認できます。</span>
        </div>
        <span className={`course-tag ${status === 'failed' ? 'course-tag--accent' : 'course-tag--neutral'}`} style={{ fontWeight: 800 }}>
          {status === 'success' ? '正常' : status === 'partial' ? '注意' : '失敗'}
        </span>
      </div>

      <div className="settings-page__summary">
        <div className="stats-card">
          <div className="stats-label">卒業要件CSV</div>
          <div className="stats-value">{formatCount(stats.requirementRows)}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>要件行数</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">科目CSV</div>
          <div className="stats-value">{formatCount(stats.timetableRows)}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>科目行数 / 区分未確認 {formatCount(stats.unknownCourseTypes)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">時間割CSV</div>
          <div className="stats-value">{formatCount(stats.scheduleRows)}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>開講数 {formatCount(stats.offerings)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">結合結果</div>
          <div className="stats-value">{formatCount(stats.mergedCourses)}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>講義コード一致 {formatCount(stats.matchedByLectureCode)} / 曖昧 {formatCount(stats.ambiguousMatches)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.9rem', marginTop: '1rem' }}>
        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.98rem' }}>結合統計</h3>
          <div className="small" style={{ color: 'var(--muted)' }}>
            講義コード {formatCount(stats.matchedByLectureCode)} / 科目ID {formatCount(stats.matchedByCourseId)} / タイトル {formatCount(stats.matchedByTitle)} / 曖昧 {formatCount(stats.ambiguousMatches)} / 未結合開講 {formatCount(stats.unmatchedOfferings)} / 未結合科目 {formatCount(stats.unmatchedCourseRows)}
          </div>
        </div>

        <div>
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.98rem' }}>読み込みファイル</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {resources.map((resource) => (
              <div
                key={`${resource.kind}:${resource.path ?? resource.attemptedPaths[0] ?? resource.message ?? ''}`}
                style={{
                  border: '1px solid var(--stroke)',
                  borderRadius: '12px',
                  padding: '0.75rem 0.9rem',
                  background: 'var(--card)',
                  display: 'grid',
                  gap: '0.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <strong>{resource.kind}</strong>
                  <span className="small" style={{ color: 'var(--muted)' }}>{resource.status}</span>
                </div>
                <div className="small" style={{ color: 'var(--muted)' }}>
                  {resource.path ?? resource.attemptedPaths[0] ?? 'pathなし'}
                </div>
                {resource.message ? <div className="small">{resource.message}</div> : null}
                {resource.error ? <div className="small" style={{ color: 'var(--danger)' }}>{resource.error}</div> : null}
              </div>
            ))}
          </div>
        </div>

        {messages.length > 0 && (
          <div>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.98rem' }}>診断メッセージ</h3>
            <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'grid', gap: '0.35rem' }}>
              {messages.map((message, index) => (
                <li key={`${message.level}-${index}`} className="small" style={{ color: message.level === 'error' ? 'var(--danger)' : message.level === 'warning' ? 'var(--warning)' : 'var(--text)' }}>
                  {message.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
