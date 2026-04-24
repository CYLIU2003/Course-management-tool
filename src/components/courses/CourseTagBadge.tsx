type CourseTagBadgeProps = {
  label: string;
};

export default function CourseTagBadge({ label }: CourseTagBadgeProps) {
  const tone = label === 'DS' || label === 'MS' || label === 'G' || label === 'STAR' ? 'accent' : 'neutral';
  return <span className={`course-tag course-tag--${tone}`}>{label}</span>;
}
