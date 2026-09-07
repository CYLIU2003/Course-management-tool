import type { AcademicAllYearsData, AcademicCourse, AcademicCourseCell } from './academicProgress';
import { normalizeHandbookText } from '../core/handbooks';

export function graduateCourseProgress(courses: AcademicCourse[], data: AcademicAllYearsData) {
  const cells = Object.values(data).flatMap(year => Object.values(year.timetable).flatMap(days => Object.values(days).flatMap(slots => Object.values(slots)))).filter((cell): cell is AcademicCourseCell => !!cell);
  return courses.map(course => {
    const matches = cells.filter(cell => cell.courseId === course.id || (!cell.courseId && normalizeHandbookText(cell.title) === normalizeHandbookText(course.title)));
    const valid = matches.filter(cell => cell.credits === course.credits);
    const status = valid.some(cell => ['秀', '優', '良', '可'].includes(cell.grade ?? '')) ? '修得済み'
      : valid.some(cell => !cell.grade || cell.grade === '未履修') ? '履修予定'
        : valid.some(cell => cell.grade === '不可') ? '不合格' : matches.length ? '単位数要確認' : '未登録';
    return { course, status };
  });
}
