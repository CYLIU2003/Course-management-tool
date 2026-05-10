import Papa from 'papaparse';
import type { AcademicCourse, AcademicCurriculumDetail, CourseOffering } from './academicProgress';

export interface CsvRowMeta {
  __rowNumber: number;
}

export interface CsvNormalizedRow extends CsvRowMeta {
  [key: string]: string | number;
}

export interface CsvParseIssue {
  severity: 'error' | 'warning';
  message: string;
  rowNumber?: number;
  field?: string;
}

export interface CsvParseResult<T> {
  rows: Array<T & CsvRowMeta>;
  errors: CsvParseIssue[];
  warnings: CsvParseIssue[];
  meta: Papa.ParseMeta;
}

export interface CsvParseOptions {
  fileLabel?: string;
  requiredFields?: string[];
}

export class CsvValidationError extends Error {
  issues: CsvParseIssue[];

  constructor(message: string, issues: CsvParseIssue[] = []) {
    super(message);
    this.name = 'CsvValidationError';
    this.issues = issues;
  }
}

export const CREDIT_REQUIREMENT_CSV_HEADERS = [
  'stage',
  'area',
  'subarea',
  'total_required_credits',
  '必修_credits',
  '選択必修1_credits',
  '選択必修2_credits',
  '自由_credits',
  'notes',
];

export const COURSE_CSV_HEADERS = [
  'id',
  'title',
  'credits',
  'raw_required',
  'category',
  'group',
  'courseType',
];

export const CLASS_SCHEDULE_CSV_HEADERS = [
  'departmentId',
  'sourceDepartment',
  'day',
  'period',
  'term',
  'gradeYear',
  'className',
  'title',
  'teacher',
  'lectureCode',
  'room',
  'target',
  'remarks',
  'requiredFlag',
  'sourcePage',
];

function normalizeCsvCell(value: unknown): string {
  if (value == null) {
    return '';
  }

  return String(value).replace(/^\uFEFF/, '').trim();
}

function normalizeCsvRow(row: Record<string, unknown>, rowNumber: number): CsvNormalizedRow {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(row)) {
    normalized[key] = normalizeCsvCell(value);
  }

  return { ...normalized, __rowNumber: rowNumber };
}

function createIssue(severity: CsvParseIssue['severity'], message: string, rowNumber?: number, field?: string): CsvParseIssue {
  return { severity, message, rowNumber, field };
}

function formatFieldLabel(field: string) {
  return field;
}

function parseStrictNumber(value: string | number | undefined, field: string, fileLabel: string, rowNumber: number) {
  const normalizedValue = normalizeCsvCell(value);
  if (!normalizedValue) {
    throw new CsvValidationError(`${fileLabel}の${rowNumber}行目で${formatFieldLabel(field)}が空欄です。`, [createIssue('error', `${formatFieldLabel(field)}が空欄です。`, rowNumber, field)]);
  }

  const numericValue = Number(normalizedValue.replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) {
    throw new CsvValidationError(`${fileLabel}の${rowNumber}行目で${formatFieldLabel(field)}が数値ではありません。`, [createIssue('error', `${formatFieldLabel(field)}が数値ではありません。`, rowNumber, field)]);
  }

  return numericValue;
}

function parseOptionalNumber(value: string | number | undefined, field: string, fileLabel: string, rowNumber: number) {
  const normalizedValue = normalizeCsvCell(value);
  if (!normalizedValue) {
    return undefined;
  }

  const numericValue = Number(normalizedValue.replace(/,/g, ''));
  if (!Number.isFinite(numericValue)) {
    throw new CsvValidationError(`${fileLabel}の${rowNumber}行目で${formatFieldLabel(field)}が数値ではありません。`, [createIssue('error', `${formatFieldLabel(field)}が数値ではありません。`, rowNumber, field)]);
  }

  return numericValue;
}

function parseOptionalList(value: string | number | undefined) {
  const normalizedValue = normalizeCsvCell(value);
  if (!normalizedValue) {
    return undefined;
  }

  const items = normalizedValue
    .split(/[\n,;；、]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : undefined;
}

function parseRequiredText(value: string | number | undefined, field: string, fileLabel: string, rowNumber: number) {
  const normalizedValue = normalizeCsvCell(value);
  if (!normalizedValue) {
    throw new CsvValidationError(`${fileLabel}の${rowNumber}行目で${formatFieldLabel(field)}が空欄です。`, [createIssue('error', `${formatFieldLabel(field)}が空欄です。`, rowNumber, field)]);
  }

  return normalizedValue;
}

function formatIssues(issues: CsvParseIssue[]) {
  return issues.map((issue) => {
    const rowPrefix = issue.rowNumber ? `row ${issue.rowNumber}: ` : '';
    const fieldPrefix = issue.field ? `${issue.field}: ` : '';
    return `${rowPrefix}${fieldPrefix}${issue.message}`;
  }).join('\n');
}

export function formatCsvIssues(issues: CsvParseIssue[]) {
  return formatIssues(issues);
}

export interface CreditRequirementRow {
  stage: string;
  area: string;
  subarea: string;
  total_required_credits: number;
  必修_credits: number;
  選択必修1_credits: number;
  選択必修2_credits: number;
  自由_credits: number;
  notes?: string;
}

export interface CourseRow {
  id: string;
  title: string;
  credits: number;
  raw_required: string;
  category: string;
  group: string;
  courseType: 'required' | 'elective-required' | 'elective' | 'unknown';
  lectureCodes?: string[];
  aliases?: string[];
  departmentId?: string;
  curriculumYear?: number;
}

export interface ClassScheduleRow {
  departmentId: string;
  sourceDepartment: string;
  day: string;
  period: string;
  term: string;
  gradeYear?: string;
  className?: string;
  title: string;
  teacher?: string;
  lectureCode: string;
  room?: string;
  target?: string;
  remarks?: string;
  requiredFlag?: string;
  sourcePage?: number;
}

interface CsvSchema<T> {
  fileLabel: string;
  requiredFields: string[];
  parseRow: (row: CsvNormalizedRow, rowNumber: number, fileLabel: string) => T;
}

function parseCsvFileStrict<T>(file: File, schema: CsvSchema<T>): Promise<CsvParseResult<T>> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (header) => header.replace(/^\uFEFF/, '').trim(),
      beforeFirstChunk: (chunk) => chunk.replace(/^\uFEFF/, ''),
      complete: (results) => {
        const errors: CsvParseIssue[] = [];
        const warnings: CsvParseIssue[] = [];
        const requiredFields = schema.requiredFields;
        const fields = (results.meta.fields ?? []).map((field) => field.trim());

        for (const requiredField of requiredFields) {
          if (!fields.includes(requiredField)) {
            errors.push(createIssue('error', `必須列 ${requiredField} が見つかりません。`, undefined, requiredField));
          }
        }

        for (const parseError of results.errors) {
          errors.push(createIssue('error', parseError.message, parseError.row ? parseError.row + 2 : undefined));
        }

        const rows: Array<T & CsvRowMeta> = [];

        if (errors.length === 0) {
          results.data.forEach((rawRow, index) => {
            const rowNumber = index + 2;
            const normalizedRow = normalizeCsvRow(rawRow, rowNumber);
            const hasAnyContent = Object.entries(normalizedRow).some(([key, value]) => key !== '__rowNumber' && String(value).trim() !== '');

            if (!hasAnyContent) {
              return;
            }

            try {
              const parsedRow = schema.parseRow(normalizedRow, rowNumber, schema.fileLabel);
              rows.push({ ...parsedRow, __rowNumber: rowNumber });
            } catch (error) {
              if (error instanceof CsvValidationError) {
                errors.push(...error.issues);
                return;
              }

              const message = error instanceof Error ? error.message : 'CSVの行の解析に失敗しました。';
              errors.push(createIssue('error', message, rowNumber));
            }
          });
        }

        resolve({ rows, errors, warnings, meta: results.meta });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

function parseCourseType(value: string | number | undefined, fileLabel: string, rowNumber: number): CourseRow['courseType'] {
  const normalized = normalizeCsvCell(value);
  if (normalized === 'required' || normalized === 'elective-required' || normalized === 'elective') {
    return normalized;
  }

  void fileLabel;
  void rowNumber;
  return 'unknown';
}

function parseCreditRequirementRow(row: CsvNormalizedRow, rowNumber: number, _fileLabel: string): CreditRequirementRow {
  const fileLabel = '卒業要件CSV';
  return {
    stage: parseRequiredText(row.stage, 'stage', fileLabel, rowNumber),
    area: parseRequiredText(row.area, 'area', fileLabel, rowNumber),
    subarea: parseRequiredText(row.subarea, 'subarea', fileLabel, rowNumber),
    total_required_credits: parseStrictNumber(row.total_required_credits, 'total_required_credits', fileLabel, rowNumber),
    必修_credits: parseStrictNumber(row.必修_credits, '必修_credits', fileLabel, rowNumber),
    選択必修1_credits: parseStrictNumber(row.選択必修1_credits, '選択必修1_credits', fileLabel, rowNumber),
    選択必修2_credits: parseStrictNumber(row.選択必修2_credits, '選択必修2_credits', fileLabel, rowNumber),
    自由_credits: parseStrictNumber(row.自由_credits, '自由_credits', fileLabel, rowNumber),
    notes: normalizeCsvCell(row.notes) || undefined,
  };
}

function parseCourseRow(row: CsvNormalizedRow, rowNumber: number, _fileLabel: string): CourseRow {
  const fileLabel = '科目一覧CSV';
  return {
    id: parseRequiredText(row.id, 'id', fileLabel, rowNumber),
    title: parseRequiredText(row.title, 'title', fileLabel, rowNumber),
    credits: parseStrictNumber(row.credits, 'credits', fileLabel, rowNumber),
    raw_required: normalizeCsvCell(row.raw_required),
    category: normalizeCsvCell(row.category),
    group: normalizeCsvCell(row.group),
    courseType: parseCourseType(row.courseType, fileLabel, rowNumber),
    lectureCodes: parseOptionalList(row.lectureCodes ?? row.lectureCode),
    aliases: parseOptionalList(row.aliases),
  };
}

function inferScheduleTerm(fileLabel: string) {
  const normalized = fileLabel.toLowerCase();

  if (normalized.includes('fall') || normalized.includes('autumn') || normalized.includes('後期')) {
    return '後期';
  }

  if (normalized.includes('spring') || normalized.includes('前期')) {
    return '前期';
  }

  if (normalized.includes('summer') || normalized.includes('夏学期')) {
    return '夏学期';
  }

  if (normalized.includes('winter') || normalized.includes('冬学期')) {
    return '冬学期';
  }

  if (normalized.includes('annual') || normalized.includes('通年')) {
    return '通年';
  }

  return '前期';
}

function parseScheduleTerm(row: CsvNormalizedRow, rowNumber: number, fileLabel: string) {
  const normalizedTerm = normalizeCsvCell(row.term);
  if (normalizedTerm) {
    return normalizedTerm;
  }

  const inferredTerm = inferScheduleTerm(fileLabel);
  if (inferredTerm) {
    return inferredTerm;
  }

  const scheduleLabel = fileLabel || '時間割CSV';
  throw new CsvValidationError(`${scheduleLabel}の${rowNumber}行目でtermが空欄です。`, [createIssue('error', 'termが空欄です。', rowNumber, 'term')]);
}

function parseClassScheduleRow(row: CsvNormalizedRow, rowNumber: number, fileLabel: string): ClassScheduleRow {
  return {
    departmentId: parseRequiredText(row.departmentId, 'departmentId', fileLabel, rowNumber),
    sourceDepartment: parseRequiredText(row.sourceDepartment, 'sourceDepartment', fileLabel, rowNumber),
    day: parseRequiredText(row.day, 'day', fileLabel, rowNumber),
    period: parseRequiredText(row.period, 'period', fileLabel, rowNumber),
    term: parseScheduleTerm(row, rowNumber, fileLabel),
    gradeYear: normalizeCsvCell(row.gradeYear) || undefined,
    className: normalizeCsvCell(row.className) || undefined,
    title: parseRequiredText(row.title, 'title', fileLabel, rowNumber),
    teacher: normalizeCsvCell(row.teacher) || undefined,
    lectureCode: parseRequiredText(row.lectureCode, 'lectureCode', fileLabel, rowNumber),
    room: normalizeCsvCell(row.room) || undefined,
    target: normalizeCsvCell(row.target) || undefined,
    remarks: normalizeCsvCell(row.remarks) || undefined,
    requiredFlag: normalizeCsvCell(row.requiredFlag) || undefined,
    sourcePage: parseOptionalNumber(row.sourcePage, 'sourcePage', fileLabel, rowNumber),
  };
}

export function parseCreditRequirementsFile(file: File) {
  return parseCsvFileStrict(file, {
    fileLabel: '卒業要件CSV',
    requiredFields: CREDIT_REQUIREMENT_CSV_HEADERS,
    parseRow: parseCreditRequirementRow,
  });
}

export function parseCoursesFile(file: File) {
  return parseCsvFileStrict(file, {
    fileLabel: '科目一覧CSV',
    requiredFields: COURSE_CSV_HEADERS,
    parseRow: parseCourseRow,
  }).then((result) => {
    const warnings = [...result.warnings];

    for (const row of result.rows) {
      if (row.courseType === 'unknown') {
        warnings.push(
          createIssue(
            'warning',
            'courseTypeが不明なため「区分未確認」として読み込みました。',
            row.__rowNumber,
            'courseType',
          ),
        );
      }
    }

    return {
      ...result,
      warnings,
    };
  });
}

export function parseClassScheduleFile(file: File) {
  return parseCsvFileStrict(file, {
    fileLabel: file.name,
    requiredFields: CLASS_SCHEDULE_CSV_HEADERS,
    parseRow: parseClassScheduleRow,
  });
}

function parseTags(rawRequired: string): string[] {
  const tags: string[] = [];
  if (rawRequired.includes('※DS')) tags.push('DS');
  if (rawRequired.includes('※MS')) tags.push('MS');
  if (rawRequired.includes('G')) tags.push('G');
  if (rawRequired.includes('*')) tags.push('STAR');
  return tags;
}

function parseRequirementSubtype(rawRequired: string) {
  if (rawRequired.includes('△1')) return 'triangle1' as const;
  if (rawRequired.includes('△2')) return 'triangle2' as const;
  return 'none' as const;
}

export function normalizeCourseTitle(value: string) {
  return value
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/ﾘﾒﾃﾞｨｱﾙｸﾗｽ/g, 'リメディアルクラス')
    .trim();
}

function parseScheduleCourseType(requiredFlag?: string) {
  return requiredFlag === '○' ? 'required' : 'elective';
}

export function parseClassScheduleRows(rows: ClassScheduleRow[], departmentId: string): AcademicCourse[] {
  const filtered = rows.filter((row) => row.departmentId === departmentId && row.title && row.lectureCode);
  const seen = new Set<string>();

  return filtered.flatMap((row) => {
    const offeringId = [row.departmentId, row.lectureCode, row.day, row.period, row.term, row.className || 'all'].join(':');
    const key = offeringId;
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);

    const offering: CourseOffering = {
      id: offeringId,
      courseId: row.lectureCode,
      departmentId: row.departmentId,
      sourceDepartment: row.sourceDepartment,
      day: row.day,
      period: row.period,
      term: row.term,
      gradeYear: row.gradeYear,
      className: row.className,
      teacher: row.teacher,
      lectureCode: row.lectureCode,
      room: row.room,
      target: row.target,
      remarks: row.remarks,
      requiredFlag: row.requiredFlag,
      sourcePage: row.sourcePage,
    };

    return [{
      id: `schedule:${row.lectureCode}:${row.day}${row.period}:${row.term}:${row.className || 'all'}`,
      title: row.title,
      credits: 0,
      category: '2026年度前期時間割',
      group: [
        row.term,
        row.day && row.period ? `${row.day}${row.period}限` : '',
        row.gradeYear ? `${row.gradeYear}年` : '',
        row.className,
      ].filter(Boolean).join(' / '),
      courseType: parseScheduleCourseType(row.requiredFlag),
      rawRequired: [
        '2026前期時間割',
        row.term,
        row.day && row.period ? `${row.day}${row.period}限` : '',
        row.gradeYear ? `${row.gradeYear}年` : '',
        row.className ? `クラス:${row.className}` : '',
        row.teacher ? `担当:${row.teacher}` : '',
        row.room ? `教室:${row.room}` : '',
        row.lectureCode ? `講義コード:${row.lectureCode}` : '',
        row.target,
        row.remarks,
        row.requiredFlag ? `必修印:${row.requiredFlag}` : '',
        row.sourcePage ? `PDF p.${row.sourcePage}` : '',
      ].filter(Boolean).join(' / '),
      tags: ['2026前期', '時間割', ...(row.requiredFlag === '○' ? ['必修印'] : [])],
      requirementSubtype: 'none',
      sourceKind: 'schedule',
      departmentId: row.departmentId,
      lectureCodes: [row.lectureCode],
      aliases: [row.title],
      offerings: [offering],
    } satisfies AcademicCourse];
  });
}

export interface CourseMergeStats {
  matchedByLectureCode: number;
  matchedByCourseId: number;
  matchedByTitle: number;
  ambiguousMatches: number;
  unmatchedOfferings: number;
  unmatchedCourseRows: number;
  unknownCourseTypes: number;
}

export interface MergeCoursesWithScheduleResult {
  courses: AcademicCourse[];
  stats: CourseMergeStats;
}

function normalizeLookupText(value: string) {
  return normalizeCourseTitle(value).toLowerCase();
}

function uniqueStrings(values: Array<string | undefined>) {
  return [...new Set(values.filter((value): value is string => Boolean(value && value.trim())))];
}

function courseLookupKeys(course: AcademicCourse) {
  return new Set(
    uniqueStrings([
      course.id,
      ...(course.lectureCodes ?? []),
      ...(course.aliases ?? []),
    ]).map((value) => normalizeLookupText(value)),
  );
}

function getScheduleOffering(schedule: AcademicCourse) {
  return schedule.offerings?.[0];
}

function scoreCourseMatch(course: AcademicCourse, schedule: AcademicCourse) {
  const offering = getScheduleOffering(schedule);
  const lectureCode = normalizeLookupText(offering?.lectureCode ?? '');
  const courseKeys = courseLookupKeys(course);
  if (lectureCode && courseKeys.has(lectureCode)) {
    return { reason: 'lectureCode' as const, score: 0 };
  }

  const courseId = normalizeLookupText(course.id);
  const offeringCourseId = normalizeLookupText(offering?.courseId ?? '');
  if (courseId && offeringCourseId && courseId === offeringCourseId) {
    return { reason: 'courseId' as const, score: 1 };
  }

  const normalizedTitle = normalizeLookupText(schedule.title);
  const normalizedCourseTitle = normalizeLookupText(course.title);
  if (!normalizedTitle || normalizedTitle !== normalizedCourseTitle) {
    return null;
  }

  const normalizedDepartment = normalizeLookupText(schedule.departmentId ?? offering?.departmentId ?? '');
  const normalizedCourseDepartment = normalizeLookupText(course.departmentId ?? '');
  if (normalizedDepartment && normalizedCourseDepartment && normalizedDepartment === normalizedCourseDepartment) {
    return { reason: 'title' as const, score: 2 };
  }

  return { reason: 'title' as const, score: 3 };
}

export function mergeCoursesWithScheduleDetailed(courses: AcademicCourse[], scheduleCourses: AcademicCourse[]): MergeCoursesWithScheduleResult {
  const mergedCourses: AcademicCourse[] = courses.map((course) => ({
    ...course,
    sourceKind: course.sourceKind ?? 'curriculum',
    offerings: [...(course.offerings ?? [])],
  }));

  const stats: CourseMergeStats = {
    matchedByLectureCode: 0,
    matchedByCourseId: 0,
    matchedByTitle: 0,
    ambiguousMatches: 0,
    unmatchedOfferings: 0,
    unmatchedCourseRows: 0,
    unknownCourseTypes: mergedCourses.filter((course) => course.courseType === 'unknown').length,
  };

  for (const schedule of scheduleCourses) {
    const candidates = mergedCourses
      .map((course, index) => ({
        course,
        index,
        match: scoreCourseMatch(course, schedule),
      }))
      .filter((candidate): candidate is { course: AcademicCourse; index: number; match: { reason: 'lectureCode' | 'courseId' | 'title'; score: number } } => Boolean(candidate.match));

    if (candidates.length === 0) {
      stats.unmatchedOfferings += 1;
      mergedCourses.push(schedule);
      continue;
    }

    candidates.sort((left, right) => left.match.score - right.match.score || left.course.title.localeCompare(right.course.title, 'ja'));
    const bestScore = candidates[0].match.score;
    const bestMatches = candidates.filter((candidate) => candidate.match.score === bestScore);

    if (bestMatches.length > 1) {
      stats.ambiguousMatches += 1;
    }

    const matched = bestMatches[0];
    if (matched.match.reason === 'lectureCode') {
      stats.matchedByLectureCode += 1;
    } else if (matched.match.reason === 'courseId') {
      stats.matchedByCourseId += 1;
    } else {
      stats.matchedByTitle += 1;
    }

    const matchedCourse = mergedCourses[matched.index];
    matchedCourse.offerings = [
      ...(matchedCourse.offerings ?? []),
      ...(schedule.offerings ?? []),
    ];

    if (!matchedCourse.rawRequired && schedule.rawRequired) {
      matchedCourse.rawRequired = schedule.rawRequired;
    }

    if (!matchedCourse.tags?.length && schedule.tags?.length) {
      matchedCourse.tags = schedule.tags;
    }

    if (!matchedCourse.departmentId && schedule.departmentId) {
      matchedCourse.departmentId = schedule.departmentId;
    }

    if (schedule.lectureCodes?.length) {
      matchedCourse.lectureCodes = uniqueStrings([...(matchedCourse.lectureCodes ?? []), ...schedule.lectureCodes]);
    }

    if (schedule.aliases?.length) {
      matchedCourse.aliases = uniqueStrings([...(matchedCourse.aliases ?? []), ...schedule.aliases]);
    }
  }

  stats.unmatchedCourseRows = mergedCourses.filter((course) => course.sourceKind !== 'schedule' && (course.offerings?.length ?? 0) === 0).length;

  return {
    courses: mergedCourses,
    stats,
  };
}

export function mergeCoursesWithSchedule(courses: AcademicCourse[], scheduleCourses: AcademicCourse[]) {
  return mergeCoursesWithScheduleDetailed(courses, scheduleCourses).courses;
}

// 卒業要件CSVからカリキュラムテンプレートを生成
export function parseCreditRequirements(rows: CreditRequirementRow[]) {
  console.log('🔄 parseCreditRequirements: Processing', rows.length, 'rows');
  
  // 卒業要件の行のみをフィルタ
  const graduationRows = rows.filter(row => row.stage === '卒業');
  console.log('📋 Graduation rows found:', graduationRows.length);
  
  let required = 0;
  let electiveRequired = 0;
  let elective = 0;
  let total = 0;
  const details: AcademicCurriculumDetail[] = [];

  graduationRows.forEach(row => {
    const requiredCredits = row.必修_credits;
    const electiveRequired1 = row.選択必修1_credits;
    const electiveRequired2 = row.選択必修2_credits;
    const freeCredits = row.自由_credits;
    
    required += requiredCredits;
    electiveRequired += electiveRequired1 + electiveRequired2;
    elective += freeCredits;
    details.push({
      stage: row.stage,
      area: row.area,
      subarea: row.subarea,
      totalRequiredCredits: row.total_required_credits,
      requiredCredits,
      electiveRequired1Credits: electiveRequired1,
      electiveRequired2Credits: electiveRequired2,
      freeCredits,
      notes: row.notes,
    });
    
    console.log('  Row:', row.subarea, 'Required:', requiredCredits, 'Elective-Req:', electiveRequired1 + electiveRequired2, 'Free:', freeCredits);
  });

  // 総単位数を計算
  total = required + electiveRequired + elective;

  const result = {
    name: '卒業要件',
    requiredCredits: total,
    breakdown: {
      required,
      electiveRequired,
      elective,
    },
    details,
  };
  
  console.log('✅ parseCreditRequirements: Result', result);
  return result;
}

// 科目CSVから科目リストを取得
export function parseCourses(rows: CourseRow[], departmentId?: string): AcademicCourse[] {
  console.log('🔄 parseCourses: Processing', rows.length, 'rows');
  
  const courses = rows
    .filter(row => row.id && row.title) // 空行をフィルタ
    .map(row => {
      return {
        id: row.id,
        title: row.title,
        credits: row.credits,
        category: row.category,
        group: row.group,
        courseType: row.courseType,
        rawRequired: row.raw_required,
        tags: parseTags(row.raw_required),
        requirementSubtype: parseRequirementSubtype(row.raw_required),
        sourceKind: 'curriculum' as const,
        departmentId,
        lectureCodes: row.lectureCodes,
        aliases: row.aliases,
      };
    });
  
  console.log('✅ parseCourses: Processed', courses.length, 'courses');
  return courses;
}

// departmentフォルダ内のファイルを検索して一覧を返す
export async function loadDepartmentCSVs(departmentName: string, category: 'requirements' | 'timetable') {
  const basePath = `/department/${departmentName}`;
  const filename = category === 'requirements' 
    ? `${departmentName}_credit_requirements.csv`
    : `${departmentName}_timetable_by_category.csv`;
  
  const fullPath = `${basePath}/${filename}`;
  
  return fullPath;
}
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
