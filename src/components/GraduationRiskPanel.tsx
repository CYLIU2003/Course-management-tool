import type { GraduationRiskSummary } from '../utils/graduationRisk';

type GraduationRiskPanelProps = {
  risk: GraduationRiskSummary;
  compact?: boolean;
};

const RISK_STYLES = {
  safe: {
    border: 'color-mix(in oklab, var(--primary) 22%, var(--border-soft) 78%)',
    background: 'color-mix(in oklab, var(--primary-soft) 70%, var(--surface) 30%)',
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

const RISK_LABELS = {
  safe: '安全',
  warning: '注意',
  danger: '危険',
} as const;

function getAlertTone(level: 'safe' | 'warning' | 'danger') {
  if (level === 'danger') return 'is-danger';
  if (level === 'warning') return 'is-warning';
  return 'is-info';
}

export default function GraduationRiskPanel({ risk, compact = false }: GraduationRiskPanelProps) {
  const visibleShortages = compact ? risk.shortageItems.slice(0, 2) : risk.shortageItems;
  const visibleAlerts = compact ? risk.requiredCourseAlerts.slice(0, 2) : risk.requiredCourseAlerts;
  const summaryStyle = RISK_STYLES[risk.overallRiskLevel];

  return (
    <section style={{ marginTop: '1rem', display: 'grid', gap: '0.9rem' }}>
      <div className="section-title" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0 }}>卒業危険度診断</h3>
          <span className="small">卒業要件と既修得データからルールベースで判定します</span>
        </div>
        <span
          className="course-tag"
          style={{
            background: summaryStyle.background,
            border: `1px solid ${summaryStyle.border}`,
            color: summaryStyle.accent,
            fontWeight: 800,
          }}
        >
          {RISK_LABELS[risk.overallRiskLevel]}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="stats-card" style={{ background: summaryStyle.background, borderColor: summaryStyle.border }}>
          <div className="stats-label">卒業危険度</div>
          <div className="stats-value" style={{ fontSize: '1.6rem', color: summaryStyle.accent }}>
            {RISK_LABELS[risk.overallRiskLevel]}
          </div>
        </div>
        <div className="stats-card">
          <div className="stats-label">不足単位数</div>
          <div className="stats-value">{risk.totalMissingCredits} 単位</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">必修未修得</div>
          <div className="stats-value">{risk.requiredMissingCredits > 0 || risk.requiredCourseAlerts.length > 0 ? 'あり' : 'なし'}</div>
        </div>
      </div>

      <div>
        <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>不足カテゴリ一覧</h4>
        {visibleShortages.length === 0 ? (
          <div className="warning-panel__empty">不足カテゴリはありません。</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {visibleShortages.map((item) => (
              <article key={item.key} className={`warning-panel__item ${getAlertTone(item.riskLevel)}`}>
                <div style={{ minWidth: '4rem', fontWeight: 800 }}>{item.label}</div>
                <div style={{ flex: 1 }}>
                  <p className="warning-panel__message">取得済み {item.earnedCredits} 単位 / 履修予定 {item.plannedCredits ?? 0} 単位</p>
                  <p className="warning-panel__detail">不足 {item.missingCredits} 単位</p>
                </div>
                <div style={{ fontWeight: 800, color: summaryStyle.accent }}>
                  {RISK_LABELS[item.riskLevel]}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>警告メッセージ</h4>
        <div className="warning-panel__empty" style={{ marginBottom: '0.75rem' }}>
          {risk.overallMessage}
        </div>
        {visibleAlerts.length === 0 ? (
          <div className="warning-panel__empty">必修未修得の個別警告はありません。</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {visibleAlerts.map((alert) => (
              <article key={`${alert.title}-${alert.location}`} className="warning-panel__item is-danger">
                <div className="warning-panel__icon">⚠️</div>
                <div>
                  <p className="warning-panel__message">{alert.title}</p>
                  <p className="warning-panel__detail">{alert.location} / {alert.detail}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
