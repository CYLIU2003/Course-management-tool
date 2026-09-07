import { useEffect, useMemo, useState } from 'react';
import type { Department } from '../../core/departments';
import type { AcademicAllYearsData } from '../../core/types';
import {
  isCheckedCourseForDepartment, normalizeHandbookText, searchHandbookPages, selectHandbookSources, selectHiramekiPrograms,
  type HandbookCatalog, type HandbookDocument, type HandbookTopic, type HiramekiProgram,
} from '../../core/handbooks';
import { loadHandbookCatalog, loadHandbookDocument, loadHiramekiPrograms, localHandbookUrl } from '../../api/handbooks';
import HiramekiPanel from './HiramekiPanel';
import HandbookPageEvidence from './HandbookPageEvidence';
import StudentProfile from './StudentProfile';
import OfferingBrowser from '../OfferingBrowser';
import { DEFAULT_OPTIONS } from '../../core/handbooks/profile';
import TapFaq from './TapFaq';
import GuideProgress from './GuideProgress';
import GraduateGuide from './GraduateGuide';
import { loadDepartmentCurriculum } from '../../api/curriculum';
import type { CurriculumDataset } from '../../core/curriculum';

type View = HandbookTopic | 'courses' | 'all';
const VIEWS: Array<{ id: View; label: string }> = [
  { id: 'graduation', label: '卒業・必要単位' }, { id: 'progression', label: '進級・研究着手' },
  { id: 'registration', label: '履修条件・登録' }, { id: 'courses', label: '科目を探す' },
  { id: 'hirameki', label: 'ひらめき' }, { id: 'all', label: '全文・出典' },
  { id: 'teacher', label: '教職課程' },
  { id: 'tap', label: 'TAP／ATAP' },
];
const PAGE_SIZE = 20;

export default function HandbookBrowser({ department, entranceYear, allYearsData, raw = false, onOpenSources }: {
  onOpenSources?: () => void; raw?: boolean; department?: Department; entranceYear: number; allYearsData: AcademicAllYearsData;
}) {
  const [catalog, setCatalog] = useState<HandbookCatalog | null>(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [programs, setPrograms] = useState<HiramekiProgram[]>([]);
  const [documents, setDocuments] = useState<HandbookDocument[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [requestedView, setView] = useState<View>('graduation');
  const view = (requestedView === 'teacher' && !options.takesTeacher) || (requestedView === 'hirameki' && !options.takesHirameki) || (requestedView === 'tap' && !options.takesTap) ? 'graduation' : requestedView;
  const [sourceId, setSourceId] = useState('');
  const [pageLimit, setPageLimit] = useState(PAGE_SIZE);
  const [degreeDataset, setDegreeDataset] = useState<CurriculumDataset>();
  const [degreeError, setDegreeError] = useState('');
  const departmentId = department?.id;
  const degreeReady = degreeDataset?.departmentId === department?.id && degreeDataset?.entranceYear === entranceYear;
  const degreeRules = degreeReady
    ? degreeDataset.degreeRequirementSets : undefined;

  useEffect(() => {
    if (!departmentId) return;
    const controller = new AbortController();
    setDegreeError('');
    loadDepartmentCurriculum(departmentId, entranceYear, controller.signal)
      .then(value => { if (!controller.signal.aborted) setDegreeDataset(value); })
      .catch(() => { if (!controller.signal.aborted) setDegreeError('必要単位を読み込めませんでした。再読み込みしてください。'); });
    return () => controller.abort();
  }, [departmentId, entranceYear, retry]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadHandbookCatalog(controller.signal), loadHiramekiPrograms(controller.signal)])
      .then(([nextCatalog, nextPrograms]) => { setCatalog(nextCatalog); setPrograms(nextPrograms); })
      .catch(() => { if (!controller.signal.aborted) { setError('資料を読み込めませんでした。再読み込みしてください。'); setLoading(false); } });
    return () => controller.abort();
  }, [retry]);

  const relevantSources = useMemo(() => catalog && department ? selectHandbookSources(catalog.documents, {
    entranceYear, faculty: department.faculty, departmentName: department.name,
  }) : [], [catalog, department, entranceYear]);
  const relevantPrograms = useMemo(() => department ? selectHiramekiPrograms(programs, {
    entranceYear, facultyId: department.facultyId, departmentId: department.id,
  }) : [], [programs, department, entranceYear]);
  const sources = useMemo(() => [...relevantSources, ...(catalog?.documents.filter((source) =>
    relevantPrograms.some((program) => program.sourceId === source.id)) ?? [])], [relevantSources, relevantPrograms, catalog]);

  useEffect(() => {
    if (!catalog) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setDocuments([]); setSourceId(''); setPageLimit(PAGE_SIZE);
    Promise.allSettled(sources.map((source) => loadHandbookDocument(source, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        setDocuments(results.flatMap((result) => result.status === 'fulfilled' ? [{...result.value, courses: result.value.courses.filter(course => !department?.studyLevel || (course.studyLevel === department.studyLevel && (!department.id.endsWith('_international') || course.verification?.scope?.includes('国際連携'))))}] : []));
        const failures = results.filter((result) => result.status === 'rejected');
        if (failures.length) setError(`${failures.length}件の資料を読み込めませんでした。再読み込みするか原本PDFを確認してください。`);
        setLoading(false);
      });
    return () => controller.abort();
  }, [catalog, sources, retry, department?.studyLevel, department?.id]);

  const selectedDocuments = useMemo(() => documents.filter((document) => sourceId ? document.id === sourceId
    : view === 'hirameki' ? document.kind === 'hirameki' : document.kind === 'handbook'), [documents, sourceId, view]);
  const pageResults = useMemo(() => searchHandbookPages(selectedDocuments, query,
    view === 'all' || view === 'courses' || (view === 'hirameki' && sourceId) ? undefined : view), [selectedDocuments, query, view, sourceId]);
  const courseResults = useMemo(() => selectedDocuments.flatMap((document) => document.courses
    .filter((course) => !!department && isCheckedCourseForDepartment(course, document, department.name))
    .filter((course) => query.split(/\s+/).filter(Boolean).every((term) => normalizeHandbookText([
      course.title, course.category, course.group, course.sourceCode, ...course.rawCells,
    ].join(' ')).includes(normalizeHandbookText(term))))
    .map((course) => ({ course, document }))), [selectedDocuments, query, department]);

  function changeView(nextView: View) { setView(nextView); setSourceId(''); setPageLimit(PAGE_SIZE); }
  function openSource(id: string) { if (!raw) { onOpenSources?.(); return; } setSourceId(id); setView('all'); setQuery(''); setPageLimit(PAGE_SIZE); }

  return <section className="tt-card handbook-browser" aria-labelledby="handbook-heading">
    <header className="handbook-heading"><div><span className="handbook-eyebrow">公式資料から履修を確認</span>
      <h2 id="handbook-heading">履修ガイド</h2><p>{entranceYear}年度入学 · {department?.faculty} {department?.name}</p></div>

    </header>
    {department && !department.studyLevel && <StudentProfile key={`${department.id}:${entranceYear}`} departmentId={department.id} entranceYear={entranceYear} onChange={setOptions} requirementSets={degreeRules} />}
    {!options.isGeneral && <p className="handbook-notice">個別条件の適用は未判定です。ここで表示する通常課程の必要単位を、そのまま卒業判定には使えません。</p>}
    <p className="handbook-notice">変更・訂正は大学ポータルの正誤表も確認してください。</p>
    <div className="handbook-tabs" role="group" aria-label="履修資料の表示内容">{VIEWS.filter((item) => (raw || !['all', 'courses', 'registration', 'progression'].includes(item.id)) && (item.id !== 'teacher' || options.takesTeacher) && (item.id !== 'hirameki' || options.takesHirameki) && (item.id !== 'tap' || options.takesTap)).map((item) => <button
      key={item.id} type="button" aria-pressed={view === item.id} onClick={() => changeView(item.id)}>{item.label}</button>)}</div>
    {loading && <p role="status">履修情報を読み込み中です…</p>}
    {error && <div role="alert" className="handbook-notice">{error} <button type="button" onClick={() => setRetry((count) => count + 1)}>再読み込み</button></div>}
    {view === 'hirameki' && <HiramekiPanel programs={relevantPrograms} sources={sources} allYearsData={allYearsData} onOpenSource={openSource} />}
    {view === 'graduation' && degreeError && <p role="alert">{degreeError}</p>}
    {view === 'graduation' && !degreeReady && !degreeError && <p role="status">必要単位を読み込み中です…</p>}
    {view === 'graduation' && degreeReady && degreeDataset.graduateRequirements && <GraduateGuide requirements={degreeDataset.graduateRequirements} courses={degreeDataset.courses} data={allYearsData} />}
    {view === 'graduation' && !loading && degreeReady && department && !department.studyLevel && <GuideProgress key={`${department.id}:${entranceYear}`} documents={documents} department={department.name} data={allYearsData} requirementSets={degreeRules} profileVariant={options.degreeVariant ?? ''} />}
    {view === 'teacher' && <p className="handbook-notice">免許種別ごとの必要単位・教育実習の条件を確認してください。</p>}
    {view === 'tap' && <p className="handbook-notice">学部・派遣先ごとの参加条件と単位認定・読み替えを確認してください。</p>}
    {view === 'tap' && <TapFaq />}
    {raw && <><div className="handbook-filters">
      <label>キーワード<input type="search" value={query} placeholder="例：卒業要件、微分積分、選択必修" onChange={(event) => { setQuery(event.target.value); setPageLimit(PAGE_SIZE); }} /></label>
      <label>資料<select value={sourceId} onChange={(event) => { setSourceId(event.target.value); setPageLimit(PAGE_SIZE); }}>
        <option value="">{view === 'hirameki' ? '該当パンフレット' : '該当学修要覧すべて'}</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.faculty} {source.label}</option>)}
      </select></label>
    </div>
    {loading ? <p role="status">入学年度に対応する資料を読み込み中です…</p> : !relevantSources.length ?
      <p>この学科・入学年度に対応する公開学修要覧は収録されていません。</p> : <>
      {view === 'courses' ? <>
        <p className="small">{courseResults.length}件。原本と照合できた科目を掲載しています。必選・卒業算入条件は出典を確認してください。</p>
        <div className="handbook-table-scroll"><table><thead><tr><th>科目名</th><th>単位</th><th>出典</th></tr></thead>
          <tbody>{courseResults.slice(0, pageLimit).map(({ course, document }) => <tr key={course.id}>
            <td>{course.verification?.titleText}</td><td>{course.credits}</td>
            <td><a href={localHandbookUrl(document.localPath, course.page)} target="_blank" rel="noopener noreferrer">{document.label} PDF {course.page}ページ</a></td>
          </tr>)}</tbody></table></div>
        {!courseResults.length && <p>一致する科目がありません。「全文・出典」でも検索してください。</p>}
      </> : <>
        <p className="small">該当 {pageResults.length}ページ</p>
        {pageResults.slice(0, pageLimit).map(({ document, page }) => <HandbookPageEvidence key={`${document.id}:${page.page}`} source={document} page={page} />)}
        {!pageResults.length && <p>一致するページがありません。「全文・出典」で検索範囲を広げるか、原本を確認してください。</p>}
      </>}
      {(view === 'courses' ? courseResults.length : pageResults.length) > pageLimit && <button type="button" onClick={() => setPageLimit((limit) => limit + PAGE_SIZE)}>次の{PAGE_SIZE}件を表示</button>}
    </>}

    </>}
    {raw && <details><summary>2026年度の開講情報を確認する</summary><OfferingBrowser departmentId={department?.id} /></details>}
  </section>;
}
