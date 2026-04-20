import type { AcademicCourse, AcademicDashboardSnapshot, AcademicSettings } from '../utils/academicProgress';
import AcademicOverview from './AcademicOverview';
import GpaPredictionPanel from './GpaPredictionPanel';

interface GradeManagementProps {
  settings: AcademicSettings;
  snapshot: AcademicDashboardSnapshot;
  importedCourses: AcademicCourse[];
  onBack: () => void;
}

export default function GradeManagement({
  settings,
  snapshot,
  importedCourses,
  onBack,
}: GradeManagementProps) {
  return (
    <div className="tcu-tt">
      <header className="tt-toolbar print:hidden">
        <div className="container tt-toolbar__inner">
          <button type="button" onClick={onBack} className="btn-ghost" style={{ marginRight: 'auto' }}>
            ← 時間割に戻る
          </button>
          <h1 className="tt-title">📊 成績・単位管理</h1>
        </div>
      </header>

      <main className="container">
        <AcademicOverview
          snapshot={snapshot}
          curriculumName={settings.curriculum?.name}
          title="履修状況・警告"
        />

        <GpaPredictionPanel courses={importedCourses} snapshot={snapshot} />

        <section className="tt-card" style={{ marginTop: '1.5rem' }}>
          <div className="section-title">
            <h2>📝 成績入力のヒント</h2>
          </div>
          <div style={{ padding: '1rem' }}>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', lineHeight: '1.8' }}>
              <li>時間割ページで各科目をクリックして成績を入力できます</li>
              <li>成績：秀(4.0), 優(3.0), 良(2.0), 可(1.0), 不可(0.0)</li>
              <li>科目区分：必修、選択必修、選択を設定してください</li>
              <li>単位数を正しく入力することでGPAと単位数が自動計算されます</li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
