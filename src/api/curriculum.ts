import type { CurriculumDataset } from '../core/curriculum';

/** The sole automatic course/requirement source: the local SQLite API. */
export async function loadDepartmentCurriculum(departmentId: string, entranceYear: number): Promise<CurriculumDataset> {
  const response = await fetch(`/api/curricula/${encodeURIComponent(departmentId)}/${entranceYear}`);
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('履修情報を読み込めませんでした。再読み込みしてください。');
  }
  const value = await response.json() as CurriculumDataset;
  if (!value || value.departmentId !== departmentId || value.entranceYear !== entranceYear
    || !Array.isArray(value.courses) || !Array.isArray(value.applicableCourses) || !value.curriculum
    || !['success', 'partial', 'unavailable'].includes(value.status)
    || value.courses.some((course) => course.departmentId !== departmentId || course.curriculumYear !== entranceYear)) {
    throw new Error('選択した学科・入学年度の履修情報を確認できませんでした。');
  }
  return value;
}
