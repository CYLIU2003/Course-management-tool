import type { AcademicWarning } from '../../utils/academicProgress';

type WarningPanelProps = {
  warnings: AcademicWarning[];
};

const ORDER = { danger: 0, warning: 1, info: 2 } as const;
const ICONS = { danger: '⚠️', warning: '🟡', info: 'ℹ️' } as const;

export default function WarningPanel({ warnings }: WarningPanelProps) {
  const sorted = [...warnings].sort((a, b) => ORDER[a.level] - ORDER[b.level]);

  return (
    <section className="warning-panel tt-card">
      <div className="section-title">
        <h2>警告・確認事項</h2>
        <span className="small">履修状況の注意点</span>
      </div>
      {sorted.length === 0 ? (
        <div className="warning-panel__empty">大きな警告はありません。</div>
      ) : (
        <div className="warning-panel__list">
          {sorted.map((warning) => (
            <article key={warning.id} className={`warning-panel__item is-${warning.level}`}>
              <div className="warning-panel__icon">{ICONS[warning.level]}</div>
              <div>
                <p className="warning-panel__message">{warning.message}</p>
                {warning.detail && <p className="warning-panel__detail">{warning.detail}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}