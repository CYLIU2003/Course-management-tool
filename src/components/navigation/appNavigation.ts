export type AppPage = 'home' | 'timetable' | 'requirements' | 'grades' | 'settings';

export const APP_PAGE_LABELS: Record<AppPage, string> = {
  home: 'ホーム',
  timetable: '時間割',
  requirements: '卒業要件',
  grades: '成績',
  settings: '設定',
};

export const APP_PAGE_ORDER: AppPage[] = ['home', 'timetable', 'requirements', 'grades', 'settings'];
