import { useMemo, useState } from 'react';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicYear } from '../utils/academicProgress';
import { generateRequirementCategories } from '../api/requirements';
import RequirementCategoryGrid from './requirements/RequirementCategoryGrid';
import RequirementCategoryDetailDrawer from './requirements/RequirementCategoryDetailDrawer';
import type { ApplicableCourseRow } from '../utils/csvImporter';

type GraduationRequirementPanelProps = {
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  applicableCourses: ApplicableCourseRow[];
  currentYear?: AcademicYear;
};

export default function GraduationRequirementPanel({ curriculum, allYearsData, courses, applicableCourses }: GraduationRequirementPanelProps) {
  const categories = useMemo(() => {
    if (!curriculum) return [];
    return generateRequirementCategories(curriculum, courses, allYearsData, applicableCourses);
  }, [curriculum, courses, allYearsData, applicableCourses]);

  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const selectedTitle = useMemo(() => {
    if (!openCategoryId || !categories) return '';
    const cat = categories.find((c) => c.categoryId === openCategoryId);
    return cat ? cat.categoryName : '要件詳細';
  }, [categories, openCategoryId]);

  return (
    <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
      <div className="p-6 border-b border-slate-200 pb-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">卒業要件の達成状況</h2>
        </div>
        <p className="text-sm text-slate-500 ml-13">教育課程表に基づく単位取得状況。計画通りに履修した場合のシミュレーション情報を含みます。</p>
      </div>
      
      <div className="p-6">
        <RequirementCategoryGrid 
          categories={categories}
          onOpenDetail={setOpenCategoryId}
        />
      </div>

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
    </section>
  );
}
