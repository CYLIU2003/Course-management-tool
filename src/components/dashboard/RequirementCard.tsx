import type { AcademicProgressItem } from '../../utils/academicProgress';

type RequirementCardProps = {
  item: AcademicProgressItem;
};

export default function RequirementCard({ item }: RequirementCardProps) {
  const percent = Math.min(100, Math.max(0, item.completionRate * 100));

  return (
    <article className="requirement-card">
      <div className="requirement-card__head">
        <div>
          <p className="requirement-card__label">{item.label}</p>
          <h3 className="requirement-card__value">{item.earnedCredits} / {item.requiredCredits} 単位</h3>
        </div>
        <div className="requirement-card__rate">{percent.toFixed(0)}%</div>
      </div>
      <div className="requirement-card__bar">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="requirement-card__foot">残り {item.remainingCredits} 単位</p>
    </article>
  );
}