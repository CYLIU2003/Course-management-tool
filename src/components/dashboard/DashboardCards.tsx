import type { AcademicDashboardSnapshot } from '../../utils/academicProgress';
import ProgressRing from './ProgressRing';
import RequirementCard from './RequirementCard';

type DashboardCardsProps = {
  snapshot: AcademicDashboardSnapshot;
  curriculumName?: string;
};

function formatGpa(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : '0.00';
}

export default function DashboardCards({ snapshot, curriculumName }: DashboardCardsProps) {
  const requiredProgress = snapshot.progress.find((item) => item.key === 'required');
  const electiveRequiredProgress = snapshot.progress.find((item) => item.key === 'elective-required');
  const totalWarningCount = snapshot.warnings.filter((warning) => warning.level !== 'info').length;

  return (
    <section className="dashboard-strip">
      <div className="section-title section-title--dashboard">
        <h2>進捗ダッシュボード</h2>
        <span className="small">{curriculumName ?? '卒業要件の集計結果'}</span>
      </div>

      <div className="dashboard-grid">
        <article className="dashboard-card dashboard-card--highlight">
          <div className="dashboard-card__header">
            <div>
              <p className="dashboard-card__label">総取得単位</p>
              <h3 className="dashboard-card__value">{snapshot.earnedCredits} / {snapshot.requiredCredits}</h3>
            </div>
            <ProgressRing value={snapshot.completionRate * 100} label={`${Math.min(100, snapshot.completionRate * 100).toFixed(0)}%`} />
          </div>
          <p className="dashboard-card__note">
            あと {Math.max(0, snapshot.requiredCredits - snapshot.earnedCredits)} 単位
          </p>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card__label">GPA</p>
          <h3 className="dashboard-card__value">{formatGpa(snapshot.gpa.currentGpa)}</h3>
          <p className="dashboard-card__note">評価済み {snapshot.gpa.currentGradedCredits} 単位</p>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card__label">必修</p>
          <h3 className="dashboard-card__value">{requiredProgress ? `${requiredProgress.earnedCredits} / ${requiredProgress.requiredCredits}` : '0 / 0'}</h3>
          <p className="dashboard-card__note">あと {requiredProgress?.remainingCredits ?? 0} 単位</p>
        </article>

        <article className="dashboard-card">
          <p className="dashboard-card__label">選択必修</p>
          <h3 className="dashboard-card__value">{electiveRequiredProgress ? `${electiveRequiredProgress.earnedCredits} / ${electiveRequiredProgress.requiredCredits}` : '0 / 0'}</h3>
          <p className="dashboard-card__note">あと {electiveRequiredProgress?.remainingCredits ?? 0} 単位</p>
        </article>

        <article className="dashboard-card dashboard-card--warning">
          <p className="dashboard-card__label">警告</p>
          <h3 className="dashboard-card__value">{totalWarningCount}</h3>
          <p className="dashboard-card__note">注意が必要な項目</p>
        </article>
      </div>

      <div className="dashboard-card-grid">
        {snapshot.progress.map((item) => (
          <RequirementCard key={item.key} item={item} />
        ))}
      </div>
    </section>
  );
}