const fs = require('fs');

const gmPath = 'src/components/GradeManagement.tsx';
let gm = fs.readFileSync(gmPath, 'utf8');

gm = gm.replace(
  "importedCourses: AcademicCourse[];",
  "importedCourses: AcademicCourse[];\n  applicableCourses?: import('../utils/csvImporter').ApplicableCourseRow[];"
);

gm = gm.replace(
  "        <GraduationRequirementPanel\n          curriculum={settings.curriculum}\n          allYearsData={allYearsData}\n          courses={importedCourses}\n          currentYear={currentYear}\n        />",
  "        <GraduationRequirementPanel\n          curriculum={settings.curriculum}\n          allYearsData={allYearsData}\n          courses={importedCourses}\n          applicableCourses={props.applicableCourses ?? []}\n          currentYear={currentYear}\n        />"
);

fs.writeFileSync(gmPath, gm, 'utf8');
