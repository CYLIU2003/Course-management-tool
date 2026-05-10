const fs = require('fs');
const app = fs.readFileSync('src/TimetableApp.tsx', 'utf8');
const fixedApp = app.replace(
  /<GraduationRequirementPanel\n              curriculum={settings\.curriculum}\n              allYearsData={allYearsData}\n              courses={importedCourses}\n              currentYear={currentYear}\n            \/>/g,
  "<GraduationRequirementPanel\n              curriculum={settings.curriculum}\n              allYearsData={allYearsData}\n              courses={importedCourses}\n              applicableCourses={loadedCSVData?.applicableCourses ?? []}\n              currentYear={currentYear}\n            />"
);
fs.writeFileSync('src/TimetableApp.tsx', fixedApp, 'utf8');
