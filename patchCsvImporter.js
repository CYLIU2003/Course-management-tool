const fs = require('fs');

const path = 'C:/Users/PowerSystem_Desktop/Desktop/Course-management-tool/src/utils/csvImporter.ts';
let content = fs.readFileSync(path, 'utf8');

// prepend snippet to csvImporter.ts if not exists
if (!content.includes('ApplicableCourseRow')) {
  content += '\n' + fs.readFileSync('snippet_applicable.ts', 'utf8') + '\n';
  fs.writeFileSync(path, content, 'utf8');
}
