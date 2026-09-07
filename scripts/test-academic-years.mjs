import assert from 'node:assert/strict';
import {build} from 'esbuild';
const result=await build({stdin:{contents:"export * from './src/utils/academicYears';",resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,format:'esm',platform:'node'});
const {currentAcademicYear,migrateAcademicYears,emptyAcademicYear,cohortRecords}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
assert.equal(currentAcademicYear(new Date('2026-03-31T14:59:59Z')),2025);
assert.equal(currentAcademicYear(new Date('2026-03-31T15:00:00Z')),2026);
const original={'1年次':emptyAcademicYear('kikai',2022),'2年次':emptyAcademicYear('kikai',2022)};
original['1年次'].timetable={'1Q':{'月':{'1':{title:'past',credits:2,grade:'可'}}}};
assert.throws(()=>migrateAcademicYears(original,{'1年次':'2025','2年次':'2025'},'kikai',2022));
const migrated=migrateAcademicYears(original,{'1年次':'2024','2年次':'2026'},'kikai',2022);
migrated['2026'].timetable={'1Q':{'月':{'1':{title:'current'}}}};
assert.equal(migrated['2024'].timetable['1Q']['月']['1'].title,'past');
assert.equal(Object.keys(original['2年次'].timetable).length,0);
migrated['2027']=emptyAcademicYear('grad_master_kikai',2027);
assert.deepEqual(Object.keys(cohortRecords(migrated,'kikai',2022)),['2024','2026']);
console.log('PASS: Tokyo April boundary, confirmed migration, year isolation, admission/degree separation.');

assert.deepEqual(Object.keys(migrateAcademicYears(original,{"1年次":"2024"},"kikai",2022)),["2024"]);
