import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const filename = 'node_modules/.tmp/degree-membership-audit.cjs';
const failures = [];
const sourceConflicts = [];
mkdirSync('node_modules/.tmp', { recursive: true });
await build({ stdin: { contents: `
  import { createElement } from 'react';
  import { renderToStaticMarkup } from 'react-dom/server';
  import GuideProgress from './src/components/handbooks/GuideProgress';
  export { selectHandbookSources } from './src/core/handbooks';
  export { AVAILABLE_DEPARTMENTS } from './src/core/departments';
  export { degreeSurplus, degreeGroupProgress, degreeCourseOption, guideCourses, degreeCourseApplies, degreeProgramProgress } from './src/utils/guideProgress';
  export function renderGuide(props) { return renderToStaticMarkup(createElement(GuideProgress, props)); }
`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, outfile: filename, platform: 'node', format: 'cjs', jsx: 'automatic' });
try {
  const { renderGuide, selectHandbookSources, AVAILABLE_DEPARTMENTS, degreeSurplus, degreeGroupProgress, degreeCourseOption, guideCourses, degreeCourseApplies, degreeProgramProgress } = createRequire(import.meta.url)('../' + filename);
  const catalog = JSON.parse(readFileSync('public/handbooks/catalog.json', 'utf8'));
  const rules = JSON.parse(readFileSync('data/verified/undergraduate_degree_rules.json', 'utf8')).sets;
  for (const rule of rules) {
    const department = AVAILABLE_DEPARTMENTS.find(value => value.id === rule.departmentId);
    const documents = selectHandbookSources(catalog.documents, { entranceYear: rule.entranceYear, faculty: department.faculty, departmentName: department.name })
      .filter(source => source.label !== '教職課程')
      .map(source => JSON.parse(readFileSync('public' + source.dataPath, 'utf8')));
    const entries = guideCourses(documents, department.name, {}).filter(entry => degreeCourseApplies(entry.course, department.name, entry.document.sha256)).map(entry => ({ ...entry, leaf: entry.category === '基礎科目' ? entry.course.classification?.path?.[1]?.label : entry.category, symbol: degreeCourseOption(entry.course, entry.document, rule)?.printedSymbol }));
    for (const group of rule.groups) {
      const progress = degreeGroupProgress(entries, group);
      const available = progress.members.reduce((n, entry) => n + entry.course.credits, 0);
      const discrepancy = {set:rule.id,group:group.name,category:group.category,expected:group.minimumCredits,available,members:progress.members.map(e=>e.title)};
      const conflict = rule.sourceConflicts?.find(issue => issue.groupId === group.id);
      if (conflict) {
        assert.equal(conflict.printedMinimum, group.minimumCredits);
        assert.equal(conflict.markedCourseCredits, available);
        assert.equal(conflict.evidence.length, 2);
        for (const evidence of conflict.evidence) assert(documents.some(document => document.id === evidence.sourceId && document.sha256 === evidence.sourceSha256));
        sourceConflicts.push({...discrepancy, evidence: conflict.evidence, message: conflict.message});
      } else if (available < group.minimumCredits || (group.membership === 'all_marked' && available !== group.minimumCredits)) failures.push(discrepancy);
    }
    for (const condition of rule.conditions ?? []) {
      const progress = degreeProgramProgress(entries, condition.marks);
      const available = progress.members.reduce((n, entry) => n + entry.course.credits, 0);
      if (available < condition.minimumCredits) failures.push({set: rule.id, group: condition.name, category: '指定科目の内数', expected: condition.minimumCredits, available, members: progress.members.map(entry => entry.title)});
    }
    const html = renderGuide({ documents, department: department.name, data: {}, requirementSets: [rule] });
    assert(!/区分未確認|必要単位：未確認|必要単位を確認/.test(html), rule.id);
    for (const category of rule.categories) assert(html.includes(category.name), `${rule.id}: ${category.name}`);
    assert(html.includes('自由選択'), rule.id);
  }
  writeFileSync('docs/degree-membership-audit.json', JSON.stringify({ ruleSets: rules.length, groups: rules.reduce((n,r) => n+r.groups.length,0), failures, sourceConflicts }, null, 2) + '\n');
  console.log(`Degree membership audit: ${failures.length} extraction discrepancies, ${sourceConflicts.length} documented original-source conflicts across ${rules.length} rule sets`);
  if (failures.length) process.exitCode = 1;
} finally {
  rmSync(filename);
}
