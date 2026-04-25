import type { AcademicAllYearsData, AcademicDashboardSnapshot } from '../utils/academicProgress';
import { calculateCreditCompletionRate } from '../utils/creditStats';

type CreditCompletionPanelProps = {
  snapshot: AcademicDashboardSnapshot;
  allYearsData: AcademicAllYearsData;
};

export default function CreditCompletionPanel({ snapshot, allYearsData }: CreditCompletionPanelProps) {
  const completion = calculateCreditCompletionRate(allYearsData, snapshot.gpa);

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>単位取得率</h2>
          <span className="small">履修登録単位に対する取得状況です</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          {completion.completionRate.toFixed(1)}%
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">履修登録</div>
          <div className="stats-value">{completion.registeredCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">取得済み</div>
          <div className="stats-value">{completion.earnedCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">不可</div>
          <div className="stats-value">{completion.failedCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">取得率</div>
          <div className="stats-value">{completion.completionRate.toFixed(1)}%</div>
        </div>
      </div>
    </section>
  );
}