import { useMemo } from 'react';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicDashboardSnapshot, AcademicTimetable, AcademicYear } from '../core/types';
import { calculateGraduationRisk } from '../core/graduation';
import { recommendCourses } from '../core/courses';
import { calculateTargetGpaPlan } from '../utils/targetGpa';
import GraduationRiskPanel from './GraduationRiskPanel';
import CourseRecommendationPanel from './CourseRecommendationPanel';

type OverviewPeriod = {
  id: number;
  label: string;
  time: string;
};

type TimetableSummary = {
  occupiedSlots: number;
  totalSlots: number;
  freeSlots: number;
  busiestDays: Array<{ day: string; usedSlots: number }>;
};

function summarizeTimetable(
  timetable: AcademicTimetable | undefined,
  currentQuarter: string | undefined,
  days: string[] = [],
  periods: OverviewPeriod[] = [],
): TimetableSummary | null {
  if (!timetable || !currentQuarter || days.length === 0 || periods.length === 0) {
    return null;
  }

  const quarterTimetable = timetable[currentQuarter as keyof AcademicTimetable];
  if (!quarterTimetable) {
    return null;
  }

  let occupiedSlots = 0;
  const busyDays = days.map((day) => {
    const dayData = quarterTimetable[day as keyof typeof quarterTimetable] ?? {};
    const usedSlots = periods.reduce((count, period) => {
      const cell = dayData[String(period.id) as keyof typeof dayData];
      return count + (cell && cell.title ? 1 : 0);
    }, 0);

    occupiedSlots += usedSlots;
    return { day, usedSlots };
  });

  const totalSlots = days.length * periods.length;

  return {
    occupiedSlots,
    totalSlots,
    freeSlots: Math.max(0, totalSlots - occupiedSlots),
    busiestDays: busyDays
      .filter((item) => item.usedSlots > 0)
      .sort((left, right) => right.usedSlots - left.usedSlots)
      .slice(0, 3),
  };
}

interface AcademicOverviewProps {
  snapshot: AcademicDashboardSnapshot;
  title?: string;
  curriculumName?: string;
  compact?: boolean;
  allYearsData?: AcademicAllYearsData;
  courses?: AcademicCourse[];
  currentYear?: AcademicYear;
  curriculum?: AcademicCurriculum;
  currentQuarter?: string;
  timetable?: AcademicTimetable;
  days?: string[];
  periods?: OverviewPeriod[];
  onOpenRequirements?: () => void;
  onOpenCourses?: () => void;
  onOpenGpa?: () => void;
  onOpenCalendar?: () => void;
  showActions?: boolean;
}

const WARNING_STYLES = {
  info: {
    background: 'color-mix(in oklab, #3b82f6 10%, var(--card) 90%)',
    border: 'color-mix(in oklab, #3b82f6 28%, var(--stroke) 72%)',
    accent: '#2563eb',
  },
  warning: {
    background: 'color-mix(in oklab, #f59e0b 10%, var(--card) 90%)',
    border: 'color-mix(in oklab, #f59e0b 28%, var(--stroke) 72%)',
    accent: '#b45309',
  },
  danger: {
    background: 'color-mix(in oklab, #ef4444 10%, var(--card) 90%)',
    border: 'color-mix(in oklab, #ef4444 28%, var(--stroke) 72%)',
    accent: '#b91c1c',
  },
} as const;

export default function AcademicOverview({
  snapshot,
  title = '履修状況ダッシュボード',
  curriculumName,
  compact = false,
  allYearsData,
  courses,
  currentYear,
  curriculum,
  currentQuarter,
  timetable,
  days,
  periods,
  onOpenRequirements,
  onOpenCourses,
  onOpenGpa,
  onOpenCalendar,
  showActions = false,
}: AcademicOverviewProps) {
  const visibleWarnings = compact ? snapshot.warnings.slice(0, 3) : snapshot.warnings;
  const graduationRisk = useMemo(
    () => (allYearsData ? calculateGraduationRisk(snapshot, allYearsData, courses ?? [], curriculum) : null),
    [allYearsData, courses, curriculum, snapshot],
  );
  const targetGpaPlan = useMemo(
    () => calculateTargetGpaPlan(snapshot.gpa, 3.0, Math.max(0, snapshot.requiredCredits - snapshot.earnedCredits)),
    [snapshot.earnedCredits, snapshot.gpa, snapshot.requiredCredits],
  );
  const timetableSummary = useMemo(
    () => summarizeTimetable(timetable, currentQuarter, days, periods),
    [currentQuarter, days, periods, timetable],
  );
  const recommendations = useMemo(
    () => {
      if (!allYearsData || !courses) {
        return [];
      }

      return recommendCourses({
        courses,
        snapshot,
        allYearsData,
        currentYear,
        limit: compact ? 3 : 5,
      });
    },
    [allYearsData, compact, courses, currentYear, snapshot],
  );

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <h2>{title}</h2>
        <span className="small">
          {curriculumName ?? '卒業要件の集計結果'}
        </span>
      </div>

      {!curriculum || snapshot.requiredCredits === 0 ? (
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            border: '1px solid color-mix(in oklab, #f59e0b 30%, var(--stroke) 70%)',
            background: 'color-mix(in oklab, #f59e0b 10%, var(--card) 90%)',
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          卒業要件CSVが未読込です。卒業判定と不足単位の表示は、要件CSVを読み込むと有効になります。
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">卒業危険度</div>
          <div className={`stats-value ${graduationRisk?.overallRiskLevel === 'danger' ? 'stats-danger' : graduationRisk?.overallRiskLevel === 'warning' ? '' : 'stats-complete'}`}>
            {graduationRisk?.overallLabel ?? '未判定'}
          </div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            {graduationRisk?.overallMessage ?? '卒業要件の判定結果がありません。'}
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">不足単位</div>
          <div className={`stats-value ${snapshot.requiredCredits - snapshot.earnedCredits <= 0 ? 'stats-complete' : ''}`}>
            {snapshot.requiredCredits - snapshot.earnedCredits > 0
              ? `${snapshot.requiredCredits - snapshot.earnedCredits} 単位`
              : '達成！'}
          </div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            必修未修得 {graduationRisk?.requiredMissingCredits ?? 0} 単位
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">今期の履修候補</div>
          <div className="stats-value">{recommendations.length} 件</div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            {recommendations[0]?.course.title ?? '候補を集計中'}
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">GPA</div>
          <div className="stats-value">{snapshot.gpa.currentGpa.toFixed(2)}</div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            目標3.00なら平均GP {Number.isFinite(targetGpaPlan.requiredAverageGradePoint) ? targetGpaPlan.requiredAverageGradePoint.toFixed(2) : '0.00'} 必要
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">時間割</div>
          <div className="stats-value">
            {timetableSummary ? `${timetableSummary.occupiedSlots} / ${timetableSummary.totalSlots}` : '未集計'}
          </div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            {timetableSummary
              ? `空き ${timetableSummary.freeSlots} コマ / 最重 ${timetableSummary.busiestDays[0]?.day ?? '未定'} ${timetableSummary.busiestDays[0]?.usedSlots ?? 0} コマ`
              : '今期のQを選ぶと負荷を見られます。'}
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">進捗率</div>
          <div className="stats-value">{Math.min(100, snapshot.completionRate * 100).toFixed(1)}%</div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            取得 {snapshot.earnedCredits} 単位 / 必要 {snapshot.requiredCredits} 単位
          </div>
        </div>
      </div>

      {showActions && (
        <div
          style={{
            marginTop: '1rem',
            padding: '0.95rem 1rem',
            borderRadius: '14px',
            border: '1px solid var(--stroke)',
            background: 'color-mix(in oklab, var(--card) 96%, transparent)',
            display: 'grid',
            gap: '0.75rem',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.98rem' }}>次のアクション</h3>
            <p className="small" style={{ margin: '0.25rem 0 0', color: 'var(--muted)' }}>
              いま必要な作業へそのまま移動できます。
            </p>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
            <button type="button" className="btn-primary" onClick={onOpenRequirements} disabled={!onOpenRequirements}>
              不足している必修を見る
            </button>
            <button type="button" className="btn-ghost" onClick={onOpenCourses} disabled={!onOpenCourses}>
              履修候補を探す
            </button>
            <button type="button" className="btn-ghost" onClick={onOpenGpa} disabled={!onOpenGpa}>
              GPAを予測する
            </button>
            <button type="button" className="btn-ghost" onClick={onOpenCalendar} disabled={!onOpenCalendar}>
              カレンダーに出力する
            </button>
          </div>
          <div className="small" style={{ color: 'var(--muted)' }}>
            バックアップや共有は右上のデータメニューから行えます。
          </div>
        </div>
      )}

      {graduationRisk && (
        <GraduationRiskPanel risk={graduationRisk} compact={compact} />
      )}

      {allYearsData && courses && (
        <CourseRecommendationPanel recommendations={recommendations} compact={compact} />
      )}

      {!compact && snapshot.progress.some((item) => item.key !== 'total') && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid var(--stroke)', paddingTop: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
            区分別の進捗
          </h3>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {snapshot.progress.map((item) => (
              <div
                key={item.key}
                style={{
                  border: '1px solid var(--stroke)',
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  background: 'var(--card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                    {item.earnedCredits} / {item.requiredCredits} 単位
                  </div>
                </div>
                <div style={{ height: '10px', borderRadius: '999px', background: 'var(--stroke)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, item.completionRate * 100)}%`,
                      height: '100%',
                      borderRadius: '999px',
                      background: 'linear-gradient(135deg, var(--brand), var(--brand2))',
                    }}
                  />
                </div>
                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                  残り {item.remainingCredits} 単位
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1rem', borderTop: '1px solid var(--stroke)', paddingTop: '1rem' }}>
        <h3 style={{ fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--text)' }}>
          注意・確認事項
        </h3>
        {visibleWarnings.length === 0 ? (
          <div
            style={{
              padding: '0.9rem 1rem',
              borderRadius: '12px',
              border: '1px solid color-mix(in oklab, #10b981 24%, var(--stroke) 76%)',
              background: 'color-mix(in oklab, #10b981 10%, var(--card) 90%)',
              color: 'var(--text)',
            }}
          >
            現時点で大きな警告はありません。
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {visibleWarnings.map((warning) => {
              const style = WARNING_STYLES[warning.level];
              return (
                <div
                  key={warning.id}
                  style={{
                    border: `1px solid ${style.border}`,
                    borderRadius: '12px',
                    background: style.background,
                    padding: '0.9rem 1rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: style.accent, marginBottom: warning.detail ? '0.25rem' : 0 }}>
                    {warning.message}
                  </div>
                  {warning.detail && (
                    <div style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{warning.detail}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
