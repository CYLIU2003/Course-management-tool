import {
  calculateRequirementStatus,
  type CategoryCourse,
  type RequirementCategoryDetail,
  type RequirementCategorySummary,
} from '../utils/requirements';

import type { AcademicCourse, AcademicCurriculum, AcademicAllYearsData } from '../utils/academicProgress';
import type { ApplicableCourseRow } from '../utils/csvImporter';

function summarizeDetail(detail: RequirementCategoryDetail): RequirementCategorySummary {
  const totalEligibleCourses = detail.courses.filter((course) => course.matchState !== 'not_eligible').length;
  const countedCourses = detail.courses.filter((course) => course.matchState === 'counted_in_this_category').length;
  const plannedCourses = detail.courses.filter((course) => course.takenStatus === 'planned').length;
  const passedCourses = detail.courses.filter((course) => course.takenStatus === 'passed').length;

  return {
    ...detail,
    totalEligibleCourses,
    countedCourses,
    plannedCourses,
    passedCourses,
  };
}

export function generateRequirementCategories(
  curriculum: AcademicCurriculum, 
  courses: AcademicCourse[], 
  allYearsData: AcademicAllYearsData, 
  applicableCourses: ApplicableCourseRow[]
): RequirementCategorySummary[] {
  if (!curriculum.details) return [];
  const keys = Array.from(new Set(curriculum.details.map((d) => d.area + ':' + d.subarea)));
  
  return keys.map((key) => {
    return summarizeDetail(generateRequirementCategoryDetail(key, curriculum, courses, allYearsData, applicableCourses));
  });
}

export function generateRequirementCategoryDetail(
  categoryId: string,
  curriculum: AcademicCurriculum,
  courses: AcademicCourse[],
  allYearsData: AcademicAllYearsData,
  applicableCourses: ApplicableCourseRow[]
): RequirementCategoryDetail {
  
  const [area, subarea] = categoryId.split(':');
  
  const rules = curriculum.details ? curriculum.details.filter((d) => d.area === area && d.subarea === subarea) : [];
  const applicableCourseRowsForDisplay = applicableCourses.filter(ac => ac.area === area && ac.subarea === subarea);
  const totalReq = rules.length ? rules.reduce((acc, r) => acc + r.totalRequiredCredits, 0) : 0;
  
  const cells = Object.values(allYearsData).flatMap(year => Object.values(year.timetable).flatMap(days => Object.values(days).flatMap(slots => Object.values(slots))));

  const detailCourses: CategoryCourse[] = [...new Map(applicableCourseRowsForDisplay.map(row => [row.courseId, row])).values()].map(ac => {
    const matchedCourse = courses.find((c) => c.id === ac.courseId);
    let takenStatus: 'passed' | 'failed' | 'planned' | 'not_taken' = 'not_taken';
    if (matchedCourse) {
      const records = cells.filter(cell => cell?.courseId === matchedCourse.id && cell.credits === ac.credits);
      const isPassed = records.some(cell => ['秀', '優', '良', '可'].includes(cell?.grade ?? ''));
      if (isPassed) {
        takenStatus = 'passed';
      } else if (records.some(cell => !cell?.grade || cell.grade === '未履修')) {
        takenStatus = 'planned';
      } else if (records.some(cell => cell?.grade === '不可')) {
        takenStatus = 'failed';
      }
    }
    
    return {
      courseId: ac.courseId,
      courseCode: ac.courseId,
      courseName: ac.title,
      credits: ac.credits,
      takenStatus,
      matchState: takenStatus === 'passed' ? 'counted_in_this_category' : 'eligible_for_this_category',
      eligibleCategoryIds: [categoryId],
      countedCategoryId: takenStatus === 'passed' ? categoryId : undefined,
      countedCategoryName: takenStatus === 'passed' ? categoryId : undefined,
    };
  });
  const earned = detailCourses.reduce((sum, course) => sum + (course.takenStatus === 'passed' ? course.credits : 0), 0);
  const planned = detailCourses.reduce((sum, course) => sum + (course.takenStatus === 'planned' ? course.credits : 0), 0);

  return {
    categoryId,
    categoryName: (area || '') + (subarea ? ' - ' + subarea : ''),
    description: 'システム連携されたカテゴリデータです',
    requiredCredits: totalReq,
    earnedCredits: earned,
    plannedCredits: planned,
    remainingCredits: Math.max(0, totalReq - earned),
    status: calculateRequirementStatus(totalReq, earned, planned),
    courses: detailCourses,
  };
}
