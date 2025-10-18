import { useMemo } from 'react';

type Grade = "秀" | "優" | "良" | "可" | "不可" | "未履修";
type CourseType = "required" | "elective-required" | "elective";

type CourseCell = {
  title: string;
  room?: string;
  teacher?: string;
  color?: string;
  memo?: string;
  credits?: number;
  grade?: Grade;
  courseType?: CourseType;
} | null;

type Timetable = {
  [quarter: string]: {
    [day: string]: {
      [periodId: string]: CourseCell;
    };
  };
};

type CurriculumTemplate = {
  name: string;
  requiredCredits: number;
  breakdown: {
    required: number;
    electiveRequired: number;
    elective: number;
  };
};

type Settings = {
  requiredCredits: number;
  curriculum?: CurriculumTemplate;
};

interface GradeManagementProps {
  data: Timetable;
  settings: Settings;
  onBack: () => void;
}

const QUARTERS = ["1Q", "2Q", "3Q", "4Q"] as const;

function getGradePoint(grade?: Grade): number {
  switch (grade) {
    case "秀": return 4.0;
    case "優": return 3.0;
    case "良": return 2.0;
    case "可": return 1.0;
    case "不可": return 0.0;
    default: return 0.0;
  }
}

function calculateGPAAndCredits(data: Timetable) {
  let totalCredits = 0;
  let totalGradePoints = 0;
  let gradeCount = 0;
  
  const creditsByType = {
    required: 0,
    electiveRequired: 0,
    elective: 0,
  };

  for (const quarter of QUARTERS) {
    const quarterData = data[quarter];
    if (!quarterData) continue;

    for (const day of Object.keys(quarterData)) {
      for (const periodId of Object.keys(quarterData[day])) {
        const cell = quarterData[day][periodId];
        if (!cell || !cell.title) continue;

        const credits = cell.credits || 0;
        const grade = cell.grade;
        const courseType = cell.courseType || "elective";

        if (grade && grade !== "未履修" && credits > 0) {
          if (grade !== "不可") {
            totalCredits += credits;
            if (courseType === "required") {
              creditsByType.required += credits;
            } else if (courseType === "elective-required") {
              creditsByType.electiveRequired += credits;
            } else {
              creditsByType.elective += credits;
            }
          }
          totalGradePoints += getGradePoint(grade) * credits;
          gradeCount += credits;
        }
      }
    }
  }

  const gpa = gradeCount > 0 ? totalGradePoints / gradeCount : 0;
  return { gpa, totalCredits, creditsByType };
}

export default function GradeManagement({ data, settings, onBack }: GradeManagementProps) {
  const { gpa, totalCredits, creditsByType } = useMemo(() => calculateGPAAndCredits(data), [data]);
  const remainingCredits = settings.requiredCredits - totalCredits;
  
  const breakdown = settings.curriculum ? {
    required: Math.max(0, settings.curriculum.breakdown.required - creditsByType.required),
    electiveRequired: Math.max(0, settings.curriculum.breakdown.electiveRequired - creditsByType.electiveRequired),
    elective: Math.max(0, settings.curriculum.breakdown.elective - creditsByType.elective),
  } : null;

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
        <section className="tt-card" style={{ marginTop: "1.5rem" }}>
          <div className="section-title">
            <h2>📊 成績・単位情報</h2>
            {settings.curriculum && (
              <span className="small">({settings.curriculum.name})</span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", padding: "1rem" }}>
            <div className="stats-card">
              <div className="stats-label">取得単位数</div>
              <div className="stats-value">{totalCredits} 単位</div>
            </div>
            <div className="stats-card">
              <div className="stats-label">必要単位数</div>
              <div className="stats-value">{settings.requiredCredits} 単位</div>
            </div>
            <div className="stats-card">
              <div className="stats-label">残り必要単位数</div>
              <div className={`stats-value ${remainingCredits <= 0 ? "stats-complete" : ""}`}>
                {remainingCredits > 0 ? `${remainingCredits} 単位` : "達成！"}
              </div>
            </div>
            <div className="stats-card">
              <div className="stats-label">GPA</div>
              <div className="stats-value">{gpa.toFixed(2)}</div>
            </div>
          </div>
          
          {settings.curriculum && breakdown && (
            <div style={{ padding: "1rem", borderTop: "1px solid var(--stroke)" }}>
              <h3 style={{ fontSize: "0.95rem", marginBottom: "0.75rem", color: "var(--text)" }}>
                📚 科目区分別の進捗状況
              </h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.75rem" }}>
                <div className="breakdown-item">
                  <span className="breakdown-label">必修科目</span>
                  <span className="breakdown-value">
                    {creditsByType.required} / {settings.curriculum.breakdown.required} 単位
                    {breakdown.required > 0 && (
                      <span className="breakdown-remaining"> (残り {breakdown.required})</span>
                    )}
                  </span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">選択必修科目</span>
                  <span className="breakdown-value">
                    {creditsByType.electiveRequired} / {settings.curriculum.breakdown.electiveRequired} 単位
                    {breakdown.electiveRequired > 0 && (
                      <span className="breakdown-remaining"> (残り {breakdown.electiveRequired})</span>
                    )}
                  </span>
                </div>
                <div className="breakdown-item">
                  <span className="breakdown-label">選択科目</span>
                  <span className="breakdown-value">
                    {creditsByType.elective} / {settings.curriculum.breakdown.elective} 単位
                    {breakdown.elective > 0 && (
                      <span className="breakdown-remaining"> (残り {breakdown.elective})</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="tt-card" style={{ marginTop: "1.5rem" }}>
          <div className="section-title">
            <h2>📝 成績入力のヒント</h2>
          </div>
          <div style={{ padding: "1rem" }}>
            <ul style={{ margin: 0, paddingLeft: "1.5rem", lineHeight: "1.8" }}>
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
