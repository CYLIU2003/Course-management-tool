import { useState } from 'react';
import { RecordDonut } from './RecordCharts';
import type { AcademicAllYearsData, AcademicDashboardSnapshot, AcademicYear, Grade } from '../core/types';

export default function StudentGrades({ data, year, snapshot, onGradeChange, onOpenTimetable }: {
  data: AcademicAllYearsData; year: AcademicYear; snapshot: AcademicDashboardSnapshot;
  onGradeChange: (key: string, grade: Grade) => void; onOpenTimetable: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const rows = new Map<string, { title: string; credits?: number; grade?: Grade; quarters: string[] }>();
  for (const [quarter, days] of Object.entries(data[year]?.timetable ?? {})) {
    for (const slots of Object.values(days)) for (const cell of Object.values(slots)) {
      if (!cell?.title) continue;
      const key = cell.courseId || cell.title.normalize('NFKC').replace(/\s+/g, '');
      const row = rows.get(key);
      if (row) { if (!row.quarters.includes(quarter)) row.quarters.push(quarter); }
      else rows.set(key, { ...cell, quarters: [quarter] });
    }
  }
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s/g, '').toLowerCase();
  const grades = ['秀', '優', '良', '可', '不可', '未履修'] as const;
  const colors = ['#004c7c', '#0069a8', '#168dc1', '#74badb', '#b76828', '#d3dee8'];
  const segments = grades.map((grade, index) => ({ label: grade === '未履修' ? '成績未入力' : grade, value: [...rows.values()].filter(row => (row.grade ?? '未履修') === grade).length, color: colors[index] }));
  const visibleRows = [...rows].filter(([, row]) => normalize(row.title).includes(normalize(query)) && (filter === 'all' || (row.grade ?? '未履修') === filter));
  return <section className="page-stack"><div className="page-heading"><p className="eyebrow">YOUR RECORD</p><h2>成績・単位</h2><p>成績が出たらここに記録。同じ科目を複数Qに登録していても、まとめて更新します。</p></div>
    <div className="student-metrics"><div><span>取得単位（同じ所属・入学年度）</span><strong>{snapshot.recordedEarnedCredits ?? snapshot.earnedCredits}<small> 単位</small></strong></div><div><span>累計GPA</span><strong>{snapshot.gradedCredits ? snapshot.gpa.currentGpa.toFixed(2) : '—'}</strong></div><div><span>表示している年度</span><strong>{year}</strong></div></div>
    <section className="chart-panel"><h3>{year}年度の成績内訳</h3><p className="chart-caption">科目数で比較。同じ科目の複数コマ・複数Qは1科目として表示します。</p><RecordDonut segments={segments} label={`${year}年度の成績内訳`} /></section>
    <section className="tt-card"><div className="section-title"><h2>{year}年度の成績を入力</h2><span className="small">アカウントに自動保存</span></div>
      {rows.size > 0 && <div className="grade-toolbar"><label>科目を検索<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="科目名を入力" /></label><label>成績で絞り込み<select value={filter} onChange={event => setFilter(event.target.value)}><option value="all">すべての成績</option>{grades.map(grade => <option value={grade} key={grade}>{grade === '未履修' ? '成績未入力' : grade}</option>)}</select></label></div>}
      {rows.size > 0 && !visibleRows.length && <p role="status">該当する科目がありません。検索条件を変更してください。</p>}
      {rows.size ? <div className="student-grades">{visibleRows.map(([key, row]) => <div className="grade-entry" key={key}><div><strong>{row.title}</strong><small>{row.quarters.join('・')} / {row.credits ?? '未入力'}単位</small></div><label><span className="sr-only">{row.title}の成績</span><select value={row.grade ?? '未履修'} onChange={e => onGradeChange(key, e.target.value as Grade)}>{(['未履修', '秀', '優', '良', '可', '不可'] as Grade[]).map(grade => <option key={grade} value={grade}>{grade === '未履修' ? '成績未入力' : grade}</option>)}</select></label></div>)}</div>
        : <div className="student-empty"><strong>この年度の科目はまだありません</strong><p>先に時間割に科目を登録してください。過去の成績は上部の「表示・保存する年度」で年度を切り替えられます。</p><button className="btn-primary" onClick={onOpenTimetable}>時間割に科目を追加</button></div>}
      <p className="student-note">大学の成績通知をもとに入力してください。卒業要件への算入は履修ガイドで別途確認できます。</p>
    </section></section>;
}
