import { useEffect, useRef, useState } from 'react';
import type { AcademicCourse, AcademicCourseCell } from '../core/types';
import CourseSearchPanel from './courses/CourseSearchPanel';
import OfficialOfferingPicker from './OfficialOfferingPicker';
import type { AcademicQuarter } from '../utils/academicProgress';

export default function CourseEditor({ initial, day, periodId, onSave, onClear, onClose, courses, canDelete, departmentId, quarter }: {
  departmentId: string; quarter: AcademicQuarter;
  initial: AcademicCourseCell | null; day: string; periodId: number;
  onSave: (course: AcademicCourseCell) => void; onClear: () => void; onClose: () => void; courses: AcademicCourse[];
  canDelete: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<AcademicCourseCell>(initial ?? { title: '', courseType: 'unknown' });
  const [credits, setCredits] = useState(initial?.credits?.toString() ?? '');
  const [searchOpen, setSearchOpen] = useState(!initial?.title);
  function changeCourse(title: string, course?: AcademicCourse) {
    setDraft({ title, courseId: course?.id, courseType: course?.courseType ?? 'unknown', grade: '未履修' });
    setCredits(course ? String(course.credits) : '');
  }
  useEffect(() => { const element = dialog.current!; element.showModal(); element.querySelector('input')?.focus(); return () => element.close(); }, []);
  const validCredits = credits === '' || (Number.isFinite(Number(credits)) && Number(credits) > 0 && Number(credits) <= 20);
  return <dialog ref={dialog} className="course-editor" onCancel={onClose} aria-labelledby="editor-title">
    <form onSubmit={event => { event.preventDefault(); if (draft.title.trim() && validCredits) onSave({ ...draft, title: draft.title.trim(), credits: credits === '' ? undefined : Number(credits) }); }}>
      <header><div><p className="eyebrow">{day}曜日 · {periodId}限</p><h2 id="editor-title">授業を登録・編集</h2></div><button type="button" className="btn-ghost" aria-label="閉じる" onClick={onClose}>×</button></header>
      <div className="course-editor__body">
        <label>科目名 <span className="small">必須</span><input autoFocus value={draft.title} onChange={e => changeCourse(e.target.value)} required placeholder="科目名を入力、または一覧から選ぶ" /></label>
        <button type="button" className="text-action" onClick={() => setSearchOpen(!searchOpen)}>{searchOpen ? '科目一覧を閉じる' : '科目一覧から選び直す'}</button>
        {searchOpen && <CourseSearchPanel courses={courses} onAdd={course => { changeCourse(course.title, course); setSearchOpen(false); }} />}
        {draft.title && <OfficialOfferingPicker title={draft.title} departmentId={departmentId} day={day} period={periodId} quarter={quarter} onSelect={offering => setDraft({ ...draft, teacher: offering.teacher, room: offering.room, offeringId: offering.id, lectureCode: offering.lectureCode, term: offering.term, target: offering.target, remarks: offering.remarks, sourceOffering: offering, scheduleDay: offering.day, schedulePeriod: offering.period })} />}
        <div className="editor-fields"><label>単位数<input type="number" min="0.5" max="20" step="0.5" value={credits} onChange={e => setCredits(e.target.value)} placeholder="例：2" /></label><label>教室<input value={draft.room ?? ''} onChange={e => setDraft({ ...draft, room: e.target.value })} placeholder="例：12A" /></label></div>
        {!validCredits && <p role="alert">単位数は0より大きく20以下で入力してください。</p>}
        <details><summary>教員・メモなどを入力</summary><label>担当教員<input value={draft.teacher ?? ''} onChange={e => setDraft({ ...draft, teacher: e.target.value })} /></label><label>メモ<textarea value={draft.memo ?? ''} onChange={e => setDraft({ ...draft, memo: e.target.value })} rows={3} /></label></details>
        <p className="student-note">ここでの保存は個人用の記録です。大学への履修登録は別途行ってください。</p>
      </div>
      <footer>{canDelete && <button type="button" className="text-action editor-delete" onClick={onClear}>この授業を削除</button>}<button type="button" className="btn-ghost" onClick={onClose}>キャンセル</button><button className="btn-primary" type="submit" disabled={!draft.title.trim() || !validCredits}>時間割に保存</button></footer>
    </form>
  </dialog>;
}
