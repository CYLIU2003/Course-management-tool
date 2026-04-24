import type { CourseType } from '../../utils/academicProgress';

const LABELS: Record<CourseType, string> = {
  required: '必修',
  'elective-required': '選択必修',
  elective: '選択',
};

export default function CourseTypeBadge({ courseType }: { courseType: CourseType }) {
  return <span className={`course-badge course-badge--${courseType}`}>{LABELS[courseType]}</span>;
}
