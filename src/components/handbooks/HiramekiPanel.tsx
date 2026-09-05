import { useMemo } from 'react';
import type { AcademicAllYearsData } from '../../core/types';
import { matchProgramCourses, type HandbookSource, type HiramekiProgram } from '../../core/handbooks';
import { localHandbookUrl } from '../../api/handbooks';

interface Props {
  programs: HiramekiProgram[];
  sources: HandbookSource[];
  allYearsData: AcademicAllYearsData;
  onOpenSource: (id: string) => void;
}

export default function HiramekiPanel({ programs, sources, allYearsData, onOpenSource }: Props) {
  if (!programs.length) return <p className="handbook-notice">この学科・入学年度に対応するひらめきの情報はありません。</p>;
  return <div className="handbook-programs">{programs.map((program) => <ProgramCard
    key={program.id} program={program} source={sources.find((source) => source.id === program.sourceId)}
    allYearsData={allYearsData} onOpenSource={onOpenSource}
  />)}</div>;
}

function ProgramCard({ program, source, allYearsData, onOpenSource }: {
  program: HiramekiProgram; source?: HandbookSource; allYearsData: AcademicAllYearsData;
  onOpenSource: (id: string) => void;
}) {
  const matches = useMemo(() => matchProgramCourses(program, allYearsData), [program, allYearsData]);
  const matchedCredits = matches.reduce((sum, course) => sum + (course.status === 'passed' ? course.credits : 0), 0);
  return <article className="handbook-program">
    <header><div><span className="handbook-eyebrow">{program.entranceYears.join('・')}年度入学</span>
      <h3>{program.title}</h3></div><strong className="handbook-credit-total">{program.totalCredits}<small>単位構成</small></strong></header>
    <div className="handbook-group-grid">{program.groups.map((group) => <div key={group.name}>
      <span>{group.name}</span><strong>{group.credits}<small> 単位</small></strong>{group.note && <p>{group.note}</p>}
    </div>)}</div>
    {matches.length > 0 && <>
      <h4>対象科目と取得状況</h4>
      <p>{matchedCredits} / {program.totalCredits} 単位を成績から確認済み（修了認定は別途確認）。</p>
      <div className="handbook-table-scroll"><table><thead><tr><th>科目名</th><th>単位</th><th>成績との照合</th></tr></thead>
        <tbody>{matches.map((course) => <tr key={course.title}><td>{course.title}</td><td>{course.credits}</td>
          <td>{course.status === 'passed' ? '合格成績と一致' : course.status === 'check' ? '成績・単位数を確認' : '登録なし'}</td></tr>)}</tbody></table></div>
    </>}
    <details><summary>履修上の注意</summary><ul>{program.notes.map((note) => <li key={note}>{note}</li>)}</ul></details>
    {source && <div className="handbook-actions">
      <button type="button" onClick={() => onOpenSource(source.id)}>科目該当表・条件を読む</button>
      <a href={localHandbookUrl(source.localPath, program.sourcePage)} target="_blank" rel="noopener noreferrer">パンフレット原本（PDF {program.sourcePage}ページ）</a>
    </div>}
  </article>;
}
