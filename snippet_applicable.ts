export const APPLICABLE_COURSES_CSV_HEADERS = [
  'departmentId',
  'facultyId',
  'stage',
  'area',
  'subarea',
  'requirementKey',
  'requiredCredits',
  'courseId',
  'title',
  'credits',
  'courseType',
  'applicability',
];

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

export function parseApplicableCourseRow(row: CsvNormalizedRow): ApplicableCourseRow {
  return {
    departmentId: String(row.departmentId || ''),
    facultyId: String(row.facultyId || ''),
    stage: String(row.stage || ''),
    area: String(row.area || ''),
    subarea: String(row.subarea || ''),
    requirementKey: String(row.requirementKey || ''),
    requiredCredits: Number(row.requiredCredits || 0),
    courseId: String(row.courseId || ''),
    title: String(row.title || ''),
    credits: Number(row.credits || 0),
    courseType: String(row.courseType || ''),
    category: String(row.category || ''),
    group: String(row.group || ''),
    applicability: String(row.applicability || ''),
    matchReason: String(row.matchReason || ''),
    sourceQuality: String(row.sourceQuality || ''),
    notes: row.notes != null ? String(row.notes) : undefined,
  };
}

export function parseApplicableCoursesFile(file: File) {
  return parseCsvFileStrict(file, {
    fileLabel: '該当科目CSV',
    requiredFields: APPLICABLE_COURSES_CSV_HEADERS,
    parseRow: parseApplicableCourseRow,
  });
}
