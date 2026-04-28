import React, { useEffect, useMemo, useState } from "react";
import GradeManagement from "./components/GradeManagement";
import AppShell from "./components/layout/AppShell";
import AppHeader, { type AppPage } from "./components/layout/AppHeader";
import DataManagementMenu from "./components/layout/DataManagementMenu";
import QuarterTabs from "./components/timetable/QuarterTabs";
import AppSettingsModal from "./components/settings/AppSettingsModal";
import CourseSearchPanel from "./components/courses/CourseSearchPanel";
import CourseTagBadge from "./components/courses/CourseTagBadge";
import CourseTypeBadge from "./components/courses/CourseTypeBadge";
import AcademicOverview from "./components/AcademicOverview";
import GraduationRequirementPanel from "./components/GraduationRequirementPanel";
import GpaSummaryPanel from "./components/GpaSummaryPanel";
import CreditCompletionPanel from "./components/CreditCompletionPanel";
import TargetGpaPanel from "./components/TargetGpaPanel";
import GpaPredictionPanel from "./components/GpaPredictionPanel";
import { DataLoadNotice } from "./components/status/DataLoadNotice";
import CalendarExportPanel from "./components/CalendarExportPanel";
import type { AcademicAllYearsData, AcademicCourse, AcademicCourseCell, AcademicSettings, AcademicTimetable, AcademicYearData, CourseOffering, CourseType, Grade } from "./core/types";
import { autoLoadDepartmentCSVs, AVAILABLE_DEPARTMENTS, CSVAutoLoadError } from "./utils/autoLoadCSV";
import type { AutoLoadDepartmentCSVResult } from "./utils/autoLoadCSV";
import { buildDashboardSnapshot } from "./core/graduation";
import { buildSyncedCourseCell, selectBestOfferingDetailed } from "./utils/courseOffering";
import {
  buildCalendarExportFilename,
  buildCalendarExportIcs,
  createFallbackAcademicCalendarConfig,
  downloadIcsFile,
  loadAcademicCalendarConfig,
} from "./core/calendar";

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

type WorkspaceTab = "schedule" | "requirements" | "gpa" | "calendar";

type Settings = AcademicSettings & {
  days: string[];
  periods: { id: number; label: string; time: string }[];
  title: string;
  showTime: boolean;
};

function normalizeSearchText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

function getOfferingSearchText(offering: CourseOffering) {
  return [
    offering.day,
    offering.period,
    offering.day && offering.period ? `${offering.day}${offering.period}` : '',
    offering.term,
    offering.gradeYear,
    offering.className,
    offering.teacher,
    offering.lectureCode,
    offering.room,
    offering.target,
    offering.remarks,
  ].filter(Boolean).join(' ');
}

function formatOfferingSummary(offering?: CourseOffering) {
  if (!offering) {
    return '';
  }

  return [
    offering.term ? `${offering.term}` : '',
    offering.day && offering.period ? `${offering.day}${offering.period}限` : '',
    offering.gradeYear ? `${offering.gradeYear}年次` : '',
    offering.className ? offering.className : '',
  ].filter(Boolean).join(' / ');
}

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
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>("schedule");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entranceYear, setEntranceYear] = useState<number>(() => {
    const stored = localStorage.getItem("entrance_year");
    return stored ? Number(stored) : new Date().getFullYear();
  });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>(() => {
    return localStorage.getItem("selected_department_id") ?? AVAILABLE_DEPARTMENTS[0].id;
  });

  const [importedCourses, setImportedCourses] = useState<AcademicCourse[]>([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvLoadResult, setCsvLoadResult] = useState<AutoLoadDepartmentCSVResult | null>(null);
  const [csvLoadError, setCsvLoadError] = useState<string | null>(null);

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

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('🎓 Curriculum status:', {
        hasCurriculum: !!settings.curriculum,
        curriculum: settings.curriculum,
      });
    }
  }, [settings.curriculum]);

  async function loadDepartment(departmentId: string, year = entranceYear): Promise<AutoLoadDepartmentCSVResult> {
    setCsvLoading(true);
    setCsvLoadError(null);

    try {
      const result = await autoLoadDepartmentCSVs(departmentId, year);

      if (import.meta.env.DEV && result.courses.length === 0) {
        console.warn(`No courses loaded for department=${departmentId}, entranceYear=${year}. Check CSV headers and file path.`);
      }

      setCsvLoadResult(result);

      setSettings((prev) => ({
        ...prev,
        curriculum: {
          ...result.curriculum,
          name: `${result.departmentName} ${year}年度入学`,
        },
      }));

      setImportedCourses(result.courses);
      localStorage.setItem("selected_department_id", departmentId);
      return result;
    } catch (error) {
      if (error instanceof CSVAutoLoadError) {
        const dept = AVAILABLE_DEPARTMENTS.find((department) => department.id === departmentId);
        const result: AutoLoadDepartmentCSVResult = error.result ?? {
          status: 'failed',
          departmentId,
          departmentName: dept ? `${dept.faculty} ${dept.name}` : departmentId,
          entranceYear: year,
          curriculum: {
            name: dept ? `${dept.faculty} ${dept.name}` : departmentId,
            requiredCredits: 0,
            breakdown: { required: 0, electiveRequired: 0, elective: 0 },
          },
          courses: [],
          stats: {
            requirementRows: 0,
            timetableRows: 0,
            scheduleRows: 0,
            curriculumCourses: 0,
            scheduleCourses: 0,
            mergedCourses: 0,
            coursesWithOfferings: 0,
            offerings: 0,
          },
          resources: error.resources,
          messages: error.messages,
        };

        if (import.meta.env.DEV) {
          console.error('CSV auto-load failed:', error);
        }

        setCsvLoadResult(result);
        setCsvLoadError('科目データの読み込みに失敗しました。');
        setSettings((prev) => ({
          ...prev,
          curriculum: {
            ...result.curriculum,
            name: `${result.departmentName} ${year}年度入学`,
          },
        }));
        setImportedCourses(result.courses);
        localStorage.setItem("selected_department_id", departmentId);
        return result;
      }

      console.error('❌ Auto-load failed:', error);
      const dept = AVAILABLE_DEPARTMENTS.find((department) => department.id === departmentId);
      const result: AutoLoadDepartmentCSVResult = {
        status: 'failed',
        departmentId,
        departmentName: dept ? `${dept.faculty} ${dept.name}` : departmentId,
        entranceYear: year,
        curriculum: {
          name: dept ? `${dept.faculty} ${dept.name}` : departmentId,
          requiredCredits: 0,
          breakdown: { required: 0, electiveRequired: 0, elective: 0 },
        },
        courses: [],
        stats: {
          requirementRows: 0,
          timetableRows: 0,
          scheduleRows: 0,
          curriculumCourses: 0,
          scheduleCourses: 0,
          mergedCourses: 0,
          coursesWithOfferings: 0,
          offerings: 0,
        },
        resources: [],
        messages: [{ level: 'error', text: error instanceof Error ? error.message : 'CSVの読み込みに失敗しました。' }],
      };

      setCsvLoadResult(result);
      setCsvLoadError('科目データの読み込みに失敗しました。');
      setSettings((prev) => ({
        ...prev,
        curriculum: {
          ...result.curriculum,
          name: `${result.departmentName} ${year}年度入学`,
        },
      }));
      setImportedCourses([]);
      localStorage.setItem("selected_department_id", departmentId);
      return result;
    } finally {
      setCsvLoading(false);
    }
  }

  // 起動時にCSVを自動読み込み
  useEffect(() => {
    const loadCSVs = async () => {
      if (importedCourses.length > 0) {
        setCsvLoading(false);
        if (import.meta.env.DEV) {
          console.log('⏭️ Courses already loaded, skipping auto-load');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log('🚀 Starting auto-load...');
      }
      try {
        const result = await loadDepartment(selectedDepartmentId, entranceYear);
        if (import.meta.env.DEV) {
          console.log('CSV load result', result);
        }
      } catch (error) {
        console.error('❌ Auto-load failed:', error);
      }
    };

    void loadCSVs();
    // 初回マウント時のみ。学科・入学年度変更時は各handlerで再読込する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const exportICS = async () => {
    try {
      const academicCalendar = await loadAcademicCalendarConfig(entranceYear).catch(() =>
        createFallbackAcademicCalendarConfig(entranceYear, currentYearData.quarterRanges),
      );

      const icsText = buildCalendarExportIcs(
        {
          academicYear: entranceYear,
          range: 'full-year',
          alarmMinutes: 0,
          includeRoom: true,
          includeTeacher: true,
          includeAssignmentDeadlines: false,
          includeExamDates: false,
          academicCalendar,
          quarterRanges: currentYearData.quarterRanges,
        },
        {
          timetable: currentYearData.timetable,
          academicYearLabel: currentYear,
          days: settings.days,
          periods: settings.periods,
        },
      );

      if (!icsText.includes('BEGIN:VEVENT')) {
        alert('出力できる授業が見つかりません。クォーター期間と時刻を確認してください。');
        return;
      }

      downloadIcsFile(icsText, buildCalendarExportFilename(entranceYear, 'full-year'));
    } catch (error) {
      console.error('ICS export failed:', error);
      alert('ICS出力に失敗しました。');
    }
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
      allYearsData={allYearsData}
      currentYear={currentYear}
      onBack={() => setCurrentPage("timetable")}
    />
  ) : currentPage === "courses" ? (
    <CourseSearchPanel courses={importedCourses} />
  ) : (
    <div className="timetable-page">
      <AcademicOverview
        title="学生向けトップ"
        snapshot={dashboardSnapshot}
        curriculumName={settings.curriculum?.name}
        allYearsData={allYearsData}
        courses={importedCourses}
        currentYear={currentYear}
        curriculum={settings.curriculum}
        currentQuarter={activeQuarter}
        timetable={currentYearData.timetable}
        days={settings.days}
        periods={settings.periods}
        showActions
        onOpenRequirements={() => setWorkspaceTab("requirements")}
        onOpenCourses={() => setCurrentPage("courses")}
        onOpenGpa={() => setWorkspaceTab("gpa")}
        onOpenCalendar={() => setWorkspaceTab("calendar")}
      />

      <DataLoadNotice
        status={csvLoading ? "loading" : csvLoadError ? "failed" : csvLoadResult?.status === "partial" ? "partial" : csvLoadResult?.status === "success" ? "ready" : "idle"}
        message={csvLoadError}
        onRetry={csvLoadError ? () => void loadDepartment(selectedDepartmentId, entranceYear) : undefined}
      />

      <div className="workspace-tabs print:hidden" role="tablist" aria-label="履修画面の表示切り替え">
        <button
          type="button"
          className={workspaceTab === "schedule" ? "workspace-tabs__button is-active" : "workspace-tabs__button"}
          aria-pressed={workspaceTab === "schedule"}
          onClick={() => setWorkspaceTab("schedule")}
        >
          時間割
        </button>
        <button
          type="button"
          className={workspaceTab === "requirements" ? "workspace-tabs__button is-active" : "workspace-tabs__button"}
          aria-pressed={workspaceTab === "requirements"}
          onClick={() => setWorkspaceTab("requirements")}
        >
          卒業要件
        </button>
        <button
          type="button"
          className={workspaceTab === "gpa" ? "workspace-tabs__button is-active" : "workspace-tabs__button"}
          aria-pressed={workspaceTab === "gpa"}
          onClick={() => setWorkspaceTab("gpa")}
        >
          成績 / GPA
        </button>
        <button
          type="button"
          className={workspaceTab === "calendar" ? "workspace-tabs__button is-active" : "workspace-tabs__button"}
          aria-pressed={workspaceTab === "calendar"}
          onClick={() => setWorkspaceTab("calendar")}
        >
          カレンダー
        </button>
      </div>

      <section className="workspace-grid">
        <aside className={workspaceTab === "schedule" ? "workspace-panel workspace-panel--search is-active" : "workspace-panel workspace-panel--search"}>
          <CourseSearchPanel courses={importedCourses} />
        </aside>

        <section className={workspaceTab === "schedule" ? "workspace-panel workspace-panel--schedule is-active" : "workspace-panel workspace-panel--schedule"}>
          <QuarterTabs value={activeQuarter} quarters={QUARTERS} onChange={(quarter) => setActiveQuarter(quarter as Quarter)} />
          <section className="tt-card timetable-card">
            <div className="section-title">
              <div>
                <h2>{currentYear} - {activeQuarter} の時間割</h2>
                <span className="small print:hidden">クリックで編集できます</span>
              </div>
              <button type="button" onClick={() => setCopyOpen(true)} className="btn-ghost print:hidden">
                他Qへコピー
              </button>
            </div>
            <div className="tt-tablewrap timetable-scroll">
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
        </section>

        <aside className="workspace-panel workspace-panel--insights">
          <section
            className={workspaceTab === "requirements" ? "workspace-subpanel is-active" : "workspace-subpanel"}
          >
            <AcademicOverview
              snapshot={dashboardSnapshot}
              curriculumName={settings.curriculum?.name}
              compact
              allYearsData={allYearsData}
              courses={importedCourses}
              currentYear={currentYear}
            />

            <GraduationRequirementPanel
              curriculum={settings.curriculum}
              allYearsData={allYearsData}
              courses={importedCourses}
              currentYear={currentYear}
            />
          </section>

          <section
            className={workspaceTab === "gpa" ? "workspace-subpanel is-active" : "workspace-subpanel"}
          >
            <GpaSummaryPanel snapshot={dashboardSnapshot} allYearsData={allYearsData} />

            <CreditCompletionPanel snapshot={dashboardSnapshot} allYearsData={allYearsData} />

            <TargetGpaPanel
              snapshot={dashboardSnapshot}
              defaultFutureCredits={Math.max(0, dashboardSnapshot.requiredCredits - dashboardSnapshot.earnedCredits)}
            />

            <GpaPredictionPanel courses={importedCourses} snapshot={dashboardSnapshot} />
          </section>
        </aside>
      </section>

      <section className={workspaceTab === "calendar" ? "workspace-panel workspace-panel--calendar is-active" : "workspace-panel workspace-panel--calendar"}>
        <CalendarExportPanel
          academicYear={entranceYear}
          academicYearLabel={currentYear}
          timetable={currentYearData.timetable}
          quarterRanges={currentYearData.quarterRanges}
          days={settings.days}
          periods={settings.periods}
        />
      </section>
    </div>
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
          currentYear={currentYear}
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
                        {cell.teacher && (
                          <div className="course-cell__meta">担当：{cell.teacher}</div>
                        )}
                        {cell.room && (
                          <div className="course-cell__room">教室：{cell.room}</div>
                        )}
                        {(cell.lectureCode || cell.term || cell.target || cell.className || cell.scheduleDay || cell.schedulePeriod) && (
                          <div className="course-cell__meta small">
                            {cell.lectureCode && <div>講義コード：{cell.lectureCode}</div>}
                            {(cell.scheduleDay || cell.schedulePeriod) && (
                              <div>開講：{cell.scheduleDay ?? ''}{cell.schedulePeriod ?? ''}限</div>
                            )}
                            {cell.term && <div>学期：{cell.term}</div>}
                            {cell.className && <div>クラス：{cell.className}</div>}
                            {cell.target && <div>受講対象：{cell.target}</div>}
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
  currentYear,
  onSave,
  onClear,
  onClose,
  importedCourses,
  hasCurriculum,
}: {
  initial: CourseCell;
  day: string;
  periodId: number;
  currentYear: Year;
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
  const [selectedOffering, setSelectedOffering] = useState<CourseOffering | undefined>(initial?.sourceOffering);
  const [offeringSyncMessage, setOfferingSyncMessage] = useState<string | null>(null);

  const selectCourse = (course: AcademicCourse) => {
    const selection = selectBestOfferingDetailed({ course, day, periodId, currentYear });
    const syncedCell = buildSyncedCourseCell(course, selection.offering);
    setSelectedOffering(selection.offering);
    setOfferingSyncMessage(selection.message);
    setTitle(syncedCell.title);
    setCredits(syncedCell.credits ? String(syncedCell.credits) : '');
    setCourseType(syncedCell.courseType ?? 'elective');
    setTeacher(syncedCell.teacher ?? '');
    setRoom(syncedCell.room ?? '');
    setMemo(syncedCell.memo ?? '');
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
    const keyword = normalizeSearchText(courseSearchQuery.trim());
    return importedCourses.filter((course) => {
      const tags = [...(course.tags ?? [])];
      if (course.requirementSubtype === 'triangle1') tags.push('△1');
      if (course.requirementSubtype === 'triangle2') tags.push('△2');
      const searchable = [course.id, course.title, course.category, course.group, course.rawRequired ?? '', course.courseType, ...tags, ...(course.offerings ?? []).map((offering) => getOfferingSearchText(offering))]
        .join(' ')
        .normalize('NFKC')
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
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setSelectedOffering(undefined);
                      setOfferingSyncMessage(null);
                    }}
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

                {offeringSyncMessage && (
                  <div className="course-picker__sync-note small">
                    {offeringSyncMessage}
                  </div>
                )}

                {courseSearchOpen && hasCurriculum && importedCourses.length > 0 && (
                  <div className="course-picker__panel">
                    <div className="course-picker__filters">
                      <input
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        placeholder="科目名 / 教員 / 教室 / 講義コード / 曜日時限で検索"
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
                              {(course.offerings?.length ?? 0) > 0 && (
                                <div className="course-picker__offerings">
                                  {course.offerings?.slice(0, 3).map((offering, index) => {
                                    const isSlotMatched = offering.day === day && offering.period === String(periodId);
                                    return (
                                      <div key={`${course.id}-${offering.lectureCode ?? index}`} className={`course-candidate__offering${isSlotMatched ? ' is-slot-matched' : ''}`}>
                                        <span>{formatOfferingSummary(offering) || '開講情報あり'}</span>
                                        <span>{offering.teacher ? `担当 ${offering.teacher}` : '担当未設定'}</span>
                                        {offering.room ? <span className="course-candidate__room">教室 {offering.room}</span> : null}
                                        {offering.lectureCode ? <span>{offering.lectureCode}</span> : null}
                                        {offering.target ? <span>{offering.target}</span> : null}
                                        {offering.remarks ? <span>{offering.remarks}</span> : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
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
                lectureCode: selectedOffering?.lectureCode,
                term: selectedOffering?.term,
                target: selectedOffering?.target,
                className: selectedOffering?.className,
                remarks: selectedOffering?.remarks,
                sourceOffering: selectedOffering,
                scheduleDay: selectedOffering?.day,
                schedulePeriod: selectedOffering?.period,
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
