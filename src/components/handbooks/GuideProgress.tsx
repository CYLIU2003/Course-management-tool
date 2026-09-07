import { useMemo, useState } from 'react';
import type { HandbookDocument } from '../../core/handbooks';
import type { AcademicAllYearsData } from '../../core/types';
import { degreeCourseApplies, degreeCourseOption, degreeGroupProgress, degreeProgramProgress, degreeSurplus, guideCourses, sumCourseCredits } from '../../utils/guideProgress';
import type { DegreeRequirementSet } from '../../core/curriculum';

export default function GuideProgress({ documents, department, data, requirementSets, profileVariant }: { documents: HandbookDocument[]; department: string; data: AcademicAllYearsData; requirementSets?: DegreeRequirementSet[]; profileVariant?: string }) {
  const sourceCourses = useMemo(() => guideCourses(documents, department, data), [documents, department, data]);
  const [localVariant, setVariant] = useState('');
  const variant = profileVariant ?? localVariant;
  const requirements = requirementSets?.length === 1 ? requirementSets[0] : requirementSets?.find(set => set.variant === variant);
  const courses = sourceCourses.filter(entry => degreeCourseApplies(entry.course, department, entry.document.sha256)).map(entry => {
    const leaf = entry.category === '基礎科目' ? entry.course.classification?.path?.[1]?.label : entry.category;
    const category = requirements?.categories.find(rule => leaf && rule.courseCategories.includes(leaf));
    const option = degreeCourseOption(entry.course, entry.document, requirements);
    const requirementLabel = option?.courseType === 'required' ? '必修（原本：○）'
      : option?.courseType === 'elective-required' ? `選択必修（原本：${option.printedSymbol}）`
        : option?.courseType === 'designated' ? '選択科目（国際コース指定群）'
          : option?.courseType === 'unmarked' && requirements?.symbolLegend?.faculty === entry.document.faculty
            && requirements.symbolLegend.year === entry.document.year ? '選択科目（原本の凡例：無印）' : undefined;
    return { ...entry, leaf, symbol: option?.printedSymbol, category: category?.name ?? entry.category, requirementLabel };
  });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('すべて');
  const categories = [...new Set([...(requirements?.categories.map(category => category.name) ?? []), ...courses.map(entry => entry.category)])];
  const normalize = (text: string) => text.normalize('NFKC').replace(/\s/g, '').toLowerCase();
  const matches = courses.filter(entry => (status === 'すべて' || entry.status === status) && normalize(entry.title + entry.group).includes(normalize(query)));
  if (!courses.length) return null;
  if (requirementSets && requirementSets.length > 1 && !requirements) return <section className="guide-progress"><h3>所属コースを選んでください</h3><p>コースによって必要単位と必修科目が異なります。</p>{profileVariant !== undefined ? <p>上の設定で所属コースを選び、「履修区分を保存」を押してください。</p> : <label>所属コース<select value={variant} onChange={event => setVariant(event.target.value)}><option value="" disabled>選択してください</option>{requirementSets.map(set => <option key={set.id} value={set.variant}>{set.variantName}</option>)}</select></label>}</section>;
  return <section className="guide-progress" aria-label="区分ごとの科目と履修状況">
    {requirementSets && requirementSets.length > 1 && (profileVariant !== undefined ? <p>所属コース：{requirements?.variantName}</p> : <label>所属コース<select value={variant} onChange={event => setVariant(event.target.value)}>{requirementSets.map(set => <option key={set.id} value={set.variant}>{set.variantName}</option>)}</select></label>)}
    <div className="guide-intro"><div><span className="guide-kicker">あなたの履修状況</span><h3>あと何単位か、区分から確認。</h3><p>「成績・単位」の入力を反映しています。</p></div><div className="guide-record-count"><strong>{courses.filter(entry => entry.status === '修得済み').length}<small> / {courses.length}</small></strong><span>掲載科目のうち修得済み</span></div></div>
    <div className="guide-help"><span aria-hidden="true">i</span><p>表示は単位数の目安です。必修科目・算入上限など、卒業条件は各区分の「条件と出典」で確認してください。</p></div>
    <div className="guide-toolbar"><label>科目を検索<input type="search" placeholder="科目名・科目群" value={query} onChange={event => setQuery(event.target.value)} /></label><label>履修状況<select value={status} onChange={event => setStatus(event.target.value)}>{['すべて', '未登録', '履修予定', '修得済み', '不合格', '単位数要確認'].map(value => <option key={value}>{value}</option>)}</select></label></div>
    {(query || status !== 'すべて') && <p className="guide-filter-result" role="status">{matches.length}科目が該当します。区分の単位集計は全科目が対象です。 <button type="button" onClick={() => { setQuery(''); setStatus('すべて'); }}>絞り込みを解除</button></p>}
    <div className="guide-category-grid">{categories.filter(category => (!query && status === 'すべて') || matches.some(entry => entry.category === category)).map(category => {
      const entries = courses.filter(entry => entry.category === category);
      const visible = matches.filter(entry => entry.category === category);
      const earned = sumCourseCredits(entries, '修得済み');
      const planned = sumCourseCredits(entries, '履修予定');
      const rule = requirements?.categories.find(value => value.name === category);
      const minimum = rule && { credits: rule.minimumCredits, note: `${requirements!.evidence.article}に定める最低${rule.minimumCredits}単位。必修科目・選択必修群・算入上限は別途満たす必要があります。` };
      const excluded = requirements?.excludedCategories?.find(value => value.name === category);
      if (excluded) return <article className="guide-category" key={category}><h4>{category}</h4><p>卒業単位への算入対象外</p><p>{excluded.reason}</p><details><summary>該当科目 {visible.length}科目</summary><ul>{visible.map(entry => <li key={entry.course.id}>{entry.title} · {entry.course.credits}単位 · {entry.status}</li>)}</ul></details></article>;
      return <article className="guide-category" key={category}>
        <div className="guide-category-heading"><h4>{category}</h4><span className={`guide-badge ${minimum ? '' : 'guide-badge--review'}`}>{minimum ? '必要単位あり' : '必要単位を確認'}</span></div>
        <div className="guide-credit-heading"><div><span>修得済み</span><strong>{earned}<small>単位</small></strong></div><p>{minimum ? <>必要 <b>{minimum.credits}</b> 単位</> : '必要単位：未確認'}</p></div>
        {minimum ? <progress className="guide-credit-bar" aria-label={`${category}の修得済み単位`} value={Math.min(earned, minimum.credits)} max={minimum.credits || 1} /> : <div className="guide-unverified">原本で必要単位を確認すると、残りの目安が分かります。</div>}
        <dl className="guide-credit-breakdown"><div><dt>履修予定</dt><dd>{planned}<small>単位</small></dd></div><div><dt>数値上の残り</dt><dd>{minimum ? Math.max(0, minimum.credits - earned) : '—'}<small>{minimum ? '単位' : '未確認'}</small></dd></div></dl>
        {requirements?.groups?.filter(group => group.category === category).map(group => {
          const progress = degreeGroupProgress(entries, group);
          const conflict = requirements.sourceConflicts?.find(issue => issue.groupId === group.id);
          return <section className="guide-subgroup" key={group.id} aria-label={group.name}>
            <h5>{group.name}</h5>
            <p>修得 {progress.earned} / 必要 {group.minimumCredits} 単位 · {conflict ? '原本の不一致により達成判定を保留' : progress.complete ? '条件達成' : `残り ${progress.remaining} 単位`}</p>
            {conflict && <p className="handbook-notice">{conflict.message}</p>}
            <progress className="guide-credit-bar" value={Math.min(progress.earned, group.minimumCredits)} max={group.minimumCredits} aria-label={`${group.name}の修得状況`} />
            {group.membership === 'all_marked' && progress.missing.length > 0 && <p>未修得の必修科目 {progress.missing.length} 科目</p>}
            <details><summary>対象科目と履修状況（{progress.members.length}科目）</summary><ul>{progress.members.map(entry => <li key={entry.course.id}>{entry.course.verification?.titleText ?? entry.course.title} · {entry.course.credits}単位 · {entry.status}</li>)}</ul><p>履修要覧 PDF {group.evidence.page}ページの条件。</p></details>
          </section>;
        })}
        <details className="guide-source"><summary>条件と出典</summary><p>{minimum ? minimum.note : 'この区分の必要単位は、卒業要件表との対応が未確認です。「卒業・必要単位」の原本ページを確認してください。'}</p><p>同じ科目は1回だけ集計。履修予定は修得済みに含めていません。区分は科目表から抽出した分類です。</p></details>
        <details className="guide-course-disclosure" open={query !== '' || status !== 'すべて' ? true : undefined}><summary><span>該当科目を見る <b>{visible.length}</b></span><small>表示科目の合計 {sumCourseCredits(visible)}単位</small></summary>
          {[...new Set(visible.map(entry => entry.group))].map(group => <section className="guide-subgroup" key={group}><h5>{group}</h5><p>{visible.filter(entry => entry.group === group).length}科目 · 修得 {sumCourseCredits(visible.filter(entry => entry.group === group), '修得済み')}単位 · 予定 {sumCourseCredits(visible.filter(entry => entry.group === group), '履修予定')}単位</p><ul className="guide-course-list">{visible.filter(entry => entry.group === group).map(entry => <li key={entry.course.id}><div className="guide-course-name"><strong>{entry.title}</strong><small>{entry.requirementLabel ?? (entry.printedRequirement ? `原本の必選記号：${entry.printedRequirement}` : '必修・選択の条件は原本確認')}</small></div><div className="guide-course-result"><strong>{entry.course.credits}<small>単位</small></strong><span className="guide-course-status" data-status={entry.status}>{entry.status}</span></div></li>)}</ul></section>)}
        </details>
      </article>;
    })}</div>
    {requirements?.conditions?.map(condition => {
      const progress = degreeProgramProgress(courses, condition.marks);
      return <article className="guide-category" key={condition.id}>
        <h4>{condition.name}</h4><p>修得 {progress.earned} / 必要 {condition.minimumCredits} 単位</p>
        <progress className="guide-credit-bar" max={condition.minimumCredits} value={Math.min(progress.earned, condition.minimumCredits)} aria-label={`${condition.name}の修得状況`} />
        <p>上の科目区分に含まれる単位の内数です。卒業単位へ二重に加算しません。</p>
        <details><summary>対象科目（{progress.members.length}科目）</summary><ul>{progress.members.map(entry => <li key={entry.course.id}>{entry.title} · {entry.course.credits}単位 · {entry.status}</li>)}</ul></details>
      </article>;
    })}
    {requirements && (() => {
      const surplus = degreeSurplus(courses, requirements);
      const required = requirements.freeChoice.minimumCredits;
      return <article className="guide-category"><h4>自由選択</h4><div className="guide-credit-heading"><strong>{surplus}<small>単位</small></strong><p>必要 <b>{required}</b> 単位</p></div><progress className="guide-credit-bar" value={Math.min(surplus, required)} max={required} aria-label="自由選択の超過単位" /><p>{requirements.freeChoice.note}</p><p>数値上の残り {Math.max(0, required - surplus)}単位。修得した科目の算入条件を満たした場合の目安です。</p></article>;
    })()}
  </section>;
}
