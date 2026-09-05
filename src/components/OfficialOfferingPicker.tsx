import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { responseError } from '../api/account';
import { AVAILABLE_DEPARTMENTS } from '../core/departments';
import type { AcademicQuarter, CourseOffering } from '../utils/academicProgress';
import { officialCandidates, type OfficialCatalog } from '../utils/officialOffering';

export default function OfficialOfferingPicker({ title, departmentId, day, period, quarter, onSelect, selectedId }: {
  selectedId?: string;
  title: string; departmentId: string; day: string; period: number; quarter: AcademicQuarter;
  onSelect: (offering: CourseOffering) => void;
}) {
  const [catalog, setCatalog] = useState<OfficialCatalog | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/offerings/2026', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(await responseError(response));
      const data: OfficialCatalog = await response.json();
      if (!controller.signal.aborted) { setCatalog(data); setError(''); }
    }).catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '開講情報の取得に失敗しました'); });
    return () => controller.abort();
  }, [attempt]);
  const campus = AVAILABLE_DEPARTMENTS.find(d => d.id === departmentId)?.campus === '横浜' ? 'yokohama' : 'setagaya';
  const candidates = catalog ? officialCandidates(catalog, title, departmentId, campus, day, period, quarter) : [];
  return <section className="official-picker" aria-label="公式時間割から自動入力">
    <div className="official-picker-heading"><h3>教員・教場をまとめて入力</h3><span className="guide-badge">2026年度</span></div>
    <p className="official-picker-description">{day}曜{period}限・{quarter}の候補です。受講対象を確認してクラスを選んでください。</p>
    {error ? <p role="alert">{error} <button type="button" onClick={() => setAttempt(n => n + 1)}>再試行</button></p> : !catalog ? <p role="status">開講情報を読み込み中…</p> : candidates.length === 0 ? <div className="official-picker-empty"><strong>一致するクラスが見つかりません</strong><p>科目名・曜日時限・開講期を確認するか、下の欄へ直接入力してください。未掲載・訂正確認中の授業は候補に含まれません。</p></div> : <div className="official-options">{candidates.map(offering => <article className="official-option" data-selected={selectedId === offering.id} key={offering.id}>
      <div className="official-option-meta"><span>{offering.term} · {offering.lectureCode}</span>{selectedId === offering.id && <strong>✓ 選択済み</strong>}</div>
      <dl><div><dt>担当教員</dt><dd>{offering.teacher || '記載なし'}</dd></div><div><dt>教場</dt><dd>{offering.room || '記載なし'}</dd></div></dl>
      <details><summary>受講対象を確認</summary><p>{offering.target || '対象の記載なし'}</p>{offering.remarks && <p>{offering.remarks}</p>}</details>
      <button className="official-select" type="button" aria-pressed={selectedId === offering.id} aria-label={`${offering.lectureCode}の教員・教場を入力`} onClick={() => onSelect(offering)}>{selectedId === offering.id ? '選択した内容を再入力' : 'このクラスを選ぶ'}</button>
    </article>)}</div>}
    <p className="official-picker-footnote">2026年度の開講情報です。ほかの年度の教員・教場は手入力してください。</p>
    <p className="official-picker-feedback" role="status">{selectedId && candidates.some(candidate => candidate.id === selectedId) ? '選択内容を入力しました。内容を確認して「時間割に保存」で確定してください。' : ''}</p>
  </section>;
}
