import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
const result = await build({ stdin: { contents: "export * from './src/utils/officialOffering'; export * from './src/utils/guideProgress'; export * from './src/api/requirements';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { officialCandidates, guideCourses, guideMinimum, generateRequirementCategoryDetail } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const course = { id: '2026:a', year: 2026, title: '数学(1)', titleVariants: [], lectureCode: 'a', status: 'source_extracted', meetings: [{ campus: 'setagaya', term: '前期前', day: '月', period: '1', teachers: ['先生A'], rooms: ['11A'], remarks: [] }], audiences: [{ departmentIds: ['denki'], departmentLabel: '電気', campus: 'setagaya', gradeYear: '1', className: 'A', target: '2026入学' }] };
const find = (value, ...args) => officialCandidates({ year: 2026, classes: [value] }, '数学（1）', 'denki', 'setagaya', ...args);
assert.equal(find(course, '月', 1, '1Q')[0].teacher, '先生A');
assert.equal(find(course, '月', 1, '1Q')[0].room, '11A');
assert.equal(find(course, '月', 1, '1Q')[0].academicYear, 2026);
for (const args of [['火', 1, '1Q'], ['月', 2, '1Q'], ['月', 1, '2Q']]) assert.equal(find(course, ...args).length, 0);
assert.equal(find({ ...course, status: 'source_review_required' }, '月', 1, '1Q').length, 0);
assert.equal(find({ ...course, year: 2025 }, '月', 1, '1Q').length, 0);
const document = JSON.parse(readFileSync('public/handbooks/extracted/handbook-2022-c69d8eb9e3c5e80a892f84365ac3d10d.json', 'utf8'));
const first = document.courses[0];
const cell = { title: first.verification.titleText, courseId: `reference-kikai-${first.id}`, credits: first.credits, grade: '可' };
const data = { '1年次': { timetable: { '1Q': { '月': { '1': cell, '2': cell } }, '2Q': { '月': { '1': cell } } } } };
const matched = guideCourses([document], '機械工学科', data).filter(row => row.status === '修得済み');
assert.equal(matched.length, 1);
assert.equal(matched[0].course.credits, 1);
assert.equal(guideMinimum([document], '理工学基礎科目').credits, 30);
assert.equal(guideMinimum([document], '存在しない区分'), undefined);
cell.grade = '不可';
assert.equal(guideCourses([document], '機械工学科', data).filter(row => row.status === '修得済み').length, 0);
cell.grade = '未履修';
assert.equal(guideCourses([document], '機械工学科', data).filter(row => row.status === '履修予定').length, 1);
cell.credits = 99;
assert.equal(guideCourses([document], '機械工学科', data).filter(row => row.status === '単位数要確認').length, 1);
const curriculum = { details: [{ area: 'A', subarea: 'B', totalRequiredCredits: 6 }] };
const applicable = ['passed', 'planned', 'failed', 'absent'].map(courseId => ({ courseId, title: courseId, credits: 2, area: 'A', subarea: 'B' }));
const registered = { '2年次': { timetable: { '3Q': { '月': {
  '1': { courseId: 'passed', credits: 2, grade: '不可' },
  '2': { courseId: 'passed', credits: 2, grade: '可' },
  '3': { courseId: 'planned', credits: 2, grade: '未履修' },
  '4': { courseId: 'failed', credits: 2, grade: '不可' },
} } } } };
const detail = generateRequirementCategoryDetail('A:B', curriculum, applicable.map(row => ({ id: row.courseId })), registered, [...applicable, applicable[0]]);
assert.equal(detail.earnedCredits, 2);
assert.equal(detail.plannedCredits, 2);
assert.equal(detail.remainingCredits, 4);
assert.deepEqual(detail.courses.map(row => row.takenStatus), ['passed', 'planned', 'failed', 'not_taken']);
assert.equal(generateRequirementCategoryDetail('A:C', curriculum, [], registered, applicable).earnedCredits, 0);
const staleDocument = structuredClone(document);
staleDocument.sha256 = 'changed-source';
assert(guideCourses([staleDocument], '機械工学科', {}).every(row => row.category === '区分未確認'));
console.log('PASS: offering boundaries; PDF provenance; actual timetable grades, retakes, absent courses and duplicate-credit prevention.');
