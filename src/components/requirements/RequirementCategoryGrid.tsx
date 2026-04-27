import RequirementCategoryCard from './RequirementCategoryCard';
import type { RequirementCategorySummary } from '../../utils/requirements';

interface RequirementCategoryGridProps {
  categories: RequirementCategorySummary[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onOpenDetail: (categoryId: string) => void;
}

function RequirementCategorySkeleton() {
  return (
    <article className="requirement-category-card" aria-hidden="true">
      <div className="requirement-skeleton" style={{ width: '42%', height: '1rem' }} />
      <div className="requirement-skeleton" style={{ width: '72%', height: '0.8rem' }} />
      <div className="requirement-category-card__metrics">
        <div className="requirement-skeleton" style={{ height: '4.5rem' }} />
        <div className="requirement-skeleton" style={{ height: '4.5rem' }} />
        <div className="requirement-skeleton" style={{ height: '4.5rem' }} />
        <div className="requirement-skeleton" style={{ height: '4.5rem' }} />
      </div>
      <div className="requirement-skeleton" style={{ height: '0.8rem' }} />
      <div className="requirement-skeleton" style={{ width: '48%', height: '2.5rem', marginLeft: 'auto' }} />
    </article>
  );
}

export default function RequirementCategoryGrid({ categories, loading = false, error = null, onRetry, onOpenDetail }: RequirementCategoryGridProps) {
  if (loading) {
    return (
      <div className="requirement-category-grid" aria-busy="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <RequirementCategorySkeleton key={index} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="requirement-empty requirement-empty--error">
        <p style={{ margin: 0 }}>{error}</p>
        {onRetry ? (
          <div style={{ marginTop: '0.75rem' }}>
            <button type="button" className="btn-ghost" onClick={onRetry}>
              再読み込み
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (categories.length === 0) {
    return <div className="requirement-empty">この区分に該当するデータはまだありません。</div>;
  }

  return (
    <div className="requirement-category-grid">
      {categories.map((category) => (
        <RequirementCategoryCard key={category.categoryId} category={category} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}
