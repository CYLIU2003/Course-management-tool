import { useMemo } from 'react';
import {
  CATEGORY_COURSE_TAB_LABELS,
  CATEGORY_COURSE_TAB_ORDER,
  filterCoursesByTab,
  sortCategoryCourses,
  type CategoryCourse,
  type CategoryCourseTab,
} from '../../utils/requirements';
import RequirementCourseCard from './RequirementCourseCard';

interface RequirementCourseListProps {
  courses: CategoryCourse[];
  activeTab: CategoryCourseTab;
  onTabChange: (tab: CategoryCourseTab) => void;
}

const EMPTY_MESSAGES: Record<CategoryCourseTab, string> = {
  all: 'この条件に一致する授業はありません。',
  passed: '取得済の授業はまだありません。',
  planned: '履修予定の授業はまだありません。',
  not_taken: '未取得の候補授業はありません。',
  counted: 'この区分にカウント済の授業はありません。',
  eligible: 'この区分の候補授業はありません。',
};

export default function RequirementCourseList({ courses, activeTab, onTabChange }: RequirementCourseListProps) {
  const visibleCourses = useMemo(() => {
    return sortCategoryCourses(filterCoursesByTab(courses, activeTab));
  }, [activeTab, courses]);

  return (
    <section style={{ display: 'grid', gap: '0.9rem' }}>
      <div className="requirement-tabs" role="tablist" aria-label="授業フィルタ">
        {CATEGORY_COURSE_TAB_ORDER.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`requirement-tab${tab === activeTab ? ' is-active' : ''}`}
            onClick={() => onTabChange(tab)}
            aria-pressed={tab === activeTab}
          >
            {CATEGORY_COURSE_TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="small" style={{ color: 'var(--muted)' }}>
        {visibleCourses.length} 件を表示中
      </div>

      {visibleCourses.length === 0 ? (
        <div className="requirement-empty">{EMPTY_MESSAGES[activeTab]}</div>
      ) : (
        <div className="requirement-course-list">
          {visibleCourses.map((course) => (
            <RequirementCourseCard key={course.courseId} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}
