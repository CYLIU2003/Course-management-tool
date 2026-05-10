const fs = require('fs');

const gmPath = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/components/GradeManagement.tsx';
let gmContent = fs.readFileSync(gmPath, 'utf8');

if (!gmContent.includes('applicableCourses?: ApplicableCourseRow[]')) {
  gmContent = gmContent.replace(
    /showRequirementsPanel\?: boolean;\n\s*\}/,
    \showRequirementsPanel?: boolean;
    applicableCourses?: ApplicableCourseRow[];
  }\
  );
  gmContent = gmContent.replace(
    /import type \{ AcademicAllYearsData/,
    \import type { ApplicableCourseRow } from '../utils/csvImporter';\nimport type { AcademicAllYearsData\
  );
  gmContent = gmContent.replace(
    /export default function GradeManagement\(\{/,
    \xport default function GradeManagement({\
  ); // just checking format
  gmContent = gmContent.replace(
    /currentYear: AcademicYear;\n\s*onBack: \(\) => void;\n\s*showRequirementsPanel\?: boolean;\n\s*\}\) \{/,
    \currentYear: AcademicYear;
    onBack: () => void;
    showRequirementsPanel?: boolean;
    applicableCourses?: ApplicableCourseRow[];
  }) {\
  );
  // Actually, wait, it's matched with spacing.
  gmContent = gmContent.replace(
    /currentYear=\{currentYear\}\n\s*\/>/g,
    \currentYear={currentYear}\n            applicableCourses={applicableCourses}\n          />\
  );
  fs.writeFileSync(gmPath, gmContent, 'utf8');
}

