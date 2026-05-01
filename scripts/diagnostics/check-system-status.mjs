import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";

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

function normalizeCell(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").trim();
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

function parseCsv(relativePath) {
  const text = readText(relativePath).replace(/^\uFEFF/, "");
  return Papa.parse(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
}

function validateCreditRequirementRow(row, rowNumber) {
  const requiredFields = ["stage", "area", "subarea", "total_required_credits", "必修_credits", "選択必修1_credits", "選択必修2_credits", "自由_credits"];
  const issues = [];

  for (const field of requiredFields) {
    if (!normalizeCell(row[field])) {
      issues.push(`${rowNumber}行目: ${field} が空欄`);
    }
  }

  for (const field of ["total_required_credits", "必修_credits", "選択必修1_credits", "選択必修2_credits", "自由_credits"]) {
    if (normalizeCell(row[field]) && Number.isNaN(Number(normalizeCell(row[field]).replace(/,/g, "")))) {
      issues.push(`${rowNumber}行目: ${field} が数値ではない`);
    }
  }

  return issues;
}

function validateCourseRow(row, rowNumber) {
  const issues = [];
  for (const field of ["id", "title", "credits", "category", "group", "courseType"]) {
    if (!normalizeCell(row[field])) {
      issues.push(`${rowNumber}行目: ${field} が空欄`);
    }
  }

  const credits = normalizeCell(row.credits);
  if (credits && Number.isNaN(Number(credits.replace(/,/g, "")))) {
    issues.push(`${rowNumber}行目: credits が数値ではない`);
  }

  if (normalizeCell(row.courseType) && !["required", "elective-required", "elective"].includes(normalizeCell(row.courseType))) {
    issues.push(`${rowNumber}行目: courseType が不正`);
  }

  return issues;
}

function validateScheduleRow(row, rowNumber) {
  const issues = [];
  for (const field of ["departmentId", "sourceDepartment", "day", "period", "term", "title", "lectureCode"]) {
    if (!normalizeCell(row[field])) {
      issues.push(`${rowNumber}行目: ${field} が空欄`);
    }
  }

  if (normalizeCell(row.sourcePage) && Number.isNaN(Number(normalizeCell(row.sourcePage).replace(/,/g, "")))) {
    issues.push(`${rowNumber}行目: sourcePage が数値ではない`);
  }

  return issues;
}

function checkCsv(relativePath, requiredHeader, label, validator, required = true) {
  if (!fileExists(relativePath)) {
    log(required ? "ERROR" : "WARN", `${label}: ${relativePath} not found`);
    return { exists: false, rows: 0, headerMatches: false };
  }

  const parsed = parseCsv(relativePath);
  const headerFields = parsed.meta.fields ?? [];
  const rows = parsed.data.length;
  const requiredFields = requiredHeader.split(",").map((field) => field.trim()).filter(Boolean);
  const missingFields = requiredFields.filter((field) => !headerFields.includes(field));

  const issues = [];
  if (missingFields.length > 0) {
    issues.push(`${label}: missing required fields -> ${missingFields.join(", ")}`);
  }

  if (parsed.errors.length > 0) {
    for (const errorItem of parsed.errors) {
      issues.push(`${label}: ${errorItem.message}`);
    }
  }

  if (validator) {
    parsed.data.forEach((row, index) => {
      const rowIssues = validator(row, index + 2);
      issues.push(...rowIssues.map((issue) => `${label}: ${issue}`));
    });
  }

  if (issues.length > 0) {
    log("ERROR", `${label}: validation failed (${issues.length} issues)`);
    issues.slice(0, 5).forEach((issue) => console.log(`       ${issue}`));
    return { exists: true, rows, headerMatches: missingFields.length === 0 };
  }

  log("OK", `${label}: ${rows} rows`);
  return { exists: true, rows, headerMatches: true };
}

function checkSchedule(departmentId, scheduleHeader) {
  const departmentSchedulePath = `public/department/rikou/2026/${departmentId}_2026_spring_schedule.csv`;
  const sharedSchedulePath = "public/department/rikou/2026/rikou_2026_spring_schedule.csv";

  if (fileExists(departmentSchedulePath)) {
    const parsed = parseCsv(departmentSchedulePath);
    const headerFields = parsed.meta.fields ?? [];
    const rows = parsed.data.length;
    const requiredFields = scheduleHeader.split(",").map((field) => field.trim()).filter(Boolean);
    const missingFields = requiredFields.filter((field) => !headerFields.includes(field));

    const issues = missingFields.length > 0 ? [`schedule: missing required fields -> ${missingFields.join(", ")}`] : [];
    issues.push(...parsed.errors.flatMap((errorItem) => [`schedule: ${errorItem.message}`]));
    parsed.data.forEach((row, index) => {
      const rowIssues = validateScheduleRow(row, index + 2);
      issues.push(...rowIssues.map((issue) => `schedule: ${issue}`));
    });

    if (issues.length > 0) {
      log("ERROR", `schedule: validation failed (${issues.length} issues) (${departmentId})`);
      issues.slice(0, 5).forEach((issue) => console.log(`       ${issue}`));
      return;
    }

    log("OK", `schedule: ${rows} rows`);
    return;
  }

  if (fileExists(sharedSchedulePath)) {
    const parsed = parseCsv(sharedSchedulePath);
    const headerFields = parsed.meta.fields ?? [];
    const rows = parsed.data.length;
    const requiredFields = scheduleHeader.split(",").map((field) => field.trim()).filter(Boolean);
    const missingFields = requiredFields.filter((field) => !headerFields.includes(field));

    const issues = missingFields.length > 0 ? [`schedule fallback: missing required fields -> ${missingFields.join(", ")}`] : [];
    issues.push(...parsed.errors.flatMap((errorItem) => [`schedule fallback: ${errorItem.message}`]));
    parsed.data.forEach((row, index) => {
      const rowIssues = validateScheduleRow(row, index + 2);
      issues.push(...rowIssues.map((issue) => `schedule fallback: ${issue}`));
    });

    if (issues.length > 0) {
      log("ERROR", `schedule fallback: validation failed (${issues.length} issues)`);
      issues.slice(0, 5).forEach((issue) => console.log(`       ${issue}`));
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
    validateCreditRequirementRow,
    true,
  );

  checkCsv(
    `public/department/rikou/2026/${department.id}_timetable_by_category.csv`,
    coursesHeader,
    "courses",
    validateCourseRow,
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