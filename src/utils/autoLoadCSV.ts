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
 */
export const AVAILABLE_DEPARTMENTS: Department[] = [
  { 
    id: 'denki', 
    name: '電気電子通信工学科', 
    faculty: '理工学部' 
  },
  {
    id: 'kikai',
    name: '機械工学科',
    faculty: '理工学部'
  }
] as const;

/**
 * 学科IDからCSVファイルのパスを生成
 * パターン:
 * - 卒業要件: /department/rikou/{departmentId}_credit_requirements.csv
 * - 科目一覧: /department/rikou/{departmentId}_timetable_by_category.csv
 */
function buildCSVPaths(departmentId: string) {
  const basePath = `/department/rikou`;
  return {
    requirements: `${basePath}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${departmentId}_timetable_by_category.csv`
  };
}

/**
 * publicフォルダ内のCSVファイルを自動読み込み
 */
export async function autoLoadDepartmentCSVs(departmentId: string) {
  console.log('🚀 Auto-loading CSVs for department:', departmentId);
  
  const paths = buildCSVPaths(departmentId);
  console.log('📂 CSV paths:', paths);
  
  try {
    // 卒業要件CSVを読み込み
    console.log('📥 Fetching requirements from:', paths.requirements);
    const requirementsResponse = await fetch(paths.requirements);
    if (!requirementsResponse.ok) {
      throw new Error(`Failed to load requirements CSV: ${requirementsResponse.statusText}`);
    }
    const requirementsText = await requirementsResponse.text();
    console.log('✅ Requirements CSV loaded, size:', requirementsText.length, 'bytes');
    
    // 時間割CSVを読み込み
    console.log('📥 Fetching timetable from:', paths.timetable);
    const timetableResponse = await fetch(paths.timetable);
    if (!timetableResponse.ok) {
      throw new Error(`Failed to load timetable CSV: ${timetableResponse.statusText}`);
    }
    const timetableText = await timetableResponse.text();
    console.log('✅ Timetable CSV loaded, size:', timetableText.length, 'bytes');
    
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
    
    const curriculum = parseCreditRequirements(requirementRows);
    const courses = parseCourses(timetableRows);
    
    // 学科情報を取得
    const dept = AVAILABLE_DEPARTMENTS.find(d => d.id === departmentId);
    const departmentName = dept ? `${dept.faculty} ${dept.name}` : departmentId;
    
    console.log('✅ Auto-load complete:', { departmentName, curriculum, coursesCount: courses.length });
    
    return {
      curriculum,
      courses,
      departmentName
    };
  } catch (error) {
    console.error('❌ Auto-load failed for department:', departmentId, error);
    throw error;
  }
}
