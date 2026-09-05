export interface Department {
  id: string;
  name: string;
  faculty: string;
  facultyId: string;
  campus?: string;
  sourceStatus?: 'curriculum_pdf_available' | 'partial_no_department_curriculum_pdf';
}

export const AVAILABLE_DEPARTMENTS: Department[] = [
  { id: 'kikai', name: '機械工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'kikai_system', name: '機械システム工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'denki', name: '電気電子通信工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'iyo', name: '医用工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'ouyou_kagaku', name: '応用化学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'genshiryoku', name: '原子力安全工学科', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'shizen_shizen', name: '自然科学科（自然コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'shizen_suuri', name: '自然科学科（数理コース）', faculty: '理工学部', facultyId: 'rikou', campus: '世田谷', sourceStatus: 'partial_no_department_curriculum_pdf' },
  { id: 'kenchiku', name: '建築学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'toshi_kogaku', name: '都市工学科', faculty: '建築都市デザイン学部', facultyId: 'kenchiku_toshi', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'joho_kagaku', name: '情報科学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'chino_joho', name: '知能情報工学科', faculty: '情報工学部', facultyId: 'joho', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'kankyo_sosei', name: '環境創生学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'kankyo_keiei', name: '環境経営システム学科', faculty: '環境学部', facultyId: 'kankyo', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'shakai_media', name: '社会メディア学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'joho_system', name: '情報システム学科', faculty: 'メディア情報学部', facultyId: 'media_joho', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'design_data', name: 'デザイン・データ科学科', faculty: 'デザイン・データ科学部', facultyId: 'design_data', campus: '横浜', sourceStatus: 'curriculum_pdf_available' },
  { id: 'toshi_seikatsu', name: '都市生活学科', faculty: '都市生活学部', facultyId: 'toshi_seikatsu', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
  { id: 'ningen', name: '人間科学科', faculty: '人間科学部', facultyId: 'ningen', campus: '世田谷', sourceStatus: 'curriculum_pdf_available' },
] as const;

