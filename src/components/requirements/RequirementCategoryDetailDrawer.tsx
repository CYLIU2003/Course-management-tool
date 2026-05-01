import { useEffect, useMemo, useState } from 'react';
import { fetchRequirementCategoryDetail } from '../../api/requirements';
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
import RequirementCourseList from './RequirementCourseList';
import RequirementStatusBadge from './RequirementStatusBadge';

interface RequirementCategoryDetailDrawerProps {
  open: boolean;
  categoryId: string | null;
  onClose: () => void;
}

export default function RequirementCategoryDetailDrawer({ open, categoryId, onClose }: RequirementCategoryDetailDrawerProps) {
  const [detail, setDetail] = useState<RequirementCategoryDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<CategoryCourseTab>('candidate');
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    if (!open || !categoryId) {
      return;
    }

    const currentCategoryId = categoryId;

    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError(null);
      setDetail(null);

      try {
        const nextDetail = await fetchRequirementCategoryDetail(currentCategoryId);
        if (!cancelled) {
          setDetail(nextDetail);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '区分詳細を読み込めませんでした。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [categoryId, open, reloadVersion]);

  useEffect(() => {
    if (open && categoryId) {
      setActiveTab('candidate');
    }
  }, [categoryId, open]);

  const candidateCount = useMemo(() => filterCoursesByTab(detail?.courses ?? [], 'candidate').length, [detail]);

  function handlePlanCourse(course: CategoryCourse) {
    setDetail((currentDetail) => {
      if (!currentDetail) {
        return currentDetail;
      }

      const targetCourse = currentDetail.courses.find((candidate) => candidate.courseId === course.courseId);
      if (!targetCourse || targetCourse.takenStatus !== 'not_taken' || targetCourse.matchState !== 'eligible_for_this_category') {
        return currentDetail;
      }

      const plannedCredits = currentDetail.plannedCredits + targetCourse.credits;
      const remainingCredits = Math.max(0, currentDetail.remainingCredits - targetCourse.credits);

      return {
        ...currentDetail,
        plannedCredits,
        remainingCredits,
        status: calculateRequirementStatus(currentDetail.requiredCredits, currentDetail.earnedCredits, plannedCredits),
        courses: currentDetail.courses.map((candidate) =>
          candidate.courseId === targetCourse.courseId ? { ...candidate, takenStatus: 'planned' } : candidate,
        ),
      };
    });
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
            <h2 style={{ margin: 0 }}>{detail?.categoryName ?? '区分詳細'}</h2>
            <p className="requirement-drawer__description">{detail?.description ?? '区分に含まれる授業と、要件への算入状況を確認できます。'}</p>
          </div>
          <button type="button" onClick={onClose} className="tt-close" aria-label="閉じる">
            ✕
          </button>
        </div>

        <div className="tt-dialog__body">
          {loading ? (
            <div style={{ display: 'grid', gap: '0.9rem' }}>
              <div className="requirement-empty">
                <div className="requirement-skeleton" style={{ width: '44%', height: '1rem', marginBottom: '0.6rem' }} />
                <div className="requirement-skeleton" style={{ width: '68%', height: '0.8rem' }} />
              </div>
              <div className="requirement-course-list">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="requirement-course-card">
                    <div className="requirement-skeleton" style={{ width: '58%', height: '1rem' }} />
                    <div className="requirement-skeleton" style={{ width: '36%', height: '0.8rem' }} />
                    <div className="requirement-skeleton" style={{ height: '3.2rem' }} />
                  </div>
                ))}
              </div>
            </div>
          ) : error ? (
            <div className="requirement-empty requirement-empty--error">
              <p style={{ marginTop: 0 }}>{error}</p>
              <button type="button" className="btn-ghost" onClick={() => setReloadVersion((value) => value + 1)}>
                再読み込み
              </button>
            </div>
          ) : detail ? (
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
          ) : null}
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
