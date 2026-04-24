import React, { useEffect, useMemo, useState } from "react";
import GradeManagement from "./components/GradeManagement";
import AppShell from "./components/layout/AppShell";
import AppHeader, { type AppPage } from "./components/layout/AppHeader";
import DataManagementMenu from "./components/layout/DataManagementMenu";
import DashboardCards from "./components/dashboard/DashboardCards";
import WarningPanel from "./components/dashboard/WarningPanel";
import QuarterTabs from "./components/timetable/QuarterTabs";
import AppSettingsModal from "./components/settings/AppSettingsModal";
import CourseSearchPanel from "./components/courses/CourseSearchPanel";
import CourseTagBadge from "./components/courses/CourseTagBadge";
import CourseTypeBadge from "./components/courses/CourseTypeBadge";
import type { AcademicAllYearsData, AcademicCourse, AcademicCourseCell, AcademicSettings, AcademicTimetable, AcademicYearData, CourseType, Grade } from "./utils/academicProgress";
import { autoLoadDepartmentCSVs, AVAILABLE_DEPARTMENTS } from "./utils/autoLoadCSV";
import { buildDashboardSnapshot } from "./utils/academicProgress";

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

type Timetable = AcademicTimetable;

// 学年の型
type Year = "1年次" | "2年次" | "3年次" | "4年次" | "M1" | "M2";

type CourseCell = AcademicCourseCell | null;

// 年度ごとのデータ
type YearData = AcademicYearData;

// 全年度のデータ
type AllYearsData = AcademicAllYearsData;

type Settings = AcademicSettings & {
  days: string[];
  periods: { id: number; label: string; time: string }[];
  title: string;
  showTime: boolean;
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

// ヘルパー関数群
function createDefaultQuarterRanges(): QuarterRanges {
  const ranges = {} as QuarterRanges;
  for (const q of QUARTERS) {
    ranges[q] = { start: "", end: "" };
  }
  return ranges;
}

function createDefaultYearData(): YearData {
  return {
    timetable: {} as Timetable,
    quarterRanges: createDefaultQuarterRanges(),
  };
}

function createDefaultAllYearsData(): AllYearsData {
  return {
    "1年次": createDefaultYearData(),
    "2年次": createDefaultYearData(),
    "3年次": createDefaultYearData(),
    "4年次": createDefaultYearData(),
    "M1": createDefaultYearData(),
    "M2": createDefaultYearData(),
  };
}

export default function TimetableApp() {
  const [activeQuarter, setActiveQuarter] = useState<Quarter>("1Q");
  const [currentYear, setCurrentYear] = useState<Year>("1年次");
  const [currentPage, setCurrentPage] = useState<AppPage>("timetable");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entranceYear, setEntranceYear] = useState<number>(() => {
    const stored = localStorage.getItem("entrance_year");
    return stored ? Number(stored) : new Date().getFullYear();
  });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(() => {
    return localStorage.getItem("selected_department_id") ?? AVAILABLE_DEPARTMENTS[0].id;
  });
  
  // 科目リストの状態管理
  const [importedCourses, setImportedCourses] = useState<AcademicCourse[]>([]);

  // デバッグ用: importedCoursesの変更を監視
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('📚 importedCourses changed:', importedCourses.length, 'courses');
      if (importedCourses.length > 0) {
        console.log('First course:', importedCourses[0]);
      }
    }
  }, [importedCourses]);
  
  const [settings, setSettings] = useState<Settings>(() => {
    const defaults = createDefaultSettings();
    const stored = load<Partial<Settings>>("timetable_settings_v2");
    if (!stored) return defaults;
    return {
      ...defaults,
      ...stored,
      days: stored.days ?? defaults.days,
      periods: stored.periods ?? defaults.periods,
      title: stored.title ?? defaults.title,
      showTime: stored.showTime ?? defaults.showTime,
    };
  });

  // デバッグ用: curriculumの状態を監視
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🎓 Curriculum status:', {
        hasCurriculum: !!settings.curriculum,
        curriculum: settings.curriculum
      });
    }
  }, [settings.curriculum]);

  async function loadDepartment(departmentId: string, year = entranceYear) {
    const result = await autoLoadDepartmentCSVs(departmentId, year);

    setSettings(prev => ({
      ...prev,
      curriculum: {
        ...result.curriculum,
        name: `${result.departmentName} ${year}年度入学`
      }
    }));

    setImportedCourses(result.courses);
    localStorage.setItem("selected_department_id", departmentId);
  }

  // 起動時にCSVを自動読み込み
  useEffect(() => {
    const loadCSVs = async () => {
      if (importedCourses.length > 0 || settings.curriculum) {
        if (import.meta.env.DEV) {
          console.log('⏭️ CSVs already loaded, skipping auto-load');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log('🚀 Starting auto-load...');
      }
      try {
        await loadDepartment(selectedDepartmentId, entranceYear);
        if (import.meta.env.DEV) {
          console.log('✅ Auto-load successful!');
        }
      } catch (error) {
        console.error('❌ Auto-load failed:', error);
      }
    };

    loadCSVs();
  }, []); // 初回のみ実行

  // 年度ごとのデータ管理
  const [allYearsData, setAllYearsData] = useState<AllYearsData>(() => {
    const stored = load<AllYearsData>("timetable_allyears_v2");
    if (stored) return stored;
    
    // 初期化: createDefaultAllYearsData を使用
    return createDefaultAllYearsData();
  });

  // 現在の年度のデータを取得
  const currentYearData: YearData = allYearsData[currentYear] || {
    timetable: {} as Timetable,
    quarterRanges: {
      "1Q": { start: "", end: "" },
      "2Q": { start: "", end: "" },
      "3Q": { start: "", end: "" },
      "4Q": { start: "", end: "" },
    },
  };

  const dashboardSnapshot = useMemo(
    () => buildDashboardSnapshot(allYearsData, settings),
    [allYearsData, settings],
  );

  useEffect(() => {
    save("timetable_allyears_v2", allYearsData);
  }, [allYearsData]);
  
  useEffect(() => {
    save("timetable_settings_v2", settings);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem("entrance_year", String(entranceYear));
  }, [entranceYear]);

  const [editing, setEditing] = useState<{
    open: boolean;
    day?: string;
    periodId?: number;
    value?: CourseCell;
  }>({ open: false });
  
  const openEdit = (day: string, periodId: number) => {
    const v = currentYearData.timetable[activeQuarter]?.[day]?.[String(periodId)] ?? null;
    setEditing({ open: true, day, periodId, value: v });
  };
  
  const saveCell = (payload: CourseCell) => {
    if (!editing.day || !editing.periodId) return;
    setAllYearsData((prev) => ({
      ...prev,
      [currentYear]: {
        ...prev[currentYear],
        timetable: {
          ...prev[currentYear].timetable,
          [activeQuarter]: {
            ...prev[currentYear].timetable[activeQuarter],
            [editing.day!]: {
              ...prev[currentYear].timetable[activeQuarter][editing.day!],
              [String(editing.periodId!)]: payload,
            },
          },
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

  const handleImportCourses = (courses: AcademicCourse[]) => {
    if (import.meta.env.DEV) {
      console.log('📚 Importing courses:', courses.length, 'courses');
    }
    setImportedCourses(courses);
  };
  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ version: 3, entranceYear, settings, allYearsData }, null, 2)], {
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
        if (obj.settings && obj.allYearsData) {
          if (typeof obj.entranceYear === "number" && Number.isFinite(obj.entranceYear)) {
            setEntranceYear(obj.entranceYear);
          }
          // v2 形式
          setSettings((prev) => ({
            ...prev,
            ...(obj.settings ?? {}),
          }));
          setAllYearsData(obj.allYearsData);
          alert("読込が完了しました。");
        } else if (obj.settings && obj.data) {
          // v1 形式 - 1年次にマイグレーション
          const fixed: Timetable = {} as Timetable;
          for (const q of QUARTERS) {
            fixed[q] = mergeGrids(
              buildEmptyQuarter(obj.settings.days ?? settings.days, obj.settings.periods ?? settings.periods),
              obj.data[q] ?? {}
            );
          }
          const migratedData: AllYearsData = createDefaultAllYearsData();
          migratedData["1年次"].timetable = fixed;
          if (obj.settings?.quarterRanges) {
            migratedData["1年次"].quarterRanges = obj.settings.quarterRanges;
          }
          setSettings((prev) => ({
            ...prev,
            ...(obj.settings ?? {}),
          }));
          setAllYearsData(migratedData);
          alert("読込が完了しました(v1形式を1年次に変換しました)。");
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
    
    // 全年度のデータをエクスポート
    const years = ["1年次", "2年次", "3年次", "4年次", "M1", "M2"] as const;
    for (const year of years) {
      const yearData = allYearsData[year];
      if (!yearData) continue;
      
      const data = yearData.timetable;
      const quarterRanges = yearData.quarterRanges;
      
      for (const quarter of QUARTERS) {
        const range = quarterRanges[quarter];
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
    setAllYearsData((prev) => {
      const next = clone(prev);
      const currentData = next[currentYear].timetable;
      const base = buildEmptyQuarter(settings.days, settings.periods);
      const src = mergeGrids(base, currentData[from] ?? {});
      for (const to of targets) {
        if (to === from) continue;
        currentData[to] = mergeGrids(base, currentData[to] ?? {});
        for (const d of settings.days) {
          for (const p of settings.periods) {
            const pid = String(p.id);
            const srcCell = src[d][pid];
            if (mode === "overwrite") {
              currentData[to][d][pid] = srcCell;
            } else if (!currentData[to][d][pid]) {
              currentData[to][d][pid] = srcCell;
            }
          }
        }
      }
      return next;
    });
  };

  const printPage = () => window.print();

  const handleDepartmentChange = async (departmentId: string) => {
    setSelectedDepartmentId(departmentId);
    await loadDepartment(departmentId, entranceYear);
  };

  const handleEntranceYearChange = async (year: number) => {
    setEntranceYear(year);
    await loadDepartment(selectedDepartmentId, year);
  };

  const handleOpenSettings = () => {
    setSettingsOpen(true);
  };

  const handleResetLocalStorage = async () => {
    const defaultDepartmentId = AVAILABLE_DEPARTMENTS[0]?.id ?? selectedDepartmentId;
    const defaultEntranceYear = new Date().getFullYear();
    localStorage.removeItem("timetable_settings_v2");
    localStorage.removeItem("timetable_allyears_v2");
    localStorage.removeItem("selected_department_id");
    localStorage.removeItem("entrance_year");
    setCurrentYear("1年次");
    setActiveQuarter("1Q");
    setCurrentPage("timetable");
    setEntranceYear(defaultEntranceYear);
    setSelectedDepartmentId(defaultDepartmentId);
    setImportedCourses([]);
    setSettings(createDefaultSettings());
    setAllYearsData(createDefaultAllYearsData());
    await loadDepartment(defaultDepartmentId, defaultEntranceYear);
  };

  const handleSaveSettings = ({
    settings: nextSettings,
    quarterRanges,
  }: {
    settings: {
      title: string;
      showTime: boolean;
      days: string[];
      periods: { id: number; label: string; time: string }[];
      requiredCredits: number;
    };
    quarterRanges: QuarterRanges;
  }) => {
    setSettings((prev) => ({
      ...prev,
      ...nextSettings,
    }));
    setAllYearsData((prev) => {
      const next = clone(prev);
      next[currentYear].quarterRanges = quarterRanges;
      for (const quarter of QUARTERS) {
        next[currentYear].timetable[quarter] = mergeGrids(
          buildEmptyQuarter(nextSettings.days, nextSettings.periods),
          next[currentYear].timetable[quarter],
        );
      }
      return next;
    });
  };

  const dataManagementMenu = (
    <DataManagementMenu
      onExportJson={exportJSON}
      onImportJson={importJSON}
      onExportIcs={exportICS}
      onPrint={printPage}
      onImportCurriculum={handleImportCurriculum}
      onImportCourses={handleImportCourses}
    />
  );

  const pageContent = currentPage === "grades" ? (
    <GradeManagement
      settings={settings}
      snapshot={dashboardSnapshot}
      importedCourses={importedCourses}
      onBack={() => setCurrentPage("timetable")}
    />
  ) : currentPage === "courses" ? (
    <CourseSearchPanel courses={importedCourses} />
  ) : (
    <>
      <DashboardCards snapshot={dashboardSnapshot} curriculumName={settings.curriculum?.name} />
      <WarningPanel warnings={dashboardSnapshot.warnings} />

      <QuarterTabs value={activeQuarter} quarters={QUARTERS} onChange={(quarter) => setActiveQuarter(quarter as Quarter)} />
      <section className="tt-card">
        <div className="section-title">
          <div>
            <h2>{currentYear} - {activeQuarter} の時間割</h2>
            <span className="small print:hidden">クリックで編集できます</span>
          </div>
          <button type="button" onClick={() => setCopyOpen(true)} className="btn-ghost print:hidden">
            他Qへコピー
          </button>
        </div>
        <div className="tt-tablewrap">
          <Table
            quarter={activeQuarter}
            data={currentYearData.timetable}
            days={settings.days}
            periods={settings.periods}
            showTime={settings.showTime}
            onCellClick={openEdit}
          />
        </div>
        <p className="small print:hidden">Esc キーでモーダルを閉じられます。</p>
      </section>
    </>
  );

  return (
    <AppShell>
      <AppHeader
        title="履修・成績管理"
        departmentId={selectedDepartmentId}
        departments={AVAILABLE_DEPARTMENTS}
        entranceYear={entranceYear}
        currentYear={currentYear}
        currentPage={currentPage}
        onDepartmentChange={handleDepartmentChange}
        onEntranceYearChange={handleEntranceYearChange}
        onYearChange={(year: string) => setCurrentYear(year as Year)}
        onPageChange={setCurrentPage}
        onOpenSettings={handleOpenSettings}
        dataMenu={dataManagementMenu}
      />

      <main className="app-container app-main">
        {pageContent}
      </main>

      <AppSettingsModal
        open={settingsOpen}
        settings={{
          title: settings.title,
          showTime: settings.showTime,
          days: settings.days,
          periods: settings.periods,
          requiredCredits: settings.requiredCredits,
        }}
        quarterRanges={currentYearData.quarterRanges}
        curriculumName={settings.curriculum?.name}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
        onResetLocalStorage={handleResetLocalStorage}
      />

      {currentPage === "timetable" && editing.open && (
        <EditModal
          initial={editing.value ?? null}
          day={editing.day!}
          periodId={editing.periodId!}
          onClose={() => setEditing({ open: false })}
          onSave={saveCell}
          onClear={clearCell}
          importedCourses={importedCourses}
          hasCurriculum={!!settings.curriculum}
        />
      )}

      {currentPage === "timetable" && copyOpen && (
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
    </AppShell>
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
  importedCourses,
  hasCurriculum,
}: {
  initial: CourseCell;
  day: string;
  periodId: number;
  onSave: (v: CourseCell) => void;
  onClear: () => void;
  onClose: () => void;
  importedCourses: AcademicCourse[];
  hasCurriculum: boolean;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [room, setRoom] = useState(initial?.room ?? "");
  const [teacher, setTeacher] = useState(initial?.teacher ?? "");
  const [color, setColor] = useState(initial?.color ?? "#eef2ff");
  const [memo, setMemo] = useState(initial?.memo ?? "");
  const [credits, setCredits] = useState(String(initial?.credits ?? ""));
  const [grade, setGrade] = useState<Grade>(initial?.grade ?? "未履修");
  const [courseType, setCourseType] = useState<CourseType>(initial?.courseType ?? "elective");
  const [courseSearchOpen, setCourseSearchOpen] = useState(false);
  const [courseSearchQuery, setCourseSearchQuery] = useState("");
  const [courseCategory, setCourseCategory] = useState("all");
  const [courseGroup, setCourseGroup] = useState("all");
  const [courseTypeFilter, setCourseTypeFilter] = useState<CourseType | "all">("all");
  const [courseTag, setCourseTag] = useState("all");

  const selectCourse = (course: AcademicCourse) => {
    const tags = [...(course.tags ?? [])];
    if (course.requirementSubtype === 'triangle1') tags.push('△1');
    if (course.requirementSubtype === 'triangle2') tags.push('△2');
    setTitle(course.title);
    setCredits(String(course.credits));
    setCourseType(course.courseType);
    setMemo(
      `ID: ${course.id} | ${course.category || '未設定'}${course.group ? ` | ${course.group}` : ''}${course.rawRequired ? ` | ${course.rawRequired}` : ''}${tags.length ? ` | ${tags.join(' / ')}` : ''}`
    );
    setCourseSearchOpen(false);
  };

  const courseCategories = useMemo(
    () => [...new Set(importedCourses.map((course) => course.category).filter(Boolean))].sort(),
    [importedCourses],
  );

  const courseGroups = useMemo(
    () => [...new Set(importedCourses.map((course) => course.group).filter(Boolean))].sort(),
    [importedCourses],
  );

  const courseLabels = useMemo(() => {
    const collected = importedCourses.flatMap((course) => {
      const tags = [...(course.tags ?? [])];
      if (course.requirementSubtype === 'triangle1') tags.push('△1');
      if (course.requirementSubtype === 'triangle2') tags.push('△2');
      return tags;
    });
    return [...new Set(collected)].sort();
  }, [importedCourses]);

  const visibleCourses = useMemo(() => {
    const keyword = courseSearchQuery.trim().toLowerCase().replace(/\s+/g, '');
    return importedCourses.filter((course) => {
      const tags = [...(course.tags ?? [])];
      if (course.requirementSubtype === 'triangle1') tags.push('△1');
      if (course.requirementSubtype === 'triangle2') tags.push('△2');
      const searchable = [course.id, course.title, course.category, course.group, course.rawRequired ?? '', course.courseType, ...tags]
        .join(' ')
        .toLowerCase()
        .replace(/\s+/g, '');
      return (
        (!keyword || searchable.includes(keyword)) &&
        (courseCategory === 'all' || course.category === courseCategory) &&
        (courseGroup === 'all' || course.group === courseGroup) &&
        (courseTypeFilter === 'all' || course.courseType === courseTypeFilter) &&
        (courseTag === 'all' || tags.includes(courseTag))
      );
    });
  }, [courseSearchQuery, importedCourses, courseCategory, courseGroup, courseTypeFilter, courseTag]);

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
              <div className="course-picker">
                <div className="course-picker__row">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例：電力システム工学A"
                  />
                  {hasCurriculum && importedCourses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCourseSearchOpen((prev) => !prev)}
                      className="btn-ghost course-picker__toggle"
                      aria-pressed={courseSearchOpen}
                      title="科目を検索"
                    >
                      🔍
                    </button>
                  )}
                </div>

                {courseSearchOpen && hasCurriculum && importedCourses.length > 0 && (
                  <div className="course-picker__panel">
                    <div className="course-picker__filters">
                      <input
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        placeholder="科目名 / ID / 区分 / タグで検索"
                      />
                      <select value={courseCategory} onChange={(e) => setCourseCategory(e.target.value)}>
                        <option value="all">カテゴリすべて</option>
                        {courseCategories.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      <select value={courseGroup} onChange={(e) => setCourseGroup(e.target.value)}>
                        <option value="all">科目群すべて</option>
                        {courseGroups.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      <select value={courseTypeFilter} onChange={(e) => setCourseTypeFilter(e.target.value as CourseType | 'all')}>
                        <option value="all">区分すべて</option>
                        <option value="required">必修</option>
                        <option value="elective-required">選択必修</option>
                        <option value="elective">選択</option>
                      </select>
                      <select value={courseTag} onChange={(e) => setCourseTag(e.target.value)}>
                        <option value="all">タグすべて</option>
                        {courseLabels.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>

                    <div className="course-picker__summary small">
                      表示 {Math.min(visibleCourses.length, courseSearchQuery.trim() ? 50 : 30)} 件 / 候補 {visibleCourses.length} 件
                    </div>

                    <div className="course-picker__results">
                      {visibleCourses.length === 0 ? (
                        <div className="course-picker__empty">一致する科目がありません。</div>
                      ) : (
                        visibleCourses.slice(0, courseSearchQuery.trim() ? 50 : 30).map((course) => {
                          const tags = [...(course.tags ?? [])];
                          if (course.requirementSubtype === 'triangle1') tags.push('△1');
                          if (course.requirementSubtype === 'triangle2') tags.push('△2');
                          return (
                            <button
                              key={course.id}
                              type="button"
                              className="course-picker__result"
                              onClick={() => selectCourse(course)}
                            >
                              <div className="course-picker__result-head">
                                <div>
                                  <strong>{course.title}</strong>
                                  <div className="small">{course.id} / {course.category || '未設定'} / {course.group || '未設定'}</div>
                                </div>
                                <CourseTypeBadge courseType={course.courseType} />
                              </div>
                              <div className="course-picker__chips">
                                {tags.map((tag) => <CourseTagBadge key={`${course.id}-${tag}`} label={tag} />)}
                              </div>
                              <div className="course-picker__meta small">
                                単位数 {course.credits} / raw_required: {course.rawRequired || 'なし'}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
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

function createDefaultSettings(): Settings {
  return {
    days: [...DEFAULT_DAYS],
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    title: "時間割",
    showTime: true,
    requiredCredits: 124, // デフォルト値
  };
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
