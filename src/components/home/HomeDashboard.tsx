import { WeekBars } from '../RecordCharts';
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
  const orderedDays = ['月', '火', '水', '木', '金', '土', '日'];
  entries.sort((a, b) => orderedDays.indexOf(a.day) - orderedDays.indexOf(b.day) || Number(a.period) - Number(b.period));
  const visibleDays = orderedDays.filter(day => day !== '日' || entries.some(entry => entry.day === day));
  return <div className="student-home">
    <section className="student-hero">
      <div><p className="eyebrow">MY CAMPUS / {currentYear} · {currentQuarter}</p>
        <h2>{entries.length ? '今期の学びを、ここから。' : 'まずは、時間割をつくろう。'}</h2>
        <p>{entries.length ? '予定を整えて、学期末には成績を記録。日々の履修をひとつの場所で。' : '科目を探して、曜日・時限を選ぶだけ。あとからいつでも編集できます。'}</p>
        <button className="btn-primary" onClick={onOpenTimetable}>{entries.length ? '時間割を開く' : '時間割をつくる'} <span aria-hidden="true">→</span></button>
      </div>
      <div className="chart-panel"><h3>1週間のバランス</h3><p className="chart-caption">{currentQuarter} · 曜日別の登録コマ数</p><WeekBars counts={visibleDays.map(day => ({ day, count: entries.filter(entry => entry.day === day).length }))} /></div>
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
        {entries.length > 5 && <p className="student-note">曜日順に5コマを表示しています。残り{entries.length - 5}コマは時間割で確認できます。</p>}
      </section>
      <section className="tt-card"><h2>履修のチェックポイント</h2><div className="student-check"><span>01</span><div><h3>必要な科目・単位を確認</h3><p>{curriculumName || '選択した学科'}の学修要覧と、ひらめき・TAP・教職の条件を確認できます。</p><button className="text-action" onClick={onOpenRequirements}>履修ガイドを見る →</button></div></div><div className="student-check"><span>02</span><div><h3>成績が出たら記録</h3><p>合格した単位とGPAが自動で更新されます。</p><button className="text-action" onClick={onOpenGrades}>成績を入力する →</button></div></div>
        <p className="student-note">卒業条件の自動判定は準備中です。取得単位の表示だけで卒業可否を判断しないでください。</p>
      </section>
    </div>
  </div>;
}
