const fs = require('fs');

const path = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/utils/autoLoadCSV.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. replace buildCSVPaths
content = content.replace(
  /function buildCSVPaths\([\s\S]*?\}\n\}/,
  \unction buildCSVPaths(departmentId: string, entranceYear?: number): CSVPaths {
  const dept = findDepartment(departmentId);
  const facultyId = dept?.facultyId ?? 'rikou';
  const basePath = \\\/department/\\\\;
  const legacyRikouPath = \\\/department/rikou\\\;

  if (entranceYear) {
    return {
      requirements: \\\\/\/\_credit_requirements.csv\\\,
      timetable: \\\\/\/\_timetable_by_category.csv\\\,
      schedule: \\\\/\/\_\_spring_schedule.csv\\\,
      sharedSchedule: \\\\/\/\_\_spring_schedule.csv\\\,
      applicableCourses: \\\\/\/\_applicable_courses.csv\\\,
      fallbackRequirements: \\\\/\_credit_requirements.csv\\\,
      fallbackTimetable: \\\\/\_timetable_by_category.csv\\\,
      fallbackSchedule: \\\\/\_\_spring_schedule.csv\\\,
    } as any;
  }

  return {
    requirements: \\\\/\_credit_requirements.csv\\\,
    timetable: \\\\/\_timetable_by_category.csv\\\,
    schedule: \\\\/\_2026_spring_schedule.csv\\\,
    sharedSchedule: \\\\/\_2026_spring_schedule.csv\\\,
    applicableCourses: \\\\/2026/\_applicable_courses.csv\\\,
    fallbackRequirements: \\\\/\_credit_requirements.csv\\\,
    fallbackTimetable: \\\\/\_timetable_by_category.csv\\\,
  } as any;
}\
);

// 2. update autoLoadDepartmentCSVs to fetch applicableCourses
content = content.replace(
  /const timetableFetch = await fetchRequiredCSVText\('timetable', paths\.timetable, paths\.fallbackTimetable\);\n\s*resources\.push\(timetableFetch\.result\);/,
  \const timetableFetch = await fetchRequiredCSVText('timetable', paths.timetable, paths.fallbackTimetable);
    resources.push(timetableFetch.result);

    const applicableFetch = await fetchRequiredCSVText('applicableCourses', paths.applicableCourses);
    resources.push(applicableFetch.result);\
);

// 3. update autoLoadDepartmentCSVs to parsing
content = content.replace(
  /const timetableFile = new File\(\[new Blob\(\[timetableFetch\.text\], \{ type: 'text\/csv' \}\)\], \\$\{departmentId\}_timetable_by_category\.csv\, \{ type: 'text\/csv' \}\);/,
  \const timetableFile = new File([new Blob([timetableFetch.text], { type: 'text/csv' })], \\\\_timetable_by_category.csv\\\, { type: 'text/csv' });
      const applicableFile = new File([new Blob([applicableFetch.text], { type: 'text/csv' })], \\\\_applicable_courses.csv\\\, { type: 'text/csv' });\
);

content = content.replace(
  /const timetableParse = await parseCoursesFile\(timetableFile\);/,
  \const timetableParse = await parseCoursesFile(timetableFile);
      const applicableParse = await parseApplicableCoursesFile(applicableFile);\
);

content = content.replace(
  /timetableFetch\.result\.rowCount = timetableParse\.rows\.length;/,
  \	imetableFetch.result.rowCount = timetableParse.rows.length;
      applicableFetch.result.rowCount = applicableParse.rows.length;
      applicableFetch.result.message = \\\pplicable_courses CSVを読み込みました。(\行)\\\;\
);

content = content.replace(
  /const curriculum = parseCreditRequirements\(requirementRows\);/g,
  \const curriculum = parseCreditRequirements(requirementRows);
      const applicableCourses = applicableParse.rows;\
);

content = content.replace(
  /courses: mergedCourses,/g,
  \courses: mergedCourses,
        applicableCourses,\
);

fs.writeFileSync(path, content, 'utf8');
