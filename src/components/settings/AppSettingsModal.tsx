import { useEffect, useMemo, useState } from 'react';

export type QuarterKey = '1Q' | '2Q' | '3Q' | '4Q';
export type QuarterRanges = Record<QuarterKey, { start: string; end: string }>;
export type EditablePeriod = { id: number; label: string; time: string };
export type EditableSettings = {
  title: string;
  showTime: boolean;
  days: string[];
  periods: EditablePeriod[];
  requiredCredits: number;
};

type AppSettingsModalProps = {
  open: boolean;
  settings: EditableSettings;
  quarterRanges: QuarterRanges;
  curriculumName?: string;
  onClose: () => void;
  onSave: (next: { settings: EditableSettings; quarterRanges: QuarterRanges }) => void;
  onResetLocalStorage: () => void;
};

const QUARTERS: QuarterKey[] = ['1Q', '2Q', '3Q', '4Q'];

function formatPeriods(periods: EditablePeriod[]) {
  return periods.map((period) => `${period.label} ${period.time}`.trim()).join('\n');
}

function parsePeriods(text: string): EditablePeriod[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed = lines.map((line, index) => {
    const match = line.match(/^(\S+)(?:\s+(.+))?$/);
    if (!match) {
      return { id: index + 1, label: `${index + 1}限`, time: '' };
    }

    return {
      id: index + 1,
      label: match[1],
      time: match[2] ?? '',
    };
  });

  return parsed.length > 0 ? parsed : [{ id: 1, label: '1限', time: '' }];
}

function cloneQuarterRanges(input: QuarterRanges): QuarterRanges {
  return {
    '1Q': { ...input['1Q'] },
    '2Q': { ...input['2Q'] },
    '3Q': { ...input['3Q'] },
    '4Q': { ...input['4Q'] },
  };
}

function isValidDate(value: string) {
  return !value || !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

export default function AppSettingsModal({
  open,
  settings,
  quarterRanges,
  curriculumName,
  onClose,
  onSave,
  onResetLocalStorage,
}: AppSettingsModalProps) {
  const [title, setTitle] = useState(settings.title);
  const [showTime, setShowTime] = useState(settings.showTime);
  const [daysText, setDaysText] = useState(settings.days.join(','));
  const [periodsText, setPeriodsText] = useState(formatPeriods(settings.periods));
  const [requiredCredits, setRequiredCredits] = useState(String(settings.requiredCredits));
  const [ranges, setRanges] = useState<QuarterRanges>(() => cloneQuarterRanges(quarterRanges));

  useEffect(() => {
    if (!open) return;
    setTitle(settings.title);
    setShowTime(settings.showTime);
    setDaysText(settings.days.join(','));
    setPeriodsText(formatPeriods(settings.periods));
    setRequiredCredits(String(settings.requiredCredits));
    setRanges(cloneQuarterRanges(quarterRanges));
  }, [open, settings, quarterRanges]);

  const parsedDays = useMemo(() => {
    return daysText
      .split(',')
      .map((day) => day.trim())
      .filter(Boolean);
  }, [daysText]);

  const handleSave = () => {
    for (const quarter of QUARTERS) {
      const range = ranges[quarter];
      if (range.start && range.end) {
        const start = new Date(`${range.start}T00:00:00`);
        const end = new Date(`${range.end}T00:00:00`);
        if (start > end) {
          alert(`${quarter} の開始日が終了日より後です。`);
          return;
        }
      }
      if (!isValidDate(range.start) || !isValidDate(range.end)) {
        alert(`${quarter} の日付が不正です。`);
        return;
      }
    }

    onSave({
      settings: {
        title: title.trim() || '時間割',
        showTime,
        days: parsedDays.length > 0 ? parsedDays : settings.days,
        periods: parsePeriods(periodsText),
        requiredCredits: Number.isFinite(Number(requiredCredits)) ? Number(requiredCredits) : settings.requiredCredits,
      },
      quarterRanges: cloneQuarterRanges(ranges),
    });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="tt-modal">
      <div className="tt-dialog settings-modal">
        <div className="tt-dialog__head">
          <h2>設定</h2>
          <button type="button" onClick={onClose} className="tt-close" aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="tt-dialog__body">
          <div className="settings-modal__intro">
            <p className="small">曜日・時限・クォーター期間をここで編集できます。ICS 出力には各クォーター期間の設定が必要です。</p>
            {curriculumName && <p className="small">現在のカリキュラム: <strong>{curriculumName}</strong></p>}
          </div>

          <div className="settings-modal__grid">
            <label className="settings-field">
              <span>タイトル</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label className="settings-field settings-field--inline">
              <span>時刻表示</span>
              <input type="checkbox" checked={showTime} onChange={(e) => setShowTime(e.target.checked)} />
            </label>
            <label className="settings-field settings-field--wide">
              <span>曜日（カンマ区切り）</span>
              <input value={daysText} onChange={(e) => setDaysText(e.target.value)} placeholder="月,火,水,木,金,土" />
            </label>
            <label className="settings-field settings-field--wide">
              <span>時限（1行1コマ）</span>
              <textarea value={periodsText} onChange={(e) => setPeriodsText(e.target.value)} placeholder="1限 09:20–11:00" />
            </label>
            <label className="settings-field">
              <span>卒業必要単位数</span>
              <input type="number" min="0" value={requiredCredits} onChange={(e) => setRequiredCredits(e.target.value)} />
            </label>
          </div>

          <div className="settings-quarter-block">
            <div className="bulk-head">クォーター期間</div>
            <div className="settings-quarter-grid">
              {QUARTERS.map((quarter) => (
                <div key={quarter} className="settings-quarter-row">
                  <span className="settings-quarter-label">{quarter}</span>
                  <input
                    type="date"
                    value={ranges[quarter].start}
                    onChange={(e) => setRanges((prev) => ({ ...prev, [quarter]: { ...prev[quarter], start: e.target.value } }))}
                  />
                  <span>〜</span>
                  <input
                    type="date"
                    value={ranges[quarter].end}
                    onChange={(e) => setRanges((prev) => ({ ...prev, [quarter]: { ...prev[quarter], end: e.target.value } }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="tt-dialog__foot">
          <button type="button" onClick={() => {
            if (window.confirm('LocalStorage の保存データを初期化します。よろしいですか？')) {
              onResetLocalStorage();
              onClose();
            }
          }} className="btn-ghost danger">
            LocalStorage初期化
          </button>
          <div className="foot-actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              キャンセル
            </button>
            <button type="button" onClick={handleSave} className="btn-primary">
              反映
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
