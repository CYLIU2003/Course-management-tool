import type { AcademicCourse, AcademicDashboardSnapshot, AcademicSettings } from '../utils/academicProgress';
import GpaPredictionPanel from './GpaPredictionPanel';
import DashboardCards from './dashboard/DashboardCards';
import WarningPanel from './dashboard/WarningPanel';

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
    <section className="grade-page">
      <div className="tt-card">
        <div className="section-title">
          <h2>📊 成績・単位管理</h2>
          <button type="button" onClick={onBack} className="btn-ghost">
            ← 時間割に戻る
          </button>
        </div>
        <DashboardCards snapshot={snapshot} curriculumName={settings.curriculum?.name} />
        <WarningPanel warnings={snapshot.warnings} />
      </div>

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
    </section>
  );
}
