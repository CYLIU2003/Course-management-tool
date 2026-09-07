import { apiFetch } from './client';
import type { HandbookCatalog, HandbookDocument, HandbookSource, HiramekiProgram } from '../core/handbooks';
import { isCheckedCourseForDepartment, normalizeHandbookText, selectHandbookSources } from '../core/handbooks';
import type { AcademicCourse } from '../core/types';

async function fetchJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await apiFetch(path, { signal });
  if (!response.ok) throw new Error(`履修資料を読み込めませんでした（HTTP ${response.status}）。`);
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) throw new Error('履修資料の応答がJSONではありません。配置を確認してください。');
  return response.json();
}

export async function loadHandbookCatalog(signal?: AbortSignal): Promise<HandbookCatalog> {
  const data = await fetchJson('/api/handbooks/catalog', signal) as HandbookCatalog;
  if (data.schemaVersion !== 1 || !Array.isArray(data.documents)) throw new Error('履修資料目録の形式が不正です。');
  return data;
}

export async function loadHandbookDocument(source: HandbookSource, signal?: AbortSignal): Promise<HandbookDocument> {
  const data = await fetchJson(`/api/handbooks/documents/${encodeURIComponent(source.id)}`, signal) as HandbookDocument;
  if (data.id !== source.id || data.sha256 !== source.sha256 || data.year !== source.year
    || !Array.isArray(data.pages) || data.pages.length !== source.pageCount || !Array.isArray(data.courses)) {
    throw new Error('履修資料と目録の年度・識別子・ページ数が一致しません。');
  }
  return { ...source, ...data };
}

export async function loadHiramekiPrograms(signal?: AbortSignal): Promise<HiramekiProgram[]> {
  const data = await fetchJson('/api/hirameki/programs', signal) as { schemaVersion: number; programs: HiramekiProgram[] };
  if (data.schemaVersion !== 1 || !Array.isArray(data.programs)) throw new Error('ひらめきのデータ形式が不正です。');
  return data.programs;
}

export function localHandbookUrl(path: string, page?: number): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}${page ? `#page=${page}` : ''}`;
}

/** Reference candidates only: no extracted symbol is promoted to a graduation rule. */
export async function loadOfficialCourseCandidates(profile: {
  id: string; faculty: string; name: string; entranceYear: number;
}): Promise<AcademicCourse[]> {
  const catalog = await loadHandbookCatalog();
  const sources = selectHandbookSources(catalog.documents, {
    entranceYear: profile.entranceYear, faculty: profile.faculty, departmentName: profile.name,
  }).filter((source) => source.label !== '教職課程');
  const hasDepartmentSource = sources.some((source) => source.label === profile.name.replace(/（.*?）/g, ''));
  const chosen = sources.filter((source) => !hasDepartmentSource || source.label !== profile.faculty);
  const documents = await Promise.all(chosen.map((source) => loadHandbookDocument(source)));
  const rows = documents.flatMap((document) => document.courses
    .filter((course) => isCheckedCourseForDepartment(course, document, profile.name))
    .map((course) => ({ course, document })));
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalizeHandbookText(row.course.verification!.titleText!);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }
  return [...grouped.values()].flatMap((matches) => {
    if (new Set(matches.map(({ course }) => course.credits)).size !== 1) return [];
    const { course, document } = matches[0];
    const classification = course.classification;
    const path = classification?.status === 'pdf_cell_checked' && classification.sourceSha256 === document.sha256
      ? classification.path?.map(field => field.label) ?? [] : [];
    const evidence = course.requirementEvidence;
    const options = evidence?.status === 'pdf_requirement_cells_checked' && evidence.sourceSha256 === document.sha256 ? evidence.options : [];
    const applicable = options.filter(option => option.departmentId === profile.id);
    const option = applicable.length === 1 ? applicable[0] : options.length === 1 && !options[0].departmentId ? options[0] : undefined;
    const courseType = option?.courseType === 'required' || option?.courseType === 'elective-required' ? option.courseType : 'unknown';
    return [{ id: `reference-${profile.id}-${course.id}`, title: course.verification!.titleText!, credits: course.credits,
      courseType, category: path[0] ?? '公式資料の参考科目',
      group: path.slice(1).join(' / '),
      sourceKind: 'curriculum', departmentId: profile.id, curriculumYear: profile.entranceYear,
      tags: ['必選・算入条件は原本確認'],
    } satisfies AcademicCourse];
  });
}
