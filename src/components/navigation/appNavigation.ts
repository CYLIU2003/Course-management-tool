export type AppPage = 'sources' | 'home' | 'timetable' | 'requirements' | 'handbooks' | 'grades' | 'settings';

export const APP_PAGE_LABELS: Record<AppPage, string> = {
  sources: '資料・出典',
  home: 'ホーム',
  timetable: '時間割',
  requirements: '卒業要件',
  handbooks: '履修ガイド',
  grades: '成績・単位',
  settings: '設定',
};

export const APP_PAGE_ORDER: AppPage[] = ['home', 'timetable', 'grades', 'handbooks'];
