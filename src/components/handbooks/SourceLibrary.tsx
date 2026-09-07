import { useEffect, useState } from 'react';
import { loadHandbookCatalog, localHandbookUrl } from '../../api/handbooks';
import type { HandbookCatalog } from '../../core/handbooks';
import OfferingBrowser from '../OfferingBrowser';

export default function SourceLibrary() {
  const [catalog, setCatalog] = useState<HandbookCatalog>();
  const [year, setYear] = useState('2026');
  const [faculty, setFaculty] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    loadHandbookCatalog(controller.signal).then(setCatalog).catch(() => {
      if (!controller.signal.aborted) setError('資料を読み込めませんでした。画面を開き直してください。');
    });
    return () => controller.abort();
  }, []);
  const documents = catalog?.documents.filter(source => String(source.year) === year && (!faculty || source.faculty === faculty)
    && `${source.faculty} ${source.label}`.includes(query)) ?? [];
  return <section className="tt-card handbook-browser"><h2>資料・出典</h2>
    <p>学部・大学院の履修要覧、プログラム資料、時間割の原本をまとめています。ここでの資料選択は、保存中の時間割や所属を変更しません。</p>
    <div className="handbook-filters"><label>資料年度<select value={year} onChange={event => setYear(event.target.value)}>{[2026,2025,2024,2023,2022].map(value => <option key={value}>{value}</option>)}</select></label>
      <label>学部・研究科<select value={faculty} onChange={event => setFaculty(event.target.value)}><option value="">すべて</option>{[...new Set(catalog?.documents.map(source => source.faculty))].sort().map(name => <option key={name}>{name}</option>)}</select></label>
      <label>資料名<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="専攻・学科・プログラム名" /></label></div>
    {error && <p role="alert">{error}</p>}{!catalog && !error && <p role="status">資料を読み込み中です…</p>}
    <p>{documents.length}件の資料</p><ul className="guide-course-list">{documents.map(source => <li key={source.id}><div><strong>{source.faculty} · {source.label}</strong><p>{source.year}年度 · {source.pageCount}ページ</p></div><a className="btn-ghost" href={localHandbookUrl(source.localPath)} target="_blank" rel="noreferrer">原本PDFを開く ↗</a></li>)}</ul>
    {year === '2026' ? <details><summary>2026年度の授業時間割・教員・教場の原資料</summary><OfferingBrowser /></details> : <p>この資料庫の開講時間割は2026年度のみです。過去年度の時間割として流用しません。</p>}
  </section>;
}
