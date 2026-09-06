import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';
const result = await build({ stdin: { contents: "export * from './src/utils/guideProgress'; export * from './src/core/handbooks';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'node', format: 'esm' });
const { guideCourses, selectHandbookSources } = await import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
const bundles = JSON.parse(readFileSync('data/import/curricula.json', 'utf8'));
const catalog = JSON.parse(readFileSync('public/handbooks/catalog.json', 'utf8'));
const documents = new Map(catalog.documents.map(source => [source.id, JSON.parse(readFileSync('public' + source.dataPath, 'utf8'))]));
const cohorts = bundles.datasets.map(dataset => {
  const department = bundles.departments.find(d => d.id === dataset.departmentId);
  const sources = selectHandbookSources(catalog.documents, { entranceYear: dataset.entranceYear, faculty: department.faculty, departmentName: department.name });
  const courses = guideCourses(sources.map(source => documents.get(source.id)), department.name, {});
  return { departmentId: department.id, entranceYear: dataset.entranceYear, sourceIds: sources.map(source => source.id), courses: courses.length,
    unresolved: courses.filter(c => c.category === '区分未確認').length,
    hierarchy: [...new Set(courses.map(c => `${c.category} / ${c.group}`))].sort() };
});
writeFileSync('docs/classification-cohorts.json', JSON.stringify({ cohorts }, null, 2) + '\n');
console.log(JSON.stringify({ cohorts: cohorts.length, withCourses: cohorts.filter(c => c.courses).length, fullyClassified: cohorts.filter(c => c.courses && !c.unresolved).length, remainingRows: cohorts.reduce((sum, c) => sum + c.unresolved, 0) }));
