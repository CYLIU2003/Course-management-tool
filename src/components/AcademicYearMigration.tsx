import { useState } from 'react';
import type { AcademicAllYearsData } from '../core/types';
import { AVAILABLE_DEPARTMENTS } from '../core/departments';
import { hasAcademicRecords, isAcademicYear, migrateAcademicYears } from '../utils/academicYears';

export default function AcademicYearMigration({ data, departmentId, entranceYear, onComplete }: { data: AcademicAllYearsData; departmentId: string; entranceYear: number; onComplete: (data: AcademicAllYearsData) => void }) {
  const [mapping, setMapping] = useState<Record<string,string>>({});
  const [cohorts, setCohorts] = useState<Record<string,{departmentId:string; entranceYear:number}>>({});
  const [error, setError] = useState('');
  const records = Object.entries(data).filter(([key,value]) => isAcademicYear(key) || hasAcademicRecords(value));
  function complete() {
    try {
      for (const [key] of records) if (key.startsWith('M') && !cohorts[key]) throw new Error('大学院の記録は、当時の専攻と入学年度も指定してください。');
      const prepared = Object.fromEntries(Object.entries(data).map(([key,value]) => [key,{...value,...cohorts[key]}]));
      onComplete(migrateAcademicYears(prepared,mapping,departmentId,entranceYear));
    } catch(reason) { setError(reason instanceof Error ? reason.message : '移行できませんでした。'); }
  }
  return <section className="tt-card"><h2>以前の記録の年度を確認してください</h2><p>学年ごとの記録を、実際に授業を受けた年度へ移します。留年・休学・進学を推測して自動移動することはありません。記録のない空の枠は省略します。</p>
    {records.map(([key,value]) => {
      const cohort = cohorts[key] ?? {departmentId: value.departmentId ?? departmentId, entranceYear: value.entranceYear ?? entranceYear};
      return <fieldset key={key}><legend>{key} の記録</legend><div className="handbook-filters">
        <label>履修年度<input aria-label={`${key}の履修年度`} type="number" min="2000" max="2100" placeholder="例：2026" value={isAcademicYear(key) ? key : mapping[key] ?? ''} disabled={isAcademicYear(key)} onChange={event => setMapping({...mapping,[key]:event.target.value})}/></label>
        <label>当時の学科・専攻<select value={cohort.departmentId} onChange={event => setCohorts({...cohorts,[key]:{...cohort,departmentId:event.target.value}})}>{AVAILABLE_DEPARTMENTS.map(department => <option key={department.id} value={department.id}>{department.faculty} {department.name}</option>)}</select></label>
        <label>その課程への入学年度<input type="number" min="2022" max="2026" value={cohort.entranceYear} onChange={event => setCohorts({...cohorts,[key]:{...cohort,entranceYear:Number(event.target.value)}})}/></label>
      </div></fieldset>;
    })}
    {error && <p role="alert">{error}</p>}<button className="btn-primary" onClick={complete}>確認した年度で保存する</button>
  </section>;
}
