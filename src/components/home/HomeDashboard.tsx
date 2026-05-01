import AcademicOverview from '../AcademicOverview';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicDashboardSnapshot, AcademicTimetable, AcademicYear } from '../../core/types';

type HomeDashboardProps = {
  snapshot: AcademicDashboardSnapshot;
  curriculumName?: string;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  currentYear: AcademicYear;
  curriculum?: AcademicCurriculum;
  currentQuarter?: string;
  timetable?: AcademicTimetable;
  days?: string[];
  periods?: { id: number; label: string; time: string }[];
  onOpenTimetable: () => void;
  onOpenRequirements: () => void;
  onOpenGrades: () => void;
  onOpenSettingsPage: () => void;
};

export default function HomeDashboard({
  snapshot,
  curriculumName,
  allYearsData,
  courses,
  currentYear,
  curriculum,
  currentQuarter,
  timetable,
  days,
  periods,
  onOpenTimetable,
  onOpenRequirements,
  onOpenGrades,
  onOpenSettingsPage,
}: HomeDashboardProps) {
  const nextSteps = snapshot.warnings.slice(0, 3);

  return (
    <section className="home-dashboard">
      <section className="tt-card home-dashboard__hero">
        <div className="section-title">
          <div>
            <h2>まず確認すること</h2>
            <span className="small">卒業リスクと、次にやることを先に見ます。</span>
          </div>
          <span className="course-tag course-tag--neutral" style={{ fontWeight: 800 }}>
            {currentYear}
          </span>
        </div>

        <div className="home-dashboard__quick-actions">
          <button type="button" className="btn-primary" onClick={onOpenRequirements}>
            卒業要件を見る
          </button>
          <button type="button" className="btn-ghost" onClick={onOpenTimetable}>
            時間割を見る
          </button>
          <button type="button" className="btn-ghost" onClick={onOpenGrades}>
            成績を見る
          </button>
          <button type="button" className="btn-ghost" onClick={onOpenSettingsPage}>
            設定を開く
          </button>
        </div>

        <div className="home-dashboard__next-steps">
          <strong>次に確認すること</strong>
          {nextSteps.length > 0 ? (
            <ol>
              {nextSteps.map((warning) => (
                <li key={warning.id}>
                  <span>{warning.message}</span>
                  {warning.detail ? <small>{warning.detail}</small> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="small">現時点では大きな警告はありません。時間割と卒業要件を定期的に確認してください。</p>
          )}
        </div>
      </section>

      <AcademicOverview
        title="学生向けトップ"
        snapshot={snapshot}
        curriculumName={curriculumName}
        compact
        allYearsData={allYearsData}
        courses={courses}
        currentYear={currentYear}
        curriculum={curriculum}
        currentQuarter={currentQuarter}
        timetable={timetable}
        days={days}
        periods={periods}
      />
    </section>
  );
}
