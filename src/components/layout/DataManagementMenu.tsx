import type { ComponentProps } from 'react';
import CSVImporter from '../CSVImporter';

type DataManagementMenuProps = {
  onExportJson: () => void;
  onImportJson: (file: File) => void;
  onExportIcs: () => void;
  onPrint: () => void;
  onOpenCsvImporter?: () => void;
  onClearLocalStorage?: () => void;
  onImportCurriculum: ComponentProps<typeof CSVImporter>['onImportCurriculum'];
  onImportCourses: ComponentProps<typeof CSVImporter>['onImportCourses'];
};

export default function DataManagementMenu({
  onExportJson,
  onImportJson,
  onExportIcs,
  onPrint,
  onClearLocalStorage,
  onImportCurriculum,
  onImportCourses,
}: DataManagementMenuProps) {
  return (
    <details className="data-menu">
      <summary className="data-menu__summary">データ管理</summary>
      <div className="data-menu__panel">
        <div className="data-menu__group">
          <CSVImporter onImportCurriculum={onImportCurriculum} onImportCourses={onImportCourses} />
        </div>
        <div className="data-menu__group">
          <button type="button" className="menu-action" onClick={onExportJson}>JSON保存</button>
          <label className="menu-action menu-action--file">
            JSON読込
            <input
              type="file"
              accept="application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onImportJson(file);
                e.currentTarget.value = '';
              }}
            />
          </label>
          <button type="button" className="menu-action" onClick={onExportIcs}>ICS出力</button>
          <button type="button" className="menu-action" onClick={onPrint}>印刷</button>
          {onClearLocalStorage && (
            <button type="button" className="menu-action menu-action--danger" onClick={onClearLocalStorage}>
              LocalStorage初期化
            </button>
          )}
        </div>
      </div>
    </details>
  );
}