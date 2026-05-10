const fs = require('fs');

const path = 'src/TimetableApp.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/<GraduationRequirementPanel[\s\S]*?currentYear=\{currentYear\}[\s\S]*?\/>/, `<GraduationRequirementPanel
              curriculum={settings.curriculum}
              allYearsData={allYearsData}
              courses={importedCourses}
              applicableCourses={loadedCSVData?.applicableCourses ?? []}
              currentYear={currentYear}
            />`);

txt = txt.replace(/<GradeManagement[\s\S]*?\/>/, `<GradeManagement
                settings={settings}
                snapshot={dashboardSnapshot}
                importedCourses={importedCourses}
                allYearsData={allYearsData}
                currentYear={currentYear}
                applicableCourses={loadedCSVData?.applicableCourses ?? []}
              />`);

fs.writeFileSync(path, txt, 'utf8');
