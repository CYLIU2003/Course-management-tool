import type { AcademicAllYearsData, AcademicCourse, AcademicDashboardSnapshot, AcademicSettings, AcademicYear } from '../utils/academicProgress';
import AcademicOverview from './AcademicOverview';
import GpaSummaryPanel from './GpaSummaryPanel';
import CreditCompletionPanel from './CreditCompletionPanel';
import TargetGpaPanel from './TargetGpaPanel';
import GraduationRequirementPanel from './GraduationRequirementPanel';
import GpaPredictionPanel from './GpaPredictionPanel';
import GradeScanImportPanel from './GradeScanImportPanel';
import LearningLoadMemoPanel from './LearningLoadMemoPanel';

interface GradeManagementProps {
  settings: AcademicSettings;
  snapshot: AcademicDashboardSnapshot;
  importedCourses: AcademicCourse[];
  allYearsData: AcademicAllYearsData;
  currentYear: AcademicYear;
  onBack: () => void;
}

export default function GradeManagement({
  settings,
  snapshot,
  importedCourses,
  allYearsData,
  currentYear,
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
      </div>

      <AcademicOverview
        snapshot={snapshot}
        curriculumName={settings.curriculum?.name}
        allYearsData={allYearsData}
        courses={importedCourses}
        currentYear={currentYear}
        curriculum={settings.curriculum}
      />

      <GraduationRequirementPanel
        curriculum={settings.curriculum}
        allYearsData={allYearsData}
        courses={importedCourses}
        currentYear={currentYear}
      />

      <GpaSummaryPanel snapshot={snapshot} allYearsData={allYearsData} />

      <CreditCompletionPanel snapshot={snapshot} allYearsData={allYearsData} />

      <TargetGpaPanel
        snapshot={snapshot}
        defaultFutureCredits={Math.max(0, snapshot.requiredCredits - snapshot.earnedCredits)}
      />

      <GpaPredictionPanel courses={importedCourses} snapshot={snapshot} />

      <GradeScanImportPanel />

      <LearningLoadMemoPanel courses={importedCourses} />

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
