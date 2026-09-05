import type { AcademicCourse, AcademicCurriculum } from './types';
import type { ApplicableCourseRow } from '../utils/csvImporter';

export interface CurriculumDataset {
  status: 'success' | 'partial' | 'unavailable' | 'failed';
  referenceOnly?: boolean;
  departmentId: string;
  departmentName: string;
  entranceYear: number;
  curriculum: AcademicCurriculum;
  courses: AcademicCourse[];
  applicableCourses: ApplicableCourseRow[];
}
