import { useMemo, useState, type ChangeEvent } from 'react';
import {
  HIRAMEKI_COURSE_GROUPS,
  UNIVERSITY_PROGRAMS,
  loadUniversityProgramProfile,
  saveUniversityProgramProfile,
  type UniversityProgramId,
  type UniversityProgramProfile,
} from '../core/programs';
import {
  collectAcademicCourseRecords,
  type AcademicCourseRecord,
} from '../core/courseRecords';
import type { AcademicAllYearsData, AcademicCourse, AcademicYear, Grade } from '../utils/academicProgress';

type ProgramSupportPanelProps = {
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  currentYear?: AcademicYear;
};

type CheckTone = 'ok' | 'warning' | 'neutral';

type ProgramCheck = {
  label: string;
  value: string;
  tone: CheckTone;
};

const GRADE_POINTS: Record<Exclude<Grade, '未履修'>, number> = {
  秀: 4,
  優: 3,
  良: 2,
  可: 1,
  不可: 0,
};

function calculateRecordGpa(records: AcademicCourseRecord[]) {
  const graded = records.filter((record) => record.grade && record.grade !== '未履修' && record.credits > 0);
  const credits = graded.reduce((sum, record) => sum + record.credits, 0);
  if (credits === 0) return 0;
  const points = graded.reduce((sum, record) => sum + GRADE_POINTS[record.grade as Exclude<Grade, '未履修'>] * record.credits, 0);
  return points / credits;
}

const CHECK_STYLE: Record<CheckTone, { background: string; border: string; color: string }> = {
  ok: {
    background: 'color-mix(in oklab, var(--primary-soft) 82%, var(--surface) 18%)',
    border: 'color-mix(in oklab, var(--primary) 28%, var(--border-soft) 72%)',
    color: 'var(--primary-strong)',
  },
  warning: {
    background: 'color-mix(in oklab, var(--warning-soft) 84%, var(--surface) 16%)',
    border: 'color-mix(in oklab, var(--warning) 28%, var(--border-soft) 72%)',
    color: 'var(--warning)',
  },
  neutral: {
    background: 'color-mix(in oklab, var(--border-soft) 62%, var(--surface) 38%)',
    border: 'var(--border)',
    color: 'var(--text-sub)',
  },
};

function optionalNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeProgramText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s・･_\-／/（）()]/g, '');
}

function courseSearchText(course: AcademicCourse) {
  return normalizeProgramText([
    course.title,
    course.category,
    course.group,
    course.rawRequired,
    ...(course.tags ?? []),
    ...(course.aliases ?? []),
  ].filter(Boolean).join(' '));
}

function recordSearchText(record: AcademicCourseRecord) {
  return normalizeProgramText([
    record.title,
    record.course?.title,
    record.course?.category,
    record.course?.group,
    ...(record.course?.tags ?? []),
  ].filter(Boolean).join(' '));
}

function sumCredits(records: AcademicCourseRecord[], status: AcademicCourseRecord['status']) {
  return records
    .filter((record) => record.status === status)
    .reduce((sum, record) => sum + record.credits, 0);
}

function buildHiramekiGroups(courses: AcademicCourse[], records: AcademicCourseRecord[]) {
  return HIRAMEKI_COURSE_GROUPS.map((group) => {
    const normalizedKeywords = group.keywords.map(normalizeProgramText);
    const matchedCourses = courses.filter((course) => {
      const searchText = courseSearchText(course);
      return normalizedKeywords.some((keyword) => searchText.includes(keyword));
    });
    const courseIds = new Set(matchedCourses.map((course) => course.id));
    const matchedRecords = records.filter((record) => {
      if (record.course?.id && courseIds.has(record.course.id)) return true;
      const searchText = recordSearchText(record);
      return normalizedKeywords.some((keyword) => searchText.includes(keyword));
    });

    return {
      ...group,
      catalogCourses: matchedCourses.length,
      earnedCredits: sumCredits(matchedRecords, 'passed'),
      plannedCredits: sumCredits(matchedRecords, 'planned'),
      matchedRecords,
    };
  });
}

function semesterCredits(records: AcademicCourseRecord[], currentYear?: AcademicYear) {
  const passed = records.filter((record) => record.status === 'passed' && (!currentYear || record.year === currentYear));
  return {
    spring: passed
      .filter((record) => record.quarter === '1Q' || record.quarter === '2Q')
      .reduce((sum, record) => sum + record.credits, 0),
    autumn: passed
      .filter((record) => record.quarter === '3Q' || record.quarter === '4Q')
      .reduce((sum, record) => sum + record.credits, 0),
  };
}

function tapChecks(
  profile: UniversityProgramProfile,
  records: AcademicCourseRecord[],
  currentYear?: AcademicYear,
): ProgramCheck[] {
  const credits = semesterCredits(records, currentYear);
  const attendance = profile.preparationAttendance;
  const conflictQuarters = profile.tapCycle === 'A' ? ['1Q', '2Q'] : ['3Q', '4Q'];
  const conflictCount = records.filter((record) => (
    record.status === 'planned' &&
    (!currentYear || record.year === currentYear) &&
    conflictQuarters.includes(record.quarter)
  )).length;

  return [
    {
      label: '語学準備講座の出席率',
      value: attendance == null ? '未入力' : `${attendance}%`,
      tone: attendance == null ? 'neutral' : attendance >= 80 ? 'ok' : 'warning',
    },
    {
      label: '語学準備講座の成績',
      value: profile.preparationPassed ? '合格として登録' : '未確認',
      tone: profile.preparationPassed ? 'ok' : 'neutral',
    },
    {
      label: `${currentYear ?? '表示学年'} 前期 / 後期の取得単位`,
      value: `${credits.spring} / ${credits.autumn} 単位`,
      tone: credits.spring >= 10 && credits.autumn >= 10 ? 'ok' : 'warning',
    },
    {
      label: `サイクル${profile.tapCycle}と重なる履修予定`,
      value: conflictCount > 0 ? `${conflictCount}科目を要確認` : '登録上の重複なし',
      tone: conflictCount > 0 ? 'warning' : 'ok',
    },
  ];
}

function atapChecks(profile: UniversityProgramProfile, currentGpa: number): ProgramCheck[] {
  const languageMet = (profile.ieltsScore ?? 0) >= 5.5 || (profile.toeflScore ?? 0) >= 56;
  return [
    {
      label: '現在のGPA',
      value: currentGpa > 0 ? currentGpa.toFixed(2) : '成績未入力',
      tone: currentGpa <= 0 ? 'neutral' : currentGpa >= 2.5 ? 'ok' : 'warning',
    },
    {
      label: 'IELTS / TOEFL iBT',
      value: `${profile.ieltsScore ?? '-'} / ${profile.toeflScore ?? '-'}`,
      tone: profile.ieltsScore == null && profile.toeflScore == null ? 'neutral' : languageMet ? 'ok' : 'warning',
    },
    {
      label: '単位認定',
      value: '原則12単位・学部別確認',
      tone: 'neutral',
    },
  ];
}

function tucpChecks(profile: UniversityProgramProfile, records: AcademicCourseRecord[], currentYear?: AcademicYear): ProgramCheck[] {
  const plannedInAutumn = records.filter((record) => (
    record.status === 'planned' &&
    (!currentYear || record.year === currentYear) &&
    (record.quarter === '3Q' || record.quarter === '4Q')
  )).length;

  return [
    {
      label: 'TOEIC',
      value: profile.toeicScore == null ? '未入力' : `${profile.toeicScore}点`,
      tone: profile.toeicScore == null ? 'neutral' : profile.toeicScore >= 600 ? 'ok' : 'warning',
    },
    {
      label: '秋学期側の履修予定',
      value: plannedInAutumn > 0 ? `${plannedInAutumn}科目を要確認` : '登録上の重複なし',
      tone: plannedInAutumn > 0 ? 'warning' : 'ok',
    },
    {
      label: '単位認定区分',
      value: '学部・学科別確認',
      tone: 'neutral',
    },
  ];
}

function renderCheck(check: ProgramCheck) {
  const style = CHECK_STYLE[check.tone];
  return (
    <div
      key={check.label}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.65rem 0.75rem',
        borderRadius: '0.7rem',
        border: `1px solid ${style.border}`,
        background: style.background,
      }}
    >
      <span className="small" style={{ color: 'var(--text)' }}>{check.label}</span>
      <strong className="small" style={{ color: style.color, textAlign: 'right' }}>{check.value}</strong>
    </div>
  );
}

export default function ProgramSupportPanel({ allYearsData, courses, currentYear }: ProgramSupportPanelProps) {
  const [profile, setProfile] = useState<UniversityProgramProfile>(() => loadUniversityProgramProfile());
  const allRecords = useMemo(
    () => collectAcademicCourseRecords(allYearsData, courses).filter((record) => record.credits > 0),
    [allYearsData, courses],
  );
  const records = useMemo(
    () => allRecords.filter((record) => record.courseType !== 'unknown'),
    [allRecords],
  );
  const hiramekiGroups = useMemo(() => buildHiramekiGroups(courses, records), [courses, records]);
  const currentGpa = useMemo(() => calculateRecordGpa(allRecords), [allRecords]);
  const selectedPrograms = useMemo(
    () => UNIVERSITY_PROGRAMS.filter((program) => profile.selectedProgramIds.includes(program.id)),
    [profile.selectedProgramIds],
  );
  const interactionWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (profile.selectedProgramIds.includes('hirameki') && profile.selectedProgramIds.includes('tap')) {
      const targetQuarters = profile.tapCycle === 'A' ? ['1Q', '2Q'] : ['3Q', '4Q'];
      const hiramekiRecordKeys = new Set(hiramekiGroups.flatMap((group) => group.matchedRecords.map((record) => record.recordKey)));
      const overlaps = records.filter((record) => (
        hiramekiRecordKeys.has(record.recordKey) &&
        record.status === 'planned' &&
        (!currentYear || record.year === currentYear) &&
        targetQuarters.includes(record.quarter)
      ));
      warnings.push(
        overlaps.length > 0
          ? `TAPサイクル${profile.tapCycle}の留学期間と重なる可能性がある、ひらめき系の履修予定が${overlaps.length}件あります。集中科目を含め、開講日程を確認してください。`
          : `TAPサイクル${profile.tapCycle}とひらめきを併用しています。現在の登録上は重なり候補がありませんが、集中科目と年度別リーフレットを確認してください。`,
      );
    }
    return warnings;
  }, [currentYear, hiramekiGroups, profile.selectedProgramIds, profile.tapCycle, records]);

  function updateProfile(updater: (current: UniversityProgramProfile) => UniversityProgramProfile) {
    setProfile((current) => {
      const next = updater(current);
      saveUniversityProgramProfile(next);
      return next;
    });
  }

  function toggleProgram(programId: UniversityProgramId) {
    updateProfile((current) => ({
      ...current,
      selectedProgramIds: current.selectedProgramIds.includes(programId)
        ? current.selectedProgramIds.filter((id) => id !== programId)
        : [...current.selectedProgramIds, programId],
    }));
  }

  return (
    <section className="tt-card" style={{ display: 'grid', gap: '1rem' }}>
      <div className="section-title">
        <div>
          <h2>特別プログラム・留学の履修支援</h2>
          <span className="small">TAP、ATAP、TUCP、ひらめきを通常カリキュラムと分けて確認します。</span>
        </div>
        <span className="course-tag course-tag--neutral">選択 {profile.selectedProgramIds.length}件</span>
      </div>

      <div className="requirement-empty" style={{ padding: '0.9rem 1rem' }}>
        <strong>この画面は補助判定です</strong>
        <p className="small" style={{ margin: '0.35rem 0 0' }}>
          入学年度別の履修要綱、公式リーフレット、WebClassの募集要項を正本とし、ここでは重複・不足・確認漏れを早めに見つけます。
        </p>
      </div>

      {interactionWarnings.map((warning) => (
        <div key={warning} className="requirement-empty requirement-empty--error" style={{ padding: '0.9rem 1rem' }}>
          <strong>TAP × ひらめきの履修確認</strong>
          <p className="small" style={{ margin: '0.35rem 0 0' }}>{warning}</p>
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
        {UNIVERSITY_PROGRAMS.map((program) => {
          const selected = profile.selectedProgramIds.includes(program.id);
          return (
            <label
              key={program.id}
              className="stats-card"
              style={{
                cursor: 'pointer',
                borderColor: selected ? 'var(--primary)' : 'var(--border)',
                background: selected ? 'var(--primary-soft)' : 'var(--surface)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem' }}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleProgram(program.id)}
                  style={{ marginTop: '0.2rem' }}
                />
                <div>
                  <div className="stats-value" style={{ fontSize: '1rem' }}>{program.shortName}</div>
                  <p className="small" style={{ margin: '0.35rem 0 0' }}>{program.summary}</p>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {selectedPrograms.length > 0 ? (
        <section style={{ display: 'grid', gap: '0.8rem' }}>
          <div className="bulk-head">判定に使う手入力項目</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
            <label className="settings-field">
              <span>TOEIC</span>
              <input
                type="number"
                min="0"
                value={profile.toeicScore ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile((current) => ({ ...current, toeicScore: optionalNumber(event.target.value) }))}
                placeholder="例: 600"
              />
            </label>
            <label className="settings-field">
              <span>IELTS</span>
              <input
                type="number"
                min="0"
                max="9"
                step="0.5"
                value={profile.ieltsScore ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile((current) => ({ ...current, ieltsScore: optionalNumber(event.target.value) }))}
                placeholder="例: 5.5"
              />
            </label>
            <label className="settings-field">
              <span>TOEFL iBT</span>
              <input
                type="number"
                min="0"
                value={profile.toeflScore ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile((current) => ({ ...current, toeflScore: optionalNumber(event.target.value) }))}
                placeholder="例: 56"
              />
            </label>
            <label className="settings-field">
              <span>準備講座出席率</span>
              <input
                type="number"
                min="0"
                max="100"
                value={profile.preparationAttendance ?? ''}
                onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile((current) => ({ ...current, preparationAttendance: optionalNumber(event.target.value) }))}
                placeholder="%"
              />
            </label>
          </div>
        </section>
      ) : null}

      {selectedPrograms.map((program) => {
        const checks = program.id === 'tap'
          ? tapChecks(profile, records, currentYear)
          : program.id === 'atap'
            ? atapChecks(profile, currentGpa)
            : program.id === 'tucp'
              ? tucpChecks(profile, records, currentYear)
              : [];

        return (
          <article key={program.id} className="stats-card" style={{ display: 'grid', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <div className="stats-label">{program.category === 'curriculum' ? '教育プログラム' : '留学プログラム'}</div>
                <div className="stats-value" style={{ fontSize: '1.15rem' }}>{program.name}</div>
              </div>
              <a className="btn-ghost" href={program.sourceUrl} target="_blank" rel="noreferrer">
                {program.sourceLabel}
              </a>
            </div>

            {program.id === 'tap' ? (
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="small" style={{ fontWeight: 800 }}>参加サイクル</span>
                {(['A', 'B'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    className={profile.tapCycle === cycle ? 'btn-primary' : 'btn-ghost'}
                    onClick={() => updateProfile((current) => ({ ...current, tapCycle: cycle }))}
                  >
                    サイクル{cycle}
                  </button>
                ))}
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
                  <input
                    type="checkbox"
                    checked={profile.preparationPassed}
                    onChange={(event: ChangeEvent<HTMLInputElement>) => updateProfile((current) => ({ ...current, preparationPassed: event.target.checked }))}
                  />
                  <span className="small">準備講座の成績は合格</span>
                </label>
              </div>
            ) : null}

            {program.id === 'hirameki' ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                {hiramekiGroups.map((group) => (
                  <div key={group.id} className="requirement-empty" style={{ padding: '0.75rem' }}>
                    <strong style={{ display: 'block' }}>{group.label}</strong>
                    <span className="small">取得 {group.earnedCredits} / 予定 {group.plannedCredits} 単位</span>
                    <span className="small" style={{ display: 'block', color: 'var(--muted)' }}>登録科目 {group.catalogCourses}件</span>
                  </div>
                ))}
              </div>
            ) : null}

            {checks.length > 0 ? <div style={{ display: 'grid', gap: '0.55rem' }}>{checks.map(renderCheck)}</div> : null}

            <div>
              <strong className="small">公式条件の確認項目</strong>
              <ul className="small" style={{ margin: '0.45rem 0 0', paddingLeft: '1.2rem' }}>
                {program.conditions.map((condition) => <li key={condition}>{condition}</li>)}
              </ul>
            </div>
            <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>{program.caution}</p>
          </article>
        );
      })}

      {selectedPrograms.length === 0 ? (
        <p className="small" style={{ margin: 0, color: 'var(--muted)' }}>
          参加中または検討中のプログラムを選ぶと、履修実績との重なりと手続条件を表示します。
        </p>
      ) : null}
    </section>
  );
}
