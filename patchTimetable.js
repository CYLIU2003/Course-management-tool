const fs = require('fs');

const tpPath = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/TimetableApp.tsx';
let tpContent = fs.readFileSync(tpPath, 'utf8');

if (!tpContent.includes('applicableCourses={csvLoadResult?.applicableCourses || []}')) {
  // Pass to GraduationRequirementPanel
  tpContent = tpContent.replace(
    /currentYear=\{currentYear\}\n\s*\/>/g,
    \currentYear={currentYear}\n              applicableCourses={csvLoadResult?.applicableCourses || []}\n            />\
  );
  
  // Pass to GradeManagement
  tpContent = tpContent.replace(
    /showRequirementsPanel=\{false\}\n\s*\/>/g,
    \showRequirementsPanel={false}\n            applicableCourses={csvLoadResult?.applicableCourses || []}\n          />\
  );

  fs.writeFileSync(tpPath, tpContent, 'utf8');
}
