import type { CurriculumDataset } from '../../core/curriculum';
import type { AcademicAllYearsData, AcademicCourse } from '../../utils/academicProgress';
import { graduateCourseProgress } from '../../utils/graduateProgress';

export default function GraduateGuide({ requirements, courses, data }: { requirements: NonNullable<CurriculumDataset['graduateRequirements']>; courses: AcademicCourse[]; data: AcademicAllYearsData }) {
  const entries = graduateCourseProgress(courses, data);
  if (requirements.creditBasis === 'not_credit_based') return <section className="guide-progress" aria-label="博士課程の修了条件">
    <h3>研究活動と学位審査</h3><p>この課程は単位制の授業ではなく、研究指導・研究活動と学位審査による修了条件です。</p>
    <ul>{requirements.activities?.map(activity => <li key={activity.id}>{activity.title}</li>)}</ul>
    <p>履修要覧 PDF {requirements.evidence.page}ページに基づきます。</p>
  </section>;
  return <section className="guide-progress" aria-label="大学院の修了条件">
    <div className="guide-intro"><div><span className="guide-kicker">修了に必要な単位</span><h3>合計 {requirements.totalCredits} 単位</h3><p>所属する専攻・領域の研究科目と、授業科目の条件をそれぞれ満たします。</p></div></div>
    <div className="guide-category-grid">{requirements.categories.map(category => {
      const members = entries.filter(entry => entry.course.degreeCategory && (category.courseCategories ?? [category.name]).includes(entry.course.degreeCategory));
      const earned = members.filter(entry => entry.status === '修得済み').reduce((sum, entry) => sum + entry.course.credits, 0);
      const remaining = Math.max(0, category.minimumCredits - earned);
      return <article className="guide-category" key={category.name}>
        <h4>{category.name}</h4><div className="guide-credit-heading"><strong>{earned}<small> / {category.minimumCredits} 単位</small></strong><span>{remaining ? `あと ${remaining} 単位` : '単位数を充足'}</span></div>
        <progress className="guide-credit-bar" max={category.minimumCredits} value={Math.min(earned, category.minimumCredits)} aria-label={`${category.name}の修得単位`} />
        <details className="guide-course-disclosure"><summary>該当科目と修得状況（{members.length}科目）</summary><ul className="guide-course-list">{members.map(({ course, status }) => <li key={course.id}><div className="guide-course-name"><strong>{course.title}</strong><small>{course.courseType === 'required' ? '必修' : course.courseType === 'elective-required' ? '選択必修' : '選択'}{course.tags?.length ? ` · ${course.tags.join('・')}` : ''}</small></div><div className="guide-course-result"><strong>{course.credits}<small>単位</small></strong><span className="guide-course-status" data-status={status}>{status}</span></div></li>)}</ul></details>
      </article>;
    })}</div>
    {requirements.campusMinimumCredits && <p>{Object.entries(requirements.campusMinimumCredits).map(([campus, credits]) => `${campus}の開講科目から${credits}単位以上`).join('、')}が必要です。</p>}
    {requirements.researchCreditsWithinTcu != null && <p>本学を主大学とする場合、本学の単位に文献研究・演習と特別研究から{requirements.researchCreditsWithinTcu}単位を含めます。</p>}
    {requirements.issues.map(issue => <p className="handbook-notice" key={issue.kind}>{issue.message}</p>)}
    <p>履修要覧 PDF {requirements.evidence.page}ページ。研究指導・学位論文審査等の条件も別途必要です。</p>
  </section>;
}
