import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum } from '../utils/academicProgress';
import { calculateGraduationRequirements } from '../utils/graduationRequirements';

type GraduationRequirementPanelProps = {
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
};

const STATUS_STYLES = {
  satisfied: {
    border: 'color-mix(in oklab, var(--primary) 22%, var(--border-soft) 78%)',
    background: 'color-mix(in oklab, var(--primary-soft) 72%, var(--surface) 28%)',
    accent: 'var(--primary-strong)',
  },
  warning: {
    border: 'color-mix(in oklab, var(--warning) 24%, var(--border-soft) 76%)',
    background: 'color-mix(in oklab, var(--warning-soft) 72%, var(--surface) 28%)',
    accent: 'var(--warning)',
  },
  danger: {
    border: 'color-mix(in oklab, var(--danger) 24%, var(--border-soft) 76%)',
    background: 'color-mix(in oklab, var(--danger-soft) 72%, var(--surface) 28%)',
    accent: 'var(--danger)',
  },
} as const;

function getBadgeTone(missingCredits: number, earnedCredits: number, requiredCredits: number, plannedCredits: number) {
  if (missingCredits <= 0 && earnedCredits >= requiredCredits) {
    return 'satisfied' as const;
  }

  if (missingCredits <= 0 && plannedCredits > 0) {
    return 'warning' as const;
  }

  if (missingCredits >= 5) {
    return 'danger' as const;
  }

  return 'warning' as const;
}

function getStatusText(missingCredits: number, earnedCredits: number, requiredCredits: number, plannedCredits: number) {
  if (requiredCredits === 0) {
    return '対象外';
  }

  if (missingCredits <= 0 && earnedCredits >= requiredCredits) {
    return '条件達成済み';
  }

  if (missingCredits <= 0 && plannedCredits > 0) {
    return '履修予定を含めれば達成';
  }

  return `不足 ${missingCredits} 単位`;
}

export default function GraduationRequirementPanel({ curriculum, allYearsData, courses }: GraduationRequirementPanelProps) {
  const result = calculateGraduationRequirements({ allYearsData, courses, curriculum });
  const totalStatus = result.statuses.find((status) => status.category === 'total');

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>卒業要件不足表示</h2>
          <span className="small">履修予定を含めたルールベース判定です</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          {result.plannedCredits > 0 ? `履修予定 ${result.plannedCredits} 単位` : '履修予定なし'}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '0.85rem',
        }}
      >
        {result.statuses.map((status) => {
          const tone = getBadgeTone(status.missingCredits, status.earnedCredits, status.requiredCredits, status.plannedCredits);
          const toneStyle = STATUS_STYLES[tone];

          return (
            <article
              key={status.category}
              style={{
                border: `1px solid ${toneStyle.border}`,
                borderRadius: '14px',
                padding: '0.95rem 1rem',
                background: toneStyle.background,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'start' }}>
                <div>
                  <div style={{ fontWeight: 800, marginBottom: '0.25rem' }}>{status.label}</div>
                  <div className="small" style={{ color: 'var(--muted)' }}>
                    必要 {status.requiredCredits} 単位
                  </div>
                </div>
                <span className="course-tag" style={{ color: toneStyle.accent, fontWeight: 800 }}>
                  {getStatusText(status.missingCredits, status.earnedCredits, status.requiredCredits, status.plannedCredits)}
                </span>
              </div>

              <div style={{ display: 'grid', gap: '0.35rem', marginTop: '0.85rem', fontSize: '0.92rem' }}>
                <div>取得済み: {status.earnedCredits} 単位</div>
                <div>履修予定: {status.plannedCredits} 単位</div>
                <div>不足: {status.missingCredits} 単位</div>
              </div>

              <div style={{ height: '10px', borderRadius: '999px', background: 'var(--stroke)', overflow: 'hidden', marginTop: '0.9rem' }}>
                <div
                  style={{
                    width: `${status.requiredCredits === 0 ? 100 : Math.min(100, ((status.earnedCredits + status.plannedCredits) / status.requiredCredits) * 100)}%`,
                    height: '100%',
                    borderRadius: '999px',
                    background: `linear-gradient(135deg, ${toneStyle.accent}, color-mix(in oklab, ${toneStyle.accent} 60%, white 40%))`,
                  }}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
        <div className="small" style={{ color: 'var(--muted)' }}>
          取得済み {result.earnedCredits} 単位 / 履修予定 {result.plannedCredits} 単位 / 合計 {totalStatus?.requiredCredits ?? 0} 単位
        </div>
        {result.plannedCourses.length > 0 && (
          <div className="small" style={{ color: 'var(--muted)' }}>
            履修予定科目 {result.plannedCourses.length} 件が時間割に反映されています。
          </div>
        )}
      </div>
    </section>
  );
}