type QuarterTabsProps = {
  value: string;
  quarters: readonly string[];
  onChange: (quarter: string) => void;
};

export default function QuarterTabs({ value, quarters, onChange }: QuarterTabsProps) {
  return (
    <div className="quarter-tabs" role="tablist" aria-label="クォーター切り替え">
      {quarters.map((quarter) => (
        <button
          key={quarter}
          type="button"
          className={value === quarter ? 'quarter-tabs__button is-active' : 'quarter-tabs__button'}
          aria-pressed={value === quarter}
          onClick={() => onChange(quarter)}
        >
          {quarter}
        </button>
      ))}
    </div>
  );
}