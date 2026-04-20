import React, { useState } from 'react';
import { parseCSVFile, parseCreditRequirements, parseCourses } from '../utils/csvImporter';
import type { CourseRow, CreditRequirementRow } from '../utils/csvImporter';
import type { AcademicCourse } from '../utils/academicProgress';

interface CSVImporterProps {
  onImportCurriculum: (data: { requiredCredits: number; breakdown: { required: number; electiveRequired: number; elective: number }; name: string }) => void;
  onImportCourses: (courses: AcademicCourse[]) => void;
}

export default function CSVImporter({ onImportCurriculum, onImportCourses }: CSVImporterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<{
    requirements?: File;
    timetable?: File;
  }>({});

  const handleRequirementsFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, requirements: file }));
    }
  };

  const handleTimetableFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFiles(prev => ({ ...prev, timetable: file }));
    }
  };

  const handleImportRequirements = async () => {
    if (!selectedFiles.requirements) {
      alert('卒業要件CSVファイルを選択してください');
      return;
    }

    try {
      console.log('🔄 Starting requirements import...', selectedFiles.requirements.name);
      const rows = await parseCSVFile<CreditRequirementRow>(selectedFiles.requirements);
      console.log('📄 Parsed requirement rows:', rows.length);
      const curriculum = parseCreditRequirements(rows);
      console.log('✅ Parsed curriculum:', curriculum);
      
      onImportCurriculum({
        ...curriculum,
        name: departmentName || '選択された学科'
      });
      
      alert('卒業要件の読み込みが完了しました！');
      setIsOpen(false); // 成功したらモーダルを閉じる
    } catch (error) {
      console.error('❌ Error importing requirements:', error);
      alert('卒業要件の読み込みに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleImportTimetable = async () => {
    if (!selectedFiles.timetable) {
      alert('時間割CSVファイルを選択してください');
      return;
    }

    try {
      console.log('🔄 Starting timetable import...', selectedFiles.timetable.name);
      const rows = await parseCSVFile<CourseRow>(selectedFiles.timetable);
      console.log('📄 Parsed rows:', rows.length, 'Sample:', rows.slice(0, 2));
      const courses = parseCourses(rows);
      console.log('✅ Parsed courses:', courses.length, 'Sample:', courses.slice(0, 2));
      
      if (courses.length === 0) {
        alert('科目データが見つかりませんでした。CSVファイルの形式を確認してください。');
        return;
      }
      
      console.log('📤 Calling onImportCourses with', courses.length, 'courses');
      onImportCourses(courses);
      
      alert(`${courses.length}件の科目を読み込みました！`);
      setIsOpen(false); // 成功したらモーダルを閉じる
    } catch (error) {
      console.error('❌ Error importing timetable:', error);
      alert('時間割の読み込みに失敗しました: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const handleImportAll = async () => {
    if (!selectedFiles.requirements || !selectedFiles.timetable) {
      alert('両方のCSVファイルを選択してください');
      return;
    }

    try {
      console.log('🔄 Starting import all...');
      await handleImportRequirements();
      await handleImportTimetable();
      console.log('✅ All imports completed');
    } catch (error) {
      console.error('❌ Error in import all:', error);
    }
  };

  return (
    <>
      <button 
        type="button" 
        onClick={() => setIsOpen(true)} 
        className="btn-ghost"
      >
        📁 CSV読込
      </button>

      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>CSVファイルから読み込み</h2>
              <button 
                className="modal-close" 
                onClick={() => setIsOpen(false)}
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  学科名（任意）
                </label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="例: 電気電子通信工学科"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid var(--stroke)',
                    borderRadius: '4px'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  📋 卒業要件CSV (*_credit_requirements.csv)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleRequirementsFileChange}
                  style={{ width: '100%' }}
                />
                {selectedFiles.requirements && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    選択: {selectedFiles.requirements.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleImportRequirements}
                  disabled={!selectedFiles.requirements}
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                >
                  卒業要件のみ読み込む
                </button>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                  📚 科目一覧CSV (*_timetable_by_category.csv)
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleTimetableFileChange}
                  style={{ width: '100%' }}
                />
                {selectedFiles.timetable && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    選択: {selectedFiles.timetable.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleImportTimetable}
                  disabled={!selectedFiles.timetable}
                  className="btn-primary"
                  style={{ marginTop: '0.5rem', width: '100%' }}
                >
                  科目一覧のみ読み込む
                </button>
              </div>

              <div style={{ 
                borderTop: '1px solid var(--stroke)', 
                paddingTop: '1rem',
                marginTop: '1.5rem'
              }}>
                <button
                  type="button"
                  onClick={handleImportAll}
                  disabled={!selectedFiles.requirements || !selectedFiles.timetable}
                  className="btn-primary"
                  style={{ width: '100%', padding: '0.75rem' }}
                >
                  両方まとめて読み込む
                </button>
              </div>

              <div style={{ 
                marginTop: '1rem', 
                padding: '0.75rem', 
                backgroundColor: 'var(--bg-alt)', 
                borderRadius: '4px',
                fontSize: '0.85rem',
                color: 'var(--text-secondary)'
              }}>
                <strong>💡 ヒント:</strong>
                <ul style={{ margin: '0.5rem 0 0 1.25rem', padding: 0 }}>
                  <li>departmentフォルダ内のCSVファイルを選択してください</li>
                  <li>例: department/rikou/denki_credit_requirements.csv</li>
                  <li>例: department/rikou/denki_timetable_by_category.csv</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
