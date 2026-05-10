const fs = require('fs');

const path = 'src/TimetableApp.tsx';
let txt = fs.readFileSync(path, 'utf8');

txt = txt.replace(/loadedCSVData\?/g, 'csvLoadResult?');

fs.writeFileSync(path, txt, 'utf8');
