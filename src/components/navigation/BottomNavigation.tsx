import { APP_PAGE_LABELS, APP_PAGE_ORDER, type AppPage } from './appNavigation';

type BottomNavigationProps = {
  currentPage: AppPage;
  onPageChange: (page: AppPage) => void;
};

export default function BottomNavigation({ currentPage, onPageChange }: BottomNavigationProps) {
  return (
    <nav className="bottom-navigation print:hidden" aria-label="モバイルメインナビゲーション">
      {APP_PAGE_ORDER.map((page) => (
        <button
          key={page}
          type="button"
          className={currentPage === page ? 'bottom-navigation__button is-active' : 'bottom-navigation__button'}
          aria-current={currentPage === page ? 'page' : undefined}
          onClick={() => onPageChange(page)}
        >
          <span className="bottom-navigation__label">{APP_PAGE_LABELS[page]}</span>
        </button>
      ))}
    </nav>
  );
}
