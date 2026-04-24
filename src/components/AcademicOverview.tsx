import { useMemo } from 'react';
import type { AcademicAllYearsData, AcademicCourse, AcademicDashboardSnapshot, AcademicYear } from '../utils/academicProgress';
import { calculateGraduationRisk } from '../utils/graduationRisk';
import { recommendCourses } from '../utils/courseRecommendation';
import GraduationRiskPanel from './GraduationRiskPanel';
import CourseRecommendationPanel from './CourseRecommendationPanel';

interface AcademicOverviewProps {
  snapshot: AcademicDashboardSnapshot;
  title?: string;
  curriculumName?: string;
  compact?: boolean;
  allYearsData?: AcademicAllYearsData;
  courses?: AcademicCourse[];
  currentYear?: AcademicYear;
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
}: AcademicOverviewProps) {
  const visibleWarnings = compact ? snapshot.warnings.slice(0, 3) : snapshot.warnings;
  const graduationRisk = useMemo(
    () => (allYearsData ? calculateGraduationRisk(snapshot, allYearsData) : null),
    [allYearsData, snapshot],
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

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">取得単位数</div>
          <div className="stats-value">{snapshot.earnedCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">必要単位数</div>
          <div className="stats-value">{snapshot.requiredCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">残り必要単位数</div>
          <div className={`stats-value ${snapshot.requiredCredits - snapshot.earnedCredits <= 0 ? 'stats-complete' : ''}`}>
            {snapshot.requiredCredits - snapshot.earnedCredits > 0
              ? `${snapshot.requiredCredits - snapshot.earnedCredits} 単位`
              : '達成！'}
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">現在GPA</div>
          <div className="stats-value">{snapshot.gpa.currentGpa.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">進捗率</div>
          <div className="stats-value">{Math.min(100, snapshot.completionRate * 100).toFixed(1)}%</div>
        </div>
      </div>

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
