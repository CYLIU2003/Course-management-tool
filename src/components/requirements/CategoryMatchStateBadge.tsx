import {
  CATEGORY_MATCH_STATE_LABELS,
  CATEGORY_MATCH_STATE_THEME,
  type CategoryMatchState,
} from '../../utils/requirements';

interface CategoryMatchStateBadgeProps {
  state: CategoryMatchState;
}

export default function CategoryMatchStateBadge({ state }: CategoryMatchStateBadgeProps) {
  const theme = CATEGORY_MATCH_STATE_THEME[state];

  return (
    <span
      className="requirement-badge"
      style={{
        background: theme.background,
        border: `1px solid ${theme.border}`,
        color: theme.color,
      }}
    >
      {CATEGORY_MATCH_STATE_LABELS[state]}
    </span>
  );
}
