import type { AcademicAllYearsData, AcademicDashboardSnapshot, AcademicYear, Grade } from '../core/types';

export default function StudentGrades({ data, year, snapshot, onGradeChange, onOpenTimetable }: {
  data: AcademicAllYearsData; year: AcademicYear; snapshot: AcademicDashboardSnapshot;
  onGradeChange: (key: string, grade: Grade) => void; onOpenTimetable: () => void;
}) {
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
  return <section className="page-stack"><div className="page-heading"><p className="eyebrow">YOUR RECORD</p><h2>成績・単位</h2><p>成績が出たらここに記録。同じ科目を複数Qに登録していても、まとめて更新します。</p></div>
    <div className="student-metrics"><div><span>取得単位（全学年）</span><strong>{snapshot.recordedEarnedCredits ?? snapshot.earnedCredits}<small> 単位</small></strong></div><div><span>累計GPA</span><strong>{snapshot.gradedCredits ? snapshot.gpa.currentGpa.toFixed(2) : '—'}</strong></div><div><span>表示している学年</span><strong>{year}</strong></div></div>
    <section className="tt-card"><div className="section-title"><h2>{year}の成績を入力</h2><span className="small">アカウントに自動保存</span></div>
      {rows.size ? <div className="student-grades">{[...rows].map(([key, row]) => <div className="grade-entry" key={key}><div><strong>{row.title}</strong><small>{row.quarters.join('・')} / {row.credits ?? '未入力'}単位</small></div><label><span className="sr-only">{row.title}の成績</span><select value={row.grade ?? '未履修'} onChange={e => onGradeChange(key, e.target.value as Grade)}>{(['未履修', '秀', '優', '良', '可', '不可'] as Grade[]).map(grade => <option key={grade} value={grade}>{grade === '未履修' ? '成績未入力' : grade}</option>)}</select></label></div>)}</div>
        : <div className="student-empty"><strong>この学年の科目はまだありません</strong><p>先に時間割に科目を登録してください。過去の成績は上部の「表示学年」で学年を切り替えられます。</p><button className="btn-primary" onClick={onOpenTimetable}>時間割に科目を追加</button></div>}
      <p className="student-note">大学の成績通知をもとに入力してください。卒業要件への算入は履修ガイドで別途確認できます。</p>
    </section></section>;
}
