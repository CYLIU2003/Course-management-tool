import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { selectHandbookSources, selectHiramekiPrograms, matchProgramCourses, searchHandbookPages } from '../../src/core/handbooks';
import type { HandbookCatalog, HandbookDocument, HiramekiProgram } from '../../src/core/handbooks';
import type { AcademicAllYearsData } from '../../src/core/types';
import { AVAILABLE_DEPARTMENTS } from '../../src/core/departments';
import { loadDepartmentCurriculum } from '../../src/api/curriculum';
import { calculateGraduationRisk } from '../../src/utils/graduationRisk';
import { buildDashboardSnapshot } from '../../src/utils/academicProgress';

const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const catalog = readJson('public/handbooks/catalog.json') as HandbookCatalog;
const programs = readJson('public/handbooks/hirameki-programs.json').programs as HiramekiProgram[];

test('all 94 published department/cohort combinations resolve exact-year official documents', () => {
  let covered = 0;
  for (const department of AVAILABLE_DEPARTMENTS) for (const year of [2022, 2023, 2024, 2025, 2026]) {
    const sources = selectHandbookSources(catalog.documents, { entranceYear: year, faculty: department.faculty, departmentName: department.name });
    if (department.id === 'design_data' && year === 2022) { assert.equal(sources.length, 0); continue; }
    assert.ok(sources.length, `${department.id}/${year}`);
    assert.ok(sources.every((source) => source.year === year && source.faculty === department.faculty));
    covered++;
  }
  assert.equal(covered, 94);
});

test('hirameki eligibility follows cohort and faculty, including 2025 split and design exclusion', () => {
  const choose = (year: number, facultyId: string, departmentId: string) => selectHiramekiPrograms(programs, { entranceYear: year, facultyId, departmentId });
  assert.equal(choose(2022, 'rikou', 'denki')[0].totalCredits, 124);
  assert.equal(choose(2022, 'rikou', 'iyo').length, 0);
  assert.equal(choose(2023, 'rikou', 'shizen_shizen').length, 0);
  assert.equal(choose(2024, 'rikou', 'shizen_shizen')[0].totalCredits, 124);
  assert.equal(choose(2025, 'rikou', 'kikai')[0].assessment, 'department_conditions');
  assert.equal(choose(2025, 'joho', 'joho_kagaku')[0].courses.length, 12);
  assert.equal(choose(2026, 'rikou', 'kikai')[0].courses.length, 8);
  assert.equal(choose(2026, 'design_data', 'design_data').length, 0);
  assert.equal(choose(2027, 'rikou', 'kikai').length, 0);
});

test('basic-program progress requires exact credits, passing grade, and deduplicates quarters', () => {
  const program = programs.find((program) => program.entranceYears.includes(2026))!;
  const data = { '1年次': { timetable: {
    '1Q': { '月': { '1': { title: 'ことづくり', credits: 1, grade: '可' }, '2': { title: 'デザインリサーチ', credits: 1, grade: '秀' } } },
    '2Q': { '月': { '1': { title: 'ことづくり', credits: 1, grade: '可' }, '2': { title: 'サステナビリティ', credits: 2, grade: '不可' } } },
  } } } as AcademicAllYearsData;
  const matches = matchProgramCourses(program, data);
  assert.equal(matches.filter((course) => course.status === 'passed').length, 1);
  assert.equal(matches.find((course) => course.title === 'デザインリサーチ')?.status, 'check');
  assert.equal(matches.find((course) => course.title === 'サステナビリティ')?.status, 'check');
});

test('repaired 2023 source is searchable and links preserve its original PDF page', () => {
  const source = catalog.documents.find((source) => source.year === 2023 && source.label === '原子力安全工学科')!;
  const document = readJson(`public${source.dataPath}`) as HandbookDocument;
  assert.ok(searchHandbookPages([document], '卒業要件', 'graduation').length > 0);
  assert.ok(document.courses.length > 0);
  assert.equal(document.pages[2].page, 3);
  assert.ok(document.pages[2].text.includes('原子力安全工学科'));
});

test('missing graduation rules never produce a safe verdict', () => {
  const data = {} as AcademicAllYearsData;
  const snapshot = buildDashboardSnapshot(data, { requiredCredits: 124 });
  assert.equal(calculateGraduationRisk(snapshot, data, []).overallRiskLevel, 'unknown');
  const empty = { name: 'missing', requiredCredits: 0, breakdown: { required: 0, electiveRequired: 0, elective: 0 } };
  assert.equal(calculateGraduationRisk(snapshot, data, [], empty).overallRiskLevel, 'unknown');
  const unknown = buildDashboardSnapshot(data, { requiredCredits: 124, curriculum: empty });
  assert.ok(!unknown.warnings.some((warning) => warning.id === 'remaining-total-complete'));
});

test('student record counts passed unclassified credits once across quarters without certifying graduation', () => {
  const cell = { courseId: 'one-course', title: '同一科目', credits: 2, grade: '優', courseType: 'unknown' };
  const data = { '1年次': { timetable: { '1Q': { '月': { '1': cell } }, '2Q': { '火': { '2': cell } } } } } as AcademicAllYearsData;
  const snapshot = buildDashboardSnapshot(data, { requiredCredits: 124 });
  assert.equal(snapshot.recordedEarnedCredits, 2);
  assert.equal(snapshot.earnedCredits, 0);
  assert.equal(snapshot.gradedCredits, 2);
  assert.equal(snapshot.gpa.currentGpa, 3);
  assert.equal(calculateGraduationRisk(snapshot, data, []).overallRiskLevel, 'unknown');
});

test('failed or ungraded records never become earned credits', () => {
  const data = { '1年次': { timetable: { '1Q': { '月': {
    '1': { title: '未入力', credits: 2, courseType: 'unknown' },
    '2': { title: '不合格', credits: 2, grade: '不可', courseType: 'unknown' },
  } } } } } as AcademicAllYearsData;
  const snapshot = buildDashboardSnapshot(data, { requiredCredits: 124 });
  assert.equal(snapshot.recordedEarnedCredits, 0);
  assert.equal(snapshot.gpa.currentGpa, 0);
});

test('all 95 cohort datasets load only through SQLite API, with no CSV fallback', async () => {
  const previousFetch = globalThis.fetch;
  const datasets = readJson('data/import/curricula.json').datasets;
  const requests: string[] = [];
  globalThis.fetch = async (input) => {
    const path = String(input); requests.push(path);
    const match = datasets.find((data: { departmentId: string; entranceYear: number }) => path === `/api/curricula/${data.departmentId}/${data.entranceYear}`);
    assert.ok(match, `Unexpected non-database request: ${path}`);
    return new Response(JSON.stringify(match), { headers: { 'content-type': 'application/json' } });
  };
  try {
    for (const department of AVAILABLE_DEPARTMENTS) for (const year of [2022, 2023, 2024, 2025, 2026]) {
      const result = await loadDepartmentCurriculum(department.id, year);
      if (department.id === 'design_data' && year === 2022) assert.equal(result.status, 'unavailable');
      else assert.ok(result.courses.length > 0);
    }
    assert.equal(requests.length, 95);
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(loadDepartmentCurriculum('kikai', 2026));
    globalThis.fetch = async () => new Response('<html>wrong server</html>', { headers: { 'content-type': 'text/html' } });
    await assert.rejects(loadDepartmentCurriculum('kikai', 2026));
  } finally { globalThis.fetch = previousFetch; }
});
