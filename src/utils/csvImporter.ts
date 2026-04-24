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

export interface ClassScheduleRow {
  departmentId: string;
  sourceDepartment: string;
  day: string;
  period: string;
  term: string;
  gradeYear: string;
  className: string;
  title: string;
  teacher: string;
  lectureCode: string;
  room: string;
  target: string;
  remarks: string;
  requiredFlag: string;
  sourcePage: string;
}

function parseTags(rawRequired: string): string[] {
  const tags: string[] = [];
  if (rawRequired.includes('※DS')) tags.push('DS');
  if (rawRequired.includes('※MS')) tags.push('MS');
  if (rawRequired.includes('G')) tags.push('G');
  if (rawRequired.includes('*')) tags.push('STAR');
  if (rawRequired.includes('2026前期')) tags.push('2026前期');
  if (rawRequired.includes('時間割')) tags.push('時間割');
  return tags;
}

function parseRequirementSubtype(rawRequired: string) {
  if (rawRequired.includes('△1')) return 'triangle1' as const;
  if (rawRequired.includes('△2')) return 'triangle2' as const;
  return 'none' as const;
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
  if (import.meta.env.DEV) {
    console.log('🔄 parseCreditRequirements: Processing', rows.length, 'rows');
  }
  
  // 卒業要件の行のみをフィルタ
  const graduationRows = rows.filter(row => row.stage === '卒業');
  if (import.meta.env.DEV) {
    console.log('📋 Graduation rows found:', graduationRows.length);
  }
  
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
    
    if (import.meta.env.DEV) {
      console.log('  Row:', row.subarea, 'Required:', requiredCredits, 'Elective-Req:', electiveRequired1 + electiveRequired2, 'Free:', freeCredits);
    }
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
  
  if (import.meta.env.DEV) {
    console.log('✅ parseCreditRequirements: Result', result);
  }
  return result;
}

// 科目CSVから科目リストを取得
export function parseCourses(rows: CourseRow[]): AcademicCourse[] {
  if (import.meta.env.DEV) {
    console.log('🔄 parseCourses: Processing', rows.length, 'rows');
  }
  
  const courses = rows
    .filter(row => row.id && row.title) // 空行をフィルタ
    .map(row => {
      // courseTypeが正しい値か確認
      let courseType: 'required' | 'elective-required' | 'elective' = 'elective';
      if (row.courseType === 'required' || row.courseType === 'elective-required' || row.courseType === 'elective') {
        courseType = row.courseType;
      } else if (import.meta.env.DEV) {
        console.warn('⚠️ Invalid courseType:', row.courseType, 'for course:', row.title);
      }
      
      return {
        id: row.id,
        title: row.title,
        credits: parseFloat(row.credits) || 0,
        category: row.category || '',
        group: row.group || '',
        courseType: courseType,
        rawRequired: row.raw_required || '',
        tags: parseTags(row.raw_required || ''),
        requirementSubtype: parseRequirementSubtype(row.raw_required || '')
      };
    });
  
  if (import.meta.env.DEV) {
    console.log('✅ parseCourses: Processed', courses.length, 'courses');
  }
  return courses;
}

function buildScheduleRawRequired(row: ClassScheduleRow) {
  const details = [
    '2026前期時間割',
    row.term,
    row.day && row.period ? `${row.day}${row.period}限` : '',
    row.gradeYear ? `${row.gradeYear}年` : '',
    row.className ? `クラス${row.className}` : '',
    row.teacher ? `担当:${row.teacher}` : '',
    row.room ? `教室:${row.room}` : '',
    row.target,
    row.remarks,
    row.requiredFlag ? `必修印:${row.requiredFlag}` : '',
    row.sourcePage ? `PDF p.${row.sourcePage}` : '',
  ];
  return details.filter(Boolean).join(' / ');
}

// 2026年度前期時間割CSVから、フロントの科目検索へ流せる候補を生成
export function parseClassScheduleRows(rows: ClassScheduleRow[], departmentId: string): AcademicCourse[] {
  const scheduleRows = rows.filter((row) => {
    return row.departmentId === departmentId && row.lectureCode && row.title;
  });

  const seen = new Set<string>();
  const scheduleCourses = scheduleRows.flatMap((row) => {
    const key = `${row.departmentId}:${row.lectureCode}:${row.day}:${row.period}:${row.className}:${row.term}`;
    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      id: `schedule:${row.lectureCode}:${row.day}${row.period}:${row.className || 'all'}:${row.term || 'term'}`,
      title: row.title,
      credits: 0,
      category: '2026年度前期時間割',
      group: [row.term, row.day && row.period ? `${row.day}${row.period}限` : '', row.gradeYear ? `${row.gradeYear}年` : '', row.className].filter(Boolean).join(' / '),
      courseType: row.requiredFlag === '○' ? 'required' as const : 'elective' as const,
      rawRequired: buildScheduleRawRequired(row),
      tags: ['2026前期', '時間割', ...(row.requiredFlag === '○' ? ['必修印'] : [])],
      requirementSubtype: 'none' as const,
    }];
  });

  if (import.meta.env.DEV) {
    console.log('✅ parseClassScheduleRows:', { departmentId, rows: scheduleRows.length, courses: scheduleCourses.length });
  }

  return scheduleCourses;
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
