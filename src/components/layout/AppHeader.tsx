import type { Department } from '../../utils/autoLoadCSV';
import type { ReactNode } from 'react';
import YearSelector from '../timetable/YearSelector';

type AppHeaderProps = {
  title: string;
  departmentId: string;
  departments: readonly Department[];
  currentYear: string;
  currentPage: 'timetable' | 'grades';
  onDepartmentChange: (departmentId: string) => void | Promise<void>;
  onYearChange: (year: string) => void;
  onPageChange: (page: 'timetable' | 'grades') => void;
  dataMenu: ReactNode;
};

export default function AppHeader({
  title,
  departmentId,
  departments,
  currentYear,
  currentPage,
  onDepartmentChange,
  onYearChange,
  onPageChange,
  dataMenu,
}: AppHeaderProps) {
  return (
    <header className="app-header print:hidden">
      <div className="app-container app-header__inner">
        <div className="app-brand">
          <div className="app-brand__mark">🎓</div>
          <div>
            <h1 className="app-brand__title">{title}</h1>
            <p className="app-brand__subtitle">履修状況をひと目で把握できるダッシュボード</p>
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

          <YearSelector value={currentYear} onChange={onYearChange} />

          <nav className="page-switch" aria-label="ページ切り替え">
            <button type="button" className={currentPage === 'timetable' ? 'page-switch__button is-active' : 'page-switch__button'} onClick={() => onPageChange('timetable')}>
              時間割
            </button>
            <button type="button" className={currentPage === 'grades' ? 'page-switch__button is-active' : 'page-switch__button'} onClick={() => onPageChange('grades')}>
              成績・単位
            </button>
          </nav>
        </div>

        <div className="app-header__actions">{dataMenu}</div>
      </div>
    </header>
  );
}