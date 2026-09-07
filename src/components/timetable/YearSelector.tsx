import { currentAcademicYear } from '../../utils/academicYears';
export default function YearSelector({ value, onChange, years = [] }: { value: string; onChange: (year: string) => void; years?: string[] }) {
  const current = currentAcademicYear();
  const options = [...new Set([...years.filter(year => /^20\d{2}$/.test(year)), ...Array.from({length: Math.max(1,current-2022+2)},(_,i)=>String(2022+i)),value])].sort((a,b)=>Number(b)-Number(a));
  return <label className="control-field"><span>表示・保存する年度</span><select value={value} onChange={event=>onChange(event.target.value)}>{options.map(year=><option key={year} value={year}>{year}年度{Number(year)===current?'（今年度）':''}</option>)}</select></label>;
}
