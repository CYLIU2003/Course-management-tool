import {
  calculateRequirementProgressPercent,
  REQUIREMENT_STATUS_THEME,
  type RequirementCategorySummary,
} from '../../utils/requirements';
import RequirementStatusBadge from './RequirementStatusBadge';

interface RequirementCategoryCardProps {
  category: RequirementCategorySummary;
  onOpenDetail: (categoryId: string) => void;
}

export default function RequirementCategoryCard({ category, onOpenDetail }: RequirementCategoryCardProps) {
  const theme = REQUIREMENT_STATUS_THEME[category.status];
  const progressPercent = calculateRequirementProgressPercent(category.requiredCredits, category.earnedCredits, category.plannedCredits);

  return (
    <article
      className="requirement-category-card"
      style={{
        background: `linear-gradient(180deg, ${theme.background}, var(--surface))`,
        borderColor: theme.border,
      }}
    >
      <div className="requirement-category-card__head">
        <div>
          <h3 className="requirement-category-card__title">{category.categoryName}</h3>
          {category.description ? <p className="requirement-category-card__description">{category.description}</p> : null}
        </div>
        <RequirementStatusBadge status={category.status} />
      </div>

      <div className="requirement-category-card__metrics">
        <div className="requirement-category-card__metric">
          <span className="requirement-category-card__metric-label">必要単位</span>
          <span className="requirement-category-card__metric-value">{category.requiredCredits} 単位</span>
        </div>
        <div className="requirement-category-card__metric">
          <span className="requirement-category-card__metric-label">取得済</span>
          <span className="requirement-category-card__metric-value">{category.earnedCredits} 単位</span>
        </div>
        <div className="requirement-category-card__metric">
          <span className="requirement-category-card__metric-label">履修予定</span>
          <span className="requirement-category-card__metric-value">{category.plannedCredits} 単位</span>
        </div>
        <div className="requirement-category-card__metric">
          <span className="requirement-category-card__metric-label">残り</span>
          <span className="requirement-category-card__metric-value">{category.remainingCredits} 単位</span>
        </div>
      </div>

      <div className="requirement-category-card__bar" aria-hidden="true">
        <span
          style={{
            width: `${progressPercent}%`,
            background: `linear-gradient(135deg, ${theme.color}, color-mix(in oklab, ${theme.color} 60%, white 40%))`,
          }}
        />
      </div>

      <div className="requirement-category-card__meta">
        <span>該当授業 {category.totalEligibleCourses ?? 0} 件</span>
        <span>カウント済 {category.countedCourses ?? 0} 件</span>
        <span>取得済 {category.passedCourses ?? 0} 件</span>
        <span>履修予定 {category.plannedCourses ?? 0} 件</span>
      </div>

      <div className="requirement-category-card__actions">
        <button type="button" className="btn-primary" onClick={() => onOpenDetail(category.categoryId)}>
          該当授業を見る
        </button>
      </div>
    </article>
  );
}
