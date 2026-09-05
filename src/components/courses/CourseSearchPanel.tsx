import { useMemo, useState } from 'react';
import type { AcademicCourse } from '../../core/types';

export default function CourseSearchPanel({ courses, onAdd }: { courses: AcademicCourse[]; onAdd: (course: AcademicCourse) => void }) {
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(20);
  const filtered = useMemo(() => {
    const terms = query.normalize('NFKC').toLowerCase().split(/\s+/).filter(Boolean);
    return courses.filter(course => terms.every(term => course.title.normalize('NFKC').toLowerCase().includes(term)));
  }, [courses, query]);
  return <section className="course-search">
    <div className="section-title"><h2>科目を探す</h2><span className="small">{courses.length}科目</span></div>
    <label className="course-search__field"><span>科目名</span><input type="search" value={query} onChange={e => { setQuery(e.target.value); setLimit(20); }} placeholder="例：微分積分、英語" /></label>
    <p className="student-note">追加後に空きコマを選びます。開講曜日・時限は大学の時間割で確認してください。</p>
    <p className="small" role="status">{filtered.length}件{query && ` · 「${query}」の検索結果`}</p>
    <div className="course-search__list">{filtered.slice(0, limit).map(course => <article className="course-result" key={course.id}>
      <div><h3>{course.title}</h3><span>{course.credits}単位</span></div>
      <button className="course-add" aria-label={`${course.title}を時間割に追加`} onClick={() => onAdd(course)}>＋ 追加</button>
      <details><summary>履修条件・出典</summary><p>{course.group}</p><p>必選区分・卒業単位への算入は学修要覧で確認してください。</p></details>
    </article>)}</div>
    {!filtered.length && <div className="student-empty"><strong>一致する科目がありません</strong><p>短い科目名で検索するか、時間割の空きコマから直接入力できます。</p>{query && <button className="text-action" onClick={() => setQuery('')}>検索をクリア</button>}</div>}
    {filtered.length > limit && <button className="btn-ghost" onClick={() => setLimit(n => n + 20)}>さらに20件を見る</button>}
  </section>;
}
