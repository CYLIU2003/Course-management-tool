import {
  COURSE_TAKEN_STATUS_LABELS,
  COURSE_TAKEN_STATUS_THEME,
  type CourseTakenStatus,
} from '../../utils/requirements';

interface CourseTakenStatusBadgeProps {
  status: CourseTakenStatus;
}

export default function CourseTakenStatusBadge({ status }: CourseTakenStatusBadgeProps) {
  const theme = COURSE_TAKEN_STATUS_THEME[status];

  return (
    <span
      className="requirement-badge"
      style={{
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.color,
      }}
    >
      {COURSE_TAKEN_STATUS_LABELS[status]}
    </span>
  );
}
