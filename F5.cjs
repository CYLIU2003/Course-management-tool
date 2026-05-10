const fs = require('fs');

const path = 'src/TimetableApp.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/<GradeManagement[\s\S]*?\/>/, \<GradeManagement
                settings={settings}
                snapshot={dashboardSnapshot}
                importedCourses={importedCourses}
                allYearsData={allYearsData}
                currentYear={currentYear}
                applicableCourses={csvLoadResult?.applicableCourses ?? []}
                onBack={() => {
                  setActiveQuarter("1Q");
                }}
              />\);

fs.writeFileSync(path, txt, 'utf8');
