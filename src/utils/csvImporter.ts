import Papa from 'papaparse';
import type { AcademicCourse, CourseOffering, CourseType } from './academicProgress';

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
  [key: string]: string | undefined;
}

export interface ParsedClassScheduleRow {
  id: string;
  title: string;
  credits: number;
  rawRequired: string;
  category: string;
  group: string;
  courseType: CourseType;
  offering: CourseOffering;
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

function normalizeText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '').replace(/[()（）]/g, '');
}

function readFirstValue(row: ClassScheduleRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function parseScheduleCourseType(rawRequired: string, explicitType: string) {
  if (explicitType === 'required' || explicitType === 'elective-required' || explicitType === 'elective') {
    return explicitType;
  }

  if (rawRequired.includes('○')) return 'required';
  if (rawRequired.includes('△1') || rawRequired.includes('△2')) return 'elective-required';
  return 'elective';
}

function buildScheduleOffering(row: ClassScheduleRow): CourseOffering {
  const lectureCode = readFirstValue(row, ['lectureCode', '講義コード', 'code', 'id']);

  return {
    day: readFirstValue(row, ['day', '曜']),
    period: readFirstValue(row, ['period', '限']),
    term: readFirstValue(row, ['term', '学期']),
    year: readFirstValue(row, ['year', 'gradeYear', '年']),
    className: readFirstValue(row, ['className', 'クラス']),
    teacher: readFirstValue(row, ['teacher', '担当者']),
    lectureCode,
    room: readFirstValue(row, ['room', '教室']),
    target: readFirstValue(row, ['target', '受講対象', '再履修者科目名']),
    remarks: readFirstValue(row, ['remarks', '備考']),
  };
}

export function parseClassScheduleRows(rows: ClassScheduleRow[]): ParsedClassScheduleRow[] {
  return rows
    .map((row) => {
      const title = readFirstValue(row, ['title', '科目名']);
      if (!title) {
        return null;
      }

      const rawRequired = readFirstValue(row, ['raw_required', 'rawRequired', 'raw required', 'raw']);
      const explicitType = readFirstValue(row, ['courseType', '科目区分']);
      const id = readFirstValue(row, ['id', 'lectureCode', '講義コード']) || title;

      return {
        id,
        title,
        credits: parseFloat(readFirstValue(row, ['credits', '単位数'])) || 0,
        rawRequired,
        category: readFirstValue(row, ['category', '区分']),
        group: readFirstValue(row, ['group', '科目群']),
        courseType: parseScheduleCourseType(rawRequired, explicitType),
        offering: buildScheduleOffering(row),
      } satisfies ParsedClassScheduleRow;
    })
    .filter((row): row is ParsedClassScheduleRow => row !== null);
}

export function mergeCoursesWithSchedule(courses: AcademicCourse[], scheduleRows: ClassScheduleRow[]) {
  const mergedCourses = courses.map((course) => ({
    ...course,
    sourceKind: course.sourceKind ?? 'curriculum',
    offerings: [...(course.offerings ?? [])],
  }));
  const parsedRows = parseClassScheduleRows(scheduleRows);

  const byId = new Map<string, AcademicCourse>();
  const byTitle = new Map<string, AcademicCourse>();

  for (const course of mergedCourses) {
    byId.set(normalizeText(course.id), course);
    byTitle.set(normalizeText(course.title), course);
  }

  for (const row of parsedRows) {
    const matchedCourse = byId.get(normalizeText(row.id)) ?? byTitle.get(normalizeText(row.title));

    if (matchedCourse) {
      const duplicate = matchedCourse.offerings?.some((offering) => {
        return [offering.day, offering.period, offering.term, offering.year, offering.className, offering.teacher, offering.lectureCode, offering.room]
          .join('|') === [
            row.offering.day,
            row.offering.period,
            row.offering.term,
            row.offering.year,
            row.offering.className,
            row.offering.teacher,
            row.offering.lectureCode,
            row.offering.room,
          ].join('|');
      });

      if (!duplicate) {
        matchedCourse.offerings = [...(matchedCourse.offerings ?? []), row.offering];
      }

      if (!matchedCourse.rawRequired && row.rawRequired) {
        matchedCourse.rawRequired = row.rawRequired;
      }

      if (!matchedCourse.category && row.category) {
        matchedCourse.category = row.category;
      }

      if (!matchedCourse.group && row.group) {
        matchedCourse.group = row.group;
      }

      if (!matchedCourse.courseType && row.courseType) {
        matchedCourse.courseType = row.courseType;
      }

      continue;
    }

    mergedCourses.push({
      id: row.id,
      title: row.title,
      credits: row.credits,
      category: row.category,
      group: row.group,
      courseType: row.courseType,
      rawRequired: row.rawRequired,
      tags: parseTags(row.rawRequired),
      requirementSubtype: parseRequirementSubtype(row.rawRequired),
      sourceKind: 'schedule',
      offerings: [row.offering],
    });
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
