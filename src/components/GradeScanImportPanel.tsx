import { useMemo, useState } from 'react';
import { parseScannedGradeText, type ScannedGradeCandidate } from '../utils/gradeImport';

const GRADE_OPTIONS = ['秀', '優', '良', '可', '不可', '未履修'] as const;

const STORAGE_KEY = 'grade_scan_candidates_v1';

function loadStoredCandidates(): ScannedGradeCandidate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as ScannedGradeCandidate[]) : [];
  } catch {
    return [];
  }
}

function saveStoredCandidates(candidates: ScannedGradeCandidate[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(candidates));
}

export default function GradeScanImportPanel() {
  const [inputText, setInputText] = useState('');
  const [candidates, setCandidates] = useState<ScannedGradeCandidate[]>(() => loadStoredCandidates());

  const reviewCount = useMemo(() => candidates.filter((candidate) => candidate.needsReview).length, [candidates]);

  const handleParse = () => {
    const parsed = parseScannedGradeText(inputText);
    setCandidates(parsed);
  };

  const updateCandidate = (id: string, updater: (candidate: ScannedGradeCandidate) => ScannedGradeCandidate) => {
    setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? updater(candidate) : candidate)));
  };

  const handleSave = () => {
    saveStoredCandidates(candidates);
  };

  return (
    <section className="tt-card" style={{ marginTop: '1.5rem' }}>
      <div className="section-title">
        <div>
          <h2>成績スキャン入力</h2>
          <span className="small">CSV やテキストを貼り付けて確認できます</span>
        </div>
        <span className="course-tag" style={{ fontWeight: 800 }}>
          {reviewCount} 件要確認
        </span>
      </div>

      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <label className="settings-field">
          <span>貼り付け入力</span>
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="例: 電気回路基礎,2,優,0.95"
          />
        </label>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button type="button" className="btn-primary" onClick={handleParse} disabled={!inputText.trim()}>
            解析
          </button>
          <button type="button" className="btn-ghost" onClick={handleSave} disabled={candidates.length === 0}>
            保存
          </button>
        </div>

        {candidates.length === 0 ? (
          <div className="warning-panel__empty">成績テキストを貼り付けると確認テーブルが表示されます。</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tt-table" style={{ minWidth: '720px' }}>
              <thead>
                <tr>
                  <th>科目名</th>
                  <th>単位</th>
                  <th>成績</th>
                  <th>信頼度</th>
                  <th>状態</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((candidate) => (
                  <tr key={candidate.id}>
                    <td>
                      <input
                        value={candidate.courseName}
                        onChange={(e) => updateCandidate(candidate.id, (current) => ({ ...current, courseName: e.target.value }))}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={candidate.credits ?? ''}
                        onChange={(e) => updateCandidate(candidate.id, (current) => ({ ...current, credits: e.target.value ? Number(e.target.value) : undefined }))}
                      />
                    </td>
                    <td>
                      <select
                        value={candidate.grade ?? ''}
                        onChange={(e) => updateCandidate(candidate.id, (current) => ({ ...current, grade: e.target.value ? (e.target.value as ScannedGradeCandidate['grade']) : undefined }))}
                      >
                        <option value="">未選択</option>
                        {GRADE_OPTIONS.map((grade) => (
                          <option key={grade} value={grade}>{grade}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="number"
                        min="0"
                        max="1"
                        step="0.01"
                        value={candidate.confidence ?? ''}
                        onChange={(e) => updateCandidate(candidate.id, (current) => ({ ...current, confidence: e.target.value ? Number(e.target.value) : undefined }))}
                      />
                    </td>
                    <td>
                      <label className="calendar-export-panel__toggle">
                        <input
                          type="checkbox"
                          checked={candidate.needsReview}
                          onChange={(e) => updateCandidate(candidate.id, (current) => ({ ...current, needsReview: e.target.checked }))}
                        />
                        <span>{candidate.needsReview ? '要確認' : '確認済み'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}