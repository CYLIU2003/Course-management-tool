import Papa from 'papaparse';
import type { AcademicCourse } from './academicProgress';

// CSV行の型定義
export interface CreditRequirementRow {
  stage: string;
  area: string;
  subarea: string;
  total_required_credits: string;
  必修_credits: string;
  選択必修1_credits: string;
  選択必修2_credits: string;
  自由_credits: string;
  notes: string;
}

export interface CourseRow {
  id: string;
  title: string;
  credits: string;
  raw_required: string;
  category: string;
  group: string;
  courseType: 'required' | 'elective-required' | 'elective';
}

// CSVファイルを読み込む
export function parseCSVFile<T>(file: File): Promise<T[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
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

  graduationRows.forEach(row => {
    const requiredCredits = parseFloat(row.必修_credits) || 0;
    const electiveRequired1 = parseFloat(row.選択必修1_credits) || 0;
    const electiveRequired2 = parseFloat(row.選択必修2_credits) || 0;
    const freeCredits = parseFloat(row.自由_credits) || 0;
    
    required += requiredCredits;
    electiveRequired += electiveRequired1 + electiveRequired2;
    elective += freeCredits;
    
    console.log('  Row:', row.subarea, 'Required:', requiredCredits, 'Elective-Req:', electiveRequired1 + electiveRequired2, 'Free:', freeCredits);
  });

  // 総単位数を計算
  total = required + electiveRequired + elective;

  const result = {
    requiredCredits: total,
    breakdown: {
      required,
      electiveRequired,
      elective
    }
  };
  
  console.log('✅ parseCreditRequirements: Result', result);
  return result;
}

// 科目CSVから科目リストを取得
export function parseCourses(rows: CourseRow[]): AcademicCourse[] {
  console.log('🔄 parseCourses: Processing', rows.length, 'rows');
  
  const courses = rows
    .filter(row => row.id && row.title) // 空行をフィルタ
    .map(row => {
      // courseTypeが正しい値か確認
      let courseType: 'required' | 'elective-required' | 'elective' = 'elective';
      if (row.courseType === 'required' || row.courseType === 'elective-required' || row.courseType === 'elective') {
        courseType = row.courseType;
      } else {
        console.warn('⚠️ Invalid courseType:', row.courseType, 'for course:', row.title);
      }
      
      return {
        id: row.id,
        title: row.title,
        credits: parseFloat(row.credits) || 0,
        category: row.category || '',
        group: row.group || '',
        courseType: courseType
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
