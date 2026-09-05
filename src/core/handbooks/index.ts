import type { AcademicAllYearsData } from '../types';

export type HandbookTopic = 'graduation' | 'progression' | 'registration' | 'curriculum' | 'hirameki' | 'teacher' | 'tap';
export type HandbookKind = 'handbook' | 'hirameki';

export interface HandbookSource {
  id: string;
  kind: HandbookKind;
  year: number;
  entranceYears?: number[];
  faculty: string;
  label: string;
  url: string;
  indexUrl: string;
  localPath: string;
  dataPath: string;
  sha256: string;
  pageCount: number;
  courseCount: number;
  tableCount: number;
  pagesWithoutText: number[];
  reviewIssueCount: number;
  topicPages: Partial<Record<HandbookTopic, number[]>>;
}

export interface HandbookCatalog {
  schemaVersion: number;
  retrievedAt: string;
  documents: HandbookSource[];
}

export interface HandbookCourse {
  id: string;
  title: string;
  credits: number;
  rawRequired: string;
  courseType: 'required' | 'elective-required' | 'elective' | 'unknown';
  category: string;
  group: string;
  sourceCode: string;
  sourceId: string;
  page: number;
  table: number;
  row: number;
  status: 'extracted_reference';
  rawCells: Array<string | null>;
  verification?: {
    status: 'pdf_position_checked' | 'quarantined';
    scope?: string;
    titleText?: string;
    sourceSha256?: string;
    reason?: string;
  };
}

export interface HandbookPage {
  page: number;
  text: string;
  topics: HandbookTopic[];
  hasText: boolean;
  tables: Array<{ index: number; rows: Array<Array<string | null>>; bbox: number[] }>;
}

export interface HandbookDocument extends HandbookSource {
  pages: HandbookPage[];
  courses: HandbookCourse[];
  issues: Array<{ page: number; title: string; reason: string }>;
}

export interface HiramekiProgram {
  id: string;
  entranceYears: number[];
  facultyIds: string[];
  departmentIds?: string[];
  title: string;
  sourceId: string;
  sourcePage: number;
  totalCredits: number;
  groups: Array<{ name: string; credits: number; note?: string }>;
  courses: Array<{ title: string; credits: number }>;
  notes: string[];
  assessment: 'course_list' | 'department_conditions';
}

export function normalizeHandbookText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

export function isCheckedCourseForDepartment(course: HandbookCourse, source: HandbookSource, departmentName: string): boolean {
  const evidence = course.verification;
  if (evidence?.status !== 'pdf_position_checked' || evidence.sourceSha256 !== source.sha256) return false;
  const department = departmentName.replace(/（.*?）/g, '');
  return evidence.scope === department || evidence.scope === source.faculty || evidence.scope === '共通分野'
    || (department === '人間科学科' && source.year === 2022 && evidence.scope === '児童学科');
}

export function selectHandbookSources(
  documents: HandbookSource[],
  profile: { entranceYear: number; faculty: string; departmentName: string },
): HandbookSource[] {
  const department = profile.departmentName.replace(/（.*?）/g, '');
  return documents.filter((source) => source.kind === 'handbook' && source.year === profile.entranceYear
    && source.faculty === profile.faculty
    && [profile.faculty, department, '共通分野', '教職課程'].includes(source.label))
    .sort((left, right) => {
      const order = [department, '共通分野', profile.faculty, '教職課程'];
      return order.indexOf(left.label) - order.indexOf(right.label);
    });
}

export function selectHiramekiPrograms(
  programs: HiramekiProgram[], profile: { entranceYear: number; facultyId: string; departmentId: string },
): HiramekiProgram[] {
  return programs.filter((program) => program.entranceYears.includes(profile.entranceYear)
    && program.facultyIds.includes(profile.facultyId)
    && (!program.departmentIds || program.departmentIds.includes(profile.departmentId)));
}

export function searchHandbookPages(documents: HandbookDocument[], query: string, topic?: HandbookTopic) {
  const terms = query.split(/\s+/).map(normalizeHandbookText).filter(Boolean);
  return documents.flatMap((document) => document.pages
    .filter((page) => (!topic || page.topics.includes(topic))
      && terms.every((term) => normalizeHandbookText(page.text).includes(term)))
    .map((page) => ({ document, page })));
}

/** Exact title AND credit agreement; repeated quarter entries count only once. */
export function matchProgramCourses(program: HiramekiProgram, allYearsData: AcademicAllYearsData) {
  const cells = Object.values(allYearsData).flatMap((year) => Object.values(year.timetable)
    .flatMap((quarter) => Object.values(quarter).flatMap((day) => Object.values(day))))
    .filter((cell) => cell !== null);
  return program.courses.map((course) => {
    const matches = cells.filter((cell) => normalizeHandbookText(cell.title) === normalizeHandbookText(course.title));
    const passed = matches.some((cell) => ['秀', '優', '良', '可'].includes(cell.grade ?? '') && cell.credits === course.credits);
    return { ...course, status: passed ? 'passed' as const : matches.length ? 'check' as const : 'missing' as const };
  });
}
