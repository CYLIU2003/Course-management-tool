import {
  REQUIREMENT_STATUS_LABELS,
  REQUIREMENT_STATUS_THEME,
  type RequirementStatus,
} from '../../utils/requirements';

interface RequirementStatusBadgeProps {
  status: RequirementStatus;
}

export default function RequirementStatusBadge({ status }: RequirementStatusBadgeProps) {
  const theme = REQUIREMENT_STATUS_THEME[status];

  return (
    <span
      className="requirement-badge"
      style={{
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.color,
      }}
    >
      {REQUIREMENT_STATUS_LABELS[status]}
    </span>
  );
}
