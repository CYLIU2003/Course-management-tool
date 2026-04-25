import type { AcademicAllYearsData, AcademicDashboardSnapshot } from '../utils/academicProgress';
import { calculateGpaSummary } from '../utils/gpa';

type GpaSummaryPanelProps = {
  snapshot: AcademicDashboardSnapshot;
  allYearsData: AcademicAllYearsData;
};

export default function GpaSummaryPanel({ snapshot, allYearsData }: GpaSummaryPanelProps) {
  const summary = calculateGpaSummary(allYearsData, snapshot);

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>成績入力とGPA換算</h2>
          <span className="small">時間割セルの成績から自動集計します</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          GPA {summary.currentGpa.toFixed(2)}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">現在GPA</div>
          <div className="stats-value">{summary.currentGpa.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">取得単位</div>
          <div className="stats-value">{summary.earnedCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">不可単位</div>
          <div className="stats-value">{summary.failedCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">未評価科目</div>
          <div className="stats-value">{summary.ungradedCount} 科目</div>
        </div>
      </div>

      <div style={{ marginTop: '0.9rem', display: 'grid', gap: '0.45rem' }}>
        <div className="small" style={{ color: 'var(--muted)' }}>
          GPA対象単位 {summary.gradedCredits} 単位 / 登録単位 {summary.registeredCredits} 単位
        </div>
        <div className="small" style={{ color: 'var(--muted)' }}>
          成績は「秀・優・良・可」を取得単位として扱い、「不可」はGPA計算に含めます。
        </div>
      </div>
    </section>
  );
}