import type { AcademicAllYearsData, AcademicDashboardSnapshot, AcademicYear, CourseType, Grade } from './academicProgress';

export type GraduationRiskLevel = 'safe' | 'warning' | 'danger';

export interface GraduationRiskItem {
  key: CourseType | 'total';
  label: string;
  requiredCredits: number;
  earnedCredits: number;
  missingCredits: number;
  riskLevel: GraduationRiskLevel;
}

export interface GraduationRiskAlert {
  title: string;
  location: string;
  detail: string;
}

export interface GraduationRiskSummary {
  overallRiskLevel: GraduationRiskLevel;
  overallLabel: string;
  overallMessage: string;
  requiredMissingCredits: number;
  totalMissingCredits: number;
  items: GraduationRiskItem[];
  shortageItems: GraduationRiskItem[];
  requiredCourseAlerts: GraduationRiskAlert[];
}

type CourseEntry = {
  title: string;
  grade?: Grade;
  credits: number;
  courseType?: CourseType;
  year: AcademicYear;
  quarter: string;
  day: string;
  periodId: string;
};

const RISK_ORDER: Record<GraduationRiskLevel, number> = {
  safe: 0,
  warning: 1,
  danger: 2,
};

const RISK_LABELS: Record<GraduationRiskLevel, string> = {
  safe: '安全',
  warning: '注意',
  danger: '危険',
};

function collectCourseEntries(allYearsData: AcademicAllYearsData) {
  const entries: CourseEntry[] = [];

  for (const year of Object.keys(allYearsData) as AcademicYear[]) {
    const yearData = allYearsData[year];
    if (!yearData) continue;

    for (const quarter of Object.keys(yearData.timetable) as Array<keyof typeof yearData.timetable>) {
      const quarterData = yearData.timetable[quarter];
      if (!quarterData) continue;

      for (const day of Object.keys(quarterData)) {
        for (const periodId of Object.keys(quarterData[day] ?? {})) {
          const cell = quarterData[day][periodId];
          if (!cell || !cell.title) continue;

          entries.push({
            title: cell.title.trim(),
            grade: cell.grade,
            credits: cell.credits ?? 0,
            courseType: cell.courseType,
            year,
            quarter: String(quarter),
            day,
            periodId,
          });
        }
      }
    }
  }

  return entries;
}

function formatLocation(entry: CourseEntry) {
  return `${entry.year} ${entry.quarter} ${entry.day}${entry.periodId}限`;
}

function toOverallMessage(summary: GraduationRiskSummary) {
  if (summary.overallRiskLevel === 'safe') {
    return '現時点では卒業要件は安全圏です。';
  }

  if (summary.requiredCourseAlerts.length > 0) {
    return `必修未修得が${summary.requiredCourseAlerts.length}件あります。`; 
  }

  if (summary.totalMissingCredits >= 5) {
    return `不足単位が${summary.totalMissingCredits}単位あり、卒業危険度が高いです。`;
  }

  return `不足単位が${summary.totalMissingCredits}単位あります。優先度の高い科目を確認してください。`;
}

function severityForMissingCredits(missingCredits: number) {
  if (missingCredits <= 0) {
    return 'safe' as const;
  }

  if (missingCredits >= 5) {
    return 'danger' as const;
  }

  return 'warning' as const;
}

function highestLevel(levels: GraduationRiskLevel[]) {
  return levels.reduce<GraduationRiskLevel>((current, next) => {
    return RISK_ORDER[next] > RISK_ORDER[current] ? next : current;
  }, 'safe');
}

export function calculateGraduationRisk(
  snapshot: AcademicDashboardSnapshot,
  allYearsData: AcademicAllYearsData,
): GraduationRiskSummary {
  const entries = collectCourseEntries(allYearsData);
  const requiredCourseAlerts = entries
    .filter((entry) => entry.courseType === 'required' && entry.credits > 0)
    .filter((entry) => !entry.grade || entry.grade === '未履修' || entry.grade === '不可')
    .map((entry) => ({
      title: entry.title,
      location: formatLocation(entry),
      detail: entry.grade === '不可' ? '不可のため未取得です。' : '未履修です。',
    }));

  const items = snapshot.progress.map<GraduationRiskItem>((item) => {
    const missingCredits = Math.max(0, item.requiredCredits - item.earnedCredits);
    const baseRisk = severityForMissingCredits(missingCredits);

    const riskLevel = item.key === 'required'
      ? requiredCourseAlerts.length > 0 || missingCredits > 0
        ? 'danger'
        : 'safe'
      : baseRisk;

    return {
      key: item.key,
      label: item.label,
      requiredCredits: item.requiredCredits,
      earnedCredits: item.earnedCredits,
      missingCredits,
      riskLevel,
    };
  });

  const shortageItems = items.filter((item) => item.key !== 'total' && item.missingCredits > 0);
  const totalItem = items.find((item) => item.key === 'total');
  const requiredItem = items.find((item) => item.key === 'required');

  const overallRiskLevel = highestLevel([
    ...items.map((item) => item.riskLevel),
    requiredCourseAlerts.length > 0 ? 'danger' : 'safe',
  ]);

  const summary: GraduationRiskSummary = {
    overallRiskLevel,
    overallLabel: RISK_LABELS[overallRiskLevel],
    overallMessage: '',
    requiredMissingCredits: requiredItem?.missingCredits ?? 0,
    totalMissingCredits: totalItem?.missingCredits ?? Math.max(0, snapshot.requiredCredits - snapshot.earnedCredits),
    items,
    shortageItems,
    requiredCourseAlerts,
  };

  summary.overallMessage = toOverallMessage(summary);

  return summary;
}
