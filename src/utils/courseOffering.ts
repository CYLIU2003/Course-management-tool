import type { AcademicCourse, AcademicCourseCell, AcademicYear, CourseOffering } from './academicProgress';

type SelectBestOfferingInput = {
  course: AcademicCourse;
  day?: string;
  periodId?: string | number;
  currentYear?: AcademicYear;
  selectedClassName?: string;
};

export type OfferingMatchReason = 'exact' | 'slot' | 'grade' | 'class' | 'first' | 'none';

export interface OfferingSelectionResult {
  offering?: CourseOffering;
  reason: OfferingMatchReason;
  message: string;
}

function toGradeYearValue(currentYear?: AcademicYear): string | undefined {
  if (currentYear === '1年次') return '1';
  if (currentYear === '2年次') return '2';
  if (currentYear === '3年次') return '3';
  if (currentYear === '4年次') return '4';
  return undefined;
}

export function selectBestOffering({
  course,
  day,
  periodId,
  currentYear,
  selectedClassName,
}: SelectBestOfferingInput): CourseOffering | undefined {
  return selectBestOfferingDetailed({ course, day, periodId, currentYear, selectedClassName }).offering;
}

export function selectBestOfferingDetailed({
  course,
  day,
  periodId,
  currentYear,
  selectedClassName,
}: SelectBestOfferingInput): OfferingSelectionResult {
  const offerings = course.offerings ?? [];
  if (offerings.length === 0) {
    return {
      reason: 'none',
      message: 'この科目には開講情報がありません。教室は手入力してください。',
    };
  }

  const period = periodId === undefined ? undefined : String(periodId);
  const gradeYear = toGradeYearValue(currentYear);

  const exact = offerings.find((offering) => {
    return (
      (!day || offering.day === day) &&
      (!period || offering.period === period) &&
      (!gradeYear || offering.gradeYear === gradeYear) &&
      (!selectedClassName || offering.className === selectedClassName)
    );
  });

  if (exact) {
    return {
      offering: exact,
      reason: 'exact',
      message: '曜日・時限・学年・クラスが一致する開講情報を同期しました。',
    };
  }

  const slotMatched = offerings.find((offering) => {
    return (!day || offering.day === day) && (!period || offering.period === period);
  });

  if (slotMatched) {
    return {
      offering: slotMatched,
      reason: 'slot',
      message: '曜日・時限が一致する開講情報を同期しました。',
    };
  }

  const gradeMatched = offerings.find((offering) => {
    return !gradeYear || offering.gradeYear === gradeYear;
  });

  if (gradeMatched) {
    return {
      offering: gradeMatched,
      reason: 'grade',
      message: '現在学年に一致する開講情報を同期しました。',
    };
  }

  const classMatched = offerings.find((offering) => {
    return !selectedClassName || offering.className === selectedClassName;
  });

  if (classMatched) {
    return {
      offering: classMatched,
      reason: 'class',
      message: 'クラス一致の開講情報を同期しました。',
    };
  }

  return {
    offering: offerings[0],
    reason: 'first',
    message: '一致する条件がなかったため、最初の開講情報を同期しました。',
  };
}

export function buildSyncedCourseCell(
  course: AcademicCourse,
  offering?: CourseOffering,
): AcademicCourseCell {
  const memoParts = [
    `ID: ${course.id}`,
    course.category,
    course.group,
    course.rawRequired,
    offering?.lectureCode ? `講義コード: ${offering.lectureCode}` : '',
    offering?.term ? `学期: ${offering.term}` : '',
    offering?.day && offering?.period ? `時限: ${offering.day}${offering.period}限` : '',
    offering?.gradeYear ? `対象年: ${offering.gradeYear}年` : '',
    offering?.className ? `クラス: ${offering.className}` : '',
    offering?.teacher ? `担当: ${offering.teacher}` : '',
    offering?.room ? `教室: ${offering.room}` : '',
    offering?.target,
    offering?.remarks,
  ];

  return {
    title: course.title,
    credits: course.credits > 0 ? course.credits : undefined,
    courseType: course.courseType,
    teacher: offering?.teacher,
    room: offering?.room,
    memo: memoParts.filter(Boolean).join(' | '),
    lectureCode: offering?.lectureCode,
    term: offering?.term,
    className: offering?.className,
    target: offering?.target,
    remarks: offering?.remarks,
    sourceOffering: offering,
    scheduleDay: offering?.day,
    schedulePeriod: offering?.period,
  };
}