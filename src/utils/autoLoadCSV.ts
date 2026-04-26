import { parseCSVFile, parseCreditRequirements, parseCourses, parseClassScheduleRows, mergeCoursesWithSchedule } from './csvImporter';
import type { AcademicCourse, AcademicCurriculum } from './academicProgress';
import type { CreditRequirementRow, CourseRow, ClassScheduleRow } from './csvImporter';

/**
 * 学科の定義
 */
export interface Department {
  id: string;           // 学科識別子（ファイル名のプレフィックス）
  name: string;         // 学科の表示名
  faculty: string;      // 学部名
  facultyId: string;    // 学部識別子（public/department配下のフォルダ名）
}

/**
 * 利用可能な学科リスト
 */
export const AVAILABLE_DEPARTMENTS: Department[] = [
  { id: 'kikai', name: '機械工学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'kikai_system', name: '機械システム工学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'denki', name: '電気電子通信工学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'iyo', name: '医用工学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'ouyou_kagaku', name: '応用化学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'genshiryoku', name: '原子力安全工学科', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'shizen_shizen', name: '自然科学科（自然コース）', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'shizen_suuri', name: '自然科学科（数理コース）', faculty: '理工学部', facultyId: 'rikou' },
  { id: 'kenchiku', name: '建築学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi' },
  { id: 'toshi_kogaku', name: '都市工学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi' },
  { id: 'joho_kagaku', name: '情報科学科', faculty: '情報工学部', facultyId: 'joho' },
  { id: 'chino_joho', name: '知能情報工学科', faculty: '情報工学部', facultyId: 'joho' },
  { id: 'kankyo_sosei', name: '環境創生学科', faculty: '環境学部', facultyId: 'kankyo' },
  { id: 'kankyo_keiei', name: '環境経営システム学科', faculty: '環境学部', facultyId: 'kankyo' },
  { id: 'shakai_media', name: '社会メディア学科', faculty: 'メディア情報学部', facultyId: 'media_joho' },
  { id: 'joho_system', name: '情報システム学科', faculty: 'メディア情報学部', facultyId: 'media_joho' },
  { id: 'design_data', name: 'デザイン・データ科学科', faculty: 'デザイン・データ科学部', facultyId: 'design_data' },
  { id: 'toshi_seikatsu', name: '都市生活学科', faculty: '都市生活学部', facultyId: 'toshi_seikatsu' },
  { id: 'ningen', name: '人間科学科', faculty: '人間科学部', facultyId: 'ningen' },
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
  messages: {
    level: 'info' | 'warning' | 'error';
    text: string;
  }[];
}

export class CSVAutoLoadError extends Error {
  status: CSVLoadStatus;
  resources: CSVResourceLoadResult[];
  messages: AutoLoadDepartmentCSVResult['messages'];
  result?: AutoLoadDepartmentCSVResult;

  constructor(
    message: string,
    resources: CSVResourceLoadResult[] = [],
    messages: AutoLoadDepartmentCSVResult['messages'] = [],
    result?: AutoLoadDepartmentCSVResult,
  ) {
    super(message);
    this.name = 'CSVAutoLoadError';
    this.status = 'failed';
    this.resources = resources;
    this.messages = messages;
    this.result = result;
  }
}

/**
 * 学科IDと入学年度からCSVファイルのパスを生成
 * パターン:
 * - 卒業要件: /department/{facultyId}/{entranceYear}/{departmentId}_credit_requirements.csv
 * - 科目一覧: /department/{facultyId}/{entranceYear}/{departmentId}_timetable_by_category.csv
 * - fallback（理工学部のみ）: /department/rikou/{departmentId}_*.csv
 */
type CSVPaths = {
  requirements: string;
  timetable: string;
  schedule: string;
  sharedSchedule: string;
};

function buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const department = AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
  const facultyId = department?.facultyId ?? 'rikou';
  const basePath = `/department/${facultyId}`;
  const sharedSchedulePrefix = facultyId;

  if (entranceYear) {
    return {
      requirements: `${basePath}/${entranceYear}/${departmentId}_credit_requirements.csv`,
      timetable: `${basePath}/${entranceYear}/${departmentId}_timetable_by_category.csv`,
      schedule: `${basePath}/${entranceYear}/${departmentId}_${entranceYear}_spring_schedule.csv`,
      sharedSchedule: `${basePath}/${entranceYear}/${sharedSchedulePrefix}_${entranceYear}_spring_schedule.csv`,
    };
  }

  return {
    requirements: `${basePath}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
    schedule: `${basePath}/${departmentId}_spring_schedule.csv`,
    sharedSchedule: `${basePath}/${sharedSchedulePrefix}_spring_schedule.csv`,
  };
}

async function fetchRequiredCSVText(
  kind: CSVResourceKind,
  primaryPath: string,
): Promise<{ text: string; result: CSVResourceLoadResult }> {
  const attemptedPaths = [primaryPath];
  const primaryResponse = await fetch(primaryPath);

  if (primaryResponse.ok) {
    return {
      text: await primaryResponse.text(),
      result: {
        kind,
        status: 'loaded',
        path: primaryPath,
        attemptedPaths,
        message: `${kind} CSVを読み込みました。`,
      },
    };
  }

  throw new CSVAutoLoadError(
    `${kind} CSVの読み込みに失敗しました。primary=${primaryPath} (${primaryResponse.status} ${primaryResponse.statusText})`,
    [
      {
        kind,
        status: 'failed',
        path: primaryPath,
        attemptedPaths,
        message: `${kind} CSVの読み込みに失敗しました。`,
        error: `${primaryResponse.status} ${primaryResponse.statusText}`,
      },
    ],
  );
}

async function fetchOptionalCSVText(
  kind: CSVResourceKind,
  paths: Array<string | undefined>,
): Promise<{ text: string; result: CSVResourceLoadResult }> {
  const attemptedPaths = paths.filter(Boolean) as string[];

  for (const path of attemptedPaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        return {
          text: await response.text(),
          result: {
            kind,
            status: 'loaded',
            path,
            attemptedPaths,
            message: `${kind} CSVを読み込みました。`,
          },
        };
      }

      if (import.meta.env.DEV && response.status !== 404) {
        console.warn(`Optional CSV not loaded: ${path} (${response.status} ${response.statusText})`);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn(`Optional CSV fetch failed: ${path}`, error);
      }
    }
  }

  return {
    text: '',
    result: {
      kind,
      status: 'missing',
      attemptedPaths,
      message: '時間割CSVは見つかりませんでした。科目マスタのみで続行します。',
    },
  };
}

/**
 * publicフォルダ内のCSVファイルを自動読み込み
 */
export async function autoLoadDepartmentCSVs(departmentId: string, entranceYear?: number): Promise<AutoLoadDepartmentCSVResult> {
  if (import.meta.env.DEV) {
    console.log('🚀 Auto-loading CSVs for department:', departmentId, 'entranceYear:', entranceYear);
  }

  const paths = buildCSVPaths(departmentId, entranceYear);
  if (import.meta.env.DEV) {
    console.log('📂 CSV paths:', paths);
  }

  const resources: CSVResourceLoadResult[] = [];
  const messages: AutoLoadDepartmentCSVResult['messages'] = [];

  try {
    if (import.meta.env.DEV) {
      console.log('📥 Fetching requirements from:', paths.requirements);
    }
    const requirementsFetch = await fetchRequiredCSVText('requirements', paths.requirements);
    resources.push(requirementsFetch.result);

    if (import.meta.env.DEV) {
      console.log('📥 Fetching timetable from:', paths.timetable);
    }
    const timetableFetch = await fetchRequiredCSVText('timetable', paths.timetable);
    resources.push(timetableFetch.result);

    const requirementsBlob = new Blob([requirementsFetch.text], { type: 'text/csv' });
    const requirementsFile = new File([requirementsBlob], `${departmentId}_credit_requirements.csv`, { type: 'text/csv' });
    const timetableBlob = new Blob([timetableFetch.text], { type: 'text/csv' });
    const timetableFile = new File([timetableBlob], `${departmentId}_timetable_by_category.csv`, { type: 'text/csv' });

    const requirementRows = await parseCSVFile<CreditRequirementRow>(requirementsFile);
    requirementsFetch.result.rowCount = requirementRows.length;
    if (import.meta.env.DEV) {
      console.log('✅ Parsed requirement rows:', requirementRows.length);
    }

    const timetableRows = await parseCSVFile<CourseRow>(timetableFile);
    timetableFetch.result.rowCount = timetableRows.length;
    if (import.meta.env.DEV) {
      console.log('✅ Parsed timetable rows:', timetableRows.length);
    }

    const scheduleFetch = await fetchOptionalCSVText('schedule', [
      paths.schedule,
      paths.sharedSchedule,
    ]);
    resources.push(scheduleFetch.result);

    let scheduleRows: ClassScheduleRow[] = [];
    let scheduleCourses: AcademicCourse[] = [];

    if (scheduleFetch.result.status === 'loaded' && scheduleFetch.text) {
      if (import.meta.env.DEV) {
        console.log('📥 Fetching schedule from:', scheduleFetch.result.path);
      }
      const scheduleBlob = new Blob([scheduleFetch.text], { type: 'text/csv' });
      const scheduleFile = new File([scheduleBlob], scheduleFetch.result.path?.split('/').pop() ?? 'spring_schedule.csv', { type: 'text/csv' });
      scheduleRows = await parseCSVFile<ClassScheduleRow>(scheduleFile);
      scheduleFetch.result.rowCount = scheduleRows.length;
      if (import.meta.env.DEV) {
        console.log('✅ Parsed schedule rows:', scheduleRows.length);
      }
      scheduleCourses = parseClassScheduleRows(scheduleRows, departmentId);
    }

    const curriculum = parseCreditRequirements(requirementRows);
    const curriculumCourses = parseCourses(timetableRows);
    const courses = scheduleCourses.length > 0
      ? mergeCoursesWithSchedule(curriculumCourses, scheduleCourses)
      : curriculumCourses;

    if (scheduleFetch.result.status === 'missing') {
      messages.push({
        level: 'warning',
        text: '2026年度前期時間割CSVが見つからないため、教室・担当者・講義コードの自動同期は利用できません。',
      });
    } else if (scheduleCourses.length === 0) {
      messages.push({
        level: 'warning',
        text: '時間割CSVは見つかりましたが、開講情報を科目一覧に合流できませんでした。CSV列名を確認してください。',
      });
    }

    const dept = AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
    const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
    const coursesWithOfferings = courses.filter((course) => (course.offerings?.length ?? 0) > 0).length;
    const offerings = courses.reduce((sum, course) => sum + (course.offerings?.length ?? 0), 0);

    const result: AutoLoadDepartmentCSVResult = {
      status: scheduleCourses.length > 0 ? 'success' : 'partial',
      departmentId,
      departmentName,
      entranceYear,
      curriculum,
      courses,
      stats: {
        requirementRows: requirementRows.length,
        timetableRows: timetableRows.length,
        scheduleRows: scheduleRows.length,
        curriculumCourses: curriculumCourses.length,
        scheduleCourses: scheduleCourses.length,
        mergedCourses: courses.length,
        coursesWithOfferings,
        offerings,
      },
      resources,
      messages,
    };

    if (import.meta.env.DEV) {
      console.log('✅ Auto-load complete:', { departmentName, curriculum, coursesCount: courses.length, status: result.status });
    }
    return result;
  } catch (error) {
    console.error('❌ Auto-load failed for department:', departmentId, error);

    if (error instanceof CSVAutoLoadError) {
      const dept = AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
      const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
      const result: AutoLoadDepartmentCSVResult = error.result ?? {
        status: 'failed',
        departmentId,
        departmentName,
        entranceYear,
        curriculum: {
          name: departmentName,
          requiredCredits: 0,
          breakdown: { required: 0, electiveRequired: 0, elective: 0 },
        },
        courses: [],
        stats: {
          requirementRows: 0,
          timetableRows: 0,
          scheduleRows: 0,
          curriculumCourses: 0,
          scheduleCourses: 0,
          mergedCourses: 0,
          coursesWithOfferings: 0,
          offerings: 0,
        },
        resources: error.resources.length > 0 ? error.resources : resources,
        messages: [
          ...error.messages,
          {
            level: 'error',
            text: error.message,
          },
        ],
      };

      throw new CSVAutoLoadError(error.message, result.resources, result.messages, result);
    }

    const dept = AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
    const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
    const result: AutoLoadDepartmentCSVResult = {
      status: 'failed',
      departmentId,
      departmentName,
      entranceYear,
      curriculum: {
        name: departmentName,
        requiredCredits: 0,
        breakdown: { required: 0, electiveRequired: 0, elective: 0 },
      },
      courses: [],
      stats: {
        requirementRows: 0,
        timetableRows: 0,
        scheduleRows: 0,
        curriculumCourses: 0,
        scheduleCourses: 0,
        mergedCourses: 0,
        coursesWithOfferings: 0,
        offerings: 0,
      },
      resources,
      messages,
    };

    throw new CSVAutoLoadError(
      error instanceof Error ? error.message : 'CSVの読み込みに失敗しました。',
      resources,
      messages,
      result,
    );
  }
}
