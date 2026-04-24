import { normalizeCourseTitle } from './csvImporter';
import type { AcademicAllYearsData, AcademicCourse, AcademicDashboardSnapshot, AcademicYear, CourseType, Grade } from './academicProgress';

export interface CourseRecommendation {
  course: AcademicCourse;
  score: number;
  reasons: string[];
  priorityCategory: CourseType;
}

export interface CourseRecommendationInput {
  courses: AcademicCourse[];
  snapshot: AcademicDashboardSnapshot;
  allYearsData: AcademicAllYearsData;
  currentYear?: AcademicYear;
  limit?: number;
}

function toOfferingGradeYear(currentYear?: AcademicYear) {
  switch (currentYear) {
    case '1年次':
      return '1';
    case '2年次':
      return '2';
    case '3年次':
      return '3';
    case '4年次':
      return '4';
    case 'M1':
      return 'M1';
    case 'M2':
      return 'M2';
    default:
      return undefined;
  }
}

function isPassedGrade(grade?: Grade) {
  return Boolean(grade && grade !== '未履修' && grade !== '不可');
}

function isFailedGrade(grade?: Grade) {
  return grade === '不可';
}

function collectCourseHistory(allYearsData: AcademicAllYearsData) {
  const passedTitles = new Set<string>();
  const failedTitles = new Set<string>();

  for (const yearData of Object.values(allYearsData)) {
    for (const quarterData of Object.values(yearData.timetable)) {
      for (const dayData of Object.values(quarterData)) {
        for (const cell of Object.values(dayData)) {
          if (!cell || !cell.title || (cell.credits ?? 0) <= 0) {
            continue;
          }

          const key = normalizeCourseTitle(cell.title);
          if (isPassedGrade(cell.grade)) {
            passedTitles.add(key);
            failedTitles.delete(key);
          } else if (isFailedGrade(cell.grade)) {
            failedTitles.add(key);
          }
        }
      }
    }
  }

  return { passedTitles, failedTitles };
}

function toCourseTypeLabel(courseType: CourseType) {
  switch (courseType) {
    case 'required':
      return '必修';
    case 'elective-required':
      return '選択必修';
    case 'elective':
      return '選択';
  }
}

export function recommendCourses({
  courses,
  snapshot,
  allYearsData,
  currentYear,
  limit = 5,
}: CourseRecommendationInput): CourseRecommendation[] {
  const progressMap = new Map(snapshot.progress.map((item) => [item.key, item] as const));
  const requiredRemaining = progressMap.get('required')?.remainingCredits ?? 0;
  const electiveRequiredRemaining = progressMap.get('elective-required')?.remainingCredits ?? 0;
  const electiveRemaining = progressMap.get('elective')?.remainingCredits ?? 0;
  const totalRemaining = progressMap.get('total')?.remainingCredits ?? Math.max(0, snapshot.requiredCredits - snapshot.earnedCredits);
  const { passedTitles, failedTitles } = collectCourseHistory(allYearsData);
  const currentYearGrade = toOfferingGradeYear(currentYear);

  const hasNeed =
    totalRemaining > 0 ||
    requiredRemaining > 0 ||
    electiveRequiredRemaining > 0 ||
    electiveRemaining > 0 ||
    failedTitles.size > 0;

  if (!hasNeed) {
    return [];
  }

  const candidates: CourseRecommendation[] = [];

  for (const course of courses) {
    if ((course.credits ?? 0) <= 0) {
      continue;
    }

    const normalizedTitle = normalizeCourseTitle(course.title);
    if (passedTitles.has(normalizedTitle)) {
      continue;
    }

    const reasons: string[] = [];
    let score = 0;

    if (course.courseType === 'required' && requiredRemaining > 0) {
      score += 120 + requiredRemaining * 10;
      reasons.push(`必修区分があと${requiredRemaining}単位不足しています`);
    } else if (course.courseType === 'elective-required' && electiveRequiredRemaining > 0) {
      score += 100 + electiveRequiredRemaining * 8;
      reasons.push(`選択必修区分があと${electiveRequiredRemaining}単位不足しています`);
    } else if (course.courseType === 'elective' && electiveRemaining > 0) {
      score += 80 + electiveRemaining * 6;
      reasons.push(`選択区分があと${electiveRemaining}単位不足しています`);
    } else if (totalRemaining > 0) {
      score += 20 + totalRemaining * 2;
      reasons.push(`総単位の不足解消に役立ちます（あと${totalRemaining}単位）`);
    }

    if (failedTitles.has(normalizedTitle)) {
      score += 60;
      reasons.unshift('過去に不可だったため再履修候補です');
    }

    if (currentYearGrade && course.offerings?.some((offering) => offering.gradeYear === currentYearGrade)) {
      score += 15;
      reasons.push(`${currentYear ?? '現在学年'}向けの開講情報があります`);
    }

    if (course.requirementSubtype && course.requirementSubtype !== 'none') {
      score += 6;
      reasons.push('選択必修の区分に関連します');
    }

    if (course.offerings?.length) {
      score += 3;
    }

    if (score <= 0) {
      continue;
    }

    candidates.push({
      course,
      score,
      reasons: [...new Set(reasons)],
      priorityCategory: course.courseType,
    });
  }

  return candidates
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      if (right.course.credits !== left.course.credits) {
        return right.course.credits - left.course.credits;
      }

      return left.course.title.localeCompare(right.course.title, 'ja');
    })
    .slice(0, limit);
}

export function formatCourseTypeLabel(courseType: CourseType) {
  return toCourseTypeLabel(courseType);
}
