import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AVAILABLE_DEPARTMENTS } from '../../src/core/departments';
import { loadOfficialCourseCandidates } from '../../src/api/handbooks';
import type { CurriculumDataset } from '../../src/core/curriculum';

const inputs = new Map<string, string>();
inputs.set('src/core/departments.ts', createHash('sha256').update(readFileSync('src/core/departments.ts')).digest('hex'));
globalThis.fetch = async (input) => {
  const url = String(input);
  const path = url === '/api/handbooks/catalog' ? 'public/handbooks/catalog.json'
    : url.startsWith('/api/handbooks/documents/') ? `public/handbooks/extracted/${url.split('/').pop()}.json` : undefined;
  if (!path) throw new Error(`Unsupported curriculum input: ${url}`);
  if (!existsSync(path)) return new Response('', { status: 404 });
  const bytes = readFileSync(path);
  inputs.set(path, createHash('sha256').update(bytes).digest('hex'));
  return new Response(bytes, { headers: { 'content-type': path.endsWith('.json') ? 'application/json' : 'text/csv' } });
};
const datasets: CurriculumDataset[] = [];
for (const department of AVAILABLE_DEPARTMENTS) for (const year of [2022, 2023, 2024, 2025, 2026]) {
  if (department.id === 'design_data' && year === 2022) {
    datasets.push({ status: 'unavailable', referenceOnly: true, departmentId: department.id, departmentName: `${department.faculty} ${department.name}`, entranceYear: year,
      curriculum: { name: department.name, requiredCredits: 0, breakdown: { required: 0, electiveRequired: 0, elective: 0 } }, courses: [], applicableCourses: [] });
    continue;
  }
  const courses = await loadOfficialCourseCandidates({ ...department, entranceYear: year });
  if (!courses.length) throw new Error(`No PDF-checked courses: ${department.id}/${year}`);
  // Legacy CSV rules lack row-level PDF verification. Do not silently retain their verdicts.
  datasets.push({ status: 'partial', referenceOnly: true,
    departmentId: department.id, departmentName: `${department.faculty} ${year === 2022 && department.id === 'ningen' ? '児童学科' : department.name}`, entranceYear: year,
    curriculum: { name: department.name, requiredCredits: 0, breakdown: { required: 0, electiveRequired: 0, elective: 0 } },
    courses, applicableCourses: [] });
  console.log(`${department.id}/${year}: ${courses.length} PDF-checked courses; graduation rules unreviewed`);
}
mkdirSync('data/import', { recursive: true });
writeFileSync('data/import/curricula.json', JSON.stringify({ schemaVersion: 1, departments: AVAILABLE_DEPARTMENTS,
  inputs: [...inputs].map(([path, sha256]) => ({ path, sha256 })), datasets }));
