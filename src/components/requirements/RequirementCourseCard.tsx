import {
  CATEGORY_MATCH_STATE_THEME,
  COURSE_TAKEN_STATUS_THEME,
  type CategoryCourse,
} from '../../utils/requirements';
import CategoryMatchStateBadge from './CategoryMatchStateBadge';
import CourseTakenStatusBadge from './CourseTakenStatusBadge';

interface RequirementCourseCardProps {
  course: CategoryCourse;
  onPlanCourse?: (course: CategoryCourse) => void;
}

export default function RequirementCourseCard({ course, onPlanCourse }: RequirementCourseCardProps) {
  const stateTheme = CATEGORY_MATCH_STATE_THEME[course.matchState];
  const takenTheme = COURSE_TAKEN_STATUS_THEME[course.takenStatus];
  const isPlannable = course.takenStatus === 'not_taken' && course.matchState === 'eligible_for_this_category';

  return (
    <article
      className="requirement-course-card"
      style={{
        background: `linear-gradient(180deg, ${stateTheme.background}, var(--surface))`,
        borderColor: stateTheme.border,
      }}
    >
      <div className="requirement-course-card__head">
        <div>
          <h4 className="requirement-course-card__title">{course.courseName}</h4>
          <p className="requirement-course-card__credits">{course.credits} 単位</p>
        </div>
        <div className="requirement-course-card__badges">
          <CourseTakenStatusBadge status={course.takenStatus} />
          <CategoryMatchStateBadge state={course.matchState} />
        </div>
      </div>

      <div className="requirement-course-card__meta">
        {course.courseCode ? <span>コード {course.courseCode}</span> : null}
        {course.yearLevel ? <span>{course.yearLevel}年次</span> : null}
        {course.semester ? <span>{course.semester}</span> : null}
        {course.dayPeriod ? <span>{course.dayPeriod}</span> : null}
        {course.instructor ? <span>{course.instructor}</span> : null}
      </div>

      {course.countedCategoryName && course.matchState === 'counted_in_other_category' ? (
        <div className="requirement-empty" style={{ padding: '0.8rem 0.85rem', background: takenTheme.background }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>反映先</strong>
          <span className="small" style={{ color: takenTheme.color }}>
            {course.countedCategoryName}
          </span>
        </div>
      ) : null}

      {onPlanCourse && isPlannable ? (
        <div className="requirement-course-card__actions">
          <button type="button" className="btn-ghost" onClick={() => onPlanCourse(course)}>
            履修予定に追加
          </button>
        </div>
      ) : null}
    </article>
  );
}
