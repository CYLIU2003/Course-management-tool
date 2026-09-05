import { useEffect, useMemo, useRef, useState } from "react";
import { accountRequest, responseError, type Account, type StudentState } from "./api/account";
import HandbookBrowser from "./components/handbooks/HandbookBrowser";
import StudentGrades from "./components/StudentGrades";
import AppShell from "./components/layout/AppShell";
import AppHeader from "./components/layout/AppHeader";
import DataManagementMenu from "./components/layout/DataManagementMenu";
import HomeDashboard from "./components/home/HomeDashboard";
import DesktopNavigation from "./components/navigation/DesktopNavigation";
import BottomNavigation from "./components/navigation/BottomNavigation";
import { type AppPage } from "./components/navigation/appNavigation";
import QuarterTabs from "./components/timetable/QuarterTabs";
import AppSettingsModal from "./components/settings/AppSettingsModal";
import CourseSearchPanel from "./components/courses/CourseSearchPanel";
import CourseEditor from "./components/CourseEditor";
import GraduationRequirementPanel from "./components/GraduationRequirementPanel";
import { DataLoadNotice } from "./components/status/DataLoadNotice";
import type { AcademicAllYearsData, AcademicCourse, AcademicCourseCell, AcademicSettings, AcademicTimetable, AcademicYearData } from "./core/types";
import { AVAILABLE_DEPARTMENTS } from "./core/departments";
import { loadDepartmentCurriculum } from "./api/curriculum";
import type { CurriculumDataset } from "./core/curriculum";
import { buildDashboardSnapshot } from "./core/graduation";
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

type Settings = AcademicSettings & {
  days: string[];
  periods: { id: number; label: string; time: string }[];
  title: string;
  showTime: boolean;
};

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

export default function TimetableApp({ account, onStateChange }: { account: Account; onStateChange: (state: StudentState) => void }) {
  const [activeQuarter, setActiveQuarter] = useState<Quarter>("1Q");
  const [currentYear, setCurrentYear] = useState<Year>("1年次");
  const [currentPage, setCurrentPage] = useState<AppPage>("home");
  useEffect(() => {
    void accountRequest('/api/me/events', 'POST', { page: currentPage }).catch(() => console.warn('利用画面の記録に失敗しました。'));
  }, [currentPage]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [entranceYear, setEntranceYear] = useState(account.state?.entranceYear ?? account.entranceYear);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState(account.state?.departmentId ?? account.departmentId);
  const selectedDepartment = AVAILABLE_DEPARTMENTS.find((department) => department.id === selectedDepartmentId);

  const [importedCourses, setImportedCourses] = useState<AcademicCourse[]>([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [curriculumData, setCurriculumData] = useState<CurriculumDataset | null>(null);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);

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
    const stored = account.state?.settings;
    if (!stored) return defaults;
    return {
      ...defaults,
      ...stored,
      curriculum: undefined,
      requiredCredits: 0,
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

  const departmentLoadId = useRef(0);
  async function loadDepartment(departmentId: string, year = entranceYear): Promise<CurriculumDataset> {
    const requestId = ++departmentLoadId.current;
    setCurriculumLoading(true);
    setImportedCourses([]);
    setCurriculumData(null);
    setSettings((previous) => ({ ...previous, curriculum: undefined }));
    setCurriculumError(null);

    try {
      const result = await loadDepartmentCurriculum(departmentId, year);
      if (requestId !== departmentLoadId.current) return result;

      if (import.meta.env.DEV && result.courses.length === 0) {
        console.warn(`No courses loaded for department=${departmentId}, entranceYear=${year}. Check cohort availability.`);
      }

      setCurriculumData(result);

      setSettings((prev) => ({
        ...prev,
        curriculum: {
          ...result.curriculum,
          name: `${result.departmentName} ${year}年度入学`,
        },
      }));

      setImportedCourses(result.courses);
      return result;
    } catch (error) {
      console.error('❌ Auto-load failed:', error);
      const dept = AVAILABLE_DEPARTMENTS.find((department) => department.id === departmentId);
      const result: CurriculumDataset = {
        status: 'failed',
        departmentId,
        departmentName: dept ? `${dept.faculty} ${dept.name}` : departmentId,
        entranceYear: year,
        curriculum: {
          name: dept ? `${dept.faculty} ${dept.name}` : departmentId,
          requiredCredits: 0,
          breakdown: { required: 0, electiveRequired: 0, elective: 0 },
        },
        courses: [], applicableCourses: [],

      };

      if (requestId !== departmentLoadId.current) return result;
      setCurriculumData(result);
      setCurriculumError('科目データの読み込みに失敗しました。');
      setSettings((prev) => ({
        ...prev,
        curriculum: {
          ...result.curriculum,
          name: `${result.departmentName} ${year}年度入学`,
        },
      }));
      setImportedCourses([]);
      return result;
    } finally {
      if (requestId === departmentLoadId.current) setCurriculumLoading(false);
    }
  }

  // 起動時にSQLite APIから履修情報を読み込む
  useEffect(() => {
    const loadInitialCurriculum = async () => {
      if (importedCourses.length > 0) {
        setCurriculumLoading(false);
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
          console.log('Curriculum load result', result);
        }
      } catch (error) {
        console.error('❌ Auto-load failed:', error);
      }
    };

    void loadInitialCurriculum();
    // 初回マウント時のみ。学科・入学年度変更時は各handlerで再読込する。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 年度ごとのデータ管理
  const [allYearsData, setAllYearsData] = useState<AllYearsData>(() => {
    const stored = account.state?.allYearsData;
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

  const studentState = useMemo<StudentState>(() => ({
    departmentId: selectedDepartmentId, entranceYear, allYearsData,
    settings: { title: settings.title, days: settings.days, periods: settings.periods, showTime: settings.showTime },
  }), [selectedDepartmentId, entranceYear, allYearsData, settings.title, settings.days, settings.periods, settings.showTime]);
  useEffect(() => { onStateChange(studentState); }, [studentState, onStateChange]);

  const [editing, setEditing] = useState<{
    open: boolean;
    day?: string;
    periodId?: number;
    value?: CourseCell;
  }>({ open: false });
  const [pendingCourse, setPendingCourse] = useState<AcademicCourse | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  useEffect(() => { setPendingCourse(null); setActionMessage(''); setEditing({ open: false }); }, [selectedDepartmentId, entranceYear, currentYear, activeQuarter]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); setPendingCourse(null); setActionMessage(''); }, [currentPage]);

  const startAddingCourse = (course: AcademicCourse) => {
    setPendingCourse(course);
    setActionMessage('');
    document.getElementById('student-schedule')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  const openEdit = (day: string, periodId: number) => {
    const v = currentYearData.timetable[activeQuarter]?.[day]?.[String(periodId)] ?? null;
    if (pendingCourse && v?.title) { setActionMessage('このコマには授業があります。空きコマを選んでください。'); return; }
    setEditing({ open: true, day, periodId, value: pendingCourse ? {
      title: pendingCourse.title, courseId: pendingCourse.id, credits: pendingCourse.credits,
      courseType: pendingCourse.courseType, grade: '未履修',
    } : v });
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
              ...prev[currentYear].timetable[activeQuarter]?.[editing.day!],
              [String(editing.periodId!)]: payload,
            },
          },
        },
      },
    }));
    setEditing({ open: false });
    setPendingCourse(null);
    setActionMessage(payload ? '時間割を保存しました。' : 'このコマの授業を削除しました。');
  };
  
  const clearCell = () => saveCell(null);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ version: 4, ...studentState }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `timetable_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  const importJSON = async (file: File) => {
    try {
      if (file.size > 1024 * 1024) throw new Error('1MB以下のJSONファイルを選択してください。');
      const obj = JSON.parse(await file.text());
      if (!obj || typeof obj !== 'object' || !obj.settings) throw new Error('時間割のJSONファイルを選択してください。');
      let importedData = obj.allYearsData;
      if (!importedData && obj.data) {
        importedData = createDefaultAllYearsData();
        for (const q of QUARTERS) importedData['1年次'].timetable[q] = obj.data[q] ?? {};
        if (obj.settings.quarterRanges) importedData['1年次'].quarterRanges = obj.settings.quarterRanges;
      }
      const candidate: StudentState = {
        departmentId: obj.departmentId ?? selectedDepartmentId,
        entranceYear: obj.entranceYear ?? entranceYear,
        settings: { title: obj.settings.title ?? settings.title, days: obj.settings.days ?? settings.days,
          periods: obj.settings.periods ?? settings.periods, showTime: obj.settings.showTime ?? settings.showTime },
        allYearsData: importedData,
      };
      const validation = await accountRequest('/api/me/validate-state', 'POST', candidate);
      if (!validation.ok) throw new Error(await responseError(validation));
      if (!window.confirm('現在の時間割・成績を、このファイルの内容に置き換えますか？')) return;
      setEntranceYear(candidate.entranceYear); setSelectedDepartmentId(candidate.departmentId);
      setSettings((previous) => ({ ...previous, ...candidate.settings }));
      setAllYearsData(candidate.allYearsData);
      await loadDepartment(candidate.departmentId, candidate.entranceYear);
      alert('読み込みました。画面上部の保存状態を確認してください。');
    } catch (reason) { alert(reason instanceof Error ? reason.message : '読込に失敗しました。'); }
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
    if (!window.confirm("保存された時間割・成績をすべて初期化しますか？ 学科・入学年度は維持します。")) return;
    const defaultDepartmentId = selectedDepartmentId;
    const defaultEntranceYear = entranceYear;
    setCurrentYear("1年次");
    setActiveQuarter("1Q");
    setCurrentPage("home");
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
    />
  );

  const pageContent = (() => {
    switch (currentPage) {
      case 'handbooks':
        return <HandbookBrowser key={`${selectedDepartmentId}:${entranceYear}`} department={selectedDepartment} entranceYear={entranceYear} allYearsData={allYearsData} />;
      case "home":
        return (
          <HomeDashboard
            snapshot={dashboardSnapshot}
            curriculumName={settings.curriculum?.name}
            currentYear={currentYear}
            currentQuarter={activeQuarter}
            timetable={currentYearData.timetable}
            onOpenTimetable={() => setCurrentPage("timetable")}
            onOpenRequirements={() => setCurrentPage("handbooks")}
            onOpenGrades={() => setCurrentPage("grades")}
          />
        );
      case "timetable":
        return (
          <div className="page-stack timetable-page">
            <section className="tt-card">
              <div className="section-title">
                <div>
                  <h2>{currentYear} - {activeQuarter} の時間割</h2>
                  <span className="small print:hidden">科目を探す → 追加 → 空きコマを選ぶ。登録済みの授業はタップで編集できます。</span>
                </div>
                <button type="button" onClick={() => setCopyOpen(true)} className="btn-ghost print:hidden">
                  他Qへコピー
                </button>
              </div>
            </section>

            <div className="timetable-page__layout">
              <aside className="tt-card timetable-page__search">
                <CourseSearchPanel key={`${selectedDepartmentId}:${entranceYear}`} courses={importedCourses} onAdd={startAddingCourse} />
              </aside>

              <section id="student-schedule" className="tt-card timetable-page__schedule">
                {pendingCourse && <div className="placement-banner" role="status"><div><strong>{pendingCourse.title}</strong><p>追加する空きコマを選んでください。</p></div><button className="btn-ghost" onClick={() => { setPendingCourse(null); setActionMessage(''); }}>キャンセル</button></div>}
                {actionMessage && <p className="student-note" role="status">{actionMessage}</p>}
                <QuarterTabs value={activeQuarter} quarters={QUARTERS} onChange={(quarter) => setActiveQuarter(quarter as Quarter)} />
                <div className="tt-tablewrap timetable-scroll timetable-page__tablewrap">
                  <Table
                    quarter={activeQuarter}
                    data={currentYearData.timetable}
                    days={settings.days}
                    periods={settings.periods}
                    showTime={settings.showTime}
                    onCellClick={openEdit}
                  />
                </div>
                <p className="small print:hidden">アカウントに自動保存されます。大学の履修登録は大学ポータルで行ってください。</p>
              </section>
            </div>
          </div>
        );
      case "requirements":
        if (curriculumData?.referenceOnly || curriculumData?.status === 'failed' || curriculumData?.status === 'unavailable') {
          return <HandbookBrowser key={`${selectedDepartmentId}:${entranceYear}`} department={selectedDepartment} entranceYear={entranceYear} allYearsData={allYearsData} />;
        }
        return (
          <div className="page-stack requirements-page">
            <section className="tt-card">
              <div className="section-title">
                <div>
                  <h2>卒業要件</h2>
                  <span className="small">不足単位と区分ごとの進捗を確認します。</span>
                </div>
                <button type="button" onClick={() => setCurrentPage("home")} className="btn-ghost">
                  ホームへ
                </button>
              </div>
            </section>

            <GraduationRequirementPanel
              curriculum={settings.curriculum}
              allYearsData={allYearsData}
              courses={importedCourses}
              applicableCourses={curriculumData?.applicableCourses ?? []}
              currentYear={currentYear}
            />
          </div>
        );
      case "grades":
        return (
          <StudentGrades data={allYearsData} year={currentYear} snapshot={dashboardSnapshot}
            onOpenTimetable={() => setCurrentPage('timetable')}
            onGradeChange={(key, grade) => setAllYearsData(previous => {
              const next = structuredClone(previous);
              for (const days of Object.values(next[currentYear].timetable)) for (const slots of Object.values(days)) for (const cell of Object.values(slots)) {
                if (cell && (cell.courseId || cell.title.normalize('NFKC').replace(/\s+/g, '')) === key) cell.grade = grade;
              }
              return next;
            })} />
        );
      case "settings":
        return (
          <div className="page-stack settings-page">
            <section className="tt-card">
              <div className="section-title">
                <div>
                  <h2>設定</h2>
                  <span className="small">学科・入学年度・時限設定とデータ管理をまとめます。</span>
                </div>
                <button type="button" onClick={handleOpenSettings} className="btn-primary">
                  詳細設定を開く
                </button>
              </div>

              <div className="settings-page__summary">
                <div className="stats-card">
                  <div className="stats-label">学科</div>
                  <div className="stats-value">{selectedDepartment?.faculty ?? "-"} {selectedDepartment?.name ?? ""}</div>
                </div>
                <div className="stats-card">
                  <div className="stats-label">入学年度</div>
                  <div className="stats-value">{entranceYear} 年度</div>
                  <div className="small" style={{ color: 'var(--muted)' }}>
                    現在の表示: {currentYear}
                  </div>
                </div>
                <div className="stats-card">
                  <div className="stats-label">基本設定</div>
                  <div className="stats-value">{settings.title}</div>
                  <div className="small" style={{ color: 'var(--muted)' }}>
                    {settings.showTime ? '時限の時刻を表示' : '時限の時刻は非表示'}
                  </div>
                </div>
              </div>
            </section>

            <section className="tt-card">
              <div className="section-title">
                <div>
                  <h2>データ管理</h2>
                  <span className="small">CSV / JSON / 印刷 / ICS をここから扱います。</span>
                </div>
              </div>
              {dataManagementMenu}
            </section>
          </div>
        );
      default:
        return null;
    }
  })();

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
        onOpenSettings={() => setCurrentPage('settings')}
      />

      <main className="app-container app-main" data-curriculum-key={curriculumData ? `${curriculumData.departmentId}:${curriculumData.entranceYear}` : undefined} data-curriculum-status={curriculumData?.status}>
        <DataLoadNotice
          status={curriculumLoading ? "loading" : curriculumError ? "failed" : curriculumData?.status === "unavailable" ? "unavailable" : "ready"}
          message={curriculumError}
          onRetry={curriculumError ? () => void loadDepartment(selectedDepartmentId, entranceYear) : undefined}
        />
        <DesktopNavigation currentPage={currentPage} onPageChange={setCurrentPage} />
        {currentPage === 'requirements' && <div className="handbook-notice">
          進級・コース別の条件も学修要覧で確認してください。
          {' '}<button type="button" onClick={() => setCurrentPage('handbooks')}>学修要覧を確認</button>
        </div>}
        {pageContent}
      </main>

      <BottomNavigation currentPage={currentPage} onPageChange={setCurrentPage} />

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
        <CourseEditor
          initial={editing.value ?? null}
          canDelete={!pendingCourse && !!editing.value?.title}
          day={editing.day!}
          periodId={editing.periodId!}
          onClose={() => setEditing({ open: false })}
          onSave={saveCell}
          onClear={clearCell}
          courses={importedCourses}
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
                    aria-label={`${d}曜日${p.id}限${cell?.title ? ` ${cell.title}を編集` : 'に授業を追加'}`}
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
                      <span>＋ 授業を追加</span>
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

function createDefaultSettings(): Settings {
  return {
    days: [...DEFAULT_DAYS],
    periods: DEFAULT_PERIODS.map((p) => ({ ...p })),
    title: "時間割",
    showTime: true,
    requiredCredits: 0, // 要件はSQLiteの検証済みデータだけを使用
  };
}
