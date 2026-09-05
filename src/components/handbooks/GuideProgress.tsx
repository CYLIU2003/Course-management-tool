import { useMemo, useState } from 'react';
import type { HandbookDocument } from '../../core/handbooks';
import type { AcademicAllYearsData } from '../../core/types';
import { guideCourses, guideMinimum, sumCourseCredits } from '../../utils/guideProgress';
import { localHandbookUrl } from '../../api/handbooks';

export default function GuideProgress({ documents, department, data }: { documents: HandbookDocument[]; department: string; data: AcademicAllYearsData }) {
  const courses = useMemo(() => guideCourses(documents, department, data), [documents, department, data]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('すべて');
  const categories = [...new Set(courses.map(entry => entry.category))];
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s/g, '').toLowerCase();
  const matches = courses.filter(entry => (status === 'すべて' || entry.status === status) && normalize(entry.title + entry.course.group).includes(normalize(query)));
  if (!courses.length) return null;
  return <section className="guide-progress" aria-label="区分ごとの科目と履修状況">
    <div className="guide-intro"><div><span className="guide-kicker">あなたの履修状況</span><h3>あと何単位か、区分から確認。</h3><p>「成績・単位」の入力を反映しています。</p></div><div className="guide-record-count"><strong>{courses.filter(entry => entry.status === '修得済み').length}<small> / {courses.length}</small></strong><span>掲載科目のうち修得済み</span></div></div>
    <div className="guide-help"><span aria-hidden="true">i</span><p>表示は単位数の目安です。必修科目・算入上限など、卒業条件は各区分の「条件と出典」で確認してください。</p></div>
    <div className="guide-toolbar"><label>科目を検索<input type="search" placeholder="科目名・科目群" value={query} onChange={event => setQuery(event.target.value)} /></label><label>履修状況<select value={status} onChange={event => setStatus(event.target.value)}>{['すべて', '未登録', '履修予定', '修得済み', '不合格', '単位数要確認'].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {(query || status !== 'すべて') && <p className="guide-filter-result" role="status">{matches.length}科目が該当します。区分の単位集計は全科目が対象です。 <button type="button" onClick={() => { setQuery(''); setStatus('すべて'); }}>絞り込みを解除</button></p>}
    <div className="guide-category-grid">{categories.filter(category => !query && status === 'すべて' || matches.some(entry => entry.category === category)).map(category => {
      const entries = courses.filter(entry => entry.category === category);
      const visible = matches.filter(entry => entry.category === category);
      const earned = sumCourseCredits(entries, '修得済み');
      const planned = sumCourseCredits(entries, '履修予定');
      const minimum = guideMinimum(documents, category);
      return <article className="guide-category" key={category}>
        <div className="guide-category-heading"><h4>{category}</h4><span className={`guide-badge ${minimum ? '' : 'guide-badge--review'}`}>{minimum ? '必要単位あり' : '必要単位を確認'}</span></div>
        <div className="guide-credit-heading"><div><span>修得済み</span><strong>{earned}<small>単位</small></strong></div><p>{minimum ? <>必要 <b>{minimum.credits}</b> 単位</> : '必要単位：未確認'}</p></div>
        {minimum ? <progress className="guide-credit-bar" aria-label={`${category}の修得済み単位`} value={Math.min(earned, minimum.credits)} max={minimum.credits || 1} /> : <div className="guide-unverified">原本で必要単位を確認すると、残りの目安が分かります。</div>}
        <dl className="guide-credit-breakdown"><div><dt>履修予定</dt><dd>{planned}<small>単位</small></dd></div><div><dt>数値上の残り</dt><dd>{minimum ? Math.max(0, minimum.credits - earned) : '—'}<small>{minimum ? '単位' : '未確認'}</small></dd></div></dl>
        <details className="guide-source"><summary>条件と出典</summary><p>{minimum ? minimum.note : 'この区分の必要単位は、卒業要件表との対応が未確認です。「卒業・必要単位」の原本ページを確認してください。'}</p>{minimum && <a href={localHandbookUrl(minimum.source.localPath, minimum.page)} target="_blank" rel="noreferrer">必要単位の原本 · PDF {minimum.page}ページ ↗</a>}<p>同じ科目は1回だけ集計。履修予定は修得済みに含めていません。区分は科目表から抽出した分類です。</p></details>
        <details className="guide-course-disclosure" open={query !== '' || status !== 'すべて' ? true : undefined}><summary><span>該当科目を見る <b>{visible.length}</b></span><small>掲載合計 {sumCourseCredits(entries)}単位</small></summary>
          <ul className="guide-course-list">{visible.map(entry => <li key={entry.course.id}><div className="guide-course-name"><strong>{entry.title}</strong>{entry.course.group && <small>{entry.course.group}</small>}<a href={localHandbookUrl(entry.document.localPath, entry.course.page)} target="_blank" rel="noreferrer">科目の出典 · PDF {entry.course.page}ページ ↗</a></div><div className="guide-course-result"><strong>{entry.course.credits}<small>単位</small></strong><span className="guide-course-status" data-status={entry.status}>{entry.status}</span></div></li>)}</ul>
        </details>
      </article>;
    })}</div>
  </section>;
}
