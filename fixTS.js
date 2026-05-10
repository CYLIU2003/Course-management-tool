const fs = require('fs');

const ttPath = 'src/TimetableApp.tsx';
let tt = fs.readFileSync(ttPath, 'utf8');

tt = tt.replace(/courses: \[\]/g, "courses: [], applicableCourses: []");
fs.writeFileSync(ttPath, tt, 'utf8');

const alPath = 'src/utils/autoLoadCSV.ts';
let al = fs.readFileSync(alPath, 'utf8');

al = al.replace(
  /sharedSchedule: \\/department\/\$\{facultyId\}\/\$\{year\}\/\$\{facultyId\}_class_schedule\.csv\,/g,
  "sharedSchedule: \/department/\/\/\_class_schedule.csv\,\n      applicableCourses: \/department/\/\/\_applicable_courses.csv\,"
);

al = al.replace(
  /fallbackSharedSchedule: \\/department\/\$\{facultyId\}\/\$\{year\}\/\$\{facultyId\}_class_schedule\.csv\/g,
  "fallbackSharedSchedule: \/department/\/\/\_class_schedule.csv\,\n    applicableCourses: \/department/\/\/\_applicable_courses.csv\"
);

al = al.replace(/courses, stats/g, "courses, applicableCourses, stats");
al = al.replace(/courses: \[\], stats/g, "courses: [], applicableCourses: [], stats");

fs.writeFileSync(alPath, al, 'utf8');
