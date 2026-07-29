import { useEffect, useMemo, useState } from 'react';
import { collectAcademicCourseRecords } from '../core/courseRecords';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicYear } from '../utils/academicProgress';
import { AVAILABLE_DEPARTMENTS } from '../utils/autoLoadCSV';
import { parseCreditRequirementsFile, type CreditRequirementRow } from '../utils/csvImporter';

type ProgressionRequirementsPanelProps = {
  curriculum?: AcademicCurriculum;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  currentYear?: AcademicYear;
};

type MilestoneStatus = 'met' | 'planned' | 'unmet' | 'review';

type Milestone = {
  stage: string;
  requiredCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  status: MilestoneStatus;
  note: string;
  reason: string;
};

const STATUS_LABELS: Record<MilestoneStatus, string> = {
  met: '条件達成',
  planned: '履修予定込み',
  unmet: '不足あり',
  review: '追加確認が必要',
};

const STATUS_STYLES: Record<MilestoneStatus, { background: string; border: string; color: string }> = {
  met: {
    background: 'color-mix(in oklab, var(--primary-soft) 82%, var(--surface) 18%)',
    border: 'color-mix(in oklab, var(--primary) 28%, var(--border-soft) 72%)',
    color: 'var(--primary-strong)',
  },
  planned: {
    background: 'color-mix(in oklab, var(--info-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--info) 28%, var(--border-soft) 72%)',
    color: 'var(--info)',
  },
  unmet: {
    background: 'color-mix(in oklab, var(--warning-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--warning) 28%, var(--border-soft) 72%)',
    color: 'var(--warning)',
  },
  review: {
    background: 'color-mix(in oklab, var(--border-soft) 62%, var(--surface) 38%)',
    border: 'var(--border)',
    color: 'var(--text-sub)',
  },
};

function parseEntranceYear(curriculum?: AcademicCurriculum) {
  const match = curriculum?.name.match(/(20\d{2})年度入学/);
  return match ? Number(match[1]) : undefined;
}

function buildRequirementPaths(facultyId: string, departmentId: string, entranceYear: number) {
  const base = `/department/${facultyId}`;
  const paths = [
    `${base}/${entranceYear}/${departmentId}_credit_requirements.csv`,
    `${base}/${departmentId}_credit_requirements.csv`,
  ];

  if (facultyId === 'rikou') {
    paths.push(`/department/rikou/${entranceYear}/${departmentId}_credit_requirements.csv`);
    paths.push(`/department/rikou/${departmentId}_credit_requirements.csv`);
  }

  return [...new Set(paths)];
}

async function loadRequirementRows(paths: string[]) {
  const errors: string[] = [];

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: 'no-store' });
      if (!response.ok) {
        errors.push(`${path}: HTTP ${response.status}`);
        continue;
      }

      const text = await response.text();
      const filename = path.split('/').pop() ?? 'credit_requirements.csv';
      const parsed = await parseCreditRequirementsFile(new File([text], filename, { type: 'text/csv' }));
      if (parsed.errors.length > 0) {
        errors.push(`${path}: ${parsed.errors[0]?.message ?? 'CSV解析エラー'}`);
        continue;
      }

      return { rows: parsed.rows, path };
    } catch (error) {
      errors.push(`${path}: ${error instanceof Error ? error.message : '読込エラー'}`);
    }
  }

  throw new Error(errors.join(' / ') || '進級要件CSVを読み込めませんでした。');
}

function groupMilestoneRows(rows: Array<CreditRequirementRow & { __rowNumber: number }>) {
  const grouped = new Map<string, Array<CreditRequirementRow & { __rowNumber: number }>>();

  for (const row of rows) {
    if (!row.stage || row.stage === '卒業') continue;
    const current = grouped.get(row.stage) ?? [];
    current.push(row);
    grouped.set(row.stage, current);
  }

  return [...grouped.entries()];
}

function hasUnstructuredCondition(note: string) {
  return /各学科|在学|着手条件|別途|その他/.test(note);
}

function extractRequiredCredits(rows: Array<CreditRequirementRow & { __rowNumber: number }>) {
  const structured = rows.map((row) => row.total_required_credits).filter((value) => value > 0);
  const fromNotes = rows.flatMap((row) =>
    [...(row.notes ?? '').matchAll(/(\d+(?:\.\d+)?)\s*単位(?:以上)?/g)].map((match) => Number(match[1])),
  );
  return Math.max(...structured, ...fromNotes, 0);
}

function evaluateMilestones(
  rows: Array<CreditRequirementRow & { __rowNumber: number }>,
  earnedCredits: number,
  plannedCredits: number,
) {
  const grouped = groupMilestoneRows(rows);
  const base = grouped.map(([stage, stageRows]) => ({
    stage,
    requiredCredits: extractRequiredCredits(stageRows),
    note: [...new Set(stageRows.map((row) => row.notes).filter((note): note is string => Boolean(note)))].join(' / '),
  }));

  const evaluated = new Map<string, Milestone>();

  for (const rule of base) {
    const creditConditionMet = rule.requiredCredits <= 0 || earnedCredits >= rule.requiredCredits;
    const creditConditionPlanned = rule.requiredCredits > 0 && earnedCredits + plannedCredits >= rule.requiredCredits;
    const dependency = base.find((candidate) => candidate.stage !== rule.stage && rule.note.includes(candidate.stage));
    const dependencyResult = dependency ? evaluated.get(dependency.stage) : undefined;
    const dependencyMet = !dependency || dependencyResult?.status === 'met';
    const dependencyPlanned = dependencyResult?.status === 'planned';
    const dependencyNeedsReview = dependencyResult?.status === 'review';
    const extraConfirmation = hasUnstructuredCondition(rule.note);

    let status: MilestoneStatus = 'unmet';
    let reason = rule.requiredCredits > 0
      ? `${earnedCredits} / ${rule.requiredCredits} 単位`
      : '単位数以外の条件です。';

    if (creditConditionMet && dependencyMet) {
      status = extraConfirmation ? 'review' : 'met';
      reason = extraConfirmation
        ? '単位条件は満たしています。学科固有条件・在学期間などを履修要綱で確認してください。'
        : '登録済み成績から確認できる条件を満たしています。';
    } else if (creditConditionPlanned && dependencyMet) {
      status = 'planned';
      reason = `取得済 ${earnedCredits} 単位、履修予定込み ${earnedCredits + plannedCredits} 単位です。`;
    } else if (dependency && dependencyNeedsReview && creditConditionMet) {
      status = 'review';
      reason = `${dependency.stage}の単位条件は満たしていますが、学科固有条件などの確認が必要です。`;
    } else if (dependency && dependencyPlanned && (creditConditionMet || creditConditionPlanned)) {
      status = 'planned';
      reason = `${dependency.stage}が履修予定込みのため、この条件も確定前です。`;
    } else if (dependency && !dependencyMet) {
      status = 'unmet';
      reason = `${dependency.stage}の条件が未達成です。`;
    }

    const milestone: Milestone = {
      stage: rule.stage,
      requiredCredits: rule.requiredCredits,
      earnedCredits,
      plannedCredits,
      status,
      note: rule.note,
      reason,
    };
    evaluated.set(rule.stage, milestone);
  }

  return base.map((rule) => evaluated.get(rule.stage)).filter((milestone): milestone is Milestone => Boolean(milestone));
}

export default function ProgressionRequirementsPanel({
  curriculum,
  allYearsData,
  courses,
  currentYear,
}: ProgressionRequirementsPanelProps) {
  const [rows, setRows] = useState<Array<CreditRequirementRow & { __rowNumber: number }>>([]);
  const [sourcePath, setSourcePath] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);

  const context = useMemo(() => {
    const departmentId = courses.find((course) => course.departmentId)?.departmentId;
    const entranceYear = parseEntranceYear(curriculum);
    const department = AVAILABLE_DEPARTMENTS.find((candidate) => candidate.id === departmentId);
    if (!departmentId || !department || !entranceYear) return null;

    return {
      departmentId,
      facultyId: department.facultyId,
      entranceYear,
      paths: buildRequirementPaths(department.facultyId, departmentId, entranceYear),
    };
  }, [courses, curriculum]);

  useEffect(() => {
    let cancelled = false;

    if (!context) {
      setRows([]);
      setSourcePath('');
      setLoadError('学科または入学年度を特定できません。');
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setLoadError('');
    void loadRequirementRows(context.paths)
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setSourcePath(result.path);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setRows([]);
        setSourcePath('');
        setLoadError(error instanceof Error ? error.message : '進級要件を読み込めませんでした。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [context]);

  const records = useMemo(
    () => collectAcademicCourseRecords(allYearsData, courses)
      .filter((record) => record.year !== 'M1' && record.year !== 'M2')
      .filter((record) => record.credits > 0 && record.courseType !== 'unknown'),
    [allYearsData, courses],
  );
  const earnedCredits = useMemo(
    () => records.filter((record) => record.status === 'passed').reduce((sum, record) => sum + record.credits, 0),
    [records],
  );
  const plannedCredits = useMemo(
    () => records.filter((record) => record.status === 'planned').reduce((sum, record) => sum + record.credits, 0),
    [records],
  );
  const milestones = useMemo(
    () => evaluateMilestones(rows, earnedCredits, plannedCredits),
    [earnedCredits, plannedCredits, rows],
  );

  if (!loading && milestones.length === 0 && !loadError) return null;

  return (
    <section className="tt-card" style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-title">
        <div>
          <h2>進級・卒業研究着手条件</h2>
          <span className="small">卒業単位とは別に、節目ごとの条件を確認します。</span>
        </div>
        {currentYear ? <span className="course-tag course-tag--neutral">表示学年 {currentYear}</span> : null}
      </div>

      {loading ? <p className="small">進級要件CSVを読み込んでいます。</p> : null}
      {loadError ? (
        <div className="requirement-empty">
          <strong>進級要件を確認できません</strong>
          <p className="small" style={{ marginBottom: 0 }}>{loadError}</p>
        </div>
      ) : null}

      {milestones.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.9rem' }}>
          {milestones.map((milestone) => {
            const style = STATUS_STYLES[milestone.status];
            return (
              <article
                key={milestone.stage}
                className="stats-card"
                style={{ borderColor: style.border, background: `linear-gradient(180deg, ${style.background}, var(--surface))` }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.75rem' }}>
                  <div>
                    <div className="stats-label">判定項目</div>
                    <div className="stats-value" style={{ fontSize: '1.05rem' }}>{milestone.stage}</div>
                  </div>
                  <span className="requirement-badge" style={{ background: style.background, border: `1px solid ${style.border}`, color: style.color }}>
                    {STATUS_LABELS[milestone.status]}
                  </span>
                </div>
                {milestone.requiredCredits > 0 ? (
                  <p style={{ margin: '0.75rem 0 0.35rem', fontWeight: 800 }}>
                    {milestone.earnedCredits} / {milestone.requiredCredits} 単位
                  </p>
                ) : null}
                <p className="small" style={{ margin: '0.45rem 0' }}>{milestone.reason}</p>
                {milestone.note ? (
                  <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>要綱記載: {milestone.note}</p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {sourcePath ? (
        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>
          判定元: {sourcePath}。CSVに数値化されていない学科固有条件は「追加確認が必要」として扱います。
        </p>
      ) : null}
    </section>
  );
}
