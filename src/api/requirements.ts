import {
  academicYearToNumber,
  collectAcademicCourseRecords,
  createAcademicCourseRecordLookup,
  findAcademicCourseRecord,
  normalizeCourseRecordTitle,
  type AcademicCourseRecord,
} from '../core/courseRecords';
import type { AcademicAllYearsData, AcademicCourse, AcademicCurriculum, AcademicCurriculumDetail } from '../utils/academicProgress';
import type { ApplicableCourseRow } from '../utils/csvImporter';
import {
  calculateRequirementStatus,
  type CategoryCourse,
  type RequirementCategoryDetail,
  type RequirementCategorySummary,
} from '../utils/requirements';

type RequirementCategoryDefinition = {
  categoryId: string;
  categoryName: string;
  area: string;
  subarea: string;
  requiredCredits: number;
  description: string;
  order: number;
  isOverflow: boolean;
  rows: ApplicableCourseRow[];
};

type RequirementCategoryEvaluation = {
  definition: RequirementCategoryDefinition;
  earnedCredits: number;
  plannedCredits: number;
  courses: CategoryCourse[];
};

function makeCategoryId(area: string, subarea: string) {
  return `${encodeURIComponent(area)}::${encodeURIComponent(subarea)}`;
}

function isGraduationDetail(detail: AcademicCurriculumDetail) {
  return !detail.stage || detail.stage === '卒業';
}

function detailRequiredCredits(detail: AcademicCurriculumDetail) {
  const structuredTotal = Number(detail.totalRequiredCredits) || 0;
  const componentTotal =
    (Number(detail.requiredCredits) || 0) +
    (Number(detail.electiveRequired1Credits) || 0) +
    (Number(detail.electiveRequired2Credits) || 0) +
    (Number(detail.freeCredits) || 0);
  return Math.max(structuredTotal, componentTotal);
}

function isOverflowCategory(area: string, subarea: string, rows: ApplicableCourseRow[]) {
  const normalized = `${area} ${subarea}`.normalize('NFKC').replace(/\s+/g, '');
  return (
    normalized.includes('自由選択') ||
    normalized.includes('自由分野') ||
    rows.some((row) => row.applicability.toLowerCase().includes('overflow'))
  );
}

function buildFallbackDetails(curriculum: AcademicCurriculum): AcademicCurriculumDetail[] {
  return [
    {
      stage: '卒業',
      area: '全体',
      subarea: '必修科目',
      totalRequiredCredits: curriculum.breakdown.required,
      requiredCredits: curriculum.breakdown.required,
      electiveRequired1Credits: 0,
      electiveRequired2Credits: 0,
      freeCredits: 0,
    },
    {
      stage: '卒業',
      area: '全体',
      subarea: '選択必修科目',
      totalRequiredCredits: curriculum.breakdown.electiveRequired,
      requiredCredits: 0,
      electiveRequired1Credits: curriculum.breakdown.electiveRequired,
      electiveRequired2Credits: 0,
      freeCredits: 0,
    },
    {
      stage: '卒業',
      area: '全体',
      subarea: '自由選択',
      totalRequiredCredits: curriculum.breakdown.elective,
      requiredCredits: 0,
      electiveRequired1Credits: 0,
      electiveRequired2Credits: 0,
      freeCredits: curriculum.breakdown.elective,
    },
  ].filter((detail) => detailRequiredCredits(detail) > 0);
}

function uniqueApplicableRows(rows: ApplicableCourseRow[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.courseId.normalize('NFKC').toLowerCase()}::${normalizeCourseRecordTitle(row.title)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function courseMatchesDefinition(course: AcademicCourse, area: string, subarea: string) {
  const normalizedArea = normalizeCourseRecordTitle(area);
  const normalizedSubarea = normalizeCourseRecordTitle(subarea);
  const sourceText = normalizeCourseRecordTitle([
    course.category,
    course.group,
    course.rawRequired,
    ...(course.tags ?? []),
  ].filter(Boolean).join(' '));

  if (subarea === '必修科目') return course.courseType === 'required';
  if (subarea === '選択必修科目') return course.courseType === 'elective-required';
  if (subarea === '自由選択') return false;

  return (
    (normalizedSubarea.length > 1 && sourceText.includes(normalizedSubarea)) ||
    (normalizedArea.length > 1 && sourceText.includes(normalizedArea))
  );
}

function createFallbackRows(
  definition: Pick<RequirementCategoryDefinition, 'area' | 'subarea' | 'requiredCredits'>,
  courses: AcademicCourse[],
): ApplicableCourseRow[] {
  return courses
    .filter((course) => course.credits > 0 && course.courseType !== 'unknown')
    .filter((course) => courseMatchesDefinition(course, definition.area, definition.subarea))
    .map((course) => ({
      departmentId: course.departmentId ?? '',
      facultyId: '',
      stage: '卒業',
      area: definition.area,
      subarea: definition.subarea,
      requirementKey: `卒業:${definition.area}:${definition.subarea}`,
      requiredCredits: definition.requiredCredits,
      courseId: course.id,
      title: course.title,
      credits: course.credits,
      courseType: course.courseType,
      category: course.category,
      group: course.group,
      applicability: 'fallback_course_metadata_match',
      matchReason: 'course_category_or_group',
      sourceQuality: 'derived',
      notes: '該当科目CSVがないため、科目区分から暫定判定',
    }));
}

function buildCategoryDefinitions(
  curriculum: AcademicCurriculum,
  courses: AcademicCourse[],
  applicableCourses: ApplicableCourseRow[],
) {
  const details = curriculum.details?.filter(isGraduationDetail) ?? [];
  const sourceDetails = details.length > 0 ? details : buildFallbackDetails(curriculum);
  const grouped = new Map<string, { detail: AcademicCurriculumDetail; requiredCredits: number; notes: string[]; order: number }>();

  sourceDetails.forEach((detail, index) => {
    const categoryId = makeCategoryId(detail.area, detail.subarea);
    const current = grouped.get(categoryId);
    if (current) {
      current.requiredCredits += detailRequiredCredits(detail);
      if (detail.notes && !current.notes.includes(detail.notes)) current.notes.push(detail.notes);
      return;
    }

    grouped.set(categoryId, {
      detail,
      requiredCredits: detailRequiredCredits(detail),
      notes: detail.notes ? [detail.notes] : [],
      order: index,
    });
  });

  return [...grouped.entries()].map<RequirementCategoryDefinition>(([categoryId, groupedDetail]) => {
    const { detail } = groupedDetail;
    const directRows = uniqueApplicableRows(
      applicableCourses.filter((row) => (
        (!row.stage || row.stage === '卒業') &&
        row.area === detail.area &&
        row.subarea === detail.subarea
      )),
    );
    const rows = directRows.length > 0
      ? directRows
      : createFallbackRows({
          area: detail.area,
          subarea: detail.subarea,
          requiredCredits: groupedDetail.requiredCredits,
        }, courses);
    const sourceDescription = directRows.length > 0
      ? `${directRows.length}件の該当科目データを使用しています。`
      : rows.length > 0
        ? '該当科目CSVがないため、科目区分から暫定的に候補を抽出しています。'
        : 'この区分の該当科目データはまだ登録されていません。';

    return {
      categoryId,
      categoryName: `${detail.area}${detail.subarea ? ` - ${detail.subarea}` : ''}`,
      area: detail.area,
      subarea: detail.subarea,
      requiredCredits: groupedDetail.requiredCredits,
      description: [...groupedDetail.notes, sourceDescription].filter(Boolean).join(' '),
      order: groupedDetail.order,
      isOverflow: isOverflowCategory(detail.area, detail.subarea, rows),
      rows,
    };
  });
}

function findCourse(courses: AcademicCourse[], row: ApplicableCourseRow) {
  const normalizedId = row.courseId.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const normalizedTitle = normalizeCourseRecordTitle(row.title);

  return courses.find((course) => {
    const identifiers = [course.id, ...(course.lectureCodes ?? [])]
      .map((value) => value.normalize('NFKC').replace(/\s+/g, '').toLowerCase());
    return identifiers.includes(normalizedId);
  }) ?? courses.find((course) => (
    normalizeCourseRecordTitle(course.title) === normalizedTitle ||
    (course.aliases ?? []).some((alias) => normalizeCourseRecordTitle(alias) === normalizedTitle)
  ));
}

function recordCredits(record: AcademicCourseRecord, row?: ApplicableCourseRow) {
  if (record.credits > 0) return record.credits;
  if (row && row.credits > 0) return row.credits;
  return record.course?.credits ?? 0;
}

function recordIsGraduationCountable(record: AcademicCourseRecord) {
  return (
    record.year !== 'M1' &&
    record.year !== 'M2' &&
    recordCredits(record) > 0 &&
    Boolean(record.courseType) &&
    record.courseType !== 'unknown'
  );
}

function buildCourseLocation(record?: AcademicCourseRecord) {
  if (!record) return '';
  return `${record.year} ${record.quarter} ${record.day}${record.periodId}限`;
}

function buildCategoryCourse(
  row: ApplicableCourseRow,
  courses: AcademicCourse[],
  record: AcademicCourseRecord | undefined,
  assignedCategoryId: string | undefined,
  definition: RequirementCategoryDefinition,
  categoryNameById: ReadonlyMap<string, string>,
): CategoryCourse {
  const course = findCourse(courses, row);
  const offering = record?.cell.sourceOffering ?? course?.offerings?.[0];
  const failed = record?.status === 'failed';
  const takenStatus = record?.status === 'passed'
    ? 'passed'
    : record?.status === 'planned'
      ? 'planned'
      : 'not_taken';
  const matchState = !record || failed
    ? 'eligible_for_this_category'
    : assignedCategoryId === definition.categoryId
      ? 'counted_in_this_category'
      : assignedCategoryId
        ? 'counted_in_other_category'
        : 'eligible_for_this_category';
  const yearLevel = record
    ? academicYearToNumber(record.year)
    : offering?.gradeYear
      ? Number.parseInt(offering.gradeYear, 10) || undefined
      : undefined;

  return {
    courseId: row.courseId || course?.id || row.title,
    courseCode: row.courseId || course?.id,
    courseName: row.title || course?.title || record?.title || '科目名未設定',
    credits: record ? recordCredits(record, row) : row.credits || course?.credits || 0,
    yearLevel,
    semester: record?.quarter ?? offering?.term,
    dayPeriod: record ? buildCourseLocation(record) : offering?.day && offering.period ? `${offering.day}${offering.period}限` : '',
    instructor: record?.cell.teacher ?? offering?.teacher ?? '',
    takenStatus,
    matchState,
    countedCategoryId: assignedCategoryId,
    countedCategoryName: assignedCategoryId ? categoryNameById.get(assignedCategoryId) : undefined,
    eligibleCategoryIds: [definition.categoryId],
  };
}

function evaluateRequirementCategories(
  curriculum: AcademicCurriculum,
  courses: AcademicCourse[],
  allYearsData: AcademicAllYearsData,
  applicableCourses: ApplicableCourseRow[],
): RequirementCategoryEvaluation[] {
  const definitions = buildCategoryDefinitions(curriculum, courses, applicableCourses);
  const records = collectAcademicCourseRecords(allYearsData, courses);
  const lookup = createAcademicCourseRecordLookup(records);
  const directDefinitions = definitions.filter((definition) => !definition.isOverflow);
  const overflowDefinition = definitions.find((definition) => definition.isOverflow);
  const eligibleCategoryIds = new Map<string, string[]>();
  const rowByRecordAndCategory = new Map<string, ApplicableCourseRow>();

  for (const definition of directDefinitions) {
    for (const row of definition.rows) {
      const course = findCourse(courses, row);
      const record = findAcademicCourseRecord(lookup, {
        courseId: row.courseId || course?.id,
        title: row.title || course?.title,
        aliases: course?.aliases,
      });
      if (!record || record.status === 'failed' || recordCredits(record, row) <= 0) continue;

      const current = eligibleCategoryIds.get(record.recordKey) ?? [];
      if (!current.includes(definition.categoryId)) current.push(definition.categoryId);
      eligibleCategoryIds.set(record.recordKey, current);
      rowByRecordAndCategory.set(`${record.recordKey}::${definition.categoryId}`, row);
    }
  }

  const totals = new Map<string, { earned: number; planned: number }>();
  for (const definition of definitions) {
    totals.set(definition.categoryId, { earned: 0, planned: 0 });
  }

  const assignment = new Map<string, string>();
  const assignedCredits = new Map<string, number>();
  const assignableRecords = records
    .filter(recordIsGraduationCountable)
    .filter((record) => record.status !== 'failed')
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'passed' ? -1 : 1;
      return left.title.localeCompare(right.title, 'ja');
    });

  for (const record of assignableRecords) {
    const candidateIds = eligibleCategoryIds.get(record.recordKey) ?? [];
    const candidates = candidateIds
      .map((categoryId) => definitions.find((definition) => definition.categoryId === categoryId))
      .filter((definition): definition is RequirementCategoryDefinition => Boolean(definition))
      .sort((left, right) => left.order - right.order);
    const selected = candidates.find((definition) => {
      const current = totals.get(definition.categoryId);
      return current ? current.earned + current.planned < definition.requiredCredits : false;
    });

    if (!selected) continue;

    const row = rowByRecordAndCategory.get(`${record.recordKey}::${selected.categoryId}`);
    const credits = recordCredits(record, row);
    const total = totals.get(selected.categoryId);
    if (!total) continue;

    const availableCredits = Math.max(0, selected.requiredCredits - total.earned - total.planned);
    const consumedCredits = Math.min(credits, availableCredits);
    if (consumedCredits <= 0) continue;

    if (record.status === 'passed') total.earned += consumedCredits;
    if (record.status === 'planned') total.planned += consumedCredits;
    assignment.set(record.recordKey, selected.categoryId);
    assignedCredits.set(record.recordKey, consumedCredits);
  }

  if (overflowDefinition) {
    const overflowTotal = totals.get(overflowDefinition.categoryId);
    if (overflowTotal) {
      for (const record of assignableRecords) {
        const credits = recordCredits(record);
        const assignedCategoryId = assignment.get(record.recordKey);
        const directCredits = assignedCategoryId && assignedCategoryId !== overflowDefinition.categoryId
          ? assignedCredits.get(record.recordKey) ?? 0
          : 0;
        const overflowCredits = Math.max(0, credits - directCredits);
        if (overflowCredits <= 0) continue;

        if (record.status === 'passed') overflowTotal.earned += overflowCredits;
        if (record.status === 'planned') overflowTotal.planned += overflowCredits;

        if (!assignedCategoryId) {
          assignment.set(record.recordKey, overflowDefinition.categoryId);
          assignedCredits.set(record.recordKey, credits);
        }
      }
    }
  }

  const categoryNameById = new Map(definitions.map((definition) => [definition.categoryId, definition.categoryName]));

  return definitions.map((definition) => {
    const total = totals.get(definition.categoryId) ?? { earned: 0, planned: 0 };
    const categoryCourses = definition.isOverflow
      ? records
          .filter(recordIsGraduationCountable)
          .filter((record) => record.status !== 'failed')
          .flatMap<CategoryCourse>((record) => {
            const credits = recordCredits(record);
            const assignedCategoryId = assignment.get(record.recordKey);
            const directCredits = assignedCategoryId && assignedCategoryId !== definition.categoryId
              ? assignedCredits.get(record.recordKey) ?? 0
              : 0;
            const overflowCredits = assignedCategoryId === definition.categoryId
              ? credits
              : Math.max(0, credits - directCredits);
            if (overflowCredits <= 0) return [];

            return [{
              courseId: record.courseId ?? record.recordKey,
              courseCode: record.courseId,
              courseName: directCredits > 0 ? `${record.title}（区分超過分）` : record.title,
              credits: overflowCredits,
              yearLevel: academicYearToNumber(record.year),
              semester: record.quarter,
              dayPeriod: buildCourseLocation(record),
              instructor: record.cell.teacher ?? '',
              takenStatus: record.status === 'passed' ? 'passed' : 'planned',
              matchState: 'counted_in_this_category',
              countedCategoryId: definition.categoryId,
              countedCategoryName: definition.categoryName,
              eligibleCategoryIds: [definition.categoryId],
            }];
          })
      : definition.rows.map((row) => {
          const course = findCourse(courses, row);
          const record = findAcademicCourseRecord(lookup, {
            courseId: row.courseId || course?.id,
            title: row.title || course?.title,
            aliases: course?.aliases,
          });
          return buildCategoryCourse(
            row,
            courses,
            record,
            record ? assignment.get(record.recordKey) : undefined,
            definition,
            categoryNameById,
          );
        });

    const earnedCredits = definition.isOverflow
      ? total.earned
      : Math.min(definition.requiredCredits, total.earned);
    const plannedCredits = definition.isOverflow
      ? total.planned
      : Math.min(total.planned, Math.max(0, definition.requiredCredits - earnedCredits));

    return {
      definition,
      earnedCredits,
      plannedCredits,
      courses: categoryCourses,
    };
  });
}

function summarizeEvaluation(evaluation: RequirementCategoryEvaluation): RequirementCategorySummary {
  const { definition, earnedCredits, plannedCredits, courses } = evaluation;
  const totalEligibleCourses = courses.filter((course) => course.matchState !== 'not_eligible').length;
  const countedCourses = courses.filter((course) => course.matchState === 'counted_in_this_category').length;
  const plannedCourses = courses.filter((course) => (
    course.takenStatus === 'planned' && course.matchState === 'counted_in_this_category'
  )).length;
  const passedCourses = courses.filter((course) => (
    course.takenStatus === 'passed' && course.matchState === 'counted_in_this_category'
  )).length;

  return {
    categoryId: definition.categoryId,
    categoryName: definition.categoryName,
    description: definition.description,
    requiredCredits: definition.requiredCredits,
    earnedCredits,
    plannedCredits,
    remainingCredits: Math.max(0, definition.requiredCredits - earnedCredits - plannedCredits),
    status: calculateRequirementStatus(definition.requiredCredits, earnedCredits, plannedCredits),
    totalEligibleCourses,
    countedCourses,
    plannedCourses,
    passedCourses,
  };
}

export function generateRequirementCategories(
  curriculum: AcademicCurriculum,
  courses: AcademicCourse[],
  allYearsData: AcademicAllYearsData,
  applicableCourses: ApplicableCourseRow[],
): RequirementCategorySummary[] {
  return evaluateRequirementCategories(curriculum, courses, allYearsData, applicableCourses)
    .map(summarizeEvaluation);
}

export function generateRequirementCategoryDetail(
  categoryId: string,
  curriculum: AcademicCurriculum,
  courses: AcademicCourse[],
  allYearsData: AcademicAllYearsData,
  applicableCourses: ApplicableCourseRow[],
): RequirementCategoryDetail {
  const evaluation = evaluateRequirementCategories(curriculum, courses, allYearsData, applicableCourses)
    .find((candidate) => candidate.definition.categoryId === categoryId);

  if (!evaluation) {
    return {
      categoryId,
      categoryName: '要件詳細',
      description: '指定された卒業要件区分を見つけられませんでした。',
      requiredCredits: 0,
      earnedCredits: 0,
      plannedCredits: 0,
      remainingCredits: 0,
      status: 'not_started',
      courses: [],
    };
  }

  return {
    ...summarizeEvaluation(evaluation),
    courses: evaluation.courses,
  };
}
