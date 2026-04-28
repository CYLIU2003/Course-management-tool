import { useEffect, useMemo, useState } from 'react';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicYear } from '../utils/academicProgress';
import { calculateGraduationRequirements } from '../utils/graduationRequirements';
import { fetchRequirementCategories } from '../api/requirements';
import RequirementCategoryGrid from './requirements/RequirementCategoryGrid';
import RequirementCategoryDetailDrawer from './requirements/RequirementCategoryDetailDrawer';
import type { RequirementCategorySummary } from '../utils/requirements';

type GraduationRequirementPanelProps = {
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  currentYear?: AcademicYear;
};
const CATEGORY_LOAD_ERROR = '区分一覧を読み込めませんでした。';

export default function GraduationRequirementPanel({ curriculum, allYearsData, courses, currentYear }: GraduationRequirementPanelProps) {
  const result = useMemo(() => calculateGraduationRequirements({ allYearsData, courses, curriculum }), [allYearsData, courses, curriculum]);
  const [categories, setCategories] = useState<RequirementCategorySummary[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      setLoadingCategories(true);
      setCategoryError(null);

      try {
        const nextCategories = await fetchRequirementCategories();
        if (!cancelled) {
          setCategories(nextCategories);
        }
      } catch (loadError) {
        if (!cancelled) {
          setCategoryError(loadError instanceof Error ? loadError.message : CATEGORY_LOAD_ERROR);
        }
      } finally {
        if (!cancelled) {
          setLoadingCategories(false);
        }
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentRequiredCredits = result.statuses.find((status) => status.category === 'total')?.requiredCredits ?? curriculum?.requiredCredits ?? 0;

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>区分別 該当授業・要件算入状況</h2>
          <span className="small">区分ごとの該当授業と、卒業要件への算入状況をひとつの画面で確認できます</span>
        </div>
        <span className="course-tag course-tag--neutral" style={{ fontWeight: 800 }}>
          {result.plannedCredits > 0 ? `履修予定 ${result.plannedCredits} 単位` : '履修予定なし'}
        </span>
      </div>

      {!curriculum ? (
        <div
          style={{
            padding: '0.9rem 1rem',
            borderRadius: '12px',
            border: '1px solid color-mix(in oklab, #f59e0b 30%, var(--stroke) 70%)',
            background: 'color-mix(in oklab, #f59e0b 10%, var(--card) 90%)',
            color: 'var(--text)',
            marginBottom: '1rem',
          }}
        >
          卒業要件CSVが未読込です。区分別の表示はモックデータで確認できますが、実データの卒業判定は要件CSVを読み込むと有効になります。
        </div>
      ) : null}

      <div className="small" style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
        現在の集計: 取得済 {result.earnedCredits} 単位 / 履修予定 {result.plannedCredits} 単位 / 必要 {currentRequiredCredits} 単位
      </div>

      <RequirementCategoryGrid
        categories={categories}
        currentYear={currentYear}
        loading={loadingCategories}
        error={categoryError}
        onRetry={() => {
          setCategoryError(null);
          setLoadingCategories(true);
          fetchRequirementCategories()
            .then((nextCategories) => {
              setCategories(nextCategories);
            })
            .catch((loadError) => {
              setCategoryError(loadError instanceof Error ? loadError.message : CATEGORY_LOAD_ERROR);
            })
            .finally(() => {
              setLoadingCategories(false);
            });
        }}
        onOpenDetail={setOpenCategoryId}
      />

      <RequirementCategoryDetailDrawer
        open={openCategoryId !== null}
        categoryId={openCategoryId}
        onClose={() => setOpenCategoryId(null)}
      />
    </section>
  );
}