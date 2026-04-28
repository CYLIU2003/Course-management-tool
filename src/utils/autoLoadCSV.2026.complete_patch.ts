// 2026年度入学・全学部対応版: src/utils/autoLoadCSV.ts に統合する差分案
// 目的: 従来の /department/rikou 固定を廃止し、facultyId ごとにCSVを読み込めるようにする。

export interface Department2026 {
  id: string;
  name: string;
  faculty: string;
  facultyId: string;
  campus: string;
  entranceYear: 2026;
  dataStatus: 'converted';
}

export const AVAILABLE_DEPARTMENTS_2026: Department2026[] = [
  { id: 'kikai', name: '機械工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'kikai_system', name: '機械システム工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'denki', name: '電気電子通信工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'iyo', name: '医用工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'ouyou_kagaku', name: '応用化学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'genshiryoku', name: '原子力安全工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'shizen_shizen', name: '自然科学科（自然コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'shizen_suuri', name: '自然科学科（数理コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'kenchiku', name: '建築学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'toshi_kogaku', name: '都市工学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'joho_kagaku', name: '情報科学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'chino_joho', name: '知能情報工学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'kankyo_sosei', name: '環境創生学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'kankyo_keiei', name: '環境経営システム学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'shakai_media', name: '社会メディア学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'joho_system', name: '情報システム学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'design_data', name: 'デザイン・データ科学科', faculty: 'デザイン・データ科学部', facultyId: 'design_data', campus: '横浜', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'toshi_seikatsu', name: '都市生活学科', faculty: '都市生活学部', facultyId: 'toshi_seikatsu', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
  { id: 'ningen', name: '人間科学科', faculty: '人間科学部', facultyId: 'ningen', campus: '世田谷', entranceYear: 2026, dataStatus: 'converted' },
];

export function getDepartment2026(departmentId: string): Department2026 | undefined {
  return AVAILABLE_DEPARTMENTS_2026.find((department) => department.id === departmentId);
}

export function buildCSVPaths2026(departmentId: string, entranceYear = 2026) {
  const department = getDepartment2026(departmentId);
  if (!department) {
    throw new Error(`Unknown departmentId: ${departmentId}`);
  }
  const basePath = `/department/${department.facultyId}`;
  return {
    requirements: `${basePath}/${entranceYear}/${departmentId}_credit_requirements.csv`,
    timetable: `${basePath}/${entranceYear}/${departmentId}_timetable_by_category.csv`,
    schedule: `${basePath}/${entranceYear}/${departmentId}_${entranceYear}_spring_schedule.csv`,
    sharedSchedule: `${basePath}/${entranceYear}/${department.facultyId}_${entranceYear}_spring_schedule.csv`,
    fallbackRequirements: department.facultyId === 'rikou' ? `/department/rikou/${departmentId}_credit_requirements.csv` : undefined,
    fallbackTimetable: department.facultyId === 'rikou' ? `/department/rikou/${departmentId}_timetable_by_category.csv` : undefined,
  };
}

// 既存buildCSVPathsを置換する場合は、autoLoadDepartmentCSVs(departmentId, entranceYear) 内の
// const paths = buildCSVPaths(departmentId, entranceYear);
// を
// const paths = buildCSVPaths2026(departmentId, entranceYear ?? 2026);
// に変更してください。
