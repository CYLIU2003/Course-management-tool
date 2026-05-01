import type { Department } from '../../utils/autoLoadCSV';
import YearSelector from '../timetable/YearSelector';
import { APP_PAGE_LABELS, type AppPage } from '../navigation/appNavigation';

type AppHeaderProps = {
  title: string;
  departmentId: string;
  departments: readonly Department[];
  entranceYear: number;
  currentYear: string;
  currentPage: AppPage;
  onDepartmentChange: (departmentId: string) => void | Promise<void>;
  onEntranceYearChange: (year: number) => void | Promise<void>;
  onYearChange: (year: string) => void;
  onOpenSettings?: () => void;
};

export default function AppHeader({
  title,
  departmentId,
  departments,
  entranceYear,
  currentYear,
  currentPage,
  onDepartmentChange,
  onEntranceYearChange,
  onYearChange,
  onOpenSettings,
}: AppHeaderProps) {
  const entranceYears = [2023, 2024, 2025, 2026, 2027];

  return (
    <header className="app-header print:hidden">
      <div className="app-container app-header__inner">
        <div className="app-brand">
          <div className="app-brand__mark">🎓</div>
          <div>
            <h1 className="app-brand__title">{title}</h1>
            <p className="app-brand__subtitle">
              {APP_PAGE_LABELS[currentPage]} / 履修状況をひと目で把握できるダッシュボード
            </p>
          </div>
        </div>

        <div className="app-header__controls">
          <label className="control-field">
            <span>学科</span>
            <select value={departmentId} onChange={(e) => onDepartmentChange(e.target.value)}>
              {departments.map((department) => (
                <option key={department.id} value={department.id}>
                  {department.faculty} {department.name}
                </option>
              ))}
            </select>
          </label>

          <label className="control-field">
            <span>入学年度</span>
            <select value={entranceYear} onChange={(e) => onEntranceYearChange(Number(e.target.value))}>
              {entranceYears.map((year) => (
                <option key={year} value={year}>
                  {year}年度入学
                </option>
              ))}
            </select>
          </label>

          <YearSelector value={currentYear} onChange={onYearChange} />
        </div>

        <div className="app-header__actions">
          {onOpenSettings && (
            <button type="button" className="btn-ghost app-header__settings" onClick={onOpenSettings}>
              設定
            </button>
          )}
        </div>
      </div>
    </header>
  );
}