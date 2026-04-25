import { useMemo, useState } from 'react';
import type {
  AcademicCourse,
  AcademicDashboardSnapshot,
  AcademicGpaPredictionTarget,
  Grade,
} from '../utils/academicProgress';
import { predictGpa } from '../utils/academicProgress';

interface GpaPredictionPanelProps {
  courses: AcademicCourse[];
  snapshot: AcademicDashboardSnapshot;
}

const GRADE_OPTIONS: Grade[] = ['秀', '優', '良', '可', '不可'];

export default function GpaPredictionPanel({ courses, snapshot }: GpaPredictionPanelProps) {
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [targetCourses, setTargetCourses] = useState<AcademicGpaPredictionTarget[]>([]);

  const availableCourses = useMemo(
    () => courses.filter((course) => !targetCourses.some((target) => target.courseId === course.id)),
    [courses, targetCourses],
  );

  const prediction = useMemo(
    () =>
      predictGpa({
        currentGradedCredits: snapshot.gpa.currentGradedCredits,
        currentEarnedPoints: snapshot.gpa.currentEarnedPoints,
        targetCourses,
      }),
    [snapshot.gpa.currentEarnedPoints, snapshot.gpa.currentGradedCredits, targetCourses],
  );
  const delta = prediction.predictedGpa - prediction.currentGpa;

  const addTargetCourse = () => {
    const course = courses.find((item) => item.id === selectedCourseId);
    if (!course) {
      return;
    }

    setTargetCourses((prev) => [
      ...prev,
      {
        courseId: course.id,
        title: course.title,
        credits: course.credits,
        assumedGrade: '優',
      },
    ]);
    setSelectedCourseId('');
  };

  const updateTargetGrade = (courseId: string, assumedGrade: Grade) => {
    setTargetCourses((prev) =>
      prev.map((course) => (course.courseId === courseId ? { ...course, assumedGrade } : course)),
    );
  };

  const removeTargetCourse = (courseId: string) => {
    setTargetCourses((prev) => prev.filter((course) => course.courseId !== courseId));
  };

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <h2>GPA予測</h2>
        <span className="small">選択した科目の想定成績で試算</span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div className="stats-card">
          <div className="stats-label">現在GPA</div>
          <div className="stats-value">{prediction.currentGpa.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">予測GPA</div>
          <div className="stats-value">{prediction.predictedGpa.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">変化</div>
          <div className={`stats-value ${delta >= 0 ? 'stats-complete' : ''}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</div>
        </div>
        <div className="stats-card">
          <div className="stats-label">追加対象単位</div>
          <div className="stats-value">{prediction.addedCredits} 単位</div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div
          style={{
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--stroke)',
            background: 'var(--bg)',
            color: 'var(--muted)',
          }}
        >
          科目一覧CSVを読み込むと、ここで予測候補を選べます。
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              gap: '0.75rem',
              alignItems: 'end',
              marginBottom: '1rem',
            }}
          >
            <label style={{ display: 'grid', gap: '0.4rem' }}>
              <span style={{ fontSize: '0.9rem', color: 'var(--muted)', fontWeight: 600 }}>追加する科目</span>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.8rem',
                  border: '1px solid var(--stroke)',
                  borderRadius: '12px',
                  background: 'var(--card)',
                  color: 'var(--text)',
                }}
              >
                <option value="">科目を選択してください</option>
                {availableCourses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title} ({course.credits}単位 / {course.category})
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={addTargetCourse}
              disabled={!selectedCourseId}
              className="btn-primary"
              style={{ height: 'fit-content' }}
            >
              追加
            </button>
          </div>

          {targetCourses.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {targetCourses.map((course) => (
                <div
                  key={course.courseId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 140px auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                    padding: '0.85rem 1rem',
                    border: '1px solid var(--stroke)',
                    borderRadius: '12px',
                    background: 'var(--bg)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{course.title}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{course.credits} 単位</div>
                  </div>
                  <label style={{ display: 'grid', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 600 }}>想定成績</span>
                    <select
                      value={course.assumedGrade}
                      onChange={(e) => updateTargetGrade(course.courseId, e.target.value as Grade)}
                      style={{
                        padding: '0.6rem 0.7rem',
                        border: '1px solid var(--stroke)',
                        borderRadius: '10px',
                        background: 'var(--card)',
                        color: 'var(--text)',
                      }}
                    >
                      {GRADE_OPTIONS.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="btn-ghost" onClick={() => removeTargetCourse(course.courseId)}>
                    削除
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                padding: '1rem',
                borderRadius: '12px',
                border: '1px dashed var(--stroke)',
                background: 'color-mix(in oklab, var(--card) 96%, transparent)',
                color: 'var(--muted)',
              }}
            >
              科目を追加すると、予測GPAが表示されます。
            </div>
          )}
        </>
      )}
    </section>
  );
}
