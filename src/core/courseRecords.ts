import type {
  AcademicAllYearsData,
  AcademicCourse,
  AcademicCourseCell,
  AcademicQuarter,
  AcademicYear,
  CourseType,
  Grade,
} from '../utils/academicProgress';
import { normalizeCourseTitle } from '../utils/csvImporter';

export type AcademicCourseRecordStatus = 'passed' | 'planned' | 'failed';

export interface AcademicCourseRecord {
  recordKey: string;
  courseId?: string;
  title: string;
  credits: number;
  status: AcademicCourseRecordStatus;
  grade?: Grade;
  courseType?: CourseType;
  year: AcademicYear;
  quarter: AcademicQuarter;
  day: string;
  periodId: string;
  course?: AcademicCourse;
  cell: AcademicCourseCell;
}

export interface AcademicCourseRecordLookup {
  byId: ReadonlyMap<string, AcademicCourseRecord>;
  byTitle: ReadonlyMap<string, AcademicCourseRecord>;
}

const YEARS: AcademicYear[] = ['1年次', '2年次', '3年次', '4年次', 'M1', 'M2'];
const QUARTERS: AcademicQuarter[] = ['1Q', '2Q', '3Q', '4Q'];

const STATUS_PRIORITY: Record<AcademicCourseRecordStatus, number> = {
  failed: 0,
  planned: 1,
  passed: 2,
};

function normalizeIdentifier(value: string | undefined) {
  return (value ?? '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
}

export function normalizeCourseRecordTitle(value: string | undefined) {
  return value ? normalizeCourseTitle(value).toLowerCase() : '';
}

function addToIndex(index: Map<string, AcademicCourse[]>, key: string, course: AcademicCourse) {
  if (!key) return;
  const current = index.get(key) ?? [];
  if (!current.some((candidate) => candidate.id === course.id)) {
    current.push(course);
    index.set(key, current);
  }
}

function buildCourseIndexes(courses: AcademicCourse[]) {
  const byId = new Map<string, AcademicCourse[]>();
  const byTitle = new Map<string, AcademicCourse[]>();

  for (const course of courses) {
    addToIndex(byId, normalizeIdentifier(course.id), course);

    for (const lectureCode of course.lectureCodes ?? []) {
      addToIndex(byId, normalizeIdentifier(lectureCode), course);
    }

    for (const offering of course.offerings ?? []) {
      addToIndex(byId, normalizeIdentifier(offering.courseId), course);
      addToIndex(byId, normalizeIdentifier(offering.lectureCode), course);
    }

    addToIndex(byTitle, normalizeCourseRecordTitle(course.title), course);
    for (const alias of course.aliases ?? []) {
      addToIndex(byTitle, normalizeCourseRecordTitle(alias), course);
    }
  }

  return { byId, byTitle };
}

function selectCourseCandidate(candidates: AcademicCourse[] | undefined, title: string) {
  if (!candidates?.length) return undefined;
  if (candidates.length === 1) return candidates[0];

  const normalizedTitle = normalizeCourseRecordTitle(title);
  return (
    candidates.find((course) => normalizeCourseRecordTitle(course.title) === normalizedTitle) ??
    candidates.find((course) => (course.aliases ?? []).some((alias) => normalizeCourseRecordTitle(alias) === normalizedTitle)) ??
    candidates[0]
  );
}

function resolveCourse(
  indexes: ReturnType<typeof buildCourseIndexes>,
  cell: AcademicCourseCell,
) {
  const identifiers = [
    cell.courseId,
    cell.lectureCode,
    cell.sourceOffering?.courseId,
    cell.sourceOffering?.lectureCode,
  ];

  for (const identifier of identifiers) {
    const candidate = selectCourseCandidate(indexes.byId.get(normalizeIdentifier(identifier)), cell.title);
    if (candidate) return candidate;
  }

  return selectCourseCandidate(indexes.byTitle.get(normalizeCourseRecordTitle(cell.title)), cell.title);
}

function getRecordStatus(grade?: Grade): AcademicCourseRecordStatus {
  if (grade === '不可') return 'failed';
  if (!grade || grade === '未履修') return 'planned';
  return 'passed';
}

function buildRecordKey(course: AcademicCourse | undefined, cell: AcademicCourseCell) {
  const resolvedId = normalizeIdentifier(course?.id || cell.courseId || cell.lectureCode);
  if (resolvedId) return `id:${resolvedId}`;
  return `title:${normalizeCourseRecordTitle(cell.title)}:${cell.credits ?? course?.credits ?? 0}`;
}

function shouldReplaceRecord(current: AcademicCourseRecord, next: AcademicCourseRecord) {
  const statusDifference = STATUS_PRIORITY[next.status] - STATUS_PRIORITY[current.status];
  if (statusDifference !== 0) return statusDifference > 0;

  const yearDifference = YEARS.indexOf(next.year) - YEARS.indexOf(current.year);
  if (yearDifference !== 0) return yearDifference > 0;

  return QUARTERS.indexOf(next.quarter) >= QUARTERS.indexOf(current.quarter);
}

export function collectAcademicCourseRecords(
  allYearsData: AcademicAllYearsData,
  courses: AcademicCourse[],
) {
  const indexes = buildCourseIndexes(courses);
  const records = new Map<string, AcademicCourseRecord>();

  for (const year of YEARS) {
    const yearData = allYearsData[year];
    if (!yearData) continue;

    for (const quarter of QUARTERS) {
      const quarterData = yearData.timetable[quarter];
      if (!quarterData) continue;

      for (const [day, dayData] of Object.entries(quarterData)) {
        for (const [periodId, cell] of Object.entries(dayData ?? {})) {
          if (!cell?.title) continue;

          const course = resolveCourse(indexes, cell);
          const credits = Number(cell.credits ?? course?.credits ?? 0);
          const record: AcademicCourseRecord = {
            recordKey: buildRecordKey(course, cell),
            courseId: course?.id ?? cell.courseId ?? cell.lectureCode,
            title: cell.title.trim(),
            credits: Number.isFinite(credits) ? credits : 0,
            status: getRecordStatus(cell.grade),
            grade: cell.grade,
            courseType: cell.courseType ?? course?.courseType,
            year,
            quarter,
            day,
            periodId,
            course,
            cell,
          };

          const current = records.get(record.recordKey);
          if (!current || shouldReplaceRecord(current, record)) {
            records.set(record.recordKey, record);
          }
        }
      }
    }
  }

  return [...records.values()].sort((left, right) => {
    const yearDifference = YEARS.indexOf(left.year) - YEARS.indexOf(right.year);
    if (yearDifference !== 0) return yearDifference;

    const quarterDifference = QUARTERS.indexOf(left.quarter) - QUARTERS.indexOf(right.quarter);
    if (quarterDifference !== 0) return quarterDifference;

    return left.title.localeCompare(right.title, 'ja');
  });
}

export function createAcademicCourseRecordLookup(records: AcademicCourseRecord[]): AcademicCourseRecordLookup {
  const byId = new Map<string, AcademicCourseRecord>();
  const byTitle = new Map<string, AcademicCourseRecord>();

  for (const record of records) {
    const identifiers = [
      record.courseId,
      record.course?.id,
      record.cell.courseId,
      record.cell.lectureCode,
      ...(record.course?.lectureCodes ?? []),
    ];

    for (const identifier of identifiers) {
      const key = normalizeIdentifier(identifier);
      if (key && !byId.has(key)) byId.set(key, record);
    }

    const titles = [record.title, record.course?.title, ...(record.course?.aliases ?? [])];
    for (const title of titles) {
      const key = normalizeCourseRecordTitle(title);
      if (key && !byTitle.has(key)) byTitle.set(key, record);
    }
  }

  return { byId, byTitle };
}

export function findAcademicCourseRecord(
  lookup: AcademicCourseRecordLookup,
  input: { courseId?: string; title?: string; aliases?: string[] },
) {
  const identifiers = [input.courseId];
  for (const identifier of identifiers) {
    const key = normalizeIdentifier(identifier);
    const record = key ? lookup.byId.get(key) : undefined;
    if (record) return record;
  }

  const titles = [input.title, ...(input.aliases ?? [])];
  for (const title of titles) {
    const key = normalizeCourseRecordTitle(title);
    const record = key ? lookup.byTitle.get(key) : undefined;
    if (record) return record;
  }

  return undefined;
}

export function summarizeAcademicCourseRecords(records: AcademicCourseRecord[]) {
  return records.reduce(
    (summary, record) => {
      if (record.credits <= 0 || record.courseType === 'unknown') return summary;
      summary[record.status] += record.credits;
      return summary;
    },
    { passed: 0, planned: 0, failed: 0 },
  );
}

export function academicYearToNumber(year: AcademicYear) {
  const index = YEARS.indexOf(year);
  return index >= 0 ? index + 1 : undefined;
}
