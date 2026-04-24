import { parseCSVFile, parseCreditRequirements, parseCourses, parseClassScheduleRows, mergeCoursesWithSchedule } from './csvImporter';
import type { CreditRequirementRow, CourseRow, ClassScheduleRow } from './csvImporter';

/**
 * 学科の定義
 */
export interface Department {
  id: string;           // 学科識別子（ファイル名のプレフィックス）
  name: string;         // 学科の表示名
  faculty: string;      // 学部名
}

/**
 * 利用可能な学科リスト
 */
export const AVAILABLE_DEPARTMENTS: Department[] = [
  { id: 'denki', name: '電気電子通信工学科', faculty: '理工学部' },
  { id: 'kikai', name: '機械工学科', faculty: '理工学部' },
  { id: 'kikai_system', name: '機械システム工学科', faculty: '理工学部' },
  { id: 'iyo', name: '医用工学科', faculty: '理工学部' },
  { id: 'ouyou_kagaku', name: '応用化学科', faculty: '理工学部' },
  { id: 'genshiryoku', name: '原子力安全工学科', faculty: '理工学部' },
  { id: 'shizen_shizen', name: '自然科学科（自然コース）', faculty: '理工学部' },
  { id: 'shizen_suuri', name: '自然科学科（数理コース）', faculty: '理工学部' },
] as const;

/**
 * 学科IDと入学年度からCSVファイルのパスを生成
 * パターン:
 * - 卒業要件: /department/rikou/{entranceYear}/{departmentId}_credit_requirements.csv
 * - 科目一覧: /department/rikou/{entranceYear}/{departmentId}_timetable_by_category.csv
 * - fallback: /department/rikou/{departmentId}_credit_requirements.csv
 * - fallback: /department/rikou/{departmentId}_timetable_by_category.csv
 */
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

function buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const basePath = `/department/rikou`;

  if (entranceYear) {
    return {
      requirements: `${basePath}/${entranceYear}/${departmentId}_credit_requirements.csv`,
      timetable: `${basePath}/${entranceYear}/${departmentId}_timetable_by_category.csv`,
      schedule: `${basePath}/${entranceYear}/${departmentId}_${entranceYear}_spring_schedule.csv`,
      sharedSchedule: `${basePath}/${entranceYear}/rikou_${entranceYear}_spring_schedule.csv`,
      fallbackRequirements: `${basePath}/${departmentId}_credit_requirements.csv`,
      fallbackTimetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
      fallbackSchedule: `${basePath}/${departmentId}_${entranceYear}_spring_schedule.csv`,
      fallbackSharedSchedule: `${basePath}/rikou_${entranceYear}_spring_schedule.csv`,
    };
  }

  return {
    requirements: `${basePath}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
    schedule: `${basePath}/${departmentId}_spring_schedule.csv`,
    sharedSchedule: `${basePath}/rikou_spring_schedule.csv`,
  };
}

async function fetchOptionalCSVText(paths: Array<string | undefined>) {
  for (const path of paths.filter(Boolean) as string[]) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        return { text: await response.text(), path };
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

  return null;
}

async function fetchCSVText(primaryPath: string, fallbackPath?: string) {
  const response = await fetch(primaryPath);
  if (response.ok) {
    return { text: await response.text(), path: primaryPath };
  }

  if (response.status === 404 && fallbackPath) {
    const fallbackResponse = await fetch(fallbackPath);
    if (fallbackResponse.ok) {
      return { text: await fallbackResponse.text(), path: fallbackPath };
    }

    throw new Error(
      `Failed to load CSV. primary=${primaryPath} (${response.status} ${response.statusText}), fallback=${fallbackPath} (${fallbackResponse.status} ${fallbackResponse.statusText})`
    );
  }

  throw new Error(
    `Failed to load CSV. primary=${primaryPath} (${response.status} ${response.statusText})`
  );
}

/**
 * publicフォルダ内のCSVファイルを自動読み込み
 */
export async function autoLoadDepartmentCSVs(departmentId: string, entranceYear?: number) {
  console.log('🚀 Auto-loading CSVs for department:', departmentId, 'entranceYear:', entranceYear);
  
  const paths = buildCSVPaths(departmentId, entranceYear);
  console.log('📂 CSV paths:', paths);
  
  try {
    // 卒業要件CSVを読み込み
    console.log('📥 Fetching requirements from:', paths.requirements);
    const requirementsResult = await fetchCSVText(paths.requirements, paths.fallbackRequirements);
    const requirementsText = requirementsResult.text;
    console.log('✅ Requirements CSV loaded from:', requirementsResult.path, 'size:', requirementsText.length, 'bytes');
    
    // 時間割CSVを読み込み
    console.log('📥 Fetching timetable from:', paths.timetable);
    const timetableResult = await fetchCSVText(paths.timetable, paths.fallbackTimetable);
    const timetableText = timetableResult.text;
    console.log('✅ Timetable CSV loaded from:', timetableResult.path, 'size:', timetableText.length, 'bytes');
    
    // テキストをBlobに変換してFileオブジェクトを作成
    const requirementsBlob = new Blob([requirementsText], { type: 'text/csv' });
    const requirementsFile = new File([requirementsBlob], `${departmentId}_credit_requirements.csv`, { type: 'text/csv' });
    
    const timetableBlob = new Blob([timetableText], { type: 'text/csv' });
    const timetableFile = new File([timetableBlob], `${departmentId}_timetable_by_category.csv`, { type: 'text/csv' });
    
    // パース
    const requirementRows = await parseCSVFile<CreditRequirementRow>(requirementsFile);
    console.log('✅ Parsed requirement rows:', requirementRows.length);
    
    const timetableRows = await parseCSVFile<CourseRow>(timetableFile);
    console.log('✅ Parsed timetable rows:', timetableRows.length);

    const scheduleResult = await fetchOptionalCSVText([
      paths.schedule,
      paths.sharedSchedule,
      paths.fallbackSchedule,
      paths.fallbackSharedSchedule,
    ]);
    let scheduleRows: ClassScheduleRow[] = [];
    if (scheduleResult) {
      console.log('📥 Fetching schedule from:', scheduleResult.path);
      const scheduleBlob = new Blob([scheduleResult.text], { type: 'text/csv' });
      const scheduleFile = new File([scheduleBlob], scheduleResult.path.split('/').pop() ?? 'spring_schedule.csv', { type: 'text/csv' });
      scheduleRows = await parseCSVFile<ClassScheduleRow>(scheduleFile);
      console.log('✅ Parsed schedule rows:', scheduleRows.length);
    } else {
      console.log('ℹ️ Optional schedule CSV not found. Continuing without timetable offerings.');
    }
    
    const curriculum = parseCreditRequirements(requirementRows);
    const timetableCourses = parseCourses(timetableRows);
    const scheduleCourses = scheduleRows.length > 0
      ? parseClassScheduleRows(scheduleRows, departmentId)
      : [];
    const courses = scheduleCourses.length > 0
      ? mergeCoursesWithSchedule(timetableCourses, scheduleCourses)
      : timetableCourses;
    
    // 学科情報を取得
    const dept = AVAILABLE_DEPARTMENTS.find(d => d.id === departmentId);
    const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
    
    console.log('✅ Auto-load complete:', { departmentName, curriculum, coursesCount: courses.length });
    
    return {
      curriculum,
      courses,
      departmentName,
    };
  } catch (error) {
    console.error('❌ Auto-load failed for department:', departmentId, error);
    throw error;
  }
}
