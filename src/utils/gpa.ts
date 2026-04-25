import type { AcademicAllYearsData, AcademicDashboardSnapshot, AcademicCourseCell, Grade } from './academicProgress';

export type GradeValue = '秀' | '優' | '良' | '可' | '不可' | '未評価';

export const GRADE_POINTS: Record<GradeValue, number | null> = {
  秀: 4.0,
  優: 3.0,
  良: 2.0,
  可: 1.0,
  不可: 0.0,
  未評価: null,
};

type GradeRecord = {
  title: string;
  credits: number;
  grade: GradeValue;
};

export interface GpaSummary {
  currentGpa: number;
  earnedCredits: number;
  failedCredits: number;
  ungradedCount: number;
  gradedCredits: number;
  registeredCredits: number;
}

function toGradeValue(grade?: Grade): GradeValue {
  if (!grade || grade === '未履修') {
    return '未評価';
  }

  return grade as GradeValue;
}

function collectGradeRecords(allYearsData: AcademicAllYearsData) {
  const records: GradeRecord[] = [];

  for (const yearData of Object.values(allYearsData)) {
    for (const quarterData of Object.values(yearData.timetable)) {
      for (const dayData of Object.values(quarterData)) {
        for (const cell of Object.values(dayData) as Array<AcademicCourseCell | null>) {
          if (!cell || !cell.title || (cell.credits ?? 0) <= 0) {
            continue;
          }

          records.push({
            title: cell.title,
            credits: cell.credits ?? 0,
            grade: toGradeValue(cell.grade),
          });
        }
      }
    }
  }

  return records;
}

export function calculateGpaSummary(allYearsData: AcademicAllYearsData, snapshot: AcademicDashboardSnapshot): GpaSummary {
  const records = collectGradeRecords(allYearsData);
  let earnedCredits = 0;
  let failedCredits = 0;
  let ungradedCount = 0;
  let gradedCredits = 0;
  let registeredCredits = 0;

  for (const record of records) {
    registeredCredits += record.credits;

    if (record.grade === '未評価') {
      ungradedCount += 1;
      continue;
    }

    gradedCredits += record.credits;

    if (record.grade === '不可') {
      failedCredits += record.credits;
      continue;
    }

    earnedCredits += record.credits;
  }

  return {
    currentGpa: snapshot.gpa.currentGpa,
    earnedCredits,
    failedCredits,
    ungradedCount,
    gradedCredits,
    registeredCredits,
  };
}