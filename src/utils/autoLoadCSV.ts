import { parseCSVFile, parseCreditRequirements, parseCourses } from './csvImporter';
import type { CreditRequirementRow, CourseRow } from './csvImporter';

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
 *
 * id は public/department/rikou/{entranceYear}/{id}_*.csv の
 * ファイル名プレフィックスと一致させること。
 */
export const AVAILABLE_DEPARTMENTS: Department[] = [
  {
    id: 'denki',
    name: '電気電子通信工学科',
    faculty: '理工学部',
  },
  {
    id: 'kikai',
    name: '機械工学科',
    faculty: '理工学部',
  },
  {
    id: 'kikai_system',
    name: '機械システム工学科',
    faculty: '理工学部',
  },
  {
    id: 'iyo',
    name: '医用工学科',
    faculty: '理工学部',
  },
  {
    id: 'ouyou_kagaku',
    name: '応用化学科',
    faculty: '理工学部',
  },
  {
    id: 'genshiryoku',
    name: '原子力安全工学科',
    faculty: '理工学部',
  },
  {
    id: 'shizen_shizen',
    name: '自然科学科（自然コース）',
    faculty: '理工学部',
  },
  {
    id: 'shizen_suuri',
    name: '自然科学科（数理コース）',
    faculty: '理工学部',
  },
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
  fallbackRequirements?: string;
  fallbackTimetable?: string;
};

function buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const basePath = `/department/rikou`;

  if (entranceYear) {
    return {
      requirements: `${basePath}/${entranceYear}/${departmentId}_credit_requirements.csv`,
      timetable: `${basePath}/${entranceYear}/${departmentId}_timetable_by_category.csv`,
      fallbackRequirements: `${basePath}/${departmentId}_credit_requirements.csv`,
      fallbackTimetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
    };
  }

  return {
    requirements: `${basePath}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${departmentId}_timetable_by_category.csv`,
  };
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
      `Failed to load CSV. primary=${primaryPath} (${response.status} ${response.statusText}), fallback=${fallbackPath} (${fallbackResponse.status} ${fallbackResponse.statusText})`,
    );
  }

  throw new Error(
    `Failed to load CSV. primary=${primaryPath} (${response.status} ${response.statusText})`,
  );
}

/**
 * publicフォルダ内のCSVファイルを自動読み込み
 */
export async function autoLoadDepartmentCSVs(departmentId: string, entranceYear?: number) {
  if (import.meta.env.DEV) {
    console.log('🚀 Auto-loading CSVs for department:', departmentId, 'entranceYear:', entranceYear);
  }

  const department = AVAILABLE_DEPARTMENTS.find((d) => d.id === departmentId);
  if (!department) {
    throw new Error(`Unknown departmentId: ${departmentId}`);
  }
  
  const paths = buildCSVPaths(departmentId, entranceYear);
  if (import.meta.env.DEV) {
    console.log('📂 CSV paths:', paths);
  }
  
  try {
    // 卒業要件CSVを読み込み
    const requirementsResult = await fetchCSVText(paths.requirements, paths.fallbackRequirements);
    const requirementsText = requirementsResult.text;
    if (import.meta.env.DEV) {
      console.log('✅ Requirements CSV loaded from:', requirementsResult.path, 'size:', requirementsText.length, 'bytes');
    }
    
    // 時間割CSVを読み込み
    const timetableResult = await fetchCSVText(paths.timetable, paths.fallbackTimetable);
    const timetableText = timetableResult.text;
    if (import.meta.env.DEV) {
      console.log('✅ Timetable CSV loaded from:', timetableResult.path, 'size:', timetableText.length, 'bytes');
    }
    
    // テキストをBlobに変換してFileオブジェクトを作成
    const requirementsBlob = new Blob([requirementsText], { type: 'text/csv' });
    const requirementsFile = new File([requirementsBlob], `${departmentId}_credit_requirements.csv`, { type: 'text/csv' });
    
    const timetableBlob = new Blob([timetableText], { type: 'text/csv' });
    const timetableFile = new File([timetableBlob], `${departmentId}_timetable_by_category.csv`, { type: 'text/csv' });
    
    // パース
    const requirementRows = await parseCSVFile<CreditRequirementRow>(requirementsFile);
    const timetableRows = await parseCSVFile<CourseRow>(timetableFile);
    
    const curriculum = parseCreditRequirements(requirementRows);
    const courses = parseCourses(timetableRows);
    
    const departmentName = `${department.faculty} ${department.name}`;
    
    if (import.meta.env.DEV) {
      console.log('✅ Auto-load complete:', { departmentName, curriculum, coursesCount: courses.length });
    }
    
    return {
      curriculum,
      courses,
      departmentName,
      sourcePaths: {
        requirements: requirementsResult.path,
        timetable: timetableResult.path,
      },
    };
  } catch (error) {
    console.error('❌ Auto-load failed for department:', departmentId, error);
    throw error;
  }
}
