import {
  calculateRequirementStatus,
  type CategoryCourse,
  type RequirementCategoryDetail,
  type RequirementCategorySummary,
} from '../utils/requirements';

import type { AcademicCourse, AcademicCurriculum, AcademicAllYearsData } from '../utils/academicProgress';
import type { ApplicableCourseRow } from '../utils/csvImporter';
import { calculateGraduationRequirements } from '../utils/graduationRequirements';

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
  
  const progressResult = calculateGraduationRequirements({ curriculum, courses, allYearsData });

  const earned = progressResult.statuses.find(s => s.category === area || s.category === categoryId)?.earnedCredits || 0;
  const planned = 0;

  const detailCourses: CategoryCourse[] = applicableCourseRowsForDisplay.map(ac => {
    const matchedCourse = courses.find((c) => c.id === ac.courseId);
    let takenStatus: 'passed' | 'failed' | 'planned' | 'not_taken' = 'not_taken';
    if (matchedCourse) {
      const isPassed = ['firstYear', 'secondYear', 'thirdYear', 'fourthYear'].some(year => {
        const yd = allYearsData[year as keyof AcademicAllYearsData] as any;
        return yd && yd.grades && yd.grades.some((g: any) => g.courseId === matchedCourse.id && g.status === 'passed');
      });
      if (isPassed) {
        takenStatus = 'passed';
      } else {
        takenStatus = 'planned';
      }
    }
    
    return {
      courseId: ac.courseId,
      courseCode: ac.courseId,
      courseName: ac.title,
      credits: ac.credits,
      yearLevel: 1, 
      semester: '前期',
      dayPeriod: '',
      instructor: '',
      takenStatus,
      matchState: takenStatus === 'passed' ? 'counted_in_this_category' : 'eligible_for_this_category',
      eligibleCategoryIds: [categoryId],
      countedCategoryId: takenStatus === 'passed' ? categoryId : undefined,
      countedCategoryName: takenStatus === 'passed' ? categoryId : undefined,
    };
  });

  return {
    categoryId,
    categoryName: (area || '') + (subarea ? ' - ' + subarea : ''),
    description: 'システム連携されたカテゴリデータです',
    requiredCredits: totalReq,
    earnedCredits: earned,
    plannedCredits: planned,
    remainingCredits: Math.max(0, totalReq - earned - planned),
    status: calculateRequirementStatus(totalReq, earned, planned),
    courses: detailCourses,
  };
}
