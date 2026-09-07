import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const filename = 'node_modules/.tmp/degree-guide-test.cjs';
mkdirSync('node_modules/.tmp', { recursive: true });
await build({ stdin: { contents: `
  import { createElement } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import GuideProgress from './src/components/handbooks/GuideProgress';
  import GraduateGuide from './src/components/handbooks/GraduateGuide';
  export { graduateCourseProgress } from './src/utils/graduateProgress';
  export function renderGraduate(props) { return renderToStaticMarkup(createElement(GraduateGuide, props)); }
  export { selectHandbookSources } from './src/core/handbooks';
  export { AVAILABLE_DEPARTMENTS } from './src/core/departments';
  export { degreeSurplus, degreeGroupProgress, degreeProgramProgress, degreeCourseApplies } from './src/utils/guideProgress';
  export function renderGuide(props) { return renderToStaticMarkup(createElement(GuideProgress, props)); }
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: filename, platform: 'node', format: 'cjs', jsx: 'automatic' });
try {
  const { renderGuide, renderGraduate, graduateCourseProgress, selectHandbookSources, AVAILABLE_DEPARTMENTS, degreeSurplus, degreeGroupProgress, degreeProgramProgress, degreeCourseApplies } = createRequire(import.meta.url)('../' + filename);
  const catalog = JSON.parse(readFileSync('public/handbooks/catalog.json', 'utf8'));
  const rules = JSON.parse(readFileSync('data/verified/undergraduate_degree_rules.json', 'utf8')).sets;
  for (const rule of rules) {
    const department = AVAILABLE_DEPARTMENTS.find(value => value.id === rule.departmentId);
    const documents = selectHandbookSources(catalog.documents, { entranceYear: rule.entranceYear, faculty: department.faculty, departmentName: department.name })
      .filter(source => source.label !== '教職課程')
      .map(source => JSON.parse(readFileSync('public' + source.dataPath, 'utf8')));
    const html = renderGuide({ documents, department: department.name, data: {}, requirementSets: [rule] });
    assert(!/区分未確認|必要単位：未確認|必要単位を確認/.test(html), rule.id);
    assert(!html.includes('必修・選択の条件は原本確認'), `${rule.id}: unresolved course requirement`);
    for (const category of rule.categories) assert(html.includes(category.name), `${rule.id}: ${category.name}`);
    assert(html.includes('自由選択'), rule.id);
  }
  const international = rules.filter(rule => rule.departmentId === 'chino_joho' && rule.entranceYear === 2026);
  assert.equal(international.length, 2);
  assert.equal(international[0].categories.find(category => category.name === '外国語科目').minimumCredits, 8);
  assert.equal(international[1].categories.find(category => category.name === '外国語科目').minimumCredits, 12);
  const allocation = { categories: [{ name: 'A', minimumCredits: 6 }, { name: 'B', minimumCredits: 4 }] };
  const credits = (category, value, status = '修得済み') => ({ category, course: { credits: value }, status });
  // Shortfalls in one category must not consume another category's surplus;
  // planned and excluded credits never contribute to the free-choice count.
  assert.equal(degreeSurplus([credits('A', 5), credits('B', 7), credits('B', 9, '履修予定'), credits('対象外', 20)], allocation), 3);
  assert.equal(degreeSurplus([credits('A', 6), credits('B', 4)], allocation), 0);
  const mandatory = { symbols: ['○'], minimumCredits: 4, membership: 'all_marked', courseCategories: ['専門科目'], courseGroup: null };
  const member = (id, amount, status, symbol = '○') => ({ course: { id, credits: amount }, leaf: '専門科目', symbol, group: '', status });
  const requiredProgress = degreeGroupProgress([member('A', 4, '修得済み'), member('B', 2, '未登録')], mandatory);
  assert.equal(requiredProgress.remaining, 0);
  assert.equal(requiredProgress.complete, false, 'Unpassed compulsory courses block completion even when the credit minimum is met');
  assert.equal(requiredProgress.missing.length, 1);
  const electiveGroup = { ...mandatory, symbols: ['△1'], membership: 'minimum', minimumCredits: 2 };
  const selected = degreeGroupProgress([member('A', 2, '修得済み', '△1'), member('B', 4, '修得済み', '△2'), member('C', 2, '履修予定', '△1')], electiveGroup);
  assert.equal(selected.earned, 2);
  assert.equal(selected.complete, true);
  const marked = (id, credits, marks, status = '修得済み', sha = 'original') => ({ course: { id, credits, requirementEvidence: { sourceSha256: sha, programMarks: marks.map(symbol => ({ symbol })) } }, document: { sha256: 'original' }, status });
  const program = degreeProgramProgress([marked('a', 2, ['DS', 'MS']), marked('b', 2, ['MS']), marked('c', 4, ['DS'], '履修予定'), marked('d', 8, ['DS'], '修得済み', 'stale')], ['DS', 'MS']);
  assert.equal(program.earned, 4, 'A course with two marks counts once; planned and stale evidence do not count');
  assert.equal(degreeCourseApplies({ requirementEvidence: { sourceSha256: 's', restrictions: '自然科学科以外対象' } }, '自然科学科（自然コース）', 's'), false);
  assert.equal(degreeCourseApplies({ requirementEvidence: { sourceSha256: 's', restrictions: '自然科学科対象' } }, '電気電子通信工学科', 's'), false);
  for (const rule of rules) assert.equal(new Set(rule.groups.map(group => group.id)).size, rule.groups.length, `${rule.id}: duplicate group identity`);
  const graduateCourses = [{id:'masters-2026-a',title:'研究',credits:4,degreeCategory:'特別研究'}, {id:'masters-2026-b',title:'授業',credits:2,degreeCategory:'授業科目'}];
  const semester = cells => ({timetable:{'1Q':{'月':cells}}});
  const graduateRecords = {'2026':semester({1:{courseId:'masters-2026-a',title:'研究',credits:4,grade:'可'},2:{courseId:'masters-2026-a',title:'研究',credits:4,grade:'可'},3:{courseId:'masters-2026-b',title:'授業',credits:2,grade:'未履修'}})};
  assert.deepEqual(graduateCourseProgress(graduateCourses,graduateRecords).map(entry=>entry.status),['修得済み','履修予定']);
  assert.equal(graduateCourseProgress(graduateCourses,{'2025':semester({1:{courseId:'bachelor-a',title:'研究',credits:4,grade:'可'}})})[0].status,'未登録','Another curriculum ID must not match by title');
  const graduateRequirements = {creditBasis:'credits',totalCredits:30,categories:[{name:'特別研究',minimumCredits:8}],issues:[],evidence:{page:3}};
  const renderedGraduate = renderGraduate({requirements:graduateRequirements,courses:graduateCourses,data:graduateRecords});
  assert(renderedGraduate.includes('あと 4 単位'));
  assert(!renderedGraduate.includes('区分未確認'));
  const nonCredit = renderGraduate({requirements:{...graduateRequirements,creditBasis:'not_credit_based',totalCredits:null,activities:[{id:'research',title:'原子力研究'}]},courses:[],data:{}});
  assert(nonCredit.includes('原子力研究'));
  assert(!nonCredit.includes('<progress'));
  console.log(`PASS: ${rules.length} undergraduate cohort/variant guides render source-backed minima and category mappings.`);
} finally {
  rmSync(filename);
}
