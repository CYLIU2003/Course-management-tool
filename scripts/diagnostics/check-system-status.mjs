import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = new Set(process.argv.slice(2));
const csvOnly = args.has("--csv-only");

let ok = 0;
let warn = 0;
let error = 0;

function log(level, message) {
  const label = level.padEnd(5, " ");
  console.log(`[${label}] ${message}`);

  if (level === "OK") ok += 1;
  if (level === "WARN") warn += 1;
  if (level === "ERROR") error += 1;
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function resolveRelativePath(relativePath) {
  return path.join(root, relativePath);
}

function getStat(relativePath) {
  try {
    return fs.statSync(resolveRelativePath(relativePath));
  } catch {
    return null;
  }
}

function fileExists(relativePath) {
  const stat = getStat(relativePath);
  return Boolean(stat && stat.isFile());
}

function directoryExists(relativePath) {
  const stat = getStat(relativePath);
  return Boolean(stat && stat.isDirectory());
}

function readText(relativePath) {
  return fs.readFileSync(resolveRelativePath(relativePath), "utf8");
}

function getFirstCsvLine(relativePath) {
  const text = readText(relativePath).replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.trim();
}

function countCsvRows(relativePath) {
  const text = readText(relativePath).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

function checkFile(relativePath, required = true) {
  if (fileExists(relativePath)) {
    log("OK", relativePath);
    return true;
  }

  log(required ? "ERROR" : "WARN", `${relativePath} not found`);
  return false;
}

function checkDirectory(relativePath, required = true) {
  if (directoryExists(relativePath)) {
    log("OK", relativePath);
    return true;
  }

  log(required ? "ERROR" : "WARN", `${relativePath} not found`);
  return false;
}

function checkCsv(relativePath, expectedHeader, label, required = true) {
  if (!fileExists(relativePath)) {
    log(required ? "ERROR" : "WARN", `${label}: ${relativePath} not found`);
    return { exists: false, rows: 0, headerMatches: false };
  }

  const header = getFirstCsvLine(relativePath);
  const rows = countCsvRows(relativePath);
  const headerMatches = header === expectedHeader;

  if (!headerMatches) {
    log("ERROR", `${label}: header mismatch`);
    console.log(`       expected: ${expectedHeader}`);
    console.log(`       actual:   ${header}`);
    return { exists: true, rows, headerMatches };
  }

  log("OK", `${label}: ${rows} rows`);
  return { exists: true, rows, headerMatches };
}

function checkSchedule(departmentId, scheduleHeader) {
  const departmentSchedulePath = `public/department/rikou/2026/${departmentId}_2026_spring_schedule.csv`;
  const sharedSchedulePath = "public/department/rikou/2026/rikou_2026_spring_schedule.csv";

  if (fileExists(departmentSchedulePath)) {
    const header = getFirstCsvLine(departmentSchedulePath);
    const rows = countCsvRows(departmentSchedulePath);

    if (header !== scheduleHeader) {
      log("ERROR", `schedule: header mismatch (${departmentId})`);
      console.log(`       expected: ${scheduleHeader}`);
      console.log(`       actual:   ${header}`);
      return;
    }

    log("OK", `schedule: ${rows} rows`);
    return;
  }

  if (fileExists(sharedSchedulePath)) {
    const header = getFirstCsvLine(sharedSchedulePath);
    const rows = countCsvRows(sharedSchedulePath);

    if (header !== scheduleHeader) {
      log("ERROR", `schedule fallback: header mismatch (${sharedSchedulePath})`);
      console.log(`       expected: ${scheduleHeader}`);
      console.log(`       actual:   ${header}`);
      return;
    }

    log("OK", `schedule fallback: ${rows} rows shared`);
    return;
  }

  log("WARN", `schedule missing: ${departmentSchedulePath} and ${sharedSchedulePath}`);
}

const departments = [
  { id: "denki", name: "電気電子通信工学科" },
  { id: "kikai", name: "機械工学科" },
  { id: "kikai_system", name: "機械システム工学科" },
  { id: "iyo", name: "医用工学科" },
  { id: "ouyou_kagaku", name: "応用化学科" },
  { id: "genshiryoku", name: "原子力安全工学科" },
  { id: "shizen_shizen", name: "自然科学科（自然コース）" },
  { id: "shizen_suuri", name: "自然科学科（数理コース）" },
];

const requirementsHeader = "stage,area,subarea,total_required_credits,必修_credits,選択必修1_credits,選択必修2_credits,自由_credits,notes";
const coursesHeader = "id,title,credits,raw_required,category,group,courseType";
const scheduleHeader = "departmentId,sourceDepartment,day,period,term,gradeYear,className,title,teacher,lectureCode,room,target,remarks,requiredFlag,sourcePage";

console.log("============================================================");
console.log("Course-management-tool System Status");
console.log("============================================================");
console.log("");
console.log(`[INFO] Project root: ${root}`);
console.log(`[INFO] Check time: ${formatTimestamp(new Date())}`);
console.log("");

if (!csvOnly) {
  console.log("------------------------------------------------------------");
  console.log("Core files");
  console.log("------------------------------------------------------------");

  checkFile("package.json");
  checkFile("src/TimetableApp.tsx");
  checkFile("src/utils/autoLoadCSV.ts");
  checkFile("src/utils/csvImporter.ts");
  checkFile("src/utils/academicProgress.ts");
  checkFile("src/components/courses/CourseSearchPanel.tsx", false);
  checkFile("src/components/status/CSVLoadStatusPanel.tsx", false);
  checkFile("src/utils/courseOffering.ts", false);
  console.log("");
}

console.log("------------------------------------------------------------");
console.log("CSV directory");
console.log("------------------------------------------------------------");

checkDirectory("public/department/rikou/2026");
console.log("");

console.log("------------------------------------------------------------");
console.log("2026 Rikou CSV status");
console.log("------------------------------------------------------------");

for (const department of departments) {
  console.log("");
  console.log(`[${department.id}] ${department.name}`);

  checkCsv(
    `public/department/rikou/2026/${department.id}_credit_requirements.csv`,
    requirementsHeader,
    "requirements",
    true,
  );

  checkCsv(
    `public/department/rikou/2026/${department.id}_timetable_by_category.csv`,
    coursesHeader,
    "courses",
    true,
  );

  checkSchedule(department.id, scheduleHeader);
}

console.log("");
console.log("------------------------------------------------------------");
console.log("Summary");
console.log("------------------------------------------------------------");
console.log(`OK: ${ok}`);
console.log(`WARN: ${warn}`);
console.log(`ERROR: ${error}`);
console.log("");

if (error > 0) {
  console.log("Overall status: ERROR");
  process.exit(1);
}

if (warn > 0) {
  console.log("Overall status: WARN");
  process.exit(0);
}

console.log("Overall status: OK");
process.exit(0);