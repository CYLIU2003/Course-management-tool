import type { AcademicQuarter, CourseOffering } from './academicProgress';

export interface OfficialClass {
  id: string; year: number; title: string; titleVariants: string[]; lectureCode: string; status: string;
  meetings: { campus: string; term: string; day: string; period: string; rooms: string[]; teachers: string[]; remarks: string[] }[];
  audiences: { departmentIds: string[]; departmentLabel: string; campus: string; gradeYear: string; className: string; target: string }[];
}
export interface OfficialCatalog { year: number; classes: OfficialClass[] }
const normalize = (text: string) => text.normalize('NFKC').replace(/\s/g, '').toLowerCase();
const terms: Record<AcademicQuarter, string[]> = {
  '1Q': ['前期', '前期前', '通年'], '2Q': ['前期', '前期後', '通年'],
  '3Q': ['後期', '後期前', '通年'], '4Q': ['後期', '後期後', '通年'],
};

// Matching offers a class for explicit selection; a title match is not eligibility proof.
export function officialCandidates(catalog: OfficialCatalog, title: string, departmentId: string, campus: string, day: string, period: number, quarter: AcademicQuarter): CourseOffering[] {
  if (catalog.year !== 2026 || !normalize(title)) return [];
  return catalog.classes.flatMap(course => {
    if (course.year !== 2026 || course.status !== 'source_extracted' || ![course.title, ...course.titleVariants].some(name => normalize(name) === normalize(title))) return [];
    const audiences = course.audiences.filter(a => a.departmentIds.includes(departmentId) || (a.departmentLabel === '共通' && a.campus === campus));
    if (!audiences.length) return [];
    return course.meetings.flatMap((meeting, index) => {
      if (meeting.campus !== campus || meeting.day !== day || meeting.period !== String(period) || !terms[quarter].includes(meeting.term)) return [];
      return [{ id: `${course.id}:${index}`, departmentId, academicYear: 2026, lectureCode: course.lectureCode,
        day, period: String(period), term: meeting.term, teacher: meeting.teachers.join(' / '), room: meeting.rooms.join(' / '),
        target: [...new Set(audiences.map(a => `${a.gradeYear}年 ${a.className} ${a.target}`.trim()))].join(' / '),
        remarks: meeting.remarks.join('\n') }];
    });
  });
}
