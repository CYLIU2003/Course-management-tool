import type { CourseRecommendation } from '../utils/courseRecommendation';
import { formatCourseTypeLabel } from '../utils/courseRecommendation';

type CourseRecommendationPanelProps = {
  recommendations: CourseRecommendation[];
  compact?: boolean;
};

const CATEGORY_STYLE: Record<string, string> = {
  required: 'var(--primary-strong)',
  'elective-required': 'var(--accent)',
  elective: 'var(--text-sub)',
};

function getPriorityLabel(category: CourseRecommendation['priorityCategory']) {
  return formatCourseTypeLabel(category);
}

export default function CourseRecommendationPanel({ recommendations, compact = false }: CourseRecommendationPanelProps) {
  const visibleRecommendations = compact ? recommendations.slice(0, 3) : recommendations.slice(0, 5);

  return (
    <section style={{ marginTop: '1rem', display: 'grid', gap: '0.9rem' }}>
      <div className="section-title" style={{ marginBottom: 0 }}>
        <div>
          <h3 style={{ margin: 0 }}>今期おすすめ科目</h3>
          <span className="small">未充足カテゴリを優先してルールベースで抽出しています</span>
        </div>
        <span className="small">{visibleRecommendations.length} 件</span>
      </div>

      {visibleRecommendations.length === 0 ? (
        <div className="warning-panel__empty">現時点では優先度の高い科目候補はありません。</div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {visibleRecommendations.map((recommendation) => (
            <article key={recommendation.course.id} className="course-search__item">
              <div className="course-search__item-head">
                <div>
                  <h3>{recommendation.course.title}</h3>
                  <p>
                    {recommendation.course.category || 'カテゴリ未設定'} / {recommendation.course.group || '科目群未設定'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 800, color: CATEGORY_STYLE[recommendation.priorityCategory] ?? 'var(--text-main)' }}>
                    {getPriorityLabel(recommendation.priorityCategory)}
                  </div>
                  <div className="small">{recommendation.course.credits} 単位</div>
                </div>
              </div>

              <div className="course-search__chips" style={{ marginTop: '0.75rem' }}>
                <span className="course-tag">{formatCourseTypeLabel(recommendation.course.courseType)}</span>
                {recommendation.course.tags?.slice(0, 3).map((tag) => (
                  <span key={tag} className="course-tag course-tag--neutral">
                    {tag}
                  </span>
                ))}
              </div>

              <div style={{ marginTop: '0.75rem', display: 'grid', gap: '0.3rem' }}>
                <div className="small" style={{ fontWeight: 700, color: 'var(--text-main)' }}>推薦理由</div>
                {recommendation.reasons.map((reason) => (
                  <div key={reason} className="small">・{reason}</div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
