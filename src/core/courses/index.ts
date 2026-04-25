import {
  formatCourseTypeLabel as formatCourseTypeLabelInternal,
  recommendCourses as recommendCoursesInternal,
} from "../../utils/courseRecommendation";
import type {
  AcademicAllYearsData,
  AcademicCourse,
  AcademicDashboardSnapshot,
  AcademicYear,
} from "../types";

export type {
  CourseRecommendation,
  CourseRecommendationInput,
} from "../../utils/courseRecommendation";

export function recommendCourses(params: {
  courses: AcademicCourse[];
  snapshot: AcademicDashboardSnapshot;
  allYearsData: AcademicAllYearsData;
  currentYear?: AcademicYear;
  limit?: number;
}) {
  return recommendCoursesInternal(params);
}

export function formatCourseTypeLabel(courseType: AcademicCourse["courseType"]) {
  return formatCourseTypeLabelInternal(courseType);
}
