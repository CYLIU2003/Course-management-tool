import { useEffect, useMemo, useState } from 'react';
import { generateRequirementCategoryDetail } from '../../api/requirements';
import {
  calculateRequirementProgressPercent,
  calculateRequirementStatus,
  CATEGORY_COURSE_TAB_LABELS,
  filterCoursesByTab,
  REQUIREMENT_STATUS_THEME,
  type CategoryCourse,
  type CategoryCourseTab,
  type RequirementCategoryDetail,
} from '../../utils/requirements';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum } from '../../utils/academicProgress';
import type { ApplicableCourseRow } from '../../utils/csvImporter';
import RequirementCourseList from './RequirementCourseList';
import RequirementStatusBadge from './RequirementStatusBadge';

interface RequirementCategoryDetailDrawerProps {
  open: boolean;
  categoryId: string | null;
  title?: string;
  onClose: () => void;
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  applicableCourses: ApplicableCourseRow[];
}

export default function RequirementCategoryDetailDrawer({
  open,
  categoryId,
  title,
  onClose,
  curriculum,
  allYearsData,
  courses,
  applicableCourses,
}: RequirementCategoryDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<CategoryCourseTab>('candidate');
  const [plannedCourseIds, setPlannedCourseIds] = useState<string[]>([]);

  useEffect(() => {
    if (open && categoryId) {
      setActiveTab('candidate');
    }
  }, [categoryId, open]);

  useEffect(() => {
    if (open) {
      setPlannedCourseIds([]);
    }
  }, [open, categoryId]);

  const baseDetail = useMemo<RequirementCategoryDetail | null>(() => {
    if (!open || !categoryId || !curriculum) {
      return null;
    }

    return generateRequirementCategoryDetail(categoryId, curriculum, courses, allYearsData, applicableCourses);
  }, [allYearsData, applicableCourses, categoryId, courses, curriculum, open]);

  const detail = useMemo<RequirementCategoryDetail | null>(() => {
    if (!baseDetail) {
      return null;
    }

    const plannedCourseSet = new Set(plannedCourseIds);

    const coursesWithPlannedSelections = baseDetail.courses.map((candidate) => {
      if (!plannedCourseSet.has(candidate.courseId) || candidate.takenStatus !== 'not_taken' || candidate.matchState !== 'eligible_for_this_category') {
        return candidate;
      }

      return {
        ...candidate,
        takenStatus: 'planned' as const,
      };
    });

    const extraPlannedCredits = plannedCourseIds.reduce((total, courseId) => {
      const candidate = baseDetail.courses.find((course) => course.courseId === courseId);

      if (!candidate || candidate.takenStatus !== 'not_taken' || candidate.matchState !== 'eligible_for_this_category') {
        return total;
      }

      return total + candidate.credits;
    }, 0);

    const plannedCredits = baseDetail.plannedCredits + extraPlannedCredits;

    return {
      ...baseDetail,
      plannedCredits,
      remainingCredits: Math.max(0, baseDetail.requiredCredits - baseDetail.earnedCredits - plannedCredits),
      status: calculateRequirementStatus(baseDetail.requiredCredits, baseDetail.earnedCredits, plannedCredits),
      courses: coursesWithPlannedSelections,
    };
  }, [baseDetail, plannedCourseIds]);

  const candidateCount = useMemo(() => filterCoursesByTab(detail?.courses ?? [], 'candidate').length, [detail]);

  function handlePlanCourse(course: CategoryCourse) {
    setPlannedCourseIds((currentIds) => (currentIds.includes(course.courseId) ? currentIds : [...currentIds, course.courseId]));
  }

  if (!open || !categoryId) {
    return null;
  }

  const theme = detail ? REQUIREMENT_STATUS_THEME[detail.status] : REQUIREMENT_STATUS_THEME.shortage;
  const progressPercent = detail
    ? calculateRequirementProgressPercent(detail.requiredCredits, detail.earnedCredits, detail.plannedCredits)
    : 0;
  const candidateCourses = filterCoursesByTab(detail?.courses ?? [], 'candidate').slice(0, 3);

  return (
    <div className="tt-modal tt-modal--drawer" onClick={onClose}>
      <div className="tt-dialog requirement-drawer" onClick={(event) => event.stopPropagation()}>
        <div className="tt-dialog__head">
          <div className="requirement-drawer__header">
            <h2 style={{ margin: 0 }}>{title ?? detail?.categoryName ?? '区分詳細'}</h2>
            <p className="requirement-drawer__description">{detail?.description ?? '区分に含まれる授業と、要件への算入状況を確認できます。'}</p>
          </div>
          <button type="button" onClick={onClose} className="tt-close" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="tt-dialog__body">
          {detail ? (
            <div style={{ display: 'grid', gap: '1rem' }}>
              <section className="requirement-drawer__summary">
                <div className="requirement-drawer__metrics">
                  <div className="requirement-drawer__metric">
                    <p className="requirement-drawer__metric-label">必要単位</p>
                    <p className="requirement-drawer__metric-value">{detail.requiredCredits} 単位</p>
                  </div>
                  <div className="requirement-drawer__metric">
                    <p className="requirement-drawer__metric-label">取得済</p>
                    <p className="requirement-drawer__metric-value">{detail.earnedCredits} 単位</p>
                  </div>
                  <div className="requirement-drawer__metric">
                    <p className="requirement-drawer__metric-label">履修予定</p>
                    <p className="requirement-drawer__metric-value">{detail.plannedCredits} 単位</p>
                  </div>
                  <div className="requirement-drawer__metric">
                    <p className="requirement-drawer__metric-label">残り</p>
                    <p className="requirement-drawer__metric-value">{detail.remainingCredits} 単位</p>
                  </div>
                </div>

                <div className="requirement-drawer__progress">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                    <RequirementStatusBadge status={detail.status} />
                    <span className="small" style={{ color: 'var(--muted)' }}>
                      進捗 {progressPercent}%
                    </span>
                  </div>
                  <div className="requirement-drawer__progress-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${progressPercent}%`,
                        background: `linear-gradient(135deg, ${theme.color}, color-mix(in oklab, ${theme.color} 60%, white 40%))`,
                      }}
                    />
                  </div>
                </div>

                <div className="requirement-drawer__candidate">
                  <div>
                    <strong>不足を埋める候補</strong>
                    <p>
                      {detail.remainingCredits > 0
                        ? candidateCourses.length > 0
                          ? candidateCourses.map((course) => course.courseName).join(' / ')
                          : '今すぐ候補にできる授業はまだ登録されていません。'
                        : 'この区分は履修予定込みで達成見込みです。'}
                    </p>
                  </div>
                  {candidateCount > 0 ? (
                    <button type="button" className="btn-ghost" onClick={() => setActiveTab('candidate')}>
                      候補を見る
                    </button>
                  ) : null}
                </div>
              </section>

              <RequirementCourseList courses={detail.courses} activeTab={activeTab} onTabChange={setActiveTab} onPlanCourse={handlePlanCourse} />
            </div>
          ) : (
            <div className="requirement-empty">区分データを読み込めませんでした。</div>
          )}
        </div>

        <div className="tt-dialog__foot">
          <div className="small" style={{ color: 'var(--muted)' }}>
            {detail ? `${detail.totalEligibleCourses ?? 0} 件の該当授業を確認できます。` : CATEGORY_COURSE_TAB_LABELS[activeTab]}
          </div>
          <div className="foot-actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
