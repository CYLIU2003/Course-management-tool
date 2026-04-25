import type { AcademicAllYearsData, AcademicCourse, AcademicCourseCell, AcademicCurriculum, AcademicQuarter, AcademicYear, Grade } from './academicProgress';
import { normalizeCourseTitle } from './csvImporter';

export type GraduationCategory = 'required' | 'required_elective' | 'specialized' | 'liberal_arts' | 'free' | 'total';

export type GraduationRequirementStatus = {
  category: GraduationCategory;
  label: string;
  requiredCredits: number;
  earnedCredits: number;
  plannedCredits: number;
  missingCredits: number;
  isSatisfied: boolean;
};

export type PlannedCourse = {
  courseId: string;
  courseName: string;
  credits: number;
  category: GraduationCategory;
  dayOfWeek: string;
  period: number;
  quarter?: AcademicQuarter;
  year?: number;
};

export type GraduationRequirementsResult = {
  statuses: GraduationRequirementStatus[];
  plannedCourses: PlannedCourse[];
  earnedCredits: number;
  plannedCredits: number;
};

export type GraduationRequirementsInput = {
  allYearsData: AcademicAllYearsData;
  courses: AcademicCourse[];
  curriculum?: AcademicCurriculum;
};

type CourseStatus = 'earned' | 'planned' | 'failed';

type CourseRecord = {
  key: string;
  title: string;
  credits: number;
  status: CourseStatus;
  grade?: Grade;
  categories: GraduationCategory[];
  dayOfWeek: string;
  period: number;
  quarter: AcademicQuarter;
  year: AcademicYear;
  course?: AcademicCourse;
};

const CATEGORY_ORDER: GraduationCategory[] = ['required', 'required_elective', 'specialized', 'liberal_arts', 'free', 'total'];

const CATEGORY_LABELS: Record<GraduationCategory, string> = {
  required: '必修科目',
  required_elective: '選択必修科目',
  specialized: '専門科目',
  liberal_arts: '教養科目',
  free: '自由科目',
  total: '合計単位',
};

const STATUS_PRIORITY: Record<CourseStatus, number> = {
  failed: 0,
  planned: 1,
  earned: 2,
};

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function yearToNumber(year: AcademicYear) {
  switch (year) {
    case '1年次':
      return 1;
    case '2年次':
      return 2;
    case '3年次':
      return 3;
    case '4年次':
      return 4;
    case 'M1':
      return 5;
    case 'M2':
      return 6;
    default:
      return undefined;
  }
}

function isSpecializedAreaText(text: string) {
  return text.includes('専門') || text.includes('理工学基礎');
}

function isLiberalArtsAreaText(text: string) {
  return text.includes('教養') || text.includes('外国語') || text.includes('体育');
}

function isFreeAreaText(text: string) {
  return text.includes('自由');
}

function findMatchingCourse(courses: AcademicCourse[], title: string) {
  const normalized = normalizeCourseTitle(title);
  return courses.find((course) => normalizeCourseTitle(course.title) === normalized);
}

function getCourseStatus(grade?: Grade): CourseStatus {
  if (!grade || grade === '未履修') {
    return 'planned';
  }

  if (grade === '不可') {
    return 'failed';
  }

  return 'earned';
}

function getPrimaryCategory(categories: GraduationCategory[]) {
  for (const category of CATEGORY_ORDER) {
    if (category !== 'total' && categories.includes(category)) {
      return category;
    }
  }

  return 'free' as GraduationCategory;
}

function resolveCategories(course?: AcademicCourse, cell?: AcademicCourseCell) {
  const categories = new Set<GraduationCategory>(['total']);
  const courseType = cell?.courseType ?? course?.courseType;
  const sourceText = normalizeSearchText([
    course?.category,
    course?.group,
    course?.rawRequired,
    course?.title,
    cell?.title,
    cell?.className,
    cell?.memo,
    cell?.remarks,
    cell?.target,
    cell?.term,
  ].filter(Boolean).join(' '));

  if (courseType === 'required') {
    categories.add('required');
  }

  if (courseType === 'elective-required') {
    categories.add('required_elective');
  }

  if (isSpecializedAreaText(sourceText)) {
    categories.add('specialized');
  }

  if (isLiberalArtsAreaText(sourceText)) {
    categories.add('liberal_arts');
  }

  if (isFreeAreaText(sourceText) || (courseType === 'elective' && !categories.has('specialized') && !categories.has('liberal_arts'))) {
    categories.add('free');
  }

  return [...categories];
}

function buildRequirementTargets(curriculum?: AcademicCurriculum) {
  const targets: Record<GraduationCategory, number> = {
    required: 0,
    required_elective: 0,
    specialized: 0,
    liberal_arts: 0,
    free: 0,
    total: 0,
  };

  if (!curriculum) {
    return targets;
  }

  if (curriculum.details?.length) {
    for (const detail of curriculum.details) {
      const requiredCredits = Number(detail.requiredCredits) || 0;
      const requiredElectiveCredits = (Number(detail.electiveRequired1Credits) || 0) + (Number(detail.electiveRequired2Credits) || 0);
      const totalRequiredCredits = Number(detail.totalRequiredCredits) || 0;

      targets.required += requiredCredits;
      targets.required_elective += requiredElectiveCredits;
      targets.total += totalRequiredCredits;

      if (detail.area.includes('専門')) {
        targets.specialized += totalRequiredCredits;
      }

      if (detail.area.includes('共通')) {
        targets.liberal_arts += totalRequiredCredits;
      }

      if (detail.area.includes('自由')) {
        targets.free += totalRequiredCredits;
      }
    }

    if (targets.total === 0) {
      targets.total = curriculum.requiredCredits;
    }

    return targets;
  }

  targets.required = curriculum.breakdown.required;
  targets.required_elective = curriculum.breakdown.electiveRequired;
  targets.specialized = curriculum.breakdown.elective;
  targets.free = curriculum.breakdown.elective;
  targets.total = curriculum.requiredCredits;

  return targets;
}

function collectCourseRecords(allYearsData: AcademicAllYearsData, courses: AcademicCourse[]) {
  const records = new Map<string, CourseRecord>();

  for (const [year, yearData] of Object.entries(allYearsData) as Array<[AcademicYear, AcademicAllYearsData[AcademicYear]]>) {
    for (const [quarter, quarterData] of Object.entries(yearData.timetable) as Array<[AcademicQuarter, Record<string, Record<string, AcademicCourseCell | null>>]>) {
      for (const [dayOfWeek, dayData] of Object.entries(quarterData)) {
        for (const [periodKey, cell] of Object.entries(dayData)) {
          if (!cell || !cell.title) {
            continue;
          }

          const course = findMatchingCourse(courses, cell.title);
          const credits = cell.credits ?? course?.credits ?? 0;

          if (credits <= 0) {
            continue;
          }

          const key = `${normalizeCourseTitle(cell.title)}::${credits}`;
          const status = getCourseStatus(cell.grade);
          const categories = resolveCategories(course, cell);
          const current = records.get(key);
          const nextRecord: CourseRecord = {
            key,
            title: cell.title.trim(),
            credits,
            status,
            grade: cell.grade,
            categories,
            dayOfWeek,
            period: Number(periodKey) || 0,
            quarter,
            year,
            course,
          };

          if (!current) {
            records.set(key, nextRecord);
            continue;
          }

          const mergedCategories = [...new Set([...current.categories, ...categories])];
          const preferred = STATUS_PRIORITY[nextRecord.status] > STATUS_PRIORITY[current.status] ? nextRecord : current;
          records.set(key, {
            ...preferred,
            categories: mergedCategories,
          });
        }
      }
    }
  }

  return [...records.values()];
}

export function calculateGraduationRequirements({ allYearsData, courses, curriculum }: GraduationRequirementsInput): GraduationRequirementsResult {
  const targets = buildRequirementTargets(curriculum);
  const records = collectCourseRecords(allYearsData, courses);
  const totals = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, { earned: 0, planned: 0 }]),
  ) as Record<GraduationCategory, { earned: number; planned: number }>;

  let earnedCredits = 0;
  let plannedCredits = 0;

  for (const record of records) {
    if (record.status === 'earned') {
      earnedCredits += record.credits;
    } else if (record.status === 'planned') {
      plannedCredits += record.credits;
    }

    for (const category of record.categories) {
      if (record.status === 'earned') {
        totals[category].earned += record.credits;
      } else if (record.status === 'planned') {
        totals[category].planned += record.credits;
      }
    }
  }

  const statuses = CATEGORY_ORDER.map<GraduationRequirementStatus>((category) => {
    const requiredCredits = targets[category];
    const earned = totals[category].earned;
    const planned = totals[category].planned;
    const missingCredits = Math.max(0, requiredCredits - earned - planned);

    return {
      category,
      label: CATEGORY_LABELS[category],
      requiredCredits,
      earnedCredits: earned,
      plannedCredits: planned,
      missingCredits,
      isSatisfied: missingCredits <= 0,
    };
  });

  const plannedCourses = records
    .filter((record) => record.status === 'planned')
    .map<PlannedCourse>((record) => ({
      courseId: record.course?.id ?? record.key,
      courseName: record.title,
      credits: record.credits,
      category: getPrimaryCategory(record.categories),
      dayOfWeek: record.dayOfWeek,
      period: record.period,
      quarter: record.quarter,
      year: yearToNumber(record.year),
    }));

  return {
    statuses,
    plannedCourses,
    earnedCredits,
    plannedCredits,
  };
}