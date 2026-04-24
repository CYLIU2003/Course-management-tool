import Papa from 'papaparse';
import type { AcademicCourse, CourseOffering } from './academicProgress';

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

function parseScheduleCourseType(requiredFlag: string) {
  return requiredFlag === '○' ? 'required' : 'elective';
}

export function parseClassScheduleRows(rows: ClassScheduleRow[], departmentId: string): AcademicCourse[] {
  const filtered = rows.filter((row) => row.departmentId === departmentId && row.title && row.lectureCode);
  const seen = new Set<string>();

  return filtered.flatMap((row) => {
    const key = [row.departmentId, row.lectureCode, row.day, row.period, row.term, row.className].join(':');
    if (seen.has(key)) {
      return [];
    }
    seen.add(key);

    const offering: CourseOffering = {
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
      sourcePage: Number(row.sourcePage) || undefined,
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
      offerings: [offering],
    } satisfies AcademicCourse];
  });
}

export function mergeCoursesWithSchedule(courses: AcademicCourse[], scheduleCourses: AcademicCourse[]) {
  const mergedCourses: AcademicCourse[] = courses.map((course) => ({
    ...course,
    sourceKind: course.sourceKind ?? 'curriculum',
    offerings: [...(course.offerings ?? [])],
  }));

  for (const schedule of scheduleCourses) {
    const normalizedTitle = normalizeCourseTitle(schedule.title);
    const matchedCourse = mergedCourses.find((course) => normalizeCourseTitle(course.title) === normalizedTitle);

    if (matchedCourse) {
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

      continue;
    }

    mergedCourses.push(schedule);
  }

  return mergedCourses;
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
        courseType: courseType,
        rawRequired: row.raw_required || '',
        tags: parseTags(row.raw_required || ''),
        requirementSubtype: parseRequirementSubtype(row.raw_required || ''),
        sourceKind: 'curriculum' as const,
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
