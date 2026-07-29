import { useMemo, useState } from 'react';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicYear } from '../utils/academicProgress';
import { generateRequirementCategories } from '../api/requirements';
import type { ApplicableCourseRow } from '../utils/csvImporter';
import ProgramSupportPanel from './ProgramSupportPanel';
import ProgressionRequirementsPanel from './ProgressionRequirementsPanel';
import RequirementCategoryDetailDrawer from './requirements/RequirementCategoryDetailDrawer';
import RequirementCategoryGrid from './requirements/RequirementCategoryGrid';

type GraduationRequirementPanelProps = {
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  applicableCourses: ApplicableCourseRow[];
  currentYear?: AcademicYear;
};

export default function GraduationRequirementPanel({
  curriculum,
  allYearsData,
  courses,
  applicableCourses,
  currentYear,
}: GraduationRequirementPanelProps) {
  const categories = useMemo(() => {
    if (!curriculum) return [];
    return generateRequirementCategories(curriculum, courses, allYearsData, applicableCourses);
  }, [curriculum, courses, allYearsData, applicableCourses]);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const selectedTitle = useMemo(() => {
    if (!openCategoryId) return '';
    return categories.find((category) => category.categoryId === openCategoryId)?.categoryName ?? '要件詳細';
  }, [categories, openCategoryId]);

  return (
    <div className="page-stack">
      <section className="tt-card" style={{ display: 'grid', gap: '1rem' }}>
        <div className="section-title">
          <div>
            <h2>卒業要件の達成状況</h2>
            <span className="small">取得済・履修予定・未履修を分け、同じ科目を複数区分へ二重計上せず判定します。</span>
          </div>
          {curriculum ? (
            <span className="course-tag course-tag--neutral">必要 {curriculum.requiredCredits} 単位</span>
          ) : null}
        </div>

        {!curriculum ? (
          <div className="requirement-empty requirement-empty--error">
            学科と入学年度を選択し、卒業要件CSVを読み込んでください。
          </div>
        ) : (
          <RequirementCategoryGrid
            categories={categories}
            currentYear={currentYear}
            onOpenDetail={setOpenCategoryId}
          />
        )}

        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>
          科目コードを優先し、次に科目名・別名で履修実績と該当科目CSVを照合します。自由選択は、他区分の必要単位を満たした後の超過分として算出します。
        </p>
      </section>

      <ProgressionRequirementsPanel
        curriculum={curriculum}
        allYearsData={allYearsData}
        courses={courses}
        currentYear={currentYear}
      />

      <ProgramSupportPanel
        allYearsData={allYearsData}
        courses={courses}
        currentYear={currentYear}
      />

      <RequirementCategoryDetailDrawer
        open={openCategoryId !== null}
        title={selectedTitle}
        categoryId={openCategoryId}
        onClose={() => setOpenCategoryId(null)}
        curriculum={curriculum}
        allYearsData={allYearsData}
        courses={courses}
        applicableCourses={applicableCourses}
      />
    </div>
  );
}
