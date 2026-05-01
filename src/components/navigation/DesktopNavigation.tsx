import { APP_PAGE_LABELS, APP_PAGE_ORDER, type AppPage } from './appNavigation';

type DesktopNavigationProps = {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
};

export default function DesktopNavigation({ currentPage, onPageChange }: DesktopNavigationProps) {
  return (
    <nav className="desktop-navigation app-container print:hidden" aria-label="メインナビゲーション">
      <div className="desktop-navigation__rail">
        {APP_PAGE_ORDER.map((page) => (
          <button
            key={page}
            type="button"
            className={currentPage === page ? 'desktop-navigation__button is-active' : 'desktop-navigation__button'}
            aria-current={currentPage === page ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {APP_PAGE_LABELS[page]}
          </button>
        ))}
      </div>
    </nav>
  );
}
