import type { AcademicAllYearsData, AcademicCourseCell } from './academicProgress';
import type { HandbookCourse, HandbookDocument } from '../core/handbooks';
import { isCheckedCourseForDepartment, normalizeHandbookText as normalize } from '../core/handbooks';
import type { DegreeGroup, DegreeRequirementSet } from '../core/curriculum';

export function guideCourses(documents: HandbookDocument[], department: string, data: AcademicAllYearsData) {
  const cells = Object.values(data).flatMap(year => Object.values(year.timetable).flatMap(days => Object.values(days).flatMap(slots => Object.values(slots)))).filter((cell): cell is AcademicCourseCell => !!cell);
  const courses = documents.flatMap(document => document.kind === 'handbook' && document.label !== '教職課程' ? document.courses.filter(course => isCheckedCourseForDepartment(course, document, department)).map(course => ({ course, document })) : []);
  // Repeated appearances of the same title and credit value count once, across quarters and sources.
  const scopedDepartment = department.replace(/（.*?）/g, '');
  const prioritized = [...courses].sort((a, b) => Number(a.course.verification?.scope === scopedDepartment) - Number(b.course.verification?.scope === scopedDepartment));
  const unique = [...new Map(prioritized.map(value => [`${normalize(value.course.verification?.titleText ?? value.course.title)}:${value.course.credits}`, value])).values()];
  return unique.map(({ course, document }) => {
    const title = course.verification?.titleText ?? course.title;
    const ids = courses.filter(entry => normalize(entry.course.verification?.titleText ?? entry.course.title) === normalize(title) && entry.course.credits === course.credits).map(entry => entry.course.id);
    const matches = cells.filter(cell => ids.some(id => cell.courseId === id || cell.courseId?.endsWith(`-${id}`)) || (!cell.courseId && normalize(cell.title) === normalize(title)));
    const valid = matches.filter(cell => cell.credits === course.credits);
    const status = valid.some(cell => ['秀', '優', '良', '可'].includes(cell.grade ?? '')) ? '修得済み' : valid.some(cell => !cell.grade || cell.grade === '未履修') ? '履修予定' : valid.some(cell => cell.grade === '不可') ? '不合格' : matches.length ? '単位数要確認' : '未登録';
    const classification = course.classification;
    const path = classification?.status === 'pdf_cell_checked' && classification.sourceSha256 === document.sha256 ? classification.path?.map(field => field.label) ?? [] : [];
    return { course, document, title, status, category: path[0] || '区分未確認', group: path.slice(1).join(' / ') || '科目群の区分なし', printedRequirement: classification?.status === 'pdf_cell_checked' && classification.sourceSha256 === document.sha256 ? classification.printedRequirement : undefined };
  });
}

export function guideMinimum(documents: HandbookDocument[], category: string, department?: string): { credits: number; source: HandbookDocument; page: number; note: string } | undefined {
  const scopedDepartment = department?.replace(/（.*?）/g, '');
  const candidates = documents.flatMap(source => source.kind === 'handbook' && source.label !== '教職課程' ? source.pages.flatMap(page => {
    // Faculty-wide books contain multiple departments' requirement tables.
    // If the page cannot be tied to the selected department, do not reuse its minimum.
    if (scopedDepartment && source.label !== scopedDepartment && !normalize(page.text).slice(0, 450).includes(normalize(scopedDepartment))) return [];
    return page.tables.flatMap(table => {
    if (!normalize(table.rows.flat().join('')).includes('卒業要件')) return [];
    return table.rows.flatMap(row => {
      if (!row.some(cell => normalize(cell ?? '') === normalize(category))) return [];
      const value = row.find(cell => /^\d+(?:\.\d+)?単位$/.test(normalize(cell ?? '')));
      return value ? [{ credits: Number(normalize(value).replace('単位', '')), source, page: page.page, note: row.filter(Boolean).join(' / ') }] : [];
    });
  }); }) : []);
  return new Set(candidates.map(c => c.credits)).size === 1 ? candidates[0] : undefined;
}

export function sumCourseCredits(courses: { course: HandbookCourse; status: string }[], status?: string) {
  return courses.reduce((sum, entry) => sum + (!status || entry.status === status ? entry.course.credits : 0), 0);
}

export function degreeSurplus(courses: Array<{ category: string; course: HandbookCourse; status: string }>, requirements: DegreeRequirementSet): number {
  return requirements.categories.reduce((total, rule) => total
    + Math.max(0, sumCourseCredits(courses.filter(entry => entry.category === rule.name), '修得済み') - rule.minimumCredits), 0);
}

export function degreeCourseOption(course: HandbookCourse, document: HandbookDocument, requirements?: DegreeRequirementSet) {
  const evidence = course.requirementEvidence;
  if (!requirements || evidence?.status !== 'pdf_requirement_cells_checked' || evidence.sourceSha256 !== document.sha256) return undefined;
  const options = evidence.options;
  const category = course.classification?.path?.map(field => field.label) ?? [];
  if (requirements.variant === 'international' && category.includes('外国語科目')
    && evidence.titleAnnotations?.some(annotation => annotation.symbol === '*')) {
    return { column: 0, printedSymbol: '*', courseType: 'designated' as const, bbox: evidence.titleAnnotations[0].bbox };
  }
  const scoped = options.filter(option => option.departmentId === requirements.departmentId);
  if (scoped.length === 1) return scoped[0];
  if (options.some(option => option.departmentId)) return undefined;
  if (options.length === 1) return options[0];
  const { departmentId, variant } = requirements;
  if (options.length === 2) {
    if (['joho_kagaku', 'chino_joho'].includes(departmentId)) return options[variant === 'international' ? 1 : 0];
    if (departmentId === 'toshi_seikatsu' && ['creative', 'international_urban'].includes(variant)) return options[variant === 'international_urban' ? 1 : 0];
    if (departmentId === 'ningen' && ['child', 'human'].includes(variant)) return options[variant === 'human' ? 1 : 0];
    if (['shizen_shizen', 'shizen_suuri'].includes(departmentId)) return options[departmentId === 'shizen_suuri' ? 1 : 0];
    if (['kenchiku', 'toshi_kogaku'].includes(departmentId)) return options[departmentId === 'toshi_kogaku' ? 1 : 0];
  }
  if (options.length === 4 && ['joho_kagaku', 'chino_joho'].includes(departmentId)) {
    return options[(departmentId === 'chino_joho' ? 2 : 0) + (variant === 'international' ? 1 : 0)];
  }
  return undefined;
}

export function degreeCourseApplies(course: HandbookCourse, departmentName: string, sourceSha256: string): boolean {
  if (course.requirementEvidence?.sourceSha256 !== sourceSha256) return true;
  const restrictions = normalize(course.requirementEvidence?.restrictions ?? '');
  const department = normalize(departmentName.replace(/（.*?）/g, ''));
  if (restrictions.includes('自然科学科以外対象')) return department !== '自然科学科';
  if (restrictions.includes('自然科学科対象')) return department === '自然科学科';
  if (restrictions.includes('のみ対象')) return restrictions.includes(department);
  return true;
}

export function degreeGroupProgress(entries: Array<{ course: HandbookCourse; status: string; group: string; leaf?: string; symbol?: string }>, rule: DegreeGroup) {
  const members = entries.filter(entry => entry.leaf && rule.courseCategories.includes(entry.leaf)
    && entry.symbol && rule.symbols.includes(entry.symbol.replace('〇', '○'))
    && (!rule.courseGroup || entry.group.includes(rule.courseGroup)));
  const earned = sumCourseCredits(members, '修得済み');
  const missing = members.filter(entry => entry.status !== '修得済み');
  // A numeric threshold cannot prove that every compulsory course was passed.
  const complete = earned >= rule.minimumCredits && (rule.membership !== 'all_marked' || missing.length === 0);
  return { members, earned, missing, complete, remaining: Math.max(0, rule.minimumCredits - earned) };
}

export function degreeProgramProgress<T extends { course: HandbookCourse; document: HandbookDocument; status: string }>(entries: T[], marks: string[]) {
  const members = entries.filter(entry => entry.course.requirementEvidence?.sourceSha256 === entry.document.sha256
    && entry.course.requirementEvidence.programMarks?.some(mark => marks.includes(mark.symbol)));
  return { members, earned: sumCourseCredits(members, '修得済み') };
}
