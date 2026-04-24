type YearSelectorProps = {
  value: string;
  onChange: (year: string) => void;
};

const YEARS = ['1年次', '2年次', '3年次', '4年次', 'M1', 'M2'] as const;

export default function YearSelector({ value, onChange }: YearSelectorProps) {
  return (
    <label className="control-field">
      <span>現在学年</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {YEARS.map((year) => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </label>
  );
}