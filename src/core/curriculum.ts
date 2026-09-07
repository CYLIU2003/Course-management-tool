import type { AcademicCourse, AcademicCurriculum } from './types';
import type { ApplicableCourseRow } from '../utils/csvImporter';

export interface DegreeGroup {
  id: string;
  category: string;
  name: string;
  symbols: string[];
  minimumCredits: number;
  membership: 'all_marked' | 'minimum';
  courseGroup: string | null;
  courseCategories: string[];
  evidence: { sourceId: string; sourceSha256: string; page: number; method: string };
}

export interface DegreeRequirementSet {
  id: string;
  departmentId: string;
  entranceYear: number;
  variant: string;
  variantName: string;
  totalCredits: number;
  categories: Array<{ id: string; name: string; minimumCredits: number; courseCategories: string[] }>;
  freeChoice: { minimumCredits: number; method: 'category_surplus'; note: string };
  evidence: { sourceId: string; sourceSha256: string; page: number; article: string; method: string };
  coverage: 'category_minima_only' | 'category_and_group_minima';
  groups?: DegreeGroup[];
  conditions?: Array<{ id: string; name: string; kind: 'marked_credit_minimum'; marks: string[]; minimumCredits: number; evidence: DegreeGroup['evidence']; sourceText: string }>;
  symbolLegend?: { faculty: string; year: number; sourceId: string; sourceSha256: string; page: number; text: string };
  sourceConflicts?: Array<{ groupId: string; printedMinimum: number; markedCourseCredits: number; message: string; evidence: DegreeGroup['evidence'][] }>;
  excludedCategories?: Array<{ name: string; reason: string; evidence: { sourceId: string; sourceSha256: string; page: number } }>;
}

export interface CurriculumDataset {
  status: 'success' | 'partial' | 'unavailable' | 'failed';
  referenceOnly?: boolean;
  departmentId: string;
  departmentName: string;
  entranceYear: number;
  curriculum: AcademicCurriculum;
  courses: AcademicCourse[];
  applicableCourses: ApplicableCourseRow[];
  degreeRequirementSets?: DegreeRequirementSet[];
  graduateRequirements?: {
    creditBasis: 'credits' | 'not_credit_based';
    totalCredits: number | null;
    categories: Array<{ name: string; minimumCredits: number; courseCategories?: string[] }>;
    activities?: Array<{ id: string; title: string }>;
    issues: Array<{ kind: string; message: string; printedValues?: number[]; pages?: number[] }>;
    evidence: { sourceId: string; sourceSha256: string; page: number; method: string };
    researchCreditsWithinTcu?: number | null;
    campusMinimumCredits?: Record<string, number>;
  };
}
