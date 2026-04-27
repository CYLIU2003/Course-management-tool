import {
  CATEGORY_MATCH_STATE_THEME,
  COURSE_TAKEN_STATUS_THEME,
  type CategoryCourse,
} from '../../utils/requirements';
import CategoryMatchStateBadge from './CategoryMatchStateBadge';
import CourseTakenStatusBadge from './CourseTakenStatusBadge';

interface RequirementCourseCardProps {
  course: CategoryCourse;
}

export default function RequirementCourseCard({ course }: RequirementCourseCardProps) {
  const stateTheme = CATEGORY_MATCH_STATE_THEME[course.matchState];
  const takenTheme = COURSE_TAKEN_STATUS_THEME[course.takenStatus];

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
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>カウント先</strong>
          <span className="small" style={{ color: takenTheme.color }}>
            {course.countedCategoryName}
          </span>
        </div>
      ) : null}
    </article>
  );
}
