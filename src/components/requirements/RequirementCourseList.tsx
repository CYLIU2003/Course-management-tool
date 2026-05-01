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
  onPlanCourse?: (course: CategoryCourse) => void;
}

const EMPTY_MESSAGES: Record<CategoryCourseTab, string> = {
  candidate: 'この区分で今すぐ候補にできる授業はまだありません。',
  achievements: 'この区分で取得済・履修予定の授業はまだありません。',
  all: 'この区分に該当する授業はまだありません。',
};

export default function RequirementCourseList({ courses, activeTab, onTabChange, onPlanCourse }: RequirementCourseListProps) {
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
            <RequirementCourseCard key={course.courseId} course={course} onPlanCourse={onPlanCourse} />
          ))}
        </div>
      )}
    </section>
  );
}
