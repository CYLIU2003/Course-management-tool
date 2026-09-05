import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../api/client';
import { responseError } from '../api/account';
import { AVAILABLE_DEPARTMENTS } from '../core/departments';

interface Correction { id: string; sourceId: string; page: number; date: string; field: string; change: string }
interface Offering { id: string; title: string; lectureCode: string; titleVariants: string[]; status: string;
  meetings: { campus: string; term: string; day: string; period: string; rooms: string[]; teachers: string[]; remarks: string[] }[];
  audiences: { departmentLabel: string; departmentIds: string[]; campus: string; gradeYear: string; className: string; target: string }[];
  sourceOccurrences: { sourceId: string; page: number }[]; corrections: Correction[] }
interface Catalog { classes: Offering[]; sources: { id: string; url: string; references: {label: string}[] }[] }
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s/g, '');

export default function OfferingBrowser({ departmentId, admin = false }: { departmentId?: string; admin?: boolean }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [department, setDepartment] = useState(departmentId ?? '');
  const [limit, setLimit] = useState(20);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setDepartment(departmentId ?? ''); }, [departmentId]);
  useEffect(() => {
    const controller = new AbortController(); setError('');
    apiFetch('/api/offerings/2026', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(await responseError(response));
      const value: Catalog = await response.json(); if (!controller.signal.aborted) setCatalog(value);
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '読込に失敗しました。'); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { setLimit(20); }, [query, term, department]);
  const matches = useMemo(() => (catalog?.classes ?? []).filter((course) => {
    const selected = AVAILABLE_DEPARTMENTS.find((d) => d.id === department);
    const campus = selected?.campus === '横浜' ? 'yokohama' : 'setagaya';
    const audience = !department || course.audiences.some((item) => item.departmentIds.includes(department) || (item.departmentLabel === '共通' && item.campus === campus));
    return audience && (!term || course.meetings.some((meeting) => meeting.term.includes(term))) && normalize(course.title + course.titleVariants.join(' ') + course.lectureCode).includes(normalize(query));
  }), [catalog, department, term, query]);
  const sources = new Map(catalog?.sources.map((source) => [source.id, source]));
  function sourceLink(sourceId: string, page: number, label = '原本PDF') {
    const source = sources.get(sourceId);
    return source ? <a href={`${source.url}#page=${page}`} target="_blank" rel="noreferrer">{label} {page}ページ</a> : null;
  }
  return <section className="service-panel"><div className="section-title"><div><p className="eyebrow">2026 / COURSE OFFERINGS</p><h2>2026年度の開講情報</h2><p>授業が開かれる年度の情報です。卒業条件は入学年度の学修要覧を確認してください。</p></div></div>
    <div className="offering-filters"><label>科目名・講義コード<input value={query} onChange={(e) => setQuery(e.target.value)} type="search" /></label><label>対象学科<select value={department} onChange={(e) => setDepartment(e.target.value)}><option value="">すべて（大学院・訂正のみの情報を含む）</option>{AVAILABLE_DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label>開講期<select value={term} onChange={(e) => setTerm(e.target.value)}><option value="">すべて</option><option value="前">前期・前期集中</option><option value="後">後期・後期集中</option><option value="通年">通年</option></select></label></div>
    <p className="small">共通科目には対象年度・クラスなどの条件があります。一覧への掲載だけで履修可能とは判定しません。</p>
    {error && <p role="alert">{error} <button onClick={() => setAttempt((n) => n + 1)}>再試行</button></p>}
    {!catalog && !error && <p role="status">開講情報を読み込み中…</p>}
    {catalog && <><p role="status">{matches.length}講義{admin ? ` / 全${catalog.classes.length}講義コード` : ''}</p><div className="offering-results">{matches.slice(0, limit).map((course) => <details key={course.id} className="offering-row"><summary><strong>{course.title}</strong><span>{course.lectureCode}</span>{course.status !== 'source_extracted' && <span className="source-warning">訂正内容の確認が必要</span>}</summary>
      {course.meetings.map((meeting, i) => <div key={i} className="offering-meeting"><strong>{meeting.term} · {meeting.day ? `${meeting.day}曜 ${meeting.period}限` : '集中・曜日時限未指定'} · {meeting.campus === 'setagaya' ? '世田谷' : '横浜'}</strong><p>教室：{meeting.rooms.join(' / ') || '記載なし'} 担当：{meeting.teachers.join(' / ') || '記載なし'}</p>{meeting.remarks.length > 0 && <p>{meeting.remarks.join('\n')}</p>}</div>)}
      {!course.meetings.length && <p>訂正資料のみで確認した講義です。曜日・時限は原本で確認してください。</p>}
      <h3>受講対象</h3>{course.audiences.map((item, i) => <p key={i}>{item.departmentLabel} · {item.gradeYear}年 · {item.className} {item.target}</p>)}
      {course.corrections.length > 0 && <><h3>大学の訂正情報</h3><p>以下には条件付きの変更を含みます。「訂正内容の確認が必要」の講義は、表示中の曜日・教室だけで判断しないでください。</p>{course.corrections.map((change) => <div key={change.id} className="offering-correction"><strong>{change.date} · {change.field}</strong><p>{change.change}</p>{sourceLink(change.sourceId, change.page, '訂正表')}</div>)}</>}
      <div className="offering-sources">{[...new Map(course.sourceOccurrences.map((source) => [`${source.sourceId}:${source.page}`, source])).values()].map((source) => <span key={`${source.sourceId}:${source.page}`}>{sourceLink(source.sourceId, source.page)}</span>)}</div>
    </details>)}</div>{matches.length > limit && <button onClick={() => setLimit((n) => n + 20)}>さらに20件を表示</button>}</>}
  </section>;
}
