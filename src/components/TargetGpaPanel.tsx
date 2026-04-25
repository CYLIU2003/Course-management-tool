import { useMemo, useState } from 'react';
import type { AcademicDashboardSnapshot } from '../utils/academicProgress';
import { calculateTargetGpaPlan } from '../utils/targetGpa';

type TargetGpaPanelProps = {
  snapshot: AcademicDashboardSnapshot;
  defaultFutureCredits?: number;
};

export default function TargetGpaPanel({ snapshot, defaultFutureCredits = 0 }: TargetGpaPanelProps) {
  const [targetGpa, setTargetGpa] = useState('3.00');
  const [futureCredits, setFutureCredits] = useState(String(defaultFutureCredits));

  const plan = useMemo(() => {
    const parsedTarget = Number(targetGpa);
    const parsedFuture = Number(futureCredits);
    return calculateTargetGpaPlan(snapshot.gpa, parsedTarget, parsedFuture);
  }, [futureCredits, snapshot.gpa, targetGpa]);

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>目標GPA逆算</h2>
          <span className="small">目標達成に必要な平均GPを逆算します</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          {plan.isAchievable ? '達成可' : '要見直し'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.85rem',
          marginBottom: '1rem',
        }}
      >
        <label className="settings-field">
          <span>目標GPA</span>
          <input type="number" min="0" max="4" step="0.01" value={targetGpa} onChange={(e) => setTargetGpa(e.target.value)} />
        </label>
        <label className="settings-field">
          <span>今後の履修単位</span>
          <input type="number" min="0" step="1" value={futureCredits} onChange={(e) => setFutureCredits(e.target.value)} />
        </label>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.85rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">必要平均GP</div>
          <div className="stats-value">{Number.isFinite(plan.requiredAverageGradePoint) ? plan.requiredAverageGradePoint.toFixed(2) : '0.00'}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">現在GPA</div>
          <div className="stats-value">{plan.currentGpa.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">GPA対象単位</div>
          <div className="stats-value">{plan.currentGpaCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">達成可能性</div>
          <div className={`stats-value ${plan.isAchievable ? 'stats-complete' : ''}`}>{plan.isAchievable ? '達成可' : '達成困難'}</div>
        </div>
      </div>

      <div style={{ marginTop: '0.9rem', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid var(--stroke)', background: 'var(--card)' }}>
        {plan.message}
      </div>
    </section>
  );
}