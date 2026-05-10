const fs = require('fs');

const ttPath = 'src/TimetableApp.tsx';
let tt = fs.readFileSync(ttPath, 'utf8');
tt = tt.replace(/courses: \[\]/g, "courses: [], applicableCourses: []");
fs.writeFileSync(ttPath, tt, 'utf8');

const alPath = 'src/utils/autoLoadCSV.ts';
let al = fs.readFileSync(alPath, 'utf8');
al = al.replace(/applicableCourses: string;/, "applicableCourses: string;");
al = al.replace(/sharedSchedule: `\/department\/\$\{facultyId\}\/\$\{year\}\/\$\{facultyId\}_class_schedule\.csv`,/g, "sharedSchedule: `/department/${facultyId}/${year}/${facultyId}_class_schedule.csv`,\n      applicableCourses: `/department/${facultyId}/${year}/${departmentId}_applicable_courses.csv`,");
al = al.replace(/fallbackSharedSchedule: `\/department\/\$\{facultyId\}\/\$\{year\}\/\$\{facultyId\}_class_schedule\.csv`/g, "fallbackSharedSchedule: `/department/${facultyId}/${year}/${facultyId}_class_schedule.csv`,\n    applicableCourses: `/department/${facultyId}/${year}/${departmentId}_applicable_courses.csv`");
al = al.replace(/curriculum, courses, stats:/g, "curriculum, courses, applicableCourses, stats:");
al = al.replace(/courses: \[\], stats:/g, "courses: [], applicableCourses: [], stats:");
fs.writeFileSync(alPath, al, 'utf8');
