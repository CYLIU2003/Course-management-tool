import type { AcademicAllYearsData, AcademicYearData } from '../core/types';

export function currentAcademicYear(date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric' }).formatToParts(date);
  const year = Number(parts.find(part => part.type === 'year')?.value);
  return year - (Number(parts.find(part => part.type === 'month')?.value) < 4 ? 1 : 0);
}
export const isAcademicYear = (value: string) => /^(20\d{2}|2100)$/.test(value);
export const hasLegacyYears = (data: AcademicAllYearsData) => Object.keys(data).some(key => !isAcademicYear(key));
export function emptyAcademicYear(departmentId: string, entranceYear: number): AcademicYearData {
  return { departmentId, entranceYear, timetable: {}, quarterRanges: { '1Q': {start:'',end:''}, '2Q': {start:'',end:''}, '3Q': {start:'',end:''}, '4Q': {start:'',end:''} } };
}
export function hasAcademicRecords(value: AcademicYearData): boolean {
  return Object.values(value.timetable).some(days => Object.values(days).some(slots => Object.values(slots).some(cell => cell !== null)))
    || Object.values(value.quarterRanges).some(range => Boolean(range.start || range.end));
}
export function migrateAcademicYears(data: AcademicAllYearsData, mapping: Record<string,string>, departmentId: string, entranceYear: number): AcademicAllYearsData {
  const result: AcademicAllYearsData = {};
  for (const [key, value] of Object.entries(data)) {
    if (!isAcademicYear(key) && !hasAcademicRecords(value) && !mapping[key]) continue;
    const destination = isAcademicYear(key) ? key : mapping[key];
    if (!destination || !isAcademicYear(destination)) throw new Error('各記録の年度を指定してください。');
    if (result[destination]) throw new Error('複数の記録に同じ年度が指定されています。記録を混ぜずに別年度を指定してください。');
    result[destination] = { ...structuredClone(value), departmentId: value.departmentId ?? departmentId, entranceYear: value.entranceYear ?? entranceYear };
  }
  return result;
}
export function cohortRecords(data: AcademicAllYearsData, departmentId: string, entranceYear: number): AcademicAllYearsData {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value.departmentId === departmentId && value.entranceYear === entranceYear));
}

export function initialAcademicCohort(data: AcademicAllYearsData, academicYear: number, fallback: { departmentId: string; entranceYear: number }) {
  const key = Object.keys(data).filter(key => isAcademicYear(key) && Number(key) <= academicYear)
    .sort((a,b) => Number(b)-Number(a)).find(key => data[key].departmentId && data[key].entranceYear);
  return key ? {departmentId: data[key].departmentId!, entranceYear: data[key].entranceYear!} : fallback;
}
