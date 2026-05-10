const fs = require('fs');
const alPath = 'src/utils/autoLoadCSV.ts';
let al = fs.readFileSync(alPath, 'utf8');

al = al.replace(
  "fallbackTimetable: `${legacyRikouPath}/${departmentId}_timetable_by_category.csv`,",
  "fallbackTimetable: `${legacyRikouPath}/${departmentId}_timetable_by_category.csv`,\n    fallbackApplicableCourses: `${legacyRikouPath}/${departmentId}_applicable_courses.csv`,"
);

al = al.replace(
  "export interface CSVPaths {",
  "export interface CSVPaths {\n  fallbackApplicableCourses?: string;"
);

al = al.replace(
  "const scheduleFetch = await fetchOptionalCSVText('schedule', [paths.schedule, paths.sharedSchedule, paths.fallbackSchedule, paths.fallbackSharedSchedule]);",
  "const applicableFetch = await fetchOptionalCSVText('applicableCourses', [paths.applicableCourses, paths.fallbackApplicableCourses]);\n    resources.push(applicableFetch.result);\n    const applicableCoursesFile = new File([new Blob([applicableFetch.text], { type: 'text/csv' })], `${departmentId}_applicable_courses.csv`, { type: 'text/csv' });\n    const applicableParse = await parseApplicableCoursesFile(applicableCoursesFile);\n    const applicableCourses = applicableParse.rows;\n\n    const scheduleFetch = await fetchOptionalCSVText('schedule', [paths.schedule, paths.sharedSchedule, paths.fallbackSchedule, paths.fallbackSharedSchedule]);"
);

al = al.replace(
  "const curriculumCourses = parseCourses(requirementRows, timetableRows);",
  "const curriculumCourses = parseCourses(requirementRows, timetableRows);\n    applicableFetch.result.rowCount = applicableCourses.length;"
);

fs.writeFileSync(alPath, al, 'utf8');
