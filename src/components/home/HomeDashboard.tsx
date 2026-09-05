import type { AcademicDashboardSnapshot, AcademicTimetable } from '../../core/types';

type Props = {
  snapshot: AcademicDashboardSnapshot; curriculumName?: string; currentYear: string;
  currentQuarter?: string; timetable?: AcademicTimetable;
  onOpenTimetable: () => void; onOpenRequirements: () => void; onOpenGrades: () => void;
};
export default function HomeDashboard({ snapshot, curriculumName, currentYear, currentQuarter = '1Q', timetable,
  onOpenTimetable, onOpenRequirements, onOpenGrades }: Props) {
  const entries = Object.entries(timetable?.[currentQuarter] ?? {}).flatMap(([day, slots]) =>
    Object.entries(slots).filter(([, cell]) => cell?.title).map(([period, cell]) => ({ day, period, cell: cell! })));
  return <div className="student-home">
    <section className="student-hero">
      <div><p className="eyebrow">MY CAMPUS / {currentYear} · {currentQuarter}</p>
        <h2>{entries.length ? '今期の学びを、ここから。' : 'まずは、時間割をつくろう。'}</h2>
        <p>{entries.length ? '予定を整えて、学期末には成績を記録。日々の履修をひとつの場所で。' : '科目を探して、曜日・時限を選ぶだけ。あとからいつでも編集できます。'}</p>
        <button className="btn-primary" onClick={onOpenTimetable}>{entries.length ? '時間割を開く' : '科目を探して追加'} <span aria-hidden="true">→</span></button>
      </div>
      <div className="hero-calendar" aria-hidden="true"><span>YOUR WEEK</span><div>{Array.from({ length: 15 }, (_, i) => <i key={i} className={[0, 3, 6, 9, 11].includes(i) ? 'filled' : ''} />)}</div><small>ひとコマずつ、自分のペースで。</small></div>
    </section>
    <section className="student-metrics" aria-label="履修の記録">
      <div><span>今期の予定</span><strong>{entries.length}<small> コマ</small></strong><p>{currentYear}・{currentQuarter}</p></div>
      <div><span>これまでの取得単位</span><strong>{snapshot.recordedEarnedCredits ?? snapshot.earnedCredits}<small> 単位</small></strong><p>入力済みの合格成績から集計</p></div>
      <div><span>累計GPA</span><strong>{snapshot.gradedCredits ? snapshot.gpa.currentGpa.toFixed(2) : '—'}</strong><p>{snapshot.gradedCredits ? '入力済みの成績から集計' : '成績を入力すると表示されます'}</p></div>
    </section>
    <div className="student-home__columns">
      <section className="tt-card"><div className="section-title"><h2>今期の予定</h2><button className="text-action" onClick={onOpenTimetable}>時間割へ →</button></div>
        {entries.length ? <ul className="agenda-list">{entries.slice(0, 5).map(({ day, period, cell }) => <li key={`${day}-${period}`}><span className="agenda-time">{day}<small>{period}限</small></span><div><strong>{cell.title}</strong><small>{cell.room || '教室未入力'}</small></div></li>)}</ul>
          : <div className="student-empty"><strong>まだ授業が登録されていません</strong><p>大学の開講時間割を確認して、最初の1科目を追加しましょう。</p></div>}
      </section>
      <section className="tt-card"><h2>履修のチェックポイント</h2><div className="student-check"><span>01</span><div><h3>必要な科目・単位を確認</h3><p>{curriculumName || '選択した学科'}の学修要覧と、ひらめき・TAP・教職の条件を確認できます。</p><button className="text-action" onClick={onOpenRequirements}>履修ガイドを見る →</button></div></div><div className="student-check"><span>02</span><div><h3>成績が出たら記録</h3><p>合格した単位とGPAが自動で更新されます。</p><button className="text-action" onClick={onOpenGrades}>成績を入力する →</button></div></div>
        <p className="student-note">卒業条件の自動判定は準備中です。取得単位の表示だけで卒業可否を判断しないでください。</p>
      </section>
    </div>
  </div>;
}
