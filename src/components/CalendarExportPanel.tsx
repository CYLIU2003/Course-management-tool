import { useEffect, useMemo, useState } from 'react';
import type { AcademicQuarter, AcademicTimetable } from '../utils/academicProgress';
import {
  buildCalendarExportFilename,
  buildCalendarExportIcs,
  createFallbackAcademicCalendarConfig,
  downloadIcsFile,
  loadAcademicCalendarConfig,
} from '../utils/icsExport';
import type {
  AcademicCalendarConfig,
  CalendarAlarmMinutes,
  CalendarExportRange,
} from '../utils/icsExport';

type CalendarExportPanelProps = {
  academicYear: number;
  academicYearLabel: string;
  timetable: AcademicTimetable;
  quarterRanges: Record<AcademicQuarter, { start: string; end: string }>;
  days: string[];
  periods: { id: number; label: string; time: string }[];
};

const RANGE_OPTIONS: { value: CalendarExportRange; label: string }[] = [
  { value: '1Q', label: '1Q' },
  { value: '2Q', label: '2Q' },
  { value: '3Q', label: '3Q' },
  { value: '4Q', label: '4Q' },
  { value: 'spring', label: '前期（1Q + 2Q）' },
  { value: 'fall', label: '後期（3Q + 4Q）' },
  { value: 'full-year', label: '年間（1Q + 2Q + 3Q + 4Q）' },
];

const ALARM_OPTIONS: { value: CalendarAlarmMinutes; label: string }[] = [
  { value: 0, label: '通知なし' },
  { value: 10, label: '10分前' },
  { value: 30, label: '30分前' },
];

function hasEvent(icsText: string) {
  return icsText.includes('BEGIN:VEVENT');
}

export default function CalendarExportPanel({
  academicYear,
  academicYearLabel,
  timetable,
  quarterRanges,
  days,
  periods,
}: CalendarExportPanelProps) {
  const [range, setRange] = useState<CalendarExportRange>('full-year');
  const [alarmMinutes, setAlarmMinutes] = useState<CalendarAlarmMinutes>(10);
  const [includeRoom, setIncludeRoom] = useState(true);
  const [includeTeacher, setIncludeTeacher] = useState(true);
  const [calendarConfig, setCalendarConfig] = useState<AcademicCalendarConfig | null>(null);
  const [calendarConfigError, setCalendarConfigError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadConfig = async () => {
      setCalendarConfigError(null);
      try {
        const config = await loadAcademicCalendarConfig(academicYear);
        if (!cancelled) {
          setCalendarConfig(config);
        }
      } catch {
        if (!cancelled) {
          setCalendarConfig(null);
          setCalendarConfigError('標準カレンダー設定を読み込めませんでした。保存済みの期間を使用します。');
        }
      }
    };

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [academicYear]);

  const resolvedCalendar = useMemo(() => {
    return calendarConfig ?? createFallbackAcademicCalendarConfig(academicYear, quarterRanges);
  }, [academicYear, calendarConfig, quarterRanges]);

  const handleExport = () => {
    const icsText = buildCalendarExportIcs(
      {
        academicYear,
        range,
        alarmMinutes,
        includeRoom,
        includeTeacher,
        includeAssignmentDeadlines: false,
        includeExamDates: false,
        academicCalendar: resolvedCalendar,
        quarterRanges,
      },
      {
        timetable,
        academicYearLabel,
        days,
        periods,
      },
    );

    if (!hasEvent(icsText)) {
      window.alert('出力できる授業が見つかりません。クォーター期間と時刻を確認してください。');
      return;
    }

    const fileName = buildCalendarExportFilename(academicYear, range);
    downloadIcsFile(icsText, fileName);
  };

  return (
    <section className="tt-card calendar-export-panel">
      <div className="section-title">
        <div>
          <h2>ICS カレンダー出力</h2>
          <span className="small">iPhone / Google Calendar に取り込める形式で書き出します</span>
        </div>
        <span className="small">対象: {academicYear}年度 / {academicYearLabel}</span>
      </div>

      {calendarConfigError && (
        <div className="calendar-export-panel__notice">
          {calendarConfigError}
        </div>
      )}

      <div className="calendar-export-panel__grid">
        <label className="settings-field">
          <span>出力範囲</span>
          <select value={range} onChange={(e) => setRange(e.target.value as CalendarExportRange)}>
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="settings-field">
          <span>通知時間</span>
          <select value={alarmMinutes} onChange={(e) => setAlarmMinutes(Number(e.target.value) as CalendarAlarmMinutes)}>
            {ALARM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="calendar-export-panel__toggle">
          <input type="checkbox" checked={includeRoom} onChange={(e) => setIncludeRoom(e.target.checked)} />
          <span>教室を含める</span>
        </label>

        <label className="calendar-export-panel__toggle">
          <input type="checkbox" checked={includeTeacher} onChange={(e) => setIncludeTeacher(e.target.checked)} />
          <span>担当教員を含める</span>
        </label>

        <label className="calendar-export-panel__toggle calendar-export-panel__toggle--disabled" title="今後対応">
          <input type="checkbox" disabled />
          <span>課題締切を含める <small>今後対応</small></span>
        </label>

        <label className="calendar-export-panel__toggle calendar-export-panel__toggle--disabled" title="今後対応">
          <input type="checkbox" disabled />
          <span>試験日を含める <small>今後対応</small></span>
        </label>
      </div>

      <div className="calendar-export-panel__foot">
        <div className="small">
          <div>・1Q / 2Q / 3Q / 4Q / 前期 / 後期 / 年間 に対応</div>
          <div>・除外日はカレンダー設定と保存済みの期間から判定します</div>
        </div>
        <button type="button" className="btn-primary" onClick={handleExport}>
          ICS をダウンロード
        </button>
      </div>
    </section>
  );
}
