import React, { useEffect, useMemo, useRef, useState } from "react";
import CSVImporter from "./components/CSVImporter";
import CourseList from "./components/CourseList";
import GradeManagement from "./components/GradeManagement";

const QUARTERS = ["1Q", "2Q", "3Q", "4Q"] as const;
type Quarter = (typeof QUARTERS)[number];

const DEFAULT_DAYS = ["月", "火", "水", "木", "金", "土"];
const DEFAULT_PERIODS: { id: number; label: string; time: string }[] = [
  { id: 1, label: "1限", time: "09:20–11:00" },
  { id: 2, label: "2限", time: "11:10–12:50" },
  { id: 3, label: "3限", time: "13:40–15:20" },
  { id: 4, label: "4限", time: "15:30–17:10" },
  { id: 5, label: "5限", time: "17:20–19:00" },
];

type QuarterRange = { start: string; end: string };
type QuarterRanges = Record<Quarter, QuarterRange>;

type Grade = "秀" | "優" | "良" | "可" | "不可" | "未履修";
type CourseType = "required" | "elective-required" | "elective"; // 必修・選択必修・選択

type CourseCell = {
  title: string;
  room?: string;
  teacher?: string;
  color?: string;
  memo?: string;
  credits?: number; // 単位数
  grade?: Grade; // 成績
  courseType?: CourseType; // 科目区分
} | null;

// カリキュラムテンプレート型
type CurriculumTemplate = {
  name: string; // 学科名
  requiredCredits: number; // 卒業に必要な総単位数
  breakdown: {
    required: number; // 必修科目の必要単位数
    electiveRequired: number; // 選択必修の必要単位数
    elective: number; // 選択科目の必要単位数
  };
};

// 学科別カリキュラムテンプレート
const CURRICULUM_TEMPLATES: CurriculumTemplate[] = [
  {
    name: "電気電子通信工学科",
    requiredCredits: 124,
    breakdown: { required: 88, electiveRequired: 20, elective: 16 },
  },
  {
    name: "機械工学科",
    requiredCredits: 124,
    breakdown: { required: 90, electiveRequired: 18, elective: 16 },
  },
  {
    name: "情報工学科",
    requiredCredits: 124,
    breakdown: { required: 85, electiveRequired: 22, elective: 17 },
  },
  {
    name: "建築学科",
    requiredCredits: 124,
    breakdown: { required: 92, electiveRequired: 16, elective: 16 },
  },
  {
    name: "都市工学科",
    requiredCredits: 124,
    breakdown: { required: 88, electiveRequired: 20, elective: 16 },
  },
  {
    name: "医用工学科",
    requiredCredits: 124,
    breakdown: { required: 90, electiveRequired: 18, elective: 16 },
  },
  {
    name: "カスタム(自由設定)",
    requiredCredits: 124,
    breakdown: { required: 0, electiveRequired: 0, elective: 124 },
  },
];

type Timetable = {
  [quarter: string]: {
    [day: string]: {
      [periodId: string]: CourseCell;
    };
  };
};

type Settings = {
  days: string[];
  periods: { id: number; label: string; time: string }[];
  title: string;
  showTime: boolean;
  quarterRanges: QuarterRanges;
  requiredCredits: number; // 卒業に必要な単位数
  curriculum?: CurriculumTemplate; // 選択されたカリキュラムテンプレート
};

const DAY_JA_TO_INDEX: Record<string, number> = {
  "日": 0,
  "月": 1,
  "火": 2,
  "水": 3,
  "木": 4,
  "金": 5,
  "土": 6,
};

export default function TimetableApp() {
  const [activeQuarter, setActiveQuarter] = useState<Quarter>("1Q");
  const [currentPage, setCurrentPage] = useState<"timetable" | "grades">("timetable");
  
  // 科目リストの状態管理
  const [importedCourses, setImportedCourses] = useState<Array<{
    id: string;
    title: string;
    credits: number;
    category: string;
    group: string;
    courseType: 'required' | 'elective-required' | 'elective';
  }>>([]);
  
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults = createDefaultSettings();
    const stored = load<Partial<Settings>>("timetable_settings_v1");
    if (!stored) return defaults;
    return {
      ...defaults,
      ...stored,
      days: stored.days ?? defaults.days,
      periods: stored.periods ?? defaults.periods,
      title: stored.title ?? defaults.title,
      showTime: stored.showTime ?? defaults.showTime,
      quarterRanges: mergeQuarterRanges((stored as any).quarterRanges),
    };
  });

  const emptyQuarterGrid = useMemo(
    () => buildEmptyQuarter(settings.days, settings.periods),
    [settings.days, settings.periods]
  );

  const [data, setData] = useState<Timetable>(() => {
    const d = load<Timetable>("timetable_data_v1");
    if (d) return d;
    const init: Timetable = {} as Timetable;
    for (const q of QUARTERS) init[q] = clone(emptyQuarterGrid);
    return init;
  });

  useEffect(() => {
    save("timetable_data_v1", data);
  }, [data]);
  useEffect(() => {
    save("timetable_settings_v1", settings);
  }, [settings]);

  const [editing, setEditing] = useState<{
    open: boolean;
    day?: string;
    periodId?: number;
    value?: CourseCell;
  }>({ open: false });
  const openEdit = (day: string, periodId: number) => {
    const v = data[activeQuarter]?.[day]?.[String(periodId)] ?? null;
    setEditing({ open: true, day, periodId, value: v });
  };
  const saveCell = (payload: CourseCell) => {
    if (!editing.day || !editing.periodId) return;
    setData((prev) => ({
      ...prev,
      [activeQuarter]: {
        ...prev[activeQuarter],
        [editing.day!]: {
          ...prev[activeQuarter][editing.day!],
          [String(editing.periodId!)]: payload,
        },
      },
    }));
    setEditing({ open: false });
  };
  const clearCell = () => saveCell(null);

  // CSVインポートのハンドラー
  const handleImportCurriculum = (curriculum: { requiredCredits: number; breakdown: { required: number; electiveRequired: number; elective: number }; name: string }) => {
    setSettings(prev => ({
      ...prev,
      requiredCredits: curriculum.requiredCredits,
      curriculum: {
        name: curriculum.name,
        requiredCredits: curriculum.requiredCredits,
        breakdown: curriculum.breakdown
      }
    }));
  };

  const handleImportCourses = (courses: Array<{ id: string; title: string; credits: number; category: string; group: string; courseType: 'required' | 'elective-required' | 'elective' }>) => {
    setImportedCourses(courses);
  };

  const handleSelectCourse = (course: { id: string; title: string; credits: number; category: string; group: string; courseType: 'required' | 'elective-required' | 'elective' }) => {
    // 科目を選択したら編集ダイアログを開く準備をする
    // ここでは選択した科目情報をeditingに反映
    if (editing.open && editing.day && editing.periodId) {
      const updatedValue: CourseCell = {
        title: course.title,
        credits: course.credits,
        courseType: course.courseType,
        grade: '未履修',
        room: '',
        teacher: '',
        color: '',
        memo: `ID: ${course.id} | ${course.category}`
      };
      setEditing(prev => ({
        ...prev,
        value: updatedValue
      }));
    }
  };

  const fileRef = useRef<HTMLInputElement>(null);
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ version: 1, settings, data }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timetable_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result));
        if (obj.settings && obj.data) {
          const fixed: Timetable = {} as Timetable;
          for (const q of QUARTERS) {
            fixed[q] = mergeGrids(
              buildEmptyQuarter(obj.settings.days ?? settings.days, obj.settings.periods ?? settings.periods),
              obj.data[q] ?? {}
            );
          }
          setSettings((prev) => ({
            ...prev,
            ...(obj.settings ?? {}),
            quarterRanges: mergeQuarterRanges(obj.settings?.quarterRanges ?? prev.quarterRanges),
          }));
          setData(fixed);
          alert("読込が完了しました。");
        } else {
          alert("不正なファイルです。");
        }
      } catch {
        alert("読込に失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  const exportICS = () => {
    const dtstamp = formatICSDateUTC(new Date());
    const events: string[] = [];
    for (const quarter of QUARTERS) {
      const range = settings.quarterRanges[quarter];
      if (!range?.start || !range?.end) continue;
      const startDate = parseISODate(range.start);
      const endDate = parseISODate(range.end);
      if (!startDate || !endDate || startDate > endDate) continue;
      const rangeEnd = new Date(endDate.getTime());
      rangeEnd.setHours(23, 59, 59, 999);

      for (const day of settings.days) {
        const weekday = mapDayLabelToIndex(day);
        if (weekday === null) continue;
        const first = getFirstOccurrence(startDate, weekday);
        if (first > rangeEnd) continue;

        for (const period of settings.periods) {
          const cell = data[quarter]?.[day]?.[String(period.id)] ?? null;
          if (!cell) continue;
          const timeRange = parseTimeRange(period.time);
          if (!timeRange) continue;

          let occurrence = new Date(first.getTime());
          while (occurrence <= rangeEnd) {
            const startDateTime = combineDateAndTime(occurrence, timeRange.startHour, timeRange.startMinute);
            const endDateTime = combineDateAndTime(occurrence, timeRange.endHour, timeRange.endMinute);
            if (endDateTime <= startDateTime) break;

            const summary = `${cell.title} (${quarter})`;
            const lines = [
              "BEGIN:VEVENT",
              `UID:${quarter}-${day}-${period.id}-${startDateTime.getTime()}@timetable.local`,
              `DTSTAMP:${dtstamp}`,
              `DTSTART;TZID=Asia/Tokyo:${formatICSDate(startDateTime)}`,
              `DTEND;TZID=Asia/Tokyo:${formatICSDate(endDateTime)}`,
              `SUMMARY:${escapeICSText(summary)}`,
            ];
            if (cell.room) {
              lines.push(`LOCATION:${escapeICSText(cell.room)}`);
            }
            const descriptionParts: string[] = [];
            if (cell.teacher) descriptionParts.push(`担当: ${cell.teacher}`);
            if (cell.memo) descriptionParts.push(cell.memo);
            if (descriptionParts.length) {
              lines.push(`DESCRIPTION:${escapeICSText(descriptionParts.join("\\n"))}`);
            }
            lines.push(`CATEGORIES:${quarter}`);
            lines.push("END:VEVENT");
            events.push(...lines);

            occurrence = addDays(occurrence, 7);
          }
        }
      }
    }

    if (!events.length) {
      alert("出力できる授業が見つかりません。クオーター期間と時刻を確認してください。");
      return;
    }

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TCU Timetable//JP",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Tokyo",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0900",
      "TZOFFSETTO:+0900",
      "TZNAME:JST",
      "END:STANDARD",
      "END:VTIMEZONE",
      ...events,
      "END:VCALENDAR",
    ];
    const blob = new Blob([lines.join("\r\n")], { type: "text/calendar" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timetable_${new Date().toISOString().slice(0, 10)}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  type CopyMode = "overwrite" | "fill";
  const [copyOpen, setCopyOpen] = useState(false);
  const copyQuarter = (from: Quarter, targets: Quarter[], mode: CopyMode) => {
    if (!targets.length) return;
    setData((prev) => {
      const next = clone(prev);
      const base = buildEmptyQuarter(settings.days, settings.periods);
      const src = mergeGrids(base, next[from] ?? {});
      for (const to of targets) {
        if (to === from) continue;
        next[to] = mergeGrids(base, next[to] ?? {});
        for (const d of settings.days) {
          for (const p of settings.periods) {
            const pid = String(p.id);
            const srcCell = src[d][pid];
            if (mode === "overwrite") {
              next[to][d][pid] = srcCell;
            } else if (!next[to][d][pid]) {
              next[to][d][pid] = srcCell;
            }
          }
        }
      }
      return next;
    });
  };

  const printPage = () => window.print();

  // 成績管理ページの表示切替
  if (currentPage === "grades") {
    return (
      <GradeManagement 
        data={data}
        settings={settings}
        onBack={() => setCurrentPage("timetable")}
      />
    );
  }

  return (
    <div className="tcu-tt">
      <header className="tt-toolbar print:hidden">
        <div className="container tt-toolbar__inner">
          <h1 className="tt-title">{settings.title}</h1>
          <div className="tt-tabs" role="tablist" aria-label="クオーター切替">
            {QUARTERS.map((q) => (
              <button
                key={q}
                className={`tt-tab${activeQuarter === q ? " is-active" : ""}`}
                onClick={() => setActiveQuarter(q)}
                aria-pressed={activeQuarter === q}
                type="button"
              >
                {q}
              </button>
            ))}
          </div>
          <div className="tt-actions">
            <button type="button" onClick={() => setCurrentPage("grades")} className="btn-primary">
              📊 成績管理
            </button>
            <CSVImporter 
              onImportCurriculum={handleImportCurriculum}
              onImportCourses={handleImportCourses}
            />
            <CourseList 
              courses={importedCourses}
              onSelectCourse={handleSelectCourse}
            />
            <button type="button" onClick={() => setCopyOpen(true)} className="btn-ghost">
              他Qへコピー
            </button>
            <button type="button" onClick={exportJSON} className="btn-ghost">
              保存(JSON)
            </button>
            <label className="btn-ghost file-label">
              読込(JSON)
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importJSON(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button type="button" onClick={exportICS} className="btn-ghost">
              カレンダー(ICS)
            </button>
            <button type="button" onClick={printPage} className="btn-ghost">
              印刷
            </button>
            <SettingsPopover
              settings={settings}
              setSettings={setSettings}
              setData={setData}
              QUARTERS={QUARTERS}
            />
          </div>
        </div>
      </header>

      <main className="container">
        <section className="tt-card">
          <div className="section-title">
            <h2>{activeQuarter} の時間割</h2>
            <span className="small print:hidden">クリックで編集できます</span>
          </div>
          <div className="tt-tablewrap">
            <Table
              quarter={activeQuarter}
              data={data}
              days={settings.days}
              periods={settings.periods}
              showTime={settings.showTime}
              onCellClick={openEdit}
            />
          </div>
          <p className="small print:hidden">Esc キーでモーダルを閉じられます。</p>
        </section>
      </main>

      {editing.open && (
        <EditModal
          initial={editing.value ?? null}
          day={editing.day!}
          periodId={editing.periodId!}
          onClose={() => setEditing({ open: false })}
          onSave={saveCell}
          onClear={clearCell}
        />
      )}

      {copyOpen && (
        <QuarterCopyModal
          active={activeQuarter}
          quarters={QUARTERS}
          onCancel={() => setCopyOpen(false)}
          onCopy={(targets, mode) => {
            copyQuarter(activeQuarter, targets as Quarter[], mode);
            setCopyOpen(false);
          }}
        />
      )}

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}

function Table({
  quarter,
  data,
  days,
  periods,
  showTime,
  onCellClick,
}: {
  quarter: string;
  data: Timetable;
  days: string[];
  periods: { id: number; label: string; time: string }[];
  showTime: boolean;
  onCellClick: (day: string, periodId: number) => void;
}) {
  return (
    <table className="tt-table">
      <thead>
        <tr>
          <th className="tt-th-time">時限</th>
          {days.map((d) => (
            <th key={d} className="tt-th-day">
              {d}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {periods.map((p) => (
          <tr key={p.id}>
            <th className="tt-th-slot">
              <div className="slot-label">{p.label}</div>
              {showTime && <div className="slot-time">{p.time}</div>}
            </th>
            {days.map((d) => {
              const cell = data[quarter]?.[d]?.[String(p.id)] ?? null;
              const chipStyle = cell?.color ? { backgroundColor: cell.color } : undefined;
              return (
                <td key={d} className="tt-td">
                  <button
                    type="button"
                    className={`tt-cell${cell ? " cell-filled" : " cell-empty"}`}
                    onClick={() => onCellClick(d, p.id)}
                  >
                    {cell ? (
                      <div>
                        <span className="title" style={chipStyle}>
                          {cell.title}
                        </span>
                        {(cell.room || cell.teacher) && (
                          <div className="meta">
                            {cell.room && <div>教場：{cell.room}</div>}
                            {cell.teacher && <div>担当：{cell.teacher}</div>}
                          </div>
                        )}
                        {cell.memo && <div className="memo">備考：{cell.memo}</div>}
                      </div>
                    ) : (
                      <span>＋ クリックして入力</span>
                    )}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function EditModal({
  initial,
  day,
  periodId,
  onSave,
  onClear,
  onClose,
}: {
  initial: CourseCell;
  day: string;
  periodId: number;
  onSave: (v: CourseCell) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  const [teacher, setTeacher] = useState(initial?.teacher ?? "");
  const [color, setColor] = useState(initial?.color ?? "#eef2ff");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [credits, setCredits] = useState(String(initial?.credits ?? ""));
  const [grade, setGrade] = useState<Grade>(initial?.grade ?? "未履修");
  const [courseType, setCourseType] = useState<CourseType>(initial?.courseType ?? "elective");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tt-modal">
      <div className="tt-dialog">
        <div className="tt-dialog__head">
          <h2>
            {day} / {periodId}限 を編集
          </h2>
          <button type="button" onClick={onClose} className="tt-close" aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="tt-dialog__body">
          <div className="form-grid">
            <Field label="授業名" required>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：電力システム工学A"
              />
            </Field>
            <Field label="教場">
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="例：2号館 305"
              />
            </Field>
            <Field label="担当">
              <input
                value={teacher}
                onChange={(e) => setTeacher(e.target.value)}
                placeholder="例：中島 達人"
              />
            </Field>
            <Field label="色（背景）">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            </Field>
            <Field label="単位数">
              <input
                type="number"
                min="0"
                step="0.5"
                value={credits}
                onChange={(e) => setCredits(e.target.value)}
                placeholder="例：2"
              />
            </Field>
            <Field label="成績">
              <select value={grade} onChange={(e) => setGrade(e.target.value as Grade)}>
                <option value="未履修">未履修</option>
                <option value="秀">秀 (4.0)</option>
                <option value="優">優 (3.0)</option>
                <option value="良">良 (2.0)</option>
                <option value="可">可 (1.0)</option>
                <option value="不可">不可 (0.0)</option>
              </select>
            </Field>
            <Field label="科目区分">
              <select value={courseType} onChange={(e) => setCourseType(e.target.value as CourseType)}>
                <option value="required">必修科目</option>
                <option value="elective-required">選択必修科目</option>
                <option value="elective">選択科目(自由科目)</option>
              </select>
            </Field>
          </div>
          <Field label="備考">
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例：隔週 / Zoom併用 など"
            />
          </Field>
        </div>
        <div className="tt-dialog__foot">
          <button type="button" onClick={onClear} className="btn-ghost danger">
            このコマを空にする
          </button>
          <div className="foot-actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              キャンセル
            </button>
            <button
              type="button"
              onClick={() => onSave({
                title: title.trim(),
                room: room.trim() || undefined,
                teacher: teacher.trim() || undefined,
                color,
                memo: memo.trim() || undefined,
                credits: credits ? parseFloat(credits) : undefined,
                grade: grade !== "未履修" ? grade : undefined,
                courseType,
              })}
              className="btn-primary"
              disabled={!title.trim()}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>
        {label}
        {required && <span> *</span>}
      </span>
      {children}
    </label>
  );
}

function QuarterCopyModal({
  active,
  quarters,
  onCancel,
  onCopy,
}: {
  active: string;
  quarters: readonly string[];
  onCancel: () => void;
  onCopy: (targets: string[], mode: "overwrite" | "fill") => void;
}) {
  const [targets, setTargets] = useState<string[]>(quarters.filter((q) => q !== active));
  const [mode, setMode] = useState<"overwrite" | "fill">("overwrite");

  const toggle = (q: string) =>
    setTargets((prev) => (prev.includes(q) ? prev.filter((x) => x !== q) : [...prev, q]));
  const selectAll = () => setTargets(quarters.filter((q) => q !== active));
  const clearAll = () => setTargets([]);

  return (
    <div className="tt-modal">
      <div className="tt-dialog">
        <div className="tt-dialog__head">
          <h2>他クオーターへコピー</h2>
          <button type="button" onClick={onCancel} className="tt-close" aria-label="閉じる">
            ✕
          </button>
        </div>
        <div className="tt-dialog__body">
          <p className="small">
            現在の <strong>{active}</strong> の時間割を、選んだクオーターへコピーします。
          </p>
          <div className="tt-bulk">
            <div className="bulk-head">コピー先クオーター</div>
            <div className="bulk-days">
              {quarters.map((q) => {
                if (q === active) return null;
                const on = targets.includes(q);
                return (
                  <button
                    key={q}
                    type="button"
                    className={`chip${on ? " chip--on" : ""}`}
                    onClick={() => toggle(q)}
                  >
                    {q}
                  </button>
                );
              })}
              <button type="button" className="chip" onClick={selectAll}>
                全選択
              </button>
              <button type="button" className="chip" onClick={clearAll}>
                解除
              </button>
            </div>
          </div>
          <div className="tt-bulk" style={{ marginTop: 12 }}>
            <div className="bulk-head">コピー方法</div>
            <div className="form-grid">
              <label className="field checkbox">
                <span>上書きコピー（先の内容をすべて置き換える）</span>
                <input
                  type="radio"
                  name="copymode"
                  checked={mode === "overwrite"}
                  onChange={() => setMode("overwrite")}
                />
              </label>
              <label className="field checkbox">
                <span>空欄のみ埋める（先に内容があるコマは残す）</span>
                <input
                  type="radio"
                  name="copymode"
                  checked={mode === "fill"}
                  onChange={() => setMode("fill")}
                />
              </label>
            </div>
          </div>
        </div>
        <div className="tt-dialog__foot">
          <button type="button" onClick={onCancel} className="btn-ghost">
            キャンセル
          </button>
          <div className="foot-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => onCopy(targets, mode)}
              disabled={targets.length === 0}
              title={targets.length === 0 ? "コピー先を選んでください" : ""}
            >
              コピーする
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingsPopover({
  settings,
  setSettings,
  setData,
  QUARTERS,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setData: React.Dispatch<React.SetStateAction<Timetable>>;
  QUARTERS: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(settings.title);
  const [showTime, setShowTime] = useState(settings.showTime);
  const [daysStr, setDaysStr] = useState(settings.days.join(","));
  const [periodsText, setPeriodsText] = useState(formatPeriods(settings.periods));
  const [ranges, setRanges] = useState<QuarterRanges>(() => copyQuarterRanges(settings.quarterRanges));
  const [requiredCredits, setRequiredCredits] = useState(String(settings.requiredCredits));
  const [selectedTemplate, setSelectedTemplate] = useState<string>(
    settings.curriculum?.name || ""
  );

  useEffect(() => {
    if (open) {
      setTitle(settings.title);
      setShowTime(settings.showTime);
      setDaysStr(settings.days.join(","));
      setPeriodsText(formatPeriods(settings.periods));
      setRanges(copyQuarterRanges(settings.quarterRanges));
      setRequiredCredits(String(settings.requiredCredits));
      setSelectedTemplate(settings.curriculum?.name || "");
    }
  }, [open, settings]);

  const apply = () => {
    const newDays = daysStr
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    const newPeriods = parsePeriods(periodsText);
    for (const q of QUARTERS) {
      const quarter = q as Quarter;
      const { start, end } = ranges[quarter];
      if (start && end) {
        const startDate = parseISODate(start);
        const endDate = parseISODate(end);
        if (startDate && endDate && startDate > endDate) {
          alert(`${quarter} の期間が不正です（開始日が終了日より後になっています）。`);
          return;
        }
      }
    }
    const sanitizedRanges = copyQuarterRanges(ranges);
    const curriculum = selectedTemplate 
      ? CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate) 
      : undefined;
    
    setSettings((prev: Settings) => ({
      ...prev,
      title,
      showTime,
      days: newDays,
      periods: newPeriods,
      quarterRanges: sanitizedRanges,
      requiredCredits: requiredCredits ? parseInt(requiredCredits) : 124,
      curriculum,
    }));
    setData((prev: Timetable) => {
      const next: Timetable = {} as Timetable;
      for (const q of QUARTERS) {
        next[q] = mergeGrids(buildEmptyQuarter(newDays, newPeriods), prev[q]);
      }
      return next;
    });
    setOpen(false);
  };

  return (
    <div className="tt-popover print:hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost">
        ⚙️ 設定
      </button>
      {open && (
        <div className="tt-popover__panel">
          <h3>表示設定</h3>
          <div className="form-grid">
            <Field label="タイトル">
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <label className="field checkbox">
              <span>時刻を表示</span>
              <input
                type="checkbox"
                checked={showTime}
                onChange={(e) => setShowTime(e.target.checked)}
              />
            </label>
            <Field label="曜日（カンマ区切り）">
              <input
                value={daysStr}
                onChange={(e) => setDaysStr(e.target.value)}
                placeholder="例：月,火,水,木,金"
              />
            </Field>
            <Field label="時限（1行1コマ： 例）1限 09:00–10:30）">
              <textarea
                value={periodsText}
                onChange={(e) => setPeriodsText(e.target.value)}
              />
            </Field>
          </div>
          
          {/* カリキュラムテンプレート選択 */}
          <div className="tt-bulk" style={{ marginTop: 12 }}>
            <div className="bulk-head">🎓 学科・カリキュラムテンプレート</div>
            <div className="form-grid">
              <Field label="学科を選択">
                <select
                  value={selectedTemplate}
                  onChange={(e) => {
                    const template = CURRICULUM_TEMPLATES.find(t => t.name === e.target.value);
                    setSelectedTemplate(e.target.value);
                    if (template) {
                      setRequiredCredits(String(template.requiredCredits));
                    }
                  }}
                >
                  <option value="">テンプレートを使用しない</option>
                  {CURRICULUM_TEMPLATES.map((template) => (
                    <option key={template.name} value={template.name}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
              {selectedTemplate && (
                <div className="template-info">
                  <p className="small" style={{ marginTop: "0.5rem" }}>
                    ✅ 選択中: <strong>{selectedTemplate}</strong>
                  </p>
                  {CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate) && (
                    <div className="small" style={{ marginTop: "0.5rem", padding: "0.75rem", background: "var(--chipbg)", borderRadius: "8px" }}>
                      <div>必修: {CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate)!.breakdown.required} 単位</div>
                      <div>選択必修: {CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate)!.breakdown.electiveRequired} 単位</div>
                      <div>選択: {CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate)!.breakdown.elective} 単位</div>
                      <div style={{ marginTop: "0.25rem", fontWeight: "600" }}>
                        合計: {CURRICULUM_TEMPLATES.find(t => t.name === selectedTemplate)!.requiredCredits} 単位
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Field label="卒業に必要な単位数">
                <input
                  type="number"
                  min="0"
                  value={requiredCredits}
                  onChange={(e) => setRequiredCredits(e.target.value)}
                  placeholder="例：124"
                />
              </Field>
            </div>
          </div>
          
          <div className="tt-bulk" style={{ marginTop: 12 }}>
            <div className="bulk-head">クオーター期間</div>
            <div className="form-grid">
              {QUARTERS.map((q) => {
                const quarter = q as Quarter;
                return (
                  <Field key={quarter} label={`${quarter} の期間`}>
                    <div className="quarter-range">
                      <input
                        type="date"
                        value={ranges[quarter].start}
                        onChange={(e) =>
                          setRanges((prev) => {
                            const next = { ...prev } as QuarterRanges;
                            next[quarter] = { ...prev[quarter], start: e.target.value };
                            return next;
                          })
                        }
                      />
                      <span>〜</span>
                      <input
                        type="date"
                        value={ranges[quarter].end}
                        onChange={(e) =>
                          setRanges((prev) => {
                            const next = { ...prev } as QuarterRanges;
                            next[quarter] = { ...prev[quarter], end: e.target.value };
                            return next;
                          })
                        }
                      />
                    </div>
                  </Field>
                );
              })}
            </div>
            <p className="small">※ 開始日と終了日が設定されたクオーターのみカレンダー出力に含まれます。</p>
          </div>
          <div className="actions">
            <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
              閉じる
            </button>
            <button type="button" onClick={apply} className="btn-primary">
              反映
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function buildEmptyQuarter(
  days: string[],
  periods: { id: number; label: string; time: string }[]
) {
  const grid: any = {};
  for (const d of days) {
    grid[d] = {};
    for (const p of periods) grid[d][String(p.id)] = null;
  }
  return grid as { [day: string]: { [pid: string]: CourseCell } };
}

function mergeGrids(baseGrid: any, existing: any) {
  const out: any = clone(baseGrid);
  for (const d of Object.keys(existing ?? {})) {
    out[d] ??= {};
    for (const pid of Object.keys(existing[d] ?? {})) {
      out[d][pid] = existing[d][pid];
    }
  }
  return out;
}

function clone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load<T>(key: string): T | null {
  try {
    const s = localStorage.getItem(key);
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

function formatPeriods(periods: { id: number; label: string; time: string }[]) {
  return periods.map((p) => `${p.label} ${p.time}`).join("\n");
}

function parsePeriods(text: string) {
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const out: { id: number; label: string; time: string }[] = [];
  let id = 1;
  for (const line of lines) {
    const m = line.match(/^(\S+)(?:\s+(.+))?$/);
    if (m) out.push({ id: id++, label: m[1], time: m[2] ?? "" });
  }
  return out.length ? out : [{ id: 1, label: "1限", time: "" }];
}

function createDefaultSettings(): Settings {
  return {
    days: [...DEFAULT_DAYS],
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    title: "個人用授業時間割（東京都市大学・4Q制）",
    showTime: true,
    quarterRanges: createDefaultQuarterRanges(),
    requiredCredits: 124, // デフォルト値
  };
}

function createDefaultQuarterRanges(): QuarterRanges {
  const ranges = {} as QuarterRanges;
  for (const q of QUARTERS) {
    ranges[q] = { start: "", end: "" };
  }
  return ranges;
}

function mergeQuarterRanges(input: unknown): QuarterRanges {
  const base = createDefaultQuarterRanges();
  if (!input || typeof input !== "object") return base;
  for (const q of QUARTERS) {
    const value = (input as Record<string, any>)[q];
    if (value && typeof value === "object") {
      base[q] = {
        start: typeof value.start === "string" ? value.start : "",
        end: typeof value.end === "string" ? value.end : "",
      };
    }
  }
  return base;
}

function copyQuarterRanges(input: QuarterRanges): QuarterRanges {
  const out = {} as QuarterRanges;
  for (const q of QUARTERS) {
    const value = input[q] ?? { start: "", end: "" };
    out[q] = { start: value.start ?? "", end: value.end ?? "" };
  }
  return out;
}

function parseTimeRange(time: string) {
  if (!time) return null;
  const normalized = time.replace(/\s+/g, "");
  const match = normalized.match(/^(\d{1,2}):(\d{2})[–-](\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const [, sh, sm, eh, em] = match;
  const startHour = Number(sh);
  const startMinute = Number(sm);
  const endHour = Number(eh);
  const endMinute = Number(em);
  if (
    Number.isNaN(startHour) ||
    Number.isNaN(startMinute) ||
    Number.isNaN(endHour) ||
    Number.isNaN(endMinute)
  ) {
    return null;
  }
  return { startHour, startMinute, endHour, endMinute };
}

function formatICSDate(date: Date) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    `${date.getFullYear()}` +
    `${pad(date.getMonth() + 1)}` +
    `${pad(date.getDate())}` +
    "T" +
    `${pad(date.getHours())}` +
    `${pad(date.getMinutes())}` +
    `${pad(date.getSeconds())}`
  );
}

function formatICSDateUTC(date: Date) {
  const pad = (v: number) => String(v).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}` +
    `${pad(date.getUTCMonth() + 1)}` +
    `${pad(date.getUTCDate())}` +
    "T" +
    `${pad(date.getUTCHours())}` +
    `${pad(date.getUTCMinutes())}` +
    `${pad(date.getUTCSeconds())}` +
    "Z"
  );
}

function escapeICSText(text: string) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function combineDateAndTime(date: Date, hour: number, minute: number) {
  const next = new Date(date.getTime());
  next.setHours(hour, minute, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + amount);
  return next;
}

function parseISODate(value: string): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getFirstOccurrence(start: Date, targetDay: number) {
  const first = new Date(start.getTime());
  const diff = (targetDay - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + diff);
  return first;
}

function mapDayLabelToIndex(day: string): number | null {
  if (!day) return null;
  const trimmed = day.trim();
  if (trimmed in DAY_JA_TO_INDEX) return DAY_JA_TO_INDEX[trimmed];
  const head = trimmed.charAt(0);
  if (head && head in DAY_JA_TO_INDEX) return DAY_JA_TO_INDEX[head];
  const lower = trimmed.toLowerCase();
  switch (lower) {
    case "sun":
    case "sunday":
      return 0;
    case "mon":
    case "monday":
      return 1;
    case "tue":
    case "tues":
    case "tuesday":
      return 2;
    case "wed":
    case "wednesday":
      return 3;
    case "thu":
    case "thur":
    case "thurs":
    case "thursday":
      return 4;
    case "fri":
    case "friday":
      return 5;
    case "sat":
    case "saturday":
      return 6;
    default:
      return null;
  }
}
