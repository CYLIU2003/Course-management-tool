import { useEffect, useMemo, useState } from 'react';
import type { AcademicCourse } from '../utils/academicProgress';
import { loadLearningLoadMemos, saveLearningLoadMemos, type AssignmentFrequency, type ExamType, type LearningLoadMemo } from '../utils/learningLoad';

type LearningLoadMemoPanelProps = {
  courses: AcademicCourse[];
};

const FREQUENCY_LABELS: Record<AssignmentFrequency, string> = {
  none: 'なし',
  low: '少ない',
  medium: '中程度',
  high: '多い',
};

const EXAM_LABELS: Record<ExamType, string> = {
  none: 'なし',
  written: '筆記',
  report: 'レポート',
  presentation: '発表',
  practical: '実技',
  other: 'その他',
};

export default function LearningLoadMemoPanel({ courses }: LearningLoadMemoPanelProps) {
  const [memos, setMemos] = useState<LearningLoadMemo[]>(() => loadLearningLoadMemos());
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [weeklyPreparationHours, setWeeklyPreparationHours] = useState('');
  const [weeklyReviewHours, setWeeklyReviewHours] = useState('');
  const [assignmentFrequency, setAssignmentFrequency] = useState<AssignmentFrequency>('none');
  const [reportRequired, setReportRequired] = useState(false);
  const [examType, setExamType] = useState<ExamType>('none');
  const [attendanceCheck, setAttendanceCheck] = useState(false);
  const [note, setNote] = useState('');

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  const memoMap = useMemo(
    () => new Map(memos.map((memo) => [memo.courseId, memo] as const)),
    [memos],
  );

  useEffect(() => {
    const memo = memoMap.get(selectedCourseId);
    if (!memo) {
      setWeeklyPreparationHours('');
      setWeeklyReviewHours('');
      setAssignmentFrequency('none');
      setReportRequired(false);
      setExamType('none');
      setAttendanceCheck(false);
      setNote('');
      return;
    }

    setWeeklyPreparationHours(memo.weeklyPreparationHours?.toString() ?? '');
    setWeeklyReviewHours(memo.weeklyReviewHours?.toString() ?? '');
    setAssignmentFrequency(memo.assignmentFrequency ?? 'none');
    setReportRequired(memo.reportRequired ?? false);
    setExamType(memo.examType ?? 'none');
    setAttendanceCheck(memo.attendanceCheck ?? false);
    setNote(memo.note ?? '');
  }, [memoMap, selectedCourseId]);

  useEffect(() => {
    saveLearningLoadMemos(memos);
  }, [memos]);

  const handleSave = () => {
    if (!selectedCourse) {
      return;
    }

    const nextMemo: LearningLoadMemo = {
      courseId: selectedCourse.id,
      courseName: selectedCourse.title,
      weeklyPreparationHours: weeklyPreparationHours ? Number(weeklyPreparationHours) : undefined,
      weeklyReviewHours: weeklyReviewHours ? Number(weeklyReviewHours) : undefined,
      assignmentFrequency,
      reportRequired,
      examType,
      attendanceCheck,
      note: note.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };

    setMemos((prev) => {
      const filtered = prev.filter((memo) => memo.courseId !== nextMemo.courseId);
      return [nextMemo, ...filtered];
    });
  };

  const handleDelete = () => {
    if (!selectedCourseId) {
      return;
    }

    setMemos((prev) => prev.filter((memo) => memo.courseId !== selectedCourseId));
  };

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>学習負荷メモ</h2>
          <span className="small">事実ベースの記録だけを残します</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          {memos.length} 件保存
        </span>
      </div>

      {courses.length === 0 ? (
        <div className="warning-panel__empty">科目一覧CSVを読み込むと、科目ごとの学習負荷メモを保存できます。</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
              gap: '0.9rem',
            }}
          >
            <label className="settings-field">
              <span>科目</span>
              <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)}>
                <option value="">科目を選択してください</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>

            <div className="stats-card">
              <div className="stats-label">登録中の科目</div>
              <div className="stats-value">{selectedCourse ? selectedCourse.title : '未選択'}</div>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
              gap: '0.85rem',
              marginTop: '1rem',
            }}
          >
            <label className="settings-field">
              <span>予習時間（週）</span>
              <input type="number" min="0" step="0.5" value={weeklyPreparationHours} onChange={(e) => setWeeklyPreparationHours(e.target.value)} />
            </label>
            <label className="settings-field">
              <span>復習時間（週）</span>
              <input type="number" min="0" step="0.5" value={weeklyReviewHours} onChange={(e) => setWeeklyReviewHours(e.target.value)} />
            </label>
            <label className="settings-field">
              <span>課題頻度</span>
              <select value={assignmentFrequency} onChange={(e) => setAssignmentFrequency(e.target.value as AssignmentFrequency)}>
                {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="settings-field">
              <span>試験形式</span>
              <select value={examType} onChange={(e) => setExamType(e.target.value as ExamType)}>
                {Object.entries(EXAM_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="calendar-export-panel__toggle">
              <input type="checkbox" checked={reportRequired} onChange={(e) => setReportRequired(e.target.checked)} />
              <span>レポート有無</span>
            </label>
            <label className="calendar-export-panel__toggle">
              <input type="checkbox" checked={attendanceCheck} onChange={(e) => setAttendanceCheck(e.target.checked)} />
              <span>出席確認有無</span>
            </label>
          </div>

          <label className="settings-field" style={{ marginTop: '1rem' }}>
            <span>自由メモ</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="学習負荷に関する事実ベースのメモを記録します" />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={!selectedCourseId}>
              保存
            </button>
            <button type="button" className="btn-ghost" onClick={handleDelete} disabled={!memoMap.has(selectedCourseId)}>
              削除
            </button>
          </div>

          <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
            {memos.length === 0 ? (
              <div className="warning-panel__empty">保存済みのメモはありません。</div>
            ) : (
              memos.map((memo) => (
                <article key={memo.courseId} className="warning-panel__item is-info">
                  <div style={{ minWidth: '9rem', fontWeight: 800 }}>{memo.courseName}</div>
                  <div style={{ flex: 1 }}>
                    <p className="warning-panel__message">
                      予習 {memo.weeklyPreparationHours ?? '-'} 時間 / 復習 {memo.weeklyReviewHours ?? '-'} 時間
                    </p>
                    <p className="warning-panel__detail">
                      課題 {memo.assignmentFrequency ? FREQUENCY_LABELS[memo.assignmentFrequency] : '未設定'} / 試験 {memo.examType ? EXAM_LABELS[memo.examType] : '未設定'} / レポート {memo.reportRequired ? 'あり' : 'なし'} / 出席確認 {memo.attendanceCheck ? 'あり' : 'なし'}
                    </p>
                    {memo.note && <p className="warning-panel__detail">{memo.note}</p>}
                  </div>
                  <div className="small" style={{ whiteSpace: 'nowrap' }}>{new Date(memo.updatedAt).toLocaleDateString('ja-JP')}</div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}