export interface ApplicableCourseRow {
  departmentId: string;
  facultyId: string;
  stage: string;
  area: string;
  subarea: string;
  requirementKey: string;
  requiredCredits: number;
  courseId: string;
  title: string;
  credits: number;
  courseType: string;
  category: string;
  group: string;
  applicability: string;
  matchReason: string;
  sourceQuality: string;
  notes?: string;
}

export function parseApplicableCoursesRows(rows: ApplicableCourseRow[]): ApplicableCourseRow[] {
  // We can do validation here, but for now just pass through valid ones
  return rows.filter(r => r.requirementKey && r.courseId);
}
