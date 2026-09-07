import { useId } from 'react';

export type ChartSegment = { label: string; value: number; color: string };

export function RecordDonut({ segments, label }: { segments: ChartSegment[]; label: string }) {
  const titleId = useId();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;
  return <div className="record-chart"><svg viewBox="0 0 180 180" role="img" aria-labelledby={titleId}>
    <title id={titleId}>{label}：{segments.map(segment => `${segment.label}${segment.value}科目`).join('、')}</title>
    <circle cx="90" cy="90" r="68" fill="none" stroke="#eaf0f6" strokeWidth="18" />
    {segments.filter(segment => segment.value > 0).map(segment => {
      const length = segment.value / total * 100;
      const start = offset; offset += length;
      return <circle key={segment.label} cx="90" cy="90" r="68" fill="none" stroke={segment.color} strokeWidth="18" pathLength="100" strokeDasharray={`${length} ${100-length}`} strokeDashoffset={-start} transform="rotate(-90 90 90)" />;
    })}
    <text x="90" y="88" textAnchor="middle" className="record-chart__total">{total}</text>
    <text x="90" y="109" textAnchor="middle" className="record-chart__unit">登録科目</text>
  </svg><ul className="chart-legend">{segments.map(segment => <li key={segment.label}><i style={{ background:segment.color }} aria-hidden="true" /><span>{segment.label}</span><strong>{segment.value}科目</strong></li>)}</ul></div>;
}

export function WeekBars({ counts }: { counts: { day: string; count: number }[] }) {
  const maximum = Math.max(1, ...counts.map(item => item.count));
  return <div className="week-chart" role="img" aria-label={counts.map(item => `${item.day}曜${item.count}コマ`).join('、')}>
    {counts.map(item => <div className="week-chart__column" key={item.day}><strong>{item.count}</strong><div className="week-chart__bar" style={{ height: `${item.count / maximum * 100}px` }} /><span>{item.day}</span></div>)}
  </div>;
}
