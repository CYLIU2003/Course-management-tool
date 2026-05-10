const fs = require('fs');
const alPath = 'src/utils/autoLoadCSV.ts';
let al = fs.readFileSync(alPath, 'utf8');

al = al.replace(
  "type CSVPaths = {",
  "type CSVPaths = {\n  fallbackApplicableCourses?: string;"
);
fs.writeFileSync(alPath, al, 'utf8');
