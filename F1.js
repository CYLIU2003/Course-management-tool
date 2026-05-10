const fs = require('fs');

const path = 'src/TimetableApp.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/<GraduationRequirementPanel[\s\S]*?\/>/g, \<GraduationRequirementPanel
              curriculum={settings.curriculum}
              allYearsData={allYearsData}
              courses={importedCourses}
              applicableCourses={loadedCSVData?.applicableCourses ?? []}
              currentYear={currentYear}
            />\);

fs.writeFileSync(path, txt, 'utf8');
