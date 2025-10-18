import { parseCSVFile, parseCreditRequirements, parseCourses } from './csvImporter';
import type { CreditRequirementRow, CourseRow } from './csvImporter';

/**
 * publicフォルダ内のCSVファイルを自動読み込み
 */
export async function autoLoadDepartmentCSVs(departmentPath: string) {
  console.log('🚀 Auto-loading CSVs from:', departmentPath);
  
  try {
    // 卒業要件CSVを読み込み
    const requirementsResponse = await fetch(`${departmentPath}_credit_requirements.csv`);
    if (!requirementsResponse.ok) {
      throw new Error(`Failed to load requirements CSV: ${requirementsResponse.statusText}`);
    }
    const requirementsText = await requirementsResponse.text();
    console.log('📄 Requirements CSV loaded, size:', requirementsText.length, 'bytes');
    
    // 時間割CSVを読み込み
    const timetableResponse = await fetch(`${departmentPath}_timetable_by_category.csv`);
    if (!timetableResponse.ok) {
      throw new Error(`Failed to load timetable CSV: ${timetableResponse.statusText}`);
    }
    const timetableText = await timetableResponse.text();
    console.log('📄 Timetable CSV loaded, size:', timetableText.length, 'bytes');
    
    // テキストをBlobに変換してFileオブジェクトを作成
    const requirementsBlob = new Blob([requirementsText], { type: 'text/csv' });
    const requirementsFile = new File([requirementsBlob], 'requirements.csv', { type: 'text/csv' });
    
    const timetableBlob = new Blob([timetableText], { type: 'text/csv' });
    const timetableFile = new File([timetableBlob], 'timetable.csv', { type: 'text/csv' });
    
    // パース
    const requirementRows = await parseCSVFile<CreditRequirementRow>(requirementsFile);
    console.log('✅ Parsed requirement rows:', requirementRows.length);
    
    const timetableRows = await parseCSVFile<CourseRow>(timetableFile);
    console.log('✅ Parsed timetable rows:', timetableRows.length);
    
    const curriculum = parseCreditRequirements(requirementRows);
    const courses = parseCourses(timetableRows);
    
    console.log('✅ Auto-load complete:', { curriculum, coursesCount: courses.length });
    
    return {
      curriculum,
      courses,
      departmentName: departmentPath.split('/').pop() || '学科'
    };
  } catch (error) {
    console.error('❌ Auto-load failed:', error);
    throw error;
  }
}

/**
 * 利用可能な学科リストを取得
 */
export const AVAILABLE_DEPARTMENTS = [
  { path: '/department/rikou/denki', name: '電気電子通信工学科' }
  // 他の学科を追加可能
] as const;
