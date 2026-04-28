import { parseCSVFile, parseCreditRequirements, parseCourses, parseClassScheduleRows, mergeCoursesWithSchedule } from './csvImporter';
import type { AcademicCourse, AcademicCurriculum } from './academicProgress';
import type { CreditRequirementRow, CourseRow, ClassScheduleRow } from './csvImporter';

export interface Department {
  id: string;
  name: string;
  faculty: string;
  facultyId: string;
  campus?: string;
  sourceStatus?: 'curriculum_pdf_available' | 'partial_no_department_curriculum_pdf';
}

export const AVAILABLE_DEPARTMENTS: Department[] = [
  { id: 'kikai', name: '機械工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'kikai_system', name: '機械システム工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'denki', name: '電気電子通信工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'iyo', name: '医用工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'ouyou_kagaku', name: '応用化学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'genshiryoku', name: '原子力安全工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'shizen_shizen', name: '自然科学科（自然コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'shizen_suuri', name: '自然科学科（数理コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'kenchiku', name: '建築学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'toshi_kogaku', name: '都市工学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'joho_kagaku', name: '情報科学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'chino_joho', name: '知能情報工学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'kankyo_sosei', name: '環境創生学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'kankyo_keiei', name: '環境経営システム学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'shakai_media', name: '社会メディア学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'joho_system', name: '情報システム学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'design_data', name: 'デザイン・データ科学科', faculty: 'デザイン・データ科学部', facultyId: 'design_data', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'toshi_seikatsu', name: '都市生活学科', faculty: '都市生活学部', facultyId: 'toshi_seikatsu', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'ningen', name: '人間科学科', faculty: '人間科学部', facultyId: 'ningen', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
] as const;

export type CSVLoadStatus = 'success' | 'partial' | 'failed';
export type CSVResourceKind = 'requirements' | 'timetable' | 'schedule';
export type CSVResourceStatus = 'loaded' | 'fallback-loaded' | 'missing' | 'failed' | 'skipped';

export interface CSVResourceLoadResult {
  kind: CSVResourceKind;
  status: CSVResourceStatus;
  path?: string;
  attemptedPaths: string[];
  rowCount?: number;
  message?: string;
  error?: string;
}

export interface AutoLoadDepartmentCSVResult {
  status: CSVLoadStatus;
  departmentId: string;
  departmentName: string;
  entranceYear?: number;
  curriculum: AcademicCurriculum;
  courses: AcademicCourse[];
  stats: {
    requirementRows: number;
    timetableRows: number;
    scheduleRows: number;
    curriculumCourses: number;
    scheduleCourses: number;
    mergedCourses: number;
    coursesWithOfferings: number;
    offerings: number;
  };
  resources: CSVResourceLoadResult[];
  messages: { level: 'info' | 'warning' | 'error'; text: string }[];
}

export class CSVAutoLoadError extends Error {
  status: CSVLoadStatus;
  resources: CSVResourceLoadResult[];
  messages: AutoLoadDepartmentCSVResult['messages'];
  result?: AutoLoadDepartmentCSVResult;
  constructor(message: string, resources: CSVResourceLoadResult[] = [], messages: AutoLoadDepartmentCSVResult['messages'] = [], result?: AutoLoadDepartmentCSVResult) {
    super(message);
    this.name = 'CSVAutoLoadError';
    this.status = 'failed';
    this.resources = resources;
    this.messages = messages;
    this.result = result;
  }
}

type CSVPaths = {
  requirements: string;
  timetable: string;
  schedule: string;
  sharedSchedule: string;
  fallbackRequirements?: string;
  fallbackTimetable?: string;
  fallbackSchedule?: string;
  fallbackSharedSchedule?: string;
};

function findDepartment(departmentId: string): Department | undefined {
  return AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
}

function buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const dept = findDepartment(departmentId);
  const facultyId = dept?.facultyId ?? 'rikou';
  const basePath = `/department/${facultyId}`;
  const legacyRikouPath = `/department/rikou`;
  if (entranceYear) {
    return {
      requirements: `${basePath}/${entranceYear}/${departmentId}_credit_requirements.csv`,
      timetable: `${basePath}/${entranceYear}/${departmentId}_timetable_by_category.csv`,
      schedule: `${basePath}/${entranceYear}/${departmentId}_${entranceYear}_spring_schedule.csv`,
      sharedSchedule: `${basePath}/${entranceYear}/${facultyId}_${entranceYear}_spring_schedule.csv`,
      fallbackRequirements: `${basePath}/${departmentId}_credit_requirements.csv`,
      fallbackTimetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
      fallbackSchedule: `${basePath}/${departmentId}_${entranceYear}_spring_schedule.csv`,
      fallbackSharedSchedule: `${basePath}/${facultyId}_${entranceYear}_spring_schedule.csv`,
    };
  }
  return {
    requirements: `${basePath}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
    schedule: `${basePath}/${departmentId}_spring_schedule.csv`,
    sharedSchedule: `${basePath}/${facultyId}_spring_schedule.csv`,
    fallbackRequirements: `${legacyRikouPath}/${departmentId}_credit_requirements.csv`,
    fallbackTimetable: `${legacyRikouPath}/${departmentId}_timetable_by_category.csv`,
  };
}

async function fetchRequiredCSVText(kind: CSVResourceKind, primaryPath: string, fallbackPath?: string): Promise<{ text: string; result: CSVResourceLoadResult }> {
  const attemptedPaths = [primaryPath, fallbackPath].filter(Boolean) as string[];
  const primaryResponse = await fetch(primaryPath);
  if (primaryResponse.ok) {
    return { text: await primaryResponse.text(), result: { kind, status: 'loaded', path: primaryPath, attemptedPaths, message: `${kind} CSVを読み込みました。` } };
  }
  if (primaryResponse.status === 404 && fallbackPath) {
    const fallbackResponse = await fetch(fallbackPath);
    if (fallbackResponse.ok) {
      return { text: await fallbackResponse.text(), result: { kind, status: 'fallback-loaded', path: fallbackPath, attemptedPaths, message: `${kind} CSVをfallbackから読み込みました。` } };
    }
    throw new CSVAutoLoadError(`${kind} CSVの読み込みに失敗しました。primary=${primaryPath} (${primaryResponse.status}), fallback=${fallbackPath} (${fallbackResponse.status})`, [{ kind, status: 'failed', path: fallbackPath, attemptedPaths, message: `${kind} CSVの読み込みに失敗しました。`, error: `${fallbackResponse.status} ${fallbackResponse.statusText}` }]);
  }
  throw new CSVAutoLoadError(`${kind} CSVの読み込みに失敗しました。primary=${primaryPath} (${primaryResponse.status} ${primaryResponse.statusText})`, [{ kind, status: 'failed', path: primaryPath, attemptedPaths, message: `${kind} CSVの読み込みに失敗しました。`, error: `${primaryResponse.status} ${primaryResponse.statusText}` }]);
}

async function fetchOptionalCSVText(kind: CSVResourceKind, paths: Array<string | undefined>): Promise<{ text: string; result: CSVResourceLoadResult }> {
  const attemptedPaths = paths.filter(Boolean) as string[];
  for (const path of attemptedPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) return { text: await response.text(), result: { kind, status: 'loaded', path, attemptedPaths, message: `${kind} CSVを読み込みました。` } };
    } catch (error) {
      if (import.meta.env.DEV) console.warn(`Optional CSV fetch failed: ${path}`, error);
    }
  }
  return { text: '', result: { kind, status: 'missing', attemptedPaths, message: '時間割CSVは見つかりませんでした。科目マスタのみで続行します。' } };
}

export async function autoLoadDepartmentCSVs(departmentId: string, entranceYear?: number): Promise<AutoLoadDepartmentCSVResult> {
  const dept = findDepartment(departmentId);
  const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
  const paths = buildCSVPaths(departmentId, entranceYear);
  const resources: CSVResourceLoadResult[] = [];
  const messages: AutoLoadDepartmentCSVResult['messages'] = [];
  if (dept?.sourceStatus === 'partial_no_department_curriculum_pdf') {
    messages.push({ level: 'warning', text: 'この学科は学科別教育課程表PDF未提供のため、共通分野と時間割由来の補助科目を含みます。卒業判定前に教育課程表PDFで単位数を確認してください。' });
  }
  try {
    const requirementsFetch = await fetchRequiredCSVText('requirements', paths.requirements, paths.fallbackRequirements);
    resources.push(requirementsFetch.result);
    const timetableFetch = await fetchRequiredCSVText('timetable', paths.timetable, paths.fallbackTimetable);
    resources.push(timetableFetch.result);
    const requirementsFile = new File([new Blob([requirementsFetch.text], { type: 'text/csv' })], `${departmentId}_credit_requirements.csv`, { type: 'text/csv' });
    const timetableFile = new File([new Blob([timetableFetch.text], { type: 'text/csv' })], `${departmentId}_timetable_by_category.csv`, { type: 'text/csv' });
    const requirementRows = await parseCSVFile<CreditRequirementRow>(requirementsFile);
    requirementsFetch.result.rowCount = requirementRows.length;
    const timetableRows = await parseCSVFile<CourseRow>(timetableFile);
    timetableFetch.result.rowCount = timetableRows.length;
    const scheduleFetch = await fetchOptionalCSVText('schedule', [paths.schedule, paths.sharedSchedule, paths.fallbackSchedule, paths.fallbackSharedSchedule]);
    resources.push(scheduleFetch.result);
    let scheduleRows: ClassScheduleRow[] = [];
    let scheduleCourses: AcademicCourse[] = [];
    if (scheduleFetch.result.status === 'loaded' && scheduleFetch.text) {
      const scheduleFile = new File([new Blob([scheduleFetch.text], { type: 'text/csv' })], scheduleFetch.result.path?.split('/').pop() ?? 'spring_schedule.csv', { type: 'text/csv' });
      scheduleRows = await parseCSVFile<ClassScheduleRow>(scheduleFile);
      scheduleFetch.result.rowCount = scheduleRows.length;
      scheduleCourses = parseClassScheduleRows(scheduleRows, departmentId);
    }
    const curriculum = parseCreditRequirements(requirementRows);
    const curriculumCourses = parseCourses(timetableRows);
    const courses = scheduleCourses.length > 0 ? mergeCoursesWithSchedule(curriculumCourses, scheduleCourses) : curriculumCourses;
    if (scheduleFetch.result.status === 'missing') messages.push({ level: 'warning', text: '2026年度前期時間割CSVが見つからないため、教室・担当者・講義コードの自動同期は利用できません。' });
    const coursesWithOfferings = courses.filter((course) => (course.offerings?.length ?? 0) > 0).length;
    const offerings = courses.reduce((sum, course) => sum + (course.offerings?.length ?? 0), 0);
    return { status: scheduleCourses.length > 0 ? 'success' : 'partial', departmentId, departmentName, entranceYear, curriculum, courses, stats: { requirementRows: requirementRows.length, timetableRows: timetableRows.length, scheduleRows: scheduleRows.length, curriculumCourses: curriculumCourses.length, scheduleCourses: scheduleCourses.length, mergedCourses: courses.length, coursesWithOfferings, offerings }, resources, messages };
  } catch (error) {
    const result: AutoLoadDepartmentCSVResult = { status: 'failed', departmentId, departmentName, entranceYear, curriculum: { name: departmentName, requiredCredits: 0, breakdown: { required: 0, electiveRequired: 0, elective: 0 } }, courses: [], stats: { requirementRows: 0, timetableRows: 0, scheduleRows: 0, curriculumCourses: 0, scheduleCourses: 0, mergedCourses: 0, coursesWithOfferings: 0, offerings: 0 }, resources, messages };
    if (error instanceof CSVAutoLoadError) throw new CSVAutoLoadError(error.message, error.resources.length > 0 ? error.resources : resources, [...messages, ...error.messages], result);
    throw new CSVAutoLoadError(error instanceof Error ? error.message : 'CSVの読み込みに失敗しました。', resources, messages, result);
  }
}
