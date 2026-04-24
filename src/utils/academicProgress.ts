export type Grade = "秀" | "優" | "良" | "可" | "不可" | "未履修";
export type CourseType = "required" | "elective-required" | "elective";
export type AcademicQuarter = "1Q" | "2Q" | "3Q" | "4Q";
export type AcademicYear = "1年次" | "2年次" | "3年次" | "4年次" | "M1" | "M2";

export interface CourseOffering {
  day?: string;
  period?: string;
  term?: string;
  year?: string;
  className?: string;
  teacher?: string;
  lectureCode?: string;
  room?: string;
  target?: string;
  remarks?: string;
}

export interface AcademicCourse {
  id: string;
  title: string;
  credits: number;
  category: string;
  group: string;
  courseType: CourseType;
  rawRequired?: string;
  tags?: string[];
  requirementSubtype?: 'triangle1' | 'triangle2' | 'none';
  sourceKind?: 'curriculum' | 'schedule';
  offerings?: CourseOffering[];
}

export interface AcademicCourseCell {
  title: string;
  room?: string;
  teacher?: string;
  color?: string;
  memo?: string;
  credits?: number;
  grade?: Grade;
  courseType?: CourseType;
  lectureCode?: string;
  term?: string;
  target?: string;
  className?: string;
  scheduleDay?: string;
  schedulePeriod?: string;
}

export type AcademicTimetable = Record<
  string,
  Record<string, Record<string, AcademicCourseCell | null>>
>;

export interface AcademicYearData {
  timetable: AcademicTimetable;
  quarterRanges: Record<AcademicQuarter, { start: string; end: string }>;
}

export type AcademicAllYearsData = Record<AcademicYear, AcademicYearData>;

export interface AcademicCurriculum {
  name: string;
  requiredCredits: number;
  breakdown: {
    required: number;
    electiveRequired: number;
    elective: number;
  };
}

export interface AcademicSettings {
  requiredCredits: number;
  curriculum?: AcademicCurriculum;
}

export interface AcademicProgressItem {
  key: CourseType | "total";
  label: string;
  requiredCredits: number;
  earnedCredits: number;
  remainingCredits: number;
  completionRate: number;
}

export interface AcademicWarning {
  id: string;
  level: "info" | "warning" | "danger";
  message: string;
  detail?: string;
}

export interface DetailedRequirementWarning {
  id: string;
  level: "info" | "warning" | "danger";
  message: string;
  detail?: string;
}

export interface AcademicGpaSnapshot {
  currentGpa: number;
  currentEarnedPoints: number;
  currentGradedCredits: number;
  predictedGpa: number;
  addedCredits: number;
}

export interface AcademicDashboardSnapshot {
  requiredCredits: number;
  earnedCredits: number;
  gradedCredits: number;
  completionRate: number;
  gpa: AcademicGpaSnapshot;
  progress: AcademicProgressItem[];
  warnings: AcademicWarning[];
}

export interface AcademicGpaPredictionTarget {
  courseId: string;
  title: string;
  credits: number;
  assumedGrade: Grade;
}

export interface AcademicGpaPredictionInput {
  currentGradedCredits: number;
  currentEarnedPoints: number;
  targetCourses: AcademicGpaPredictionTarget[];
}

export interface AcademicCourseInstance extends AcademicCourseCell {
  year: AcademicYear;
  quarter: AcademicQuarter;
  day: string;
  periodId: string;
}

const YEARS: AcademicYear[] = ["1年次", "2年次", "3年次", "4年次", "M1", "M2"];
const QUARTERS: AcademicQuarter[] = ["1Q", "2Q", "3Q", "4Q"];

const GRADE_POINTS: Record<Exclude<Grade, "未履修">, number> = {
  秀: 4.0,
  優: 3.0,
  良: 2.0,
  可: 1.0,
  不可: 0.0,
};

function getGradePoint(grade?: Grade) {
  if (!grade || grade === "未履修") {
    return 0;
  }

  return GRADE_POINTS[grade];
}

function collectCourseInstances(allYearsData: AcademicAllYearsData) {
  const entries: AcademicCourseInstance[] = [];

  for (const year of YEARS) {
    const yearData = allYearsData[year];
    if (!yearData) continue;

    for (const quarter of QUARTERS) {
      const quarterData = yearData.timetable[quarter];
      if (!quarterData) continue;

      for (const day of Object.keys(quarterData)) {
        for (const periodId of Object.keys(quarterData[day] ?? {})) {
          const cell = quarterData[day][periodId];
          if (!cell || !cell.title) continue;

          entries.push({
            ...cell,
            year,
            quarter,
            day,
            periodId,
          });
        }
      }
    }
  }

  return entries;
}

function formatCourseLocation(entry: AcademicCourseInstance) {
  return `${entry.year} ${entry.quarter} ${entry.day}${entry.periodId}限`;
}

function collectMetrics(allYearsData: AcademicAllYearsData) {
  const entries = collectCourseInstances(allYearsData);
  const creditsByType = {
    required: 0,
    electiveRequired: 0,
    elective: 0,
    total: 0,
  };

  let currentEarnedPoints = 0;
  let currentGradedCredits = 0;
  const failedRequiredCourses: AcademicCourseInstance[] = [];
  const failedElectiveRequiredCourses: AcademicCourseInstance[] = [];

  for (const entry of entries) {
    const credits = entry.credits ?? 0;
    if (!entry.grade || entry.grade === "未履修" || credits <= 0) {
      continue;
    }

    currentGradedCredits += credits;
    currentEarnedPoints += getGradePoint(entry.grade) * credits;

    if (entry.grade === "不可") {
      if (entry.courseType === "required") {
        failedRequiredCourses.push(entry);
      } else if (entry.courseType === "elective-required") {
        failedElectiveRequiredCourses.push(entry);
      }
      continue;
    }

    creditsByType.total += credits;

    if (entry.courseType === "required") {
      creditsByType.required += credits;
    } else if (entry.courseType === "elective-required") {
      creditsByType.electiveRequired += credits;
    } else {
      creditsByType.elective += credits;
    }
  }

  return {
    entries,
    creditsByType,
    currentEarnedPoints,
    currentGradedCredits,
    currentGpa: currentGradedCredits === 0 ? 0 : currentEarnedPoints / currentGradedCredits,
    failedRequiredCourses,
    failedElectiveRequiredCourses,
  };
}

function buildProgressItems(
  creditsByType: ReturnType<typeof collectMetrics>["creditsByType"],
  settings: AcademicSettings,
) {
  const curriculum = settings.curriculum;
  const overallRequired = curriculum?.requiredCredits ?? settings.requiredCredits;

  if (!curriculum) {
    return [
      {
        key: "total" as const,
        label: "総単位",
        requiredCredits: overallRequired,
        earnedCredits: creditsByType.total,
        remainingCredits: Math.max(0, overallRequired - creditsByType.total),
        completionRate: overallRequired === 0 ? 0 : creditsByType.total / overallRequired,
      },
    ];
  }

  const items: AcademicProgressItem[] = [
    {
      key: "required",
      label: "必修",
      requiredCredits: curriculum.breakdown.required,
      earnedCredits: creditsByType.required,
      remainingCredits: Math.max(0, curriculum.breakdown.required - creditsByType.required),
      completionRate:
        curriculum.breakdown.required === 0
          ? 0
          : creditsByType.required / curriculum.breakdown.required,
    },
    {
      key: "elective-required",
      label: "選択必修",
      requiredCredits: curriculum.breakdown.electiveRequired,
      earnedCredits: creditsByType.electiveRequired,
      remainingCredits: Math.max(0, curriculum.breakdown.electiveRequired - creditsByType.electiveRequired),
      completionRate:
        curriculum.breakdown.electiveRequired === 0
          ? 0
          : creditsByType.electiveRequired / curriculum.breakdown.electiveRequired,
    },
    {
      key: "elective",
      label: "選択",
      requiredCredits: curriculum.breakdown.elective,
      earnedCredits: creditsByType.elective,
      remainingCredits: Math.max(0, curriculum.breakdown.elective - creditsByType.elective),
      completionRate:
        curriculum.breakdown.elective === 0
          ? 0
          : creditsByType.elective / curriculum.breakdown.elective,
    },
    {
      key: "total",
      label: "総単位",
      requiredCredits: overallRequired,
      earnedCredits: creditsByType.total,
      remainingCredits: Math.max(0, overallRequired - creditsByType.total),
      completionRate: overallRequired === 0 ? 0 : creditsByType.total / overallRequired,
    },
  ];

  return items;
}

export function calculateCurrentGpa(allYearsData: AcademicAllYearsData): AcademicGpaSnapshot {
  const metrics = collectMetrics(allYearsData);

  return {
    currentGpa: metrics.currentGpa,
    currentEarnedPoints: metrics.currentEarnedPoints,
    currentGradedCredits: metrics.currentGradedCredits,
    predictedGpa: metrics.currentGpa,
    addedCredits: 0,
  };
}

export function predictGpa(input: AcademicGpaPredictionInput): AcademicGpaSnapshot {
  const addedPoints = input.targetCourses.reduce(
    (sum, course) => sum + course.credits * getGradePoint(course.assumedGrade),
    0,
  );
  const addedCredits = input.targetCourses.reduce((sum, course) => sum + course.credits, 0);
  const totalGradedCredits = input.currentGradedCredits + addedCredits;
  const predictedGpa =
    totalGradedCredits === 0 ? 0 : (input.currentEarnedPoints + addedPoints) / totalGradedCredits;

  return {
    currentGpa:
      input.currentGradedCredits === 0 ? 0 : input.currentEarnedPoints / input.currentGradedCredits,
    currentEarnedPoints: input.currentEarnedPoints,
    currentGradedCredits: input.currentGradedCredits,
    predictedGpa,
    addedCredits,
  };
}

export function generateGraduationWarnings(
  allYearsData: AcademicAllYearsData,
  settings: AcademicSettings,
) {
  const metrics = collectMetrics(allYearsData);
  const warnings: AcademicWarning[] = [];
  const curriculum = settings.curriculum;
  const overallRequired = curriculum?.requiredCredits ?? settings.requiredCredits;

  if (!curriculum) {
    warnings.push({
      id: "no-curriculum",
      level: "info",
      message: "卒業要件CSVが未読込です",
      detail: "卒業要件が未設定のため、区分別の不足判定はまだできません。",
    });
  } else {
    const remainingTotal = Math.max(0, overallRequired - metrics.creditsByType.total);
    if (remainingTotal > 0) {
      warnings.push({
        id: "remaining-total",
        level: "warning",
        message: `総単位があと${remainingTotal}単位足りません`,
        detail: `現在の取得単位は${metrics.creditsByType.total}単位です。`,
      });
    } else {
      warnings.push({
        id: "remaining-total-complete",
        level: "info",
        message: "総単位要件は達成済みです",
        detail: `取得単位は${metrics.creditsByType.total}単位です。`,
      });
    }

    const breakdown: Array<{
      key: string;
      label: string;
      requiredCredits: number;
      earnedCredits: number;
    }> = [
      {
        key: "required",
        label: "必修",
        requiredCredits: curriculum.breakdown.required,
        earnedCredits: metrics.creditsByType.required,
      },
      {
        key: "elective-required",
        label: "選択必修",
        requiredCredits: curriculum.breakdown.electiveRequired,
        earnedCredits: metrics.creditsByType.electiveRequired,
      },
      {
        key: "elective",
        label: "選択",
        requiredCredits: curriculum.breakdown.elective,
        earnedCredits: metrics.creditsByType.elective,
      },
    ];

    for (const item of breakdown) {
      const remaining = Math.max(0, item.requiredCredits - item.earnedCredits);
      if (remaining > 0) {
        warnings.push({
          id: `remaining-${item.key}`,
          level: "warning",
          message: `${item.label}があと${remaining}単位必要です`,
          detail: `${item.earnedCredits} / ${item.requiredCredits} 単位`,
        });
      }
    }
  }

  if (metrics.failedRequiredCourses.length > 0) {
    warnings.push({
      id: "failed-required",
      level: "danger",
      message: `必修で不可の科目が${metrics.failedRequiredCourses.length}件あります`,
      detail: metrics.failedRequiredCourses
        .slice(0, 3)
        .map((course) => `${course.title} (${formatCourseLocation(course)})`)
        .join(" / "),
    });
  }

  if (metrics.failedElectiveRequiredCourses.length > 0) {
    warnings.push({
      id: "failed-elective-required",
      level: "danger",
      message: `選択必修で不可の科目が${metrics.failedElectiveRequiredCourses.length}件あります`,
      detail: metrics.failedElectiveRequiredCourses
        .slice(0, 3)
        .map((course) => `${course.title} (${formatCourseLocation(course)})`)
        .join(" / "),
    });
  }

  return warnings;
}

export function generateDetailedGraduationWarnings(
  allYearsData: AcademicAllYearsData,
  courses: AcademicCourse[],
): DetailedRequirementWarning[] {
  void allYearsData;
  void courses;
  return [];
}

export function buildDashboardSnapshot(
  allYearsData: AcademicAllYearsData,
  settings: AcademicSettings,
): AcademicDashboardSnapshot {
  const metrics = collectMetrics(allYearsData);
  const gpa = calculateCurrentGpa(allYearsData);
  const warnings = generateGraduationWarnings(allYearsData, settings);
  const progress = buildProgressItems(metrics.creditsByType, settings);
  const requiredCredits = settings.curriculum?.requiredCredits ?? settings.requiredCredits;

  return {
    requiredCredits,
    earnedCredits: metrics.creditsByType.total,
    gradedCredits: metrics.currentGradedCredits,
    completionRate: requiredCredits === 0 ? 0 : metrics.creditsByType.total / requiredCredits,
    gpa,
    progress,
    warnings,
  };
}
