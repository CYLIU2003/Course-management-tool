import {
  buildDashboardSnapshot as buildDashboardSnapshotInternal,
  generateDetailedGraduationWarnings as generateDetailedGraduationWarningsInternal,
  generateGraduationWarnings as generateGraduationWarningsInternal,
} from "../../utils/academicProgress";
import {
  calculateGraduationRequirements as calculateGraduationRequirementsInternal,
} from "../../utils/graduationRequirements";
import {
  calculateGraduationRisk as calculateGraduationRiskInternal,
} from "../../utils/graduationRisk";
import type {
  AcademicAllYearsData,
  AcademicCourse,
  AcademicCurriculum,
  AcademicDashboardSnapshot,
  AcademicSettings,
  AcademicYear,
} from "../types";

export { type GraduationCategory } from "../../utils/graduationRequirements";
export type {
  GraduationRequirementsInput,
  GraduationRequirementsResult,
  GraduationRequirementStatus,
  PlannedCourse,
} from "../../utils/graduationRequirements";
export type {
  GraduationRiskAlert,
  GraduationRiskItem,
  GraduationRiskLevel,
  GraduationRiskSummary,
  GraduationRiskWarning,
} from "../../utils/graduationRisk";

export function buildDashboardSnapshot(
  allYearsData: AcademicAllYearsData,
  settings: AcademicSettings,
) {
  return buildDashboardSnapshotInternal(allYearsData, settings);
}

export function generateGraduationWarnings(
  allYearsData: AcademicAllYearsData,
  settings: AcademicSettings,
) {
  return generateGraduationWarningsInternal(allYearsData, settings);
}

export function generateDetailedGraduationWarnings(
  allYearsData: AcademicAllYearsData,
  courses: AcademicCourse[],
) {
  return generateDetailedGraduationWarningsInternal(allYearsData, courses);
}

export function calculateGraduationRequirements(params: {
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  curriculum?: AcademicCurriculum;
}) {
  return calculateGraduationRequirementsInternal(params);
}

export function calculateGraduationRisk(
  snapshot: AcademicDashboardSnapshot,
  allYearsData: AcademicAllYearsData,
  courses: AcademicCourse[] = [],
  curriculum?: AcademicCurriculum,
) {
  return calculateGraduationRiskInternal(snapshot, allYearsData, courses, curriculum);
}

export function getGraduationRiskForYear(params: {
  snapshot: AcademicDashboardSnapshot;
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  currentYear?: AcademicYear;
  curriculum?: AcademicCurriculum;
}) {
  const risk = calculateGraduationRiskInternal(
    params.snapshot,
    params.allYearsData,
    params.courses,
    params.curriculum,
  );

  return {
    ...risk,
    year: params.currentYear,
  };
}
